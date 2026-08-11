# 重要文件到功能映射

这不是目录清单；每项说明“属于什么功能、谁调用它、它调用什么、Native 对应边界”。同一功能下的纯模板/图标/声明文件不逐个重复，但 `src/main`、三个共享目录、构建配置和主要 Renderer 子系统均已递归纳入分析。

## Main 与共享模块

| Legacy file/group | Feature | Called by | Calls / side effects | Native target |
|---|---|---|---|---|
| `src/main/index.ts` | startup | Electron executable | global init、single instance、protocol、app listeners、`init()` | `LXTA.App` bootstrap + activation service |
| `src/main/app.ts` | lifecycle/global | main entry | userData、GPU/proxy switches、app/screen/nativeTheme events | App lifetime coordinator；禁止 global mutable bag |
| `src/main/event/{App,List,Dislike}Event.ts` | cross-module events | Main modules, sync, DB handlers | EventEmitter 广播 | typed application event contracts |
| `src/main/modules/index.ts` | module composition | main `init()` | 注册窗口/托盘/热键/Bili/sync/OpenAPI | DI composition root |
| `src/main/modules/winMain/main.ts` | main window | module init/app events | BrowserWindow、session、thumbar、bounds | `WindowManager` in Platform.Windows |
| `src/main/modules/winMain/rendererEvent/*.ts` | IPC façade | Renderer wrappers | app/data/download/music/openAPI/sync/userApi services | 删除 IPC；由 application interfaces 直接调用 |
| `src/main/modules/winMain/autoUpdate.ts` | update legacy reference | winMain init | electron-updater + renderer events | deferred until explicit public-distribution request |
| `src/main/modules/tray.ts` | tray | app_inited/settings/player events | native tray/menu actions | `ITrayService` / H.NotifyIcon or Win32 wrapper |
| `src/main/modules/appMenu.ts` | app menu | app_inited | macOS menu | Windows Native 可不迁 macOS 菜单；行为矩阵保留 |
| `src/main/modules/hotKey/**` | global shortcuts | init, setting IPC | Electron globalShortcut -> app event | Win32 `RegisterHotKey`, scoped service |
| `src/main/modules/commonRenderers/**` | settings/list/dislike | module init | DB worker + all-window broadcast | settings/list/dislike repositories and event stream |
| `src/main/worker/index.ts` | DB worker | `initAppSetting` | worker_threads/Comlink | ordinary async repository; dedicated serial scheduler if needed |
| `src/main/worker/dbService/db.ts` | SQLite lifecycle | worker init | open WAL、pragma optimize/vacuum | `SqliteConnectionFactory` + migration/health check |
| `src/main/worker/dbService/tables.ts` | schema v2 | create/verify/migrate | 9 table + 3 index definitions | versioned SQL migrations + compatibility tests |
| `src/main/worker/dbService/modules/**` | persistence | Main event handlers, sync | list/dislike/download/lyrics/URL/other-source CRUD | per-aggregate repositories in Storage |
| `src/main/modules/localMusicTools/metadata.ts` | metadata editing | music IPC | TagLib WASM、copy/verify/rename/rollback | `IMediaTagService`; C# tag library + transactional file replace |
| `src/main/modules/bili/{index,api,request,wbi,cookie,proxy}.ts` | Bilibili | IPC + startup | fetch/WBI/cookies/local token proxy | Bili adapter, session store, loopback media proxy |
| `src/main/modules/openApi/index.ts` | optional OpenAPI legacy reference | setting init | HTTP/SSE, renderer action bridge | optional final module only; may have no Native target |
| `src/main/modules/sync/**` | sync | setting/IPC/list events | HTTP/WS/crypto/snapshots/device auth | isolated Sync project/module with protocol fixtures |
| `src/main/modules/userApi/**` | custom source | setting/renderer IPC | hidden BrowserWindow/preload/needle/script lifecycle | compatibility runtime spike; C# host, no Node/WebView |
| `src/main/modules/winLyric/**` | desktop lyric legacy reference | setting/app events | transparent BrowserWindow, MessageChannel | no Native implementation; import ignores legacy window settings |
| `src/main/utils/store.ts` | JSON persistence | settings/theme/data/hotkey | temp write + rename | atomic JSON store with schema/version |
| `src/main/utils/{request,fontManage,migrate,logInit}.ts` | infra | multiple Main modules | HTTP proxy、fonts、legacy migration、logs | Network/Storage/Platform utilities behind interfaces |
| `src/common/ipcNames.ts` | IPC contract | all processes | centralized channel names | migration audit only; no Native runtime equivalent |
| `src/common/{mainIpc,rendererIpc}.ts` | IPC wrapper | handlers/callers | send/on/handle/invoke envelope | delete after parity; replace with typed services |
| `src/common/defaultSetting.ts` | settings schema | Main + both renderers | 152 default keys | versioned `AppSettings` records grouped by feature |
| `src/common/config.ts`, `constants*.ts`, `defaultHotKey.ts` | shared policy | app/player/sync/UI | IDs、quality/status/window sizes | Domain constants/value objects |
| `src/common/types/*.d.ts` | contracts | TS compile | music/list/player/sync/Bili/etc shapes | Domain/Application C# records; do not mirror IPC envelopes |
| `src/common/utils/lyric-font-player/**` | lyric parser/player | both lyric UIs | DOM/WAAPI word timing | Media lyric parser + Composition lyric presenter |
| `src/common/utils/download/**` | download transport | download worker | HTTP range/write queue/retry | resilient streaming download engine |
| `src/common/utils/musicMeta/**` | download metadata | download worker | MP3/FLAC tag editing/network cover | consolidate into `IMediaTagService` |
| `src/common/theme/**` | themes | renderer/Main | color generation and built-in assets | App theme resources + theme serializer |

