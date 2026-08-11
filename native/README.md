# LX-TA Native

当前 Native 工程实现最小 Phase 0 基础与 Slice 1：WinUI 3 原生外壳和只读本地曲库浏览器。

## 当前构建约束

- C# / WinUI 3 / Windows App SDK
- unpackaged
- framework-dependent
- x64 only
- 普通本地 Debug / Release 构建

当前不包含 MSIX、安装器、签名、自动更新、自包含发布、ARM64/x86 或干净机器部署工作。

## 构建与测试

在仓库根目录运行：

```powershell
dotnet build native/LXTA.Native.slnx -c Debug -p:Platform=x64
dotnet test native/tests/LXTA.Application.Tests/LXTA.Application.Tests.csproj -c Debug -p:Platform=x64
dotnet test native/tests/LXTA.Storage.Tests/LXTA.Storage.Tests.csproj -c Debug -p:Platform=x64
dotnet build native/LXTA.Native.slnx -c Release -p:Platform=x64
```

运行：

```powershell
native/src/LXTA.App/bin/Debug/net10.0-windows10.0.26100.0/win-x64/LXTA.App.exe
```

默认只读打开：

```text
%APPDATA%\LX-TA\LxDatas\lx.data.db
```

可通过环境变量 `LXTA_LEGACY_DB_PATH` 或参数 `--legacy-db <path>` 指向复制的测试库。Native 自己的封面缓存和日志位于 `%LOCALAPPDATA%\LX-TA\NativeDev`；不会写 Electron 数据库。

## 当前能力

- 原生启动、主窗口、自定义标题栏拖动区域与 Windows 原生最小化/最大化/关闭按钮
- 本地歌曲、专辑和歌手导航
- SQLite schema-v2 `userlist_local_music` 只读加载
- 歌曲/艺术家/专辑/文件名搜索
- 文件可用性筛选、五种排序
- 专辑/歌手分组与只读详情
- 虚拟化歌曲列表和分组网格
- 同名 JPG/PNG 与 Windows 音乐缩略图封面加载，使用隔离的 Native 缓存
- Light/Dark 主题基础和 Composition 视图切换动画

播放和所有在线功能不属于本切片。底部播放区只显示明确的禁用状态，不包含媒体后端。

## 旧 Demo

旧实验项目仍保存在 `native/LXTA.Native/` 以便审计，但不在 `LXTA.Native.slnx` 中，不参与构建，也不是当前架构的一部分。新应用只链接复用了它的 `AppIcon.ico`；旧服务、状态模型、Node 用户音源宿主、播放、桌面歌词、同步、更新和发布代码均未保留到新解决方案。
