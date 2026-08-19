# Stage 1 完成状态：Metadata 与 Artwork

> 日期：2026-08-19
> 分支：`hybrid-native`
> 范围：测试/回退基础、Rust sidecar、Native MetadataService、Native ArtworkService。未进入 Library、Download 或 Player。

## 结论

本轮限定范围已经落地。默认产品行为仍以旧 Electron metadata 结果为准：读取默认为 `native-shadow`，写入和 artwork 默认为 `electron`。Native write 没有默认接管，Metadata shadow 中确认的兼容差异也没有为了“测试全绿”而被抹平。

## Rust Core 结构

```text
native-core/
├─ src/main.rs       named-pipe server、framing、dispatch、cancel
├─ src/protocol.rs   1.0 请求/响应与 handshake DTO
├─ src/error.rs      stable error mapping
├─ src/metadata.rs   读取、FFmpeg fallback、安全写入
├─ src/artwork.rs    提取、方向、缩放、WebP、LRU cache
└─ src/lib.rs        capability/version

Electron Main
├─ nativeCore/supervisor.ts    lazy spawn、握手、超时、退出、日志
└─ nativeCore/mediaServices.ts feature routing、shadow、fallback
```

- 独立 headless 进程；没有 Qt、WinUI 或 UI toolkit。
- Windows named pipe；4-byte little-endian length prefix + JSON payload；单帧上限 16 MiB。
- protocol `1.0`，Backend interface `0.2.0`；handshake 返回 core version、capability 和 PID。
- read/artwork 支持 request cancellation；metadata write 一旦开始不对外报告取消，避免调用方误认为写入停止后再启动第二个 writer。
- stderr 输出结构化 JSON；Electron supervisor 统一记录 ready/unavailable/sidecar log。
- sidecar 懒启动、随 Electron 退出；崩溃后当前请求收到 `backend_unavailable`，下次调用可重新拉起。不存在 sidecar 时走旧实现。

## 第三方库

| 用途 | 实现 |
|---|---|
| tag/container 主读取与写入 | `lofty 0.24` |
| Lofty 不支持的只读容器与封面 fallback | 随应用分发的 FFmpeg 子进程 |
| 图片解码、EXIF orientation、Lanczos3 resize、WebP | `image 0.25` |
| async/named pipe/cancel | Tokio + tokio-util |
| Windows 安全替换 | `ReplaceFileW(REPLACEFILE_WRITE_THROUGH)` |
| framing/DTO/log | serde/serde_json、tracing |

没有引入 fooyin Core，也没有引入 Qt。当前实现选择 Lofty 而不是 C++ TagLib FFI，减少首版 ABI/交叉编译面；真实 Electron fixture 仍以现有 `taglib-wasm` 结果作为兼容基准。

## 格式语料

批准的 15 类格式由 16 个扩展名覆盖：`mp3, flac, m4a, mp4, aac, ogg, oga, opus, wav, ape, wv, aiff, aif, tta, wma`（`aiff/aif` 为同类别名；MPEG-4 音频/容器按当前产品扩展分别保留）。

语料全部生成或复制到 `mkdtemp` 的 `corpus/work/profile/cache`，写测试只操作 work copy。包含 Unicode/中文/日文、无 tag WAV、嵌入歌词、大尺寸嵌入封面、无封面、EXIF orientation=6、损坏/截断文件、只读和独占锁文件。APE 使用固定 commit 与 SHA-256 的公开 TagLib fixture，其余由仓库固定 FFmpeg 生成。

全部扩展读取成功且 duration 大于零；损坏 FLAC 返回稳定错误。详细字段差异见 [stage-1-metadata-shadow-report.md](stage-1-metadata-shadow-report.md)。

## Metadata 写入安全

写入路径为：同目录同扩展名临时副本 → 修改副本 → 回读字段与 duration/封面状态验证 → `ReplaceFileW` 写穿透替换并生成 backup → 删除 backup。失败会清理 temp；已提交后注入错误会从 backup 回滚。

已通过：正常写入/回读、外部封面写入与移除、只读、独占锁、`after-copy/after-write/after-verify/after-commit` 故障注入、sidecar `crash-after-copy`。所有失败样本均以 SHA-256 验证唯一原件未改变；正常结果仍可重新解析。

已知边界：真实断电/磁盘设备错误无法在本机稳定注入；本轮以四个提交阶段 failpoint 覆盖控制流。Native write 继续默认关闭，只有显式 `backend.metadataWrite=native` 才成为该请求的唯一 writer；失败后不会再自动执行 legacy write。

## Artwork cache

