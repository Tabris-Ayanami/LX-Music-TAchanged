# Recommended Native architecture

## 1. Decision summary

Build the replacement as a C# WinUI 3 application on Windows App SDK, with application/domain code independent of WinUI and Windows handles. Use Microsoft.UI.Composition for retained visual effects and Win2D only for dense custom drawing. Keep Direct3D/HLSL and C++ outside the initial architecture; introduce a narrow bridge later only when a measured media/DSP/graphics limitation requires it.

Do not preserve the Electron Main/Renderer split or emulate its IPC. Preserve observable behavior and data compatibility through typed application services.

### Current development/deployment profile

This Native app is currently personal software for one known Windows development PC. Optimize for iteration speed:

- unpackaged WinUI 3;
- framework-dependent runtime;
- x64 only;
- ordinary local Debug and Release builds from the IDE or `dotnet build`;
- one isolated Native development data root plus explicit copied legacy fixtures/imports.

Do not add MSIX/App Installer projects, signing/certificates, installers, automatic update, self-contained publish, ARM64/x86 matrices or clean-machine deployment work. Those are outside the architecture until the user explicitly requests public distribution.

## 2. Proposed solution

```text
native/
  LXTA.App/                 WinUI bootstrap, pages, controls, view models, navigation
  LXTA.Domain/              stable models, value objects, policies, no infrastructure
  LXTA.Application/         use cases, service ports, state coordinators
  LXTA.Storage/             SQLite repositories, settings/import, cache, app paths
  LXTA.Network/             source adapters/managed JS host, Bilibili, sync, HTTP policy; optional OpenAPI
  LXTA.Media/               playback, queue, metadata, lyric timeline, download/transcode
  LXTA.Platform.Windows/    windows, tray, hotkeys, protocol, SMTC, update, power
  LXTA.Graphics/            immersive presenters and optional Win2D/D3D host
  LXTA.Tests.Unit/
  LXTA.Tests.Integration/
  LXTA.Tests.Contract/
  LXTA.Tests.Visual/
```

This is eight production projects rather than one project per legacy folder. `LXTA.Graphics` remains separate because immersive rendering has a very different dependency/resource lifecycle; if early static work contains no custom rendering, it can initially contain only contracts and be added to the app composition when needed.

### Dependency direction

```text
LXTA.App -----------------------> LXTA.Application -> LXTA.Domain
   |                                      ^
   +-> LXTA.Graphics ---------------------+
   +-> composition root wires implementations

LXTA.Storage --------implements Application ports--+
LXTA.Network --------implements Application ports--+-> LXTA.Domain
LXTA.Media ----------implements Application ports--+
LXTA.Platform.Windows implements Application ports-+
```

- Domain references no WinUI, Windows App SDK, SQLite, HTTP or media packages.
- Application references Domain and defines use cases/contracts/state owners.
- Infrastructure projects reference Application/Domain to implement ports, never App.
- App references concrete projects only in the composition root; view models use application interfaces.
- Media does not call a view. Network does not mutate UI state. Storage does not publish raw SQLite connections.

## 3. Project responsibilities

### `LXTA.Domain`

Track, artist, album, playlist/list identity, playback mode, lyric document/timing elements, download intent/status, source identity/quality, settings value objects and errors that are independent of a technical backend. It contains pure policies such as queue navigation and local match scoring where those policies do not perform I/O.

Domain models should not duplicate the entire flexible JavaScript object graph. During compatibility import, retain a versioned extension payload for source-specific fields, then promote fields to typed values when a real use case owns them.

### `LXTA.Application`

Feature-oriented use cases and long-lived coordinators:

- `StartupCoordinator`, `ActivationCoordinator`, `ShutdownCoordinator`
- `LibraryCoordinator`, scan/import/edit/match use cases
- `PlaybackSession` and `QueueCoordinator`
- `LyricSession`
- `DownloadCoordinator`
- `SearchCoordinator` and discovery/detail/comment use cases
- `SettingsCoordinator`, theme/localization state
- `SyncCoordinator`, login/session use cases and an optional late OpenAPI lifecycle

It defines ports such as `ITrackRepository`, `ISettingsStore`, `IMusicSourceAdapter`, `IPlaybackBackend`, `IMediaMetadataService`, `ILyricProvider`, `IDownloadTransport`, `IWindowManager`, `ITrayService`, `IHotKeyService`, `IUpdateService` and `IClock`.

