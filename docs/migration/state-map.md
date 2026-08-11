# State Map

## 1. State ownership today

当前没有统一 store。状态分布在 Main `global.lx`、Renderer 模块级 Vue refs/reactive、普通 JS Map/Set/计时器、WebAudio/HTMLAudio 对象、SQLite、JSON Store、localStorage、Electron session 与 worker 内存中。

| State domain | In-memory owner | Persistent owner | Readers / writers | Sync mechanism |
|---|---|---|---|---|
| App/env/lifecycle | `global.lx.envParams`, app EventEmitter | command line/OS | Main writes; Renderer reads | IPC query + deeplink push |
| Settings | `global.lx.appSetting`; Renderer `appSetting` | `config_v2.json` | Renderer optimistic merge; Main persists/broadcasts | common setting invoke + config push |
| Theme | Main global theme; Renderer theme refs | built-in assets + `theme.json` + setting IDs | theme editor/Main/nativeTheme | IPC push + CSS variables |
| Window/UI | Renderer route/fullscreen/sidebar/floating island/modals | `data.json`, localStorage, config setting | shell/components | router/watchers/IPC |
| Library lists | Main DB; Renderer `userLists`, `allMusicList` Map | SQLite | views/player/sync/backup | invoke -> DB event -> broadcast replay |
| Dislike | Renderer sets/rules; Main DB | SQLite | player/list/settings/sync | same invoke/broadcast pattern |
| Player session | Renderer player store + core timers/audio object | `data.json` playInfo + settings | player core/UI/platform bridges | app_event + IPC status |
| Lyrics | Renderer musicInfo + lyric reactive state + parser clock | SQLite raw/edited + local tags | player/detail/desktop lyric | player events + MessagePort |
| Downloads | Renderer list/maps + worker task maps | SQLite download_list + files | download view/worker | worker callback + throttled IPC writes |
| Network source | SDK module request objects; userApi state; Main Bili state | settings/user_api/cookies/caches | search/player/download | promises/cancel functions/IPC |
| Sync | Main server/client objects + Renderer status | `sync/**`, SQLite | settings/list/dislike | IPC status + EventEmitter + WS |
| Update | Renderer `versionInfo`; Main updater | data ignoreVersion + localStorage tip flags | update UI/Main updater | update push events |

## 2. Settings state

`src/common/defaultSetting.ts` 定义 152 个默认键，按前缀计数：account 4、common 15、desktopLyric 30、download 17、list 5、localMusic 2、network 3、odc 2、openAPI 3、playDetail 17、player 41、search 3、sync 5、theme 3、tray 2。

Flow:

```text
UI updateSetting(partial)
 -> Renderer Object.assign(appSetting)       (optimistic)
 -> common_set_app_setting invoke
 -> Main merge/migrate/atomic JSON save
 -> app setting EventEmitter
 -> services reconfigure + winMain/winLyric config push
 -> Renderer mergeSetting(partial)           (authoritative echo)
```

Desktop lyric is special: both Main config and Renderer setting module force `desktopLyric.enable=false` because `isDesktopLyricDisabled=true`. The Native product explicitly cancels this feature; legacy desktop-lyric keys are recognized only so import can ignore them safely.

Native target: one versioned `AppSettingsSnapshot` split into feature records; commands validate and persist before publishing a new immutable snapshot. Window-only ephemeral state must not be mixed into settings.

## 3. Global Renderer application state

- `store/index.ts`: selected API source, proxy/env proxy, sync server/client status, OpenAPI address/message, window size, agreement modal, update state, user API list/status, fullscreen, system/shell theme, quality list and theme catalog.
- `store/ui.ts`: side rail collapsed and floating island compact, directly persisted to localStorage.
- Router + `utils/data.ts`: previous route and feature-specific page preferences in `data.json`.
- `window.lxData` exposes selected store objects to legacy/global helpers; `window.app_event` is the shared event hub.

Native target: `ShellState`, `ConnectivityState`, `UpdateState` and feature stores, composed read-only for the UI. No globally writable static state.

## 4. Player state

### 4.1 Reactive fields

| State | Meaning | Writers | Consumers |
|---|---|---|---|
| `musicInfo` | Display model: id/name/singer/album/pic and five lyric layers | player action/resolver/lyric editor | PlayBar, detail, MediaSession, desktop lyric |
| `isPlay`, `status`, `statusText` | transport/UI status | HTML media events/player core | all player controls, tray/OpenAPI status |
| `playMusicInfo` | current listId, Track, temp flag | queue/selection actions | resolver, title, persistence |
| `playInfo` | playerListId, playIndex, playerPlayIndex | queue navigation | next/prev/persistence |
| `playedList` | random history | random policy | prev/random selection |
| `tempPlayList` | “play later” queue | context actions/next | next policy/queue UI |
| `playProgress` | seconds/max/progress | audio events/seek | bars, lyrics, MV sync |
| `volume`, `isMute`, `playbackRate` | audible settings | UI/settings/device | audio backend/platform status |
| show flags | detail/comment/select-content | UI | overlays |

### 4.2 Non-reactive state that is still semantically important

- current HTMLAudio, preload Audio, AudioContext graph and selected output device;
- URL retry counts, error/next/load/preload/buffering timers;
- random cached-next selection and played-history manipulation;
- powerSaveBlocker delayed-release timer;
- MediaSession handlers and media-device change listener.

