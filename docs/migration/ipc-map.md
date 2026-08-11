# Complete IPC Map

## Reading rules

- 实际 channel 由 `src/common/ipcNames.ts` 在运行时统一加模块前缀，例如 key `get_app_setting` 变为 `common_get_app_setting`。
- `invoke` 表示 Renderer 请求/Main `handle` 返回；`send` 表示单向消息；`push` 表示 Main 主动发 Renderer；部分 list/dislike channel 同时存在 invoke 与 push。
- “定义未接线”是经过全仓调用/handler 搜索后只在 name 表中存在或处理器被注释，并非应迁功能。
- Caller 通常先经过 `src/renderer/utils/ipc.ts` 或 `src/renderer-lyric/utils/ipc.ts`；表中写实际功能调用者。

## common

| Channel | Direction / caller | Main handler / actual logic | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `common_get_env_params` | invoke; `useApp` startup | common renderer handler -> global env | none -> `EnvParams` | none | `IActivationContext` query |
| `common_deeplink` | push; deeplink listener | protocol/second-instance -> all renderers | URL -> void | navigates/imports | activation event |
| `common_clear_env_params_deeplink` | send; startup | clears one-shot global deeplink | none | mutates env params | activation context consume |
| `common_system_theme_change` | defined, not wired | none | n/a | none | do not migrate channel |
| `common_theme_change` | push; theme store/lyric | nativeTheme/theme module broadcast | `ThemeSetting` | UI repaint | theme observable |
| `common_get_system_fonts` | invoke; appearance settings | `fontManage.getFonts()` | none -> names | enumerates system fonts | `IFontCatalog` |
| `common_get_app_setting` | invoke; both renderers startup | returns global setting | none -> setting snapshot | none | `ISettingsStore.Current` |
| `common_set_app_setting` | invoke; setting actions | merge/save/app setting event | partial setting -> void | atomic JSON write, service reconfigure, broadcast | typed setting commands |

## player/list

| Channel | Direction / caller | Handler / logic | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `player_play_music` | defined, not wired | none | n/a | none | direct playback command if needed |
| `player_play_next` | defined, not wired | none | n/a | none | playback command |
| `player_play_prev` | defined, not wired | none | n/a | none | playback command |
| `player_toggle_play` | defined, not wired | none | n/a | none | playback command |
| `player_player_play` | defined, not wired | none | n/a | none | playback state event |
| `player_player_pause` | defined, not wired | none | n/a | none | playback state event |
| `player_player_stop` | defined, not wired | none | n/a | none | playback state event |
| `player_player_error` | defined, not wired | none | n/a | none | playback fault event |
| `player_list_data_overwire` | invoke + push; backup/sync/list store | ListEvent -> DB overwrite -> broadcast | `ListDataFull` -> void | replaces all lists/music/order | `ILibraryImportService` transaction/event |
| `player_list_get` | invoke; list init | DB list get | none -> `UserListInfo[]` | none | library query |
| `player_list_add` | invoke + push; list UI/sync | ListEvent add -> DB -> broadcast | position/listInfos -> void | inserts lists | create-list command |
| `player_list_remove` | invoke + push; list UI/sync | ListEvent remove -> DB -> broadcast | ids -> void | deletes list rows/music/order | delete-list command |
| `player_list_update` | invoke + push; edit/update-source | ListEvent update -> DB -> broadcast | listInfos -> void | updates metadata | update-list command |
| `player_list_update_position` | invoke + push; drag/sort | ListEvent -> DB -> broadcast | position/ids -> void | reorders lists | reorder-lists command |
| `player_list_music_get` | invoke; player/views | DB music get | listId -> `MusicInfo[]` | none | library query |
| `player_list_music_add` | invoke + push; add/scan/download/sync | DB insert + order + broadcast | id/musicInfos/location -> void | adds/dedupes tracks | add-tracks command |
| `player_list_music_move` | invoke + push; menu/drag/sync | DB remove+insert/order | fromId/toId/musicInfos/location -> void | moves tracks | move-tracks transaction |
| `player_list_music_remove` | invoke + push; list/local/sync | DB delete + order normalize | listId/ids -> void | removes tracks | remove-tracks command |
| `player_list_music_update` | invoke + push; metadata/source | DB update occurrences | musicInfos -> void | changes track metadata in lists | update-track command |
| `player_list_music_update_position` | invoke + push; drag/sort | DB order update | listId/position/ids -> void | reorders songs | reorder-tracks command |
| `player_list_music_overwrite` | invoke + push; scan/import/sync | DB replace list content/order | listId/musicInfos -> void | replaces list | replace-list transaction |
| `player_list_music_clear` | invoke + push; list UI/sync | DB clear list(s) | listId(s) -> void | deletes content | clear-list command |
| `player_list_music_check_exist` | invoke; add menu | DB existence query | listId/musicInfoId -> bool | none | library query |
| `player_list_music_get_list_ids` | invoke; actions | DB reverse lookup | musicInfoId -> ids | none | library query |

