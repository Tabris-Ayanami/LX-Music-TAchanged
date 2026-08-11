# Native implementation snapshot

权威迁移状态位于 `docs/migration/matrix.json`。本页只描述当前可运行解决方案，防止旧 Demo 的实验代码被误认为已迁移功能。

| Area | Actual status | Evidence |
|---|---|---|
| Phase 0 build profile | Implemented | unpackaged, framework-dependent, x64 Debug/Release project properties |
| Startup / main window | Scaffolded | real WinUI window, custom drag title bar, native caption buttons |
| Sidebar / local navigation | Implemented for Slice 1 | tracks, albums, artists |
| Legacy SQLite access | Implemented read-only | `Mode=ReadOnly`, `Pooling=false`, fixture hash test |
| Tracks browser | Implemented | virtualized list, search, availability filter, sort |
| Albums / artists | Implemented | grouping, virtualized cards, read-only detail |
| Artwork | Implemented for browsing | isolated cache, sidecar and Windows thumbnail paths |
| Theme / motion foundation | Scaffolded | Light/Dark resources and compositor-only view transition |
| Playback and queue | Not started | explicitly disabled in shell |
| Online/custom sources/Bilibili | Not started | only future architecture seam retained |
| Downloads/sync/OpenAPI/Folia | Not started | excluded from solution |
| Public deployment | Deferred | no packaging/signing/updater project |

No row in this file implies Electron-vs-Native behavior verification. That status changes only after recorded manual or automated comparison evidence.
