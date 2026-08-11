# fooyin：依赖归因与可复用性复评估

## 结论

fooyin 应定位为 **架构参考**，不 Fork、不链接其 Core，也不以抽取现有模块为迁移路线。最多在完成 GPL 许可审查后，参考少量隔离算法/测试思路并自行实现。

原因不是 fooyin Core 没有价值，而是它的“Core”不是 UI 无关、Qt 无关的 SDK。当前本地源码版本 `0.11.1` 使用 C++23，并在 core 的公共/内部边界广泛暴露 Qt 字符串、容器、对象模型、signals/events、QtSql、QtNetwork 和 Widgets。为复用 metadata/library/playback 的少量 orchestration 而引入 Qt，会建立新的、难移除的基础设施绑定。

此外，fooyin 为 GPL-3.0 项目。直接复制、修改或链接代码的分发义务必须由正式许可审查确认；这进一步支持“只做架构研究，不直接复用代码”的保守边界。

## 1. 本地源码依赖事实

`references/fooyin/CMakeLists.txt` 的必需依赖包括：

- Qt6 Core、Widgets、Gui、Sql、Concurrent、Network、Svg；
- ICU；
- TagLib；
- FFmpeg `avcodec`, `avfilter`, `avformat`, `avutil`, `swresample`。

其 vcpkg/插件生态还使用 SDL2、libopenmpt、libsndfile、libarchive、libgme、SoundTouch、SoXR 等。

更关键的是 `references/fooyin/src/core/CMakeLists.txt`：core 对外链接 Qt6 Core/Widgets/Sql/Concurrent/Network、TagLib 等。源码静态检视中：

| 区域 | 文件数（约） | Qt 标识命中（约） | 典型依赖 |
|---|---:|---:|---|
| database | 18 | 112 | QSqlDatabase、QString、Qt model |
| engine | 129 | 575 | QObject、signals、Qt 容器、FFmpeg |
| library | 32 | 379 | QtSql、QFuture、Qt model/events |
| network | 10 | 133 | QNetwork、QUrl |
| playback | 16 | 16 | Qt 基础类型/事件 |
| playlist | 11 | 266 | Qt model/container |
| scripting | 23 | 528 | Qt/JS bridge |

这些数字只是耦合规模指示，不代表代码质量。但它们足以否定“抽几个 core 文件即可无 Qt 复用”的假设。

## 2. 能力究竟来自哪里

| 能力 | 主要来源 | fooyin 自己的价值 | Qt 的作用 |
|---|---|---|---|
| demux/decode | FFmpeg | pipeline 编排、状态机、错误处理 | 类型、任务、事件/对象生命周期 |
| resample/filter | FFmpeg、SoXR 插件 | 参数/插件编排 | 配置与对象模型 |
| metadata/tag | TagLib | 字段映射、Track 模型、扫描策略 | QString/容器、模型、任务 |
| 数据库 | SQLite 经 QtSql | schema、repository、library 语义 | DB API、model/events |
| 文件扫描/监听 | OS + Qt filesystem watcher | 调度、增量更新策略 | watcher、路径、future/event |
| ReplayGain 播放 | 简单增益计算 | 模式/clip 策略 | 配置/processor 生命周期 |
| ReplayGain 扫描 | FFmpeg、可选 libebur128 | job 编排、结果持久化 | task/model |
| pitch/time stretch | SoundTouch 插件 | 插件桥与参数 | plugin/config 模型 |
| FFT | PFFFT | visualisation backend 和数据路由 | 事件/插件集成 |
| waveform | FFmpeg/音频 loader | min/max/RMS 下采样与 cache 编排 | Qt DB、model、绘制数据 |
| 输出设备 | SDL2 等插件 | queue、clock、backend abstraction | plugin/event/config |

fooyin 的显著自有价值集中在“成熟播放器怎样组织 pipeline、队列、时钟、seek/transition、任务和 cache”，不是它重新发明了 codec、tag 或 SQLite。

## 3. A/B：引入 fooyin 模块 vs 直接底层库

### 3.1 Metadata

**A. 引入 fooyin metadata 层**

- 得到字段映射和 Track 集成；
- 同时带入 QString/Qt 容器、fooyin Track 模型、任务/事件和相关配置；
- LX-TA 仍需把 fooyin Track 转换成自己的 DTO，并复刻当前事务式写入语义。

**B. 直接使用 TagLib**

- 只暴露 LX-TA 自己的 `TrackMetadata`；
- 可以保持临时文件、回读校验、备份和回滚；
- 依赖更小、测试边界清楚。

