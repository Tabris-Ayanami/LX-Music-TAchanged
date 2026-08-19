# Lightweight UI and Functional Upgrade Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Deliver the four approved lightweight upgrades: stable gooey search motion, mirrored Discover next-song layout, unified local-track actions with an immersive metadata editor, and working Apple Music animated artwork with safe static fallback.

**Architecture:** Keep the existing Vue 3/Electron architecture and introduce only three focused reusable units: `BaseSwitch`, a pure local-track menu factory, and `DynamicArtworkVideo`. Apple lookup remains a renderer utility but resolves song-to-album relationships in the originating storefront before requesting editorial video. Existing metadata IPC and verified copy-and-swap writes remain unchanged.

**Tech Stack:** Vue 3 SFC/Pug/Less, TypeScript, Electron renderer APIs, Node `node:test`, existing webpack build.

**Spec:** `docs/superpowers/specs/2026-08-19-lightweight-ui-functional-upgrade-design.md`

## Global Constraints

- Work on branch `hybrid-native` and preserve unrelated user changes.
- Add no runtime dependency and do not introduce React, Tailwind, framer-motion, or a global token rewrite.
- `playDetail.appleDynamicCover` is the sole dynamic-artwork enable flag and defaults to `true`; legacy `playDetail.coverType` remains stored only for compatibility.
- When disabled, Apple artwork performs zero lookup requests; when the player detail is inactive, it renders zero dynamic `<video>` nodes.
- Keep metadata writes on the existing Main-process copy-and-swap path.
- Do not scan the full media library or run the full regression suite.

---

### Task 1: Stabilize search motion and mirror Discover next-song layout

**Files:**
- Modify: `src/renderer/components/material/SearchInput.vue`
- Modify: `src/renderer/views/Discover/index.vue`
- Modify: `tests/regression/search-input-expanded-glass-shell.test.cjs`
- Create: `tests/regression/discover-now-playing-layout.test.cjs`

**Interfaces:**
- Consumes: existing `focus`, `visibleList`, `.goo`, `.npTabNext`, `.npCover`, `.npMeta`, and `.npPlay` states.
- Produces: a background-only `.gooLayer` filter surface and mirrored `.npTabNext` CSS without changing event handlers.

- [ ] **Step 1: Add failing source-contract tests**

Extend the search test and create the Discover test with assertions equivalent to:

```js
assert.match(searchInputSource, /\$style\.gooLayer/)
assert.match(searchInputSource, /\.gooLayer\s*\{[\s\S]*filter:\s*url\('#lx-search-goo'\)/m)
assert.doesNotMatch(searchInputSource, /\.goo\s*\{[\s\S]{0,500}filter:\s*url\('#lx-search-goo'\)/m)
assert.equal((searchInputSource.match(/#icon-search/g) ?? []).length, 1)

assert.match(discoverSource, /\.npTabNext[\s\S]*\.npCover\s*\{[\s\S]*right:\s*14px/m)
assert.match(discoverSource, /\.npTabNext[\s\S]*\.npMeta\s*\{[\s\S]*text-align:\s*right/m)
assert.match(discoverSource, /\.npTabNext[\s\S]*\.npPlay\s*\{[\s\S]*left:/m)
```

- [ ] **Step 2: Run the focused tests and confirm RED**

Run:

```powershell
node --test tests/regression/search-input-expanded-glass-shell.test.cjs tests/regression/discover-now-playing-layout.test.cjs
```

Expected: the new goo-layer and mirrored-layout assertions fail against the current templates/styles.

- [ ] **Step 3: Move the goo filter to decorative shapes only**

In `SearchInput.vue`, keep the root interaction shell unfiltered, add one absolute `.gooLayer` containing the capsule and detached circle shapes, and render input, border, list, and the sole search icon above it. Keep existing keyboard, suggestion, clear, and submit handlers. Add a reduced-motion rule that removes decorative transforms/filter transitions while preserving focus visibility.

- [ ] **Step 4: Mirror only the next-song card**

In `Discover/index.vue`, scope rules beneath `.npTabNext` so the cover remains `right: 14px`, metadata is right-aligned with right-side cover clearance, and the play button is left anchored. Do not change previous/current tab rules or timing constants.

