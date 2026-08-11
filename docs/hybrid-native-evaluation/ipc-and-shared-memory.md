# IPC、高频数据与共享内存

## 结论

使用双通路：

- **控制面**：Electron Main ↔ Native Core 的 named pipe framed RPC；低频、可靠、可取消、可追踪。
- **数据面**：Native Core ↔ Renderer 的本机、带会话鉴权的 binary WebSocket，或 Electron 专用的 MessagePort + transferable buffer adapter；高频流采用固定二进制帧、latest-wins 和丢帧策略。

第一版不要上 OS shared memory，也不要让 playback position 以 60/120 Hz 穿越 IPC。SharedArrayBuffer 不能让独立 native 进程自动获得同一块内存，必须有额外映射桥，因此只在二进制流经测量仍不达标时使用。

## 1. 数据按语义分层

| 数据 | 频率/规模 | 可靠性 | 推荐通路 |
|---|---|---|---|
| play/pause/seek/load | 用户操作 | 必须有响应 | 控制 RPC |
| track/state/error | 状态变化 | 有序、可恢复 | 控制事件流 |
| scan/download progress | 1–10 Hz | 可合并 | 控制事件流，latest-wins |
| playback position | UI 60/120 Hz 显示 | 不需每帧权威值 | 4–10 Hz 时钟快照 + RAF 插值 |
| 整曲 waveform | 每首生成一次，KB–MB | 必须完整 | 二进制请求/响应 + 磁盘缓存 |
| FFT/spectrum | 30/60/120 Hz，128–512 bins | 可丢帧 | binary stream |
| PCM | 44.1/48 kHz 连续流 | 实时、不可随意复制 | 不跨 Renderer；留在音频进程 |
| artwork | 单次 KB–MB | 必须完整 | URL/句柄或 binary response，不用 base64 |

普通 IPC 的问题不在“IPC 一定慢”，而在于把大量小 JSON 消息、数组装箱、structured clone 和 JS 分配叠加到每帧路径上。

## 2. playback position：传时钟，不传动画帧

Native Player 发送：

```ts
type ClockSnapshot = {
  generation: number
  positionSeconds: number
  monotonicNanos: bigint
  playbackRate: number
  state: 'playing' | 'paused' | 'buffering' | 'ended'
}
```

发送时机：

- playing 时 4–10 Hz；
- play/pause/seek/load/rate/buffering/ended 立即发送；
- UI 请求一次 resync 时立即发送。

Renderer 在 `requestAnimationFrame` 中计算：

```text
displayPosition = authoritativePosition
                + (nowMonotonic - authoritativeTimestamp) * playbackRate
```

暂停、buffering 或 generation 改变时不外推；对误差做小幅校正，seek 则立即跳变。这样 120 Hz 进度条不需要 120 次跨进程消息。

## 3. waveform：预计算的不可变资源

整曲 waveform 不属于实时遥测。Native Core 解码一次后，生成多分辨率层级，例如每层记录 little-endian `int16 min/max`，可选 `uint16 RMS`：

```text
header: magic/version/channels/duration/sampleRate/levelCount
level[0]:  512 buckets
level[1]: 2048 buckets
level[2]: 8192 buckets
...
```

UI 根据当前 zoom 只取一个层级或一个 range。缓存 key 包含文件身份、算法版本和 channel mix 策略。传输使用 `ArrayBuffer` 或内部 URL response；不得编码成 JSON number array 或 base64。

## 4. FFT/spectrum：固定快照，不传 PCM

若音频仍在 Web Audio，继续直接使用 `AnalyserNode`，不创建任何 native 通路。

若音频迁到 Native：

1. 音频 callback 只把必要 PCM 写入 core 内部的无锁 ring buffer；不能在实时线程分配、加锁、做 IPC 或日志。
2. 分析线程读取最新窗口、加窗并计算 FFT/频带聚合。
3. publisher 以显示所需频率发最新一帧，拥塞时覆盖旧帧。
4. Renderer 收到 transferable/binary buffer 后立即交给可视化 adapter；不要展开成响应式数组。

建议帧格式：

```text
u32 magic
u16 protocolVersion
u16 kind
u32 sequence
u32 generation
u64 monotonicNanos
u16 binCount
u16 flags
f32[binCount] values
```

256 个 `Float32` bin 在 120 Hz 时只有 `256 × 4 × 120 = 122,880 B/s`，约 0.12 MB/s。带宽并不大；真正要避免的是每帧创建 256 个 JS Number、JSON stringify/parse、多级 clone 和 backlog。

策略：

- 允许 sequence 跳号，永不等待旧帧。
- channel queue 深度最多 1–2 帧。
- 页面不可见或视觉关闭时停止/降到 5 Hz。
- 可按组件订阅 30/60/120 Hz 和不同 binCount；core 只计算所需最高规格，然后降采样。
- 使用同一 `generation` 与音频时钟对齐，切歌后旧帧立即丢弃。