## dislike

| Channel | Direction / caller | Handler | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `dislike_get_dislike_music_infos` | invoke; startup/settings | DislikeEvent/DB | none -> parsed info | none | `IDislikeRepository.Get` |
| `dislike_add_dislike_music_infos` | invoke + push; player/list/sync | DB add -> broadcast | music infos -> void | inserts rules/items | add-dislike command/event |
| `dislike_overwrite_dislike_music_infos` | invoke + push; settings/sync | DB overwrite -> broadcast | rules -> void | replaces rule set | replace-rules command |
| `dislike_clear_dislike_music_infos` | invoke + push; settings/sync | DB clear -> broadcast | none -> void | clears table | clear command |

## winMain: window, lifecycle, update and platform

| Channel | Direction / caller | Handler / actual logic | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `winMain_focus` | send/push; toolbar/focus listener | show/focus window; Main emits on focus | none | window activation | `IWindowManager.Activate`; focus event |
| `winMain_close` | send; window controls | close(force) / hide-to-tray path | force? | hides or destroys | window close command |
| `winMain_min` | send; controls | BrowserWindow.minimize | none | window state | AppWindow minimize |
| `winMain_max` | send; controls | maximize/unmaximize | none | window state | AppWindow presenter |
| `winMain_fullscreen` | invoke; detail/keys | setFullScreen | bool -> actual bool | window state | AppWindow fullscreen service |
| `winMain_set_app_name` | defined; handler commented | none | n/a | none | do not migrate |
| `winMain_clear_cache` | invoke; settings | session.clearCache | none -> void | deletes Chromium cache | `ICacheService.Clear` |
| `winMain_get_cache_size` | invoke; settings | session.getCacheSize | none -> bytes | none | cache query |
| `winMain_inited` | send; app bootstrap | marks renderer ready, starts dependent flows | none | emits main-window-inited | application readiness signal |
| `winMain_show_save_dialog` | invoke; backup/download | dialog.showSaveDialog | options -> result | user file choice | `IFileSavePicker` |
| `winMain_show_select_dialog` | invoke; import/local/cover | dialog.showOpenDialog | options -> result | user file/folder choice | `IFileOpenPicker/IFolderPicker` |
| `winMain_show_dialog` | send; alerts | dialog.showMessageBoxSync | options | modal UI | app dialog service |
| `winMain_open_dir_in_explorer` | send; download | shell.showItemInFolder/openPath | path | launches Explorer | `Launcher/SHOpenFolderAndSelectItems` |
| `winMain_open_dev_tools` | send; debug/settings | webContents.openDevTools | none | debug window | debug-only diagnostics |
| `winMain_set_power_save_blocker` | send; player | powerSaveBlocker start/stop | enabled | OS sleep inhibition | `PowerSetRequest` wrapper |
| `winMain_player_status` | send; player | updates global/tray/OpenAPI/lyric status | partial status | broadcasts/platform UI | playback state observer |
| `winMain_change_tray` | defined, no active caller/handler | none | n/a | none | settings drive tray service directly |
| `winMain_quit_update` | send; update modal | autoUpdater.quitAndInstall | none | quits/installs | deferred; no Native updater in current scope |
| `winMain_update_check` | send; update | autoUpdater.checkForUpdates | none | network/update events | deferred until public distribution |
| `winMain_update_download_update` | send; update | autoUpdater.downloadUpdate | none | downloads package | deferred until public distribution |
| `winMain_update_available` | push; update UI | electron-updater event | UpdateInfo | state/UI | deferred legacy event |
| `winMain_update_error` | push | updater event | error text | state/UI | deferred legacy event |
| `winMain_update_progress` | push | updater event | ProgressInfo | state/UI | deferred legacy event |
| `winMain_update_downloaded` | push | updater event | downloaded event | enables install | deferred legacy event |
| `winMain_update_not_available` | push | updater event | UpdateInfo | state/UI | deferred legacy event |
| `winMain_set_ignore_mouse_events` | send; UI/lyric-related behavior | BrowserWindow.setIgnoreMouseEvents | bool | click-through | Win32 extended style/window service |
| `winMain_set_window_size` | send; startup/settings | setContentBounds | rectangle/width-height | resizes/moves | AppWindow resize |
| `winMain_handle_request` | defined, not wired | none | n/a | none | no migration |
| `winMain_cancel_request` | defined, not wired | none | n/a | none | cancellation token directly |
| `winMain_restart_window` | defined, not wired | none | n/a | none | explicit recovery command if designed |
| `winMain_set_config` | defined, not wired in Main window | none | n/a | none | settings commands |
| `winMain_set_hot_key_config` | push only; hotkey editor | hotKey config event | config | UI refresh | hotkey state stream |
| `winMain_on_config_change` | push; Renderer setting | app setting event | partial setting | UI/service reconfiguration | settings observable |
| `winMain_key_down` | push; key event hub | HotKey/app key event | `{type,key}` | invokes commands | hotkey command dispatcher |
| `winMain_quit` | send; controls/tray UI | app.quit | none | process exit | lifetime service quit |
| `winMain_min_toggle` | send; key action | minimize/restore toggle | none | window state | window command |
| `winMain_hide_toggle` | send; key action | hide/show toggle | none | window visibility | window command |
| `winMain_player_action_set_buttons` | send; player | set Windows thumbar buttons | flags | taskbar UI | taskbar integration service |
| `winMain_player_action_on_button_click` | push; player action listener | thumbar/tray/OpenAPI action | action/data | playback command | typed command bus |
| `winMain_process_new_desktop_lyric_client` | push; lyric channel setup | winLyric requests Main Renderer port | none | establishes MessagePort | unnecessary; shared in-process state |