- [ ] **Step 5: Run focused tests and commit**

Run the command from Step 2 and expect all tests to pass, then:

```powershell
git add -- src/renderer/components/material/SearchInput.vue src/renderer/views/Discover/index.vue tests/regression/search-input-expanded-glass-shell.test.cjs tests/regression/discover-now-playing-layout.test.cjs
git commit -m "fix: stabilize search and Discover card motion"
```

### Task 2: Add the reusable switch and the sole dynamic-artwork setting

**Files:**
- Create: `src/renderer/components/base/Switch.vue`
- Modify: `src/common/defaultSetting.ts`
- Modify: `src/common/types/app_setting.d.ts`
- Modify: `src/renderer/views/Setting/components/SettingAppearance.vue`
- Modify: `src/lang/zh-cn.json`
- Modify: `src/lang/zh-tw.json`
- Modify: `src/lang/en-us.json`
- Create: `tests/regression/apple-dynamic-cover-setting.test.cjs`

**Interfaces:**
- Produces: `BaseSwitch` with `modelValue: boolean`, optional `disabled`, optional `label`, and `update:modelValue(boolean)`.
- Produces: `LX.AppSetting['playDetail.appleDynamicCover']: boolean`, default `true`.
- Consumes: global component auto-registration, `appSetting`, and `updateSetting`.

- [ ] **Step 1: Write a failing setting contract test**

```js
assert.match(defaults, /'playDetail\.appleDynamicCover':\s*true/)
assert.match(types, /'playDetail\.appleDynamicCover':\s*boolean/)
assert.match(appearance, /base-switch[\s\S]*playDetail\.appleDynamicCover/m)
assert.doesNotMatch(appearance, /updateSetting\(\{\s*'playDetail\.coverType'/m)
assert.match(baseSwitch, /role="switch"/)
assert.match(baseSwitch, /aria-checked/)
```

- [ ] **Step 2: Run the test and confirm RED**

Run:

```powershell
node --test tests/regression/apple-dynamic-cover-setting.test.cjs
```

Expected: failure because the setting and component do not exist.

- [ ] **Step 3: Implement `BaseSwitch`**

Implement a native button-based SFC whose click and Space/Enter activation emits `!modelValue`, exposes `role="switch"` and `aria-checked`, and uses existing color/motion variables. Disabled state must block emission; `prefers-reduced-motion` must remove thumb transition.

- [ ] **Step 4: Add and expose the setting**

Add the typed default key, replace the dynamic/static cover card choice in Appearance with the switch, and add these locale meanings in all three language files:

```text
setting__apple_dynamic_cover: Apple Music dynamic artwork
setting__apple_dynamic_cover_tip: Automatically use animated artwork when available; otherwise use the static cover.
```

Use translated Chinese variants in the two Chinese files. Do not delete the legacy `coverType` type/default because existing profiles may contain it.

- [ ] **Step 5: Run focused tests and commit**

```powershell
node --test tests/regression/apple-dynamic-cover-setting.test.cjs
git add -- src/renderer/components/base/Switch.vue src/common/defaultSetting.ts src/common/types/app_setting.d.ts src/renderer/views/Setting/components/SettingAppearance.vue src/lang/zh-cn.json src/lang/zh-tw.json src/lang/en-us.json tests/regression/apple-dynamic-cover-setting.test.cjs
git commit -m "feat: add dynamic artwork appearance switch"
```

### Task 3: Resolve Apple song hits to their real album

**Files:**
- Modify: `src/renderer/utils/appleDynamicCover/index.ts`
- Modify: `tests/regression/apple-dynamic-cover.test.cjs`

**Interfaces:**
- Extends internal search records with `resourceType: 'song' | 'album'` and `storefront: string`.
- Produces: `resolveAlbumReference(match, token): Promise<{ albumId: string, storefront: string } | null>`.
- Changes `getEditorialVideoUrl` to accept `(albumId, preferredStorefront)` and try that storefront first.

- [ ] **Step 1: Add a failing Shape-of-You API fixture test**