**选择 B。** 当前项目已在 `src/main/modules/localMusicTools/metadata.ts` 使用 taglib-wasm，字段和写入行为已有可迁移依据。

### 3.2 Decoder / Playback

**A. 引入 fooyin playback/engine**

- 能借到较成熟的播放编排、FFmpeg pipeline 和插件体系；
- 会引入大量 Qt Core/事件/容器、FFmpeg ABI、插件系统和 SDL output；
- Windows SDL backend 代码中还显式选择 DirectSound，并注释 WASAPI driver 存在问题，目标队列约 200 ms。这并不符合 LX-TA 若追求 WASAPI exclusive/低延迟的方向。

**B. 直接使用成熟播放器/库**

- 首选验证 libmpv，复用其 FFmpeg/设备/seek/gapless/ReplayGain 能力；
- 若必须完全掌握 PCM，再评估 FFmpeg + miniaudio；
- LX-TA 只维护自己的 PlayerService 和视觉 telemetry contract。

**选择 B，且先保留 Web Audio。** fooyin engine 值得研究状态机和测试用例，不值得直接链接。

### 3.3 媒体库

**A. 引入 fooyin library/database**

- 获得其 schema、repository、扫描/监听流程；
- 同时绑定 QtSql、Qt model、QString/QList、signals/futures 和 fooyin Track 身份。

**B. 自建 SQLite Native LibraryService**

- schema 和 DTO 直接匹配 LX-TA；
- 可针对当前整表返回问题设计分页/projection/change feed；
- 无需在两个媒体库领域模型间持续转换。

**选择 B。** 数据库代码本身不是难点，兼容 LX-TA 的列表、排序、下载与来源语义才是难点；引入 fooyin schema 不会消除这项工作。

### 3.4 ReplayGain

fooyin 的播放增益部分本质是模式选择、线性 gain 与防削波策略；扫描依赖 FFmpeg/可选 libebur128。直接使用 libebur128 计算 loudness，再在 LX-TA 播放器应用 gain，边界更小。

### 3.5 Pitch / resample / FFT

- pitch：直接评估 SoundTouch 或 Rubber Band，不引入 fooyin 插件框架。
- resample：优先播放器后端自带；自定义管线再直接使用 FFmpeg swresample/SoXR。
- FFT：Web Audio 继续用 Analyser；Native Player 可用 Rust FFT/PFFFT/其他小库，输出自己的二进制 bins。

### 3.6 Waveform

fooyin 的 min/max/RMS 下采样和缓存结构值得参考，但算法不需要 fooyin Track/Qt DB。LX-TA 应按自己的文件身份、缩放级别和二进制格式实现。

## 4. 值得借鉴的部分

只做设计与测试参考：

- 音频时钟与 queue 的所有权；
- seek/transition/gapless 的状态转换；
- audio callback 与 worker/task 的隔离；
- ring buffer/backpressure；
- output/decoder/filter 的 capability 边界；
- library scan job、取消、批量提交；
- waveform cache 和无效化；
- 插件错误不会破坏主状态的思路；
- 长时间播放、切歌、seek、设备重连测试。

可以复用概念和公开行为测试，不复制类层次、Qt event 或数据库模型。

## 5. 不值得直接复用的部分

- `src/core` 整体；
- Track/string/container 模型；
- QtSql repository 与 Qt item model；
- QObject/signal 驱动的事件总线；
- QtNetwork 与 scripting host；
- SDL/DirectSound output 作为 Windows 高质量音频默认；
- 只为一个算法而引入的 fooyin plugin framework。

## 6. 许可与工程门禁

任何从 fooyin 复制代码的提议必须先回答：

1. 是否构成 GPL 衍生/组合发布，LX-TA 的发布方式是否兼容？
2. 能否仅根据公开行为和文档 clean-room 重写？
3. 直接依赖底层库是否有更宽松、清晰的许可证？
4. 引入代码能否不暴露 Qt 类型和 fooyin model 到 core API？
5. 该段代码是否真正比独立实现和测试更便宜？

默认答案是“不复制”。本文件不是法律意见；若未来确有直接复用需求，必须单独做许可审查。

## 最终定位

- 不是 Fork 目标。
- 不是新 Native Core 的基座。
- 不是 metadata/library/decoder 的依赖入口。
- 是播放器架构、状态机、缓存和测试设计的参考实现。
- 极少量算法只有在许可审查、去 Qt、独立 benchmark 均通过后才可能考虑；当前路线不依赖这种复用。
