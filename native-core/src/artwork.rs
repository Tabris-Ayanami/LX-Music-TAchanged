use crate::{error::CoreError, metadata};
use image::{DynamicImage, ImageDecoder, ImageFormat, ImageReader, imageops::FilterType};
use parking_lot::Mutex;
use serde::{Deserialize, Serialize};
use sha2::{Digest, Sha256};
use std::{
    collections::{HashMap, HashSet},
    fs,
    io::{Cursor, Read},
    path::{Path, PathBuf},
    process::{Command, Stdio},
    sync::Arc,
    time::UNIX_EPOCH,
};

pub const SIZES: &[u32] = &[64, 128, 256, 512];

#[derive(Debug, Clone)]
pub struct ArtworkCache {
    root: PathBuf,
    byte_budget: u64,
    ffmpeg_path: Option<PathBuf>,
    source_index: Arc<Mutex<HashMap<String, HashSet<String>>>>,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct VariantRequest {
    pub file_path: String,
    pub size: u32,
    #[serde(default)]
    pub external_artwork_path: Option<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ArtworkHandle {
    pub id: String,
    pub cache_path: String,
    pub mime_type: &'static str,
    pub width: u32,
    pub height: u32,
    pub byte_length: u64,
    pub source_fingerprint: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CacheStats {
    pub byte_budget: u64,
    pub byte_size: u64,
    pub entry_count: usize,
}

impl ArtworkCache {
    pub fn new(
        root: PathBuf,
        byte_budget: u64,
        ffmpeg_path: Option<PathBuf>,
    ) -> Result<Self, CoreError> {
        fs::create_dir_all(&root)?;
        Ok(Self {
            root,
            byte_budget,
            ffmpeg_path,
            source_index: Arc::new(Mutex::new(HashMap::new())),
        })
    }

    pub fn variant(&self, request: &VariantRequest) -> Result<Option<ArtworkHandle>, CoreError> {
        if !SIZES.contains(&request.size) {
            return Err(CoreError::InvalidArgument(format!(
                "artwork size must be one of {SIZES:?}"
            )));
        }
        let media_path = Path::new(&request.file_path);
        let source_path = request.external_artwork_path.as_deref().map(Path::new);
        let resolved_source = source_path.unwrap_or(media_path);
        let fingerprint = metadata::source_fingerprint(resolved_source)?;
        let id = hex::encode(Sha256::digest(
            format!(
                "{}\0{}\0{}\0{}",
                media_path.display(),
                resolved_source.display(),
                fingerprint,
                request.size
            )
            .as_bytes(),
        ));
        let cache_path = self.root.join(format!("{id}.webp"));
        self.source_index
            .lock()
            .entry(request.file_path.clone())
            .or_default()
            .insert(id.clone());
        if cache_path.is_file() {
            let _ = filetime::set_file_mtime(&cache_path, filetime::FileTime::now());
            return Ok(Some(self.handle(id, cache_path, fingerprint)?));
        }

        let bytes = match source_path {
            Some(path) => fs::read(path)?,
            None => match metadata::sibling_artwork(media_path) {
                Some(path) => fs::read(path)?,
                None => match metadata::extract_picture(media_path) {
                    Ok(Some(bytes)) => bytes,
                    Ok(None) | Err(_) => match self.extract_with_ffmpeg(media_path)? {
                        Some(bytes) => bytes,
                        None => return Ok(None),
                    },
                },
            },
        };
        let mut decoder = ImageReader::new(Cursor::new(bytes))
            .with_guessed_format()
            .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
            .into_decoder()
            .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
        let orientation = decoder
            .orientation()
            .unwrap_or(image::metadata::Orientation::NoTransforms);
        let mut image = DynamicImage::from_decoder(decoder)
            .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
        image.apply_orientation(orientation);
        let resized = image.resize(request.size, request.size, FilterType::Lanczos3);
        let temp_path = self
            .root
            .join(format!(".{id}.{}.tmp", uuid::Uuid::new_v4()));
        let mut output = fs::File::create(&temp_path)?;
        resized
            .write_to(&mut output, ImageFormat::WebP)
            .map_err(|error| CoreError::Io(error.to_string()))?;
        output.sync_all()?;
        if let Err(error) = fs::rename(&temp_path, &cache_path) {
            if cache_path.is_file() {
                let _ = fs::remove_file(&temp_path);
            } else {
                let _ = fs::remove_file(&temp_path);
                return Err(error.into());
            }
        }
        self.prune(&cache_path)?;
        Ok(Some(self.handle(id, cache_path, fingerprint)?))
    }

    pub fn invalidate(&self, file_path: &str) -> Result<u32, CoreError> {
        let mut removed = 0;
        let ids = self
            .source_index
            .lock()
            .remove(file_path)
            .unwrap_or_default();
        for id in ids {
            let path = self.root.join(format!("{id}.webp"));
            if path.is_file() {
                fs::remove_file(path)?;
                removed += 1;
            }
        }
        Ok(removed)
    }

    pub fn stats(&self) -> Result<CacheStats, CoreError> {
        let entries = self.entries()?;
        Ok(CacheStats {
            byte_budget: self.byte_budget,
            byte_size: entries.iter().map(|entry| entry.1).sum(),
            entry_count: entries.len(),
        })
    }

    fn handle(
        &self,
        id: String,
        path: PathBuf,
        fingerprint: String,
    ) -> Result<ArtworkHandle, CoreError> {
        let info = fs::metadata(&path)?;
        let dimensions = image::image_dimensions(&path)
            .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
        Ok(ArtworkHandle {
            id,
            cache_path: path.to_string_lossy().into_owned(),
            mime_type: "image/webp",
            width: dimensions.0,
            height: dimensions.1,
            byte_length: info.len(),
            source_fingerprint: fingerprint,
        })
    }

    fn extract_with_ffmpeg(&self, path: &Path) -> Result<Option<Vec<u8>>, CoreError> {
        let Some(ffmpeg) = &self.ffmpeg_path else {
            return Ok(None);
        };
        let mut child = Command::new(ffmpeg)
            .args(["-v", "error", "-i"])
            .arg(path)
            .args([
                "-map",
                "0:v:0",
                "-frames:v",
                "1",
                "-f",
                "image2pipe",
                "-vcodec",
                "png",
                "-",
            ])
            .stdout(Stdio::piped())
            .stderr(Stdio::null())
            .spawn()?;
        let mut bytes = Vec::new();
        child
            .stdout
            .take()
            .ok_or_else(|| CoreError::Internal("ffmpeg stdout unavailable".into()))?
            .take(32 * 1024 * 1024)
            .read_to_end(&mut bytes)?;
        let status = child.wait()?;
        Ok((status.success() && !bytes.is_empty()).then_some(bytes))
    }

    fn entries(&self) -> Result<Vec<(PathBuf, u64, u128)>, CoreError> {
        let mut entries = Vec::new();
        for entry in fs::read_dir(&self.root)? {
            let entry = entry?;
            let path = entry.path();
            if path.extension().and_then(|value| value.to_str()) != Some("webp") {
                continue;
            }
            let info = entry.metadata()?;
            let modified = info
                .modified()
                .ok()
                .and_then(|value| value.duration_since(UNIX_EPOCH).ok())
                .map(|value| value.as_millis())
                .unwrap_or_default();
            entries.push((path, info.len(), modified));
        }
        Ok(entries)
    }

    fn prune(&self, preserve: &Path) -> Result<(), CoreError> {
        let mut entries = self.entries()?;
        let mut total: u64 = entries.iter().map(|entry| entry.1).sum();
        entries.sort_by_key(|entry| entry.2);
        for (path, size, _) in entries {
            if total <= self.byte_budget {
                break;
            }
            if path == preserve {
                continue;
            }
            fs::remove_file(path)?;
            total = total.saturating_sub(size);
        }
        Ok(())
    }
}