## Main Renderer

| Legacy file/group | Feature | Called by | Calls / side effects | Native target |
|---|---|---|---|---|
| `src/renderer/main.ts` | renderer bootstrap | Webpack entry | setting/lang/router/Vue mount/startup log | WinUI App/shell initialization |
| `src/renderer/App.vue` | root layout | Vue mount | Aside/Toolbar/View/PlayBar/PlayDetail/modals | `ShellPage` + overlay coordinator |
| `src/renderer/router.ts` | navigation | root/View | lazy route imports/hash history | WinUI NavigationView/Frame route service |
| `src/renderer/core/useApp/**` | application orchestration | App setup | data/list/player/sync/OpenAPI/update/deeplink | small startup use cases, not one god service |
| `src/renderer/utils/ipc.ts` | renderer façade | stores/views/core | every Main IPC call/listener | source of interface discovery; delete in Native |
| `src/renderer/event/**` | UI/player event hub | components/core/Main action listener | keyboard/media/player/global app events | typed commands + state notifications |
| `src/renderer/store/index.ts` | global state | whole renderer | proxy/sync/update/theme/userApi/fullscreen | feature stores/application state aggregator |
| `src/renderer/store/setting.ts` | settings state | views/core | merge/save setting, force desktop lyric disabled | `ISettingsStore` immutable snapshots |
| `src/renderer/store/list/**` | library/list state | list/local/player/sync | IPC CRUD, reactive caches, ordering | Library application store + repositories |
| `src/renderer/store/player/**` | player state | player core/UI/lyrics | reactive current media/progress/queue | `PlaybackSessionState` single owner |
| `src/renderer/store/search/**` | search | Search views | source SDK calls, aggregation/sorting | Search use case + cancellable source adapters |
| `src/renderer/store/{songList,leaderboard}/**` | discovery | views/list sync | cache SDK pages | Discovery services/stores |
| `src/renderer/store/download/**` | download coordinator | Download views/list actions | worker callbacks + DB IPC | Download manager with persisted task state machine |
| `src/renderer/core/player/**` | playback state machine | UI/app events | queue, URL, media backend, recovery, preload | Media/Application playback coordinator |
| `src/renderer/plugins/player/index.ts` | audio backend | player core/sound UI | HTMLAudio + WebAudio graph + MediaSession | `IPlaybackEngine`; C# MediaPlayer/AudioGraph first |
| `src/renderer/core/music/{index,online,local,download,utils}.ts` | media resolution | player/download/UI | URL/pic/lyric caches and source fallback | `IMediaResolver` strategies by track kind |
| `src/renderer/core/lyric.ts` | lyric clock | player events | parser、current line、desktop channel | `LyricTimelineController` |
| `src/renderer/utils/compositions/useLyric.js` | lyric UI interaction | `LyricPlayer.vue` | DOM creation/scroll/manual seek | XAML virtualized lyric view + Composition scroll controller |
| `src/renderer/utils/localMusic.ts` | local library | settings/local views | Node recursive scan、list DB、group caches | Local library scanner/indexer + grouping query services |
| `src/renderer/services/localLyrics/**` | lyric matching | local modals | multi-provider search/rank/embed | Lyric match use case + provider adapters |
| `src/renderer/worker/main/**` | CPU/FS helper | Renderer proxy | list filtering, metadata/pic/lyrics, export | background services/task scheduler |
| `src/renderer/worker/download/**` | downloads | download store | range downloader、filesystem、FFmpeg、metadata | Media download engine; FFmpeg process only where needed |
| `src/renderer/views/Search/**` | search UI | router | search stores/online list | `SearchPage` + VM |
| `src/renderer/views/songList/**` | song lists | router | songList store/SDK | `SongListsPage/DetailPage` + VMs |
| `src/renderer/views/Leaderboard/**` | leaderboard | router | leaderboard store/SDK | `LeaderboardPage` + VM; restore intentional navigation decision |
| `src/renderer/views/List/**` | personal library | router | list stores/player/download/backup/share | `LibraryPage` vertical slice |
| `src/renderer/views/LocalMusic/**` | local albums/artists/tracks | router | local utils, list DB, covers, spatial canvas | LocalLibrary pages; Composition only for spatial/card motion |
| `src/renderer/components/localMusic/**` | local actions/editing | LocalMusic views | metadata/lyrics IPC and list updates | dialogs + edit/match VMs |
| `src/renderer/views/Download/**` | downloads UI | router | download store | `DownloadsPage` + VM |
| `src/renderer/views/Setting/**` | settings/infra UI | router | nearly all settings/services | feature-specific settings sections, not one VM |
| `src/renderer/components/layout/Aside/**` | nav/now-playing | App | router, list, animated pill | shell navigation + Composition indicator |
| `src/renderer/components/layout/Toolbar/**` | search/window controls | App | route/search/window IPC | custom title bar + search command |
| `src/renderer/components/layout/PlayBar/**` | compact/floating player | App | player controls/progress/UI localStorage | reusable NowPlaying control |
| `src/renderer/components/layout/PlayDetail/index.vue` | player detail | App | artwork colors, WAAPI transition, blur/record | Detail page + connected Composition transition |
| `PlayDetail/LyricPlayer.vue` | lyric display | detail | lyric store/useLyric/menu | lyric presenter control |
| `PlayDetail/ImmersiveLyrics.vue` | immersive shell/MV | detail | Folia, Bili, player, controls | immersive page coordinator |
| `PlayDetail/FoliaVisualizerBridge.tsx` | React island | ImmersiveLyrics | React root, Framer Motion, analyser/seek | remove bridge; native effect interface |
| `src/renderer/vendor/folia/components/visualizer/**` | ten effects | React bridge lazy map | DOM/canvas/Framer; Diorama adds R3F/Three | ten effect specs; mostly XAML/Composition/Win2D |
| `PlayDetail/FluidBackground.vue`, `auraBackground/**` | Aura | detail/immersive | OffscreenCanvas WebGL worker/GLSL | D3D/HLSL candidate only if pixel parity required |
| `src/renderer/assets/styles/**` | global visual language | all SFCs | tokens, reset, transitions, animate.css | early XAML resources + Composition motion tokens; 120 Hz gate from Slice 1 |

