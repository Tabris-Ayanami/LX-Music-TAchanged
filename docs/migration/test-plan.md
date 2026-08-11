# Electron-to-Native parity test plan

## 1. Purpose and rules

The Electron application is the reference oracle for observable behavior. Tests compare feature outcomes, state transitions, persisted data, network contracts and visuals; they do not require implementation-level equivalence.

- Never run Electron and Native concurrently against the same writable profile/database.
- Create a versioned, sanitized fixture profile and clone it before each destructive test.
- Record app version, OS build, architecture, DPI, theme, locale, audio device and network fixture version with every result.
- Preserve surprising reference behavior as a named contract first. Any intentional improvement needs a separate approved behavior-change record.
- A feature moves to `behavior_verified` only after its required parity suite passes. Performance results alone cannot compensate for missing behavior.

## 2. Test layers

| Layer | Scope | Examples |
|---|---|---|
| Unit | Pure policies/parsers/state reducers | queue previous/next modes, lyric parsing/current line, matching score, path normalization |
| Contract | Stable boundary behavior | IPC-derived service contract, source request/response translation, sync frames, schema/settings import |
| Integration | Real infrastructure with fixture data | SQLite WAL/transactions, metadata files, range HTTP, cookies, FFmpeg process, Windows APIs |
| UI automation | User-visible workflows | navigation, dialogs, search, playback controls, settings, tray/window behavior |
| Golden visual | Static and timed visual parity | shell/pages/play detail at fixed DPI/theme/content |
| Performance | Measured budgets and regression | cold/warm startup, working set, scan throughput, frame times, seek latency |
| Soak/recovery | Long-running and failure behavior | 24h playback, reconnect, suspend/resume, device change, interrupted download, crash/restart |

## 3. Reference harness

### Fixtures

Maintain a repository-external or test-data-safe corpus containing:

- A copied schema-v2 profile with playlists, local tracks, download states, cached lyrics and settings.
- Media across every scanner and metadata extension, VBR/CBR, multiple rates/bit depths/channels, zero/large artwork, malformed tags, Unicode/long paths and duplicates.
- Lyrics with plain LRC, word timing, translation, romanization, blank/duplicate timestamps, long CJK and RTL/mixed text.
- HTTP response recordings or local deterministic test servers for search, lists, URL expiry, partial/range transfer, errors, redirects and timeouts.
- Sanitized Bilibili logged-out/logged-in states. Never commit real cookies.
- Sync snapshots/incremental events and a second isolated peer.

### Trace format

Both apps should emit a test-only behavior trace using the same conceptual events: command accepted, current item changed, URL attempt, backend ready/play/pause/buffer/seek/end/error, queue changed, lyric line/word, DB commit, download transition, window state and service lifecycle. Normalize timestamps/IDs/paths, then compare order and payload invariants.

### Dual-run process

1. Clone the same fixture profile into isolated Electron and Native locations.
2. Start with the same activation, window size and network fixture.
3. Execute the same scripted user scenario.
4. Compare trace, visible state, filesystem tree, database queries and screenshot/video artifacts.
5. Restore fixtures. Never repair the Electron reference data in place.

## 4. Functional parity suites

### Startup, activation and shutdown

- Cold/warm normal start from unpackaged x64 Debug/Release output; isolated Native development root; first-run/missing config; explicit copied legacy-profile import.
- Valid schema, invalid/newer schema, WAL present and recovery backup behavior.
- Single-instance activation, second-instance arguments and `lxmusic:` protocol activation.
- Startup setting, update-check enabled/disabled/offline, crash log creation and next-start behavior.
- Close-to-tray versus explicit quit; shutdown while playing/downloading/syncing; bounded persistence flush.
- Resume after OS suspend, display/DPI topology change and missing prior monitor.

### Main window and shell

- Show/hide/minimize/maximize/restore/fullscreen and restored bounds.
- Sidebar routes, back/forward/history, current selection, title-bar drag/double-click and snap layouts.
- Queue/context/dialog focus, pointer dismissal, keyboard navigation and escape handling.
- Tray commands, menu labels, single/double click, quit; global shortcuts and conflict reporting.
- Taskbar/SMTC controls and metadata; light/dark/system theme and localization switch.

### Local music and library

