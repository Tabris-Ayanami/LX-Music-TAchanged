# 播放器后端专项分析

## 结论

**现在不应直接迁移音频播放。** 先保留 HTMLAudioElement + Web Audio，完成 Backend API、metadata/artwork 和 library 后，再做一个有明确验收门槛的 libmpv sidecar 原型。只有原型同时满足行为兼容、可视化数据、设备切换和内存目标，才进入正式迁移。

若 libmpv 因 PCM/FFT tap、crossfade 或 DSP 行为无法满足需求，第二选择不是立即自研 WASAPI，而是继续保留 Web Audio；只有新增需求确实需要时，再评估 FFmpeg + miniaudio 的定制管线。

## 1. 当前实现能力

`src/renderer/plugins/player/index.ts` 以 HTMLAudioElement 为媒体时钟，延迟创建 Web Audio graph：

```text
HTMLAudioElement
  → MediaElementAudioSource
  → Analyser (fftSize = 256)
  → 10-band Biquad EQ
  → optional AudioWorklet pitch/phase vocoder
  → dry / Convolver
  → DynamicsCompressor
  → StereoPanner
  → Gain
  → destination
```

现有代码还处理：

- volume/mute、playbackRate 与 `preservesPitch`；
- `setSinkId` 和输出设备枚举；
- MediaSession；
- 播放失败恢复；
- 临近结束时用第二个静音 Audio 元素预加载下一首；
- `timeupdate`、播放状态与持久化节流；
- Analyser 直接供主可视化和 Folia 使用。

源码中没有发现真正的 ReplayGain、crossfade 或无缝拼接实现。不能把 native 迁移描述成“恢复已有功能”；它是新增能力与替换风险的交换。

## 2. 方案对比

| 能力 | HTMLAudio/Web Audio | libmpv sidecar | FFmpeg + miniaudio | Media Foundation | WASAPI 自研 |
|---|---|---|---|---|---|
| gapless | 弱/依赖浏览器与队列技巧 | 强，内建 gapless 模式 | 可做到，需自建队列/时钟 | 需额外状态机，格式切换复杂 | 不提供解码/队列 |
| seek | 当前成熟 | 成熟 | 需实现 flush/clock/预读 | 成熟但要自建业务层 | 不提供 |
| 格式兼容 | Chromium 支持范围 | 很广，基于 FFmpeg | 很广，基于 FFmpeg | Windows codec 范围 | 不提供 |
| EQ/DSP | 当前已有且易扩展 | 滤镜丰富，动态控制需验证 | 完全可控，开发量高 | MFT/自建，成本高 | 不提供 |
| pitch | 当前 AudioWorklet | 可用音频滤镜，听感/实时更新需验 | SoundTouch/Rubber Band 等 | 需额外 DSP | 不提供 |
| ReplayGain | 当前无 | 内建选项 | 自行读取/应用 | 自行实现 | 不提供 |
| volume | 已有 | 已有 | 自行实现，简单 | 已有/自建 | endpoint/session 自行管理 |
| crossfade | 当前无 | 非一等双 deck 能力，需原型 | 可完整实现，成本高 | 自建 | 自建全部上层 |
| spectrum/FFT | 零跨进程，当前已有 | 公共 client API 的 PCM tap 是风险点 | 最容易，PCM 已在手中 | 需 sample tap/MFT | PCM 可得但仍缺解码 |
| 设备选择 | `setSinkId`，受 Chromium 能力约束 | 设备枚举/选择成熟 | miniaudio 枚举/回调 | MMDevice/MF | 最直接 |
| exclusive mode | 无 | Windows WASAPI 选项可用 | 需后端支持/验证 | 不直接解决 | 最直接 |
| 延迟 | UI 播放足够 | 可配置，通常足够 | 可低延迟 | 通常足够 | 可最低但成本最高 |
| 稳定性 | 已在项目中成熟 | 成熟播放器内核，需打包验证 | 自己承担状态机与兼容 | Windows 官方栈 | 自己承担全部 |
| 总内存 | Chromium 音频图已存在 | 增加 sidecar/libmpv；可移除 AudioContext 部分 | 可控但增加 sidecar | 中 | 内核低但工程代码高 |
| 开发成本 | 零迁移成本 | 中至高 | 很高 | 高 | 极高 |

