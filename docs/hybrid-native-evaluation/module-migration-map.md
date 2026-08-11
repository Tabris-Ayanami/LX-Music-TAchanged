# 模块 Native 化收益图

## 评级口径

- **保留在 Web/JS 最合理**：迁移不能消除主要成本，且会损失现有资产或增加协议维护。
- **可以 Native 化，但收益有限**：有局部稳定性或工程收益，但不是近期投资重点。
- **推荐 Native 化**：有清晰的性能、内存或可靠性收益，适合渐进替换。
- **强烈推荐 Native 化**：当前实现存在结构性复制、阻塞、格式或稳定性问题，且原生边界清晰。

“CPU/内存收益”是基于代码路径的方向判断，不是已经测得的数值。正式迁移前仍需基线测量。

## 总表

| 模块 | 结论 | CPU 收益 | 内存收益 | 稳定性收益 | 开发成本 | 主要风险 |
|---|---|---:|---:|---:|---:|---|
| 本地音乐库 | **强烈推荐 Native 化** | 中 | 高 | 高 | 高 | schema/排序兼容、单写者切换 |
| SQLite（单独看） | 可以 Native 化，但收益有限 | 低 | 低 | 中 | 中 | 当前已是 native SQLite + worker；重复造轮子 |
| SQLite（作为 LibraryService） | **推荐 Native 化** | 中 | 高 | 高 | 高 | 迁移/回滚、并发写 |
| 文件扫描 | **强烈推荐 Native 化** | 中至高 | 中 | 高 | 中 | junction/symlink、权限、取消、超大目录 |
| 文件监听 | **推荐 Native 化** | 低 | 低 | 高 | 中至高 | 丢事件、重命名风暴、网络盘 |
| metadata/tag 读取 | **强烈推荐 Native 化** | 中 | 中 | 高 | 中 | 编码和格式兼容 |
| metadata/tag 写入 | **强烈推荐 Native 化** | 中 | 低 | 高 | 中至高 | 文件损坏、锁定、回滚 |
| artwork/封面处理 | **强烈推荐 Native 化** | 高 | 高 | 高 | 中 | 色彩/方向/动画图兼容 |
| 缩略图生成与缓存 | **强烈推荐 Native 化** | 高 | 高 | 高 | 中 | cache 失效和磁盘预算 |
| 音频播放 | 可以 Native 化，但收益有限（近期；验收通过后再升级为推荐） | 视方案 | 中 | 中至高 | 很高 | 行为回归、可视化、设备兼容 |
| 解码 | 推荐 Native 化，但只随 Native Player | 高 | 中 | 高 | 高 | 不应与 Web 播放链路拆成两套时钟 |
| DSP/EQ | 保留在 Web/JS 最合理（当前；随播放器整体迁移） | 低 | 低 | 低 | 中至高 | 双重处理、音色不一致 |
| ReplayGain | 推荐 Native 化（新增功能或 Native Player 时） | 低至中 | 低 | 中 | 中 | 扫描标准、峰值防削波 |
| pitch | 保留在 Web/JS 最合理（当前；随播放器整体迁移） | 低至中 | 低 | 低 | 中 | 算法音质和许可 |
| waveform | 保留在 Web/JS 最合理（当前实时波形；离线整曲波形推荐 Native） | 中 | 中 | 中 | 中 | 需求含义混淆、cache 体积 |
| FFT/spectrum | 保留在 Web/JS 最合理（当前；随 Native Player 整体迁移） | 中 | 低 | 中 | 中 | 高频跨进程复制和同步 |
| 下载 | **推荐 Native 化** | 低 | 中 | 高 | 中至高 | 断点续传/代理/证书兼容 |
| FFmpeg | 可以 Native 化，但收益有限（迁 job 管理；FFmpeg 本体继续独立） | 中 | 中 | 高 | 中 | 分发、许可、参数兼容 |
| Bilibili 媒体处理 | 保留在 Web/JS 最合理（协议；数据面随 DownloadService） | 低 | 低至中 | 中 | 中 | API 高频变化、cookie/WBI |
| 网络请求 | **保留在 Web/JS 最合理** | 低 | 低 | 低 | 高 | 行为/代理/证书回归 |
| 自定义音乐源 | **保留在 JS 最合理** | 无 | 无 | 负收益 | 极高 | 用户脚本天然是 JS，兼容性破坏 |
| 设置与持久化 | 保留 Web/JS 最合理；仅统一接口 | 低 | 低 | 中 | 中 | 一次迁移造成数据丢失 |
| Windows 系统集成 | 保留在 Web/JS 最合理（Electron Main；后期 host adapter） | 低 | 低 | 中 | 中 | 壳层 API 差异 |

## 逐项分析

### 1. 本地音乐库 — 强烈推荐 Native 化

当前列表、数据库 worker 缓存和 Renderer 状态会同时保留大量歌曲对象；数据库层的 `meta` 又以 JSON 保存并整批返回。Native 化的真正价值不是把 SQL 从 JS 改成 Rust，而是统一扫描、索引、分页查询、变更订阅和数据所有权。

