# 最终建议与路线决策

## 一句话结论

**停止继续推进 WinUI 全量重写和 fooyin Fork，把当前 Electron 版本转为“保留 Web UI、先统一 Backend API、用 Rust sidecar 渐进替换本地重任务、最后再独立决定是否换 Electron 壳”。**

这是基于当前源码资产和耦合位置的明确选择，不是折中表述。

## 1. “保留 Web UI + Native Core”是否比 WinUI 全量重写更合理？

**是，明显更合理。**

原因：

1. LX-TA 的差异化资产主要在 Vue/React/CSS、歌词视觉、Folia、Aura、Diorama、Three.js/WebGL 和既有交互状态，而不是 Windows 控件。
2. 当前真正适合 Native 化的热点集中在文件、metadata/artwork、媒体库数据所有权、下载，以及可能的后期音频；它们可以在不重做 UI 的情况下替换。
3. 现有 WinUI 迁移文档已经显示图形、状态、媒体和平台语义需要大量重新实现。即使底层更轻，达到现有 UI/动画行为等价的成本和回归面都很高。
4. Hybrid 路线能逐模块 feature flag、影子验证和回退；WinUI 全量重写在长时间内必然维护两套产品，集成风险更集中。

Native UI 可能有更低的最终基础内存，但这并不自动抵消重写成熟视觉资产的成本，也不证明用户可感知性能一定更好。

## 2. 是否应该停止当前 WinUI 全量迁移？

**应该。立即停止在现有 Slice 1，不进入 Slice 2。**

不删除现有 `native/*`：

- 保留为 SQLite/schema/contract 的参考；
- 用作只读媒体库和启动/内存 benchmark 对照；
- 其中可复用的测试思路可以迁到 Backend contract tests。

但不要继续为 WinUI 页面、视觉或播放器做正式实现。在路线决策前继续 Slice 2 会增加沉没成本，并不能验证 Hybrid 的核心风险。

## 3. fooyin 应该如何处理？

在给出的选项中选择：**仅作为架构参考。**

- 不 Fork。
- 不链接整个 Core。
- 当前不直接复用其模块。
- 研究其音频时钟、队列、seek/transition、ring buffer、scan job、waveform cache 和 soak tests。
- metadata 直接用 TagLib；library 直接用 SQLite；decoder 首先验证 libmpv；ReplayGain 直接用 libebur128/增益策略；pitch 直接评估 SoundTouch/Rubber Band。

即使只抽少数 fooyin 模块，也会遇到 Qt QString/容器/QObject/events/QtSql/QtNetwork/Widgets 和 fooyin Track 模型；收益不足以承担绑定和 GPL 许可审查面。

## 4. 第一批最值得 Native 化的三个模块

按顺序：

1. **MetadataService**：直接使用 Native TagLib；统一读写；保留临时副本、回读校验、备份和回滚。
2. **ArtworkService**：原生提取/缩放/编码，输出尺寸化资源，消除 base64，建立有字节预算的持久 cache。
3. **LibraryService**：把扫描、监听、索引、SQLite 单写者、分页/projection 和 change feed 合在一起。

注意：SQLite 不应单独作为“第一个 native 模块”，因为当前 `better-sqlite3` 已经是原生 SQLite 且位于 worker。LibraryService 的内存与所有权重构才是收益来源。

## 5. 哪些模块绝对不值得 Native 化？

在当前产品目标下，以下内容不应迁入 Native Core：

- Vue/React UI、CSS、页面状态、路由和交互草稿；
- 歌词视觉、Folia、Aura、Diorama、Three.js/WebGL 渲染；
- 自定义音乐源脚本本身；
- 高频变化的在线源/Bilibili 协议逻辑首期实现；
- 普通网络请求层，只为“原生”而换 HTTP client；
- 主题、布局、临时页面状态；
- Window/Tray/Global Shortcut/updater 等 host 职责放进 headless core。

实时 FFT、EQ、pitch 不是“永远 Web”，而是必须跟随唯一音频引擎：播放器留 Web 时它们留 Web；播放器整体迁移时再一起迁，不能拆成两套管线。

## 6. Native Core 使用什么语言和通信？

**Rust 独立 sidecar process。**

