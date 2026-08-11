# Feature-based Native migration plan

## 1. Migration rule

Migration is organized as user-observable vertical slices:

```text
feature behavior trace
  -> domain/application contract
  -> storage/network/media/platform implementation
  -> WinUI presentation
  -> Electron/Native parity evidence
```

It is not organized as `file.ts -> file.cs`, nor as “finish all UI, then all services.” Every slice leaves a buildable, runnable application, has its own fixtures/tests and does not break completed slices. The Electron application remains unchanged and usable throughout.

## 2. State gates

The matrix uses only: `pending`, `analysis_complete`, `native_scaffolded`, `implemented`, `behavior_verified`, `performance_verified`, `done`.

- `analysis_complete`: behavior, sources, dependencies and risks are traced.
- `native_scaffolded`: stable interfaces/project wiring and failing/fixture tests exist; no parity claim.
- `implemented`: the in-scope workflow runs end to end.
- `behavior_verified`: reference comparison passes, with approved differences documented.
- `performance_verified`: representative budgets pass.
- `done`: the slice meets all required gates and has no unresolved in-scope blocker.

Do not advance a whole feature because a demo class with the same name exists.

## 3. Phase 0 — Executable foundation and compatibility fixtures

**Vertical outcome:** launch a native diagnostic shell that selects an isolated profile, validates/imports a copied legacy fixture read-only and reports readiness. It does not migrate a user-facing feature.

Scope:

- Create the recommended solution/project boundaries, DI composition root, logging, cancellation and test projects.
- Establish one isolated Native development data root and explicit copied-fixture/legacy-import paths without touching a real Electron profile.
- Implement read-only schema/settings inspection and fixture cloning.
- Add behavior-trace schema and Electron fixture-capture helpers kept outside production behavior.
- Decide minimum supported Windows/architectures and make project/solution build commands consistent.
- Add PresentMon/ETW-based frame instrumentation and define the 120 Hz reference hardware/run profile before UI motion is accepted.
- Build the versioned real-script corpus and prove the minimum managed JavaScript host contract for the core custom-source feature.

Build/run/test: ordinary local framework-dependent x64 Debug/Release builds from the solution; launch unpackaged output to a readiness screen; unit tests for paths/version parsing and integration tests against copied valid/invalid schema-v2 fixtures.

Exit conditions:

- No Electron/Chromium/WebView2/Node/Vue/React dependency.
- Dependency rules are mechanically checked.
- No production legacy database is written.
- Startup stages, failures and shutdown are observable and deterministic.
- The custom-source compatibility corpus, required APIs and managed-engine gaps are documented; an unproven Node-free runtime is not presented as compatible.
- No MSIX/App Installer/signing/installer/updater/self-contained/ARM64/x86/clean-machine work is present or required.

## 4. Slice 1 — Native shell + read-only local library browser

**User outcome:** open the native app, navigate the sidebar to Local Music, browse/search/sort the existing library and open track/list details. Playback and mutations are disabled with honest UI states.

Why first: it exercises startup, WinUI shell, navigation, real schema reading, large-list virtualization, themes/localization and screenshot parity without coupling the first deliverable to codec, volatile online API or write migration risk.

Scope:

- Main window lifecycle, shell/sidebar/top bar and read-only settings/theme/localization subset.
- Read-only playlists/local-library repositories from a cloned/imported profile.
- Local search/filter/sort/detail, artwork decode/cache and empty/error states.
- Reusable XAML/Composition motion primitives for navigation, panels, hover/press and list transitions; avoid UI-thread layout animation.
- No scan, edit, delete, download or playback.

Build/run/test: standalone runnable app; 10k/50k list fixture; keyboard/DPI/theme/localization UI suite; golden screenshots; startup/library baseline; 120 Hz scrolling/navigation/panel trace with 8.33 ms frame budget.

Exit conditions: shell and local browsing behavior verified; no write statement is reachable; scrolling and common motion sustain the 120 Hz acceptance cadence on reference hardware; Electron data remains untouched.

## 5. Slice 2 — Local library ownership: scan, lists and metadata

**User outcome:** choose folders, recursively scan/refresh local music, manage lists, edit metadata/artwork and match/save lyrics.

Scope:

- Folder picker, cancellation-aware bounded scanner and explicit refresh (no watcher unless separately approved).
- Record the Electron six-format baseline, then intentionally expand Native scanning to the unified fifteen-extension metadata registry. Report scan, metadata and playback support separately.
- Local/user list create/rename/order/delete and add/remove/move/duplicate behavior.
- Metadata/artwork read/write with atomic backup/verify/rollback.
- Local lyric provider matching, scoring/manual selection and DB/tag persistence.
- Versioned database/settings import and transactional writes with backups.

Build/run/test: scan fixture trees; corrupt/read-only/Unicode/large artwork corpus; transaction/crash injection; Electron/Native DB result comparison.

Exit conditions: all local mutations behavior-verified; rollback leaves original media intact; rescan duplicate/removal semantics match; write migration has a recoverable backup.

## 6. Slice 3 — Basic local playback

