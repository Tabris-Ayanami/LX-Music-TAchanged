# LX-TA Web UI + Native Core 架构评估

> 日期：2026-08-11  
> 性质：架构研究，不是迁移实现  
> 决策前提：保留现有 Web UI；暂停 WinUI 全量迁移；不 Fork fooyin；Electron 暂不删除。

## 结论先行

建议把 LX-TA 重构为“Web UI + 可替换 Backend API + Rust sidecar Native Core + 极薄 Electron Main”。这比继续 WinUI 全量重写更符合当前代码资产，也比把 fooyin Core 连同 Qt 基础设施嵌入项目更可控。

关键不是把所有 JavaScript 换成原生语言，而是只迁移四类有明确收益的工作：大量文件 I/O、媒体元数据与图片处理、可分页的媒体库索引、可隔离的下载/转码；音频后端必须等独立原型通过后再决定。Vue、React、CSS、歌词动画、Folia、Aura、Diorama、Three.js/WebGL 都应保留。

## 1. 当前源码的真实边界

当前系统并不是简单的“Renderer 负责 UI、Main 负责业务”：

- 主 Renderer 同时承担页面状态、在线源 SDK、本地文件扫描、播放状态机、HTMLAudio/Web Audio、下载协调和绝大多数视觉效果。
- `src/renderer/utils/ipc.ts` 已经集中包装了大量 IPC，但它仍是按 IPC 名称组织的低层传输门面，不是稳定的业务接口。
- `src/common/rendererIpc.ts` 直接导入 `ipcRenderer`；主窗口在 `src/main/modules/winMain/main.ts` 中启用了 `nodeIntegration` 与 `nodeIntegrationInWorker`，并关闭了 `contextIsolation` 和 `sandbox`。
- Main 承担窗口、托盘、全局快捷键、更新、数据库 worker、metadata、Bilibili、本地 OpenAPI、同步和自定义源宿主。
- SQLite 已经通过 `better-sqlite3` 使用原生 SQLite，并放在 Main 的 worker thread 中。问题不只是“SQLite 是否原生”，而是数据所有权、整表返回和多份 JS 对象缓存。
- 播放链路在 `src/renderer/plugins/player/index.ts`：HTMLAudioElement 后接 Web Audio 的 Analyser、十段 EQ、可选 AudioWorklet pitch、卷积、压缩、声像和增益。当前 FFT/时域数据不跨进程。
- 本地扫描在 `src/renderer/utils/localMusic.ts` 直接使用 Node `fs/promises`；当前没有持续文件监听。
- metadata 写入已经实现临时副本、回读校验、备份替换和回滚，这些语义必须保留，不能只换一个 TagLib 调用就称为完成迁移。

因此，第一步应先建立业务边界，再更换实现。若直接把 Electron IPC 一一映射成 native RPC，只会把现有耦合复制到另一个进程。

## 2. 目标架构

```text
┌────────────────────────────────────────────────────────────┐
│ Web UI                                                     │
│ Vue / React / CSS / Folia / Aura / Diorama / Three.js      │
│ 页面状态、交互、歌词视觉、WebGL                             │
└───────────────────────────┬────────────────────────────────┘
                            │ TypeScript 业务接口
┌───────────────────────────▼────────────────────────────────┐
│ Backend API                                                │
│ PlayerService / LibraryService / MetadataService           │
│ ArtworkService / DownloadService / PlatformService         │
│ SourceService / SettingsService                            │
└──────────────┬─────────────────────────────┬───────────────┘
               │                             │
      ElectronBackendAdapter        NativeBackendAdapter
      （现有实现、逐项回退）          （版本化 RPC + 二进制流）
               │                             │
┌──────────────▼─────────────┐  ┌────────────▼──────────────┐
│ 极薄 Electron Main         │  │ Rust Native Core sidecar  │
│ Window/Tray/Shortcut       │  │ media/library/files/db    │
│ updater/protocol/dialog    │  │ artwork/download/audio*   │
│ core supervisor/bridge     │  │ * 音频仅在原型通过后       │
└──────────────┬─────────────┘  └────────────┬──────────────┘
               └─────────────────────────────┘
                      Windows / Media / DB / FS
```

### 2.1 UI 层

UI 只能依赖 TypeScript service 接口、DTO 和事件类型，不得依赖：

- `electron`、`ipcRenderer` 或 channel 名；
- `node:fs`、`child_process`、数据库文件路径或 SQL；
- sidecar 的进程、管道、端口和序列化格式；
- TagLib、FFmpeg、libmpv 等具体库。

