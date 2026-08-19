# Stage 1 与暂停期前端改动整合计划

**目标：** 在不进入 Stage 2、不改变既有后端业务语义的前提下，完成 Native Metadata/Artwork Stage 1，并把暂停期间的动态封面、统一搜索、发现页和网易云账号设置改动补到可验证状态。

**边界：** 继续使用 Stage 0 Backend API；Native Core 仍是独立 Rust sidecar；Metadata 默认 shadow、写入默认 Electron、Artwork 独立开关与 Electron 回退。前端改动不得感知 Native cache、named pipe 或 IPC channel。

## 任务 1：建立行为保护网

- 修正 `tests/regression/hybrid-native-stage1-boundaries.test.cjs` 对 metadata 写入适配器实现细节的过度约束，继续验证 Native 写入失败时不会二次写 Electron。
- 新建前端整合回归测试，覆盖动态封面 HLS 相对地址、token 失效刷新、同曲并发加载、默认静态模式探测、搜索键盘交互、发现页交互语义与 reduced-motion。
- 先确认新增测试能暴露当前缺口，再修改实现。

## 任务 2：完成动态封面链路

- `src/renderer/utils/appleDynamicCover/hls.ts`：使用标准 URL 解析相对/绝对播放列表地址。
- `src/renderer/utils/appleDynamicCover/token.ts`：清理持久缓存时同时失效内存中的请求/令牌；避免失败 promise 永久缓存。
- `src/renderer/utils/appleDynamicCover/index.ts`：无视频时继续尝试其他 storefront，并返回实际命中的 storefront。
- `src/renderer/store/player/dynamicCover.ts`：相同请求复用同一个 in-flight promise；用请求代次防止旧请求覆盖新曲目。
- `src/renderer/components/layout/PlayDetail/index.vue`：进入详情时可懒探测，动态模式自动应用，静态模式仅提示一次且不强制切换。

## 任务 3：收尾搜索、发现页和账号设置

- 修复小尺寸搜索框容器尺寸，补 Enter/Space 触发和 reduced-motion。
- 清除发现页嵌套交互元素，补键盘语义、图片复用恢复、加载/错误状态区分和 reduced-motion。
- 检查网易云 cookie 保存、账号信息与日推请求的现有设置同步；移除确认无用途的占位 UI。
- 不进行视觉重做，只修复汇总所述功能的完整性、可访问性和明显稳定性问题。

## 任务 4：完成 Stage 1 验证与文档

- 依次运行相关回归、typecheck、Backend contract、Rust 单测/集成语料、boundary check、lint、完整 build。
- 用独立临时 profile 运行 renderer/native smoke；按 Stage 0 同场景重新采集 Electron 全进程加 sidecar 的资源数据，无法可靠复现的场景明确记录限制。
- 更新 Stage 1 状态、shadow 差异和性能文档，只记录实测结果，不把 shadow/native 接口标为所有权迁移完成。

## 任务 5：提交与停止点

- 复核 diff，不纳入任何 Stage 2、Library、Download 或 Player Native 工作。
- 将 Stage 1、前端功能与验证文档整理成可审查提交；不 push。
- 给出 Stage 1 最终报告后停止，等待是否进入 Stage 2 的决定。
