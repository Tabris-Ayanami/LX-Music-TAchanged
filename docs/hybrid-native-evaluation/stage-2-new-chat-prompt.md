# 新对话提示词：Stage 2 Memory-First

请在 LX-TA 仓库继续 Hybrid Native 路线的 Stage 2，但本轮目标已经调整：

> 以可复现地降低 LX-TA 的全应用内存占用为首要目标，不预设必须实现 Native LibraryService。

仓库位置：

```text
F:\player\lx-music-desktop-master\lx-music-desktop-master
```

开始前执行：

```bash
git branch --show-current
git status --short
git log -5 --oneline
```

必须位于 `hybrid-native`。Stage 1 的主要提交是：

```text
4c43e04 feat: complete hybrid native stage 1
72a9f32 docs: record stage 1 validation and frontend integration
```

如果分支不对，停止报告，不自行切换。如果工作树不干净，先辨认改动来源，不覆盖或丢弃用户改动。

先完整阅读：

```text
docs/hybrid-native-evaluation/stage-2-memory-first-handoff.md
docs/hybrid-native-evaluation/stage-1-status.md
docs/hybrid-native-evaluation/stage-1-performance.md
docs/hybrid-native-evaluation/stage-1-metadata-shadow-report.md
docs/hybrid-native-evaluation/architecture.md
docs/hybrid-native-evaluation/migration-plan.md
```

不要重新研究 WinUI 或 fooyin，不读取它们的源码。

## 必须理解的背景

Stage 1 已完成 Rust sidecar、Metadata shadow、安全 metadata write、Native Artwork variants/cache、feature flags 和 Electron 回退，但没有证明全应用内存明显下降。sidecar 只占约 10.7–11.5 MiB Working Set、5.1–6.0 MiB Private Bytes，内存大头仍可能来自 Chromium、GPU、Renderer、图片解码/纹理、WebGL、页面 keep-alive、worker 和重复媒体库数据。

旧 Stage 0 的“搜索页”后来已经改造成内容更多的 Discover/发现页，加入推荐、每日推荐、远程图片、账号和动态封面能力。因此旧搜索页与当前 Discover 不是功能等价样本。不要把 Discover 增加的合理成本误判成 Stage 1 回归，也不要用这个解释掩盖其他内存问题。

Stage 2 必须先在当前版本建立新的功能等价基线，分别测量 Discover、真实搜索结果、本地歌曲、大封面列表、普通播放、Folia、Aura、Diorama、全库扫描和多次页面往返。

## 执行要求

### Stage 2A：测量与归因

1. 使用真实 profile 的隔离复制和媒体文件副本，不写真实音乐库。
2. 固定机器、主题、窗口、自定义源、媒体库、等待时间和操作步骤。
3. 每个关键场景至少运行 5 次，报告中位数和范围；冷启动与热启动分开。
4. 统计 Electron 完整进程树加 Rust sidecar的总 Working Set、Private Bytes/Commit、CPU、进程、线程和句柄。
5. 同时统计 Renderer JS Heap、DOM nodes、Documents、Frames、图片、object URL、canvas/WebGL context、worker、Native artwork cache。
6. 页面进入后至少稳定 10 秒再采样；导航压力后记录 10/30/60 秒回落。
7. GPU process Private Bytes 不能冒充 GPU 显存；没有可靠指标就明确写不可获得。
8. 用测试专用开关逐项归因 Discover 图片/视频、Folia/Aura/Diorama、keep-alive、封面尺寸、整库对象、DB/Renderer worker、Web Audio 和页面残留任务。

先输出归因结果，再决定修改方向。不要一开始就写 Rust LibraryService。

### Stage 2B：证据驱动优化

优先修复实际最大的可控来源，可能包括但不限于：

- 页面 deactivated/unmounted 后未停止的 RAF、timer、observer、网络请求和 event listener；
- Three.js/WebGL texture、material、geometry、render target、canvas 或 video 未释放；
- object URL 未 revoke；
- 列表为小尺寸封面请求 512/原图；
- Discover 或动态封面让隐藏图片/video 持续解码；
- Main DB worker、IPC DTO、Renderer store 和排序结果之间重复保存整库对象；
- worker 过早启动或空闲后永不退出。

可以先在 ElectronBackendAdapter 内实现分页/projection 原型验证收益。每项优化必须独立 A/B、独立测试、独立 commit。没有可重复收益的实验应撤回，不要保留复杂度。

不得通过删除功能、关闭视觉效果、降低默认画质来制造内存下降。Folia、Aura、Diorama、歌词、动态封面和 Discover 都要保留。

### Stage 2C：LibraryService 决策门

只有在数据证明整库常驻、数据库结果复制或扫描峰值是主要内存来源时，才进入 Native LibraryService。判断标准和实现约束以 `stage-2-memory-first-handoff.md` 为准。

如果进入：

- 使用独立 shadow database，不接触现有生产 DB；
- 不允许两套 writer；
- query 必须 pagination + projection + stable cursor；
- change feed 必须 revision/cursor；
- scanner 使用有界并发和 cancellation；
- 逐目录比较曲目数量、identity、metadata、排序、扫描耗时和内存；
- feature flag、校验、备份、单写者切换和回退缺一不可。

如果前端生命周期、图片或数据分页已经达到目标，或证据显示 Native Library收益有限，就不要为了“完成路线”强行迁移 SQLite。

## 完成指标

至少满足：

- 本地歌曲或大封面列表一个关键场景的全应用 Private Bytes 中位数下降 `>= 10%` 或 `>= 100 MiB`；
- 重页面往返 10 次后，稳定 60 秒的总 Private Bytes 不超过首次稳定值 `5%`；
- JS Heap、DOM、canvas/WebGL、worker 和 object URL 不随循环持续单调增长；
- 当前功能无行为回归；
- build、typecheck、lint、Backend contract、boundary guard、Rust/Native tests、regression 和 smoke 通过，或只保留已经记录的既有失败基线。

若严谨测量后仍未达到内存门槛，不能虚报 Stage 2 完成。停止并报告最大来源、已排除方向和需要用户决定的结构性方案。

## 本轮禁止

不要开始 DownloadService、Native Player、libmpv、WASAPI、FFT IPC、Tauri、Wails、WinUI 或 fooyin；不要迁移 Electron 壳；不要操作真实 profile/媒体原件；不要 push。

完成后更新 Hybrid 文档，提交独立的本地 commits，报告完整前后数据并停止。不要自动进入 Stage 3。
