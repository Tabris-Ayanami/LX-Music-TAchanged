# 渐进迁移计划

## 原则

每个阶段结束时，LX-TA 都必须可正常发布和回退。迁移单位是业务 service，不是语言、库或 IPC channel。任何模块在切换前都有：旧实现 adapter、native 实现、contract test、差分/影子验证、feature flag、数据恢复方案。

WinUI 全量迁移已停止，不继续 Slice 2。实验成果保留在 `winui-poc` 分支；`hybrid-native` 当前工作树不携带旧 WinUI/fooyin/native 实验源码，它们也不作为 Hybrid 实现参考。

## Stage 0 — 建立基线与统一 Backend API（已完成，2026-08-11）

实际完成范围、未迁移清单、测试与性能数据见 [stage-0-status.md](stage-0-status.md)、[stage-0-direct-dependency-inventory.md](stage-0-direct-dependency-inventory.md) 和 [performance-baseline.md](performance-baseline.md)。Stage 0 只改变依赖方向；Metadata、Artwork、Library、Player 均未标记为 Native 化完成。

### 目标

在不改变行为的前提下，把业务组件与 Electron/Node/数据库实现解耦。

### 工作

- 记录当前版本、测试数据集和六类场景：idle、普通播放、Folia、Diorama/Aura、全库扫描、下载/转码。
- 记录全应用进程树的 private working set、commit、GPU memory、JS heap、句柄/线程、启动时间和 CPU，不只记录主进程 RSS。
- 定义 `PlayerService`, `LibraryService`, `MetadataService`, `ArtworkService`, `DownloadService`, `SourceService`, `SettingsService`, `PlatformService`。
- 定义 DTO、错误码、job/cancel/progress、协议版本和 capability。
- 先实现 `ElectronBackendAdapter`，内部调用现有 `src/renderer/utils/ipc.ts`、worker 与播放器，页面行为不变。
- 建立静态规则：新 UI 代码不得直接导入 `electron`、`node:*`、SQL、FFmpeg。
- 为 service 建 fake backend 和 contract test；生成调用量/消息体积 telemetry。

### 完成门槛

- 选定的页面/业务入口只依赖 service，不直接新增 IPC。
- 现有测试、播放、扫描、下载行为不变。
- 有可复现的内存/性能基线和测试媒体语料。

### 回退

没有行为切换；只需撤回 adapter 注入。Stage 0 不删除旧路径。

## Stage 1 — Native MetadataService + ArtworkService（已完成，2026-08-19）

实际实现、差异与性能见 [stage-1-status.md](stage-1-status.md)、[stage-1-metadata-shadow-report.md](stage-1-metadata-shadow-report.md) 和 [stage-1-performance.md](stage-1-performance.md)。读取保持 shadow，Native write 和 artwork 默认未接管；这不表示 Library、Download 或 Player 已 Native 化。

### 为什么先做

边界窄、写操作可逐文件回退，且能直接消除 taglib-wasm、大封面 base64、原图浏览器解码和重复缩略图工作。

### 工作

- 建立 Rust sidecar 骨架、named pipe 握手、版本/capability、日志和 supervision。
- 使用 Rust Lofty 主路径与 FFmpeg 只读 fallback；覆盖批准的 15 类/16 扩展名和字段映射，不引入 Qt/fooyin。
- 先做 metadata read shadow mode：旧/新同时读取，记录差异但使用旧结果。
- 实现 artwork 提取、方向/色彩处理、64/128/256/512 变体、原子 cache、LRU 与总字节预算。
- UI 改用 artwork handle/URL/二进制，不接收 base64。
- tag write 完整复刻临时副本、权限处理、回读校验、备份替换、回滚；做 kill/disk-full/locked-file 测试。

### 完成门槛

- 代表性语料的读取差异已解释并形成兼容规则。
- tag 写入故障注入不会损坏唯一原件。
- 大图列表滚动的 Renderer heap、decoded image/GPU memory 有可复现下降。
- feature flag 可以逐项切回旧 metadata/artwork。

### 回退

read 回退旧 reader；write 在任何异常时保留原文件并报告稳定错误；cache 可安全丢弃重建。

## Stage 2 — Native LibraryService：扫描、监听、索引、SQLite

### 为什么第二批

这是内存收益最大但数据风险最高的阶段，必须在 sidecar、RPC 和 metadata 已稳定后进行。SQLite 迁移只是此服务的一部分。

### 工作

1. 新库使用独立数据库文件构建 shadow index；不碰现有生产 DB。
2. scanner 使用有界并发、取消、批次、长路径/UNC、junction policy 和错误汇总。
3. 通过 track identity 规则处理路径、mtime、size、必要内容 hash；定义 rename/duplicate 语义。
4. Library query 使用分页、projection、stable sort cursor；UI 不再请求整库。
5. change feed 以 cursor/revision 提供增量 insert/update/delete/reset。
6. 用相同目录反复对比旧/新曲目数、metadata、排序、扫描耗时和内存。
7. watcher 只做变化提示；溢出/恢复后触发 reconciliation。
8. 切换窗口内冻结旧库写入，备份、迁移、校验后让 Native LibraryService 成为唯一写者。

### 完成门槛

- 大库分页不会在 Renderer 和 Main 各保留完整对象集。
- cold/warm scan、rename/delete/权限错误、网络盘和 watcher overflow 测试通过。
- schema migration 可向前恢复，旧版本回退路径有明确数据策略。
- 任何时刻只有一个数据库写者。

### 回退

切换前保留只读备份；若新服务失败，停止 sidecar 写入后再恢复旧 DB/adapter。严禁运行中让两套 writer 竞争。