### `LXTA.Storage`

Own existing-schema reading, repositories and transactions; versioned settings; browser-localStorage/config import; cache namespaces; the isolated Native development path; legacy-profile import; backup/recovery. A single `DatabaseGate` or transaction coordinator serializes writes that must be ordered. UI code never builds SQL.

Initially open a copied fixture/read-only legacy database for discovery. A production importer must create a backup and record migration version before any write.

### `LXTA.Network`

Own named `HttpClient` handlers, proxy/cookie policy, rate limiting and source-specific adapters. Modules include the core custom-source compatibility host, built-in music source clients, Bilibili and sync protocol implementation. OpenAPI is a final optional module and is not required to establish this project. Responses are translated at adapter boundaries; raw JSON does not flow into view models.

The custom-source host is a first-class production subsystem. Its primary contract is compatibility with existing `user_api.json` scripts and their request/response behavior. Use a managed JavaScript engine behind `IUserSourceRuntime`, inject only explicit HTTP/timer/crypto/logging capabilities, and enforce cancellation, execution time and memory/concurrency limits. A new declarative source format may be added later, but it cannot replace legacy compatibility without explicit approval.

### `LXTA.Media`

Own backend playback events, queue execution, audio endpoint/effects capability, local metadata/artwork, lyric timeline, durable download transfer and optional FFmpeg process integration. Real-time/backend callbacks publish bounded state snapshots and never update XAML directly.

### `LXTA.Platform.Windows`

Own HWND/AppWindow operations, single-instance activation/protocol, tray, hotkeys, SMTC/taskbar, dialogs/clipboard/shell, power/session events and crash diagnostics. Current protocol/startup integration may use manual development registration; package/update integration is deferred. Keep Win32 P/Invoke wrappers small and test their managed policy separately.

### `LXTA.Graphics`

Own graphics-independent presenter inputs and implementation-specific Composition/Win2D resources for immersive backgrounds/presets. It consumes read-only playback, lyric and artwork snapshots. It cannot issue playback/network/database commands except through explicit application commands such as lyric-line seek.

### `LXTA.App`

Own the composition root, resource dictionaries, navigation shell, pages, controls and view models. It translates input into use cases and observes immutable state. Code-behind is limited to view-specific platform/rendering glue that cannot live in a view model.

## 4. Feature-facing architecture

Example: folder selection and scan.

```text
LocalLibraryViewModel.ScanFolderCommand
  -> ScanLocalFolder use case
  -> IFolderPicker (Platform.Windows)
  -> ILocalMediaScanner + IMediaMetadataService (Media)
  -> ITrackRepository transaction (Storage)
  -> LibraryCoordinator publishes LibraryState
  -> views update through binding
```

Example: online playback.

```text
Track command -> PlaybackSession
  -> QueueCoordinator chooses item
  -> IPlayableUrlResolver -> IMusicSourceAdapter (Network)
  -> IPlaybackBackend (Media)
  -> typed backend events -> PlaybackState
  -> App, tray, SMTC, lyric and graphics observe one snapshot
```

This replaces many Main/Renderer calls with direct typed services while retaining the async/error boundary where real I/O occurs.

## 5. State architecture

Use one owner per state domain, exposing immutable snapshots and commands:

| Owner | State |
|---|---|
| `AppSession` | startup/activation/shutdown and global readiness |
| `NavigationState` | current route/history/selected entity |
| `LibraryCoordinator` | lists, local tracks, mutations and scan progress |
| `PlaybackSession` | current item, backend state, position/duration/buffering/errors |
| `QueueCoordinator` | effective queue, index and playback mode |
| `LyricSession` | document, offset, current line/word, manual-scroll state |
| `DownloadCoordinator` | durable tasks and aggregate progress |
| `SettingsCoordinator` | typed effective settings and pending persistence |
| `SessionCoordinator` | Bilibili cookies/login and source availability (secrets excluded from general state) |

View models project these snapshots into display state. They do not hold second authoritative copies of current track, queue, download or settings state. Cross-domain changes happen through an application command/transaction; observers are notification only and cannot form an event loop.

State publication should be UI-framework-neutral (`IObservable<T>`, event stream, or explicit subscription abstraction). Marshal only final snapshots/diffs to the DispatcherQueue. High-frequency player time and analyser data are throttled separately from normal property updates.

