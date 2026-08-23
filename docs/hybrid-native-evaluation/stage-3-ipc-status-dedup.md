# Stage 3：播放器状态 IPC 去重（第一轮）

## 目标与范围

本轮只处理 Renderer → Main 的播放器状态通知：`sendPlayerStatus` 原先每次直接发送整个 patch，即使字段值与上次完全相同。现在通过字段级 `Object.is` 去重，只发送变化字段；首次出现的 `undefined` 仍会发送，保持旧语义。

该改动不改变洛雪音源、播放状态、任务栏控制、Open API 或播放器时序；它只减少重复的 `player_status` IPC 消息和 structured-clone 数据。

## 修改

- `src/renderer/utils/ipc.ts`
  - 新增 `createPlayerStatusSender`，维护最近一次字段值。
  - `sendPlayerStatus` 使用该 sender，在没有字段变化时不调用 `rendererSend`。
- `tests/regression/player-status-ipc-dedup.test.cjs`
  - 静态边界检查。
  - 使用 TypeScript 转译后的真实函数执行行为测试。

## 基线与验证

生产构建（修改前）：`npm run build` 成功，耗时约 **4:54.624**。

修改前隔离实例单次 idle/local 采样：

| 指标 | 修改前（单次） |
|---|---:|
| 进程数 | 7 |
| Working Set | 1029.74 MiB |
| Private Bytes | 1023.74 MiB |
| Renderer JS heap used | 10.34 MiB |
| DOM 节点（CDP 页面） | 1074 |
| CPU（单核百分比总和） | 14.5% |
| 线程 / 句柄 | 299 / 4614 |
| DOMContentLoaded / load | 235.2 / 425.5 ms |
| First Contentful Paint | 1712 ms |

修改后生产 Renderer 构建：`npm run build:renderer` 成功，Webpack 用时 **107.951 s**。

修改后隔离实例两次采样：

| 指标 | 修改后冷启动样本 | 修改后稳定样本 |
|---|---:|---:|
| 进程数 | 7 | 7 |
| Working Set | 1057.45 MiB | 1065.09 MiB |
| Private Bytes | 1093.15 MiB | 1067.44 MiB |
| Renderer JS heap used | 16.15 MiB | 13.22 MiB |
| DOM 节点（CDP 页面） | 1083 | 1079 |
| CPU（单核百分比总和） | 14.1% | 17.7% |
| 线程 / 句柄 | 307 / 4644 | 313 / 4664 |
| DOMContentLoaded / load | 66.4 / 130.9 ms | 91.8 / 159.3 ms |
| First Contentful Paint | 384 ms | 424 ms |

两组使用不同隔离 profile，且 GPU Private Bytes、缓存冷热和首屏恢复路径波动明显，因此这些总进程指标**不能归因于本轮 IPC 去重**，也不能宣称内存或启动时间改善。当前能归因的收益是调用行为测试：3 次状态 patch（其中 1 次完全重复）由 3 次跨边界发送降为 2 次，第二次只发送变化字段。

GPU process Private Bytes 不作为显存解释。当前 `dist` 目录约 **44.59 MiB / 500 文件**，本轮未改变打包规则。

## 测试结果

- `node --test tests/regression/player-status-ipc-dedup.test.cjs`：通过。
- `npx eslint src/renderer/utils/ipc.ts tests/regression/player-status-ipc-dedup.test.cjs`：通过。
- `npm run typecheck`：通过。
- `npm run build:renderer`：通过。
- `npm run test:unit`：仓库既有样式回归 RG-007、RG-008、RG-014、RG-015、RG-029、RG-038、RG-039 仍失败；新增 IPC 测试通过，未修改这些无关失败。
- `git diff --check`：通过。

## 决策与下一步

保留本轮去重实现。由于当前没有播放场景的端到端 IPC 计数器，下一轮先对播放中 `player_status` 消息量做可观测性采样，再决定是否继续合并 progress/duration 的发送窗口。若消息量占比很低，应转向 LocalMusic 全量数组/搜索 projection 或 keep-alive 隐藏页的单变量 A/B，而不是继续增加 IPC 抽象层。
