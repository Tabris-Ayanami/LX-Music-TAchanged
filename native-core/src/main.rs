#![cfg_attr(windows, windows_subsystem = "windows")]

use clap::Parser;
use lx_native_core::{
    CAPABILITIES, CORE_VERSION, PROTOCOL_VERSION,
    artwork::{ArtworkCache, VariantRequest},
    download::{self, AudioConvertRequest},
    error::CoreError,
    library::{self, LibraryScanRequest},
    metadata::{self, MetadataWriteRequest},
    protocol::{Handshake, MAX_FRAME_BYTES, RpcRequest, RpcResponse},
};
use parking_lot::Mutex;
use serde_json::{Value, json};
use std::{collections::HashMap, path::PathBuf, sync::Arc};
use tokio::{
    io::{AsyncRead, AsyncReadExt, AsyncWrite, AsyncWriteExt},
    sync::mpsc,
};
use tokio_util::sync::CancellationToken;

#[derive(Debug, Parser)]
#[command(version, about = "LX-TA headless native media core")]
struct Args {
    #[arg(long)]
    pipe: String,
    #[arg(long)]
    profile: PathBuf,
    #[arg(long)]
    cache: PathBuf,
    #[arg(long, default_value_t = 268_435_456)]
    artwork_cache_budget: u64,
    #[arg(long)]
    ffmpeg: Option<PathBuf>,
}

#[derive(Clone)]
struct Context {
    artwork: ArtworkCache,
    ffmpeg_path: Option<PathBuf>,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    tracing_subscriber::fmt()
        .json()
        .with_writer(std::io::stderr)
        .init();
    let args = Args::parse();
    std::fs::create_dir_all(&args.profile)?;
    std::fs::create_dir_all(&args.cache)?;
    let context = Context {
        artwork: ArtworkCache::new(
            args.cache.join("artwork"),
            args.artwork_cache_budget,
            args.ffmpeg.clone(),
        )?,
        ffmpeg_path: args.ffmpeg,
    };
    tracing::info!(event = "native_core_start", protocol = PROTOCOL_VERSION, pipe = %args.pipe);
    run_pipe(&args.pipe, context).await?;
    tracing::info!(event = "native_core_stop");
    Ok(())
}

#[cfg(windows)]
async fn run_pipe(pipe: &str, context: Context) -> anyhow::Result<()> {
    use tokio::net::windows::named_pipe::ServerOptions;
    let server = ServerOptions::new()
        .first_pipe_instance(true)
        .create(pipe)?;
    server.connect().await?;
    serve(server, context).await
}

#[cfg(not(windows))]
async fn run_pipe(_pipe: &str, _context: Context) -> anyhow::Result<()> {
    anyhow::bail!("Windows named pipes are required")
}

async fn read_frame<R: AsyncRead + Unpin>(reader: &mut R) -> anyhow::Result<Option<Vec<u8>>> {
    let mut header = [0_u8; 4];
    match reader.read_exact(&mut header).await {
        Ok(_) => {}
        Err(error) if error.kind() == std::io::ErrorKind::UnexpectedEof => return Ok(None),
        Err(error) => return Err(error.into()),
    }
    let length = u32::from_le_bytes(header) as usize;
    anyhow::ensure!(length <= MAX_FRAME_BYTES, "frame too large: {length}");
    let mut payload = vec![0_u8; length];
    reader.read_exact(&mut payload).await?;
    Ok(Some(payload))
}

async fn write_frame<W: AsyncWrite + Unpin>(writer: &mut W, payload: &[u8]) -> anyhow::Result<()> {
    anyhow::ensure!(
        payload.len() <= MAX_FRAME_BYTES,
        "frame too large: {}",
        payload.len()
    );
    writer
        .write_all(&(payload.len() as u32).to_le_bytes())
        .await?;
    writer.write_all(payload).await?;
    writer.flush().await?;
    Ok(())
}

