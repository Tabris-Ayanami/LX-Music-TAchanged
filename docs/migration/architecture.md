# Electron 参考实现架构

> 分析基线：`native-rewrite`，2026-08-10。本文描述的是当前 Electron 参考实现，不把既有 `native/` Demo 当作需求来源。仓库实际 Git 根目录为 `F:\player\lx-music-desktop-master\lx-music-desktop-master`，截图位于其同级 `截图反馈/`。
>
> Native implementation update, 2026-08-11: the active `native/LXTA.Native.slnx` contains the minimal Phase 0 + Slice 1 replacement projects under `native/src`. It reads the legacy local-music list through a read-only adapter and writes only an isolated Native cache/log root. The former `native/LXTA.Native/` experiment is not referenced by the solution.

## 1. 运行时总览

应用不是传统的“主进程只承载薄平台层”。它由四类运行上下文组成：

1. Electron Main：生命周期、窗口、托盘、热键、更新、SQLite worker、文件/元数据、Bilibili、OpenAPI、同步、自定义源宿主。
2. Main Renderer：Vue 3 应用，但开启了 `nodeIntegration` 与 `nodeIntegrationInWorker`，直接使用 `node:fs/path/url`、Node HTTP、Web Audio、Web Worker；因此业务、UI、平台边界高度混合。
3. Lyric Renderer：独立 Vue 3 桌面歌词窗口，通过 Electron IPC 建立 `MessageChannelMain` 后与主 Renderer 点对点交换歌词与频谱数据。当前版本运行时强制禁用该窗口，但完整代码仍保留。
4. Workers：Main 中的 `worker_threads + Comlink + better-sqlite3` 数据库 worker；Renderer 中两个带 Node 能力的 Web Worker，分别处理列表/本地媒体辅助工作和下载/FFmpeg。

```text
index.ts -> app.whenReady -> initAppSetting -> modules.init -> app_inited
                                            |-> MainWindow
                                            |-> Tray / HotKey / Update
                                            |-> DB worker (SQLite WAL)
                                            |-> Bilibili proxy/API
                                            |-> OpenAPI HTTP/SSE
                                            |-> Sync HTTP/WebSocket
                                            |-> User API hidden BrowserWindow

Main Renderer (Vue + React island + WebAudio + Node workers)
  <-> typed IPC wrappers <-> Electron Main
  <-> MessagePort <-> Desktop Lyric Renderer (currently disabled)
```

没有 Vite 配置；实际构建器是 Webpack。`build-config/` 分别编译 Main、主 Renderer、歌词 Renderer、User API preload，并由 electron-builder 打 Windows/Linux/macOS 包。

## 2. Application lifecycle

### 2.1 入口与初始化

- `src/main/index.ts` 是生产入口，设置应用名和 Windows AppUserModelId，依次执行全局数据、单实例、命令行环境参数、用户数据目录、协议和 Electron app 事件初始化。
- `app.whenReady()` 后执行 `init()`；Linux 额外延迟 300 ms。`init()` 先读取/迁移设置、热键、主题并启动数据库 worker，再注册全部 Main 模块，最后发出内部 `app_inited`。
- `src/main/index-dev.ts` 是开发入口；Webpack 输出的 `dist/main.js` 是 `package.json.main`。
- 命令行参数可关闭硬件加速、硬件媒体键、GPU sandbox 或窗口动画，并可设置代理、透明窗口等。这些不是普通设置项，Native 需在进程启动前解析。

### 2.2 单实例、协议与启动参数

- `app.requestSingleInstanceLock()` 失败时立即退出。
- 第二实例把命令行中的 `lxmusic:` deeplink 交给首实例；没有 deeplink 时显示主窗口，除非启动参数要求隐藏。
- 注册 `lxmusic` 自定义协议；macOS `open-url` 和 Windows/Linux second-instance 共用 deeplink 流。
- 主 Renderer 启动后通过 `common_get_env_params` 拉取参数，再清除一次性 deeplink；运行期间通过 `common_deeplink` 接收。
- Renderer 内导航采用 hash router。主窗口会阻止非白名单页面在窗口内导航，HTTP(S) 链接改由系统浏览器打开。

### 2.3 用户数据与故障恢复

- 常规数据根为 `%APPDATA%\LX-TA\LxDatas`；Windows portable 包优先使用可执行文件旁 `portable\userData\LxDatas`。
- SQLite 文件为 `lx.data.db`，开启 WAL。若表结构验证失败，会备份数据库及 `-wal/-shm` 后新建，而不是尝试带病运行。
- Renderer 启动异常会把最近日志写入 `localStorage[lx-ta-renderer-startup-log]` 并显示错误页。
- 主进程记录 `did-fail-load`、console 与 `render-process-gone`，但没有自动重建窗口、恢复播放或 crash-loop 防护；Native 需显式设计可恢复边界。

