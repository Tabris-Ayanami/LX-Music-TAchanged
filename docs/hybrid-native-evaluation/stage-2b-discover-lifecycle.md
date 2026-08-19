# Stage 2B-1：Discover 非活动资源生命周期

## 变更

Discover 由 `keep-alive` 缓存。现在页面失活时会：

- 取消尚未完成的封面取色 `Image` 加载，并移除其回调；
- 使失活前发出的每日推荐异步结果失效；
- 移除每日推荐和播放卡片的图片节点，清空页面级颜色缓存；
- 再次激活时重新建立页面资源。

播放队列、搜索历史、热门搜索和全局播放器状态不由该生命周期拥有，因此没有被清空。

## 代表性验证

验证继续使用隔离的 14 条本地媒体记录 / 13 个复制文件，不接触真实运行配置，也没有扫描全部媒体库。每个温度仅运行 1 次，所以以下数字只用于方向检查，不构成正式统计。

### navigation-pressure（最终停留在 Discover）

| 温度 / 阶段 | 修改前总 Private Bytes | 修改后总 Private Bytes | 方向 |
|---|---:|---:|---:|
| cold / stable | 1161.44 MiB | 1023.42 MiB | -11.9% |
| cold / recovery 60s | 1122.87 MiB | 963.17 MiB | -14.2% |
| warm / stable | 1161.62 MiB | 1315.17 MiB | +13.2% |
| warm / recovery 60s | 1067.88 MiB | 1179.97 MiB | +10.5% |

冷热方向相反，差异主要来自 GPU process Private Bytes；Renderer 在 60 秒恢复点分别为修改前/后 263.15/265.43 MiB（cold）和 265.03/265.12 MiB（warm），基本不变。

### local-tracks（Discover 处于非活动状态）

| 温度 | 修改前总 Private Bytes | 修改后总 Private Bytes | 修改前 Renderer | 修改后 Renderer |
|---|---:|---:|---:|---:|
| cold | 945.67 MiB | 872.07 MiB | 189.92 MiB | 194.87 MiB |
| warm | 884.73 MiB | 909.28 MiB | 156.99 MiB | 146.31 MiB |

冷热仍然方向不一致。修改前后采样视图中的 DOM 图片数均为 0，说明这一场景不能证明新增生命周期处理降低了常驻图片内存。

原始输出：

- `F:\player\lx-stage2a-subset-20260819-154100\reports\stage2b-discover-lifecycle`
- `F:\player\lx-stage2a-subset-20260819-154100\reports\stage2b-discover-inactive`

## 决策

保留失活时取消异步图片和拒绝陈旧请求结果的边界，作为资源所有权修正；不把本轮结果记作已证实的内存优化，也不据此进入 Native LibraryService。

下一项优先调查 Discover 图片输入尺寸。本轮 Discover 样本同时有 31 张已加载图片，固有尺寸合计约 53,530,329 像素；这是比单次 GPU process 波动更直接的图片解码压力信号。后续应先做图片缩略尺寸的单变量 A/B，再决定是否保留额外复杂度。