async fn serve<S>(stream: S, context: Context) -> anyhow::Result<()>
where
    S: AsyncRead + AsyncWrite + Unpin + Send + 'static,
{
    let (mut reader, mut writer) = tokio::io::split(stream);
    let (send, mut receive) = mpsc::unbounded_channel::<RpcResponse>();
    let pending = Arc::new(Mutex::new(HashMap::<String, CancellationToken>::new()));
    let writer_task = tokio::spawn(async move {
        while let Some(response) = receive.recv().await {
            let payload = serde_json::to_vec(&response)?;
            write_frame(&mut writer, &payload).await?;
        }
        Ok::<_, anyhow::Error>(())
    });

    while let Some(payload) = read_frame(&mut reader).await? {
        let request: RpcRequest = match serde_json::from_slice(&payload) {
            Ok(request) => request,
            Err(error) => {
                let _ = send.send(error_response(
                    "unknown".into(),
                    CoreError::InvalidArgument(error.to_string()),
                ));
                continue;
            }
        };
        if request.method == "rpc.cancel" {
            if let Some(id) = request.params.get("requestId").and_then(Value::as_str) {
                if let Some(token) = pending.lock().get(id) {
                    token.cancel();
                }
            }
            let _ = send.send(success_response(
                request.request_id,
                json!({ "cancelled": true }),
            ));
            continue;
        }
        if request.protocol_version != PROTOCOL_VERSION {
            let _ = send.send(error_response(
                request.request_id,
                CoreError::Conflict(format!(
                    "protocol {} is not supported",
                    request.protocol_version
                )),
            ));
            continue;
        }
        let token = CancellationToken::new();
        pending
            .lock()
            .insert(request.request_id.clone(), token.clone());
        let send = send.clone();
        let pending = pending.clone();
        let context = context.clone();
        tokio::spawn(async move {
            let request_id = request.request_id.clone();
            let is_write = request.method == "metadata.write";
            let response = if is_write {
                match dispatch(request, context).await {
                    Ok(value) => success_response(request_id.clone(), value),
                    Err(error) => error_response(request_id.clone(), error),
                }
            } else {
                tokio::select! {
                    _ = token.cancelled() => error_response(request_id.clone(), CoreError::Aborted),
                    result = dispatch(request, context) => match result {
                        Ok(value) => success_response(request_id.clone(), value),
                        Err(error) => error_response(request_id.clone(), error),
                    }
                }
            };
            pending.lock().remove(&request_id);
            let _ = send.send(response);
        });
    }
    drop(send);
    writer_task.await??;
    Ok(())
}

async fn dispatch(request: RpcRequest, context: Context) -> Result<Value, CoreError> {
    match request.method.as_str() {
        "core.handshake" => serde_json::to_value(Handshake {
            protocol_version: PROTOCOL_VERSION,
            core_version: CORE_VERSION,
            capabilities: CAPABILITIES,
            pid: std::process::id(),
        })
        .map_err(|error| CoreError::Internal(error.to_string())),
        "metadata.read" => {
            let path = required_path(&request.params)?;
            let ffmpeg = context.ffmpeg_path.clone();
            blocking(move || metadata::read_compatible(&path, ffmpeg.as_deref())).await
        }
        "metadata.write" => {
            let value: MetadataWriteRequest = serde_json::from_value(request.params)
                .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
            blocking(move || metadata::write_safely(&value)).await
        }
        "metadata.lyrics.read" => {
            let path = required_path(&request.params)?;
            let ffmpeg = context.ffmpeg_path.clone();
            blocking(move || {
                metadata::read_compatible(&path, ffmpeg.as_deref())
                    .map(|value| value.embedded_lyrics)
            })
            .await
        }
        "artwork.variant" => {
            let value: VariantRequest = serde_json::from_value(request.params)
                .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
            blocking(move || context.artwork.variant(&value)).await
        }
        "artwork.invalidate" => {
            let file_path = request
                .params
                .get("filePath")
                .and_then(Value::as_str)
                .ok_or_else(|| CoreError::InvalidArgument("filePath is required".into()))?
                .to_owned();
            blocking(move || context.artwork.invalidate(&file_path)).await
        }
        "artwork.cache.stats" => blocking(move || context.artwork.stats()).await,
        "library.scan" => {
            let value: LibraryScanRequest = serde_json::from_value(request.params)
                .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
            blocking(move || library::scan(&value)).await
        }
        "download.ffmpeg.convert" => {
            let value: AudioConvertRequest = serde_json::from_value(request.params)
                .map_err(|error| CoreError::InvalidArgument(error.to_string()))?;
            let ffmpeg_path = context.ffmpeg_path.clone();
            let result = download::convert_audio(ffmpeg_path.as_deref(), value).await?;
            serde_json::to_value(result).map_err(|error| CoreError::Internal(error.to_string()))
        }
        method => Err(CoreError::NotSupported(format!(
            "unknown RPC method: {method}"
        ))),
    }
}

async fn blocking<T, F>(operation: F) -> Result<Value, CoreError>
where
    T: serde::Serialize + Send + 'static,
    F: FnOnce() -> Result<T, CoreError> + Send + 'static,
{
    let value = tokio::task::spawn_blocking(operation)
        .await
        .map_err(|error| CoreError::Internal(error.to_string()))??;
    serde_json::to_value(value).map_err(|error| CoreError::Internal(error.to_string()))
}

fn required_path(params: &Value) -> Result<PathBuf, CoreError> {
    params
        .get("filePath")
        .and_then(Value::as_str)
        .filter(|value| !value.is_empty())
        .map(PathBuf::from)
        .ok_or_else(|| CoreError::InvalidArgument("filePath is required".into()))
}

fn success_response(request_id: String, result: Value) -> RpcResponse {
    RpcResponse {
        protocol_version: PROTOCOL_VERSION,
        request_id,
        result: Some(result),
        error: None,
    }
}

fn error_response(request_id: String, error: CoreError) -> RpcResponse {
    tracing::warn!(event = "rpc_error", request_id, code = error.rpc_error().code, message = %error);
    RpcResponse {
        protocol_version: PROTOCOL_VERSION,
        request_id,
        result: None,
        error: Some(error.rpc_error()),
    }
}