页面状态仍由前端持有。媒体库的大型集合则改为“查询参数 + 分页结果 + 增量变更”，而不是把整个数据库镜像进响应式状态。

### 2.2 Backend API 层

建议接口按业务能力组织，而不是按进程或技术组织：

```ts
interface LibraryService {
  query(request: LibraryQuery, signal?: AbortSignal): Promise<Page<TrackSummary>>
  getTrack(id: TrackId): Promise<TrackDetail | null>
  startScan(request: ScanRequest): Promise<JobId>
  watchChanges(cursor?: ChangeCursor): AsyncIterable<LibraryChange>
}

interface MetadataService {
  read(path: FilePath, fields?: MetadataField[]): Promise<TrackMetadata>
  write(request: MetadataWriteRequest): Promise<MetadataWriteResult>
}

interface ArtworkService {
  get(ref: ArtworkRef, variant: ArtworkVariant): Promise<ArtworkHandle>
  invalidate(ref: ArtworkRef): Promise<void>
}

interface PlayerService {
  load(request: LoadRequest): Promise<void>
  play(): Promise<void>
  pause(): Promise<void>
  seek(seconds: number): Promise<void>
  setOutput(deviceId: string): Promise<void>
  observeState(): AsyncIterable<PlayerStateEvent>
  openTelemetryStream(spec: TelemetrySpec): Promise<TelemetryChannel>
}
```

还应包含 `DownloadService`、`PlatformService`、`SettingsService` 和 `SourceService`。其中 `SourceService` 初期仍由 JS 实现，但 UI 不再知道它运行在 Renderer、worker 还是隔离进程。

| Service | 面向 UI 的稳定职责 | 初期实现 | 目标实现 |
|---|---|---|---|
| PlayerService | 队列控制、播放状态、设备、DSP 参数、遥测订阅 | 现有 HTMLAudio/Web Audio adapter | 仍可为 Web；libmpv 原型通过后才切 Native |
| LibraryService | 分页查询、详情、扫描 job、变更订阅 | 现有 DB worker + Renderer scanner adapter | Native scanner/watcher/SQLite 单写者 |
| MetadataService | tag/embedded lyric 读取与事务式写入 | 现有 Main/worker 实现 | 直接 Native TagLib |
| ArtworkService | 封面变体、缓存句柄和失效 | 现有 cover cache adapter | Native decode/resize/byte-budget cache |
| DownloadService | job、进度、取消、恢复和文件提交 | 现有 download worker | Native transfer + 受管 FFmpeg |
| SourceService | 在线源、自定义源、Bilibili 协议 | JS | 继续 JS，必要时隔离进程 |
| SettingsService | 跨 host 业务设置与 schema | JSON/localStorage adapter | 仍可 JS；仅必要数据进统一存储 |
| PlatformService | 窄化的窗口外系统能力 | Electron Main | 当前仍 Electron；换壳时替换 adapter |

接口规则：

1. 使用稳定 ID，不把数据库 row 或文件描述符暴露给 UI。
2. 所有长任务有 `jobId`、取消、进度和幂等语义。
3. 错误使用稳定错误码、用户可显示信息和可选诊断信息，不依赖 Electron 对 Error 的有损序列化。
4. DTO 有协议版本；未知字段可忽略；破坏性变更提升 major 版本。
5. 大数据返回句柄、URL 或二进制流，不返回 base64。
6. 业务事件低频、可恢复；高频遥测走独立通路。

### 2.3 Adapter 层

同一接口至少有两个实现：

- `ElectronBackendAdapter`：调用现有 IPC、Renderer worker 或现有 JS 模块，保证 Stage 0 不改变行为。
- `NativeBackendAdapter`：调用 sidecar RPC；按模块 feature flag 启用；失败时可按明确策略回退。

不允许业务组件自行判断 `isElectron` 或 `nativeAvailable`。选择实现只在 composition root 发生一次。这样未来 Tauri/Wails 只需新增 Host/Transport adapter，而不用重写页面。

### 2.4 Native Core 模块

建议 core 内部边界如下：

| 模块 | 职责 | 不负责 |
|---|---|---|
| Metadata | TagLib 读写、字段映射、事务式替换与校验 | UI 编辑状态、在线源标签策略 |
| Artwork | 提取、方向/色彩处理、缩放、编码、LRU/字节预算缓存 | 页面背景、CSS、WebGL 纹理生命周期 |
| Library | 扫描、监听、索引、SQLite 单写者、分页查询、change feed | 页面排序状态、选中项、播放队列 UI |
| Download | HTTP 字节传输、断点续传、校验、文件提交、FFmpeg job | 自定义源脚本、Bilibili 业务协议首期实现 |
| Player（后期） | 播放状态机、解码/输出/DSP、设备、音频时钟 | 歌词布局、可视化渲染 |
| Platform（有限） | 文件身份、Windows 文件/电源等 core 必需能力 | Window、Tray、快捷键、主题、更新 UI |

