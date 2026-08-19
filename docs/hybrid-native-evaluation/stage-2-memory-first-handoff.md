# Stage 2 Memory-First 交接与执行规范

> 日期：2026-08-19
> 目标分支：`hybrid-native`
> 前置提交：`4c43e04`、`72a9f32`
> 性质：新对话交接文档；本阶段以全应用内存下降为目标，不预设必须 Native 化 LibraryService。

## 1. 必须先纠正的上下文

Stage 0 的“搜索页”与当前页面不是功能等价样本。暂停期间，原搜索入口及默认内容已经扩展为 Discover/发现页，增加推荐卡片、每日推荐、远程图片、账号数据和动态封面相关逻辑。因此：

- Stage 0 搜索页的 952.7 MiB Working Set、1027.4 MiB Private Bytes 和 9.3 MiB JS Heap只能作为历史记录；
- 不能把当前 Discover 页高于旧搜索空页面的占用全部归因于 Stage 1 sidecar；
- Stage 2 开始时必须在当前代码、当前功能和相同 profile 上重新冻结一份功能等价基线；
- Discover、真实搜索结果页和本地歌曲页必须分开采样，不再混称“搜索页”。

Stage 1 已完成 Rust sidecar、Metadata shadow、安全写入、Artwork variants/cache 和回退基础，但没有证明全应用内存明显下降。sidecar 自身约为 10.7–11.5 MiB Working Set、5.1–6.0 MiB Private Bytes；应用的大头仍在 Electron renderer、GPU、图片、WebGL、页面生命周期和重复数据。

## 2. Stage 2 的新定义

Stage 2 不再等同于“立刻实现 Native LibraryService”。它分为三个有明确停止门的阶段：

```text
Stage 2A  可重复测量与内存归因
    ↓ 找到主要可控来源
Stage 2B  证据驱动的低风险优化
    ↓ 复测是否达到总内存目标
Stage 2C  LibraryService 决策门
    ├─ 数据重复/整库常驻是主要来源 → 实施分页与必要的 Native Library
    └─ 不是主要来源或 2B 已达标 → 不为 Native 化而迁移数据库
```

Stage 2 的验收对象始终是：

```text
Electron 完整进程树 + Rust sidecar = LX-TA 总资源成本
```

不得只报告 Rust 进程、Renderer JS Heap 或某个进程的 RSS。

## 3. Stage 2A：先测量，再修改

### 3.1 测试环境

使用与 Stage 1 相同的机器、Electron 版本、主题、窗口尺寸、自定义源、音乐库快照和等待时间。必须复制真实 profile 到独立临时目录；扫描、metadata 编辑和写入测试不得操作真实音乐原件。

每个核心场景至少运行 5 次，报告中位数和范围；首轮冷启动与后续热启动分开。进入页面后至少稳定 10 秒再采样。页面切换、图片加载和动态效果尚未稳定时的数字不能作为 idle 基线。

### 3.2 功能等价场景

至少建立以下独立场景：

1. 冷启动后 Discover，等待图片和请求稳定；
2. Discover 滚动加载推荐内容；
3. 真实搜索结果页，固定相同关键词、来源和结果数量；
4. 本地歌曲列表，固定同一媒体库和排序；
5. 本地专辑大封面列表，连续浏览至少 200 个不同封面；
6. 普通播放但不打开沉浸视觉；
7. Folia；
8. Aura；
9. Diorama；
10. 在 Discover、本地歌曲、专辑和设置间往返 10 次，再返回初始页；
11. 全库扫描；
12. 下载/转码，仅在测试环境可重复且不会写入真实目录时执行。

### 3.3 必须采集的指标

