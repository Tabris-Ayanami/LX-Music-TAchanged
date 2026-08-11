# Stage 0 未迁移直接依赖清单

> 生成命令：`npm run check:backend-boundaries -- --list`  
> 日期：2026-08-11

## 统计口径

- legacy transport：直接导入 `@renderer/utils/ipc`、`@common/rendererIpc` 或 `@common/ipcNames` 的 Renderer 文件。
- direct runtime：直接导入 Electron、`node:*`、`@common/utils/electron`、SQLite 或 FFmpeg runtime 的 Renderer 文件。
- vendored Folia 排除。
- `backend/electron.ts` 是当前唯一允许从 Backend API 进入旧 transport 的 adapter。

当前结果：legacy transport 57/57，direct runtime 33/33，未出现新增或 backend 逆向依赖。

## Legacy transport（57）

```text
src/renderer/backend/electron.ts
src/renderer/components/common/DownloadModal.vue
src/renderer/components/layout/ChangeLogModal.vue
src/renderer/components/layout/PactModal.vue
src/renderer/components/layout/PlayDetail/ImmersiveLyrics.vue
src/renderer/components/layout/PlayDetail/ImmersiveSourcePanel.vue
src/renderer/components/layout/PlayDetail/components/LyricMenu.vue
src/renderer/components/layout/SyncAuthCodeModal.vue
src/renderer/components/layout/SyncModeModal.vue
src/renderer/components/layout/UpdateModal.vue
src/renderer/components/localMusic/LocalTrackActions.vue
src/renderer/components/localMusic/LyricsMatchPanel.vue
src/renderer/core/apiSource.ts
src/renderer/core/dislikeList.ts
src/renderer/core/lyric.ts
src/renderer/core/music/local.ts
src/renderer/core/music/online.ts
src/renderer/core/music/utils.ts
src/renderer/core/player/timeoutStop.ts
src/renderer/core/useApp/index.ts
src/renderer/core/useApp/useDataInit.ts
src/renderer/core/useApp/useDeeplink/index.ts
src/renderer/core/useApp/useDeeplink/useMusicAction.js
src/renderer/core/useApp/useDeeplink/useSonglistAction.js
src/renderer/core/useApp/useEventListener.ts
src/renderer/core/useApp/useInitUserApi.ts
src/renderer/core/useApp/useOpenAPI.ts
src/renderer/core/useApp/usePlayer/useLyric.ts
src/renderer/core/useApp/useSettingSync.ts
src/renderer/core/useApp/useSync.ts
src/renderer/core/useApp/useUpdate.ts
src/renderer/event/index.ts
src/renderer/services/localLyrics/index.ts
src/renderer/store/list/action.ts
src/renderer/store/list/listManage/rendererListManage.ts
src/renderer/store/search/action.ts
src/renderer/store/soundEffect.ts
src/renderer/store/utils.ts
src/renderer/utils/data.ts
src/renderer/utils/ipc.ts
src/renderer/utils/musicSdk/kw/util.js
src/renderer/utils/musicSdk/tx/lyric.js
src/renderer/views/Download/useTaskActions.js
src/renderer/views/List/MyList/actions.ts
src/renderer/views/List/MyList/useShare.ts
src/renderer/views/Setting/components/SettingAccount.vue
src/renderer/views/Setting/components/SettingBackup.vue
src/renderer/views/Setting/components/SettingBasic.vue
src/renderer/views/Setting/components/SettingDesktopLyric.vue
src/renderer/views/Setting/components/SettingDownload.vue
src/renderer/views/Setting/components/SettingHotKey.vue
src/renderer/views/Setting/components/SettingOther.vue
src/renderer/views/Setting/components/SettingSync/ServerDeviceListModal.vue
src/renderer/views/Setting/components/SettingSync/SyncServer.vue
src/renderer/views/Setting/components/SettingUpdate.vue
src/renderer/views/Setting/components/ThemeEditModal/index.vue
src/renderer/views/Setting/components/UserApiModal.vue
```

