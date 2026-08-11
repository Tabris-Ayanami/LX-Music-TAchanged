# Media and playback map

This document records the observed media behavior of the Electron reference. It is a behavioral contract for a future implementation, not a request to reproduce Chromium's implementation details.

## 1. Playback topology

```text
UI / MediaSession / hot-key / tray commands
  -> renderer store/player/action.ts
  -> core/player (queue and URL decision)
  -> plugins/player (one HTMLAudioElement)
       -> AudioContext graph
       -> media events back to player store
  -> persisted playInfo / listPosition / position
```

The active backend is one `HTMLAudioElement`; changing a track changes its source rather than creating one element per track. The Web Audio graph is created lazily and is effectively:

```text
MediaElementSource -> Analyser -> 10 BiquadFilter EQ nodes
  -> optional AudioWorklet pitch shifter
  -> dry path and optional Convolver reverb
  -> DynamicsCompressor -> StereoPanner -> Gain -> destination
```

`src/renderer/plugins/player/index.ts` owns this graph, volume/mute/rate/pitch/EQ/convolver/output-device operations and translates browser media events. `src/renderer/core/player/index.ts` and `action.ts` own the higher-level track lifecycle, URL acquisition and recovery. `src/renderer/store/player/*` exposes reactive state to the UI.

## 2. Player state and commands

| Concern | Reference behavior | Principal sources | Native responsibility |
|---|---|---|---|
| Current item | `playMusicInfo` identifies the list and track; `playInfo` holds the selected media object and resolved URL state | `store/player/state.ts`, `core/player/action.ts` | `PlaybackSession` with immutable current-item snapshot |
| Play/pause | Commands converge on the player action layer; media events are authoritative for final UI state | `core/player/*`, `plugins/player/index.ts` | Serialized commands plus backend event reconciliation |
| Seek | Sets media time; persisted position is updated during playback; lyric clock follows it | `store/player/playProgress.ts`, `core/lyric.ts` | One monotonic timeline shared by media and lyric services |
| Duration/progress | Read from media metadata/time events; unknown/live values must not be presented as valid finite duration | `plugins/player/index.ts` | Backend event adapter with explicit unknown state |
| Volume/mute | Separate reactive values, applied to Web Audio gain/backend; retained in settings | `store/player/volume.ts` | `AudioSettings` + backend endpoint volume |
| Rate/pitch | Playback rate and pitch shift are separate capabilities; AudioWorklet performs pitch work | `store/player/playbackRate.ts`, `plugins/player/pitch-shifter/*` | Start in C# with platform support; profile before considering native DSP |
| EQ/reverb/pan | Ten-band filters, impulse-response convolver, compressor and pan are live graph settings | `plugins/player/index.ts`, `assets/medias/filters/*` | AudioGraph nodes where parity is achievable; isolate DSP capability |
| Output device | Uses `HTMLMediaElement.setSinkId` when available | `plugins/player/index.ts` | Windows audio endpoint enumeration and device selection |
| MediaSession | OS play/pause/previous/next/seek commands and metadata are bridged to renderer actions | renderer player integration | System Media Transport Controls |
| Timeout stop | Stops playback after a configured interval | `core/player/timeoutStop.ts` | Cancellation-token timer owned by playback session |

Playback modes include ordered play, list loop, single repeat and shuffle behavior. Previous/next decisions are made against the effective queue, not against the view currently rendered. Queue mutations, source-list removal and deleted-current-item behavior need contract tests before implementation.

## 3. Track change and URL lifecycle

1. A user, automatic-next event, tray/hot-key, MediaSession or lyric/UI action requests a track.
2. The player resolves the list position and installs the requested item as the pending/current item.
3. Local tracks resolve to a filesystem URL/path. Online tracks request a playable URL through the selected source adapter and quality setting.
4. The result is cached with track/source/quality semantics; expiration or a playback failure can invalidate it.
5. The audio element is assigned the source and media events update loading, readiness, duration and playing state.
6. Near the last ten seconds, the next item can be resolved/preloaded to reduce transition latency.
7. On source failure the reference attempts recovery: refresh the URL, try another configured source where applicable, advance or surface an error according to context. Loading timeouts are also treated as failures.
8. Position is periodically persisted (approximately every two seconds), then restored according to the reference startup/resume rules.

