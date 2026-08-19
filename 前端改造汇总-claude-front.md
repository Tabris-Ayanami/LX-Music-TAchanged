# LX Music 前端改造汇总（claude-front 分支）

> 分支：`claude-front`（自 `hybrid-native` 检出）
> 日期：2026-08-19
> 说明：本会话对 LX Music Desktop 前端做的一系列视觉/交互/功能改动。全部改动已通过 `tsc -p src/renderer` typecheck。

---

## 一、新增文件

| 文件 | 说明 |
|------|------|
| `src/renderer/views/Discover/index.vue` | **发现首页**（替代原搜索空态页）。包含：正在播放三标签、每日推荐、搜索历史、热门搜索 |
| `src/renderer/components/common/OriginChip.vue` | **OriginButton 风格的胶囊按钮**（落点扩散填充动效，灰白默认色），复用于搜索历史/热门搜索 chips 和歌单页"打开歌单"按钮 |
| `src/renderer/utils/musicSdk/wy/account.js` | **网易云账号模块**：`getAccountInfo()` 校验 Cookie、`getDailyRecommend()` 拉取每日推荐（weapi，走 song detail 接口保证封面可靠） |

---

## 二、修改文件

### 1. 路由与导航
- **`src/renderer/router.ts`**
  - 新增 `/discover` 路由（`views/Discover/index.vue`）
  - 默认重定向 `/:pathMatch(.*)*` 从 `/search` 改为 `/discover`

### 2. 侧边栏
- **`src/renderer/components/layout/Aside/NavBar.vue`**
  - 导航项"搜索"改为"发现"（`/discover`，图标 `#icon-compass`）
  - 选中 pill 改为**主题色液态玻璃水滴**：主色渐变 + 顶部高光 + 内阴影，hover 上浮 2px；去掉廉价的大投影/高光
- **`src/renderer/components/layout/Aside/index.vue`**
  - 品牌 logo 链接指向 `/discover`
- **`src/renderer/components/layout/Aside/NowPlayingList.vue`**
  - 选中行从白玻璃改为**主题色渐变**，去掉封面小图投影、去掉廉价向下阴影

### 3. 图标
- **`src/renderer/components/layout/Icons.vue`**
  - 新增 `#icon-compass` 指南针图标（发现页导航用）

### 4. 顶部工具栏
- **`src/renderer/components/layout/Toolbar/SearchInput.vue`**
  - 本地音乐页（`/local`）时，搜索框回车跳 `/local?view=xxx&keyword=xxx` 做本地过滤；否则走 `/search` 联网搜索
- **`src/renderer/components/material/SearchInput.vue`**
  - 搜索框重构为 **Gooey Search** 结构：`svg#lx-search-goo` 滤镜作用层包裹「输入胶囊 + 圆形搜索钮 + 联想下拉」，三者液化融合成连续体（修复之前下拉断节）
  - 联想项级联淡入（`transition-delay` 逐条延迟）
  - 颜色区分：浅色模式实底白 + 深色边框 + 浅投影；深色模式实底深面板 + 主题色描边（不再融入背景）

### 5. 发现首页（`src/renderer/views/Discover/index.vue`）
- **正在播放三标签**
  - 默认：中间为展开长方形（浮岛式：封面+歌名/歌手+播放键），左右为正方形封面铺满
  - hover 任意块：该块展开成长方形，其余收缩为正方形；移开后恢复中间展开
  - 上下首点击用 `playList(playerListId, index)` 显式索引循环（首尾回绕）
  - 上下首播放键用 `#icon-prevMusic`/`#icon-nextMusic` 主题色图标
  - 背景取色：`fetch` blob + canvas 提取**主导色**（跳过低饱和/过暗/过亮像素），`colorVersion` ref 建立响应式依赖，异步取色完成后刷新；失败回退主题色
  - 本地噪点纹理（4 组 SVG feTurbulence 随机选一）
- **每日推荐**
  - 横向滚动卡片；标题右侧"播放全部"（主题色 OriginButton 落点扩散）+ 歌曲数
  - 点击单曲只 `playMusicInDefaultList(item)`（只加一首）；播放全部才 `playMusicsInDefaultList(全部,0)`
  - 鼠标滚轮在推荐区横向滚动
  - 去掉封面 hover 时浮现的白色播放圆圈，仅保留左上角序号
- **搜索历史 / 热门搜索**：改用 `OriginChip`（灰白落点扩散），前三名排行主题色