## Direct runtime（33）

```text
src/renderer/components/base/Input.vue
src/renderer/components/layout/ChangeLogModal.vue
src/renderer/components/layout/PactModal.vue
src/renderer/components/layout/PlayBar/FullWidthProgress.vue
src/renderer/components/layout/PlayBar/MiddleWidthProgress.vue
src/renderer/components/layout/PlayBar/MiniWidthProgress.vue
src/renderer/components/layout/PlayDetail/LyricPlayer.vue
src/renderer/components/layout/UpdateModal.vue
src/renderer/components/material/OnlineList/index.vue
src/renderer/components/material/OnlineList/useMusicActions.js
src/renderer/components/material/SearchInput.vue
src/renderer/core/music/download.ts
src/renderer/core/music/local.ts
src/renderer/core/useApp/useEventListener.ts
src/renderer/core/useApp/useInitUserApi.ts
src/renderer/store/index.ts
src/renderer/utils/ipc.ts
src/renderer/utils/localMusic.ts
src/renderer/views/Download/index.vue
src/renderer/views/Download/useTaskActions.js
src/renderer/views/List/MusicList/components/MusicToggleModal.vue
src/renderer/views/List/MusicList/components/SearchList.vue
src/renderer/views/List/MusicList/index.vue
src/renderer/views/List/MusicList/useMusicActions.js
src/renderer/views/List/MyList/index.vue
src/renderer/views/Setting/components/SettingAbout.vue
src/renderer/views/Setting/components/SettingOpenAPI.vue
src/renderer/views/Setting/components/SettingSync/index.vue
src/renderer/views/Setting/components/UserApiModal.vue
src/renderer/views/songList/List/components/OpenListModal.vue
src/renderer/worker/download/download.ts
src/renderer/worker/download/utils.ts
src/renderer/worker/main/music.ts
```

## 为什么暂未迁移

| 类别 | 典型位置 | 暂缓原因 |
|---|---|---|
| 数据/列表核心 | `store/list/*`, `utils/data.ts`, `useDataInit.ts` | 涉及启动数据所有权和整库状态；应在分页/change feed 方案落地后迁移，Stage 0 不做高风险重写 |
| 下载执行 | `worker/download/*`, `core/music/download.ts`, Download view | 任务状态机、网络与 FFmpeg 强耦合；本轮只迁持久化入口，正式执行属于后续 Stage |
| 在线/自定义源 | `apiSource.ts`, `useInitUserApi.ts`, UserApi/immersive source | JS source runtime 和 hidden renderer 仍是现有能力；需要独立隔离设计，不能机械转 RPC |
| 同步/OpenAPI/更新 | `useSync`, `useOpenAPI`, `useUpdate`, SettingSync/Update | 跨窗口、网络、主进程生命周期耦合，非首批 Native 重任务 |
| 历史设置页面 | SettingBasic/Download/HotKey/Other 等 | 调用面广且低频，收益有限；由 Platform/Settings service 后续逐页收敛 |
| 本地歌词/动作 | `LyricsMatchPanel`, `LocalTrackActions`, `localLyrics` | 部分能力已迁 MetadataService，缓存歌词、候选源和文件操作仍需拆分业务语义 |
| Electron clipboard/输入 | List/Search/Input 等 | 多为低频 host 能力；需扩充窄 PlatformService，而不是加入通用 invoke |

## 使用规则

1. 新 UI/业务代码不得增加上述计数。
2. 迁移时应减少调用文件，并为新增 Service 方法写业务 contract；不得把 channel 名搬进 Service。
3. 计数下降后同步降低 `check-backend-boundaries.cjs` 的上限，不能长期保留 57/33。
4. `src/renderer/utils/ipc.ts` 在 Electron adapter 完全承接前仍是旧 transport 实现，不直接删除。