## 6. ViewModel and navigation design

- Use CommunityToolkit.Mvvm for observable view-model properties and async commands, not as a global service locator.
- Route IDs and typed navigation parameters replace arbitrary component imports/history objects.
- Page view models are transient; session coordinators are application singletons; dialog/edit view models are scoped to their operation.
- Navigation does not recreate playback, downloads or network sessions.
- Virtualized collection projections use incremental loading/diff updates rather than replacing thousands of rows per progress tick.
- All commands expose running/cancellable/error state needed by the view.

## 7. Dependency injection and lifetime

Use `Microsoft.Extensions.DependencyInjection` in one composition root during app startup. Registrations should be auditable and constructor-injected.

| Lifetime | Examples |
|---|---|
| Singleton/application | app paths, database connection coordinator, HTTP client factory, playback/queue/lyric/download/settings coordinators, window manager |
| Window-scoped | main-window presentation adapters and window event subscriptions |
| Page/transient | page view models, search/detail operation state |
| Operation-scoped | metadata edit, scan session, import/migration, download post-process |

Avoid `NativeAppServices`-style static access. Each resource owner implements `IAsyncDisposable` where shutdown order matters. The root shuts down hosted services, checkpoints state, closes DB/network listeners and then releases platform objects.

## 8. Async, concurrency and cancellation

- Public I/O methods are `Task`/`ValueTask` based and accept `CancellationToken`.
- Never use `async void` except framework event handlers that immediately delegate and contain exception handling.
- Use `Channel<T>` for serialized command streams such as playback and durable download scheduling; do not use it as a generic event bus.
- Tag track/search/cover/lyric operations with a generation ID. A completed stale operation may warm a cache but cannot publish current UI state.
- SQLite writes have explicit transactions and one ordering policy. Long metadata/network work happens outside the transaction.
- Bounded concurrency applies to folder metadata reads, cover decode and downloads.
- Timeouts are linked cancellation with a typed timeout result; retry is owned at the adapter/use-case level, not scattered through views.

## 9. Errors, diagnostics and recovery

Define typed application failures (`SourceUnavailable`, `AuthenticationRequired`, `MediaUnsupported`, `FileAccessDenied`, `DatabaseInvalid`, `DownloadIntegrityFailed`, etc.) with user-safe messages and diagnostic context. Expected failures use result types; programmer/invariant failures throw and reach the global diagnostic boundary.

Structured local logs include correlation/operation IDs, feature, duration and error category. Redact cookies, credentials, complete signed media URLs and user-source script contents. Startup records each completed stage so a crash can distinguish DB validation, window creation and service startup.

Database migration is recoverable: validate, backup, migrate transactionally, re-open/verify, then mark complete. If validation fails, retain the original and offer an explicit recovery path rather than silently replacing it.

## 10. Existing Native Demo assessment and replacement status

### Current structure and build result

The old demo is one `LXTA.Native` WinUI 3 project targeting `net10.0-windows10.0.26100.0`, Windows App SDK 2.3.1, CommunityToolkit.Mvvm, Microsoft.Data.Sqlite and H.NotifyIcon. It contains a `MainWindow`, a large `MainPage`, one main view model, models, static `NativeAppServices` and service classes for player/library/search/download/lyrics/settings/sync/update/theme/hotkeys/desktop lyric.

On 2026-08-10:

- `dotnet build native/LXTA.Native/LXTA.Native.csproj -c Debug -p:Platform=x64 --no-restore` succeeded with 0 warnings and 0 errors.
- `dotnet build native/LXTA.Native.slnx -c Debug -p:Platform=x64 --no-restore` failed because the solution does not define/resolve that solution configuration, not because the project compile failed.
- No source was changed to obtain either result.

The old project still advertises x86/x64/ARM64 and enables MSIX tooling. It is now excluded from `native/LXTA.Native.slnx` and retained only for source-level audit. Those settings belong to the discarded deployment experiment and are not copied into the active unpackaged, framework-dependent, x64-only solution.

This verifies compilation of the project under the already restored environment, not runtime behavior or parity.

### Retain, rework, remove