## Desktop lyric, language, build, Native Demo

| Legacy file/group | Feature | Called by | Calls / side effects | Native target |
|---|---|---|---|---|
| `src/renderer-lyric/main.ts`, `App.vue` | lyric window bootstrap legacy reference | winLyric BrowserWindow | setting/channel/Vue mount | no Native target; feature explicitly canceled |
| `renderer-lyric/core/{mainWindowChannel,lyric}.ts` | lyric transport/clock | lyric App | MessagePort, shared parser | direct injected playback/lyric state service |
| `renderer-lyric/components/layout/**` | desktop lyric UI legacy reference | App | DOM scroll/drag/controls | no Native target; feature explicitly canceled |
| `renderer-lyric/useApp/**` | desktop lyric window behavior legacy reference | App | bounds/hover/pause/theme watchers | no Native target; feature explicitly canceled |
| `src/lang/{index,i18n,*.json}` | localization | all UI/tray | static message map | `.resw` resources + localization service |
| `build-config/main/**` | Main build | npm scripts | electron-main Webpack | obsolete after cutover |
| `build-config/renderer*/**` | render builds | npm scripts | Vue/React/workers/assets/native modules | obsolete; behavior remains reference |
| `build-config/webpack-build-config.js` | package orchestration legacy reference | npm | build all bundles | ordinary local `dotnet build` Debug/Release workflow |
| `package.json` | dependency/build/package manifest | npm/electron-builder | Electron/Webpack/native addon/FFmpeg versions | Native `.csproj`/central package versions; no packaging project in current scope |
| `native/LXTA.Native/*Page*` | Demo shell | WinUI App | monolithic XAML/code-behind | discard UI architecture; screenshots are source of truth |
| `native/LXTA.Native/Services/*` | Demo services | static `NativeAppServices` | direct DB/network/filesystem/audio/platform calls | selectively salvage spikes; re-home behind interfaces |
| `native/LXTA.Native/Services/PlayerService.cs` | Demo AudioGraph spike | MainPage VM | AudioGraph/MediaPlayer/DSP/FFT | retain as research, rewrite against playback contract |
| `native/LXTA.Native/Services/UserApiService.cs` | Demo user source | static locator | launches Node process | remove; violates approved stack |
| `native/LXTA.Native/LXTA.Native.csproj` | Demo build | dotnet | WinUI/WASDK/SQLite/H.NotifyIcon/MSIX tooling | research reference only; new solution uses unpackaged framework-dependent x64 local builds |

