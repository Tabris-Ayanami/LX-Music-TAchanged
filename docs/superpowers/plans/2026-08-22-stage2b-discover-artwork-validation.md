# Stage 2B Discover Artwork Statistical Validation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Produce a repeatable five-cold/five-warm A/B result for the retained Discover 640px NetEase artwork limit, without touching production media/profile data or entering Native LibraryService work.

**Architecture:** Add one CDP-only attribution variant that removes the NetEase `param=640y640` request parameter at request time, so the production control path remains unchanged and both sides run from one commit. Run `discover-idle` and `navigation-pressure` through the existing Stage 2 harness, compare complete process-tree and Renderer medians/ranges, then update the Stage 2B evidence and decision documents.

**Tech Stack:** Node.js CommonJS, Node built-in test runner, Chrome DevTools Protocol Fetch interception, Electron 37.6.1, PowerShell/CIM, existing `scripts/performance/stage2/` harness.

**Spec:** `docs/hybrid-native-evaluation/stage-2-memory-first-handoff.md`

## Current State at Handoff

- Handoff date: 2026-08-22.
- Active repository: `F:\player\lx-music-desktop-master\lx-music-desktop-master`.
- Active branch at handoff: `ds` at `ffd3abd`; `ds` is a direct descendant of `hybrid-native` and is 7 commits ahead. The older instruction that execution must switch back to `hybrid-native` is stale for this integration workspace. Do not switch branches automatically.
- Stage 2A harness is complete. The existing 14-record/13-file isolated subset and reports still exist under `F:\player\lx-stage2a-subset-20260819-154100`.
- Stage 2B-1 Discover lifecycle cleanup is retained as a resource-ownership fix, but cold/warm memory results conflicted.
- Stage 2B-2 limits NetEase Discover artwork to 640px. It reduced 12 loaded images from 53,530,329 to 4,915,200 intrinsic pixels (-90.8%), but the one-run total Private Bytes result was not statistically conclusive.
- Native LibraryService remains unjustified. Stage 2C is out of scope.
- The main worktree is intentionally dirty with completed local-playback/source-decoupling and list-navigation race fixes. Preserve these exact paths and do not stage, commit, revert, or copy them into this performance task:
  - `src/renderer/core/useApp/useDataInit.ts`
  - `src/renderer/views/List/MusicList/useListInfo.js`
  - `tests/regression/local-playback-source-independence.test.cjs`
  - `tests/regression/list-navigation-race.test.cjs`
- Preserve the user's untracked `.opensquilla/`, workspace instruction files, and `memory/` directory.

## Global Constraints

- Execute this plan in an isolated worktree created from committed `ds` HEAD by following the `using-git-worktrees` skill. Do not benchmark or edit in the dirty main worktree.
- The A/B result applies to the recorded commit only. Record `git rev-parse HEAD`, Electron version, resolved scenario config, workspace manifest hash, and report hashes.
- Use only `F:\player\lx-stage2a-subset-20260819-154100\workspace-manifest.json` after the runner revalidates it. Do not read or write the production profile or real media files.
- The existing subset means these runs remain `verification-only`, even with five repetitions. They can validate the Discover artwork delta but cannot establish a complete Stage 2 baseline, satisfy the global `>=10%`/`>=100 MiB` gate, or justify Stage 2C.
- Compare the exact same scenarios, dimensions, waits, search configuration, run count, and temperature grouping. Never compare Discover with the old Stage 0 search page.
- Totals include the whole Electron process tree plus sidecar. GPU process Private Bytes is not GPU memory.
- Do not disable Discover, dynamic covers, Folia, Aura, Diorama, lyrics, or animation quality.
- Do not implement LibraryService, DownloadService, Native Player, shell migration, WinUI, fooyin, Tauri, or Wails.
- Do not push. Keep any implementation commit local and independent from the pending bug fixes in the main worktree.

---

### Task 1: Create a reversible original-artwork CDP variant

**Files:**
- Modify: `scripts/performance/stage2/variants.cjs`
- Modify: `tests/regression/stage2-memory-variants.test.cjs`