## winMain: lyrics, persistence, user source, sync, media and downloads

| Channel | Direction / caller | Handler / logic | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `winMain_handle_kw_decode_lyric` | invoke; Kuwo SDK | zlib/iconv Kuwo decode | base64/lyricx -> text | CPU only | C# decoder service |
| `winMain_handle_tx_decode_lyric` | invoke; Tencent SDK | qrc native addon + zlib decode | lrc/tlrc/rlrc -> decoded layers | native addon | C# decoder or narrow native bridge |
| `winMain_get_lyric_info` | defined, legacy flow removed | none | n/a | none | no migration |
| `winMain_set_lyric_info` | defined, legacy flow removed | none | n/a | none | no migration |
| `winMain_get_other_source` | invoke; music resolver | DB other-source query | track id -> online candidates | none | alternate-source repository |
| `winMain_save_other_source` | invoke; resolver | DB upsert list | id/list -> void | SQLite write | repository command |
| `winMain_clear_other_source` | invoke; cache settings | DB clear | none | SQLite delete | cache clear |
| `winMain_get_other_source_count` | invoke; settings | DB count | none -> count | none | cache metrics |
| `winMain_get_data` | invoke; renderer data utils | JSON Store path get | key path -> JSON | none | typed state repositories |
| `winMain_save_data` | send; renderer data utils | JSON Store set | path/data | atomic `data.json` write | typed persistence commands |
| `winMain_get_sound_effect_eq_preset` | invoke; sound UI | sound Store get | none -> presets | none | preset repository |
| `winMain_save_sound_effect_eq_preset` | send; sound UI | Store save | presets | JSON write | preset repository |
| `winMain_get_sound_effect_convolution_preset` | invoke | Store get | none -> presets | none | preset repository |
| `winMain_save_sound_effect_convolution_preset` | send | Store save | presets | JSON write | preset repository |
| `winMain_get_hot_key` | invoke; hotkey setting | return config | none -> config | none | hotkey settings query |
| `winMain_import_user_api` | invoke; user API modal | parse/validate/store script | script -> imported info | JSON write, may init source | custom-source manager |
| `winMain_remove_user_api` | invoke | stop/remove scripts | ids -> list | JSON write/runtime stop | manager command |
| `winMain_set_user_api` | invoke | select/init API | params -> void | hidden renderer runtime | compatibility runtime command |
| `winMain_get_user_api_list` | invoke | store query | none -> list | none | query |
| `winMain_request_user_api` | invoke; source adapter | queue request to hidden renderer | request key/data -> result | network/script execution | sandbox runtime call with cancellation |
| `winMain_request_user_api_cancel` | invoke; request cancel | cancel queued request | key -> void | rejects request | CancellationToken |
| `winMain_get_user_api_status` | invoke | current runtime state | none -> status | none | state query |
| `winMain_user_api_status` | push | runtime status event | status | UI/source availability | state stream |
| `winMain_user_api_show_update_alert` | push | script update event | info | modal UI | notification event |
| `winMain_user_api_set_allow_update_alert` | invoke | persist flag | id/enable -> void | JSON write | settings command |
| `winMain_get_lyric` | invoke; player resolver | DB merged player lyric | music key/id -> PlayerLyricInfo | none | lyric repository query |
| `winMain_get_lyric_raw` | invoke | DB raw lyric | music -> LyricInfo | none | repository query |
| `winMain_save_lyric_raw` | invoke (via `saveLyric`) | DB upsert raw | id/layers -> void | SQLite write | repository command |
| `winMain_clear_lyric_raw` | invoke; cache settings | DB clear raw | none | SQLite delete | cache clear |
| `winMain_get_lyric_raw_count` | invoke | DB count | none -> count | none | cache metrics |
| `winMain_get_lyric_edited` | invoke | DB edited lyric | music -> LyricInfo | none | repository query |
| `winMain_save_lyric_edited` | invoke; lyric editor | DB upsert edited | id/layers -> void | SQLite write | edit command |
| `winMain_remove_lyric_edited` | invoke | DB delete one | music/id -> void | SQLite write | delete edit command |
| `winMain_clear_lyric_edited` | invoke | DB clear edited | none | SQLite delete | cache clear |
| `winMain_get_lyric_edited_count` | invoke | DB count | none -> count | none | metrics |
| `winMain_get_music_url` | invoke; resolver | DB URL cache | typed music+quality key -> URL | none | media URL cache query |
| `winMain_save_music_url` | invoke; resolver | DB upsert URL | key/url -> void | SQLite write | cache command |
| `winMain_clear_music_url` | invoke | DB clear | none | SQLite delete | cache clear |
| `winMain_get_music_url_count` | invoke | DB count | none -> count | none | metrics |
| `winMain_read_local_metadata` | invoke; metadata modal | TagLib read | file path -> metadata | file read/WASM | `IMediaTagService.Read` |
| `winMain_write_local_metadata` | invoke; metadata modal | transactional TagLib write | request -> verified metadata | copy/rename/write | `IMediaTagService.WriteAtomic` |
| `winMain_write_local_embedded_lyrics` | invoke; lyric match | transactional tag write | filePath/lyric -> verified lyric | copy/rename/write | tag service |
| `winMain_read_local_embedded_lyrics` | invoke | TagLib read | path -> lyric | file read | tag service |
| `winMain_read_local_cover_file` | invoke; cover picker | validates/read file to data URL | path -> data URL | file read | image file service |
| `winMain_open_api_action` | invoke; Renderer sends status/action response | OpenAPI module action router | action -> result | resolves HTTP/SSE requests | in-process OpenAPI application port |
| `winMain_sync_action` | invoke + push; sync UI/service | start/stop/status/auth/data action | discriminated action -> result/status | HTTP/WS/FS/DB | sync service commands/events |
| `winMain_sync_get_server_devices` | invoke; settings modal | read device store | none -> devices | file read | sync device query |
| `winMain_sync_remove_server_device` | invoke | revoke/remove device | clientId -> void | file write/disconnect | revoke command |
| `winMain_get_themes` | invoke; theme init | built-in + user Store | none -> themes | reads assets/JSON | theme repository |
| `winMain_save_theme` | invoke; editor | save user theme | theme -> void | JSON write/broadcast | theme command |
| `winMain_remove_theme` | invoke | delete user theme | id -> void | JSON write | theme command |
| `winMain_download_list_get` | invoke; download init | DB download get | none -> tasks | none | download repository query |
| `winMain_download_list_add` | invoke; create tasks | DB insert/position | tasks/location -> void | SQLite write | download task command |
| `winMain_download_list_update` | invoke; progress throttle | DB update | tasks -> void | SQLite write | repository batch update |
| `winMain_download_list_remove` | invoke; UI | DB delete | ids -> void | SQLite write | delete command |
| `winMain_download_list_clear` | invoke; defined wrapper | DB clear | none -> void | SQLite delete | clear command |

