# UI/UX Pro Max Optimization Guide

本指南基于 `ui-ux-pro-max` skill 对当前 LX Music Desktop 的分析整理，用于约束后续 agent 做整体 UI 优化。目标不是一次性把界面改成另一套视觉风格，而是在现有 Vue/Electron 音乐播放器基础上逐步统一视觉、动画和主题规则。

## 项目定位

- 产品类型：桌面音乐播放器，主体验是内容浏览、播放控制、全屏沉浸播放、歌词和播放队列。
- 技术栈：Vue 3 单文件组件、Less、Electron；不引入新的 UI 框架作为整体替换。
- 视觉方向：保留当前的浅色液态玻璃、专辑色提取、浮岛播放器和全屏播放器方向；暗色模式作为同一 token 系统下的主题变体实现。
- 优化原则：先统一规则，再迁移局部组件；每次只改一个功能区，并补充对应回归测试。

## 采纳与修正

`ui-ux-pro-max` 对本项目给出的默认方向偏向 `Dark Mode (OLED)` 和沉浸式娱乐界面。对本项目应这样取舍：

- 采纳：沉浸式播放器、暗色模式、可访问对比度、150-300ms 微交互、`prefers-reduced-motion`、z-index 层级、SVG 图标一致性。
- 修正：不要把全局直接改成纯黑 OLED；不要引入 Google Fonts 作为默认字体；不要把桌面端改成移动端式 CTA 流程。
- 避免：霓虹、赛博、vaporwave、RGB split、装饰性无限动画。这些会和现有音乐播放器的克制玻璃风格冲突。

## 全局设计 Token

后续 UI 改造应优先新增或复用语义 token，而不是在组件里继续写散落的 `rgba(...)`、阴影和圆角。

建议新增 token 层：

- `--app-bg`
- `--app-bg-elevated`
- `--surface`
- `--surface-strong`
- `--surface-glass`
- `--surface-glass-border`
- `--text-primary`
- `--text-secondary`
- `--text-muted`
- `--icon-primary`
- `--icon-secondary`
- `--divider`
- `--overlay-scrim`
- `--focus-ring`
- `--motion-fast`
- `--motion-normal`
- `--motion-slow`
- `--motion-ease-standard`
- `--motion-ease-enter`
- `--motion-ease-exit`

当前项目已有 `src/renderer/assets/styles/colors.less` 和 `src/renderer/assets/styles/variables.less`。建议不要删除原 Material 色板，而是在 `variables.less` 或新建 `tokens.less` 中建立语义层，再逐步让组件从语义 token 取值。

## 明暗主题规则

暗色模式应和浅色模式共用同一批语义 token，只切换 token 值。

- 浅色主题继续保持低饱和浅背景、蓝色主色、玻璃面板。
- 暗色主题背景避免纯黑大面积使用，优先使用 `#0b1020`、`#111827`、`#151b2d` 这一类深蓝灰，以减少 OLED 拖影和专辑封面边缘割裂。
- 暗色主题的玻璃层不要简单反色，应降低白色透明度，提高边框和文字对比。
- 文本对比：正文和主按钮文字至少 4.5:1，次级文本至少 3:1。
- 图标颜色必须从 `--icon-primary` / `--icon-secondary` 获取，避免浅色图标在暗色背景下被重复加亮。

## 动画规则

本项目已有浮岛、全屏播放器、播放队列、侧栏折叠等复杂动画。后续不要散写过多 timing，应统一为 motion token。

- 微交互：150-220ms。
- 面板、抽屉、浮层：220-320ms。
- 全屏播放器 shared-element 过渡：320-420ms，但必须可中断。
- 进入动画使用 ease-out 或 `cubic-bezier(0.16, 1, 0.3, 1)`。
- 退出动画可略短，约为进入时长的 60%-75%。
- 位置和尺寸变化优先使用 `transform` 和 `opacity`，不要直接动画 `left/top/width/height`，除非该组件已有稳定布局保护。
- 必须支持：

```less
@media (prefers-reduced-motion: reduce) {
  * {
    animation-duration: 1ms !important;
    transition-duration: 1ms !important;
  }
}
```

