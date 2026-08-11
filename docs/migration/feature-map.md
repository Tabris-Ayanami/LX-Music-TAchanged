# Feature Map

本表按用户可观察行为组织，不按文件逐个翻译。`IPC/DB/FS/Network/Platform` 中的“无”表示已追踪到该层没有直接依赖，不代表其上游依赖为无。

| 功能 | 用户行为与入口 | Legacy sources / dependencies | State | IPC / DB / FS / Network / Platform |
|---|---|---|---|---|
| Application startup | 启动、隐藏启动、deeplink、第二实例唤醒、恢复上次页面/播放 | `src/main/index.ts`, `app.ts`, `modules/index.ts`; `renderer/main.ts`, `core/useApp/*` | env params、setting、lastStartInfo、viewPrevState、playInfo | common env/deeplink/setting；JSON Store、SQLite；Electron app/protocol/single-instance |
| Main window | 显示/隐藏、最小化/最大化/全屏、透明、尺寸、关闭到托盘 | `modules/winMain/main.ts`, `rendererEvent/app.ts`; Toolbar/PlayDetail controls | fullscreen、windowSize、theme、tray flag | winMain window IPC；Electron BrowserWindow/AppWindow；窗口 bounds 持久设置 |
| Sidebar/navigation | 搜索、歌单、下载、本地歌曲/专辑/歌手、我的列表；折叠侧栏 | `router.ts`, `components/layout/Aside/*`, `View.vue` | route、viewPrevState、`lx_sidebar_collapsed` | data JSON + localStorage；当前排行榜 route 无侧栏入口 |
| Search | 热搜/历史、单源或聚合搜歌曲/歌单、分页、来源切换 | `views/Search/**`, `store/search/**`, `store/hotSearch.ts`, `utils/musicSdk/**` | searchText/history/listInfos/maxPages/source | data JSON；Node request；kw/kg/tx/wy/mg/bili 等公网 API |
| Online source SDK | 各来源搜索、URL、封面、歌词、评论、榜单、歌单 | `utils/musicSdk/{kw,kg,tx,wy,mg,bd,bili}/**`, `core/apiSource.ts` | apiSource、qualityList、请求对象/取消句柄 | custom-source IPC；缓存 DB；HTTP/HTTPS、proxy |
| Bilibili account | 粘贴 cookie、查询账号、退出；重启保留会话 | `SettingAccount.vue`; `main/modules/bili/cookie.ts`, `api.ts` | account info、setting cookie、Electron session cookie jar | `bili_account_*`；config JSON + session partition；Bili nav/cookie API |
| Bilibili music/video | B站搜索、分页音频、音质、封面、播放 URL、MV 背景 | `musicSdk/bili/**`, `main/modules/bili/**`, `ImmersiveLyrics.vue` | Bili track/candidate、runtime token、MV status | 全部 bili IPC；Main 本地 token proxy；Bili WBI/playurl/view |
| Leaderboard | 来源榜单、榜单歌曲、分页、收藏/播放/下载 | `views/Leaderboard/**`, `store/leaderboard/**` | boards/listDetailInfo/cache/leaderboardSetting | data JSON；musicSdk network；当前路由存在但侧栏不可达 |
| Song lists | 分类/排序/标签、在线歌单、详情、打开链接/分享码、歌单搜索 | `views/songList/**`, `store/songList/**` | tags/listInfo/detail/cache/songListSetting | data JSON；musicSdk/Bili network；外部浏览器 |
| Music library / my lists | 默认、试听、收藏、用户列表；增删改名/拖拽/排序/去重/更新源/分享导入导出 | `views/List/**`, `store/list/**`, `core/list.ts` | userLists、allMusicList cache、scroll/selection/update time | player list IPC；SQLite 3 表；sync list events；文件导入导出 |
| Dislike rules | 编辑规则、过滤不喜欢歌曲、跨设备同步 | `Setting/DislikeListModal.vue`, `core/dislikeList.ts`, `store/dislikeList/**` | rules、解析后的 name/singer set、count | dislike IPC；SQLite `dislike_list`；sync |
| Local folder management | 添加/移除文件夹、手动递归重扫、可选移除条目；Native 扩展扫描格式 | `SettingLocalMusicLibrary.vue`, `utils/localMusic.ts` | localStorage folders、fetching status、track cache | select dialog；Node fs；SQLite list；无 watcher；Native 以统一注册表覆盖当前 15 种 metadata 扩展 |
| Local Music / tracks | 本地歌曲列表、搜索、播放、右键操作 | `views/LocalMusic/index.vue`, `LocalTrackActions.vue`, `MusicList/**` | tracks、keyword、local list cache | list DB IPC；file URL/metadata worker；filesystem |
| Local albums/artists | 按 album+singer 或 singer 分组、carousel/grid/二维行星画布、详情 | `views/LocalMusic/index.vue`, `Detail.vue`, `spatialCanvas.ts`, `utils/localMusic.ts` | groups、cover caches、pan/viewport/selection | 列表 DB、临时封面文件；pointer/ResizeObserver/rAF |
| Metadata editing | 读取/改标题、艺术家、专辑、编号、年份、流派、封面等并安全回写 | `MetadataEditModal.vue`, `main/modules/localMusicTools/metadata.ts` | modal form、loading/saving、updated track | local metadata IPC；TagLib WASM；临时/备份/rename；无网络 |
| Lyrics matching | 查在线候选、评分、自动/手动应用、编辑内嵌歌词 | `LyricsMatchPanel.vue`, `services/localLyrics/**` | candidates/selected/mode/currentLyric | lyric/local embedded IPC；SQLite lyric；音频文件；QQ/网易/酷狗/LRCLIB |
| Player transport | play/pause/stop/seek、duration、rate、volume/mute、设备 | `core/player/**`, `plugins/player/**`, `store/player/**`, PlayBar | playMusicInfo、isPlay、progress、volume、rate、media device | player status/action IPC；HTMLAudio/WebAudio/MediaSession；settings/data JSON |
| Queue and modes | 上/下一首、列表/随机/顺序/单曲/不循环、临时稍后播放、播放历史 | `src/renderer/core/player/action.ts`, `src/renderer/core/player/utils.ts`, `src/renderer/store/player/action.ts`, `src/renderer/store/player/state.ts`, queue UI | playInfo、playedList、tempPlayList、mode | list IPC/SQLite；tray/hotkey/taskbar/OpenAPI actions |
| URL resolution/source switching | 解析质量 URL、缓存、备用来源、刷新过期链接 | `core/music/{online,local,download}.ts`, `core/music/utils.ts`, `core/apiSource.ts` | toggleMusicInfo、quality、retry/preload state | music URL/other-source DB IPC；user API/music SDK/Bili network |
| Playback recovery/preload | 超时、buffering 前跳、错误换 URL/跳歌、尾部预加载下一首 | `core/player/action.ts`, `plugins/player/index.ts` | retry counters、25/100s timers、preload audio | network + HTML media events；副作用为 seek/next |
| Audio effects | 10 段 EQ、卷积、pitch、panner、音量增益、设备输出、频谱 | `plugins/player/index.ts`, `components/common/SoundEffectBtn/**`, AudioWorklet | presets、filter gains、convolution、pitch/panner | sound preset IPC/JSON；WebAudio/AudioWorklet；impulse assets |
| Standard play detail | 封面/唱片、背景模糊、歌词、评论、控制栏、开关详情 | `components/layout/PlayDetail/index.vue`, `LyricPlayer.vue`, `PlayBar.vue` | show detail/comment/lyric selection、extracted colors | comments/lyrics/music state；canvas color extraction；WAAPI/CSS |
| Immersive player | 10 种歌词效果、音频可视化、Aura/blur/MV 背景、自动隐藏控件 | `ImmersiveLyrics.vue`, `Folia*`, `FluidBackground.vue`, `vendor/folia/**` | effect/background/visualizer settings、Folia MotionValues | Bili MV/lyrics IPC；WebGL worker、React/Framer/R3F/Three、WebAudio analyser |
| Motion system / 120 Hz | 页面/面板切换、hover/press、列表滚动、封面/歌词过渡、动画中断与 reduced motion | `src/renderer/assets/styles/**`, Vue transitions, Folia/Framer Motion, WAAPI | animation state、scroll/pointer、playback/lyric clock | Native XAML + Composition；120 Hz 目标 8.33 ms/frame；贯穿所有 UI vertical slice |
| Lyrics display | 普通/逐字、翻译、罗马音、当前行、平滑滚动、手动滚动/歌词 seek、offset/编辑/复制 | `core/lyric.ts`, `lyric-font-player/**`, `useLyric.js`, `LyricPlayer.vue` | lrc layers、lines/current line、offset/tempOffset | lyric DB IPC、online/local sources；WAAPI/DOM scroll/clipboard |
| Desktop lyrics（Native 取消） | Legacy 独立透明窗口、横/竖、锁定/置顶、hover/pause 隐藏、频谱 | `main/modules/winLyric/**`, `renderer-lyric/**` | desktopLyric 30 项 setting、music/lyric/isPlay | 仅作 legacy 分析；Native 不创建窗口、不迁移 UI，导入时忽略旧设置 |
| Comments | 查看热门/最新评论、楼中楼 | `MusicComment/**`, source `comment.js`, Bili comment API | page/list/reply/current track | Bili IPC 或 SDK HTTP；无持久 DB |
| Download | 创建质量任务、并发、暂停/继续、断点、重试/刷新 URL、删除/筛选 | `views/Download/**`, `store/download/**`, `worker/download/**` | reactive list、running map、worker task map、progress/status | download DB IPC；SQLite；Node downloader/filesystem；proxy |
| Download post-processing | Bili m4a 转 MP3/FLAC/WAV、写标签/封面/歌词、旁车 LRC | `worker/download/utils.ts`, `common/utils/musicMeta/**`, `store/download/action.ts` | task metadata/format/embed settings | FFmpeg child process；file writes；metadata/cover/lyric network |
| Settings | 基本、外观、播放、详情、下载、搜索、网络、账号、本地库、同步、OpenAPI、热键、其他、关于 | `views/Setting/index.vue`, `components/Setting*.vue`, `defaultSetting.ts` | 152 个默认 setting key（按前缀分组） | common setting IPC；config JSON；多个平台/网络服务 |
| Themes | 内置/自定义主题、编辑色值/背景、跟随系统、shell 独立明暗 | `common/theme/**`, `store/utils.ts`, ThemeSelector/Edit | themeInfo/themeId/system/shell dark | theme IPC + theme JSON；nativeTheme event；背景 assets |
| Localization | 简中/繁中/英文、自动语言、托盘/主窗口/歌词共享翻译 | `src/lang/**`, renderer i18n, tray | langId/message tables | config setting；Electron app locale；无网络 |
| Global shortcuts | 启用/禁用、编辑组合、冲突状态、播放/音量/收藏/窗口动作 | `main/modules/hotKey/**`, `SettingHotKey.vue` | hotkey config/state | hotKey/winMain key IPC；Electron globalShortcut；hot_key.json |
| Tray/taskbar/media keys | 托盘控制、Windows thumbar、系统媒体键/MediaSession | `tray.ts`, `winMain/main.ts`, `plugins/player/index.ts` | player status、button flags、tray config | player status/action IPC；Electron Tray/nativeImage/Thumbar/Web MediaSession |
| OpenAPI（最后可选，可不迁移） | 其他程序通过 HTTP 获取状态/歌词，控制播放、seek、收藏、音量，并通过 SSE 订阅事件 | `main/modules/openApi/index.ts`, `useOpenAPI.ts`, SettingOpenAPI | address/status、player status subscribers | 仅保留 legacy 分析；不属于 Native 完成条件，若最终实现则排在全部核心功能之后 |
| Sync | server/client、授权码、设备管理、list/dislike 快照与增量合并 | `main/modules/sync/**`, SettingSync, Sync modals | mode/status/device/auth/snapshots/RPC queues | sync IPC；SQLite/FS；HTTP/WebSocket；RSA/AES/gzip |
| Custom user API（核心功能） | 导入/删除/选择/更新提示、自定义音源请求与取消；优先兼容现有脚本 | `main/modules/userApi/**`, UserApi modals, `core/apiSource.ts` | userApi list/status/apis/request queue | userApi IPC + hidden renderer internal IPC；user_api.json；network/proxy；Native 托管 JS 兼容宿主，禁止 Node/WebView |
| Backup/import/export | 全量/设置/列表导入导出、旧格式迁移、TXT/CSV 导出 | `SettingBackup.vue`, `worker/main/list.ts`, migrate helpers | dialog/import state、list/settings snapshot | save/open dialog；filesystem；list/setting IPC；SQLite |
| Sleep timer | 定时停止、等当前曲结束再停 | `core/player/timeoutStop.ts`, `PlayTimeoutModal.vue` | timer/end flag/remaining time | player action；setting；无 DB/network |
| Cache management | 查看/清理 Electron session cache、歌词/URL/其他源计数与清理 | Settings + `utils/ipc.ts`, Main app/music handlers | counts/status | cache/music DB IPC；Electron session cache；SQLite |
| Update/changelog（Native 延后） | Electron 自动/手动检查、下载进度、忽略版本、安装重启、变更日志 | `winMain/autoUpdate.ts`, `useUpdate.ts`, Update/ChangeLog modals | versionInfo/ignoreVersion/failure tips | 当前只作 legacy 分析；Native 个人开发阶段不实现自动更新/安装，公开发行时再规划 |
| First-run pact | 显示/接受协议后启用应用 | `PactModal.vue`, `store/setting.ts` | `common.isAgreePact` | setting IPC/config JSON |

## 覆盖核对

用户指定的 startup、main window、sidebar、search、local/library、metadata、lyrics match、player/queue/immersive、lyrics/desktop lyrics、download、leaderboard/song lists、settings/themes、Bilibili/cookie、comments、OpenAPI、sync、User API、tray/hotkeys/window state、database/cache/network/workers/FFmpeg、React/Vue/Three/R3F/Framer、localization、packaging/update 均已入表。额外加入 dislike、备份、sleep timer、first-run pact、source switching 与播放恢复。