### 6. 歌单页
- **`src/renderer/views/songList/List/components/SortTab.vue`**
  - "最新/最热"从 `base-tab` 换成 `LiquidGlassSegmentedNav` 滑动滑块
- **`src/renderer/views/songList/List/index.vue`**
  - 右侧切换音源从 `base-selection` 换成 `LiquidGlassSegmentedNav` 滑块
  - "打开歌单"按钮换成 `OriginChip`（灰白、落点扩散），高度 34px 与滑块同高
- **`src/renderer/views/songList/List/components/OpenListModal.vue`**
  - 音源选择宽度收窄到 110px（label-content 与下拉同步）
- **`src/renderer/views/songList/List/components/TagList.vue`**
  - 分类弹窗宽度改为**从按钮到 view 右边界自适应**，去掉 250px 硬上限导致的内滚动条

### 7. 本地音乐页
- **`src/renderer/views/LocalMusic/index.vue`**
  - 删除三个视图各自的**内嵌搜索框**，本地搜索集成到顶部搜索框
  - 去掉 `.contentCard` 圆角卡片壳，改为全出血布局（`page` 内边距 + 透明容器）
  - `keyword` 由路由 query 驱动（`/local?view=&keyword=`）

### 8. 我的列表页
- **`src/renderer/views/List/index.vue`**
  - 容器改为 `padding + gap`，左右两栏分离
- **`src/renderer/views/List/MyList/index.vue`**
  - 左列表栏从 `16%` 改固定 `230px`；去掉圆角玻璃卡，改细分隔线
  - 选中项：主题色 3px 竖条 + 主题色文字 + 淡主题色底
  - 修复 base-input 残留导致"一项占两行"（高优先级隐藏 `.listsInput`）
- **`src/renderer/views/List/MusicList/index.vue`**
  - 右列表改全出血，去掉独立卡片壳

### 9. 网易云账号管理
- **`src/renderer/views/Setting/components/SettingAccount.vue`**
  - 新增"网易云账号"区块（粘贴/保存/测试/清除 Cookie，`account.wy.cookie`），移除原"其他平台占位"
- **`src/renderer/utils/musicSdk/wy/utils/index.js`**
  - 新增 `getWYCookie()` 读取已保存网易云 Cookie
- **`src/renderer/utils/musicSdk/wy/index.js`**
  - 挂载 `account` 模块

### 10. 多语言
- **`src/lang/zh-cn.json` / `en-us.json` / `zh-tw.json`**
  - 新增：网易云账号（`setting__account_wy*`）、发现页（`discover__*`：now_playing / prev / next / play_all / daily_* 等）

---

## 三、设计语言要点

- **液态玻璃水滴**：主题色渐变 + 顶部镜面高光 + 内阴影，用于侧栏选中、播放键、滑块
- **OriginButton 落点扩散**：鼠标落点圆形填充扩散（`cubic-bezier(.16,1,.3,1)`），主题色给"播放全部"，灰白给 chips/打开歌单
- **Gooey 搜索**：SVG 滤镜液化输入胶囊 + 圆钮 + 联想下拉
- **取色**：canvas 主导色提取 + 亮度校正（太暗提亮/太亮压暗），失败回退主题色
- **约束**：不滥用高光、不用廉价大投影；所有组件用 `--color-primary` / `--shell-*` / `--color-font` 既有 token，不硬编码色值

---

## 四、已知注意点

- 仓库基线有大量 fork 自带改动 + CRLF 换行，`git diff` 与上游差异很大；本环境无权限写 git 索引（`.git/index.lock`），**改动只在工作树**，未 commit
- 网易云每日推荐需要真实 `MUSIC_U` Cookie 才有效，失效时发现页显示"加载失败 + 重试"
- 取色依赖图片 CORS：图床带 CORS 头可正常取色；否则回退主题色（不再是灰黑）

---

## 五、2026-08-19 整合完成记录

上述暂停期间改动已在 `hybrid-native` 上完成整理，并补上 Discover 加载/错误/空状态、交互元素语义、历史项删除层级、图片错误恢复和 reduced-motion。Discover 已加入 Renderer smoke；网易账号区只保留已实现能力，没有保留不可用的平台占位。

这些前端改动没有改变 Stage 1 的 Native 范围，也没有新增 Renderer 对 Electron/Node/pipe/cache 布局的直接依赖。专项回归 8/8；完整 regression 81/87，6 个失败与 Stage 0 既有视觉断言基线相同。
