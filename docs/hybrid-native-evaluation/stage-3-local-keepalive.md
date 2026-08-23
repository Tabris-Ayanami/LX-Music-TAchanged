# Stage 3：LocalMusic keep-alive 实例归并

## 目标与修改

`View.vue` 原先把完整 `route.path + JSON.stringify(route.query)` 作为 keep-alive key。LocalMusic 的三个视图、关键词搜索和返回动作因此会创建多个独立的 `LocalMusic/index.vue` 实例；每个实例都保留 tracks、分组、封面映射、watcher 和 DOM。

本轮只对 `/local` 路由使用稳定 key（`/local`），其它路由仍保留 query-specific key。LocalMusic 已有 `route.query.view` / `route.query.keyword` watcher，因此视图和搜索状态仍由同一实例响应式更新；`/local/detail` 不受影响。

修改文件：

- `src/renderer/components/layout/View.vue`
- `tests/regression/local-view-keepalive-key.test.cjs`

## 受控压力序列

两次均使用独立隔离 profile、同一构建环境和同一 CDP 导航序列：

```text
#/local?view=tracks
#/local?view=albums
#/local?view=artists
#/local?view=tracks&keyword=a
#/discover
#/local?view=albums
#/local?view=artists
#/local?view=tracks
```

GPU process Private Bytes 不能解释为显存；两次 profile 的缓存冷热仍可能影响全树指标。

## 结果

| 指标 | 修改前 | 修改后 | 变化 |
|---|---:|---:|---:|
| CDP Documents | 24 | 3 | -87.5% |
| CDP Frames | 2 | 2 | 持平 |
| CDP Nodes | 18,422 | 2,797 | -84.8% |
| Renderer JS heap used | 26,886,904 B | 13,826,260 B | -48.6% |
| Renderer JS heap total | 49,184,768 B | 31,719,424 B | -35.5% |
| Renderer Private Bytes | 305.55 MiB | 224.01 MiB | -26.7% |
| 全进程 Working Set | 1178.90 MiB | 1112.77 MiB | -5.6% |
| 全进程 Private Bytes | 1303.04 MiB | 1136.23 MiB | -12.8% |
| CPU（单核百分比总和） | 14.0% | 13.6% | -0.4 pp |
| 线程 / 句柄 | 319 / 4720 | 317 / 4699 | -2 / -21 |

修改后等待 8 秒再采样：Documents 2、Nodes 2,809、JS heap used 14,256,580 B、Renderer Private Bytes 220.17 MiB、全进程 Private Bytes 1098.04 MiB。没有观察到回收后的持续增长。

全树 Private Bytes 的下降不能全部归因于 keep-alive，因为 GPU Private Bytes 同时从 672.14 MiB 波动到 588.97 MiB；但 Documents、DOM、Renderer heap 和 Renderer Private Bytes 的同步下降直接对应实例归并，证明该方向有明确收益。

## 功能验证

- `node --test tests/regression/local-view-keepalive-key.test.cjs`：先 RED，最小实现后 GREEN。
- `npx eslint src/renderer/components/layout/View.vue tests/regression/local-view-keepalive-key.test.cjs`：通过。
- `npx tsc --noEmit -p src/renderer/tsconfig.json`：通过。
- `npm run build:renderer`：通过，Webpack 用时 107.110 s。
- `npm run smoke:renderer -- --port=9341`：通过；Discover、Search、LocalMusic、Download、Settings、播放、Aura、Folia、沉浸模式均通过，`exceptions: []`。

## 决策

保留稳定 key。该改动没有关闭页面功能、动效或 keep-alive，只避免同一 `/local` 页面因 query 变化复制实例。下一步优先对 LocalMusic 的搜索 projection 和 album/artist group 在同一实例内的重复对象做分配测量，再决定是否需要缓存或投影化；不直接扩大 Native Core 边界。
