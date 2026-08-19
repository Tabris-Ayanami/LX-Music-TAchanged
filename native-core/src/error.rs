use serde::Serialize;
use thiserror::Error;

#[derive(Debug, Error)]
pub enum CoreError {
    #[error("operation cancelled")]
    Aborted,
    #[error("invalid argument: {0}")]
    InvalidArgument(String),
    #[error("not found: {0}")]
    NotFound(String),
    #[error("not supported: {0}")]
    NotSupported(String),
    #[error("permission denied: {0}")]
    PermissionDenied(String),
    #[error("I/O error: {0}")]
    Io(String),
    #[error("conflict: {0}")]
    Conflict(String),
    #[error("internal error: {0}")]
    Internal(String),
}

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct RpcError {
    pub code: &'static str,
    pub message: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub details: Option<serde_json::Value>,
}

impl CoreError {
    pub fn rpc_error(&self) -> RpcError {
        let code = match self {
            Self::Aborted => "aborted",
            Self::InvalidArgument(_) => "invalid_argument",
            Self::NotFound(_) => "not_found",
            Self::NotSupported(_) => "not_supported",
            Self::PermissionDenied(_) => "permission_denied",
            Self::Io(_) => "io_error",
            Self::Conflict(_) => "conflict",
            Self::Internal(_) => "internal",
        };
        RpcError {
            code,
            message: self.to_string(),
            details: None,
        }
    }
}

impl From<std::io::Error> for CoreError {
    fn from(error: std::io::Error) -> Self {
        let message = error.to_string();
        match error.kind() {
            std::io::ErrorKind::NotFound => Self::NotFound(message),
            std::io::ErrorKind::PermissionDenied => Self::PermissionDenied(message),
            std::io::ErrorKind::AlreadyExists => Self::Conflict(message),
            std::io::ErrorKind::InvalidInput | std::io::ErrorKind::InvalidData => {
                Self::InvalidArgument(message)
            }
            _ => Self::Io(message),
        }
    }
}
