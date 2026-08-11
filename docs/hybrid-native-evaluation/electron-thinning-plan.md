# Electron Main 瘦身与后期换壳

## 结论

Electron 暂时保留。先把 Main 从业务执行器缩成 host 与 Native Core supervisor，同时把 Renderer 的 Node 能力关进 Backend adapter。即使暂不换壳，这条路线也能获得更低的 JS 数据复制、更好的故障隔离和显著的安全/可维护性收益。

最终 Main 可以只负责：

- App/BrowserWindow 生命周期；
- Tray、Menu、Global Shortcut；
- single instance、protocol/deep link；
- updater、安装/重启；
- dialog、shell、clipboard 等少量 host 能力；
- Native Core 启动、握手、健康检查、Job Object 和 bridge；
- 必要的安全存储与权限确认。

它不再拥有媒体库、SQL、metadata、artwork、扫描、下载/转码或播放器业务状态。

## 1. 当前 Electron Main/Renderer 的问题

当前 `src/main/modules/winMain/main.ts` 的 BrowserWindow 配置包含：

- `nodeIntegration: true`；
- `nodeIntegrationInWorker: true`；
- `contextIsolation: false`；
- `sandbox: false`；
- `webSecurity: false`。

这使 UI、Node、Electron IPC 和业务实现处于同一信任/依赖域。与此同时，Renderer 的本地扫描、在线源、下载 worker 和播放逻辑又绕开 Main。问题不是简单地“Main 太大”，而是边界不稳定。

`src/renderer/utils/ipc.ts` 集中包装了调用，是可利用的迁移入口，但其 800+ 行 API 仍按 IPC channel 与历史模块组织。它应被业务 service adapter 包裹，而不是继续扩展成新的 Native RPC 镜像。

## 2. 目标 Main 边界

| 保留在 Electron Main | 移出 Main | 保持在 JS 但隔离 |
|---|---|---|
| Window/Tray/Menu | SQLite/media library | 自定义源 runtime |
| globalShortcut | metadata/artwork | 在线源协议 |
| protocol/single instance | scan/watch | 更新业务策略（可由 UI） |
| updater/relaunch | download byte engine | 少量兼容 adapter |
| dialog/shell/safeStorage | FFmpeg job orchestration | |
| core supervisor/bridge | audio backend（若迁移） | |

`PlatformService` 不能变成“所有 Electron API 的转发器”。每个方法必须是 UI 需要的窄能力，例如 `pickMusicFolders()`、`showItemInFolder()`、`setAutostart()`，并在 preload 校验参数。

## 3. Renderer 去 Node 化

在业务 service 全部有 adapter 之后，按导入图逐步移除 Renderer 中：

- `node:fs`, `node:path`, `child_process`, `worker_threads`；
- 直接 `electron`/`ipcRenderer` import；
- 对数据库文件、appData/temp 路径的认识；
- 下载和 FFmpeg 进程控制；
- 自定义源以外的 Node 网络 client。

最终启用：

```text
nodeIntegration: false
nodeIntegrationInWorker: false
contextIsolation: true
sandbox: true（兼容性测试通过后）
webSecurity: true
```

