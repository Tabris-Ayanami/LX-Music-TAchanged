use crate::error::CoreError;
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};
use tokio::process::Command;

#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioConvertRequest {
    pub input_path: PathBuf,
    pub output_path: PathBuf,
    pub extension: String,
    pub quality: String,
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AudioConvertResult {
    pub output_path: PathBuf,
}

pub async fn convert_audio(
    ffmpeg_path: Option<&Path>,
    request: AudioConvertRequest,
) -> Result<AudioConvertResult, CoreError> {
    let ffmpeg_path = ffmpeg_path
        .filter(|path| path.is_file())
        .ok_or_else(|| CoreError::NotSupported("ffmpeg executable is unavailable".into()))?;
    if !request.input_path.is_file() {
        return Err(CoreError::NotFound(format!(
            "input audio does not exist: {}",
            request.input_path.display()
        )));
    }
    if request.input_path == request.output_path {
        return Err(CoreError::InvalidArgument(
            "inputPath and outputPath must differ".into(),
        ));
    }

    let mut args = vec![
        "-y".to_owned(),
        "-i".to_owned(),
        request.input_path.to_string_lossy().into_owned(),
        "-vn".to_owned(),
    ];
    match request.extension.as_str() {
        "flac" => args.extend(["-codec:a".into(), "flac".into()]),
        "wav" => args.extend(["-codec:a".into(), "pcm_s16le".into()]),
        "mp3" => args.extend([
            "-codec:a".into(),
            "libmp3lame".into(),
            "-b:a".into(),
            mp3_bitrate(&request.quality).into(),
        ]),
        extension => {
            return Err(CoreError::InvalidArgument(format!(
                "unsupported output extension: {extension}"
            )));
        }
    }
    args.push(request.output_path.to_string_lossy().into_owned());

    let output = Command::new(ffmpeg_path)
        .args(args)
        .kill_on_drop(true)
        .output()
        .await
        .map_err(CoreError::from)?;
    if !output.status.success() {
        let _ = std::fs::remove_file(&request.output_path);
        let message = String::from_utf8_lossy(&output.stderr).trim().to_owned();
        return Err(CoreError::Internal(if message.is_empty() {
            format!("ffmpeg exited with status {}", output.status)
        } else {
            message
        }));
    }

    Ok(AudioConvertResult {
        output_path: request.output_path,
    })
}

fn mp3_bitrate(quality: &str) -> &'static str {
    match quality {
        "320k" => "320k",
        "192k" => "192k",
        _ => "128k",
    }
}