- Electron 和 sidecar 的完整进程树、进程类型与数量；
- 每进程及总计的 Working Set、Private Bytes/Commit、CPU、线程和句柄；
- Renderer JS Heap used/total、DOM nodes、Documents、Frames；
- 页面图片数、当前 Native artwork URL 数、object URL 数；
- canvas/WebGL context 数；能够可靠获得时记录 texture/resource 数量；
- worker 数量及其生命周期；
- Native artwork cache 文件数和字节数；
- 启动、首屏、页面切换和 query p50/p95；
- 导航压力后 10 秒、30 秒、60 秒的回落情况。

GPU process 的 Private Bytes 不是 GPU 显存。没有可靠 GPU memory 计数器时必须明确写“不可获得”，不得用 Private Bytes 代替。

### 3.4 归因实验

在不删除产品功能的前提下，通过测试专用开关逐项对照：

- Discover 远程图片与动态封面视频；
- Folia、Aura、Diorama 和其他 canvas/WebGL 效果；
- keep-alive 页面与隐藏页面；
- 本地封面原图、目标尺寸 WebP 和浏览器 decoded image；
- 完整媒体库对象、页面 projection 和可见页数据；
- DB worker、Renderer worker 和 sidecar；
- 播放中 Web Audio 节点和 analyser；
- 页面离开后的 observer、timer、RAF、event listener、AbortController 和 object URL。

测试开关只能用于归因，不得成为默认关闭功能的借口。

## 4. Stage 2B：按证据排序优化

优先级由 Stage 2A 数据决定，但默认先检查以下可控来源。

### 4.1 页面和视觉资源生命周期

- 页面 deactivated/unmounted 后停止隐藏 RAF、timer、网络请求和 observer；
- Folia、Three.js、WebGL、canvas、video 资源在离开重页面后暂停或释放，返回时可重建；
- dispose geometry/material/texture/render target，避免只删除 DOM；
- 取消不再需要的动态封面请求，停止隐藏 video 解码；
- object URL 必须有明确所有者并在替换/销毁时 revoke；
- 不减少视觉质量，不删除 Folia/Aura/Diorama，也不把默认动画粗暴关闭。

### 4.2 图片与封面

- 列表只能请求接近显示尺寸的 64/128/256 资源，不为小缩略图请求 512 或原图；
- 使用可回收 URL/handle，不向 Renderer 发送 base64；
- 检查浏览器 decoded image、CSS background、隐藏 img/video 和动态封面是否持续保留；
- Native artwork cache 的 256 MiB 是磁盘预算，不等于浏览器纹理预算；必须分别测量；
- Native Artwork 默认是否切换，只能由同场景 A/B 数据决定。

### 4.3 前端数据所有权

- 找出 Main DB worker、IPC DTO、Renderer store、computed/sorted list 和页面缓存间的重复曲目对象；
- 先在现有 ElectronBackendAdapter 上验证 projection、分页、稳定 cursor 和增量更新是否能降低内存；
- UI 只持有可见页、少量预取、播放队列必要字段和编辑草稿；
- 不为省内存破坏搜索、排序、筛选、选择、多选、滚动恢复或播放队列语义。

### 4.4 Worker 和进程

- 记录每个 worker 的启动条件、空闲占用和退出策略；
- 非常驻任务优先 lazy start，并在确认安全后回收；
- 不把工作简单搬到新进程后就宣称内存下降；必须统计总量；
- 不为了减少进程数把可能崩溃的媒体处理重新塞回 Electron Main。

每个优化应单独提交，并附修改前后的同场景数据。若某项优化没有可重复收益或引入明显复杂度，应撤回或保持实验状态。

## 5. Stage 2C：Native LibraryService 决策门

只有满足以下任一证据时，才开始 Native LibraryService：

- 完整媒体库在 Main/worker/Renderer 中的重复对象合计占关键场景总 Private Bytes 的 10% 以上；
- 本地歌曲页通过分页/projection 原型能稳定降低至少 80 MiB 或 15% 的总 Private Bytes；
- 扫描阶段峰值内存、IPC 大数组或数据库查询复制被证明是主要峰值来源；
- Electron adapter 无法在不保留整库的情况下提供稳定分页/change feed。

