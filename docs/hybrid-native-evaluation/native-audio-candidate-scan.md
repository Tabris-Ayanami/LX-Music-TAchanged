# Native Audio 后端候选扫描

日期：2026-08-26
分支：`deepseek`
范围：调研可直接放进 `native-core` 或作为改造参考的成熟开源播放器后端

## 结论

不建议把某个完整播放器项目整体 fork 进后端。最适合当前项目的是两层组合：

1. 底层引擎使用 `mpv`/`libmpv`，它已经覆盖 demux、decode、seek、cache、gapless、设备选择、滤镜等最困难的部分。
2. Rust 侧使用维护中的 `libmpv2` 绑定，再自己实现一个小的 `NativePlayer` adapter，代码结构和事件模型可以直接参考 Limusic 的 `crates/player`。

完整项目的 UI、队列、源协议、Tauri/Electron host 都与 LX-TA 差异太大，直接引入只会引入耦合和许可面。

## 候选项目

| 项目 | 语言 | 后端 | 成熟度/维护 | 对本项目的作用 | 是否建议引入 |
|---|---|---|---|---|---|
| [mpv-player/mpv](https://github.com/mpv-player/mpv) | C | libmpv client API | 长期活跃，事实标准 | 底层播放引擎和 DLL 来源 | 是，作为 runtime 依赖 |
| [kohsine/libmpv2-rs](https://github.com/kohsine/libmpv2-rs) | Rust | libmpv2 | 维护中，`libmpv2` 最新 6.0.0 | Rust 绑定，替代已停止维护的 `libmpv`/`mpv` crate | 是，作为 `native-core` dependency |
| [SimoHypers/limusic](https://github.com/SimoHypers/limusic) | Rust/Tauri | libmpv | 活跃，138 stars | `crates/player` 是很好的 audio-only libmpv 参考实现 | 参考代码，不整体 fork |
| [tramhao/termusic](https://github.com/tramhao/termusic) | Rust | Symphonia/GStreamer/mpv | 活跃，2179 stars | 抽象后端、PlayerTrait、mpv backend 可参考 | 参考代码，其 mpv backend 仍用旧 `libmpv` crate |
| [Kopuz-org/kopuz](https://github.com/Kopuz-org/kopuz) | Rust/Dioxus | Symphonia + Cpal | 活跃，1784 stars | 纯 Rust 本地播放、EQ、crossfade 可作为 libmpv 不通过 FFT 门时的 fallback | 暂不引入，作候选 B |
| [nini22P/tauri-plugin-libmpv](https://github.com/nini22P/tauri-plugin-libmpv) | Rust | libmpv | 维护中 | 若未来把 Electron 换成 Tauri 可直接复用 | 暂不引入，Stage 6 后再看 |

## 推荐路线

### 底层库

优先使用 `libmpv2` + `libmpv2-sys`：

- 仓库为 `kohsine/libmpv2-rs`，`libmpv2` crate 当前 6.0.0，仍在更新。
- 本项目 `native-core/src/player.rs` 已经做了 Windows DLL probe，下一步应把 probe 升级为真正的 `Mpv` 实例创建和 capability 探测。
- runtime 使用现有打包路径中的 `mpv-2.dll` 和 `libmpv-2.dll`，开发环境对应 `native-core/runtime/`。

### NativePlayer adapter

以 Limusic `crates/player/src/lib.rs` 为蓝本，但只保留 LX-TA 需要的 audio-only 能力：

```text
NativePlayer
  mpv: Arc<Mpv>
  event_rx: mpsc receiver
  audio filter state: gain / pitch / equalizer
```

初始能力：

- `vid=no`，`gapless-audio=yes`，`cache=yes`，`cache-on-disk=yes`。
- 观察 `time-pos`、`duration`、`pause`、`idle-active`，并监听 `EndFile`。
- `loadfile <url|path> replace/append`，用于播放和 gapless lookahead。
- `seek <seconds> absolute`，`pause`/`unpause`，`speed`，`volume`。
- `audio-device-list`、`audio-device` 供设备选择。
- `af` 链统一维护 loudness gain、rubberband pitch，以及后续十段 EQ；注意不要互相覆盖。

RPC 边界建议：

```text
player.open
player.play
player.pause
player.seek
player.setVolume
player.setSpeed
player.setPitch
player.setDevice
player.state.snapshot
player.shutdown
```

低频控制走现有 JSON named-pipe RPC；`time-pos`、`playing`、`trackEnded`、`error` 这类高频或异步事件需要新增一条 core 到 Main 的 outbound event 通路，不能靠轮询 request/response。

## 必须保留的验收门槛

沿用 [audio-backend.md](audio-backend.md) 的硬门槛，其中两个仍是决策关键：

1. 频谱/FFT。libmpv 公共 client API 没有稳定的解码后 PCM 回调；只有 `audio-pts`、`af-metadata`、`ao=pcm` 等间接机制。必须先做 spike，验证能否以 60/120 Hz 稳定产出 spectrum，且不把完整 PCM 传到 Renderer。
2. DSP 等价。十段 EQ、pitch、卷积、声像、增益要和当前 Web Audio 链逐项对照。

如果 libmpv 在频谱 gate 上失败，不要继续硬凑；第二候选是 FFmpeg + miniaudio，或 Kopuz 式 Symphonia + Cpal，因为这两条路线天然持有 PCM，FFT 最容易做。它们不是“更差”，只是开发量和维护面不同。

## 下一步

1. 在 `deepseek` 分支给 `native-core` 增加 feature-gated `player.libmpv` prototype，先用一个本地 WAV/MP3 fixture 打通 `Mpv` 创建、事件循环、load/play/pause/seek、volume、audio-device-list。
2. 增加 `player.libmpv.capabilities` RPC，替换现有 `player.probe` 的纯 DLL symbol 检测。
3. 单独做频谱/PCM tap spike，不接入生产播放器。
4. 通过 spike 后再把 `PlayerService` 的 `NativeBackendAdapter` 接进来，保持 Electron/Web Audio adapter 可回退。
5. 不 fork Limusic、termusic 或 Kopuz；只参考其 libmpv 用法，并在代码注释中保留来源链接。
