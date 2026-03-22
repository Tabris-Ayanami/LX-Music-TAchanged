# LX-TA

基于 [LX Music Desktop](https://github.com/lyswhut/lx-music-desktop) 深度定制的桌面音乐播放器分支。

这个版本主要围绕本地音乐体验、整体视觉语言和播放页交互做了重构，目标是做一个更适合日常桌面使用、风格更统一的播放器。

## 主要改动

- 新增本地音乐库入口，支持导入本地文件与文件夹
- 支持递归扫描多层文件夹中的音频文件
- 本地音乐新增曲库、专辑、音乐家视图
- 专辑与音乐家支持详情页，而不是点击即播放
- 主界面改为更现代的侧栏 + 顶部搜索 + 底部浮岛播放器布局
- 播放详情页视觉、歌词区、评论区、动画逻辑均已重做
- 支持播放页拖拽歌词调整进度
- 关于页已改为 `关于 LX-TA`

## 技术栈

- Electron
- Vue 3
- Webpack
- Less

## 开发环境

- Node.js >= 22
- npm >= 8.5.2

建议先确认版本：

```powershell
node -v
npm -v
```

## 本地开发

安装依赖：

```powershell
npm install
```

启动开发环境：

```powershell
npm run dev
```

## 构建与打包

只构建渲染层：

```powershell
npm run build:renderer
```

构建整个项目：

```powershell
npm run build
```

打包 Windows x64 安装版：

```powershell
npm run pack:win:setup:x64
```

常见的其它打包命令：

```powershell
npm run pack:win:portable:x64
npm run pack:win:7z:x64
```

## 仓库说明

当前仓库为定制分支项目，原始项目请见：

- [LX Music Desktop](https://github.com/lyswhut/lx-music-desktop)

## 署名

- Original Project: `lyswhut`
- Customized By: `Tabris-Ayanami`
