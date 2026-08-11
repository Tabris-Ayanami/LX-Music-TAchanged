# Native Core 实现方案比较

## 推荐

采用 **Rust headless sidecar process**，不依赖 Qt；控制面使用带长度前缀、版本化的 RPC，通过 Windows named pipe；初期 payload 用可调试的 JSON，稳定后只在已测得热点上切 MessagePack/CBOR；高频可视化使用独立二进制通路。

这不是因为 Rust 在所有维度都最快，而是它在 LX-TA 的真实约束下取得了最好的整体平衡：文件/并发/SQLite 服务适配度高、内存安全、进程隔离、可被 Electron/Tauri/Wails 复用，同时可以通过 FFI 调用 TagLib、libmpv、FFmpeg 等成熟库。

## 方案总览

评分为 1（差）到 5（优），表示对本项目的适配度，不是语言的通用评价。

| 方案 | Electron 集成 | Codex 开发 | Debug | 崩溃隔离 | IPC 成本 | 内存 | 性能 | Win API | FFmpeg/音频 | 长期维护 |
|---|---:|---:|---:|---:|---:|---:|---:|---:|---:|---:|
| Rust sidecar | 4 | 4 | 4 | 5 | 4 | 4 | 5 | 4 | 4 | 5 |
| C++ sidecar | 4 | 3 | 3 | 5 | 4 | 5 | 5 | 5 | 5 | 3 |
| C#/.NET sidecar | 5 | 5 | 5 | 5 | 4 | 3 | 4 | 5 | 3 | 4 |
| Node N-API addon | 5 | 3 | 2 | 1 | 5 | 5 | 5 | 4 | 4 | 2 |
| C ABI 动态库（进程内） | 3 | 3 | 2 | 1 | 5 | 5 | 5 | 5 | 5 | 3 |
| 纯 Node/现状 | 5 | 5 | 5 | 2 | 3 | 2 | 3 | 3 | 3 | 3 |

## 1. C++

### 优点

- TagLib、FFmpeg、libmpv、miniaudio、WASAPI 和 Windows API 都有最直接的 C/C++ 接口。
- 最低层控制和最低运行时开销，适合定制音频管线。
- fooyin 等项目可作为设计参考时，语言和第三方生态接近。

### 缺点

- 所有权、线程、回调和 FFI 生命周期错误容易变成难复现崩溃或内存破坏。
- Codex 能生成 C++，但跨平台 CMake、ABI、依赖打包和音频实时线程的验证成本仍高于 Rust/C#。
- 若为了省事重新引入 Qt，马上恢复本轮要避免的基础设施绑定。

### 判断

C++ 是“必须自建复杂 FFmpeg + 实时音频图”时的强候选，但不是 metadata/library/artwork 第一阶段的最优默认。可以把 C/C++ 第三方库限制在窄 FFI 边界内，而不是让整个 core 都用 C++。

## 2. Rust

### 优点

- 文件系统、并发任务、SQLite、协议和服务生命周期有成熟生态；所有权模型能阻止大量 use-after-free/data race。
- 性能与内存可接近 C++，没有 GC pause，适合 sidecar 和后续实时线程外围逻辑。
- 可生成单一可执行文件和 PDB；panic 可转为受控进程失败，Electron 仍存活。
- 与未来 Tauri 的技术栈相容，但 core 仍保持 host 无关。
- 对 TagLib/libmpv/FFmpeg/miniaudio 可以使用绑定或自建小型 `unsafe` FFI 层，把风险集中起来。

### 缺点

- C/C++ 库的构建、回调、对象生命周期仍需要 `unsafe` 和严格封装。
- Windows 特殊 API 及 COM 代码比 C# 冗长；音频生态没有 C++ 原生项目那么直接。
- 编译时间和工具链初始搭建有成本。

### 判断

最适合本路线。第一阶段以 safe Rust 为主，外部库全部放在 adapter crate；音频阶段若 libmpv spike 通过，可继续由 Rust 承担宿主。只有自定义音频内核出现实证阻碍时，再把局部实现下沉为 C/C++ library。

## 3. C#/.NET

### 优点

- 当前 `native/*` 已有 C#/WinUI Slice 1 资产，团队已有一定路径探索。
- Windows API、COM、ETW、服务诊断和 async 开发效率高；调试体验好。
- sidecar 部署、JSON/gRPC/pipe 通信容易；崩溃隔离与 Rust/C++ sidecar 相同。

### 缺点

- .NET runtime 和 GC 带来额外常驻内存；虽然通常可控，但与“尽量轻”的目标不完全一致。
- TagLib# 容易，但 libmpv/FFmpeg/低延迟音频仍需 P/Invoke 或 wrapper；音频实时线程要谨慎处理 GC 和 pinning。
- 如果未来选择 Tauri/Rust host，会形成 Rust + .NET 两套 native runtime；Wails 则还会增加 Go。

### 判断

是合理的第二选择，尤其适合快速构建 Windows-only Library/Platform 服务。现有 WinUI Slice 1 可作为 contract/schema 参考，但不构成必须继续 C# 的理由。若团队实际维护能力显著偏 C#，可以反转为 C# sidecar；否则默认 Rust 更统一。