## winLyric

| Channel | Direction / caller | Handler | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `winLyric_close` | defined; no active handler | n/a | n/a | none | window close directly |
| `winLyric_set_config` | invoke; lyric controls | merge main setting | partial config -> void | config write/broadcast/window behavior | settings command |
| `winLyric_get_config` | invoke; lyric startup | return desktop config | none -> config | none | injected state |
| `winLyric_on_config_change` | push | config event | partial config | UI/window update | observable settings |
| `winLyric_main_window_inited` | push | Main Renderer ready | none | retries channel connect | unnecessary in-process |
| `winLyric_set_win_bounds` | send; drag/resize | update lyric bounds | new bounds | window move/resize + setting | window service |
| `winLyric_set_win_resizeable` | send; hover/drag | presenter resizable | bool | window behavior | window service |
| `winLyric_key_down` | defined, not wired | none | n/a | none | input command directly |
| `winLyric_request_main_window_channel` | send; lyric app | creates MessageChannelMain | none | port transfer | remove IPC |
| `winLyric_provide_main_window_channel` | postMessage push | transfers port2 | MessagePort | direct lyric/analyser messages | shared playback state |

MessagePort actions are not Electron channel strings but are part of the complete communication map. Main Renderer sends `set_info`, `set_lyric`, `play`, `pause`, `stop`, `set_offset`, `set_playback_rate`, `send_analyser_data_array`; Lyric Renderer sends `get_info`, `get_status`, `get_analyser_data_array`. Native uses a shared `PlaybackSessionState`/`LyricTimelineState`, not message emulation.

