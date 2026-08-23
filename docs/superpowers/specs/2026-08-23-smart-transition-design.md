# 智能过渡重构设计

**日期：** 2026-08-23

**状态：** 待用户审阅

**范围：** Electron renderer 播放器的智能过渡；不改变歌曲速度和音调

## 1. 背景与根因

当前工作区中的智能过渡实现有三个结构性问题：

1. 播放器只为第一条 `HTMLAudioElement` 创建了 `MediaElementAudioSourceNode`。切换到第二条媒体元素后，第二条轨道绕过了现有均衡器、卷积、变调和输出增益链，随后切回第一条又恢复到另一条音频路径。
2. 过渡使用 45ms 定时器修改媒体元素 `volume`。音量是离散阶跃，不是音频时钟上的平滑参数，容易形成 zipper noise、点击声和短暂的电流声；同时还会与 Web Audio 效果链的输出音量叠加。
3. 自动播放到结尾后才开始解析下一首 URL，没有把“下一首 URL 获取”“备用轨道可播放”“开始过渡”拆成可取消的阶段，因此尾部静音时会出现空白或过渡太晚。

参考实现中，LiveSort 使用首尾片段的 RMS、静音尾长和动态能量决定重叠区；KugouMusic.NET 使用双轨、预加载、可取消的过渡任务和完成后的轨道交换；Folia 将媒体源与 Web Audio 效果图保持稳定连接。本设计组合这三个可复用的边界，但不引入 BPM 对拍或变速。

参考：