## 4. 独立 Native sidecar process

这是部署与故障边界选择，可与 C++/Rust/C# 组合。

### 优点

- metadata 解析、FFmpeg、音频或 native library 崩溃不会直接杀死 Renderer/Main。
- Electron、Tauri、Wails 或测试 CLI 都能使用同一个协议。
- core 可独立做集成测试、性能基准、故障注入和诊断 dump。
- 可以按模块限制权限和设置资源预算；升级协议也更明确。

### 成本

- 需要进程监督、版本握手、安装/签名、日志关联、取消和恢复。
- RPC 存在序列化和调度成本；但 metadata、库查询、扫描、下载控制均不是每 sample 调用，成本可忽略。
- 高频 FFT 不能走普通 JSON RPC，必须设计二进制数据面。

### 判断

**强烈推荐**。对于本项目，崩溃隔离和 host 可替换性比省去一次本地 IPC 更重要。

## 5. Node Native Addon / N-API

### 优点

- JS 调用最直接，二进制 Buffer 低开销，共享内存/回调容易。
- Node-API 提供 Node 版本间的 ABI 稳定层；适合小型同步热点或纯算法 addon。

### 缺点

- native 崩溃会带走所在 Electron 进程；阻塞或死锁也直接影响 Main/Renderer。
- Electron 打包、架构、运行库、签名与 rebuild 仍复杂；第三方库自身 ABI 不会因 Node-API 自动稳定。
- 继续把 core 绑定在 Node/Electron 进程模型上，不利于后期 WebView host。
- 线程安全函数、GC 生命周期和卸载时序会增加 debug 难度。

Node 官方将 Node-API 定义为跨 Node 版本的 ABI 稳定 API，但这不等同于整个 addon 依赖树 ABI 稳定，见 [Node-API 文档](https://nodejs.org/api/n-api.html)。

### 判断

不作为核心架构。只有经过测量后，一个极窄、无状态、不会阻塞的转换函数确有必要时才考虑；不能承载 Library/Player 主体。

## 6. C ABI 动态库

### 优点

- 最通用的二进制边界；Rust、C#、Go、Electron addon 和各种 host 都能调用。
- 适合把 TagLib/FFmpeg 等封装成少数稳定操作，传递 plain old data/buffer。
- 无 IPC 序列化，调用延迟最低。

### 缺点

- 若由 Electron 进程直接加载，崩溃隔离为零。
- 字符串编码、allocator 所有权、句柄、回调、取消和异步生命周期都需要自定义 ABI。
- ABI 演进难于进程协议；同一 DLL 在不同 host 内的线程/COM 初始化差异难排查。

### 判断

C ABI 适合作为 **sidecar 内部** 的第三方适配层，不适合作为 Renderer/Main 直接调用的总边界。

## 7. 推荐协议

### 控制面

- 传输：Windows named pipe，单用户 ACL，随机实例名；句柄由父进程安全传递。
- 帧：`u32 length + envelope + payload`，设置最大帧大小。
- envelope：`protocolVersion`, `requestId`, `method`, `deadline`, `traceId`。
- 首版 payload：UTF-8 JSON，便于抓包、日志和 contract test。
- 稳定热点：可逐方法协商 MessagePack/CBOR；不做一次性全协议替换。
- 语义：请求/响应、服务端事件、取消、job progress、能力协商。

JSON 不是高频数据方案，但对每秒个位数到几十次的控制调用通常不是瓶颈。先通过 service 边界消除无意义调用，再优化序列化。

### 数据面

- artwork/waveform：按需二进制流、文件 URL/自定义协议句柄或 transferable `ArrayBuffer`。
- FFT/spectrum：独立 binary stream，最新帧优先、允许丢帧。
- PCM：不跨 Renderer；始终留在音频进程。

详细设计见 `ipc-and-shared-memory.md`。

## 8. 构建与维护约束

1. Native Core 必须有自己的 CLI test harness，不以 Electron 才能启动。
2. 所有 FFI adapter 有版本锁定、许可证清单和最小语料测试。
3. Release 产物包括 exe、PDB/符号、依赖清单、协议版本和 SBOM。
4. Electron Main 校验 sidecar 路径和签名/摘要，不接受 Renderer 指定任意可执行文件。
5. 日志使用结构化 trace ID，但不得记录 cookie、token 或完整隐私路径。
6. 数据库、tag 写入和下载提交必须有 kill-at-every-step 故障注入测试。

## 明确选择

- **语言**：Rust。
- **形态**：独立 sidecar，不是 N-API，不是进程内 DLL。
- **基础设施**：无 Qt、无 UI toolkit。
- **控制通信**：named pipe 上的版本化 framed RPC；首版 JSON。
- **高频通信**：独立二进制数据面，按实际 host 选择 MessagePort/WebSocket；不使用高频 JSON。
- **第三方库**：TagLib 直接用于 metadata；SQLite 直接用于 library；FFmpeg 优先保持受管子进程；音频先验证 libmpv。