### 2.4 主窗口生命周期

- `src/main/modules/winMain/main.ts` 创建 frameless `BrowserWindow`；透明、固定尺寸、可调整尺寸、全屏能力由设置/环境参数共同决定。
- 安全配置是历史遗留高风险点：`contextIsolation=false`、`webSecurity=false`、`nodeIntegration=true`、`nodeIntegrationInWorker=true`、`sandbox=false`。
- 开发加载 `http://localhost:9080`，生产加载打包 HTML；`ready-to-show` 按 hidden 参数决定显示。
- 关闭事件：若托盘启用且不是明确退出，则隐藏；否则销毁。隐藏时即使托盘设置关闭，也会创建临时托盘以保证可找回窗口。
- 支持 show/hide、minimize/maximize、fullscreen、bounds、ignore-mouse、session proxy/cache、进度条、Windows thumbar 按钮。
- `activate` 会显示或重建窗口；`window-all-closed` 在非 macOS 退出；`before-quit` 设置跳过托盘隐藏逻辑。

### 2.5 更新与退出

- `electron-updater` 负责检查、按需下载、进度事件与 `quitAndInstall`；Windows ARM 被明确判为不支持。
- Renderer 还包含多镜像版本信息查询与失败提示节流。该段是 Electron 当前行为；Native 个人开发阶段明确不实现自动更新，公开发行时再重新设计更新协调器。
- 托盘菜单、窗口按钮、快捷键、OpenAPI、任务栏按钮最终都汇聚为 Renderer 播放动作。退出前需停止同步服务、OpenAPI、下载 worker、数据库 worker和播放资源。

## 3. Main Process 模块

| 模块 | 主要文件 | 责任与副作用 |
|---|---|---|
| App/global | `src/main/app.ts`, `event/*` | 全局设置、主题、播放器状态、窗口工作区、EventEmitter 总线；设置变化向窗口广播。 |
| Main window | `modules/winMain/*` | BrowserWindow、窗口命令、对话框、缓存、更新、任务栏按钮、Renderer IPC 聚合。 |
| Common renderers | `modules/commonRenderers/*` | 设置/环境/主题、列表、dislike 的跨 Renderer IPC 与 DB 事件桥。 |
| Tray | `modules/tray.ts` | 多语言动态菜单、播放/收藏/歌词/显示/退出；监听播放器和主题状态。 |
| App menu | `modules/appMenu.ts` | macOS 原生应用/编辑/窗口菜单；其他平台为空。 |
| Hot keys | `modules/hotKey/*` | Electron `globalShortcut` 注册、冲突状态、热键动作广播。 |
| Database | `worker/dbService/*` | better-sqlite3、WAL、schema v2、CRUD、校验与迁移，独立 worker thread。 |
| Local metadata | `modules/localMusicTools/metadata.ts` | TagLib WASM 读写 metadata、封面、内嵌歌词；临时副本、复读校验、原文件回滚。 |
| Bilibili | `modules/bili/*` | WBI、cookie/session、搜索、音频/视频/图像/字幕、评论、歌单和本地转发代理。 |
| OpenAPI | `modules/openApi/index.ts` | HTTP 控制接口与 SSE 播放状态；可绑定局域网，当前无鉴权。 |
| Sync | `modules/sync/**` | HTTP 握手、WebSocket RPC、RSA/AES、设备授权、快照、增量 list/dislike 同步。 |
| User API | `modules/userApi/**` | 隐藏 BrowserWindow + preload 沙箱宿主，自定义 JS 音源、代理网络请求、超时/取消/更新提示。 |
| Desktop lyric | `modules/winLyric/*` | 透明置顶窗口、锁定/穿透/边界、MessageChannel；当前强制禁用。 |
| Download | Renderer worker + Main DB IPC | 断点下载、并发队列、URL 刷新、Bili 转码、歌词/封面/标签写入。 |

## 4. Renderer 架构

### 4.1 启动和导航