如果证据不足，Stage 2 可以在完成更有效的 Web/Electron 内存优化后结束，不得为了遵循旧路线强行迁移 SQLite。

### 5.1 若决策进入 Native Library

- 新建独立 shadow database，绝不读写现有生产数据库文件；
- 旧 DB 和 Native DB 不得同时写同一所有权域；
- scanner 使用有界并发、batch、取消和错误汇总；
- query 必须分页、projection、stable cursor，不允许 RPC 返回全库；
- change feed 使用 revision/cursor，支持 insert/update/delete/reset；
- watcher overflow 后执行 reconciliation；
- 对相同目录比较 track count、identity、metadata、排序、筛选、扫描时间、峰值和稳定态内存；
- 切换前必须有 feature flag、备份、校验、单写者切换和回退方案。

Native Library 不能顺带开始 DownloadService、Player、libmpv、WASAPI 或 Electron 换壳。

## 6. 量化完成门槛

Stage 2 只有同时满足以下条件才完成：

1. 当前代码的功能等价基线可由脚本重复运行；
2. 至少 5 轮采样，并报告中位数而不是挑选最佳值；
3. 本地歌曲或大封面列表至少一个关键场景的总 Private Bytes 中位数下降 `>= 10%` 或 `>= 100 MiB`；
4. 10 次重页面往返后，稳定 60 秒的总 Private Bytes 不超过首次稳定值 `5%`；
5. Renderer JS Heap、DOM、canvas/WebGL、worker、object URL 中不存在随循环持续单调增长的指标；
6. sidecar、Electron 和 GPU/utility/renderer 全部纳入总量；
7. Discover、搜索、本地、播放、歌词、Folia、Aura、Diorama、下载、自定义源、设置等现有功能无行为回归；
8. build、typecheck、lint、contract、regression、smoke 和新增内存测试通过，或只保留已明确记录的既有失败基线；
9. 所有优化都有 feature flag 或可审计的回退提交；
10. 文档明确说明收益来自哪里，以及哪些开销无法通过 Native Core 消除。

若经过严谨归因仍无法达到第 3 项，不得伪造“完成”。应停在诊断结论，报告最大可控来源、已验证无效的方向以及下一项需要用户决策的结构性选择，例如 Electron/WebView2 壳 A/B；但本轮不得自行开始换壳。

## 7. 明确禁止

- 不把 Stage 2 自动解释为 Rust LibraryService；
- 不为了指标删除 Discover、动态封面、Folia、Aura、Diorama、歌词动画或降低默认视觉质量；
- 不只看 sidecar 内存；
- 不拿旧搜索空页面与当前 Discover 直接下性能结论；
- 不开始 DownloadService、Native Player、libmpv、WASAPI、FFT IPC、Tauri、Wails、WinUI 或 fooyin；
- 不让两套数据库 writer 并行；
- 不操作真实音乐原件或真实 profile；
- 不一次性做无法归因的大规模重构；
- 不 push，除非用户明确要求。

## 8. 工作方式与交付

开始前检查分支和工作树。必须位于 `hybrid-native`；若工作树非干净状态，先识别来源，不覆盖用户改动。阅读本文件、Stage 1 状态/性能/差异报告及当前源码，不重新研究 WinUI 或 fooyin。

执行顺序：基线脚本 → 归因报告 → 小步优化 → 每步 A/B → Library 决策门 → 最终回归。每个可独立审阅的修改单独 commit，不 push。

最终报告至少包含：

- 新的功能等价基线和测试条件；
- 各进程、JS Heap、DOM、图片、WebGL、worker 的归因；
- 实施和撤回了哪些实验；
- 每项保留优化的前后中位数；
- 全应用总内存是否达到门槛；
- 是否进入 Native LibraryService，以及证据；
- 若进入，shadow DB、分页、change feed、单写者和回退结果；
- 行为回归和既有失败基线；
- 下一阶段建议。

完成后停止，等待用户决定，不自动进入 Stage 3。