## Stage 3 — Native DownloadService 与 FFmpeg job 管理

### 为什么在音频之前

下载是任务型、可按 job 隔离、回退简单；其稳定性收益明确，而播放后端涉及实时状态机和全部视觉链路。先迁下载能继续移除 Renderer worker/Node 职责，又不冒播放回归风险。

### 工作

- JS SourceService/Bilibili 逻辑继续解析 URL、headers/cookie 和目标格式。
- Native DownloadService 执行 HTTP range、断点、限速、取消、校验、临时文件和原子提交。
- FFmpeg 继续作为受管独立进程；native 负责白名单参数、stderr/progress、取消和清理。
- 下载任务持久化由单一服务拥有；UI 只接收 4–10 Hz 合并 progress。
- 保留旧 downloader feature flag，按来源/格式灰度。

### 完成门槛

- 网络中断、暂停恢复、服务器忽略 Range、磁盘满、同名文件、杀进程和重启恢复通过。
- 代理、证书、自定义 headers 与现有行为兼容。
- FFmpeg 不留下孤儿进程和临时文件。

## Stage 4 — Native Player 研究门（不是默认迁移）

### 工作

- `PlayerService` 仍默认绑定 HTMLAudio/Web Audio。
- 独立实现 libmpv sidecar spike，不直接接管正式播放。
- 按 `audio-backend.md` 的 gapless、seek、格式、EQ/pitch、ReplayGain、设备、exclusive、FFT、崩溃和总内存门槛测试。
- binary telemetry 先用 MessagePort 或鉴权 WebSocket；position 用时钟快照插值。

### 决策

- 全部门槛通过：进入小比例 opt-in/灰度，再逐步替换。
- 可视化/行为/内存不通过：停止 Native Player，继续 Web Audio；此前的 metadata/library/download 成果不受影响。
- 只有明确产品需求证明值得，才另立 FFmpeg + miniaudio 项目。

### 回退

Player backend 在启动/切歌边界选择；同一时刻只启用一个音频引擎。故障时停止 native 实例、恢复队列位置并切回 Web player，不做双时钟热混用。

## Stage 5 — 去 Renderer Node 与极薄 Electron Main

### 前提

所有直接 Node 职责已有 service/Source runtime 承接；Native Player 是否采用不影响本阶段的大部分工作。

### 工作

- 清除 Renderer 的 `node:*`、Electron 和本地路径直接依赖。
- 自定义源继续 JS，但迁到受限 utility/Node process 的可行性单独验证；必要时保留 hidden BrowserWindow fallback。
- 建最小 preload/contextBridge；参数校验、method allowlist、无通用 `invoke(channel)`。
- 逐步启用 `contextIsolation`, `webSecurity`, `sandbox`，关闭 `nodeIntegration`。
- 删除 Main 中已经迁走的 DB、metadata、download/FFmpeg 业务 handler。

### 完成门槛

- Main 只剩 host、PlatformService 和 core supervisor。
- UI 在无 Node 环境运行；Folia/Aura/Diorama/Three.js、拖放、本地资源和音频完整回归。
- security checklist 和 IPC fuzz/参数验证通过。

## Stage 6 — Electron 壳独立评估

### 候选

1. 继续 Electron：兼容和维护成本最低。
2. Tauri/WebView2：若 core 为 Rust，host 栈最一致；sidecar 可以原样打包。
3. Wails/WebView2：可行，但增加 Go host；只有其窗口/开发体验有实证优势时采用。
4. 自建 WebView2 host：默认不选，除非现成 host 无法满足关键窗口/视觉行为。

### 决策门槛

- 用同一 UI bundle、同一 Native Core、同一场景做 A/B。
- 比较总内存、GPU、启动、安装包、更新、透明/无边框、输入法、拖放、DevTools、音频和崩溃。
- 至少一个完整发布周期的兼容验证后才替换。

壳替换是 Stage 6 的独立产品决策，不是 Native Core 项目的“必然终点”。

## 横向测试与指标

每阶段固定记录：

| 维度 | 指标 |
|---|---|
| 正确性 | track count、metadata 差分、排序、seek/状态、文件 hash |
| CPU | idle、扫描、滚动封面、FFT、下载转码、切歌 |
| 内存 | 全进程 private WS/commit、JS heap、native heap、GPU、decoded images |
| 稳定性 | crash-free hours、1000 次切歌/seek、杀进程恢复、句柄/线程趋势 |
| 延迟 | 启动、首屏、query p95、seek p95、封面首显、progress/FFT 端到端 |
| 运维 | 包体、更新增量、符号、日志、依赖许可/CVE |

建议用 `app.getAppMetrics()`/`process.getProcessMemoryInfo()`、Chromium Task Manager/trace、heap snapshot、ETW/Windows Performance Recorder 和 native profiler 组合测量。不同工具的 RSS/private working set/commit 口径不能混在一张图里。

## 阶段顺序总结

```text
Stage 0  Backend API + baseline
   ↓
Stage 1  Metadata + Artwork
   ↓
Stage 2  Library + Scanner + Watcher + SQLite
   ↓
Stage 3  Download + managed FFmpeg
   ↓
Stage 4  libmpv research gate ──失败──► 保留 Web Audio
   ↓通过
Native Player 灰度
   ↓
Stage 5  Renderer 去 Node + Electron Main 极薄
   ↓
Stage 6  独立评估 Electron / Tauri / Wails
```

该顺序把风险最高的播放器和换壳放在后面，而先完成无论最终壳是什么都能复用的业务边界与本地数据服务。
