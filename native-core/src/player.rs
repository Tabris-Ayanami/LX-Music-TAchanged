use serde::Serialize;
use std::path::Path;

#[derive(Debug, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PlayerProbeResult {
    pub available: bool,
    pub dll_path: Option<String>,
    pub client_api_version: Option<u64>,
    pub reason: Option<String>,
}

pub fn probe(libmpv_path: Option<&Path>) -> PlayerProbeResult {
    let Some(path) = libmpv_path else {
        return unavailable(None, "libmpv runtime is not configured");
    };
    if !path.is_file() {
        return unavailable(Some(path), "configured libmpv runtime does not exist");
    }
    probe_library(path)
}

fn unavailable(path: Option<&Path>, reason: impl Into<String>) -> PlayerProbeResult {
    PlayerProbeResult {
        available: false,
        dll_path: path.map(|path| path.to_string_lossy().into_owned()),
        client_api_version: None,
        reason: Some(reason.into()),
    }
}

#[cfg(windows)]
fn probe_library(path: &Path) -> PlayerProbeResult {
    use std::{ffi::c_void, os::windows::ffi::OsStrExt};
    use windows_sys::Win32::{
        Foundation::FreeLibrary,
        System::LibraryLoader::{GetProcAddress, LoadLibraryW},
    };

    let wide_path: Vec<u16> = path.as_os_str().encode_wide().chain(Some(0)).collect();
    let module = unsafe { LoadLibraryW(wide_path.as_ptr()) };
    if module.is_null() {
        return unavailable(Some(path), "failed to load libmpv runtime");
    }
    let symbol = unsafe { GetProcAddress(module, c"mpv_client_api_version".as_ptr().cast()) };
    let result = match symbol {
        Some(symbol) => {
            let address = symbol as *const () as *const c_void;
            let version: unsafe extern "C" fn() -> u64 = unsafe { std::mem::transmute(address) };
            PlayerProbeResult {
                available: true,
                dll_path: Some(path.to_string_lossy().into_owned()),
                client_api_version: Some(unsafe { version() }),
                reason: None,
            }
        }
        None => unavailable(Some(path), "mpv_client_api_version symbol is missing"),
    };
    unsafe { FreeLibrary(module) };
    result
}

#[cfg(not(windows))]
fn probe_library(path: &Path) -> PlayerProbeResult {
    unavailable(Some(path), "libmpv probe is only implemented for Windows")
}