- Folder picker cancel/select; recursive/non-recursive expectations; inaccessible folder/symlink/long/Unicode path.
- Preserve the six-format Electron scan as the reference baseline, then verify the approved Native expansion scans all fifteen current metadata extensions. Metadata and playback capability are reported separately.
- First scan, rescan, overlapping folders, duplicate file, renamed file, changed metadata, removed file and empty folder.
- Batch/progress/cancel behavior and restart after cancellation.
- Local list search/filter/sort/detail, user list create/rename/remove/order, add/remove/move tracks and duplicate rules.
- Metadata read including artwork/duration; metadata edit success, unsupported/read-only/corrupt file and rollback verification.
- Cover cache invalidation when path/mtime/size/content changes.
- Lyric matching across providers, scoring threshold, manual selection, no result, save to DB/tag and refresh after write.

### Playback, queue and media

- Local and each online-source playback at each quality; URL expiration/source fallback/proxy behavior.
- Play/pause, direct seek, keyboard/tray/SMTC seek, zero/unknown duration and seek near end.
- Previous/next in ordered/list-loop/single-repeat/shuffle modes; one-item/empty queue.
- Queue add/remove/reorder/clear, delete current track/list, switch list during loading and rapid track switching.
- Ended transition, last-ten-second prefetch, stale prefetch completion and preload failure.
- Network stall, load timeout, decoder error, refreshed URL, exhausted fallback and offline recovery.
- Volume/mute persistence; playback rate and pitch; ten-band EQ, pan, compressor and every impulse response.
- Output-device selection/removal, Bluetooth reconnect, default device change, suspend/resume.
- Position persistence cadence and restart restore; duration and progress tolerance against reference.
- Codec corpus open/play/seek/end plus CPU, latency and waveform/listening checks for DSP parity.

### Lyrics

- Fetch/cache/refresh for each provider and local/embedded lyric priority.
- Plain, translation, romanization/alternate text and word-timed parsing.
- Current line/word at boundaries, pause/resume, seek backward/forward, rate/pitch and offset adjustments.
- Auto-scroll, manual scroll ownership timeout, click-line seek, resize/font change and very long lyrics.
- In-app compact/detail/Folia consumers receive one timeline.
- Verify the canceled desktop-lyric feature is absent: no window, startup service, tray command or background analyser subscription. Legacy desktop-lyric settings are ignored without import failure.

### Online discovery and account features

- Search input/history/suggestions, source/type/page switch, empty/error/offline and result actions.
- Leaderboards, song-list categories/detail/pagination, collect/import and cover/metadata display.
- Comments load/pagination/error and Bilibili reply shape where present.
- Bilibili search/view/play URL, token proxy Range/206 behavior, cookie import/update/persistence/logout and login expiry.
- Verify cookie and signed URL redaction from all logs/traces.
- User API source initialization/request timeout/error/quality fallback with a versioned corpus of representative real scripts. Compatibility is the primary acceptance gate; replacement-only fixtures are insufficient.

### Download

- Add/pause/resume/cancel/retry/remove task; concurrent limit and duplicate destination.
- HTTP range supported/ignored/invalid, connection drop, expired URL refresh, disk full and permission error.
- Restart with queued/running/partial tasks; exact DB transition and filesystem cleanup.
- File integrity, atomic completion, metadata/artwork/lyric post-processing.
- Bilibili M4A and required FFmpeg conversion success/failure/cancel; safe arguments and temporary-file cleanup.

### Settings, storage and persistence

- Every typed setting's default, import, change event and restart persistence; unknown legacy fields retained as specified.
- `config_v2.json`, `data.json`, hot keys, user API, theme, sound effects and known localStorage-key import.
- Database list/dislike/lyric/download/music URL/cache reads/writes and WAL transaction/crash behavior.
- Backup/export/import success, corrupt input, schema mismatch, conflict and recovery.
- Cache clear by namespace without deleting authoritative data.
- Isolated Native development path, explicit legacy import source and denied/read-only data path. Do not test installer/portable transitions in the current scope.

### Sync and optional OpenAPI

- Sync server/client pairing/auth, RSA/AES framing, full snapshot, incremental list/dislike, conflict/order, reconnect and wrong key.
- Two-peer changes during disconnection and restart consistency.
- OpenAPI is tested only if the optional final feature is selected: lifecycle, disabled-by-default state, localhost bind, token-protected LAN bind, endpoint status/body/error, SSE order/backpressure/disconnect and command side effects.
- Proxy enable/change/invalid proxy, timeout, DNS/TLS failure, source switch and cache clear.
- If the optional OpenAPI includes a warned unauthenticated compatibility mode, test that it cannot be enabled accidentally and that the UI clearly reports LAN exposure.

### Current local build