- `src/renderer/main.ts` 先通过 IPC 获取设置，自动选择语言，调整窗口，挂载 Vue 3 和 hash router。
- `src/renderer/core/useApp/*` 初始化主题、代理、窗口状态、列表/收藏、player、sync、OpenAPI、更新、deeplink、用户源和媒体源 SDK。
- 路由为搜索、在线歌单列表/详情、排行榜、我的列表、本地音乐/详情、下载、设置。排行榜路由仍在，但当前侧栏没有入口，需作为“可达性回归”而非删除需求处理。
- 状态不是 Pinia/Vuex，而是大量模块级 `ref/reactive/Map` 加全局 `window.app_event`。持久状态再经 IPC 或 localStorage 写入，形成多源状态。

### 4.2 Vue、React 与 vendor

- 大部分界面是 Vue SFC + Less。
- 沉浸播放器通过 `FoliaVisualizerBridge.tsx` 在 Vue 内创建 React 19 root；10 个 Folia visualizer 使用 Framer Motion。
- 仅 Diorama 效果使用 `@react-three/fiber + Three.js + GLSL ShaderMaterial`；其他九种主要是 DOM/CSS/canvas/motion 编排，不应机械迁为 Direct3D。
- Aura 背景不属于 Three.js：它把 canvas 转为 OffscreenCanvas，在 worker 中执行 WebGL 纹理交叉淡入、Kawase 多通道模糊、噪声 UV 扭曲、旋转/缩放与颜色处理。

### 4.3 主要状态流

```text
用户操作 / tray / hotkey / OpenAPI / media session
 -> app_event 或 Main->Renderer action
 -> player/list/settings action
 -> module-level reactive state
 -> Vue / React island 重新渲染
 -> 节流持久化（IPC->JSON/SQLite）
 -> Main 广播列表/设置变更到全部 Renderer
```

这套事件流允许多个入口复用播放动作，但缺乏单一 reducer/状态机，尤其播放器的计时器、URL 重试、预加载、随机历史、临时队列和持久化相互交织。Native 不应复制 `window.app_event`，应由明确的 application service 和只读 observable state 暴露状态。

## 5. Player 状态流

### 5.1 后端

`src/renderer/plugins/player/index.ts` 以单一 `HTMLAudioElement` 为 transport。首次需要音效时惰性建立：

```text
MediaElementSource -> Analyser -> 10x peaking Biquad
 -> optional AudioWorklet phase-vocoder pitch
 -> dry/convolver -> compressor -> panner -> gain -> destination
```

还支持 `setSinkId`、rate/preservesPitch、音量/静音、最大声道模式、MediaSession metadata/actions。

### 5.2 选曲与队列

- 入口包括列表双击、单曲播放、播放全部、临时“稍后播放”、下载列表、媒体键、托盘/热键/OpenAPI/任务栏按钮。
- `playInfo` 保存当前列表和索引；`playMusicInfo` 保存当前列表/歌曲/是否临时；另有 random 已播历史和高优先级 temp queue。
- 模式为列表循环、随机、顺序、单曲循环、不循环。手动上一/下一在部分模式下会按列表循环处理；自动 ended 严格遵守模式。
- dislike 与无效歌曲会通过 worker 过滤；随机模式维护历史以支持“上一首”和下一首预选。

### 5.3 换歌、URL 与恢复

1. 停止当前媒体并清理旧计时器/预加载。
2. 设置当前歌曲和 UI 初始图，异步并行解析 URL、封面、歌词。
3. URL 优先使用已切换源，再尝试原源；可查 DB 缓存并执行来源切换。请求过密时随机等待 2–6 秒。
4. HTML media error 通常刷新 URL 两次；加载 25 秒未完成先刷新，仍失败跳下一首；总加载超时约 100 秒。
5. buffering 处理每 3 秒尝试小幅前跳，反复失败后跳下一曲——这是需要行为测试固定的非标准语义。
6. 距结束约 10 秒用第二个静音 audio 预加载下一首 metadata；8 秒失败时刷新候选 URL。

`timeupdate/loadeddata/ended/error/waiting/playing` 更新 `playProgress`、标题、歌词时钟、持久播放位置和 powerSaveBlocker。播放状态约每 2 秒保存；power blocker 停播 90 秒后释放。

## 6. Lyrics 数据流

```text
本地嵌入 / lyric(raw) DB / lyric(edited) DB / 在线 SDK / Bili匹配
 -> getLyricInfo + source fallback
 -> player musicInfo(lrc/tlrc/rlrc/lxlrc/rawlrc)
 -> lyric-font-player parser & clock
 -> current line/text reactive state
 -> 主播放详情 + Folia + tray/status lyric + MessagePort desktop lyric
```

