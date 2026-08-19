# Stage 1 性能与内存

## 方法与限制

- 同机、Electron 37.6.1、同一真实 profile 的隔离复制、同主题/自定义源/媒体库快照；测试不写真实音乐库。
- Electron 完整子树和 Rust sidecar 一起统计；不是只报 Rust。
- Stage 1 使用 release sidecar，独立临时 profile/cache；确认没有 conhost。
- Stage 0 用户验收基线作为 A/B。Working Set/Private Bytes 对 GPU cache 和采样时点敏感；单次结果只用于发现明显退化。
- GPU memory 仍没有可靠计数器，不用 GPU process private bytes 冒充显存。

## A：搜索页、暂停播放

| 指标 | Stage 0 | Stage 1 总计 | 差值 |
|---|---:|---:|---:|
| 进程数 | 7 | 8 | +1 sidecar |
| Working Set | 952.7 MiB | 1052.45 MiB | +99.75 MiB (+10.5%) |
| Private Bytes | 1027.4 MiB | 1140.24 MiB | +112.84 MiB (+11.0%) |
| Renderer JS Heap | 9.3 MiB | 11.23 MiB | +1.93 MiB |
| CPU（单核百分比总和） | 未提供可比值 | 10.6% | 不作前后结论 |

其中 sidecar 为 WS 10.65 MiB / Private 5.06 MiB；Electron 本身约 WS 1041.80 MiB / Private 1135.18 MiB。A 场景出现明显高于基线的总量，不能宣称 Stage 1 已降低内存；差值主要不来自 sidecar 自身，仍需多轮中位数和 GPU/cache trace 定位。

## B：本地歌曲页

| 指标 | Stage 0 | Stage 1 总计 | 差值 |
|---|---:|---:|---:|
| Working Set | 1021.1 MiB | 1052.97 MiB | +31.87 MiB (+3.1%) |
| Private Bytes | 1235.8 MiB | 1216.29 MiB | -19.51 MiB (-1.6%) |
| Renderer JS Heap | 12.1 MiB | 11.63 MiB | -0.47 MiB (-3.9%) |
| CPU（单核百分比总和） | 未提供可比值 | 9.0% | 不作前后结论 |

sidecar 同样为 WS 10.65 MiB / Private 5.06 MiB。该单次样本没有显示明显运行时退化，但也不足以把 Private/heap 的小幅下降归因于 Native artwork。

## 启动与首屏

| 指标 | Stage 0 可比样本 | Stage 1 | 差值 |
|---|---:|---:|---:|
| DOMContentLoaded | 241.9 ms | 254.2 ms | +12.3 ms |
| load event | 649 ms | 685.6 ms | +36.6 ms |
| first paint | 1228 ms | 1272 ms | +44 ms |
| first contentful paint | 1708 ms | 1768 ms | +60 ms |

sidecar 是 lazy spawn，默认 artwork=electron，因此不在首屏关键路径。当前差值是单次冷/热缓存样本，未达到可以归因的程度。

## Artwork 压力场景

- 专辑视图连续生成/显示 50 个 Native artwork URL；cache 约 15.12 MiB。
- 24 轮快速往返滚动、4 个可滚动容器：JS heap 12.33 → 12.43 MiB；返回搜索页并等待 5 秒后 12.60 MiB。净增约 0.27 MiB，未观察到随 50 张封面线性保留原始大图的增长。
- 专辑页总量样本：WS 1066.07 MiB，Private 1196.24 MiB，Renderer heap 12.32 MiB；sidecar WS 10.75 MiB / Private 5.09 MiB。
- 80 KiB 小预算 corpus 测试最终 77,042 bytes / 2 entries，证明预算淘汰生效；产品默认预算为 256 MiB。
- metadata 编辑器在 Native artwork flag 下打开成功且无 error；外部图片 preview/写入由独立 fixture 验证。

整合暂停期间前端改动后又在同一隔离 profile 完成一次补充压力运行：50 个 Native artwork URL、3 个可滚动容器，JS heap 为 17.92 → 18.00 MiB，返回搜索页等待 5 秒后为 18.14 MiB，净增约 0.22 MiB。该运行是在完整 smoke、Discover、播放详情和 metadata editor 都已访问后采样，因此绝对 heap 不与上面的冷路径样本混用；增长趋势仍未显示原始大图随滚动线性滞留。

## 前端整合后的补充稳定态快照

以下快照是在同一测试进程完成完整 smoke 后、切页并额外等待 10 秒采样，用来检查最终整合代码是否出现数量级退化，不替代前面的受控 A/B：

| 场景 | 进程 | Working Set | Private Bytes | Renderer JS Heap | sidecar WS / Private |
|---|---:|---:|---:|---:|---:|
| 搜索页、暂停、稳定态 | 8 | 1128.99 MiB | 1077.06 MiB | 17.85 MiB | 11.52 / 6.04 MiB |
| 本地歌曲页、稳定态 | 8 | 1140.54 MiB | 951.86 MiB | 18.15 MiB | 11.52 / 6.04 MiB |

GPU 进程 Private Bytes 在连续几分钟内从约 435 MiB 到 668 MiB 波动，导致全树 Private Bytes 也显著变化；当前采集路径无法可靠读取 GPU memory。因此这些补充数字只能说明 sidecar 仍约 12/6 MiB、进程数仍为 8，以及最终前端整合没有出现持续增长，不能据此宣称 Private Bytes 的下降来自 Native 化。

全库扫描与下载/转码不在 Stage 1 改动范围。本轮没有可复现的外部下载环境，也没有为了制造数字而启动真实写库扫描；沿用 Stage 0 行为基线，Stage 2/3 再分别重测。

## 判断

Stage 1 的可确认收益是：Renderer 不接收 Native base64、列表使用目标尺寸 WebP、cache 有硬字节预算，且 sidecar 自身常驻成本约 10.7/5.1 MiB。现有样本没有证明全应用内存下降；搜索页样本反而更高，本地页近似持平。进入 Stage 2 的理由应是数据所有权、分页和稳定性，而不是把 Stage 1 包装成已实现大幅降内存。
