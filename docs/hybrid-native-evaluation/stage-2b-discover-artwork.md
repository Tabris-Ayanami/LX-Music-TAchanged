# Stage 2B-2：Discover 网易封面尺寸限制

## 变更

Discover 展示网易 `music.126.net` 封面时，将请求参数统一为 `param=640y640`。修改只作用于页面展示 URL 和封面取色请求，不修改歌曲元数据、播放队列或下载所持有的原始封面地址；本地文件、`data:`、`blob:` 和非网易图片保持原样。

每日推荐卡片宽 132 CSS px，因此 640 像素可覆盖约 4.85 倍设备像素比。

## 代表性验证

继续使用隔离的 14 条媒体记录 / 13 个复制文件，每个温度只运行 1 次。

| 指标 | 尺寸限制前 | 640 限制后 | 变化 |
|---|---:|---:|---:|
| stable 图片节点 | 31 | 31 | 0 |
| stable 已加载图片 | 12 | 12 | 0 |
| stable 已加载图片固有像素 | 53,530,329 | 4,915,200 | -90.8% |
| cold stable 总 Private Bytes | 1023.42 MiB | 1025.31 MiB | +0.2% |
| warm stable 总 Private Bytes | 1315.17 MiB | 1254.24 MiB | -4.6% |
| cold recovery 60s Renderer | 265.43 MiB | 259.63 MiB | -2.2% |
| warm recovery 60s Renderer | 265.12 MiB | 258.39 MiB | -2.5% |

`4,915,200 = 12 × 640 × 640`，证明服务端返回的固有尺寸限制真实生效。cold recovery 60s 时共有 19 张图片完成加载，其总固有像素为 `7,782,400 = 19 × 640 × 640`，结论一致。

总体 Private Bytes 的冷热方向仍不一致，GPU process 也继续大幅波动，因此不能用本次单样本声称总体内存降低。Renderer 恢复点有小幅同向下降，但仍需更多重复样本才能视为收益。

原始输出：`F:\player\lx-stage2a-subset-20260819-154100\reports\stage2b-discover-640`

## 决策

保留 640 尺寸限制：它以很小的实现成本显著降低了确定可测的图片解码输入，同时为当前 132px 卡片保留充足清晰度。该结果不触发 Stage 2C 或 Native LibraryService。