- [LiveSort](https://github.com/LuN3cy/LiveSort)
- [folia-major](https://github.com/chthollyphile/folia-major)
- [KugouMusic.NET](https://github.com/Linsxyx/KugouMusic.NET)

## 2. 目标与非目标

### 目标

- 自动播放到下一首时，提前取得 URL、加载备用轨道，并在备用轨道真正可播放后开始交叉淡化。
- 当前歌曲尾部提前进入持续静音时，允许在静音开始附近启动下一首，避免“歌曲文件还有几秒但实际已经没有声音”造成空白。
- 手动点击列表时不预判下一首；但旧歌曲继续播放直到新 URL 已加载并可播放，再从备用轨道平滑接入。
- 暂停、停止、再次点歌、切换播放模式、URL 错误和过渡失败都能取消旧任务，不让旧请求或旧事件覆盖当前歌曲。
- 两个媒体轨道都经过同一套均衡器、卷积、变调、声像和输出链；过渡只改变轨道专用增益。
- 保持现有播放器事件契约、播放进度、媒体键和输出设备行为。
- 智能过渡关闭时维持原有单轨直接加载行为。

### 非目标

- 不改变播放速度、音调或节拍，不做 beat matching、time-stretch 或 pitch shifting。
- 不下载整首在线歌曲进行离线分析；在线场景只做当前播放尾部的轻量实时分析。
- 不重写 native 播放核心或其它无关的关闭行为、动态封面和列表功能。

## 3. 总体架构

### 3.1 稳定双轨音频图

播放器创建两个长期存在的媒体轨道 `deckA` 和 `deckB`。每个轨道只调用一次 `createMediaElementSource`，并连接到独立的 `deckGain`：

```text
deckA element -> deckAGain ─┐
                             ├-> shared input -> analyser -> EQ -> pitch -> convolution -> panner -> master -> destination
deckB element -> deckBGain ─┘
```

- `deckGain.gain` 是唯一的过渡控制点；媒体元素自身固定为 `volume = 1`，避免媒体元素音量和 Web Audio 增益叠加。
- 现有 `analyser` 保持为混合后公共频谱分析器，继续服务可视化；另为每个轨道提供轻量 RMS 采样器，用于判断当前尾部是否进入静音。
- 现有 EQ、卷积、pitch shifter、panner 和输出节点只保留一套。轨道交换不再断开或重建共享图。
- 输出音量和 ReplayGain 统一落在公共 `masterGain`；用户音量、静音、播放速率、保留音调、输出设备设置同时应用到两个 deck。

### 3.2 过渡协调器

新增一个纯逻辑协调器，播放器层只负责真实媒体和音频参数，自动预加载层负责歌曲选择和 URL 获取。协调器状态为：

```text
idle -> preparing -> ready -> running -> idle
  \-> cancelled / failed -> idle
```

每次准备和过渡都有递增 `operationToken`。所有异步回调提交前必须验证 token、目标歌曲 ID 和当前 deck generation；失效回调只能清理自己的资源，不能提交状态。

协调器对外提供以下固定边界：

- `prepareNext(source, identity)`：把 source 加载到非活动 deck，等待 `canplay`/可播放状态，不启动声音。
- `startPreparedTransition(options)`：仅在备用 deck ready 且活动轨道正在播放时启动；返回是否成功。
- `loadImmediate(source)`：空轨道、暂停状态或智能过渡关闭时直接加载。
- `cancelPrepared(reason)`：取消 URL/媒体加载、停止备用轨道并将其增益恢复为零。
- `getTransitionTelemetry()`：返回活动轨道剩余时间、短时 RMS、峰值 RMS、静音持续时间和 ready 状态。

## 4. 过渡触发与曲线

### 4.1 自动播放

现有 `usePreloadNextMusic` 改为真正的备用轨道预加载器：

1. 当前曲剩余约 10 秒时调用 `getNextPlayMusicInfo()`，只允许一个预加载任务在途。
2. 获取下一曲 URL；失败时按现有 URL 刷新策略重试一次。成功后调用 `prepareNext`，等待备用 deck `canplay`。
3. 当备用 deck ready 后持续等待触发条件：
   - 当前尾部连续约 300ms 低于相对峰值阈值（同时不低于安全绝对阈值），并且剩余时间处于过渡窗口；或
   - 未检测到可靠尾部静音，但剩余时间进入固定重叠窗口。
4. 在触发前再次确认当前歌曲、播放模式、`operationToken` 和下一曲 identity 未改变，然后先更新歌曲状态，再调用 `startPreparedTransition`，避免旧轨道的 `ended` 事件把队列推进两次。
5. 过渡完成后才停止并清空 outgoing deck，交换 active/standby 角色；新 active 的时间从 0 开始，旧 active 的事件全部被过滤。

### 4.2 尾部静音

实时检测使用每个 deck 的时域 RMS，不依赖整首文件下载：

- 维护短时 RMS、近窗口峰值和静音起始时间。
- 静音阈值取 `max(绝对地板, 峰值 * 相对比例)`，并要求连续静音窗口，避免单个低音鼓或网络抖动误触发。
- 静音很长时最多提前到 `maxLeadSec`，不会因为一段过长的编码尾巴而让两首歌重叠十几秒。
- 下一曲未 ready 时不启动过渡；若活动曲先结束，退回普通播放切换，不能等待预加载而卡住。

### 4.3 淡化参数

默认使用约 5–7 秒的重叠区，具体值由当前剩余时间和尾部静音位置裁剪，且保留最小安全重叠。两条增益使用等功率（cos/sin）曲线，并设置总增益上限：

- outgoing 从 1 平滑降到 0；
- incoming 从 0 平滑升到 1；
- 入轨前段保留短暂 breath，避免鼓点/瞬态在第一帧突然出现；
- 所有 `AudioParam` 先 `cancelScheduledValues(now)`，再 `setValueAtTime` 和 `linearRampToValueAtTime`；不再使用 `setInterval` 驱动媒体元素音量。

## 5. 手动点歌与普通切换

- 手动点击列表、上一首、下一首时先取消自动预加载和已有过渡，但不停止当前 active deck。
- 新歌曲 URL 获取成功后走 `prepareNext`；新 deck ready 且旧曲仍在播放时立即开始一次手动交叉淡化。
- URL 获取期间旧歌继续播放，因此网络延迟只会延后切换，不制造人工空白。
- 如果旧歌已经自然结束或用户主动停止，则 `loadImmediate`，不人为等待淡化。
- 智能过渡关闭时，保留旧的 `stop -> load -> play` 语义，不创建备用轨道任务。

## 6. 事件、状态与竞态

- 事件监听绑定到两个固定 deck，但回调只接受当前 active deck generation 的事件。
- outgoing 的 `ended`、`pause`、`waiting` 和 `error` 在过渡期间不能触发应用级下一曲、暂停或错误；incoming 只有在成为 active 后才发布应用层事件。
- `pause`：停止自动触发计时，冻结当前 active；取消未开始的备用准备，恢复播放后重新预加载。
- `stop`：取消所有 token，两个 deck 停止，清空 source 和 gain，发布一次 emptied。
- 新的手动歌曲、队列模式变化、随机列表重置会取消旧预加载；旧网络请求即使返回也不能调用 `load` 或切换歌曲。
- `play()` 被浏览器策略拒绝时恢复到 paused 状态，不清空正在播放的旧曲，也不把备用 deck 误标记为 active。

## 7. 失败降级

- URL 获取失败或备用 deck 在限定时间内无法 `canplay`：记录一次可诊断错误，清理备用资源；自动播放到结尾时使用普通下一曲逻辑。
- `incoming.play()` 失败：取消本次过渡，把 outgoing 增益恢复到 1，保持原曲继续播放；不重复提交歌曲状态。
- Web Audio 初始化失败：回退到现有单轨媒体播放；智能开关不会阻止歌曲播放。
- 输出设备切换失败：保留当前设备并让两个 deck 都继续走现有错误处理，不重建音频图。

## 8. 文件边界与测试策略

预期修改边界：

- `src/renderer/plugins/player/index.ts`：双 deck、稳定音频图、AudioParam 淡化、活动轨事件过滤。
- `src/renderer/core/useApp/usePlayer/usePreloadNextMusic.ts`：从 metadata 探测改为可取消的备用轨道预加载与自动触发协调。
- `src/renderer/core/player/action.ts`：区分手动切歌、预加载切歌和普通切歌，确保歌曲状态与真实 active deck 同步。
- `src/renderer/backend/contracts.ts`、`electron.ts`、`fake.ts`：补充准备/提交/取消边界及 fake 行为。
- `tests/regression/`：新增纯状态机/过渡计算回归测试；必要时增加播放器音频图的轻量 fake。

测试先行覆盖以下可观察行为：

1. 尾部静音连续达到阈值时，在安全窗口内触发；瞬时低能量不会触发。
2. 备用轨未 ready 时不会启动过渡；ready 后只提交一次。
3. URL 获取慢时旧曲继续播放；旧曲结束后能安全降级到普通切换。
4. 手动点歌会取消旧预加载；旧请求返回后不能覆盖新歌曲。
5. 取消、暂停、停止和过渡失败会恢复 outgoing 增益并清空 standby。
6. 过渡完成只发布一次 active 切换；outgoing 的 `ended` 不会重复推进队列。
7. 智能过渡关闭时现有直接加载路径保持不变。

验证命令至少包括：

```text
npm run typecheck
npm run lint -- --no-fix
npm run test:unit
```

## 9. 兼容与迁移

- 保留现有 `player.isSmartTransition` 设置，默认值继续为 `false`，降低升级风险。
- 删除旧的 `fadeOutAudio`、`prepareFadeOut` 和基于媒体元素 `volume` 的过渡状态，避免两套机制同时运行。
- 保留现有播放器事件名称和公共后端接口语义；新增的准备/过渡方法只在 renderer player service 内使用，并由 fake 实现覆盖。
- 不改动工作区中与智能过渡无关的动态封面、列表、窗口关闭行为等未提交改动。