| Disposition | Demo assets | Reason |
|---|---|---|
| Retain as research/fixtures | Models and SQLite schema observations; small AudioGraph/MediaPlayer and hot-key/tray experiments; smoke-test intent | Useful evidence and test starting points, after validating against current Electron behavior |
| Rework substantially | Library reads/writes, player, settings/localization, update, download and sync service ideas | Interfaces, lifetimes, cancellation, parity and project boundaries are incomplete |
| Replace | `NativeAppServices` static locator; monolithic `MainPage.xaml`/code-behind; services directly coupled to views/files/schema | Creates hidden dependencies and prevents feature-scoped testing |
| Remove from product design | `UserApiService` Node process, `Assets/user-api-host.mjs`, optional bundled `Runtime/node.exe` | Directly violates the approved Native stack |

The demo directly targets legacy paths/schema in places, caps/approximates data in places, and implements a visually/functionally small shell. Existing code is not evidence that a feature is `implemented`; no demo feature is marked implemented in `matrix.json` without behavior verification.

Actual Slice 1 reuse is lower than the earlier estimate: no old service, model, view model, XAML page, static locator or project configuration is part of the new solution. Only `Assets/AppIcon.ico` is linked as an asset. The experiment's source remains outside the solution for audit and can be deleted after the user no longer needs that provenance.

### Active minimal solution after Slice 1

```text
native/src/
├─ LXTA.App               WinUI shell, view model, theme and Composition motion
├─ LXTA.Application       local-library use case, queries and service ports
├─ LXTA.Domain            immutable local track/group models
├─ LXTA.Storage           read-only legacy SQLite adapter
└─ LXTA.Platform.Windows  app paths and Windows artwork cache

native/tests/
├─ LXTA.Application.Tests
└─ LXTA.Storage.Tests
```

`Network`, `Media` and `Graphics` projects are intentionally absent until an authorized vertical slice needs a real implementation boundary. This keeps Phase 0 minimal without changing the eventual dependency direction.

Direct package/source audit of the active app contains no Electron, Chromium, Node, Vue, React or WebView2 application dependency/API. The `Microsoft.WindowsAppSDK` NuGet graph nevertheless includes Microsoft's WebView2 support package and copies support assemblies even when no `WebView2` control is instantiated. This is an upstream WinUI/Windows App SDK packaging characteristic, not an LXTA browser-host design. If “no WebView2” is intended to prohibit even those unused transitive framework bytes, that conflicts with the selected WinUI package and requires a separate framework/package decision; it does not authorize using the control.

## 11. Explicit architecture decision gates

1. **Custom user source compatibility:** this is a core requirement, not an optional compatibility experiment, but it does not block Phase 0 or Slice 1. In its dedicated vertical slice, inventory real scripts and establish a managed-engine compatibility corpus. Jint or another managed engine is acceptable only after API/language/async/network/sandbox tests; Node, Chromium and WebView2 remain prohibited. If no compliant engine can run the corpus, stop and report the exact incompatibilities rather than silently replacing the feature.
2. **Local build profile (decided):** unpackaged, framework-dependent, x64-only Debug/Release builds on the current development PC. This is not an early risk or decision gate. Public packaging, signing, installers, automatic update, self-contained output, other architectures and clean-machine testing remain absent until explicitly requested.
3. **Playback backend:** decide MediaPlayer/AudioGraph/fallback based on format and DSP corpus, not demo code.
4. **OpenAPI exposure:** explicitly low priority and optional. Do not implement it until all core slices and parity gates are complete. It may be omitted; if included later, default it off/localhost and protect LAN mode with a token.
5. **Desktop lyric:** explicitly canceled for Native. Legacy settings are ignored safely and no window, service or graphics resources are created.
6. **120 Hz motion:** motion primitives and measurement infrastructure are foundation work. On the reference 120 Hz display, ordinary navigation, scrolling, panel, hover/press, cover and lyric animations target a 120 fps presentation cadence with an 8.33 ms frame budget. Expensive effects must degrade quality before lowering interaction cadence.

## 12. C# and future native code boundary

All app orchestration, domain models, state, views/view models, SQLite, settings, HTTP APIs, sync, download scheduling, metadata workflow and platform integrations begin in C#.

Future C++ is permissible only behind an already defined managed interface for one of:

- codec/audio backend or WASAPI behavior unavailable with acceptable performance;
- DSP whose real-time constraints cannot be met safely in managed code;
- Direct3D/HLSL rendering bridge for a proven visual parity requirement such as Diorama;
- another extreme hotspot demonstrated by profiling and a representative workload.

No C++ project is created during analysis or early vertical slices.
