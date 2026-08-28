# 新对话提示词：继续 Stage 2B Discover 封面内存验证

请在下面的 LX-TA 仓库继续性能优化工作，并直接执行已写好的下一步计划：

```text
F:\player\lx-music-desktop-master\lx-music-desktop-master
```

首先完整阅读并执行：

```text
docs/superpowers/plans/2026-08-22-stage2b-discover-artwork-validation.md
```

同时阅读事实来源：

```text
docs/hybrid-native-evaluation/stage-2-memory-first-handoff.md
docs/hybrid-native-evaluation/stage-2a-memory-baseline.md
docs/hybrid-native-evaluation/stage-2a-attribution-report.md
docs/hybrid-native-evaluation/stage-2b-discover-lifecycle.md
docs/hybrid-native-evaluation/stage-2b-discover-artwork.md
docs/hybrid-native-evaluation/migration-plan.md
```

使用 `using-superpowers` 建立工作流，使用 `executing-plans` 按计划逐项执行；涉及代码时遵循 `test-driven-development`，结束前遵循 `verification-before-completion`。由于主工作树有用户必须保留的未提交修复，执行前使用 `using-git-worktrees` 从当前已提交的 `ds` HEAD 创建隔离工作树。不要在主工作树跑性能基线，也不要清理、覆盖、暂存或提交主工作树中的任何现有改动。

开始时执行并报告：

```powershell
git branch --show-current
git status --short
git log -8 --oneline --decorate
git rev-list --left-right --count hybrid-native...ds
```

交接时主工作树的活动分支是 `ds`，HEAD 为 `ffd3abd`，它是 `hybrid-native` 的直接后代并领先 7 个提交。旧文档中“必须切回 hybrid-native”的要求已经不适用于当前集成工作区；如果实际分支或提交关系发生变化，先报告差异，不要自行切换或重置。

主工作树中以下内容是上一轮已经完成并通过定向验证、但尚未提交的用户改动，必须原样保留：

```text
src/renderer/core/useApp/useDataInit.ts
src/renderer/views/List/MusicList/useListInfo.js
tests/regression/local-playback-source-independence.test.cjs
tests/regression/list-navigation-race.test.cjs
.opensquilla/
AGENTS.md
HEARTBEAT.md
IDENTITY.md
MEMORY.md
SOUL.md
TOOLS.md
USER.md
memory/
```

上一轮相关验证结果：3 个定向回归用例通过，TypeScript typecheck 通过，定向 ESLint 通过，`git diff --check` 通过。不要重复修复这两个功能问题，也不要把它们混入性能优化提交。

本轮唯一目标：

> 为 Discover 已保留的网易封面 `param=640y640` 限制建立 CDP-only 的“恢复原图”A/B 变体，并对 `discover-idle`、`navigation-pressure` 做 5 次 cold + 5 次 warm 对比，得到总进程树和 Renderer 指标的中位数/范围，再更新 Stage 2B 证据文档。

关键边界：

- 复用现有 `scripts/performance/stage2/` harness，不从头重做 Stage 2A。
- 复用仍存在的隔离 manifest：`F:\player\lx-stage2a-subset-20260819-154100\workspace-manifest.json`。
- 只操作隔离 profile、媒体副本和新建的报告目录，不接触真实 profile 或音乐原件。
- 因为使用 14 条记录/13 个文件的验证子集，即使每组跑 5 次也必须标记 `verification-only`；它能验证 Discover 图片 A/B，但不能宣称 Stage 2 完成。
- GPU process Private Bytes 不能当作 GPU 显存。
- 不通过删除功能、关闭动效或降低默认视觉质量制造收益。
- 不进入 Native LibraryService、Stage 2C、DownloadService、Native Player、WinUI/fooyin/Tauri/Wails 或换壳工作。
- 不 push。

执行节奏：先写变体失败测试并确认 RED，再最小实现、确认 GREEN；先跑 1 次 smoke 验证变体确实恢复原图，再跑 5 次冷/热矩阵。长时间运行时持续跟进，不要因为导航压力测试安静就误判为卡死。任何输出目录如果已经存在，改用新时间戳目录，绝不删除或覆盖旧报告。

完成后只交付：A/B 中位数与范围、完整进程树/Renderer 解释、报告路径与哈希、测试结果、本地提交、是否保留 640px、下一项证据驱动建议。然后停止，等待用户决定，不自动开始后续优化。
