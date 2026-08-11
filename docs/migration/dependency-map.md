# Dependency Map

## 1. Runtime dependency graph

```text
Electron app
├─ MainWindow ─ IPC ─ Main Renderer
│                    ├─ Vue views/components
│                    ├─ module-level stores + app_event
│                    ├─ player core ─ HTMLAudio/WebAudio
│                    ├─ music core ─ musicSdk/userApi/Bili IPC
│                    ├─ React bridge ─ Folia ─ Framer Motion
│                    │                         └─ Diorama ─ R3F/Three/GLSL
│                    └─ Node Web Workers ─ fs/download/FFmpeg/metadata
├─ LyricWindow ─ IPC/MessagePort ─ Main Renderer
├─ DB worker ─ better-sqlite3 ─ lx.data.db
├─ Tray/HotKey/Update/Protocol/Dialogs
├─ Bilibili API/cookie/local proxy
├─ OpenAPI HTTP/SSE (optional last; may be omitted)
├─ Sync HTTP/WebSocket/crypto/snapshots
└─ User API hidden BrowserWindow/preload/needle
```

## 2. Major module dependencies

| From | Depends on | Why | Native treatment |
|---|---|---|---|
| Vue views | stores, app_event, IPC wrappers, musicSdk, Node globals | 页面同时做展示、业务、平台调用 | View -> VM only; platform/network behind application interfaces |
| Player core | list store, player store, settings, music resolver, audio plugin, app_event, IPC | 选曲、播放、恢复和平台状态交织 | explicit playback state machine + engine port + queue policy |
| Music resolver | player/list state, DB caches, all online adapters, user API, local fs | 同一函数处理三类 Track 和备用源 | strategy per track kind; shared cache/retry policy |
| Local music UI | direct Node fs, list DB, worker metadata, DOM/rAF | 扫描与画布交互都在 Renderer | scanner/indexer service; UI only queries view models |
| Download store | music resolver, worker downloader, DB IPC, settings, metadata | coordinator 同时管理队列/URL/文件/标签 | persisted task aggregate + worker engine + postprocessor |
| Main list/dislike | global EventEmitter, DB worker, all Renderer broadcasts, Sync | 同一变更有本地与远程来源 | repository transaction emits typed domain event with origin |
| Sync | DB/list events, filesystem snapshots, network, crypto | 协议和业务数据直接耦合 | sync core consumes list/dislike ports; storage/network adapters isolated |
| User API | settings, hidden BrowserWindow, preload, network, proxy | JS runtime、网络权限、UI 状态耦合 | core compatibility boundary with managed JS host and capability policy; no Node/WebView |
| Immersive UI | player analyser/time, lyrics, settings, Bili, React/Folia/WebGL | 多技术栈、每帧状态和网络混合 | stable `IImmersiveEffect` inputs; effects cannot call network/player directly |
| Desktop lyric | Main BrowserWindow, setting, Main Renderer port, lyric parser | 窗口层与播放 UI 互相握手 | no Native target; retain only import cleanup and legacy analysis |

## 3. Strong coupling hotspots

1. **Renderer/Main coupling**：`src/renderer/utils/ipc.ts` 暴露约百个功能函数；IPC payload 同时承担远程 API、repository、platform command 和 event bus。Native 不保留“Main service”概念。
2. **UI/business coupling**：`ImmersiveLyrics.vue` 同时搜索 Bili、匹配 MV、切歌词源、同步视频、seek、控制自动隐藏并拼 Folia 输入；`LocalMusic/index.vue` 同时维护数据、封面、三种布局和二维索引。
3. **Player/global state coupling**：播放器通过 `window.app_event` 与 UI、OpenAPI、tray、hotkey、MediaSession、power blocker互通；许多计时器不在统一生命周期对象中。
4. **Persistence coupling**：列表 EventEmitter 的执行结果写 SQLite 后再广播，Sync 也订阅相同总线；事件缺少明确 transaction id/origin/idempotency contract。
5. **Platform coupling**：Renderer 直接使用 Node fs/path/url/Buffer/process、Electron clipboard/shell，worker 依赖 Node integration；无法仅替换 Main process 完成迁移。

## 4. Circular and bidirectional flows

静态 import 未见一个简单、单一的致命循环；更重要的是运行时逻辑环：

- `list action -> IPC -> Main ListEvent -> DB -> Main broadcast -> rendererListManage -> onListChanged`。发起者也收到回放，靠具体实现避免重复更新。
- `setting update -> IPC -> Main merge/save -> config change broadcast -> Renderer merge`。Renderer 先本地 merge，后收到 Main 权威回声。
- `player status -> Main global/tray/OpenAPI -> action -> Renderer player`，平台动作和播放状态形成双向环。
- `sync remote update -> Main list/dislike event -> DB/broadcast -> sync local event listener`，靠 sync 模块内的 source/skip 控制避免回送。
- `desktop lyric request -> Main MessageChannel -> Renderer provide -> lyric renderer request status/analyser`，窗口创建顺序需要多次握手。

Native 应以单一状态所有者和带 origin/correlation id 的事件消除这些隐式环。

## 5. External dependencies by concern

| Concern | Legacy dependency | Risk |
|---|---|---|
| Shell | Electron 37, Chromium, Node | Native 全量替换，不可带入 |
| UI | Vue 3, Less, animate.css | 需行为/视觉规格化，不做逐组件翻译 |
| Immersive / motion | React 19, Framer Motion 12, Three 0.185, R3F 9.6 | 提前迁移；10 个效果逐个分类，所有 UI slice 使用 120 Hz/8.33 ms gate；仅少数需要 GPU 自定义管线 |
| DB | better-sqlite3 | schema compatibility and concurrent access |
| Metadata | taglib-wasm, music-metadata, node-id3, custom FLAC metadata | 格式/标签保真与原子替换风险 |
| Audio | HTMLAudio, WebAudio, AudioWorklet | codec、seek、device、DSP parity |
| Network | needle, undici, ws, proxy-agent | 非公开 API、代理、cookie、range |
| Download | custom downloader, FFmpeg installer | resume、conversion、packaging/license |
| Native addon | qrc_decode | 腾讯歌词解码需 C# 或受控 native bridge |
| Update/public distribution | electron-updater | deferred entirely during personal x64 unpackaged development; no early dependency or blocker |

## 6. Target dependency direction

```text
LXTA.App / Graphics
        -> LXTA.Application
        -> LXTA.Domain

Storage -------^
Network -------^   (implement Application ports; depend on Domain)
Media ---------^
Platform.Windows^

No infrastructure project may reference App.
Domain references no WinUI, Windows SDK, SQLite, HTTP or JSON implementation.
Application exposes commands, queries and observable immutable state; it does not expose DB rows or Win32 handles.
```

Dependency rules are enforced with project references and architecture tests. Cross-feature communication uses typed application events, not service locator, static globals or an IPC-name surrogate.