Add a mocked flow where search returns song `1193701392` without album relationships, `/cn/songs/1193701392?include=albums` returns album `1193701079`, and `/cn/albums/1193701079?extend=editorialVideo` returns a square HLS URL. Assert:

```js
assert.equal(result?.albumId, '1193701079')
assert.equal(result?.storefront, 'cn')
assert.ok(requestedUrls.some(url => url.includes('/cn/songs/1193701392?include=albums')))
assert.ok(requestedUrls.some(url => url.includes('/cn/albums/1193701079?extend=editorialVideo')))
assert.ok(!requestedUrls.some(url => url.includes('/albums/1193701392')))
```

- [ ] **Step 2: Run the Apple test and confirm RED**

```powershell
node --test tests/regression/apple-dynamic-cover.test.cjs
```

Expected: current code requests album `1193701392`, so the new test fails.

- [ ] **Step 3: Implement storefront-aware album resolution**

When building search records, retain the resource type and storefront. Resolve in this order:

```ts
if (match.resourceType == 'album') return { albumId: match.id, storefront: match.storefront }
if (match.albumId) return { albumId: match.albumId, storefront: match.storefront }
const detail = await fetchJson(`${AMP_API_BASE}/${match.storefront}/songs/${match.id}?include=albums`, token)
const albumId = detail?.data?.[0]?.relationships?.albums?.data?.[0]?.id
return albumId ? { albumId, storefront: match.storefront } : null
```

Make `getEditorialVideoUrl` reuse the supplied token and iterate `[preferredStorefront, ...STOREFRONTS without duplicate]`. Never fall back from a song ID directly to an album ID.

- [ ] **Step 4: Preserve caching and H.264 selection, then run GREEN**

Keep the existing 50-entry successful-result cache, in-flight de-duplication, serialized API requests, and `pickBestVariant` path. Run the Step 2 command and expect all Apple tests to pass.

- [ ] **Step 5: Commit the lookup fix**

```powershell
git add -- src/renderer/utils/appleDynamicCover/index.ts tests/regression/apple-dynamic-cover.test.cjs
git commit -m "fix: resolve Apple songs to animated albums"
```

### Task 4: Centralize video fallback and stop inactive decoding

**Files:**
- Create: `src/renderer/components/player/DynamicArtworkVideo.vue`
- Modify: `src/renderer/components/layout/PlayDetail/index.vue`
- Modify: `src/renderer/components/layout/PlayDetail/ImmersiveLyrics.vue`
- Modify: `src/renderer/store/player/dynamicCover.ts`
- Modify: `tests/regression/apple-dynamic-cover.test.cjs`

**Interfaces:**
- Produces: `DynamicArtworkVideo` props `src: string | null`, `poster?: string | null`, `active: boolean`; emits `error`.
- Consumes: `playDetail.appleDynamicCover`, player-detail visibility, current song identity, and existing `loadDynamicCover`/`resetDynamicCover`.

- [ ] **Step 1: Replace the obsolete prompt test with failing lifecycle contracts**

Assert the player no longer imports/uses `dialog.confirm` for dynamic covers, gates lookups on the new setting, and delegates all artwork videos:

```js
assert.doesNotMatch(playDetail, /setting__play_detail_dynamic_cover_prompt/)
assert.match(playDetail, /appSetting\['playDetail\.appleDynamicCover'\]/)
assert.match(playDetail, /<DynamicArtworkVideo/g)
assert.match(dynamicVideo, /v-if="active && src"/)
assert.match(dynamicVideo, /preload="metadata"/)
```

- [ ] **Step 2: Run the test and confirm RED**

```powershell
node --test tests/regression/apple-dynamic-cover.test.cjs tests/regression/apple-dynamic-cover-setting.test.cjs
```

- [ ] **Step 3: Implement `DynamicArtworkVideo`**

Render `<video>` only for `active && src`, with poster, muted, playsinline, loop, autoplay, `preload="metadata"`, and disabled picture-in-picture. On `error`, emit once for the current `src`; when `active` becomes false, the `v-if` must destroy the node rather than merely pause a hidden element.