Native Core 不依赖 Qt，也不包含 WinUI。它是 headless、可测试、可由 Electron 或其他 host 启动的服务。

## 3. 进程与故障边界

推荐 sidecar 而不是进程内 addon：

- Electron Main 负责启动、握手、健康检查、崩溃重启和退出清理；Windows 上把子进程放入 Job Object，避免孤儿进程。
- sidecar 启动后通过继承句柄或随机命名的本地 named pipe 建立控制面，不开放公共 TCP 端口。
- 握手包含协议版本、构建版本、数据库 schema 版本和能力列表。
- 崩溃后 UI 收到 `backend_unavailable`；正在写标签或提交下载的原子替换流程自行恢复；数据库依靠 WAL 和事务恢复。
- 音频若以后进入 sidecar，core 崩溃只终止播放而不直接带走 UI；这比 N-API/DLL 的同进程故障边界更清晰。

## 4. 数据所有权

### 4.1 媒体库

Native LibraryService 一旦切换为写者，就必须成为相关 SQLite 表的唯一写者。迁移期可先构建影子索引并做只读比对，不能让旧 `better-sqlite3` worker 和新 core 同时写同一份库。

UI 只持有：

- 当前可见页和少量预取页；
- 播放队列必要字段；
- 选中项和编辑草稿；
- 由版本号驱动的增量变更。

这能消除当前 Main DB worker 缓存、IPC 返回数组、Renderer 列表状态之间的大量重复对象。

### 4.2 Artwork

浏览器应请求明确尺寸，如 `64`, `128`, `256`, `512`，并获得可缓存的 URL/句柄或二进制响应。core 以源文件身份（规范路径、mtime、size，必要时内容摘要）和变体参数作为 key，设置总字节预算和 LRU。原图只在编辑/查看原图时读取。

### 4.3 Settings

界面主题、布局和临时页面状态留在 Web；需要跨 host 的持久设置通过 `SettingsService`。机密信息使用 host 的安全存储。不要把所有 `localStorage` 一次性搬进 Native Core。

## 5. Electron 留存的价值

在保留 Renderer 的前提下，先缩小 Main 已能获得明显的架构和部分性能收益：

- 把扫描、metadata/artwork、媒体库查询和下载从 Renderer/Node worker 移出，可减少 JS heap、base64、整表复制与工作线程常驻开销。
- sidecar 隔离媒体库、FFmpeg 和未来音频崩溃。
- Backend API 为关闭 Renderer 的 Node integration 创造条件，安全和可维护性收益很大。

但 Electron Main 变薄不会消除 Chromium renderer/GPU/network 进程，也不会消除 Vue/React、Folia、Three.js/WebGL 和图片纹理的内存。Electron 仍包含 Node Main。是否换壳应等 Native Core 和无 Node Renderer 完成后，以实际指标单独决策。

## 6. 非目标

- 本轮不改现有 Electron 行为。
- 不继续 WinUI Slice 2；保留现有 Slice 1 作为只读验证原型和性能对照。
- 不 Fork 或链接 fooyin Core。
- 不自研完整 WASAPI 播放器。
- 不把所有网络协议、设置和 UI 状态迁到原生层。
- 不以进程数、语言或安装包体积代替端到端内存与稳定性测量。

## 7. 源码依据

主要依据包括：

- `src/main/modules/winMain/main.ts`
- `src/renderer/utils/ipc.ts`
- `src/common/rendererIpc.ts`
- `src/renderer/plugins/player/index.ts`
- `src/renderer/utils/localMusic.ts`
- `src/main/modules/localMusicTools/metadata.ts`
- `src/main/worker/dbService/db.ts`
- `src/renderer/worker/main/music.ts`
- `src/renderer/worker/download/*`
- `src/main/modules/userApi/*`
- `src/main/modules/bilibili/*`
- `docs/migration/*` 与当前 `native/*` Slice 1 文档/代码

外部接口约束参考 [Electron MessagePort](https://www.electronjs.org/docs/latest/tutorial/message-ports)、[Tauri sidecar](https://v2.tauri.app/develop/sidecar/) 以及 [Wails Windows/WebView2](https://wails.io/docs/next/guides/windows/)。