- CPU：批量解析、排序、过滤和增量索引可避免反复反序列化。
- 内存：只返回 `TrackSummary` 可见页，减少 Main/Renderer 多份整表对象，收益高。
- 稳定性：单写者、事务、schema migration 和可恢复 scan job 更清晰。
- 成本：高；要兼容现有列表语义、排序、自定义字段和下载记录。
- 风险：两个实现同时写库；旧 JSON 字段的演进；以路径作为身份导致 rename 误判。

### 2. SQLite — 单独 Native 化收益有限

`src/main/worker/dbService/db.ts` 已经是 `better-sqlite3` 原生 binding，启用 WAL，并运行在 worker thread。仅把它替换成 Rust/C++ SQLite 不会带来数量级 CPU 提升。

它应在 LibraryService 切换时一并迁移，以获得分页、projection、prepared query、单写者和更少对象复制；不能把“换驱动”当成独立里程碑。

### 3. 文件扫描 — 强烈推荐 Native 化

当前 `src/renderer/utils/localMusic.ts` 在 Renderer 使用 Node `fs/promises` 递归扫描，格式白名单也窄于 metadata 服务。Native scanner 可使用有界并发、取消、目录身份、批量提交和 backpressure，避免 UI 进程承受路径对象及错误风暴。

- CPU：中至高，尤其是大量小文件、规范化和去重。
- 内存：有界批次能降低峰值，但扫描结果最终如何持有更关键。
- 稳定性：对权限错误、junction、循环、离线盘和长路径可显式处理。
- 成本：中。
- 风险：Windows 重解析点、大小写、UNC/网络盘、扫描期间文件变化。

### 4. 文件监听 — 推荐 Native 化

当前没有持续 watcher。Windows watcher 只应提供“变化提示”，LibraryService 仍需定期或触发式 reconciliation；不能假设每个 `ReadDirectoryChangesW` 事件都可靠且一一对应业务变化。

- CPU/内存：收益不大；价值主要是增量刷新和可靠性。
- 成本：中至高。
- 风险：缓冲区溢出、批量重命名、网络盘行为、休眠恢复。

### 5. metadata/tag 读取 — 强烈推荐 Native 化

当前同时存在 Renderer worker 的 `music-metadata` 和 Main 的 `taglib-wasm`，可能形成两套格式与字段映射。直接使用 TagLib 的 Native API，并把字段映射固化在 MetadataService，可移除 WASM heap、减少文件数据复制，统一格式支持。

- CPU：中；大型库批扫更明显。
- 内存：中；避免把整文件/封面转成 JS/WASM 对象。
- 稳定性：解析崩溃由 sidecar 隔离。
- 成本：中。
- 风险：TagLib 与 `music-metadata` 在日期、多值字段、编码和特殊容器上结果不同，必须建立语料库差分测试。

### 6. metadata/tag 写入 — 强烈推荐 Native 化

当前 `src/main/modules/localMusicTools/metadata.ts` 已有良好的临时副本、回读校验、备份替换和回滚流程。Native 实现必须复制这些事务语义并增加 fsync/故障注入测试，不能直接原地写。

- CPU/内存：不是主要目标。
- 稳定性：sidecar 隔离、统一文件锁和原子提交可显著提升。
- 成本：中至高。
- 风险：杀进程、磁盘满、杀毒软件占用、非 NTFS 目标、只读文件、TagLib 格式限制。

### 7. artwork/封面处理 — 强烈推荐 Native 化

当前 embedded cover 会通过 base64 data URL 进入 JS，浏览器可能解码原始尺寸图片。base64 增加约三分之一传输体积，还会产生字符串、二进制和解码纹理多份表示。

Native ArtworkService 应直接提取并输出有尺寸上限的 WebP/JPEG/PNG 变体、主色/模糊占位信息和内容句柄。

- CPU：高，缩放/编码可在线程池批处理。
- 内存：高，避免原图、base64 与 GPU 大纹理。
- 稳定性：损坏图片解析与 UI 隔离。
- 成本：中。
- 风险：EXIF 方向、ICC、透明度、动画封面以及不同编码器输出差异。

### 8. 缩略图生成与缓存 — 强烈推荐 Native 化

当前 cover cache 主要按 `path:mtime:size` 的 SHA-1 写入 temp，并有 Renderer 内存 Map；缺少统一的尺寸变体、总字节预算和持久索引。

Native cache 应有：内容身份、variant、原子写、LRU、总字节/文件数上限、版本化编码参数、启动时快速修复。收益主要来自减少重复解码和 GPU 纹理尺寸。

### 9. 音频播放 — 近期只做原型，不立即迁移

当前 Web Audio 图已经承载 EQ、pitch、卷积、压缩、声像和 analyser；迁移播放会同时触及状态机、设备、错误恢复、MediaSession 和可视化。Native 后端可带来更宽格式、真实 gapless、ReplayGain、独占模式及更明确设备控制，但不保证降低总内存，sidecar/libmpv 本身也会常驻。

结论：前三阶段保留；之后仅以 libmpv spike 验证，详见 `audio-backend.md`。