- [ ] **Step 4: Replace all direct dynamic artwork videos**

Use the component for main cover, blur background, and immersive blur. Compute `dynamicArtworkActive` from all of:

```ts
appSetting['playDetail.appleDynamicCover'] &&
isShowPlayerDetail.value &&
visibled.value &&
!!musicInfo.id
```

Remove prompt tracking and dialog calls. Opening the detail or switching tracks loads only when enabled. Disabling resets current dynamic-cover state immediately; hiding the detail destroys video nodes but retains the utility cache for the next open.

- [ ] **Step 5: Run focused tests and commit**

```powershell
node --test tests/regression/apple-dynamic-cover.test.cjs tests/regression/apple-dynamic-cover-setting.test.cjs tests/regression/play-detail-background-cover-guard.test.cjs
git add -- src/renderer/components/player/DynamicArtworkVideo.vue src/renderer/components/layout/PlayDetail/index.vue src/renderer/components/layout/PlayDetail/ImmersiveLyrics.vue src/renderer/store/player/dynamicCover.ts tests/regression/apple-dynamic-cover.test.cjs
git commit -m "perf: release inactive dynamic artwork videos"
```

### Task 5: Unify local-track actions

**Files:**
- Create: `src/renderer/components/localMusic/localTrackMenu.ts`
- Modify: `src/renderer/components/localMusic/LocalTrackActions.vue`
- Modify: `src/renderer/views/List/MusicList/index.vue`
- Modify: `tests/regression/local-metadata-and-lyrics-actions.test.cjs`

**Interfaces:**
- Produces: `buildLocalTrackMenuItems({ hasLyrics, canRemoveFromList }): LocalTrackMenuItem[]`.
- Uses action IDs: `play`, `playLater`, `addTo`, `editMetadata`, `matchLyrics`, `revealFile`, `copyName`, and optional `remove`.
- `LocalTrackActions.showMenu(event, track, options?)` accepts optional `{ canRemoveFromList?: boolean }` while preserving current two-argument callers.

- [ ] **Step 1: Add failing pure-factory and integration assertions**

Transpile/load the TypeScript factory as existing Apple tests do, then assert:

```js
assert.deepEqual(
  buildLocalTrackMenuItems({ hasLyrics: false, canRemoveFromList: false }).map(item => item.action),
  ['play', 'playLater', 'addTo', 'editMetadata', 'matchLyrics', 'revealFile', 'copyName'],
)
assert.equal(buildLocalTrackMenuItems({ hasLyrics: true, canRemoveFromList: false })[4].name, '重新匹配歌词')
assert.equal(buildLocalTrackMenuItems({ hasLyrics: true, canRemoveFromList: true }).at(-1).action, 'remove')
```

Also assert that `MusicList/index.vue` no longer constructs simultaneous match/rematch entries by hand.

- [ ] **Step 2: Run the test and confirm RED**

```powershell
node --test tests/regression/local-metadata-and-lyrics-actions.test.cjs
```

- [ ] **Step 3: Implement the pure menu factory**

Return the canonical order above, changing only the lyric label based on `hasLyrics` and appending “从当前歌单移除” only when `canRemoveFromList` is true. Do not include file deletion.

- [ ] **Step 4: Wire actions without duplicating menu definitions**

In `LocalTrackActions.vue`:

- `play` calls existing `playSingleLocalTrack`;
- `playLater` calls `addTempPlayList([{ listId: props.listId, musicInfo: track }])`;
- `addTo` opens the existing `common-list-add-modal` for the selected track;
- edit/match keep the existing modals;
- `revealFile` calls `backend.platform.revealInFileManager(track.meta.filePath)`;
- `copyName` calls `clipboardWriteText(`${track.name} - ${track.singer}`)`;
- optional remove emits `remove` for the parent/list flow.

Make `MusicList` request the same factory output for local rows and route standard action IDs to its existing handlers. Ensure the menu closes before any asynchronous action begins.

- [ ] **Step 5: Run focused tests and commit**