These must become fields of a single lifetime-scoped `PlaybackCoordinator`, not hidden statics.

### 4.3 Persistence

When enabled, current list/track/index/position is throttled into `data.json.playInfo` about every two seconds and restored during `initData`. Volume/mute/rate/mode/device reside in settings. Queue history and temp queue are not fully durable.

Native target transitions should be explicit: `Idle -> Resolving -> Loading -> Playing/Paused -> Buffering -> Recovering -> Failed/Ended`. Queue selection is a pure policy; transport effects occur only after state transition approval.

## 5. Library and playlist state

- Authoritative data is SQLite.
- Renderer caches list metadata in reactive arrays and song arrays in `allMusicList: Map<listId, MusicInfo[]>`.
- Default/love/temp lists are pinned; at most five ordinary unretained song lists remain cached. retain/touch/release functions control eviction.
- An IPC mutation is handled by Main, committed to DB, then broadcast to every renderer. Renderer list manager applies the broadcast and calls `onListChanged`.
- Scroll position, previous selection and remote-list update time are separate persisted data keys.
- Local library is a normal fixed user list (`userlist_local_music`) plus localStorage folder configuration, not a separate database/index.

Native target: SQLite repository is authoritative; a `LibraryStore` keeps normalized summaries and paged/query results. Every mutation returns a revision and publishes one committed event; initiating UI does not replay the same operation.

## 6. Search, leaderboard and song-list state

- Search keeps global text/history and per-source `listInfos`/`maxPages`; “all” aggregates source promises and sorts locally.
- Hot search lists are memory cached.
- Leaderboard and song list modules each use limited TTL caches (40/60 entries, 30 minutes), selected source/page/detail and separate settings persisted in `data.json`.
- Request cancellation is usually a request-object callback rather than AbortController.

Native target: query objects include source/page/keyword; cancellation uses `CancellationToken`; caches are injected and observable results carry source-specific failure information.

## 7. Lyrics state

| Layer | Fields | Lifetime |
|---|---|---|
| Resolved media lyrics | `lrc`, `tlrc`, `rlrc`, `lxlrc`, `rawlrc` in player display model | current track |
| Parsed timeline | array of line objects, DOM fragments/word animations | lyric content/config change |
| Clock | current text/line, source offset, temporary offset, rate/play state | playback session |
| UI scroll | manual-scroll flag, drag origin, target time, 3s resume timer | lyric control instance |
| Desktop copy | lyric window layers/current line/setting/music info | lyric window lifetime via MessagePort |

Native target separates immutable `LyricDocument`, parsed `LyricTimeline`, playback-derived `LyricCursor`, and per-view `LyricViewportState`. Desktop and main lyrics consume the same cursor; neither owns a second clock.

## 8. Download state

- SQLite stores task identity/status/progress/url/quality/target metadata/order.
- Renderer `downloadList` is the visible mutable state; `runningTask` enforces configured concurrency; batched updates are throttled to Main DB.
- Worker owns Downloader objects, retries, callbacks and copies of tasks. App restart converts RUN/WAITING to PAUSE on load.
- Completion launches metadata and LRC tasks asynchronously, then marks complete; exact post-processing ordering needs tests.

Native target: one durable task aggregate with states `Queued/Resolving/Downloading/Paused/Converting/Tagging/Completed/Failed/Cancelled`; transition and checkpoint persist atomically. UI receives immutable projections.

## 9. Login/session and network state

- Bili raw cookie is in settings; Electron persistent session partition holds individual cookies. Startup may synthesize/refresh buvid and ticket cookies.
- User API scripts and allow-update flags are in `user_api.json`; runtime selection/status/request queue is memory only.
- Proxy consists of user setting plus optional environment proxy; setting changes propagate to session, Node request libraries, Bili and hidden source renderer.
- No credential vault is used.

Native target: sensitive session material goes through `ISecureSessionStore`/PasswordVault or DPAPI-protected storage; network clients come from a factory keyed by proxy/session policy.

## 10. Files and persistence lifecycle

| Key/file | Content | Update trigger |
|---|---|---|
| `config_v2.json` | app setting | any setting mutation |
| `data.json` | route/play/search/list/page/update misc | throttled feature actions |
| `hot_key.json` | hotkey mapping | hotkey editor |
| `theme.json` | user themes | theme CRUD |
| `sound_effect.json` | user EQ/convolution | preset CRUD |
| `user_api.json` | compressed scripts/flags | source CRUD |
| `lx.data.db` | durable business data/caches | list/dislike/lyrics/url/download |
| `sync/**` | auth/devices/snapshots | sync lifecycle/data changes |
| localStorage | seven UI/update/local-library keys | direct component/store writes |

All Native stores need explicit schema version, atomic writes, cancellation behavior and corruption recovery. Data migration is read/validate/write-new/verify; it must not silently claim successful import after a caught parsing exception.

## 11. Native Slice 1 state implemented

`LocalLibraryViewModel` is the sole UI owner for the Slice 1 projection: immutable `allTracks`, current query text, availability filter, sort, current tracks/albums/artists view, selected group, visible tracks/groups, loading/error status and the active cancellable query. A 120 ms cancellation-aware debounce prevents stale search results from replacing newer input.

The authoritative source remains the Electron SQLite file, opened read-only. Native writes only derived artwork and diagnostics under `%LOCALAPPDATA%\LX-TA\NativeDev`; no player, queue, scan, list mutation, settings import, network session or download state exists in the active solution.