## 3. 各方案判断

### 3.1 保留 HTMLAudio/Web Audio

这是当前默认方案，不是过渡期的失败状态。

优点：

- 已经与 LX-TA 的状态机、MediaSession、设备选择、EQ、pitch、歌词和视觉系统集成。
- Analyser 数据在 Renderer 内直接读取，最适合 60/120 Hz 可视化。
- 开发和回归成本最低。

限制：

- 格式能力跟随 Chromium；难以提供真正 exclusive mode。
- gapless、跨格式切换和精确 crossfade 控制较弱。
- WebAudio/Chromium 音频图的内存不能通过其他模块 Native 化消除。

若实际用户问题主要不是格式、gapless 或独占输出，保留它可能一直是正确决定。

### 3.2 libmpv

libmpv 是最值得验证的成熟后端：它提供命令、属性、事件和异步 client API；mpv 文档提供 gapless、ReplayGain、设备枚举、WASAPI exclusive 等能力。官方说明中，`gapless-audio=yes` 会保持音频设备打开并让后续音轨适配首轨格式，而默认 `weak` 在格式变化时可重开设备，见 [mpv manual](https://mpv.io/manual/master/)。

适合点：

- FFmpeg 格式覆盖、seek、缓存、设备和错误恢复已有大量实践。
- 不需要 LX-TA 自己维护 demux/decode/resample/output 主循环。
- sidecar 进程隔离自然。

主要风险：

- 审阅的公开 [libmpv client API](https://github.com/mpv-player/mpv/blob/master/include/mpv/client.h) 以命令、属性和事件为中心，没有发现可直接承诺的稳定“解码后 PCM 回调”。因此 FFT/spectrum 数据接入必须做原型，不能假设零成本。
- crossfade 不是简单单播放器开关；可能需要双实例/双 deck 或复杂滤镜切换。
- 动态十段 EQ、pitch、卷积和当前音色要逐项比对。
- Windows build、动态库分发、GPL/LGPL 组件组合及硬解选项需要单独许可审计。

### 3.3 FFmpeg + 自定义输出

FFmpeg 负责 demux/decode/filter/resample，miniaudio 或其他输出库负责设备。

优点：

- PCM、时钟、队列完全受控，最容易实现精确 crossfade、FFT、waveform、ReplayGain 和自定义 DSP。
- 格式支持广，能针对 LX-TA 需求做最小产品。

缺点：

- 必须自己实现 seek flush、预读、格式切换、设备热插拔、欠载恢复、音频时钟、暂停/恢复、滤镜重配置、错误映射和测试矩阵。
- “能播放一首歌”与“长期稳定的桌面播放器”工作量差异巨大。
- FFmpeg API/构建/许可和平台音频 backend 都需要持续维护。

这只能是 libmpv 原型失败且需求足够强时的第二阶段重大项目。

### 3.4 miniaudio

miniaudio 是很好的低层设备和资源管理库，但不是与 libmpv 等价的完整播放器。官方文档的 low-level device callback 直接提供 PCM buffer，并支持设备枚举和 streaming resource manager，见 [miniaudio manual](https://miniaud.io/docs/manual/index.html)。

它适合作为 FFmpeg 自定义管线的输出层，或者播放简单已解码资源；不应被当成“引入一个头文件就得到完整媒体播放器”。

### 3.5 Windows Media Foundation

优点是 Windows 官方媒体栈、系统 codec/设备整合和较好的基础稳定性。问题是跨格式一致性、复杂 DSP、gapless/crossfade、精确 PCM 可视化和 exclusive mode 都需要额外工程。它更适合系统媒体应用，而不是 LX-TA 当前具有定制 Web Audio 图的替换目标。

### 3.6 WASAPI

WASAPI 是音频端点/流 API，不是 decoder、播放队列或播放器。exclusive mode 绕过 Windows audio engine，并要求应用与硬件格式协商；微软明确区分 shared/exclusive 的格式与缓冲约束，见 [WASAPI device formats](https://learn.microsoft.com/en-us/windows/win32/coreaudio/device-formats) 和 [exclusive-mode streams](https://learn.microsoft.com/en-us/windows/win32/coreaudio/exclusive-mode-streams)。

直接自研 WASAPI 意味着 LX-TA 还要承担 FFmpeg、时钟、转换、设备切换和所有 DSP。除非有明确、已测得的低延迟/独占需求，当前不应走这条路线。

### 3.7 其他成熟方案

- **libVLC**：播放和格式成熟，但 API/分发体积、滤镜和精准 PCM tap 仍需验证；相对 libmpv 没有明显项目级优势。
- **GStreamer**：pipeline 能力强、可插入 appsink/FFT，但 Windows 打包、插件选择和调试复杂，运维面大。
- **BASS/商业库**：可能降低开发成本，但有闭源/许可和长期供应依赖，不作为默认开源路线。

## 4. libmpv 原型的硬验收门槛

原型必须是独立目录/实验程序，不接管生产播放器。至少验证：

1. 现有格式语料、损坏文件、超长文件和网络 URL。
2. seek 延迟、连续快速 seek、暂停后 seek、切歌与错误恢复。
3. 同格式与不同采样率/声道的 gapless；用录制/样本对齐而非主观判断。
4. 当前十段 EQ、pitch、volume、mute、设备切换的行为对照。
5. ReplayGain track/album、preamp、peak clipping。
6. 默认/指定设备、热插拔、休眠恢复、独占失败回退。
7. 能否稳定取得 60/120 Hz 所需 spectrum 数据；数据延迟和 UI 音画同步。
8. 1000 次切歌/seek soak、崩溃恢复、句柄/线程/内存泄漏。
9. 真实常驻内存：Electron 现状总和 vs Electron + sidecar，不只比较单进程。
10. 安装包、签名、库许可和更新路径。

若第 7 项只能通过不稳定私有 API 或把 PCM 大量跨进程传输实现，则 libmpv 不通过 LX-TA 当前视觉需求的验收。

## 5. 状态与时钟模型

Native Player 若启用，必须成为唯一音频时钟：

- `generation` 标识一次 load；旧 generation 的异步事件全部丢弃。
- 控制 RPC 只发 play/pause/seek/load/parameter，不轮询当前位置。
- core 发低频权威时钟快照，Renderer 用 monotonic timestamp 在 RAF 插值。
- seek、buffering、暂停、速率变化、切歌和错误立即发 discontinuity。
- spectrum frame 携带同一 monotonic clock 和 generation，使视觉可以丢弃过期帧。

不要让 Renderer 时间、HTMLAudio 时间和 Native 时间同时成为权威。

## 6. 内存判断

Native Player 可能消除 HTMLAudio/Web Audio graph、AudioWorklet 和部分浏览器音频 buffer，但会新增：

- sidecar runtime；
- libmpv/FFmpeg 的 demux/decode/cache；
- 二进制可视化 buffer；
- 可能的预加载第二实例。

Chromium、WebGL、Folia、Three.js 和 UI 图片纹理完全不会因此消失。因此音频迁移必须以“格式/gapless/设备/稳定性是否值得”为主，以实测总内存为辅，不能假设原生语言自动更省内存。

## 最终建议

1. Stage 0–3 继续使用当前 HTMLAudio/Web Audio。
2. 把 `PlayerService` 接口先建好，但 Electron adapter 仍调用现有播放器。
3. Stage 4 做 libmpv sidecar 原型并按硬门槛判断。
4. 原型通过才灰度接入；不通过则保留 Web Audio。
5. 只有 libmpv 不满足而 gapless/exclusive/格式等需求又被数据证实重要时，才立项 FFmpeg + miniaudio。
6. 不直接自研 WASAPI。