**Interfaces:**
- Consumes: `Fetch.requestPaused` events installed by `installVariant(client, name)`.
- Produces: measurable variant `discover-artwork-original`, which rewrites only NetEase `Image` request URLs by deleting the `param` query key and records the rewrite in `attribution.effectiveControls`.

- [ ] **Step 1: Extend the catalog test and write the failing rewrite test**

Add `discover-artwork-original` immediately after `control` in the expected `VARIANT_NAMES`. Add a test using the existing `createFakeClient()` helper:

```js
test('Discover original-artwork attribution removes only NetEase image sizing', async() => {
  const client = createFakeClient()
  const installed = await installVariant(client, 'discover-artwork-original')

  await client.emit('Fetch.requestPaused', {
    requestId: 'netease',
    resourceType: 'Image',
    request: { url: 'https://p1.music.126.net/cover.jpg?foo=bar&param=640y640' },
  })
  await client.emit('Fetch.requestPaused', {
    requestId: 'other-host',
    resourceType: 'Image',
    request: { url: 'https://example.com/cover.jpg?param=640y640' },
  })
  await client.emit('Fetch.requestPaused', {
    requestId: 'script',
    resourceType: 'Script',
    request: { url: 'https://p1.music.126.net/app.js?param=640y640' },
  })

  assert.deepEqual(client.calls.slice(1), [
    {
      method: 'Fetch.continueRequest',
      params: { requestId: 'netease', url: 'https://p1.music.126.net/cover.jpg?foo=bar' },
    },
    { method: 'Fetch.continueRequest', params: { requestId: 'other-host' } },
    { method: 'Fetch.continueRequest', params: { requestId: 'script' } },
  ])
  assert.deepEqual(installed.attribution.effectiveControls, [{
    mechanism: 'cdp-fetch',
    action: 'remove-query-parameter',
    resourceType: 'Image',
    hosts: ['music.126.net', '*.music.126.net'],
    parameter: 'param',
  }])
})
```

Also cover a malformed URL and `file:`, `data:`, and `blob:` inputs; each must continue unchanged.

- [ ] **Step 2: Run the focused test and verify RED**

Run:

```powershell
node --test tests/regression/stage2-memory-variants.test.cjs
```

Expected: FAIL because `discover-artwork-original` is unknown or lacks the rewrite behavior.

- [ ] **Step 3: Implement the smallest CDP-only rewrite**

Add a measurable definition with kind `cdp-fetch-rewrite`, an `Image` Fetch pattern, and the exact effective-control metadata asserted above. In the paused-request handler:

```js
const toOriginalDiscoverArtworkUrl = value => {
  let url
  try { url = new URL(value) } catch { return null }
  const host = url.hostname.toLowerCase()
  if (host != 'music.126.net' && !host.endsWith('.music.126.net')) return null
  if (!url.searchParams.has('param')) return null
  url.searchParams.delete('param')
  return url.href
}
```

Only pass `{ requestId, url }` to `Fetch.continueRequest` when all of these are true: the event resource type is `Image`, the URL is HTTP(S), the hostname is NetEase, and `param` exists. Otherwise pass only `{ requestId }`. Reuse the existing listener error capture and cleanup path; do not add an application environment flag or change `src/renderer/views/Discover/artworkUrl.cjs`.

Update `installVariant` so both Fetch-backed kinds enter the existing install/cleanup path:

```js
if (variant.kind != 'cdp-fetch' && variant.kind != 'cdp-fetch-rewrite') {
  return { attribution, cleanup: async() => {} }
}
```

Keep `no-remote-images` and `no-remote-video` on the existing blocking branch. Route only `discover-artwork-original` through the URL-rewrite branch; unknown kinds and variants must continue to fail closed.

- [ ] **Step 4: Run focused and adjacent regression tests**

```powershell
node --test tests/regression/stage2-memory-variants.test.cjs tests/regression/stage2-memory-runner.test.cjs tests/regression/discover-artwork-url.test.cjs
npx eslint scripts/performance/stage2/variants.cjs tests/regression/stage2-memory-variants.test.cjs
git diff --check
```

