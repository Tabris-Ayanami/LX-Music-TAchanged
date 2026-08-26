# Stage 0 完成状态

> 日期：2026-08-11  
> 分支：`hybrid-native`  
> 范围：统一 Backend API；未实现任何 Native Service。

## 结论

Stage 0 已完成。Renderer 现有功能仍由 Electron/Node、既有 worker、数据库和 HTMLAudio/Web Audio 实现；本轮建立了可替换的业务边界，并迁移了一批高价值入口。没有创建 Rust 工程、Native sidecar、libmpv、WinUI 或 fooyin 代码。

## 开始前检查

- `git branch --show-current`：`hybrid-native`。
- 开始时 `git status --short`：无输出，工作树干净。
- `git ls-files native`、`git ls-files references/fooyin`：均无输出。
- 根目录浅层检查未发现当前仓库内的 `native/`、`references/fooyin`、fooyin 副本或 WinUI PoC 源码目录。
- 因未发现可确认的残留，本轮未删除任何旧实验文件；WinUI 迁移文档已于 2026-08-25 随路线放弃一并删除，当前以 `docs/hybrid-native-evaluation/` 为准。

## Backend API 结构

```text
UI / store / useApp / SDK facade
              │
              ▼
BackendApi
├─ PlayerService
├─ LibraryService
├─ MetadataService
├─ ArtworkService
├─ DownloadService
├─ SourceService
├─ SettingsService
└─ PlatformService
              │
              ▼
ElectronBackendAdapter
              │
              ▼
既有 IPC / Renderer worker / DB worker / HTMLAudio + Web Audio
```

接口不是 IPC channel 的一对一重命名。比如本地库页面使用 `getOverview/registerFolders/startRescan/removeFolderTracks`，播放器调用 `load/play/pause/seek`，UI 不传 channel 名。

公共语义包括：

- `BACKEND_INTERFACE_VERSION = 0.1.0` 与 implementation/capability 描述；
- stable ID、分页 DTO、Library query 边界；
- `BackendError` 与稳定错误码，Electron adapter 会归一化取消、ENOENT、权限、冲突和未知错误；
- `BackendJob`、`jobId`、取消、进度订阅；
- Player/Settings async event 与统一 unsubscribe；
- 大集合不暴露数据库 row；当前本地页为兼容旧所有权仍取 overview 全量 tracks，分页接口已经建立但尚未切换所有权。

## 已迁移入口

| Service | 已迁移的主要入口 |
|---|---|
| PlayerService | 播放器初始化、加载、播放/暂停/停止、seek/position/duration、播放事件、音量/静音、播放速率、pitch、输出设备、媒体会话、预加载、shell 播放状态 |
| LibraryService | 设置页本地库 overview、文件夹注册/移除、全库扫描 job、文件夹曲目移除 |
| MetadataService | metadata 编辑读写、嵌入歌词读写 |
| ArtworkService | metadata 编辑选图读取、local artwork worker 包装 |
| DownloadService | 下载任务持久化的 list/create/update/remove |
| SourceService | Bilibili 搜索、歌单、URL、歌词、封面、评论等 SDK 主入口 |
| SettingsService | Renderer 启动设置读取/修正、设置持久化入口 |
| PlatformService | 主/播放详情窗口控制、全屏、文件选择、电源阻止器 |

未对成熟业务逻辑做重写：下载 worker、Bilibili Main handler、本地扫描器、数据库 worker、metadata 主进程实现和 Web player 仍是原实现。

## Fake 与 contract tests

- `FakeBackendAdapter` 实现全部 8 个 service，可记录调用并提供可控数据。
- `runBackendContractSuite` 是 adapter 无关的 fixture 套件；未来 Electron/Native fixture 可复用同一断言。
- 当前 5 项：版本/descriptor、Settings copy/event/unsubscribe、Library 分页/筛选/取消/job/progress、Player 控制/事件清理、Metadata 稳定错误与写后读。
- 结果：5/5 通过。