- 无 Qt、无 WinUI、无 UI toolkit。
- 控制面：Windows named pipe 上的长度前缀、版本化 RPC；首版 JSON 以便诊断，热点按测量切 MessagePack/CBOR。
- 高频数据面：固定 binary frame；Electron 阶段可用 MessagePort adapter，跨 host 优先评估带会话鉴权的 localhost WebSocket。
- playback position：4–10 Hz 权威时钟快照 + Renderer RAF 插值，不发 60/120 Hz JSON。
- FFT/spectrum：Native 计算后发 128–256 bins `Float32` 快照，latest-wins；不把 PCM 发给 Renderer。
- shared memory/SAB：不是第一版；只有 binary stream 实测失败才引入。

C#/.NET sidecar 是第二选择；如果团队长期维护能力明确偏 C#，可以重新权衡。C++ 适合作为第三方库/局部音频内核，不作为默认全 core。N-API 和进程内 C ABI DLL 不适合作为总边界，因为崩溃会带走 Electron 进程并锁定 host。

## 7. Electron Main 最终可以缩小到什么程度？

最终只保留：

- Window/生命周期；
- Tray/Menu/Global Shortcut；
- single instance、protocol/deep link；
- updater/relaunch；
- dialog/shell/safeStorage 等少量 PlatformService；
- Native Core supervisor、握手和安全 bridge。

数据库、扫描、metadata、artwork、下载、FFmpeg job 和可选播放器全部移出。自定义源仍是 JS，但可以独立隔离；不再让普通 UI 拥有 Node 权限。

这能显著改善故障边界和架构，并减少一部分 worker/JS 数据，但 Electron Main 仍有 Node runtime，Chromium 进程也仍存在。

## 8. Native Core 完成后再替换 Electron 壳是否现实？

**现实，而且届时成本会显著低于现在换壳。**

前提是 Web UI 只依赖 Backend/PlatformService，资源使用标准 URL/stream，Renderer 没有 Electron/Node import，高频流也没有硬编码 Electron channel。

- Tauri/WebView2 是更自然的第一候选，尤其 core 使用 Rust；sidecar 仍可保持隔离。
- Wails/WebView2 技术上可行，但会增加 Go host；除非其窗口能力或团队经验有明确优势，不优先。
- 直接自建 WebView2 host 成本最高，不作为默认。

WebView2 仍基于 Chromium。换壳可能降低安装包、Electron Node/Main 和部分基础常驻开销，但不会消除 Web UI、WebGL、图片纹理和视觉效果的内存。必须以相同 workload A/B，而不是根据框架宣传数字决定。

## 9. 四条路线的位置

以下为相对等级；“性能收益”包括可达上限与实现概率，不代表已测得数值。

| 路线 | 开发成本 | 可兑现性能/内存收益 | 交付风险 | UI 资产保留 | 长期绑定 | 建议 |
|---|---|---|---|---|---|---|
| 当前 Electron 不重构 | 低 | 低 | 低（短期）/中（长期） | 完整 | Electron/Node/历史 IPC | 只作为基线，不作为长期路线 |
| Web UI + Rust Native Core | 中至高、可分期 | 中至高，集中在数据/媒体重任务 | 中，可回退 | 完整 | 自有协议 + 少量底层库 | **推荐** |
| WinUI 从零重写 | 极高 | 理论高，兑现时间长 | 极高 | 需要重做 | Windows/WinUI | **停止主路线** |
| fooyin Fork/Qt UI | 高 | 播放器底层较高，UI 未必匹配 | 高 | 大量丢失/重做 | Qt + fooyin 模型 + GPL | **不采用** |

Hybrid 不会达到纯轻量 native UI 的理论最低内存，但它最有可能在合理成本内兑现本地库、封面和任务稳定性收益，同时保住 LX-TA 的产品价值。

## 10. 内存：什么能消除，什么不能

### 当前可能的主要来源

仓库没有足够的同口径运行测量来给出 MB 排名，以下是基于实现的候选及验证方向：