**User outcome:** play a local track from the library, pause, seek, adjust volume/mute and see duration/progress/system metadata.

Scope:

- One application-scoped `PlaybackSession` and selected backend.
- Local file playback, media events, error state, current-item presentation and basic SMTC.
- Volume/mute and position persistence.
- No online source, DSP suite, queue modes or immersive visuals.

Build/run/test: representative decoder corpus, rapid switching/cancellation, output-device and suspend smoke tests, play/seek latency and working-set baseline.

Exit conditions: core local formats pass corpus or unsupported cases are explicitly gated; event/position trace matches; no stale track/cover result; navigation never stops playback.

## 7. Slice 4 — Queue, playback modes and platform controls

**User outcome:** build/reorder/clear the queue; previous/next work in all modes; tray, global shortcuts, taskbar and SMTC control the same session.

Scope:

- Queue coordinator, ordered/list-loop/single-repeat/shuffle and ended transition.
- Previous/next, deleted-current-item/list mutation behavior and queue panel.
- Tray/menu/global hot-key/window show-hide-close-to-tray.
- Output device and timeout-stop settings.
- EQ/rate/pitch/reverb/pan can be delivered as small sub-slices, each with audible/numeric tests; do not block the basic queue slice unless reference default behavior requires it.

Build/run/test: model-based queue tests plus UI/platform automation and 24-hour playback smoke; measure command-to-state latency.

Exit conditions: every command origin converges on one state owner; queue persistence and mode edge cases match; hot-key conflicts and resource cleanup are verified.

## 8. Slice 5 — Lyrics and baseline immersive player

**User outcome:** see synchronized in-app lyrics (translation/romanization/word timing), scroll manually, click to seek and open a visually faithful baseline play-detail screen.

Scope:

- Parsed `LyricDocument`, providers/cache and one monotonic `LyricSession`.
- Line/word timing, offset, manual scroll ownership and click seek.
- Static/artwork-led play detail, common cover/background/transition effects.
- Desktop lyric is explicitly excluded: do not add its window, settings UI, tray command or background resources; legacy settings are ignored safely during import.

Build/run/test: lyric corpus, boundary/seek/rate tests, golden screenshots and synchronized 120 fps trace/video; reduced motion/text scale; 8.33 ms budget for lyric scroll/sweep and detail transitions.

Exit conditions: timeline is shared by all presenters; seek is deterministic; baseline detail behavior/visuals verified; no browser animation runtime exists.

## 9. Slice 6 — Immersive visual presets and motion quality

Deliver each Folia preset as its own sub-slice in this order unless evidence changes priority: Classic, Tilt, Partita, Cadenza, Fume, Claddagh, Cappella, Monet, Pendolo, then Diorama. Background variants and Aura are separately switchable capabilities.

Each sub-slice has a static golden, synchronized motion recording, reduced-motion mode, 120 Hz frame budget, adaptive quality policy, GPU/CPU/memory budget and device-loss test. Use XAML/Composition first, Win2D for dense drawing and Direct3D/HLSL only for Diorama or Aura after a failed, documented simpler prototype. C++ is not implied by Direct3D interop and is not introduced without a separate decision.

Build/run/test: reference 120 Hz display plus 60/144 Hz timing checks; integrated and discrete GPU; lyric seek/rate changes, resize, rapid preset/background switching and long-running resource stability.

Exit conditions: all enabled presets are behavior/visual verified; ordinary input/scroll/player feedback retains 120 Hz priority while expensive decoration scales down; unavailable presets are not shown as working placeholders.

## 10. Slice 7 — Core custom user-source compatibility

**User outcome:** import the existing `user_api.json`, select an existing custom source and use its search/URL/lyric operations with behavior compatible with Electron.

Scope:

- A managed JavaScript runtime behind `IUserSourceRuntime`; Node, WebView2 and hidden browser windows remain prohibited.
- Compatibility adapters for the existing script API, async callbacks/promises, HTTP request shape, proxy, timers, crypto helpers, cancellation, status and update notices.
- Explicit capability allow-list, execution timeout, bounded concurrency/resource policy and sanitized diagnostics.
- Existing compressed script storage/import semantics and source selection/fallback integration.
- A new source format may be researched later but cannot replace legacy-script compatibility in this slice.

Build/run/test: versioned real-script corpus; per-action request/result comparison against Electron; syntax/built-in/async compatibility; malformed and malicious scripts; infinite loop, timeout, cancellation, proxy and memory/concurrency limits.

Exit conditions: representative existing scripts pass the agreed compatibility corpus; failures identify the exact unsupported language/API surface; the host is capability-limited; the Demo Node executable/host is absent. If no managed runtime can satisfy the corpus, stop and escalate rather than weakening compatibility.

## 11. Slice 8 — Online search and discovery

**User outcome:** search built-in sources, browse rankings/song lists/detail/comments and play an online result through normal player/queue behavior.

Scope:

- Typed source adapter contracts, named HTTP clients, proxy/source policy and response cache.
- Search/history/source/type/paging, leaderboard, song lists/detail and comments.
- Play URL resolution, quality, cache/expiry, source fallback, errors and last-ten-second preload.
- Excludes Bilibili account-specific behavior; custom scripts already run through the Slice 6 adapter contract.

Build/run/test: deterministic HTTP server/recordings plus live opt-in smoke tests; stale-request/race, timeout/offline/fallback and contract suites.

Exit conditions: each built-in source has contract evidence; late responses cannot replace current state; online playback recovery matches; volatility is isolated to adapters.

## 12. Slice 9 — Bilibili end-to-end

**User outcome:** persist a Bilibili session, search/browse video-derived music, play through the range proxy, view comments and use lyric matching.

Scope:

- Cookie/session store, login validity/logout and WBI signing.
- Search/view/play URL/comments/song-list mapping and lyric match.
- Loopback media proxy with Range semantics and bounded lifetime.
- Privacy/redaction and expiry/re-authentication behavior.

Build/run/test: sanitized account fixtures, local proxy contract including 200/206/416, expired cookie/signed URL and logged-out flow; live tests manual/opt-in.

Exit conditions: cookie persistence and redaction verified; proxy seek/reconnect passes; upstream failures produce typed states; no cookie crosses general settings/sync/logs.

## 13. Slice 10 — Durable downloads and post-processing

**User outcome:** add, pause/resume/retry/cancel downloads, recover them after restart and receive finalized tagged files; Bilibili conversion works where required.

Scope:

- Durable scheduler/task repository, bounded concurrency and progress state.
- HTTP range/resume, URL refresh, integrity and atomic destination.
- Metadata, cover and lyric post-processing.
- FFmpeg process adapter for demonstrated conversions only.

Build/run/test: fault-injecting local HTTP server, disk/permission/cancel/restart cases, M4A conversion corpus and DB/filesystem trace.

Exit conditions: no partial file is presented complete; restart is deterministic; temp/process resources are cleaned; throughput/UI-responsiveness budgets pass.

## 14. Slice 11 — Complete settings and persistence

**User outcome:** all retained settings work and survive restart; backup/import/export and retained startup/protocol behavior work from normal local unpackaged builds.

Scope:

- Remaining typed settings, hot-key/theme/sound-effect data, cache controls and backup/import/export.
- Isolated Native development data root and explicit, recoverable legacy-profile import.
- Manual/dev-only unpackaged protocol/startup registration where required for behavioral testing; no installer integration.

Build/run/test: current development PC, unpackaged framework-dependent x64 Debug/Release output, old profile versions, corrupt import, restart persistence and import rollback.

Exit conditions: every retained legacy datum has an owner/import/disposition; the isolated Native profile and recovery path work; public packaging/update concerns are not part of the gate.

## 15. Slice 12 — Sync

**User outcome:** pair a peer and synchronize lists/dislike state.

Scope:

- Exact RSA/AES and compression framing, snapshots/incremental ordering, reconnect/conflict.

Build/run/test: two isolated app instances/fixture peers, protocol golden vectors, disconnect/reorder/wrong-key and convergence checks.

Exit conditions: protocol contract and convergence verified; listeners shut down cleanly; sync state persists and recovers deterministically.

### Explicitly excluded — Desktop lyrics

There is no Native desktop-lyrics slice. Import recognizes and ignores legacy desktop-lyric keys, and tests verify there is no related window, startup service, tray command, settings entry or background analyser subscription.

## 16. Slice 13 — Full parity, reliability and cutover candidate

**User outcome:** a complete Native release candidate can replace the Electron build without losing supported data or workflows.

Scope:

- Run the entire feature matrix, visual suite, format corpus and long-running soak.
- Accessibility, high contrast, reduced motion, localization and privacy/security on the current development environment.
- Profile import rollback and side-by-side isolation; documented known approved differences.
- Startup, memory, scan, playback/seek, download and immersive performance budgets.

Exit conditions:

- Every shipped matrix entry is `done`; intentionally deferred/removed behavior has explicit user approval and release notes.
- No banned runtime/dependency is present in binary/package inspection.
- Electron profile remains recoverable and is never mutated without backup.
- Data rollback and crash/restart paths pass.
- Cutover is a user decision; completion of this slice does not delete Electron source.

## 17. Optional final slice — OpenAPI

OpenAPI is not part of the Native completion gate and may be omitted. Only after every core slice is complete, decide whether external HTTP/SSE control is worth the additional server, security and support surface.

If implemented: default off; localhost-only by default; explicit token-protected LAN mode; endpoint/command/SSE compatibility tests; no silent enablement from imported legacy settings. Omitting this slice does not prevent the release candidate or other matrix entries from reaching `done`.

## 18. Next-stage recommendation

The next stage should execute only Phase 0 and Slice 1: establish the clean unpackaged x64 solution and deliver a read-only Local Library Browser vertical slice against cloned fixtures. Phase 0 must also produce an executable proof for the managed custom-source compatibility contract. Playback backend format work remains a bounded corpus spike. Do not begin player migration, Folia rendering, public deployment work or C++ unless the scope is explicitly expanded.