- `lyric-font-player` 同时解析 `[mm:ss.xx]` 行时间与 `<start,duration>` 逐字时间，使用 Web Animations API 逐字扫光；播放速率和 offset 会重新校准时钟。
- 翻译和罗马音作为 extended lyrics 合并，顺序可反转；逐字歌词可按设置退化到逐行歌词。
- 普通详情歌词在当前行附近平滑滚动；拖拽/滚轮后暂停自动滚动 3 秒，中线命中歌词可显示目标时间并点击 seek。
- 歌词菜单可编辑歌词与 offset、复制全文；本地匹配会并行 QQ/网易/酷狗/LRCLIB，按标题、歌手、时长打分，高置信候选可自动写入。
- 桌面歌词支持横/竖排、锁定、置顶、hover/pause 隐藏、字体/透明度/阴影/扫光与频谱；当前 `isDesktopLyricDisabled=true` 在 Main 和 Renderer 两侧强制关闭。Native 产品决定为取消该功能：保留本节用于理解 legacy 数据与 IPC，但不迁移窗口、设置或视觉实现。

## 7. Local Music 数据流

1. 设置页调用文件夹选择对话框，路径列表保存在 Renderer localStorage `lx_local_music_library_folders`。
2. Renderer 直接用 `node:fs/promises.readdir` 递归扫描；不可读目录被静默跳过，没有文件监听。
3. 扫描只接纳 `.mp3/.flac/.ogg/.oga/.wav/.m4a`，而元数据读写支持 15 种扩展名；这是 Electron 当前行为差异。Native 已明确批准统一扩展到这 15 种，仍需分别验证标签与播放能力。
4. 每 200 个文件交给 main worker 生成本地 Track，按 music id 去重，写入固定列表 `userlist_local_music` 的 SQLite 表。
5. 重扫会保留不受已管理文件夹覆盖的项目，以本次扫描结果覆盖受管理部分；移除文件夹可选择删除对应条目。
6. UI 从列表 DB 读取，提供歌曲表、专辑/歌手分组、carousel 与可拖拽二维行星画布；封面来自文件 metadata 并有 5 分钟歌曲缓存和 500 项分组封面内存缓存。
7. metadata/封面/内嵌歌词写入使用临时副本、复读校验、rename 备份回滚；写完更新列表和当前播放器状态。

重复定义是“同一批路径大小写归一化去重 + 最终按生成后的 music id 覆盖”；没有内容哈希，也没有文件变化监控。

## 8. Storage 与数据库

| 数据 | 位置 | 读写者 | 生命周期 |
|---|---|---|---|
| 设置 | `LxDatas/config_v2.json` | Main Store；Renderer IPC | 启动迁移/加载，设置变化原子写。 |
| 通用 UI/播放器数据 | `LxDatas/data.json` | Main Store；Renderer `get_data/save_data` | route、playInfo、搜索历史、滚动位置、榜单/歌单/搜索偏好、更新提示。 |
| 热键 | `hot_key.json` | Main hotkey | 启动加载、编辑时写。 |
| 自定义源 | `user_api.json` | Main User API | 脚本以 `gz_` 压缩文本持久化。 |
| 主题 | `theme.json` | Main theme | 自定义主题 CRUD。 |
| 音效预设 | `sound_effect.json` | Main sound effect | EQ/卷积预设。 |
| 业务 DB | `lx.data.db` + WAL/SHM | DB worker；Sync；Native Demo 当前直接访问 | schema v2，列表/歌曲/排序、其他源、歌词 raw/edited、URL、下载、dislike。 |
| Bili session | `config_v2.json` cookie + Electron session cookies | Bili cookie 模块 | 启动恢复、30 天 cookie、退出后持久。 |
| Renderer 小偏好 | Electron localStorage | Renderer | shell 明暗、侧栏、浮岛、更新提示、本地文件夹、隐藏默认主题、启动日志。 |
| 临时封面 | OS temp `lxmusic_temp/covers` | Renderer worker | 路径+mtime+size SHA-1 命名，无持久索引。 |
| Sync 状态 | `LxDatas/sync/**` | Sync server/client | auth key、server info、设备、快照与快照索引。 |

未发现 IndexedDB。SQLite 表没有声明外键，歌词和 URL 表也没有唯一约束；语义由 db helper 保证。Native 并行运行时不得让两套进程无协调地写同一 DB。

## 9. Network dependency map

