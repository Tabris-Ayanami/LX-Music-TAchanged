# Stage 2A 归因状态

## 结论

当前只有 control 的代表性单次验证，没有执行可比较的归因变体，因此不能对 Chromium、GPU、图片解码、页面 keep-alive、Renderer worker、数据库 worker或整库数据复制进行收益排序。

现有数字只支持以下有限判断：

- 全应用是 7 个进程，总 Private Bytes 在本轮代表性样本中约为 885–1,162 MiB；只看 sidecar 或 Main RSS 会严重低估应用内存。
- 导航动作后的 JS heap 和 DOM Nodes 在 30 秒显著回落，恢复阶段未观察到持续单调增长。
- GPU process Private Bytes 已计入总量，但没有可靠的 GPU memory counter，不能把该进程全部 Private Bytes解释成纹理或显存。
- 未测量完整媒体库常驻对象、跨 Main/worker/Renderer 的数据重复比例，也没有 `>= 10%` 或 `>= 100 MiB` 的 A/B 改善证据。

## 决策

Native LibraryService 当前不成立。Stage 2C 的触发条件没有被本轮验证满足，也没有被否定；它仍需正式的完整库 5 次冷/热基线和单变量归因数据。

用户随后批准继续 Stage 2B。Stage 2B-1 已完成 Discover 非活动资源生命周期实验；冷热样本方向相反，不能声称总体内存收益。Stage 2B-2 将网易封面限制到 640 像素，使相同 12 张图片的固有像素量下降 90.8%，但总体 Private Bytes 仍未形成正式统计。详细数据见 [生命周期实验](stage-2b-discover-lifecycle.md) 和 [封面尺寸实验](stage-2b-discover-artwork.md)。Stage 2C 仍不进入。

详细条件、单次数据和原始证据哈希见 [stage-2a-memory-baseline.md](stage-2a-memory-baseline.md)。
