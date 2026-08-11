# Stage 0 性能基线

## 方法

- Windows，同一仓库、Electron 37.6.1。
- 比较场景统一为：干净启动后，窗口可见，`#/local?view=tracks`，播放器暂停。
- CDP 记录 navigation timing、DOM、JS heap；PowerShell 按 Electron browser PID 递归记录完整进程树的 Working Set、Private Bytes、CPU、线程和句柄。
- CPU 是采样窗口内各进程“单核百分比”的总和；不是整机 CPU 百分比。
- GPU Memory 无可靠计数器，未伪造数据。GPU process 的 Working Set/Private Bytes 不等于显存。
- 单次样本只能用于发现明显退化，不能证明小幅优化；标题/当前曲目和系统缓存存在差异。

复现命令：

```text
npm run baseline:capture -- --pid=<browser-pid> --port=<cdp-port> --scenario=<name> --sample-ms=3000 --hash=#/local?view=tracks
```

## 可比结果

| 指标 | Stage 0 前 | Stage 0 后（干净重启） | 差值 |
|---|---:|---:|---:|
| 进程数 | 7 | 7 | 0 |
| Working Set 总和 | 1132.45 MiB | 1028.83 MiB | -103.62 MiB (-9.2%) |
| Private Bytes 总和 | 1279.16 MiB | 1226.38 MiB | -52.78 MiB (-4.1%) |
| JS heap used | 16.53 MB | 12.93 MB | -3.59 MB (-21.8%) |
| JS heap total | 21.40 MB | 14.84 MB | -6.55 MB (-30.6%) |
| CPU（单核百分比总和） | 12.5% | 13.0% | +0.5 pp |
| 线程 | 281 | 295 | +14 |
| 句柄 | 4582 | 4528 | -54 |
| DOM elements | 1182 | 1126 | -56 |
| DOMContentLoaded | 305 ms | 241.9 ms | -63.1 ms |
| load event | 741 ms | 649 ms | -92 ms |
| first paint | 1316 ms | 1228 ms | -88 ms |
| first contentful paint | 1796 ms | 1708 ms | -88 ms |

结论：没有观察到 Stage 0 的明显性能或内存退化。样本反而偏低，但 Stage 0 不是优化阶段，不能把单次冷/热缓存差异宣称为收益。CPU 基本持平。完整 build 从改造前约 103.4 秒变为 120.88 秒；这是一次构建样本，不能归因于运行时架构。

一次 smoke 后未重启的样本出现约 379% 的单核百分比总和，主要集中于 browser/GPU/Renderer；干净重启后降至 13%，因此该样本判定为视觉/播放交互后的非稳态，不作为前后比较依据。

## 场景覆盖

| 场景 | 本轮结果 | 性能数值可比性 |
|---|---|---|
| 启动后 idle | 启动完成、无 Renderer exception | 有 navigation timing；无独立的前后 idle 成对样本 |
| 本地音乐页面 | 960 首库可见，分页边界已建 | 有前后同场景完整进程树对比 |
| 正常播放 | UI 播放成功并出现暂停控件，随后暂停 | 行为 smoke；无 Stage 0 前成对性能样本 |
| Folia | host 与 canvas 实际创建 | 行为 smoke；临时非持久化设置 |
| Aura / Diorama | Aura canvas、Diorama Folia canvas 实际创建 | 行为 smoke；临时非持久化设置 |
| 全库扫描 | 11 文件夹、1019 文件、最终 960 首 | 行为与完成结果；无 Stage 0 前成对资源采样 |
| 下载/转码 | 未启动 | 外部 Bilibili/CDN 连接超时，不具备可靠环境 |

后续性能工作应重复多轮、取中位数，并固定媒体库快照、当前曲目、窗口尺寸、视觉设置和缓存冷热状态。
