# Stage 2A 代表性内存验证

> 状态：`verification-only`，不是满足每组至少 5 次要求的正式基线，也不能用于声称优化收益。

## 条件与范围

- 日期：2026-08-19
- 分支：`hybrid-native`
- Harness commit：`ce5d8b3919d04ae5d62dca9239893eaa4d26fe76`
- Electron：37.6.1
- 窗口：1280 × 800，主题跟随隔离 profile
- 媒体安全边界：`E:\Music\up`
- 隔离工作区：`F:\player\lx-stage2a-subset-20260819-154100`
- 原 profile 在复制前已通过完整进程命令行扫描确认未运行；运行时只使用工作区中的 profile、媒体、native profile 和 native cache。

真实 profile 含 965 条本地记录，其中大量路径不在用户指定子目录内，且至少一条引用的源文件已经不存在。按用户要求不测试完整数百首曲库，本轮启用了只能用于验证的媒体子集：保留 14 条记录，对应 13 个实际复制文件；排除 951 条记录。复制数据库不再包含 `E:\Music` 原路径引用，13 个复制文件和复制数据库的 SHA-256 均在准备时验证通过。

仅执行以下 control 场景，每个场景各 1 次冷启动和 1 次热启动：

- 本地歌曲列表稳定 10 秒；
- 10 轮 Discover / 本地歌曲 / 本地专辑 / 设置导航，并在动作结束后 10、30、60 秒采样。

普通播放能够选中复制歌曲并进入播放器状态，但当前 profile 的播放器控件布局未满足严格的 normal 控件探针，因此该场景 fail-closed，不产生样本。Discover 滚动、搜索、200 封面、Folia、Aura、Diorama 和全库扫描按缩小范围要求未运行。

## 单次验证结果

以下数字是原始单次观测，不是中位数或范围。

| 场景 | 温度 | 阶段 | Private Bytes MiB | Working Set MiB | 进程数 | JS heap used MiB | DOM Nodes | Images | Workers |
|---|---|---|---:|---:|---:|---:|---:|---:|---:|
| local-tracks | cold | stable | 945.67 | 961.05 | 7 | 11.46 | 2,873 | 0 | 0 |
| local-tracks | warm | stable | 884.73 | 1,103.10 | 7 | 11.71 | 2,275 | 0 | 0 |
| navigation-pressure | cold | 10s/stable | 1,161.44 | 1,100.30 | 7 | 22.71 | 10,318 | 31 | 1 |
| navigation-pressure | cold | 30s | 1,134.26 | 1,074.62 | 7 | 13.09 | 4,053 | 31 | 1 |
| navigation-pressure | cold | 60s | 1,122.87 | 1,060.43 | 7 | 13.10 | 4,053 | 31 | 1 |
| navigation-pressure | warm | 10s/stable | 1,161.62 | 1,268.77 | 7 | 24.58 | 16,815 | 31 | 1 |
| navigation-pressure | warm | 30s | 1,131.49 | 1,239.85 | 7 | 13.07 | 4,053 | 31 | 1 |
| navigation-pressure | warm | 60s | 1,067.88 | 1,221.06 | 7 | 13.08 | 4,053 | 31 | 1 |

GPU 独立内存计数不可用；GPU process 的 Private Bytes 已包含在全进程合计中。

## 恢复与增长判断

- 当前 harness 没有导航动作前的同进程基准点，因此不能严格回答“60 秒是否恢复到动作前 5% 内”。
- 以动作后 10 秒样本作参照，60 秒 Private Bytes：冷启动下降 3.32%，热启动下降 8.07%。冷启动落在 5% 内；热启动仍在继续回收，而不是增长。
- JS heap 在冷/热两组都从约 22.7/24.6 MiB 回落到约 13.1 MiB；DOM Nodes 从 10,318/16,815 回落到约 4,053。
- Images、Worker 和 live object URL 在各自恢复阶段没有单调增长；但只有一次冷/热运行，不能外推为长期稳定性结论。

## 原始证据

- `workspace-manifest.json` SHA-256：`de8779ed7e3aefc38798068d3aa1db434002e81313f0188589257e9d1f1df137`
- `raw-samples.jsonl` SHA-256：`19d945727a5969e1885ba7088779551fcddc9e776196a5512ed160d4363aab2c`
- `summary.json` SHA-256：`299b7e9db9b94351cda82a390c330ec04b114ca52baeb52664a53532daaeff73`
- `stage-2a-memory-report.md` SHA-256：`586ea838abb098bd280d6a7219e753d38391b01e9146f2d21ac0f2feab41d893`
- 报告目录：`F:\player\lx-stage2a-subset-20260819-154100\reports\final-representative`

## 决策限制

本轮没有每组 5 次、没有完整曲库、没有播放/大封面等完整场景，也没有任何归因 A/B。因此：

- 不能判断本地歌曲或大封面优化是否达到 `>= 10%` 或 `>= 100 MiB`；
- 不能判断整库对象复制是否超过 Stage 2C 门槛；
- 不能用这些数据证明 Native LibraryService 有收益；
- 不进入 Stage 2B 或 Stage 2C。