对播放详情页的约束：

- 点击专辑图进入全屏时，专辑图、背景、按钮、歌词不能出现“出现-消失-出现”的重复渲染。
- 退出全屏时，浮岛 shell 和全屏 shell 必须有交接，不要让终点先出现纯白方块再补渲染。
- 同一轮动画里只允许一个地方负责显示/隐藏浮岛 shell，避免多个定时器互相抢状态。

## 层级与浮层

建议建立固定 z-index 刻度，替代随手写大数字：

- `--z-base: 0`
- `--z-sticky: 10`
- `--z-toolbar: 20`
- `--z-player: 30`
- `--z-drawer: 40`
- `--z-modal: 60`
- `--z-toast: 80`
- `--z-transition-proxy: 100`

播放队列、歌词菜单、全屏播放器、浮岛过渡代理必须使用这套层级。特别注意新 stacking context：`transform`、`filter`、`opacity < 1`、`position + z-index` 都可能隔离子元素。

## 组件优先级

建议按以下顺序推进整体 UI 优化：

1. 全局 token：颜色、文字、圆角、阴影、motion、z-index。
2. 基础组件：`Btn.vue`、`Input.vue`、`Popup.vue`、`Menu.vue`、`SliderBar.vue`。
3. 固定框架：`Toolbar`、`Aside`、`PlayBar`、`FloatingIsland`。
4. 高频列表：本地音乐、歌曲列表、搜索结果、下载列表。
5. 高风险动效：`PlayDetail`、播放队列 drawer、歌词菜单、评论面板。
6. 暗色模式：先让全局 token 可切换，再逐块替换组件硬编码色值。

## 代码改造守则

- 不做“一键全局替换 rgba 为 token”。先审查用途：文字、边框、玻璃、高亮、阴影分别映射。
- 不新增大而全的 UI 框架；这个项目已有自己的基础组件和样式体系。
- 不在业务组件里重复定义同一类玻璃面板效果；抽成 mixin 或 token 后复用。
- 不随意改图标 SVG 文件比例。图标对齐优先通过容器、viewBox、`transform` token 解决，并保留回归测试。
- 不把圆角全部统一成一种数值。浮岛/胶囊可用 `999px`，面板用 16-28px，列表项用 6-10px。
- 不用装饰性渐变球、噪点、霓虹描边来“提升质感”。当前方向是内容优先的克制玻璃。

## 检查清单

每次完成 UI 修改前至少检查：

- 交互目标不小于 44x44px。
- 图标按钮有可感知 hover/active/focus 状态。
- 键盘 focus ring 可见。
- 展开和收拢状态的左边界、高度、中心点一致。
- 抽屉和弹层不遮挡触发按钮，用户能用同一按钮收回。
- 动画没有中途白块、闪烁、跳帧、终点补渲染。
- `prefers-reduced-motion` 下仍能操作。
- 新增硬编码颜色有明确理由，否则使用 token。
- 涉及核心布局时新增或更新 `tests/regression` 保护。

## 推荐命令

安装后的 skill 可用以下方式查询：

```powershell
python C:\Users\asus\.codex\skills\ui-ux-pro-max\scripts\search.py "desktop music player entertainment immersive liquid glass dark mode Vue Electron" --design-system -f markdown -p "LX Music Desktop"
python C:\Users\asus\.codex\skills\ui-ux-pro-max\scripts\search.py "animation accessibility z-index loading desktop music player" --domain ux -n 12 -f markdown
python C:\Users\asus\.codex\skills\ui-ux-pro-max\scripts\search.py "vue animation performance accessibility" --stack vue -n 10 -f markdown
```

## 下一步落地建议

第一轮实际代码改造建议只做 token 基础层：

- 新增 `src/renderer/assets/styles/tokens.less`。
- 在 `index.less` 中引入 token。
- 只迁移 2-3 个低风险基础组件验证方向。
- 不触碰 `PlayDetail` 和 `FloatingIsland` 动画，等 token 稳定后再单独处理。