```powershell
node --test tests/regression/local-metadata-and-lyrics-actions.test.cjs tests/regression/list-action-runner.test.cjs
git add -- src/renderer/components/localMusic/localTrackMenu.ts src/renderer/components/localMusic/LocalTrackActions.vue src/renderer/views/List/MusicList/index.vue tests/regression/local-metadata-and-lyrics-actions.test.cjs
git commit -m "feat: unify local track context actions"
```

### Task 6: Reshape the metadata editor into the approved immersive page

**Files:**
- Modify: `src/renderer/components/localMusic/MetadataEditModal.vue`
- Modify: `tests/regression/local-metadata-and-lyrics-actions.test.cjs`

**Interfaces:**
- Consumes: existing `LX.LocalMusic.Metadata`, `backend.metadata.read/write`, artwork preview, and `LyricsMatchPanel`.
- Produces: tabs `information | lyrics | file`; file tab is read-only.

- [ ] **Step 1: Add failing structure assertions**

```js
assert.match(editor, /activeTab[^\n]*'information'\s*\|\s*'lyrics'\s*\|\s*'file'/)
assert.match(editor, /主要信息/)
assert.match(editor, /分类与排序/)
assert.match(editor, /备注/)
assert.match(editor, /文件信息/)
assert.match(editor, /metadata\.bitrate/)
assert.match(editor, /metadata\.sampleRate/)
assert.match(editor, /metadata\.filePath/)
```

- [ ] **Step 2: Run the local test and confirm RED**

```powershell
node --test tests/regression/local-metadata-and-lyrics-actions.test.cjs
```

- [ ] **Step 3: Implement the hero and three tabs**

Keep the existing form state and save function. Move cover/title/artist/album/year into the hero. Render Information cards for primary fields, classification/sort fields, and comments; reuse `LyricsMatchPanel`; render format, bitrate, sample rate, duration, and path as text in File. Use existing theme variables and responsive rules, with no new dependency.

- [ ] **Step 4: Preserve write safety and close behavior**

The Save button appears only on Information, is disabled while reading/saving/error, and the modal cannot close during saving. Do not change `backend.metadata.write` request shape or any file-system implementation.

- [ ] **Step 5: Run focused tests and commit**

```powershell
node --test tests/regression/local-metadata-and-lyrics-actions.test.cjs
git add -- src/renderer/components/localMusic/MetadataEditModal.vue tests/regression/local-metadata-and-lyrics-actions.test.cjs
git commit -m "feat: refine local metadata editor"
```

### Task 7: Focused integration verification

**Files:**
- Modify only if a focused check exposes a defect in files already listed above.

**Interfaces:**
- Verifies the complete spec without scanning the full media library or running all regression tests.

- [ ] **Step 1: Run the complete focused regression set**

```powershell
node --test tests/regression/search-input-expanded-glass-shell.test.cjs tests/regression/discover-now-playing-layout.test.cjs tests/regression/apple-dynamic-cover-setting.test.cjs tests/regression/apple-dynamic-cover.test.cjs tests/regression/play-detail-background-cover-guard.test.cjs tests/regression/local-metadata-and-lyrics-actions.test.cjs tests/regression/list-action-runner.test.cjs tests/regression/discover-resource-lifecycle.test.cjs
```

Expected: every selected test passes.

- [ ] **Step 2: Run static project checks**

```powershell
npm run typecheck
npm run build:renderer
git diff --check
```

Expected: all exit successfully. If the repository has a documented pre-existing failure, record the exact command/output and verify it is unrelated before proceeding.

- [ ] **Step 3: Verify the real isolated Apple chain once**

Using only the single query `Shape of You / Ed Sheeran / ÷ (Deluxe)`, verify the utility resolves song `1193701392` to album `1193701079`, selects an H.264 HLS variant, and renders while the detail is visible. Toggle the Appearance switch off and verify no lookup request and no dynamic video node; toggle on and verify cached recovery. Do not enumerate or modify the user's music library.

- [ ] **Step 4: Review scope and repository state**

```powershell
git status --short
git log --oneline -8
```

Confirm no `.superpowers/brainstorm` artifact, generated build output, user profile data, or unrelated file is staged. Commit only a narrowly scoped fix if Step 1–3 required one; otherwise do not create an empty verification commit.