### 10. 解码 — 只随播放器整体迁移

不要让 Native 只解码，再持续把 PCM 跨进程喂给 Web Audio：44.1/48 kHz 双声道 PCM 会产生持续复制、时钟和 backpressure 问题，却仍保留两端管线。若迁移，解码、队列、DSP 和输出应共处一个音频进程。

### 11. DSP/EQ — 当前保留 Web

现有十段 Biquad EQ 的 CPU 不是已证实瓶颈。将 EQ 单独搬到 Native 会制造两个控制面和音色差异；只有 PlayerService 整体切换时才迁移。Native 后端必须保存参数单位、Q、增益范围、旁路和切歌平滑语义。

### 12. ReplayGain — 新增时放在 Native 音频/分析层

当前播放器没有实际 ReplayGain 路径。若添加：离线扫描使用 libebur128 或等价成熟实现；播放时应用 track/album gain、preamp 与峰值防削波。没有必要引入 fooyin 模块来做简单线性增益。

### 13. pitch — 当前保留 Web

现有 AudioWorklet phase vocoder 已融入 Web Audio 图。它只有在 Native Player 替换时才应跟随迁移，并通过听感、CPU、延迟测试选择 SoundTouch、Rubber Band 或后端自带滤镜。

### 14. waveform — 区分两类需求

- 当前“实时波形”来自 Analyser 的时域采样：保留 Web 最合理。
- 若新增“整首概览波形/可拖动 seek 波形”：推荐 Native 解码后生成多分辨率 min/max/RMS 二进制缓存，UI 只绘制。

### 15. FFT/spectrum — 跟随音频引擎

当前 Analyser 与 Web Audio 同进程，数据无需穿越 native 边界，保留最省成本。若播放迁到 Native，则 FFT 也在音频端计算，只传 128–256 个 bins 的二进制快照，避免把 PCM 传给 UI。

### 16. 下载 — 推荐 Native 化

下载的主要收益是可靠性，不是纯 CPU。Native DownloadService 可统一断点续传、临时文件、校验、限速、取消、崩溃恢复和最终原子提交，并减少 Renderer download worker 与 IPC 状态复制。

- CPU：低；TLS/网络通常不是 JS 瓶颈。
- 内存：中；使用有界 buffer。
- 稳定性：高。
- 成本：中至高。
- 风险：代理、证书、Range 语义、旧任务数据库兼容和源站特殊行为。

### 17. FFmpeg — 保持进程隔离

当前使用随包 FFmpeg 子进程做 Bilibili 音频转换。第一版 Native Core 应继续把 FFmpeg 当受管子进程：参数白名单、进度解析、取消、stderr 日志、超时和临时文件清理。静态链接 libav* 会增加构建、崩溃面和许可审计，只有 Native Player 或高吞吐批处理确有需要时再评估。

### 18. Bilibili 媒体处理 — 拆分控制面与数据面

WBI、cookie、搜索和 URL 解析变化快，现有 JS 逻辑更易维护，应留在 SourceService。URL 已解析后，实际字节下载、合并/转码和文件提交可交给 Native DownloadService。不要把快速变化的站点协议编译进 core。

### 19. 网络请求 — 保留 Web/JS 最合理

当前在线源 SDK、代理行为和兼容逻辑广泛使用 JS。改成 Native HTTP client 对 CPU/内存帮助很小，却会引入 TLS、代理、cookie、压缩、重定向差异。先统一 `SourceService`/`HttpTransport` 接口；只有下载大文件的数据面迁移。

### 20. 自定义音乐源 — 必须保留 JS

用户提供的源本身就是 JavaScript，并依赖 `globalThis.lx` 协议。把它“Native 化”没有语义意义。长期可把 hidden BrowserWindow 换成受限的 Node utility process/独立 JS sandbox，减少额外 Chromium 页面，但这是安全隔离项目，不是 Native Core 项目。

### 21. 设置与持久化 — 以统一接口为主

主题、布局、页面临时状态留在 Web。跨 host 的业务设置可逐步进入 SettingsService，使用原子写和 schema version；安全凭据交给 host 安全存储。当前 JSON 与 localStorage 不应一次性搬迁。

### 22. Windows 系统集成 — 当前留在 Electron Main

窗口、托盘、全局快捷键、协议、单实例、更新器和任务栏按钮是 host 职责。把它们放进 headless core 会反而阻碍未来换壳。只有音频设备枚举/独占模式等与 PlayerService 强相关的能力，在 Native Player 阶段进入 core。

## 优先级结论

第一批三个投资单元不是“SQLite、FFmpeg、音频”这种底层库清单，而是：

1. **MetadataService**：统一读取和事务式写入，直接使用 TagLib。
2. **ArtworkService**：尺寸化输出、无 base64、持久 LRU/字节预算缓存。
3. **LibraryService**：扫描、监听、索引、SQLite 单写者、分页和增量变更一体化。

这三项边界清晰、可逐个回退，并且直接命中当前的 JS/WASM heap、图片解码和整表对象复制问题。