Expected: all selected tests and ESLint pass; `git diff --check` exits 0.

- [ ] **Step 5: Commit the isolated implementation**

```powershell
git add scripts/performance/stage2/variants.cjs tests/regression/stage2-memory-variants.test.cjs
git commit -m "test: add original Discover artwork attribution"
```

Do not include handoff files or files from the dirty main worktree in this commit.

---

### Task 2: Prove the A/B mechanism with one cold and one warm run

**Files:**
- Read: `F:\player\lx-stage2a-subset-20260819-154100\workspace-manifest.json`
- Read: `scripts/performance/stage2/scenario-config.example.json`
- Produce outside Git: a new uniquely named report directory under `F:\player\lx-stage2a-subset-20260819-154100\reports\`

**Interfaces:**
- Consumes: variants `control` (640px production behavior) and `discover-artwork-original` (CDP rewrite).
- Produces: a verification-only smoke report containing both variants for `discover-idle` and `navigation-pressure`.

- [ ] **Step 1: Verify safety and reproducibility preconditions**

```powershell
git branch --show-current
git status --short
git rev-parse HEAD
Test-Path -LiteralPath 'F:\player\lx-stage2a-subset-20260819-154100\workspace-manifest.json'
```

Expected: the isolated task branch is clean and the manifest exists. Before launch, confirm no existing process command line uses the workspace profile path. If the harness or safety check reports an active profile, stop that runner-owned test instance only; never kill unrelated LX-TA processes by name.

- [ ] **Step 2: Run a one-run verification matrix**

Choose a report path that does not already exist, then run:

```powershell
npm run memory:stage2:run -- --workspace=F:\player\lx-stage2a-subset-20260819-154100\workspace-manifest.json --config=scripts/performance/stage2/scenario-config.example.json --output=F:\player\lx-stage2a-subset-20260819-154100\reports\stage2b-discover-artwork-ab-smoke-20260822 --scenarios=discover-idle,navigation-pressure --variants=control,discover-artwork-original --runs=1 --verification-only=true
```

If that output directory exists, use a new timestamped suffix; never delete or overwrite an earlier report.

- [ ] **Step 3: Validate the smoke evidence before the long run**

Inspect `summary.json`, `raw-samples.jsonl`, and `run-log.jsonl`. Require:

- both variants, both temperatures, and both scenarios are present;
- the run log has no `failure` or `cleanup-failure` entries;
- each measured launch exits and no runner-owned Electron/sidecar process survives;
- control loaded NetEase artwork is bounded at 640 × 640 per loaded image;
- original-artwork has substantially higher `renderer.dom.loadedImagePixels` with a comparable loaded-image count;
- both groups report complete Electron process rows; GPU memory remains explicitly unavailable.

If the original-artwork group does not actually increase intrinsic pixels, stop and fix the Fetch rewrite or caching issue before running five repetitions.

---

### Task 3: Run the five-cold/five-warm statistical A/B

**Files:**
- Produce outside Git: a second new report directory under `F:\player\lx-stage2a-subset-20260819-154100\reports\`

**Interfaces:**
- Consumes: the smoke-validated matrix from Task 2.
- Produces: five cold and five warm samples per scenario/variant, plus the navigation 10/30/60-second recovery phases.

- [ ] **Step 1: Run the full verification-only A/B matrix**

```powershell
npm run memory:stage2:run -- --workspace=F:\player\lx-stage2a-subset-20260819-154100\workspace-manifest.json --config=scripts/performance/stage2/scenario-config.example.json --output=F:\player\lx-stage2a-subset-20260819-154100\reports\stage2b-discover-artwork-ab-5x-20260822 --scenarios=discover-idle,navigation-pressure --variants=control,discover-artwork-original --runs=5 --verification-only=true
```

Use a new timestamped suffix if necessary. Stay with the run until it completes or produces a real failure. Do not treat a long navigation-pressure matrix as hung merely because it is quiet.

- [ ] **Step 2: Verify sample completeness**

For each variant/scenario/temperature stable group, require exactly five run indices. For navigation recovery, require five samples at stable/10s, 30s, and 60s. Confirm `summary.incomplete` is false for the selected matrix while `summary.verificationOnly` remains true.

- [ ] **Step 3: Compare medians and inclusive ranges**

Report control (640px) versus original artwork separately for cold and warm:

- total `processTotals.privateBytesMiB` and `workingSetMiB`;
- renderer and GPU-process Private Bytes, without labeling GPU-process bytes as VRAM;
- `renderer.dom.loadedImages` and `loadedImagePixels`;
- JS heap, Nodes, Documents, Frames, workers, live object URLs, and canvas/WebGL contexts;
- navigation stable/10s versus recovery-30000 and recovery-60000;
- process count, threads, and handles.

Do not average cold and warm together and do not select the best run. Treat conflicting cold/warm direction or ranges wider than the delta as inconclusive total-memory evidence.

---

### Task 4: Publish the Stage 2B decision and stop at the gate

**Files:**
- Modify: `docs/hybrid-native-evaluation/stage-2b-discover-artwork.md`
- Modify: `docs/hybrid-native-evaluation/stage-2a-attribution-report.md`
- Modify: `docs/hybrid-native-evaluation/migration-plan.md`

**Interfaces:**
- Consumes: complete Task 3 reports and hashes.
- Produces: the evidence-backed next Stage 2B decision. No additional optimization implementation is part of this task.

- [ ] **Step 1: Record exact conditions and raw evidence**

Add the commit, branch, Electron version, manifest hash, resolved config hash, report path, `raw-samples.jsonl` hash, `summary.json` hash, and report hash. State prominently that the 14-record subset makes the result verification-only and unsuitable for Stage 2 completion or Stage 2C.

- [ ] **Step 2: Record the A/B table and interpretation**

Add cold and warm median/range tables for all metrics listed in Task 3. Explicitly answer:

1. Did 640px reduce intrinsic image pixels in every comparable group?
2. Did total Private Bytes move in the same direction for cold and warm, and was the delta larger than run-to-run variation?
3. Did Renderer Private Bytes move consistently even if GPU-process Private Bytes remained noisy?
4. Did navigation recover at 60 seconds without monotonic JS/DOM/worker/object-URL growth?
5. Is any result evidence for Native LibraryService? The expected answer remains no.

- [ ] **Step 3: Apply the decision gate**

- Keep the 640px limit if it preserves loaded-image count and visual correctness while consistently reducing intrinsic pixels; this remains valid even if total Private Bytes is noisy because its implementation cost is small and the decoded input reduction is direct.
- Claim a total-memory optimization only if cold and warm medians agree and the change exceeds observed range/variance. Otherwise label total-memory effect inconclusive.
- If total memory remains inconclusive, the next attribution experiment is existing `no-remote-images` versus control on the same Discover scenarios, followed by `no-remote-video` only if the page actually loads video. Do not immediately add a new product optimization.
- Do not enter Stage 2C, pagination, or Native LibraryService from this subset result.

- [ ] **Step 4: Run the regression gate**

```powershell
node --test tests/regression/stage2-memory-variants.test.cjs tests/regression/stage2-memory-runner.test.cjs tests/regression/discover-artwork-url.test.cjs
npm run typecheck
npx eslint scripts/performance/stage2/variants.cjs tests/regression/stage2-memory-variants.test.cjs
git diff --check
```

Optionally run `npm run test:unit`; the current repository baseline has seven unrelated UI/style guard failures (156/163 passing). Record, but do not repair, those failures unless the selected tests introduce an additional failure.

- [ ] **Step 5: Commit the evidence documents and stop**

```powershell
git add docs/hybrid-native-evaluation/stage-2b-discover-artwork.md docs/hybrid-native-evaluation/stage-2a-attribution-report.md docs/hybrid-native-evaluation/migration-plan.md
git commit -m "docs: validate Discover artwork memory attribution"
```

Report the A/B result, local commits, report paths, hashes, tests, and remaining limitation. Do not push and do not automatically start the next attribution experiment.