## hotKey

| Channel | Direction / caller | Handler | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `hotKey_enable` | invoke; settings | register/unregister all | bool -> void/status | OS shortcut registration | `IGlobalHotKeyService.SetEnabled` |
| `hotKey_status` | invoke; settings | return registration state | none -> state | none | state query |
| `hotKey_set_config` | invoke; settings | validate/re-register | action map -> success | JSON/OS registrations | update command/result |

## bili

| Channel | Caller | Handler / actual logic | Params -> response | Side effects | Native replacement |
|---|---|---|---|---|---|
| `bili_account_get` | account settings/startup | cookie account nav | none -> account | may refresh session cookies | Bili session service |
| `bili_account_set_cookie` | account settings | parse/store/restore cookie | cookie -> account | config + cookie jar write | secure session store |
| `bili_account_clear` | account settings | clear config/session | none -> empty account | deletes cookies | logout command |
| `bili_search` | search/immersive | WBI search + page mapping | search params -> result | network/cookie refresh | Bili search adapter |
| `bili_get_music_qualitys` | resolver/download | view/playurl qualities | track -> quality info | network/token cache | media resolver |
| `bili_get_music_url` | player/download | playurl + loopback proxy token | track/quality -> result | starts/uses local proxy | Bili media resolver |
| `bili_get_video_url` | immersive MV | view/playurl video | track -> video result | proxy token/network | video resolver |
| `bili_get_pic` | artwork | image proxy token | track -> URL | proxy token | image resolver/cache |
| `bili_get_lyric` | player | subtitle/lyric resolution | track -> layers | Bili/other network | lyric provider |
| `bili_get_lyric_source` | immersive source | configured auto source | match params -> layers | Bili/NetEase/LRCLIB | lyric match service |
| `bili_get_lyric_source_candidates` | immersive source | searches candidates | params -> candidates | network | lyric match query |
| `bili_get_comment` | comments | reply API | params -> page/floors | network/cookies | comments adapter |
| `bili_get_songlist_detail` | song list | video pages -> track list | params -> detail | network | Bili playlist adapter |

## User API hidden-renderer internal IPC

这些名称在 `src/main/modules/userApi/rendererEvent/name.js`，不在公共 `ipcNames.ts`：

| Channel | Direction | Purpose | Native replacement |
|---|---|---|---|
| `userApi_init` | preload -> Main | script host ready/init metadata | sandbox runtime lifecycle |
| `userApi_request` | Main -> preload | execute source action | typed script call |
| `userApi_response` | preload -> Main | resolve/reject request | task completion |
| `userApi_openDevTools` | preload -> Main | open hidden renderer devtools | diagnostics only |
| `userApi_showUpdateAlert` | preload -> Main | script update notice | notification event |
| `userApi_getProxy` | preload -> Main | obtain proxy setting | injected network capability |
| `userApi_initEnv` | Main -> preload | provide env/config | immutable sandbox context |
| `userApi_proxyUpdate` | Main -> preload | proxy changed | network options observable |

## Completeness audit

`ipcNames.ts` 的所有未注释 channel 均在上述表中；额外覆盖 hidden User API IPC 和 desktop lyric MessagePort actions。注释掉的历史常量（pitch preset、save/clear lyric alias、thumbnail clip 等）不属于运行时 channel，只在相关行注明 legacy/未接线。