- Unpackaged WinUI 3 x64 Debug and Release builds succeed through normal IDE/`dotnet build` workflow.
- Builds are framework-dependent and run on the current development PC with its installed development/runtime prerequisites.
- Required assets/native x64 dependencies are found from normal build output; no publish step is needed.
- Public-deployment tests are explicitly deferred: MSIX, App Installer, certificates/signing, installers, automatic updates, self-contained output, ARM64/x86 and clean-machine execution.

## 5. Visual and animation comparison

Use the images under `F:\player\lx-music-desktop-master\截图反馈` as initial goldens and add deterministic captures for every route, major dialog, queue, empty/loading/error state, compact player and each immersive preset.

- Fixed data, cover, lyric time, size, scale, theme, locale and font fallback.
- Pixel/structural difference thresholds with masks only for declared nondeterminism.
- Review typography baselines, row/card geometry, corners, borders, shadows, gradients, masks, blur and color contrast.
- Capture 60 fps video for navigation/panel/detail transitions, lyric scroll/sweep, cover change and all ten Folia presets.
- Capture a native 120 fps performance trace/video on a display locked to 120 Hz; a 60 fps recording remains useful for visual comparison but cannot certify smoothness.
- Compare start delay, duration, easing shape, peak/settle and interruption state.
- Test 100/125/150/200% DPI, narrow/large windows, light/dark/high contrast, text scaling and reduced motion at 120 Hz primary, 60 Hz fallback and 144 Hz/VRR secondary refresh modes.
- Automated visual pass is necessary but never sufficient for blur, temporal motion or perceived jank.

## 6. Performance and stability

Measure primarily on the current development PC, including its integrated/discrete GPU paths where available. Use the unpackaged framework-dependent x64 Release build output; record medians and p95 over repeated cold/warm runs. Additional-machine and clean-deployment coverage is deferred, not implied by these results.

| Metric | Comparison / proposed gate |
|---|---|
| Process start to first usable shell | Must materially improve over Electron; set numeric budget after baseline trace |
| Start to restored library/player state | No later than reference and no UI freeze |
| Idle working set after stabilization | Must materially improve; separate shared/private/GPU memory |
| 10k/50k-track library load/search | No dropped-input frames; bounded allocation |
| Recursive scan throughput | At least reference throughput with bounded memory and cancellation latency |
| Play request to audible/ready | No regression by source class; record cold/warm URL cache |
| Seek command to stable audio/UI | No perceptible regression; compare p95 |
| UI and immersive frame time | On reference 120 Hz hardware, sustain 120 fps presentation with 8.33 ms budget; report p50/p95/p99, missed vsync and frames >8.33/16.67 ms |
| Download throughput/CPU | No material regression; UI remains responsive |

ETW/WPR, Visual Studio profiler or PerfView can measure startup, CPU, allocation, disk/network and UI stalls. PresentMon/ETW presentation data validates actual 120 Hz delivery; GPUView/Pix-style tooling is reserved for Composition/D3D investigation. A visual feature cannot reach `performance_verified` from a 60 Hz-only run. Its representative 120 Hz workload, hardware profile and regression budget must be recorded.

Soak scenarios:

- 24-hour mixed local/online playback with periodic seek/queue changes.
- 8-hour download queue with failures/retries.
- Repeated 1,000-track switching/cover/lyric generations to detect stale resources.
- 100 window show/hide, theme and device-change cycles.
- Sync reconnect churn and OS suspend/resume; optional OpenAPI soak only if that final feature is shipped.
- Monitor handles, threads, DB connections, sockets, audio/graphics resources and private/GPU memory for unbounded growth.

## 7. Exit evidence per feature

Each vertical slice must archive:

1. Requirement and source trace links.
2. Unit/contract/integration/UI test results.
3. Electron and Native normalized behavior traces.
4. Relevant DB/filesystem before/after snapshots.
5. Visual artifacts where applicable.
6. Performance baseline/budget or a reason performance verification is deferred.
7. Known differences approved by the user.

`matrix.json` moves through the allowed states only on this evidence; `done` requires both behavior and performance verification where the feature has a meaningful performance path.

## 8. Current Demo verification record

The current demo project compiled without restore using:

```powershell
dotnet build native/LXTA.Native/LXTA.Native.csproj -c Debug -p:Platform=x64 --no-restore
```

Result: 0 warnings, 0 errors. Building `native/LXTA.Native.slnx` with `Debug|x64` failed at solution configuration resolution. No runtime/UI parity test was inferred from compilation, and no code was changed to make either command pass.
