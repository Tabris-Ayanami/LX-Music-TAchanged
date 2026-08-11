# Electron and Node platform API map

This map replaces capabilities, not syntax. Native call sites should depend on application-owned interfaces; `LXTA.Platform.Windows`, `LXTA.Storage`, `LXTA.Network` and `LXTA.Media` implement those interfaces. The Native application must not embed Electron, Chromium, WebView2, Node.js, Vue or React.

## 1. Application and windowing

| Electron / Node capability | Current use | Windows / .NET replacement | Boundary / caution |
|---|---|---|---|
| `app.whenReady`, lifecycle events | Initialize DB/config, single instance, windows, tray, update and integrations | WinUI `Application`; explicit `IAppLifecycleCoordinator` | Initialization order must be deterministic and cancellable |
| `app.requestSingleInstanceLock` / `second-instance` | Enforce one instance, restore/show main window | Windows App SDK app lifecycle/activation redirection or named mutex + activation pipe | Forward arguments/protocol URL before activating window |
| `app.setAsDefaultProtocolClient` / `open-url` | `lxmusic:` deep links | Unpackaged Win32/manual development registration when this functional slice is implemented | No installer dependency in current scope; validate untrusted URI payloads |
| `BrowserWindow` main | Frameless main UI, bounds, visibility, fullscreen/maximize | WinUI 3 `Window`, `AppWindow`, presenter APIs and title-bar customization | Restore onto a visible monitor after topology/DPI change |
| hidden `BrowserWindow` user API | Run custom JavaScript source scripts | No browser replacement. Evaluate capability-limited managed JS or replace with a native/declarative adapter only after compatibility spike | Key migration blocker; never retain hidden Chromium/Node |
| desktop lyric `BrowserWindow` | Always-on-top, transparent lyric window | No Native replacement | Feature explicitly canceled; ignore imported window settings |
| `show`, `hide`, `minimize`, `maximize`, fullscreen | Window commands from UI/tray/IPC | `AppWindow`/Win32 window commands behind `IWindowManager` | Keep state/event feedback single-sourced |
| `setAlwaysOnTop`, `setIgnoreMouseEvents` | Desktop lyric lock/pass-through | No replacement for this feature | Do not create the legacy window/resources |
| `setThumbarButtons`, taskbar progress | Playback/task progress in Windows shell | Windows shell taskbar APIs / Windows App SDK integrations | Feature-detect by OS/package state |
| `screen`, display work area | Clamp/restore bounds | DisplayArea/Win32 monitor APIs | Per-monitor DPI conversion required |
| renderer drag regions | Custom title-bar drag | WinUI title bar draggable rectangles | Recompute after layout/DPI changes |

## 2. Shell integrations

| Legacy API | Current use | Native replacement | Notes |
|---|---|---|---|
| Electron `Tray` | Show/hide, playback, exit, dynamic labels | Native notification-area icon, e.g. Win32 `Shell_NotifyIcon` behind `ITrayService` | Existing demo's H.NotifyIcon spike is evaluative, not an architectural commitment |
| Electron `Menu` / context menus | App/tray/context actions | WinUI MenuFlyout/CommandBar plus Win32 tray menu where needed | Bind to shared commands, not duplicated logic |
| `globalShortcut` | Configurable global media shortcuts | Win32 `RegisterHotKey`; media-key integration as supported | Detect conflicts and unregister reliably |
| `nativeTheme` | OS light/dark state | `Application.RequestedTheme`, system settings/UISettings | Preserve explicit theme override |
| `shell.openExternal` | Open links | `Windows.System.Launcher` | Allow-list URI schemes and require user gesture where appropriate |
| `shell.showItemInFolder`, open path | Reveal/open downloads and local files | Launcher/Explorer invocation with validated absolute path | Do not shell-concatenate paths |
| Electron `dialog` | Folder/file selection and messages | Windows App SDK pickers initialized with HWND; WinUI dialogs | Picker lifetime tied to active window |
| Electron `clipboard` | Copy text/data | Windows Clipboard APIs | Avoid reading clipboard without explicit action |
| `powerSaveBlocker` | Keep playback/task behavior alive | Power request/execution state APIs only for documented active need | Release every token on stop/shutdown |
| OS notifications | Update/download feedback | App notifications / in-app notifications | Separate permission/package limitations |

## 3. IPC elimination

