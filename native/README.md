# LX-TA Native

这是 LX-TA 的 Windows 原生迁移工程，使用 C#、WinUI 3 和 Windows App SDK。它与仓库根目录的 Electron 版本并行存在，使用相同的 `LX-TA\LxDatas` 数据目录。

## 构建

```powershell
dotnet build native\LXTA.Native.slnx -c Debug
dotnet run --project native\LXTA.Native\LXTA.Native.csproj
dotnet publish native\LXTA.Native\LXTA.Native.csproj -c Release -r win-x64 --self-contained false
# 可验收发布包（同时复制 Node 脚本运行时）
powershell -ExecutionPolicy Bypass -File native\scripts\publish.ps1 -Architecture x64
```

脚本会同时生成可展开目录和 MSIX。x64 MSIX 默认位于 `native\LXTA.Native\AppPackages\LXTA.Native_1.0.0.0_x64_Test\`，并包含音源脚本运行时。

最低目标为 Windows 10 1809，建议 Windows 11。首次运行会从旧版 `config_v2.json` 导入主题、音量、下载目录、桌面歌词和托盘设置；原数据库以只读方式加载，写操作使用原有 SQLite schema。

## 当前已接入

- 原版主题 JSON 与绿色主色
- 纯色、云母（Mica）、亚克力（Acrylic）窗口材质选项
- 原版 SQLite 歌单与歌曲读取、搜索、歌单筛选
- 原 schema 的歌单创建、重命名、删除、歌曲增删、移动、顺序维护
- 本地文件播放、播放/暂停、音量持久化
- 列表循环、单曲循环、随机播放、上一首/下一首、进度条、系统媒体传输控制
- LRC 歌词解析、当前行同步和原生桌面歌词
- 下载队列读取和 HTTP Range 断点续传
- 桌面歌词原生窗口（置顶、透明、点击穿透）基础实现
- 配置导入、原生 JSON 配置持久化、WinUI MVVM 外壳
- `user_api.json` 脚本导入/删除/选择，以及独立 Node 脚本运行时（保留原压缩格式和请求桥）
- 原生同步服务基础协议（本机 HTTP 快照端点、令牌校验）与 Ctrl+Alt+Space/方向键全局热键
- GitHub Release 版本检查开关
- Windows `AudioGraph` 原生播放链路：十段均衡器、混响、回声和实时 PCM FFT 频谱；不支持 AudioGraph 的格式自动回退 `MediaPlayer`
- 原版简体中文、繁體中文、English 语言资源与设置内切换

仍需继续做的仅是整机环境下的手工体验回归；代码、构建、音频图和发布流程均已具备验收入口。

在线脚本运行时通过独立 `node` 子进程启动；`publish.ps1` 会把当前 Node.js 运行时复制到发布目录，运行时优先使用此内置版本。
