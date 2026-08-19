# Stage 1 Metadata shadow 差异

## 方法

同一真实媒体 work copy 同时交给当前 Electron `src/main/modules/localMusicTools/metadata.ts`（真实 `taglib-wasm`）和 Rust Native reader。比较 title、artists、album、album artists、genre、year/date、track/disc 与 totals、comment、composer、embedded lyrics、duration、bitrate、sample rate、artwork presence。产品 shadow 模式始终返回 Electron 结果。

## 分类结果

| 分类 | 观察 |
|---|---|
| legacy behavior | Electron duration 以整数秒返回；多种容器没有返回 totalTracks/totalDiscs，而 Native 返回 9/2 |
| implementation difference | OGG/OGA bitrate 为 16 vs 80 kbps；WMA 为 128 vs 156 kbps；WMA artist 是单个分号字符串 vs Native 拆分数组 |
| format-specific behavior | AIFF/AIF 的 Electron reader 未返回 title/comment，Native 返回；TTA 的 Electron reader基本不返回 tag，FFmpeg fallback 返回；WMA 的 year/comment/lyrics/totals 由 Native fallback 返回 |
| actual bug / promotion blocker | MP3 Native comment 为空而 Electron 为 `integration fixture`；WV Native year 为 0 而 Electron 为 2026 |

AAC fixture 两边都没有 tag，只有 duration 精度差异。WAV 是明确的无 metadata 样本。APE 的主要差异也是整数 duration。Artwork presence 在对应 fixture 上一致。

## 决策

1. 不修改 UI contract，不在本轮发明兼容规则。
2. `backend.metadata=native-shadow` 保持默认；不能因为 corpus 可解析就切换 `native`。
3. MP3 comment 与 WV year 在正式推广 Native read 前必须修复并加入回归断言。
4. totals 与 duration 需要产品语义决定：保留 legacy 值，还是在版本化 DTO 中接受更精确/更完整的 Native 值。
5. WMA artist 分隔和 OGG/WMA bitrate 需先定义规范化规则，不能简单以任一实现为真值。
6. AIFF/TTA/WMA Native 多读出的字段属于能力改善，但生产切换仍需确认不会改变排序、显示或编辑回写语义。