Important parity details:

- A URL being returned does not mean playback succeeded; only media readiness/events close the operation.
- Buffering recovery may seek forward in a stalled range. Preserve the observed threshold/behavior as a test fixture rather than casually redesigning it.
- A track switch is cancellation-sensitive. Late URL and metadata results must not overwrite a newer current track.
- Preload is advisory and must not mutate visible current-track state.
- Local paths, `file:` URLs, online URLs and the Bilibili loopback proxy have different lifetime/security rules.

## 4. Media events

The native backend adapter must expose at least: opening/loading, ready, playing, paused, progress/time changed, duration changed, buffering/stalled, ended and failed. These feed a single `PlaybackSession`; views must not subscribe directly to platform objects.

| Reference event/result | State transition / side effect |
|---|---|
| metadata/duration ready | update duration and seek bounds; initialize system metadata |
| play/playing | clear pending pause, set playing, start progress and lyric clock |
| pause | set paused without discarding the selected item |
| time update | update position, lyric line/word and periodic persistence |
| waiting/stalled | set buffering; start recovery/timeout policy |
| ended | apply playback mode and choose next item |
| error | capture current attempt, invalidate/refresh URL where allowed, then retry/fallback/report |

## 5. Local media

### Discovery

Folder selection is performed through Main IPC, but recursive enumeration currently occurs in the Renderer using Node filesystem access (`src/renderer/utils/localMusic.ts`). Results are ingested in batches of roughly 200. The scan recognizes six filename extensions, while metadata tooling recognizes a wider set. There is no persistent filesystem watcher: refresh is explicit/rescan based.

The Native product decision is to expand scanning and centralize both lists in one `MediaFormatRegistry`. The following discrepancy remains part of the legacy baseline, while the Native scanner initially targets at least the full current metadata set:

- Scan set observed in the library scanner: `mp3`, `flac`, `ogg`, `oga`, `wav`, `m4a`.
- Metadata module and initial Native scan target: `mp3`, `flac`, `m4a`, `mp4`, `aac`, `ogg`, `oga`, `opus`, `wav`, `ape`, `wv`, `aiff`, `aif`, `tta`, `wma`.

Discovery does not guarantee decoder support. The format corpus must independently verify metadata read/write and playback; an indexed but unsupported file receives a visible capability/error state instead of being silently omitted.

Track identity is derived rather than being the absolute path alone. Duplicate handling therefore depends on the generated ID/list semantics and must be tested for same metadata in different folders, renamed files, rescans and case-only path changes.

### Metadata and artwork

`src/main/modules/localMusicTools/metadata.ts` uses `taglib-wasm` and `node-id3`. It reads common tags, duration/technical properties, embedded artwork and embedded lyrics. Metadata writes use a defensive copy/write/verify/rename flow with rollback rather than editing the only copy in place.

Artwork is cached as a temporary file whose key includes path/file attributes. Online covers use the source/network cache path. Native targets:

- Tag reading/writing behind `IMediaMetadataService`; choose a maintained .NET library only after format/write-fidelity tests.
- Atomic replacement with original-file backup/rollback semantics.
- Thumbnail/cover cache with content/version key and bounded eviction.
- Do not decode large embedded images on the UI thread.

### Library index

Local tracks live in the special list `userlist_local_music` in the same SQLite list/song model used by user lists. Folder choices are persisted separately in renderer local storage. Search and view filtering are renderer operations over loaded/indexed data; refresh mutates the list database and emits list changes.

## 6. Lyrics as media-timed data