preload 只暴露一个冻结的、最小 `window.lxtaBackend` 对象或创建 transport 所需的端口。Electron `contextBridge` 只适合显式、安全的值和函数边界，不能把 `ipcRenderer` 整体暴露给页面，参考 [Electron contextBridge](https://www.electronjs.org/docs/latest/api/context-bridge)。

关闭这些选项的主要收益是安全和架构，不应承诺它本身大幅降低内存。

## 4. 渐进瘦身步骤

### E0：建立清单与门禁

- 用静态检查禁止新 UI 文件导入 `electron`、`node:*`、DB 和 FFmpeg。
- 所有新功能必须经 Backend API。
- 记录每个现有 IPC channel 的调用方、数据规模和目标 service。

### E1：包裹现有实现

- `ElectronBackendAdapter` 内部继续调用现有 `ipc.ts` 和 JS 模块。
- 页面改依赖 service，但行为不变。
- 建立 fake backend 以做 UI contract tests。

### E2：逐个切 Native Service

- metadata/artwork、library、download 分别 feature flag 切换。
- Electron Main 只做 RPC relay/supervision；若安全可行，数据面可由 Renderer 直连只读 telemetry endpoint。
- 每个 native 模块稳定后删除对应旧 Main handler/Renderer worker，而不是长期双维护。

### E3：自定义源隔离

自定义源必须保持 JS，但不必保持 hidden BrowserWindow。独立项目评估 Electron `utilityProcess` 或专用 Node child process：

- 限定 `globalThis.lx` capability；
- 网络、文件、cookie 和超时受宿主管理；
- 无 DOM 依赖的源不再消耗完整 Chromium renderer；
- 有兼容性问题时保留现有 hidden window fallback。

这一步不是第一批 Native 化的一部分。

### E4：关闭 Renderer Node

- 完成所有直接 Node import 清零和 CSP/资源协议整改。
- 先在测试通道启用 context isolation/webSecurity，再逐项处理兼容问题。
- 验证 Folia/Aura/Diorama、worker、音频设备、拖放、本地资源 URL 和自定义主题。

### E5：Main 最小化

- 删除业务 DB worker、metadata、download/FFmpeg 等 handler。
- Main 启动 core、提供 HostService 并管理窗口。
- UI 与 core 的业务协议不再使用 Electron channel 名。

## 5. 这一步能减少哪些内存

可能减少：

- DB worker 的 JS runtime、整表 cache 与 IPC clone；
- Renderer/download worker 的 Node 模块和常驻对象；
- taglib-wasm heap；
- base64 artwork 与原图浏览器解码；
- hidden custom-source BrowserWindow（仅隔离改造成功后）；
- FFmpeg 仅在 job 期间存在，退出后释放。

不会减少：

- Electron/Chromium renderer、GPU、network 等基础进程；
- Vue/React 状态、DOM/CSS/layout；
- Folia、Aura、Diorama、Three.js/WebGL 代码和纹理；
- 隐藏但仍 mounted 的页面/组件；
- 浏览器图片和字体 cache；
- Web Audio graph（在 Native Player 前）；
- Electron Main 自身的 Node runtime。

因此“Main 只剩几百行”不等于“应用接近纯 native 播放器内存”。真正的 UI/GPU 内存必须在 Web 前端内部单独治理。

## 6. 后期 Tauri/Wails/WebView2 可行性

### Tauri

Windows 上使用 WebView2，系统 WebView 仍基于 Chromium；Tauri 官方支持打包外部 sidecar，见 [WebView 版本说明](https://v2.tauri.app/reference/webview-versions/) 和 [sidecar 文档](https://v2.tauri.app/develop/sidecar/)。若 core 使用 Rust，Tauri host 技术栈自然，但仍建议先保持 sidecar 进程隔离，不急于嵌入同进程。

预期优势：安装包不再自带整套 Chromium、无 Electron Node Main、host 常驻更小。不能保证：WebView2 renderer/GPU、WebGL 纹理、React/Vue 和图片内存会消失。

### Wails

Wails Windows 也依赖 WebView2，Go runtime 提供 window/menu/dialog/event 等 host API，见 [Wails Windows](https://wails.io/docs/next/guides/windows/) 和 [runtime](https://wails.io/docs/reference/runtime/intro/)。它能承载同一 Web UI，但若 core 已是 Rust sidecar，会形成 Go host + Rust core；技术上可行，维护面多于 Tauri。

### 其他轻量 host

可直接用 WebView2 SDK + C++/C#/Rust wrapper 构建极薄 host，但窗口生命周期、输入法、透明/无边框、拖放、DevTools、更新、协议和安装都要自行维护。除非 Tauri/Wails 不能满足关键行为，不建议优先自建。

### 迁移前提

换壳成本较低只有在以下条件同时成立时：

1. UI 构建产物不依赖 Electron/Node globals。
2. 所有业务经 service interface；host 能力经 PlatformService。
3. 本地资源由标准 URL/stream provider 提供，不依赖任意 `file://`。
4. 高频数据通路有 WebSocket/标准 Web adapter，不硬编码 MessagePortMain。
5. 自动更新、协议、托盘、快捷键、窗口透明/阴影和多显示器行为有 host contract test。

## 7. 换壳决策门槛

Native Core 完成后，至少测量并比较：

- 冷/热启动时间；
- idle、播放、Folia、Diorama、扫描、下载六种场景的总 private working set/commit/GPU；
- 包体和更新增量；
- WebGL、音频设备、托盘、快捷键、透明窗口和多屏行为；
- 崩溃率与符号化；
- host adapter 的实现/维护成本。

只有 WebView2 host 的实际收益超过兼容风险，才替换 Electron。这个决定与 Native Core 是否成功解耦，不应提前绑定。
