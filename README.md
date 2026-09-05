# LX-TA

基于 [LX Music Desktop](https://github.com/lyswhut/lx-music-desktop) 定制的桌面音乐播放器，提供本地音乐库、网易云扫码登录、歌词播放页和沉浸可视化。

## 下载

[最新稳定版 v2.1](https://github.com/Tabris-Ayanami/LX-Music-TAchanged/releases/tag/v2.1) · 应用版本 2.1.0 · Windows x64

下载 Release 中的 `LX-TA-v2.1.0-x64-Setup.exe` 安装。更新内容见 [CHANGELOG.md](CHANGELOG.md)。

## 功能

- 导入本地文件或文件夹，递归扫描音频，按歌曲、专辑和歌手浏览。
- 网易云扫码登录与账号设置。
- 歌词、评论、播放进度交互，以及 Aura / 沉浸可视化。
- 原生媒体处理与 FFmpeg 转码。

## 开发环境

- Node.js >= 22、npm >= 8.5.2。
- 构建原生组件需要 Rust 稳定版；Windows 使用 MSVC 工具链和 Visual Studio C++ 构建工具。
- 技术栈：Electron、Vue 3、TypeScript、Webpack、Less、Rust；沉浸可视化使用 React / Three.js。

```powershell
npm ci
npm run dev
```

## 构建与打包

完整构建 Windows x64 安装包（依次构建原生组件、应用和安装包）：

```powershell
npm run pack
```

也可以分步执行：

```powershell
npm run build:native-core:release
npm run build
npm run pack:win:setup:x64
```

安装包输出到 `build/`。需要免安装压缩包时，在完成原生组件与应用构建后执行 `npm run pack:win:7z:x64`。

## 检查

```powershell
npm run lint
npm run typecheck
npm run test:unit
npm run test:backend-contract
npm run check:backend-boundaries
```

Windows x64 打包会自动检查包内依赖、SQLite、二维码生成及 FFmpeg。打包后可进一步验证联网生成二维码：

```powershell
npm run test:packaged -- build/win-unpacked --live
```

## 工程目录

| 目录 | 内容 |
| --- | --- |
| `src/` | 主进程、界面、共享类型和运行资源 |
| `native-core/` | Rust 原生媒体组件 |
| `build-config/` | 编译与安装包配置 |
| `resources/`、`licenses/` | 安装资源与许可文本 |
| `scripts/`、`tests/` | 构建辅助、验证与回归测试 |
| `publish/`、`.github/` | 发布脚本与工作流 |

依赖、编译输出和本地开发资料不纳入版本控制。

## 许可与署名

原项目作者：[lyswhut](https://github.com/lyswhut)；定制维护：[Tabris-Ayanami](https://github.com/Tabris-Ayanami)。

许可与第三方声明见 [LICENSE](LICENSE)、[LICENSE-APACHE-2.0](LICENSE-APACHE-2.0) 和 [NOTICE](NOTICE)，第三方源码保留其各自的许可和来源说明。