| Electron shape | Native shape |
|---|---|
| `ipcRenderer.invoke(channel, args)` -> `ipcMain.handle` | ViewModel calls an injected async service interface |
| `ipcRenderer.send` -> `ipcMain.on` | Typed command submitted to an application coordinator |
| `webContents.send` -> renderer listener | Typed event/state observable published by the owning service/store |
| `MessageChannelMain` between main and desktop lyric | Removed with the canceled desktop-lyric feature |
| hidden user-API window request/result channels | `IMusicSourceAdapter` call with cancellation, timeout and typed result |

No string-based in-process IPC compatibility layer should be created. The channel inventory in `ipc-map.md` is a migration checklist and behavior contract only.

## 4. Filesystem, process and runtime

| Node API/module | Current use | Native replacement | Security/lifetime notes |
|---|---|---|---|
| `fs`, `fs/promises` | Config, scanning, cache, downloads, copy/rename/delete | `System.IO`, safe handles and atomic replace utilities | Validate roots; use async streams for large data |
| `path` | User-data/cache/media paths | `System.IO.Path` | Normalize and retain Windows case semantics deliberately |
| `os` | Platform/user paths and environment | `Environment`, known-folder APIs, RuntimeInformation | Do not infer portable mode from an unstable cwd |
| `crypto` | Hashes, random values, RSA/AES sync crypto | `System.Security.Cryptography` | Preserve protocol byte formats; protect secrets at rest where possible |
| `zlib` | Compressed sync/database payloads | `System.IO.Compression` | Contract-test exact framing and encoding |
| `Buffer`, streams | Binary network/media operations | `Memory<byte>`, `Stream`, pipelines where justified | Avoid whole-file buffers |
| `child_process` | FFmpeg and external operations | `System.Diagnostics.Process` in a narrow `IProcessRunner`/transcoder | ArgumentList, no shell, cancellation and bounded logs |
| `worker_threads` / Comlink | DB and download worker isolation | Async services; dedicated long-running task/channel only for blocking ownership | Do not substitute thread per request |
| `process.argv`, env, exit | Activation and portable/package behavior | App lifecycle activation + configuration service | Sanitize diagnostics; centralize quit |
| Node timers/EventEmitter | Scheduling/event flow | `PeriodicTimer`, cancellation tokens, typed events/observables | Explicit unsubscribe/lifetime |
| Native module loader | `better-sqlite3`, qrc decoder | Managed SQLite provider; separately evaluated lyric decoder | Native binaries must be architecture/package aware |

## 5. Storage and database

| Legacy | Native target | Compatibility requirement |
|---|---|---|
| `better-sqlite3` in DB worker | `Microsoft.Data.Sqlite` or evaluated managed provider behind repositories | Open/copy existing schema v2 without destructive migration; WAL and transaction behavior tested |
| JSON config files (`config_v2.json`, `data.json`, etc.) | Versioned JSON settings/import adapters | Preserve unknown fields during migration until ownership is explicit |
| Browser `localStorage` | Typed settings service plus versioned storage | One-time importer for known keys; no scattered key/value calls in views |
| Cache files/directories | `ICacheStore` with namespaces, versioning and quotas | Existing cache may be discarded only where behavior permits; never mistake it for authoritative data |
| Electron session cookies | Encrypted cookie/session repository + HTTP cookie container | Import Bilibili cookies deliberately; do not log or sync them |
| SQLite backup-on-invalid-schema | Startup database validation, timestamped recoverable backup and explicit error state | Do not silently initialize over the only user copy |
| Legacy installed/portable user-data paths | `IAppPaths` imports from explicitly selected/copied legacy profile into an isolated Native development root | Current build has no installer/package identity; never write the Electron profile directly |

## 6. Network

