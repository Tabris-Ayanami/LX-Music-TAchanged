# lx-music-desktop 项目架构图

> Electron + Vue 3 音乐播放器桌面应用架构总览。

```mermaid
graph TD
    subgraph EXT["外部服务"]
        SOURCE["音源服务器<br/>(kw/kg/tx/wy/mg/bd/xm/bili + 用户自定义API源)"]
        UPDATE["GitHub 更新服务<br/>(electron-updater)"]
        SYNC_PEER["局域网对端设备<br/>(多端同步)"]
    end

    subgraph MAIN["主进程 (Electron Main) — src/main"]
        ENTRY["index.ts → app.ts<br/>initGlobalData → registerModules()"]
        ENTRY --> APPMOD["模块注册器 modules/index.ts"]
        APPMOD --> WINM["窗口管理 winMain<br/>主窗口/托盘/快捷键/应用菜单/自动更新"]
        APPMOD --> LYRICW["歌词窗口 winLyric"]
        APPMOD --> BILI["B站源 bili / NCM API ncmApi"]
        APPMOD --> USERAPI["用户自定义源 userApi<br/>(第三方音源脚本沙箱)"]
        APPMOD --> SYNC["局域网同步 sync<br/>(server/client + 设备认证)"]
        APPMOD --> DBW["DB Worker<br/>better-sqlite3 + Comlink (list/lyric/music_url/download)"]
        APPMOD --> NCSUP["native-core 调度 supervisor<br/>spawn Rust 侧车 + 命名管道帧协议"]
        MAIN --> EVT["事件总线 AppEvent/ListEvent<br/>(Node EventEmitter)"]
    end

    subgraph RUST["Rust 侧车进程 — native-core"]
        NC["lx-native-core.exe<br/>download / media / metadata<br/>library / artwork / player 服务"]
    end

    subgraph RENDER["渲染进程·主窗口 (Vue 3 SPA) — src/renderer"]
        ROUTER["router (hash 懒加载)"]
        VIEWS["views<br/>发现/搜索/歌单/榜单/列表/本地音乐/下载/设置"]
        STORE["自定义响应式 store<br/>store/index + player/ + list/ + download/"]
        BRIDGE["backend 统一后端适配层<br/>contracts + ElectronBackendAdapter"]
        SDK["musicSdk 八音源 SDK<br/>搜索/URL/歌词/封面/歌单/榜单"]
        CORE["core<br/>player/action, music/online<br/>(取URL/歌词+跨源备用切换+缓存)"]
        PLYR["播放器插件 plugins/player<br/>双Audio Deck crossfade + Web Audio<br/>(EQ/混响/变调/声像)"]
        LYRIC2["歌词渲染 core/lyric (lrc/trc/逐行)"]
        WORKERS["Web Worker<br/>list 逻辑 / 下载任务 (Comlink)"]
        STORE --> BRIDGE
        CORE --> SDK
        CORE --> PLYR
        CORE --> LYRIC2
        VIEWS --> STORE
        VIEWS --> CORE
        BRIDGE --> WORKERS
    end

    subgraph LYRIC_WIN["渲染进程·桌面歌词 — src/renderer-lyric"]
        LYRICAPP["独立 Vue 应用<br/>逐行歌词/滚动/染色"]
    end

    RENDER --- IPC["IPC (channel 白名单 + contextBridge: window.lxHost)<br/>src/common/ipcNames + renderIpc/mainIpc"]
    IPC --- MAIN
    MAIN --- DBW
    MAIN -->|"Windows 命名管道<br/>长度前缀JSON帧"| NCSUP
    NCSUP --> RUST
    MAIN -->|"加载 winLyric"| LYRIC_WIN
    LYRIC_WIN --- IPA2["WIN_LYRIC_RENDERER_EVENT_NAME channel"]
    IPA2 --- MAIN
    RENDER -->|"needle + tunnel 代理"| SOURCE
    MAIN -->|"http"| UPDATE
    MAIN -->|"局域网 TCP"| SYNC_PEER
```

## 架构要点

1. **分层**：
   - 主进程 `src/main/`：窗口管理、IPC 监听、DB（better-sqlite3 on worker_threads）、Rust 侧车调度、同步、B站/网易云/用户自定义源。
   - 渲染进程 `src/renderer/`：Vue 3 SPA，音源 SDK、播放核心、双 Deck 播放器、Web Worker。
   - 歌词窗口 `src/renderer-lyric/`：独立 Vue 应用。
   - `native-core/`：Rust 侧车（下载/媒体/元数据/library/artwork/player 服务）。

2. **通信三层**：
   - Electron IPC：channel 白名单 + contextBridge（`window.lxHost`），双端封装 `renderIpc`/`mainIpc`。
   - Comlink：主进程 DB worker 与渲染 Web Worker。
   - Windows 命名管道：主进程 ↔ Rust 侧车（长度前缀 JSON 帧协议）。

3. **播放数据流**：搜索/歌单 → store → `musicSdk` 获取歌曲/URL/歌词 → DB 缓存 → 双 Audio Deck + Web Audio（EQ/混响/变调）播放 → IPC 推送主进程更新托盘/任务栏。

4. **构建打包**：webpack 5 四套配置（main/renderer/renderer-lyric/renderer-scripts）+ electron-builder（Win/Linux/mac 多平台）。

## 关键文件索引

| 模块 | 路径 |
|---|---|
| 主进程入口 | `src/main/index.ts`、`src/main/app.ts` |
| IPC channel 定义 | `src/common/ipcNames.ts` |
| IPC 封装 | `src/common/mainIpc.ts`、`src/common/renderIpc.ts` |
| Preload 桥 | `src/main/modules/winMain/preload.ts` |
| 播放器实现 | `src/renderer/plugins/player/index.ts` |
| 播放核心 | `src/renderer/core/player/action.ts`、`src/renderer/core/music/` |
| 音源 SDK | `src/renderer/utils/musicSdk/` |
| DB Worker | `src/main/worker/dbService/index.ts` |
| 后端适配 | `src/renderer/backend/contracts.ts`、`src/renderer/backend/electron.ts` |
| Rust 侧车 | `native-core/src/` |
| 打包配置 | `build-config/build-pack.js`、`build-config/pack.js` |