## 依赖守卫

`check-backend-boundaries.cjs` 扫描 Renderer（排除 vendored Folia）：

- 旧 transport 依赖文件：57，守卫上限 57；
- Electron/Node runtime 直连文件：33，守卫上限 33；
- 除 `backend/electron.ts` 外的 contract/fake 不得导入 transport/runtime；
- 数量增加或新 backend 逆向依赖会失败。

完整位置见 [stage-0-direct-dependency-inventory.md](stage-0-direct-dependency-inventory.md)。这是一条防新增基线，不代表历史依赖已清零。

## 验证结果

| 检查 | 结果 |
|---|---|
| 完整 production build | 通过，120.88 秒 |
| typecheck | 通过 |
| full lint | 通过，198.5 秒 |
| Backend boundary | 通过，57/57 与 33/33 |
| Backend contract | 5/5 通过 |
| 原有 regression tests | 68/74；与改造前相同的 6 项 UI 样式断言失败 |
| Bilibili 联网测试 | 失败：CDN connect timeout；改造前也失败但原因为上游状态码变化 |
| Renderer smoke | 通过，无 `Runtime.exceptionThrown` |

未修改或跳过 6 项既有失败，也未放宽 Bilibili 网络断言。4 项原来把具体 IPC 文本写死的 regression tests 已更新为验证 Service 依赖，更新后通过。

## Smoke 覆盖

- 应用启动、主界面、搜索/本地音乐/下载/设置路由；
- 本地库页面与真实全库扫描：11 个文件夹，发现 1019 个媒体文件，最终 960 首；
- 播放→暂停，上一首/下一首和音量控件存在；
- Aura canvas 创建；临时切换到 Diorama 后 Folia host/canvas 创建；测试后恢复内存中的视觉设置并关闭详情页；
- 自定义源 hidden renderer/worker bridge 随应用启动；
- 未捕获 Renderer runtime exception。

没有在外部 CDN 已超时的环境中强行启动下载/转码，因此下载/FFmpeg 本轮只有路由、既有 regression、持久化 Service 边界和构建覆盖，没有成功的端到端网络下载数据。

## 行为回归判断

未发现由 Stage 0 引入的用户可见回归。自动回归回到改造前同一 68/74 基线；实际启动、导航、扫描、播放、视觉链路均成功。Bilibili 端到端网络检查不构成通过证据，需在网络可复现环境重测。

## 当前技术债务

1. 57 个旧 transport 文件和 33 个 Renderer runtime 直连文件仍存在；Stage 0 只迁移主要入口。
2. `LibraryOverview.tracks` 仍兼容性返回全量列表；分页接口尚未成为页面数据所有权模型。
3. legacy scanner 不能真正中途取消；job cancellation 只能在调用前/完成后生效。
4. Electron adapter 仍使用部分 LX 历史 domain type；后续 protocol DTO 需要与数据库/内部对象进一步隔离。
5. 下载执行 worker、自定义源宿主、缓存歌词、部分 Bilibili immersive UI、设置/同步/更新仍直接依赖旧 IPC。
6. Direct runtime 清零前不能关闭 Renderer Node integration。
7. 性能脚本不能可靠读取独立 GPU memory，当前只记录 GPU process 的 WS/private bytes，二者不能当作 VRAM。

## Stage 1 前必须解决/确认

- 用户确认是否接受当前 Stage 0 边界与剩余清单；
- 为 Electron adapter 增加需要真实文件/临时 profile 的 integration fixture，而不是只靠 Fake contract；
- 固定 metadata/artwork 代表性媒体语料及文件写故障注入方案；
- 明确 Stage 1 feature flag、shadow read、回退和原文件保护验收标准；
- 在可复现网络环境补跑 Bilibili 与下载/转码基线；
- 不把本文件的“接口完成”解释为 Metadata/Artwork/Library/Player 已 Native 化。
