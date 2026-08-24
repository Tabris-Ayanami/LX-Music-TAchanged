use crate::error::CoreError;
use serde::Deserialize;
use std::{collections::HashSet, fs, path::PathBuf};

const MEDIA_EXTENSIONS: &[&str] = &["mp3", "flac", "ogg", "oga", "wav", "m4a"];

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LibraryScanRequest {
    pub folders: Vec<PathBuf>,
}

pub fn scan(request: &LibraryScanRequest) -> Result<Vec<PathBuf>, CoreError> {
    let mut files = Vec::new();
    let mut seen = HashSet::new();
    let mut pending = request.folders.clone();

    while let Some(folder) = pending.pop() {
        let entries = match fs::read_dir(folder) {
            Ok(entries) => entries,
            Err(_) => continue,
        };
        for entry in entries.flatten() {
            let file_type = match entry.file_type() {
                Ok(file_type) => file_type,
                Err(_) => continue,
            };
            let path = entry.path();
            if file_type.is_dir() {
                pending.push(path);
                continue;
            }
            if !file_type.is_file() || !is_media_file(&path) {
                continue;
            }
            let key = path.to_string_lossy().to_lowercase();
            if seen.insert(key) {
                files.push(path);
            }
        }
    }

    files.sort_by_cached_key(|path| path.to_string_lossy().to_lowercase());
    Ok(files)
}

fn is_media_file(path: &std::path::Path) -> bool {
    path.extension()
        .and_then(|extension| extension.to_str())
        .is_some_and(|extension| {
            MEDIA_EXTENSIONS.contains(&extension.to_ascii_lowercase().as_str())
        })
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;

    #[test]
    fn scans_supported_files_recursively_and_skips_other_files() {
        let root = std::env::temp_dir().join(format!("lx-native-library-{}", std::process::id()));
        let nested = root.join("nested");
        fs::create_dir_all(&nested).unwrap();
        fs::write(root.join("one.MP3"), b"test").unwrap();
        fs::write(nested.join("two.flac"), b"test").unwrap();
        fs::write(nested.join("ignore.txt"), b"test").unwrap();

        let result = scan(&LibraryScanRequest {
            folders: vec![root.clone(), root.clone()],
        })
        .unwrap();
        assert_eq!(result.len(), 2);
        assert!(result.iter().any(|path| path.ends_with("one.MP3")));
        assert!(result.iter().any(|path| path.ends_with("two.flac")));

        fs::remove_dir_all(root).unwrap();
    }
}
