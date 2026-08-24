use crate::error::CoreError;
use parking_lot::Mutex;
use reqwest::{Client, Proxy, StatusCode, header};
use serde::{Deserialize, Serialize};
use std::{
    collections::HashMap,
    path::{Path, PathBuf},
    sync::Arc,
    time::{Duration, Instant},
};
use tokio::{
    fs,
    io::{AsyncReadExt, AsyncSeekExt, AsyncWriteExt},
    process::Command,
};
use tokio_util::sync::CancellationToken;
use uuid::Uuid;

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

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpProxy {
    pub host: String,
    pub port: u16,
}

#[derive(Debug, Clone, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpDownloadRequest {
    pub url: String,
    pub output_path: PathBuf,
    pub proxy: Option<HttpProxy>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpDownloadStart {
    pub job_id: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct HttpDownloadStatus {
    pub job_id: String,
    pub state: &'static str,
    pub total: u64,
    pub downloaded: u64,
    pub bytes_per_second: u64,
    pub status_code: Option<u16>,
    pub error: Option<String>,
}

struct DownloadJob {
    status: Arc<Mutex<HttpDownloadStatus>>,
    cancellation: CancellationToken,
}

#[derive(Clone, Default)]
pub struct DownloadJobs {
    jobs: Arc<Mutex<HashMap<String, DownloadJob>>>,
}

impl DownloadJobs {
    pub fn start(&self, request: HttpDownloadRequest) -> Result<HttpDownloadStart, CoreError> {
        validate_download_request(&request)?;
        let job_id = Uuid::new_v4().to_string();
        let status = Arc::new(Mutex::new(HttpDownloadStatus {
            job_id: job_id.clone(),
            state: "running",
            total: 0,
            downloaded: 0,
            bytes_per_second: 0,
            status_code: None,
            error: None,
        }));
        let cancellation = CancellationToken::new();
        self.jobs.lock().insert(
            job_id.clone(),
            DownloadJob {
                status: status.clone(),
                cancellation: cancellation.clone(),
            },
        );
        tokio::spawn(async move {
            let result = download_http(request, status.clone(), cancellation).await;
            let mut status = status.lock();
            match result {
                Ok(()) => {
                    status.state = "completed";
                    status.bytes_per_second = 0;
                }
                Err(CoreError::Aborted) => {
                    status.state = "cancelled";
                    status.bytes_per_second = 0;
                }
                Err(error) => {
                    status.state = "failed";
                    status.bytes_per_second = 0;
                    status.error = Some(error.to_string());
                }
            }
        });
        Ok(HttpDownloadStart { job_id })
    }

    pub fn status(&self, job_id: &str) -> Result<HttpDownloadStatus, CoreError> {
        let mut jobs = self.jobs.lock();
        let status = jobs
            .get(job_id)
            .map(|job| job.status.lock().clone())
            .ok_or_else(|| CoreError::NotFound(format!("download job does not exist: {job_id}")))?;
        if status.state != "running" {
            jobs.remove(job_id);
        }
        Ok(status)
    }

    pub fn cancel(&self, job_id: &str) -> Result<HttpDownloadStatus, CoreError> {
        let jobs = self.jobs.lock();
        let job = jobs
            .get(job_id)
            .ok_or_else(|| CoreError::NotFound(format!("download job does not exist: {job_id}")))?;
        job.cancellation.cancel();
        Ok(job.status.lock().clone())
    }
}

fn validate_download_request(request: &HttpDownloadRequest) -> Result<(), CoreError> {
    let url = reqwest::Url::parse(&request.url)
        .map_err(|error| CoreError::InvalidArgument(format!("invalid download URL: {error}")))?;
    if !matches!(url.scheme(), "http" | "https") {
        return Err(CoreError::InvalidArgument(
            "download URL must use HTTP(S)".into(),
        ));
    }
    if request.output_path.as_os_str().is_empty() {
        return Err(CoreError::InvalidArgument("outputPath is required".into()));
    }
    if let Some(proxy) = &request.proxy {
        if proxy.host.trim().is_empty() || proxy.port == 0 {
            return Err(CoreError::InvalidArgument(
                "proxy host and port are required".into(),
            ));
        }
    }
    Ok(())
}

async fn download_http(
    request: HttpDownloadRequest,
    status: Arc<Mutex<HttpDownloadStatus>>,
    cancellation: CancellationToken,
) -> Result<(), CoreError> {
    if let Some(parent) = request.output_path.parent() {
        fs::create_dir_all(parent).await?;
    }
    let mut client = Client::builder()
        .connect_timeout(Duration::from_secs(30))
        .redirect(reqwest::redirect::Policy::limited(5));
    if let Some(proxy) = &request.proxy {
        client = client.proxy(
            Proxy::all(format!("http://{}:{}", proxy.host, proxy.port))
                .map_err(|error| CoreError::InvalidArgument(format!("invalid proxy: {error}")))?,
        );
    }
    let client = client.build().map_err(|error| {
        CoreError::Internal(format!("HTTP client initialization failed: {error}"))
    })?;

    let existing = fs::metadata(&request.output_path)
        .await
        .map(|value| value.len())
        .unwrap_or(0);
    let overlap = existing.min(10);
    let range_start = existing.saturating_sub(overlap);
    let expected_overlap = if overlap > 0 {
        let mut file = fs::File::open(&request.output_path).await?;
        file.seek(std::io::SeekFrom::Start(range_start)).await?;
        let mut bytes = vec![0; overlap as usize];
        file.read_exact(&mut bytes).await?;
        bytes
    } else {
        Vec::new()
    };

    let mut use_resume = overlap > 0;
    loop {
        let mut builder = client.get(&request.url).header(
            header::USER_AGENT,
            "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
        );
        if use_resume {
            builder = builder.header(header::RANGE, format!("bytes={range_start}-"));
        }
        let response = tokio::select! {
            _ = cancellation.cancelled() => return Err(CoreError::Aborted),
            response = builder.send() => response.map_err(|error| CoreError::Io(error.to_string()))?,
        };
        let response_status = response.status();
        status.lock().status_code = Some(response_status.as_u16());
        if response_status == StatusCode::RANGE_NOT_SATISFIABLE && use_resume {
            fs::write(&request.output_path, []).await?;
            use_resume = false;
            continue;
        }
        if response_status != StatusCode::OK && response_status != StatusCode::PARTIAL_CONTENT {
            return Err(CoreError::Io(format!(
                "HTTP status {}",
                response_status.as_u16()
            )));
        }
        if use_resume && response_status != StatusCode::PARTIAL_CONTENT {
            use_resume = false;
        }
        if use_resume {
            let expected_prefix = format!("bytes {range_start}-");
            let content_range = response
                .headers()
                .get(header::CONTENT_RANGE)
                .and_then(|value| value.to_str().ok());
            if !content_range.is_some_and(|value| value.starts_with(&expected_prefix)) {
                fs::write(&request.output_path, []).await?;
                use_resume = false;
                continue;
            }
        }

        let response_length = response.content_length().unwrap_or(0);
        let resume_bytes = if use_resume { existing } else { 0 };
        let total = if use_resume {
            response_length.saturating_sub(overlap) + existing
        } else {
            response_length
        };
        {
            let mut current = status.lock();
            current.total = total;
            current.downloaded = resume_bytes;
        }
        let mut output = fs::OpenOptions::new()
            .create(true)
            .write(true)
            .append(use_resume)
            .truncate(!use_resume)
            .open(&request.output_path)
            .await?;
        let mut response = response;
        let mut overlap_remaining = if use_resume {
            expected_overlap.as_slice()
        } else {
            &[]
        };
        let mut sampled_at = Instant::now();
        let mut sampled_bytes = resume_bytes;
        let mut restart_without_resume = false;
        loop {
            let chunk = tokio::select! {
                _ = cancellation.cancelled() => return Err(CoreError::Aborted),
                chunk = tokio::time::timeout(Duration::from_secs(60), response.chunk()) => {
                    chunk.map_err(|_| CoreError::Io("download timeout".into()))?
                        .map_err(|error| CoreError::Io(error.to_string()))?
                }
            };
            let Some(mut chunk) = chunk else { break };
            if !overlap_remaining.is_empty() {
                let compare_len = overlap_remaining.len().min(chunk.len());
                if chunk[..compare_len] != overlap_remaining[..compare_len] {
                    output.set_len(0).await?;
                    use_resume = false;
                    restart_without_resume = true;
                    break;
                }
                overlap_remaining = &overlap_remaining[compare_len..];
                chunk = chunk.slice(compare_len..);
            }
            if chunk.is_empty() {
                continue;
            }
            output.write_all(&chunk).await?;
            let mut current = status.lock();
            current.downloaded += chunk.len() as u64;
            let elapsed = sampled_at.elapsed();
            if elapsed >= Duration::from_secs(1) {
                current.bytes_per_second =
                    ((current.downloaded - sampled_bytes) as f64 / elapsed.as_secs_f64()) as u64;
                sampled_at = Instant::now();
                sampled_bytes = current.downloaded;
            }
        }
        if restart_without_resume {
            continue;
        }
        if !overlap_remaining.is_empty() {
            return Err(CoreError::Io(
                "resume response ended before overlap verification".into(),
            ));
        }
        output.flush().await?;
        let final_size = fs::metadata(&request.output_path).await?.len();
        let expected_total = status.lock().total;
        if expected_total > 0 && final_size != expected_total {
            return Err(CoreError::Io(format!(
                "download size mismatch: expected {expected_total}, got {final_size}"
            )));
        }
        status.lock().downloaded = final_size;
        return Ok(());
    }
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