Lyrics can come from source adapters, Bilibili/local matching, the lyric database, a sidecar/download, or embedded tags. The parser supports line timing, word timing, translations and romanization/kana-like alternate text when supplied. `lyric-font-player` performs per-word timing/animation; `core/lyric.ts` connects it to player time. See `state-map.md` and `graphics-map.md` for ownership and rendering.

Native separation:

```text
ILyricProvider(s) -> LyricMatchService -> parsed LyricDocument
  -> LyricTimeline (pure timing/current-line state)
  -> in-app / immersive lyric presenters
```

Seeking from a lyric line is a player command. Manual lyric scrolling temporarily suppresses automatic centering and must resume according to the same timer/interaction behavior.

## 7. Downloads and conversion

The download worker (`src/renderer/worker/download/*`) performs ranged HTTP transfer, progress reporting, concurrency/retry and URL refresh. Task state is stored in SQLite and mirrored by the renderer download store. After transfer it can write metadata, artwork and lyrics. Bilibili audio commonly arrives as M4A and is converted through a Main-side FFmpeg child process before finalization.

Native decomposition:

- `DownloadCoordinator`: durable task state, scheduling, cancellation and retry.
- `HttpRangeDownloader`: range validation, resume and atomic finalization.
- `MediaPostProcessor`: tags, cover and lyric embedding.
- `IMediaTranscoder`: FFmpeg process boundary only for conversions actually required.

Never expose a partially completed destination as complete. Persist transitions before emitting completion, and make restart recovery deterministic.

## 8. Format and backend validation

Chromium's decoder availability is not a specification. Build a corpus containing every scanned/metadata extension, multiple bit depths/sample rates/channel layouts, large/absent artwork, malformed tags, CBR/VBR duration, Unicode paths and network streams. For each candidate Windows backend record open/play/seek/duration/gapless behavior and error codes.

Recommended initial backend evaluation order:

1. C# Windows media APIs (`MediaPlayer`/`MediaSource`) for basic playback and SMTC integration.
2. `AudioGraph` where the required EQ/effects/routing need graph control.
3. A narrowly scoped FFmpeg fallback for unsupported decode/transcode only if the corpus proves it necessary.
4. C++/WASAPI/DSP only after measured C# or platform-API limitations are documented.

The existing Native Demo contains both `MediaPlayer` and `AudioGraph` experiments. They are evidence that APIs can be initialized, not evidence of behavioral parity.

## 9. Media lifecycle and resource ownership

- One application-scoped playback coordinator owns the current backend and audio endpoint.
- Views acquire subscriptions and release them on navigation; navigating away must not stop playback.
- Every URL resolution, cover read, metadata read and prefetch carries cancellation linked to the track generation.
- Audio device changes, suspend/resume and session interruptions are explicit platform events.
- Shutdown flushes position/queue/settings and download checkpoints with a bounded timeout.
- Decoder/effect failures are typed and logged with track/source/backend context, without logging cookies or signed URLs.

## 10. Principal migration risks

1. Decoder/seek/duration parity across the actual local format corpus.
2. Reproducing the Web Audio EQ, pitch and convolution behavior without excessive CPU or latency.
3. Cancellation correctness during rapid switching and stale network URL responses.
4. Durable range-download recovery and FFmpeg post-processing.
5. Retaining exact queue/retry/preload semantics while replacing a browser event model.

## 11. Native Slice 1 media boundary implemented

Slice 1 does not initialize any playback backend. It materializes local tracks from `userlist_local_music` through `SqliteLegacyLibraryReader`, parses the legacy `meta` JSON and reports file availability without opening media streams.

`WindowsArtworkCache` checks same-basename JPG/PNG artwork before requesting a Windows `MusicView` thumbnail. Cache keys include media path/size/mtime and, for sidecars, sidecar path/size/mtime. Derived files live only under `%LOCALAPPDATA%\LX-TA\NativeDev\Cache\Artwork`; failures degrade to an initial-letter tile and cannot fail the library load. Metadata writing, scanning and decoder support remain unimplemented.