## 5. 通路比较

### 5.1 普通 `ipcRenderer.invoke`

适合：设置、查询、按钮命令、单次结果。

不适合：FFT、每帧 position、持续 waveform。`invoke` 是 request/response 语义，容易产生并发 promise 和积压；Electron 对 Main handler 抛出的 Error 也只保证有限序列化信息。业务层不应把它当协议本身。

### 5.2 Electron MessagePort

Electron 可用 `MessageChannelMain`/`MessagePortMain` 将端口传给 Renderer，形成长连接 channel；官方说明普通 `send/invoke` 不能转移 MessagePort，必须用 `postMessage`，见 [Electron MessagePorts](https://www.electronjs.org/docs/latest/tutorial/message-ports) 和 [MessagePortMain](https://www.electronjs.org/docs/latest/api/message-port-main)。

优点：比大量 `invoke` 更适合事件流；Renderer 侧是标准 DOM MessagePort。缺点：sidecar 仍先把数据交给 Main，增加一跳，并把实现绑定到 Electron adapter。适合作为 Electron 专用兼容通路，不应出现在业务接口中。

### 5.3 binary buffer

这是数据编码方式，不是传输本身。对于 waveform/FFT，应使用 `ArrayBuffer`/typed array，固定 schema 和最大尺寸。优先转移所有权或复用 buffer；如果某个 host 只能复制，0.12–0.25 MB/s 的 FFT 数据仍通常可接受，先测量再引入更复杂机制。

### 5.4 本机 binary WebSocket

推荐作为跨 host 的高频数据面候选：Electron/WebView2 都原生支持，Renderer 可直接收 `ArrayBuffer`，避开 Main 中转。sidecar 只监听 `127.0.0.1` 随机端口，Main 在握手后把一次性 session token 和 endpoint 交给 preload adapter。

安全要求：

- 随机高熵 token，首帧认证，进程重启即失效；
- 校验 `Origin`，只允许应用 origin；
- 限制连接数、帧类型和最大帧；
- 不在 URL/query/log 中泄漏 token；
- 控制命令仍走 named pipe，不把高权限 API 暴露在 WebSocket；
- 浏览器导航或 dev content 不得取得 endpoint。

风险是本机端口和安全面增加，因此需要威胁建模。如果实际 FFT 流量经 Main/MessagePort 已足够，Electron 阶段可先用后者；Backend API 对这两种实现保持透明。

### 5.5 SharedArrayBuffer

SAB 擅长在同一浏览器代理集群的 JS worker 间共享内存，适合 Renderer ↔ Web Worker。它不能让 Rust sidecar 直接映射同一块 backing store。要实现 native 直写，仍需 N-API/host 扩展把 OS shared mapping 暴露给 V8，并处理 cross-origin isolation、生命周期和崩溃恢复。

结论：

- Folia/Aura 自己的 Renderer ↔ Web Worker 数据可以继续使用 transferable/SAB（满足隔离条件时）。
- Native ↔ Renderer 第一版不使用 SAB。

### 5.6 OS shared memory + ring buffer

理论上最低复制：sidecar 创建 file mapping，host/native bridge 映射进 V8 backing store，使用原子 header 和 ring slots。

代价：

- 必须维护一个进程内 native bridge，重新引入崩溃和 Electron/host ABI 绑定；
- 处理进程退出、generation、内存可见性、32/64 位原子、越界和权限；
- 替换 Electron 壳时要重写 bridge。

仅当 120 Hz、512+ bins、多视图同时订阅的二进制 WebSocket/MessagePort 实测造成明显 CPU、GC 或延迟问题时再做。对于约 0.1–0.3 MB/s 的 spectrum，它大概率不是第一优先级。

## 6. backpressure 与生命周期

每个 stream 都应具备：

- `streamId`、`generation`、`sequence`、单调时间戳；
- 明确最大帧、最大频率、最大订阅数；
- latest-wins，不为视觉帧累计无界队列；
- unsubscribe 和窗口隐藏自动降频；
- sidecar 重启后旧 handle/stream 自动失效；
- 统计 produced/sent/dropped/rendered 计数，便于定位瓶颈。

扫描和下载进度也应合并：底层可以高频更新，但只在数值变化达到阈值或 100–250 ms 到期时通知 UI。

## 7. 推荐落地顺序

1. Stage 0 先定义 `BackendTransport` 和业务 DTO；现有 Electron IPC 置于 adapter 内。
2. Metadata/Library 使用普通控制 RPC；artwork 使用内部 URL/二进制 response。
3. 下载进度使用低频事件流。
4. Native Player 原型先用 binary WebSocket 或 MessagePort 发送 FFT 快照。
5. 用 Chromium trace/JS allocation/延迟统计验证；只有不达标时才设计 shared memory bridge。

这条顺序把 shared memory 保持为可选优化，而不是先为尚不存在的瓶颈承担永久复杂度。