- 输入：embedded artwork、同目录外部封面、显式外部图片路径；Lofty 提取失败时可用 FFmpeg 提取视频流封面。
- 输出：64/128/256/512 WebP；Renderer 接收 `ArtworkHandle.url`，不接收 Native base64，也不知道 cache 文件布局。
- cache key：媒体路径、实际 artwork 来源路径、来源 `size+mtime` fingerprint、尺寸。
- 默认 256 MiB 字节预算；按文件 mtime 维护近似 LRU；命中时 touch；超预算后删除最旧项。
- 源文件 fingerprint 变化会生成新 handle；显式 invalidation 删除该媒体进程生命周期内的全部已知变体。
- cache 只有派生文件，可整目录删除并重建；写入使用唯一临时名和 rename，避免并发生成相同变体互相覆盖。

测试结果：64/128/256/512 尺寸均正确；orientation 样本从横向源得到 64×128；显式 invalidation 生效；80 KiB 测试预算最终为 77,042 bytes、2 entries。

## Feature flag 与回退

| 设置 | 默认 | 语义 |
|---|---|---|
| `backend.metadata` | `native-shadow` | `electron / native-shadow / native`；shadow 返回旧结果并异步记录差异 |
| `backend.metadataWrite` | `electron` | `electron / native`；独立于 read，Native 请求不双写 |
| `backend.artwork` | `electron` | `electron / native`；Native 失败回退现有 worker/cover reader |

shadow 报告只记录文件路径 SHA-256、扩展名和字段差异，写入 profile 下的 `native-core/metadata-shadow-differences.jsonl`。sidecar 缺失、握手失败、协议不匹配或 Native read 失败不会阻断 UI；Artwork Native 失败返回旧封面路径。

## UI 边界变化

- 本地封面主入口改为 `ArtworkService.getLocalTrackArtwork({ filePath, size: 512 })`。
- metadata 编辑器读取/写入仍只使用 `MetadataService`；外部选图通过 `ArtworkService.getExternalArtworkPreview`，Native 模式传 `coverSourcePath`，避免 Renderer base64。
- UI 不包含 pipe name、Native RPC method、cache layout 或 Rust 类型。

没有消除 Library scanner/database worker、Download worker、HTMLAudio/Web Audio、旧 Source/Node/IPC 依赖；它们不在本轮范围。Stage 0 的依赖守卫继续阻止新增 Renderer transport/runtime 直连。

## 暂停期间前端改动的整合

本轮同时接收并完成了暂停期间尚未提交的前端改动，但没有扩大 Native Core 范围：

- 动态封面补齐 HLS 相对 URL、Apple token 并发/失效、跨 storefront editorial 查询、同曲请求合并及播放详情打开时探测；失败仍回退静态封面。
- 搜索框完成紧凑态键盘入口、命中区域和 reduced-motion 处理；Discover 页完成可访问的交互层级、每日推荐状态、历史条目删除及网易账号集成。
- Discover 已加入主 Renderer smoke 路由；动态封面和前端整合新增 13 个回归用例。
- 这些改动继续使用既有 Web UI 和 Backend API；没有新增 Renderer 对 Electron、Node、数据库、pipe 或 Native cache 布局的直接依赖。

## 验证摘要

| 项目 | 结果 |
|---|---|
| Rust 独立 build/test | 通过 |
| RPC handshake/version/capability/cancellation | 通过 |
| 15 类/16 扩展 integration corpus | 通过 |
| Electron `taglib-wasm` 真实差分 fixture | 通过并输出差异 |
| 写入与故障注入 | 通过 |
| Artwork variants/orientation/invalidation/LRU | 通过 |
| ElectronBackendAdapter UI smoke | 通过；专辑页 50 个 Native artwork URL，metadata editor 无错误 |
| 主 Renderer smoke | 启动、Discover/搜索/本地/下载/设置路由、824 首隔离库扫描、播放控制、Aura、Folia/Diorama 通过，无 Renderer exception |
| 新增前端回归 | 13/13 通过 |
| 全量 Renderer regression | 81/87；6 项与 Stage 0 已记录的视觉断言失败完全相同，无新增失败 |
| Backend contract / boundary guard | 5/5 通过；无新增依赖方向违规 |
| typecheck / lint / production build | 全部通过；完整 build 1:44.059 |

性能见 [stage-1-performance.md](stage-1-performance.md)。

## 是否进入 Stage 2

建议可以进入 Stage 2，但保持两个限制：Metadata 读取继续 shadow，Native write 继续 opt-in；Stage 2 不应等待所有 metadata 差异归零，也不应借机把旧数据库直接交给 Rust 双写。新 LibraryService 必须使用独立 shadow index 和单写者切换门。