| 能力 | 运行位置 | 技术/目标 |
|---|---|---|
| 音乐搜索、榜单、歌单、歌词、评论、封面 | Renderer | 自有 Node `needle`/request 封装；kw/kg/tx/wy/mg/bd 多个非公开接口，支持代理和取消。 |
| 聚合/自定义音源 | Hidden Renderer/Main | 用户 JS 脚本通过受限 preload 请求 Main 的 `needle`；20 秒 request queue。 |
| Bilibili | Main | `fetch/undici`、WBI、cookie；Bili/网易/LRCLIB 字幕匹配；本地 HTTP token proxy 转发 range。 |
| Download | Renderer worker | Node HTTP(S) downloader、Range 续传、代理、重试、URL 刷新；FFmpeg 子进程转 Bili m4a。 |
| Sync | Main | HTTP hello/id/ah + WebSocket RPC；RSA/OAEP、AES-128-ECB、gzip。 |
| OpenAPI | Main | 本地/局域网 HTTP + SSE；当前 CORS 开放且无认证。 |
| Update | Main + Renderer | electron-updater/GitHub 发布；多个 GitHub/npm/jsDelivr/Gitee 镜像版本信息。 |

网络源大量依赖非公开协议、签名和响应结构，是外部变化风险，不应直接散落在 ViewModel；Native 每个来源必须是独立 adapter，统一 timeout、取消、proxy、rate limit、日志和错误分类。

## 10. Build、packaging 与 localization

- 根 `tsconfig.json` 提供 aliases；子目录 tsconfig 继承。Webpack target 分别为 `electron-main`/`electron-renderer`，复制静态资源，处理 native addons 与 taglib WASM unpack。
- electron-builder 产品名 `LX-TA`、appId `com.tabrisayanami.lxta`、协议 `lxmusic`，Windows 产物含 setup/portable/7z，更新仓库为 `Tabris-Ayanami/LX-Music-TAchanged`。
- 语言由 `src/lang/index.ts` 静态打包简体中文、繁体中文、英语 JSON；Main 托盘和歌词 Renderer共享相同 key。Native 应使用强类型资源访问并保留 key 兼容迁移工具，但 XAML 文案不应继续依赖 JS i18n runtime。

## 11. 关键边界结论

1. Electron IPC 是进程边界的产物，不是值得复制的业务架构；Native 应把它拆成 application interfaces。
2. 当前 Renderer 可直接访问 Node，文件扫描、下载、网络和 UI 并非真正分层；迁移必须以 feature trace 为单位重新收口。
3. Player 不是单纯媒体控件，而是一套 URL/队列/恢复/音效/歌词/平台动作状态机。
4. Sync、自定义源与 Bilibili proxy 是独立子系统，均需要安全模型和协议兼容测试。
5. 视觉上大多数效果可由 XAML/Composition/Win2D 达成；只有 Aura 像素管线与 Diorama 3D 效果在保真要求下可能需要 Direct3D/HLSL。

## 12. 已确认决定与待确认建议

1. **本地扫描扩展格式：** Native 不保留“扫描 6 种、元数据 15 种”的割裂。建立一个格式注册表，首批至少纳入当前元数据模块的 15 种扩展名；每种格式仍须通过 metadata 与实际播放能力测试，无法播放时给出明确状态，不能静默漏扫。
2. **桌面歌词取消：** `renderer-lyric` 和 `winLyric` 只作为历史参考，不进入 Native 产品范围。导入旧设置时安全忽略 desktop-lyric 字段，不创建窗口或后台资源。
3. **自定义音源是核心功能：** 目标首先是兼容现有 `user_api.json` 和真实用户脚本，而不是优先设计一套新格式。实现仍不得依赖 Node、Chromium、WebView2；需要托管 JavaScript 兼容宿主和清晰的能力边界。
4. **当前部署决定：** Native 目前只在用户当前 Windows 开发机上个人使用。采用 unpackaged WinUI 3、framework-dependent、x64-only，以及普通本地 Debug/Release build。Phase 0 不做 MSIX、App Installer、证书/签名、安装器、自更新、self-contained publish、ARM64/x86 或 clean-machine deployment；这些只在用户明确要求公开发行后重新进入计划。应用架构不得围绕未来部署方案设计。
5. **OpenAPI 降为最后可选项：** 此处 OpenAPI 不是 OpenAI 服务，而是应用内置的 HTTP 遥控接口。它不再属于 Native 完成条件，不阻塞发布；核心功能全部完成后再决定是否实现，也可以完全不提供。若最终提供，才采用默认关闭/localhost、LAN token 的安全建议。
6. **动画提高优先级：** 动效不是迁移末期装饰。Phase 0 建立帧时间测量，首个壳层切片建立 Composition motion primitives，后续每个 UI 切片都必须在 120 Hz 参考显示器上验证。目标显示节奏为 120 fps，单帧预算 8.33 ms；不能以 60 Hz/16.67 ms 结果代替。