| 来源 | 当前依据 | Native Core 可消除？ | 处理建议 |
|---|---|---|---|
| Chromium 基础进程 | Electron renderer/GPU/network | **不能**，除非后期换壳；WebView2 仍有 Chromium 引擎 | 单独测进程树 |
| Electron Main Node | Electron 必需 | **不能**，只要仍用 Electron | 让 Main 变薄，不夸大内存收益 |
| 多进程/worker | DB worker、Renderer workers、hidden source window | **部分能** | 合并任务到 sidecar；源 runtime 另做隔离 |
| Vue/React 状态 | 模块级 reactive/ref/Map 与列表 | **不能自动消除** | 分页/projection 可减少库对象；UI 状态仍在 |
| 数据库结果重复 | worker cache + IPC 数组 + Renderer 列表 | **能显著减少** | Native 单写者、分页、change feed |
| 图片解码/base64 | embedded cover data URL、原图尺寸 | **能显著减少** | Native thumbnails、handle/URL、字节预算 |
| artwork cache | temp 文件 + 内存 Map，策略分散 | **能部分减少** | 统一 cache 与尺寸变体 |
| WebGL textures | Three/Folia/Aura/Diorama | **不能** | 前端做纹理预算、dispose、不可见暂停 |
| 隐藏页面 | mounted UI/hidden BrowserWindow | **不能自动消除** | UI 生命周期；自定义源可另迁 JS process |
| JS 对象 | 页面/列表/事件闭包 | **部分能** | 大型媒体数据移出；视觉/页面对象仍在 |
| worker | main/download/Aura 等 | **部分能** | 媒体 worker 可移出；视觉 worker 保留 |
| audio pipeline | HTMLAudio + AudioContext/Worklet | **只有 Native Player 后** | 但会新增 libmpv/sidecar/cache |
| FFmpeg | 转码期间子进程 | **不会凭语言消失** | 继续按需进程，限制并发并确保退出 |

### 最可能的前三个真实内存收益

1. artwork 不再 base64/原图解码，列表只使用尺寸化缩略图；同时降低 CPU、JS heap、decoded image 和 GPU texture。
2. LibraryService 不再把全库和 JSON `meta` 多份复制到 worker/Main/Renderer，使用分页和 projection。
3. 移除 taglib-wasm 和部分 Node worker 常驻，媒体任务集中到有预算的 sidecar。

### 即使完成 Native Core 仍会存在

Chromium/WebView renderer、Vue/React、DOM/CSS、Folia、Three.js、WebGL textures、可见/隐藏组件状态、浏览器字体/图片 cache 和 UI 需要的 JS 对象。若播放仍是 WebAudio，音频 graph 也仍存在；若播放转 Native，只是把一部分内存换到 sidecar，并不保证总和下降。

因此每阶段必须报告“全应用总 private working set + commit + GPU + JS heap”，不能只展示 Native Core 的 RSS，也不能拿 idle native 播放器和开启 Folia/Diorama 的 LX-TA 比较。

## 11. 执行优先顺序

1. Stage 0：Backend API、基线、禁止新增直接 IPC/Node 依赖。
2. Stage 1：Metadata + Artwork。
3. Stage 2：Library + Scanner + Watcher + SQLite 单写者。
4. Stage 3：Download + 受管 FFmpeg；Bilibili/在线源协议仍是 JS。
5. Stage 4：libmpv 研究门；不通过就保留 Web Audio。
6. Stage 5：Renderer 去 Node、Electron Main 极薄。
7. Stage 6：用实测独立决定 Electron/Tauri/Wails。

## 当前状态与下一决策

Stage 1 已于 2026-08-19 完成本轮限定范围：Rust sidecar、真实媒体 corpus、Native Metadata shadow、安全写入、Native Artwork variants/cache、feature flag 与 Electron 回退均已落地。详见 [stage-1-status.md](stage-1-status.md)。

下一步建议可以进入 Stage 2，但 Metadata read 继续 shadow、Native write 继续 opt-in；先修复 MP3 comment/WV year promotion blocker，并让新 LibraryService 使用独立 shadow index。当前仍不应：

- 默认启用 Native metadata write；
- 让两套实现同时写 metadata 或数据库；
- 把现有 SQLite 所有权直接交给 sidecar；
- 继续 WinUI Slice 2；
- Fork fooyin；
- 先写 WASAPI 播放器；
- 先把所有 IPC 机械翻译成 native RPC。

相关细节分别见：

- `architecture.md`
- `module-migration-map.md`
- `native-core-options.md`
- `audio-backend.md`
- `ipc-and-shared-memory.md`
- `electron-thinning-plan.md`
- `fooyin-reuse.md`
- `migration-plan.md`
