pub mod artwork;
pub mod download;
pub mod error;
pub mod library;
pub mod metadata;
pub mod player;
pub mod protocol;

pub const PROTOCOL_VERSION: &str = "1.0";
pub const CORE_VERSION: &str = env!("CARGO_PKG_VERSION");
pub const CAPABILITIES: &[&str] = &[
    "metadata.read",
    "metadata.write.safe",
    "metadata.lyrics.read",
    "artwork.variant",
    "artwork.cache.lru",
    "download.ffmpeg.convert",
    "library.scan",
    "player.libmpv.probe",
    "rpc.cancel",
];