## Active Native Slice 1 files

| Native file/group | Feature | Called by | Calls / side effects | Boundary |
|---|---|---|---|---|
| `native/src/LXTA.App/App.xaml.cs` | composition root/startup | WinUI runtime | DI registration, main window creation, local crash log | App only |
| `native/src/LXTA.App/MainWindow.xaml(.cs)` | shell/local library UI | App | title bar, navigation, theme, virtualization, Composition transition | View -> ViewModel |
| `native/src/LXTA.App/ViewModels/LocalLibraryViewModel.cs` | Slice 1 UI state | MainWindow | cancellable query, grouping, artwork requests | App -> Application ports |
| `native/src/LXTA.Application/Library/*` | read/query/group use case | ViewModel/tests | pure filtering/sorting/grouping | no WinUI/SQLite |
| `native/src/LXTA.Domain/Library/*` | immutable library models | Application/infra/App projection | no side effects | Domain |
| `native/src/LXTA.Storage/Legacy/SqliteLegacyLibraryReader.cs` | legacy library adapter | LocalLibraryService | SQLite read-only query, meta JSON parsing, file-exists projection | Storage implements port |
| `native/src/LXTA.Platform.Windows/Paths/WindowsAppPaths.cs` | profile paths | DI/infra | resolves legacy DB; creates isolated cache root | Windows platform |
| `native/src/LXTA.Platform.Windows/Artwork/WindowsArtworkCache.cs` | artwork cache | ViewModel | sidecar/thumbnail read; isolated cache write | Windows platform |
| `native/tests/LXTA.*.Tests/**` | Slice 1 regression | `dotnet test` | pure 50k fixture and temp SQLite fixture | no production profile writes |