| Legacy API/library | Current use | Native replacement | Notes |
|---|---|---|---|
| `fetch`, Axios-like SDK wrappers | Music source search/list/detail/URL/lyric | Named `HttpClient` instances + source adapters | Per-source headers, timeout, retry and encoding |
| `needle`, `undici` | Main/user API, proxy and HTTP work | `HttpClient`/`SocketsHttpHandler` | Stream responses; do not blindly buffer |
| Node `http` server | OpenAPI and Bilibili loopback media proxy | ASP.NET Core/Kestrel or `HttpListener` only after endpoint/lifetime evaluation | Explicit bind address, token/auth policy, range support |
| `ws` WebSocket server/client | Sync protocol | `System.Net.WebSockets`; hosted sync service | Contract-test frames, ordering, reconnect and crypto |
| Electron `session.setProxy` | App network proxy | `SocketsHttpHandler.Proxy` / per-client handlers | Avoid process-global mutation; define DNS/TLS behavior |
| Electron session cache clear | Network/cache troubleshooting | Dispose/version HTTP handlers and clear app-owned caches | OS HTTP cache may not be identical |
| Bilibili signed/WBI calls | Search/view/play URL/comments and matching | Dedicated Bilibili adapter using managed HTTP/cookie store | Non-public upstream behavior is volatile |
| source switching | Fallback between user/built-in sources | Source policy service over `IMusicSourceAdapter` | Preserve ordering, quality and error semantics |
| Server-Sent Events | OpenAPI event stream | ASP.NET streaming response | Backpressure and disconnect cleanup |

OpenAPI here means the application's local HTTP remote-control API, not OpenAI. It is now an optional final feature and may be omitted entirely; it does not block Native completion or release. Only if it is eventually implemented, use the recommended disabled-by-default/localhost policy and require an explicit token for LAN access.

## 7. Media and graphics APIs

| Browser/Electron API | Current use | Native replacement |
|---|---|---|
| `HTMLAudioElement` | Primary decoder/player/timeline | `MediaPlayer`/`MediaSource`; AudioGraph where graph control is needed |
| Web Audio `AudioContext` graph | analyser, EQ, pitch, convolution, compressor, pan, gain | Windows AudioGraph/managed DSP capability; isolate backend |
| `AudioWorklet` | Phase-vocoder pitch shift | AudioGraph custom effect or future narrow C++ DSP only if profiling proves necessary |
| `setSinkId` | Select audio output | Windows audio endpoint selection |
| MediaSession | OS transport commands/metadata | System Media Transport Controls |
| Canvas 2D / OffscreenCanvas | Visualizer/text/background work | XAML/Composition, then Win2D for high-density drawing |
| WebGL / Three.js / R3F / GLSL | Aura and Diorama | Composition/Win2D first; isolated Direct3D/HLSL for proven shader/3D need |
| Web Animations / CSS transitions | Lyric and UI motion | Microsoft.UI.Composition and XAML visual states |
| `requestAnimationFrame` | Presentation updates | Compositor animations or bounded UI dispatcher/render tick |
| Web Worker | Download and Aura rendering | Async/background managed services; graphics surface ownership isolated |

See `media-map.md` and `graphics-map.md` for migration sequencing and risk.

## 8. Current local build and deferred deployment

| Electron capability | Current use | Native personal-development decision |
|---|---|---|
| `electron-builder` NSIS/portable/7z | Windows distribution and portable profile | No replacement now; use unpackaged WinUI 3 local builds |
| `electron-updater` GitHub provider | Check/download/apply update | Deferred; no Native automatic updater in personal-development scope |
| build extra resources/native dependencies | FFmpeg, native modules, assets | Copy only resources required to run locally; validate from x64 Debug/Release output |
| app protocol/file associations | Activation | Manual/dev-only unpackaged registration when protocol behavior is migrated; no installer work |
| crash logging/startup log | Diagnostics | Structured local logs in the isolated Native development data root |

Current build contract:

- Unpackaged WinUI 3 (`WindowsPackageType=None` or the equivalent project configuration).
- Framework-dependent; rely on the Windows App Runtime/.NET runtime installed on the current development PC.
- x64 only.
- Ordinary `dotnet build`/IDE Debug and Release builds; no publish artifact is required.

Deferred until the user explicitly requests public distribution: MSIX, App Installer, certificates/code signing, installer creation, automatic/self-update, self-contained publishing, ARM64/x86, portable/public packages and clean-machine deployment tests. These concerns must not shape current domain, UI, media, storage or network boundaries.

## 9. Legacy dependencies that must not cross the boundary

- The existing Native Demo's `UserApiService` launches Node and packages a `node.exe`; this is incompatible with the approved stack and must not be retained.
- Do not use WebView2 as a replacement for renderer pages or custom source execution.
- Vue/React component islands are visual specifications only.
- Ordinary domain, storage, network and orchestration logic stays in C#.
- C++ remains a future option only for a measured audio/DSP/WASAPI or Direct3D/HLSL bridge; none is introduced in this phase.
