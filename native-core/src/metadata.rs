use crate::error::CoreError;
use lofty::{
    config::WriteOptions,
    file::{AudioFile, TaggedFileExt},
    picture::Picture,
    prelude::{Accessor, ItemKey},
    probe::Probe,
    tag::{Tag, TagExt, items::Timestamp},
};
use serde::{Deserialize, Serialize};
use std::{
    fs,
    path::{Path, PathBuf},
    process::Command,
    time::Duration,
};
use uuid::Uuid;

const SUPPORTED_EXTENSIONS: &[&str] = &[
    "mp3", "flac", "m4a", "mp4", "aac", "ogg", "oga", "opus", "wav", "ape", "wv", "aiff", "aif",
    "tta", "wma",
];

#[derive(Debug, Clone, Default, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "camelCase")]
#[serde(default)]
pub struct Metadata {
    pub file_path: String,
    pub format: String,
    pub title: String,
    pub artists: Vec<String>,
    pub album: String,
    pub album_artists: Vec<String>,
    pub track_number: u32,
    pub total_tracks: u32,
    pub disc_number: u32,
    pub total_discs: u32,
    pub year: u32,
    pub genre: Vec<String>,
    pub comment: String,
    pub composer: Vec<String>,
    pub cover_data_url: String,
    pub duration: f64,
    pub bitrate: u32,
    pub sample_rate: u32,
    pub embedded_lyrics: String,
    pub artwork_present: bool,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct MetadataWriteRequest {
    pub file_path: String,
    pub metadata: Metadata,
    pub cover_changed: bool,
    #[serde(default)]
    pub cover_source_path: Option<String>,
}

fn assert_supported(path: &Path) -> Result<(), CoreError> {
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .unwrap_or_default()
        .to_ascii_lowercase();
    if !SUPPORTED_EXTENSIONS.contains(&extension.as_str()) {
        return Err(CoreError::NotSupported(format!(
            "unsupported media extension: {extension}"
        )));
    }
    let info = fs::metadata(path)?;
    if !info.is_file() || info.len() < 32 {
        return Err(CoreError::InvalidArgument(
            "media file is empty or invalid".into(),
        ));
    }
    Ok(())
}

fn strings(tag: &Tag, key: ItemKey) -> Vec<String> {
    tag.get_strings(key)
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn first_string(tag: &Tag, key: ItemKey) -> String {
    tag.get_string(key).unwrap_or_default().trim().to_owned()
}

fn primary_tag(file: &lofty::file::TaggedFile) -> Option<&Tag> {
    file.primary_tag().or_else(|| file.first_tag())
}

pub fn read(path: &Path) -> Result<Metadata, CoreError> {
    assert_supported(path)?;
    let file = Probe::open(path)
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
        .guess_file_type()
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
        .read()
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
    let tag = primary_tag(&file);
    let properties = file.properties();
    let format = format!("{:?}", file.file_type());
    let duration = properties.duration().as_secs_f64();
    Ok(Metadata {
        file_path: path.to_string_lossy().into_owned(),
        format,
        title: tag
            .and_then(|value| value.title())
            .map(|value| value.trim().to_owned())
            .unwrap_or_default(),
        artists: tag
            .map(|value| strings(value, ItemKey::TrackArtist))
            .unwrap_or_default(),
        album: tag
            .and_then(|value| value.album())
            .map(|value| value.trim().to_owned())
            .unwrap_or_default(),
        album_artists: tag
            .map(|value| strings(value, ItemKey::AlbumArtist))
            .unwrap_or_default(),
        track_number: tag.and_then(|value| value.track()).unwrap_or_default(),
        total_tracks: tag
            .and_then(|value| value.track_total())
            .unwrap_or_default(),
        disc_number: tag.and_then(|value| value.disk()).unwrap_or_default(),
        total_discs: tag.and_then(|value| value.disk_total()).unwrap_or_default(),
        year: tag
            .and_then(|value| value.date())
            .map(|value| u32::from(value.year))
            .unwrap_or_default(),
        genre: tag
            .map(|value| strings(value, ItemKey::Genre))
            .unwrap_or_default(),
        comment: tag
            .and_then(|value| value.comment())
            .map(|value| value.trim().to_owned())
            .unwrap_or_default(),
        composer: tag
            .map(|value| strings(value, ItemKey::Composer))
            .unwrap_or_default(),
        cover_data_url: String::new(),
        duration,
        bitrate: properties.audio_bitrate().unwrap_or_default(),
        sample_rate: properties.sample_rate().unwrap_or_default(),
        embedded_lyrics: tag
            .map(|value| first_string(value, ItemKey::Lyrics))
            .unwrap_or_default(),
        artwork_present: tag.is_some_and(|value| !value.pictures().is_empty()),
    })
}

pub fn read_compatible(path: &Path, ffmpeg_path: Option<&Path>) -> Result<Metadata, CoreError> {
    match read(path) {
        Ok(value) => Ok(value),
        Err(primary_error) => match ffmpeg_path {
            Some(ffmpeg) => read_with_ffmpeg(path, ffmpeg).map_err(|fallback| {
                CoreError::InvalidArgument(format!("Lofty: {primary_error}; FFmpeg: {fallback}"))
            }),
            None => Err(primary_error),
        },
    }
}

fn read_with_ffmpeg(path: &Path, ffmpeg: &Path) -> Result<Metadata, CoreError> {
    assert_supported(path)?;
    let output = Command::new(ffmpeg)
        .args(["-hide_banner", "-i"])
        .arg(path)
        .args(["-map_metadata", "0", "-f", "ffmetadata", "-"])
        .output()?;
    if !output.status.success() {
        return Err(CoreError::InvalidArgument(
            String::from_utf8_lossy(&output.stderr).trim().to_owned(),
        ));
    }
    let text = String::from_utf8_lossy(&output.stdout);
    let stderr = String::from_utf8_lossy(&output.stderr);
    let mut values = std::collections::HashMap::new();
    for line in text.lines().filter(|line| !line.starts_with(';')) {
        if let Some((key, value)) = line.split_once('=') {
            values.insert(
                key.trim().to_ascii_lowercase(),
                unescape_ffmetadata(value.trim()),
            );
        }
    }
    let duration = stderr
        .split("Duration: ")
        .nth(1)
        .and_then(|value| value.split(',').next())
        .and_then(parse_duration)
        .unwrap_or_default();
    let bitrate = stderr
        .split("bitrate: ")
        .nth(1)
        .and_then(|value| value.split_whitespace().next())
        .and_then(|value| value.parse().ok())
        .unwrap_or_default();
    let sample_rate = stderr
        .lines()
        .find(|line| line.contains("Audio:"))
        .and_then(|line| line.split(" Hz").next())
        .and_then(|prefix| prefix.split_whitespace().last())
        .and_then(|value| value.parse().ok())
        .unwrap_or_default();
    let number_pair = |key: &str| {
        values
            .get(key)
            .map(|value| {
                let mut parts = value.split('/');
                (
                    parts
                        .next()
                        .and_then(|value| value.parse().ok())
                        .unwrap_or_default(),
                    parts
                        .next()
                        .and_then(|value| value.parse().ok())
                        .unwrap_or_default(),
                )
            })
            .unwrap_or_default()
    };
    let track = number_pair("track");
    let disc = number_pair("disc");
    let list = |key: &str| {
        values
            .get(key)
            .map(|value| {
                value
                    .split([';', '\0'])
                    .map(str::trim)
                    .filter(|value| !value.is_empty())
                    .map(ToOwned::to_owned)
                    .collect()
            })
            .unwrap_or_default()
    };
    Ok(Metadata {
        file_path: path.to_string_lossy().into_owned(),
        format: path
            .extension()
            .and_then(|value| value.to_str())
            .unwrap_or_default()
            .to_ascii_uppercase(),
        title: values.get("title").cloned().unwrap_or_default(),
        artists: list("artist"),
        album: values.get("album").cloned().unwrap_or_default(),
        album_artists: list("album_artist"),
        track_number: track.0,
        total_tracks: track.1,
        disc_number: disc.0,
        total_discs: disc.1,
        year: values
            .get("date")
            .or_else(|| values.get("year"))
            .and_then(|value| value.get(..4))
            .and_then(|value| value.parse().ok())
            .unwrap_or_default(),
        genre: list("genre"),
        comment: values.get("comment").cloned().unwrap_or_default(),
        composer: list("composer"),
        cover_data_url: String::new(),
        duration,
        bitrate,
        sample_rate,
        embedded_lyrics: values.get("lyrics").cloned().unwrap_or_default(),
        artwork_present: stderr
            .lines()
            .any(|line| line.contains("Video:") || line.contains("attached pic")),
    })
}

fn parse_duration(value: &str) -> Option<f64> {
    let mut parts = value.split(':');
    let hours: f64 = parts.next()?.parse().ok()?;
    let minutes: f64 = parts.next()?.parse().ok()?;
    let seconds: f64 = parts.next()?.parse().ok()?;
    Some(hours * 3600.0 + minutes * 60.0 + seconds)
}

fn unescape_ffmetadata(value: &str) -> String {
    let mut output = String::with_capacity(value.len());
    let mut escaped = false;
    for character in value.chars() {
        if escaped {
            output.push(if character == 'n' { '\n' } else { character });
            escaped = false;
        } else if character == '\\' {
            escaped = true;
        } else {
            output.push(character);
        }
    }
    if escaped {
        output.push('\\');
    }
    output
}

fn parse_cover(data_url: &str) -> Result<Picture, CoreError> {
    let (header, encoded) = data_url
        .split_once(',')
        .ok_or_else(|| CoreError::InvalidArgument("invalid artwork data URL".into()))?;
    if !header.starts_with("data:image/") || !header.ends_with(";base64") {
        return Err(CoreError::InvalidArgument(
            "invalid artwork data URL".into(),
        ));
    }
    use base64::Engine;
    use lofty::picture::{MimeType, PictureType};
    let data = base64::engine::general_purpose::STANDARD
        .decode(encoded)
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
    if data.is_empty() || data.len() > 30 * 1024 * 1024 {
        return Err(CoreError::InvalidArgument("artwork size is invalid".into()));
    }
    let mime = header
        .trim_start_matches("data:")
        .trim_end_matches(";base64");
    let mime = match mime {
        "image/png" => MimeType::Png,
        "image/gif" => MimeType::Gif,
        "image/bmp" => MimeType::Bmp,
        "image/tiff" => MimeType::Tiff,
        _ => MimeType::Jpeg,
    };
    Ok(Picture::unchecked(data)
        .pic_type(PictureType::CoverFront)
        .mime_type(mime)
        .build())
}

fn read_cover(path: &Path) -> Result<Picture, CoreError> {
    let data = fs::read(path)?;
    if data.is_empty() || data.len() > 30 * 1024 * 1024 {
        return Err(CoreError::InvalidArgument("artwork size is invalid".into()));
    }
    use lofty::picture::{MimeType, PictureType};
    let mime = match image::guess_format(&data)
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
    {
        image::ImageFormat::Png => MimeType::Png,
        image::ImageFormat::Gif => MimeType::Gif,
        image::ImageFormat::Bmp => MimeType::Bmp,
        image::ImageFormat::Tiff => MimeType::Tiff,
        _ => MimeType::Jpeg,
    };
    Ok(Picture::unchecked(data)
        .pic_type(PictureType::CoverFront)
        .mime_type(mime)
        .build())
}

fn set_tag(tag: &mut Tag, metadata: &Metadata) {
    tag.set_title(metadata.title.trim().to_owned());
    tag.set_artist(
        metadata
            .artists
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .join("; "),
    );
    tag.set_album(metadata.album.trim().to_owned());
    tag.insert_text(
        ItemKey::AlbumArtist,
        metadata
            .album_artists
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .join("; "),
    );
    tag.set_track(metadata.track_number);
    tag.set_track_total(metadata.total_tracks);
    tag.set_disk(metadata.disc_number);
    tag.set_disk_total(metadata.total_discs);
    if metadata.year > 0 {
        tag.set_date(Timestamp {
            year: metadata.year.min(u16::MAX.into()) as u16,
            month: None,
            day: None,
            hour: None,
            minute: None,
            second: None,
        });
    } else {
        tag.remove_date();
    }
    tag.set_genre(
        metadata
            .genre
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .join("; "),
    );
    tag.set_comment(metadata.comment.trim().to_owned());
    tag.insert_text(
        ItemKey::Composer,
        metadata
            .composer
            .iter()
            .map(String::as_str)
            .collect::<Vec<_>>()
            .join("; "),
    );
    if !metadata.embedded_lyrics.trim().is_empty() {
        tag.insert_text(ItemKey::Lyrics, metadata.embedded_lyrics.trim().to_owned());
    }
}

fn normalized_list(values: &[String]) -> Vec<String> {
    values
        .iter()
        .flat_map(|value| value.split(';'))
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(ToOwned::to_owned)
        .collect()
}

fn verify(
    actual: &Metadata,
    expected: &Metadata,
    cover_changed: bool,
    expected_artwork: bool,
) -> Result<(), CoreError> {
    let fields = [
        ("title", actual.title == expected.title.trim()),
        (
            "artists",
            normalized_list(&actual.artists) == normalized_list(&expected.artists),
        ),
        ("album", actual.album == expected.album.trim()),
        (
            "albumArtists",
            normalized_list(&actual.album_artists) == normalized_list(&expected.album_artists),
        ),
        ("trackNumber", actual.track_number == expected.track_number),
        ("totalTracks", actual.total_tracks == expected.total_tracks),
        ("discNumber", actual.disc_number == expected.disc_number),
        ("totalDiscs", actual.total_discs == expected.total_discs),
        ("year", actual.year == expected.year),
        (
            "genre",
            normalized_list(&actual.genre) == normalized_list(&expected.genre),
        ),
        ("comment", actual.comment == expected.comment.trim()),
        (
            "composer",
            normalized_list(&actual.composer) == normalized_list(&expected.composer),
        ),
        (
            "embeddedLyrics",
            expected.embedded_lyrics.trim().is_empty()
                || actual.embedded_lyrics == expected.embedded_lyrics.trim(),
        ),
        (
            "artworkPresent",
            !cover_changed || actual.artwork_present == expected_artwork,
        ),
    ];
    if let Some((field, _)) = fields.into_iter().find(|(_, equal)| !equal) {
        return Err(CoreError::Internal(format!(
            "metadata verification failed: {field}"
        )));
    }
    if actual.duration <= 0.0
        || (expected.duration > 0.0 && (actual.duration - expected.duration).abs() > 1.5)
    {
        return Err(CoreError::Internal("duration verification failed".into()));
    }
    Ok(())
}

fn failpoint(name: &str) -> Result<(), CoreError> {
    let active = std::env::var("LX_NATIVE_TEST_FAILPOINT").ok();
    if active.as_deref() == Some(&format!("crash-{name}")) {
        std::process::abort();
    }
    if active.as_deref() == Some(name) {
        return Err(CoreError::Io(format!("injected failure at {name}")));
    }
    Ok(())
}

pub fn write_safely(request: &MetadataWriteRequest) -> Result<Metadata, CoreError> {
    let path = Path::new(&request.file_path);
    assert_supported(path)?;
    let parent = path
        .parent()
        .ok_or_else(|| CoreError::InvalidArgument("media path has no parent".into()))?;
    let stem = path
        .file_stem()
        .and_then(|value| value.to_str())
        .ok_or_else(|| CoreError::InvalidArgument("invalid media filename".into()))?;
    let extension = path
        .extension()
        .and_then(|value| value.to_str())
        .ok_or_else(|| CoreError::InvalidArgument("media extension is required".into()))?;
    let token = Uuid::new_v4();
    let temp = parent.join(format!(".{stem}.lx-native-{token}.{extension}"));
    let backup = parent.join(format!(".{stem}.lx-native-{token}.backup.{extension}"));
    let mut backup_created = false;

    let result = (|| {
        fs::copy(path, &temp)?;
        failpoint("after-copy")?;
        let mut file = Probe::open(&temp)
            .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
            .guess_file_type()
            .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
            .read()
            .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
        let tag = if let Some(tag) = file.primary_tag_mut() {
            tag
        } else if let Some(tag) = file.first_tag_mut() {
            tag
        } else {
            return Err(CoreError::NotSupported(
                "container has no writable tag".into(),
            ));
        };
        set_tag(tag, &request.metadata);
        if request.cover_changed {
            while !tag.pictures().is_empty() {
                tag.remove_picture(0);
            }
            if let Some(path) = request.cover_source_path.as_deref() {
                tag.push_picture(read_cover(Path::new(path))?);
            } else if !request.metadata.cover_data_url.is_empty() {
                tag.push_picture(parse_cover(&request.metadata.cover_data_url)?);
            }
        }
        tag.save_to_path(&temp, WriteOptions::default())
            .map_err(|error| CoreError::Io(error.to_string()))?;
        failpoint("after-write")?;
        let verified = read(&temp)?;
        let expected_artwork =
            request.cover_source_path.is_some() || !request.metadata.cover_data_url.is_empty();
        verify(
            &verified,
            &request.metadata,
            request.cover_changed,
            expected_artwork,
        )?;
        failpoint("after-verify")?;
        commit_replace(path, &temp, &backup)?;
        backup_created = true;
        failpoint("after-commit")?;
        fs::remove_file(&backup)?;
        backup_created = false;
        read(path)
    })();

    let _ = fs::remove_file(&temp);
    if result.is_err() && backup_created {
        let _ = restore_backup(path, &backup);
    } else if backup_created && !path.exists() {
        let _ = fs::rename(&backup, path);
    }
    result
}

#[cfg(windows)]
fn commit_replace(path: &Path, replacement: &Path, backup: &Path) -> Result<(), CoreError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{REPLACEFILE_WRITE_THROUGH, ReplaceFileW};
    let wide = |value: &Path| {
        value
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
    };
    let path = wide(path);
    let replacement = wide(replacement);
    let backup = wide(backup);
    let result = unsafe {
        ReplaceFileW(
            path.as_ptr(),
            replacement.as_ptr(),
            backup.as_ptr(),
            REPLACEFILE_WRITE_THROUGH,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if result == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(())
}

#[cfg(not(windows))]
fn commit_replace(path: &Path, replacement: &Path, backup: &Path) -> Result<(), CoreError> {
    fs::rename(path, backup)?;
    if let Err(error) = fs::rename(replacement, path) {
        let _ = fs::rename(backup, path);
        return Err(error.into());
    }
    Ok(())
}

#[cfg(windows)]
fn restore_backup(path: &Path, backup: &Path) -> Result<(), CoreError> {
    use std::os::windows::ffi::OsStrExt;
    use windows_sys::Win32::Storage::FileSystem::{REPLACEFILE_WRITE_THROUGH, ReplaceFileW};
    let wide = |value: &Path| {
        value
            .as_os_str()
            .encode_wide()
            .chain(Some(0))
            .collect::<Vec<_>>()
    };
    let path = wide(path);
    let backup = wide(backup);
    let result = unsafe {
        ReplaceFileW(
            path.as_ptr(),
            backup.as_ptr(),
            std::ptr::null(),
            REPLACEFILE_WRITE_THROUGH,
            std::ptr::null_mut(),
            std::ptr::null_mut(),
        )
    };
    if result == 0 {
        return Err(std::io::Error::last_os_error().into());
    }
    Ok(())
}

#[cfg(not(windows))]
fn restore_backup(path: &Path, backup: &Path) -> Result<(), CoreError> {
    if path.exists() {
        fs::remove_file(path)?;
    }
    fs::rename(backup, path)?;
    Ok(())
}

pub fn extract_picture(path: &Path) -> Result<Option<Vec<u8>>, CoreError> {
    assert_supported(path)?;
    let file = Probe::open(path)
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
        .guess_file_type()
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?
        .read()
        .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
    Ok(primary_tag(&file)
        .and_then(|tag| tag.pictures().first())
        .map(|picture| picture.data().to_vec()))
}

pub fn source_fingerprint(path: &Path) -> Result<String, CoreError> {
    let info = fs::metadata(path)?;
    let modified = info
        .modified()
        .ok()
        .and_then(|value| value.duration_since(std::time::UNIX_EPOCH).ok())
        .unwrap_or(Duration::ZERO)
        .as_millis();
    Ok(format!("{}:{}", info.len(), modified))
}

pub fn sibling_artwork(path: &Path) -> Option<PathBuf> {
    ["jpg", "jpeg", "png", "webp"]
        .into_iter()
        .map(|extension| path.with_extension(extension))
        .find(|candidate| candidate.is_file())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_unknown_extensions() {
        let result = assert_supported(Path::new("not-a-song.txt"));
        assert!(matches!(result, Err(CoreError::NotSupported(_))));
    }
}
