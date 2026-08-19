# Stage 2A Memory Baseline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and run a repeatable Windows/Electron Stage 2A harness that creates isolated profile and media copies, measures the entire LX-TA process tree plus Renderer resources, executes functionally equivalent scenarios at least five times, and produces evidence for attribution before any Stage 2B optimization or Native LibraryService decision.

**Architecture:** Keep all measurement orchestration under `scripts/performance/stage2/`. A safe workspace preparer copies a stopped source profile and user-selected media roots, rewrites only the copied database, and records a manifest. A CDP client injects diagnostics before reloading the Renderer, scenario drivers perform deterministic actions, and a runner combines CDP samples with a PowerShell process-tree snapshot. Pure statistics/report modules aggregate raw JSON without touching the application.

**Tech Stack:** Node.js CommonJS, Node built-in test runner, `ws`, `better-sqlite3`, Electron 37.6.1, Chrome DevTools Protocol, PowerShell/CIM, Markdown/JSON reports.

**Spec:** `docs/hybrid-native-evaluation/stage-2-memory-first-handoff.md`

## Global Constraints

- Work only on branch `hybrid-native`; do not switch branches automatically.
- Never read/write the production database through the test app; `LX_TEST_USER_DATA_PATH`, `LX_NATIVE_PROFILE_PATH`, and `LX_NATIVE_CACHE_PATH` must all point inside the generated Stage 2 workspace.
- Refuse to copy a profile while any process command line uses that profile path.
- Media used by playback, artwork, metadata, or scan scenarios must be byte-for-byte copies under the Stage 2 workspace; hard links, junctions, and symlinks are forbidden.
- Keep the machine, Electron version, theme, window dimensions, custom source, media snapshot, waits, and scenario actions fixed in the run manifest.
- Each core scenario has at least 5 cold runs and 5 warm runs. Record the temperature groups separately, and report median plus inclusive min/max range for each group.
- Wait at least 10 seconds after page/scenario stabilization before the stable sample. Navigation pressure records recovery samples at 10, 30, and 60 seconds.
- Totals always include the Electron browser process, every Electron descendant, and the Rust sidecar. Record per-process Working Set, Private Bytes, CPU, process count, threads, and handles.
- Renderer diagnostics include used/total JS heap, DOM nodes, Documents, Frames, images, live object URLs, canvas/WebGL contexts, and workers. Native artwork cache records file count and bytes.
- GPU process Private Bytes must never be labeled GPU memory. If no reliable GPU-memory source exists, emit `available: false` with a reason.
- Attribution controls are test-only and default off. They may not delete product features, lower default visual quality, or become production defaults.
- Do not implement Native LibraryService, DownloadService, Native Player, libmpv, WASAPI, FFT IPC, Tauri, Wails, WinUI, or fooyin in this plan.
- Do not push. Keep independently reviewable local commits.
- Existing baseline: `test:unit` is 81/87 with the six Stage 0 visual assertion failures; Backend contract 5/5, boundary guard, typecheck, and Native integration pass.

---

### Task 1: Pure metrics model and five-run statistics

**Files:**
- Create: `scripts/performance/stage2/statistics.cjs`
- Create: `scripts/performance/stage2/schema.cjs`
- Create: `tests/regression/stage2-memory-statistics.test.cjs`

**Interfaces:**
- Produces: `median(values)`, `range(values)`, `summarizeRuns(samples, metricPaths)`, `assertSample(sample)`, and the `STAGE2_SAMPLE_VERSION = 1` constant.
- Consumes: no application code.

- [ ] **Step 1: Write the failing statistics/schema tests**

Use literal fixtures and assert these behaviors:

```js
assert.equal(median([9, 1, 5, 3, 7]), 5)
assert.equal(median([4, 2, 8, 6]), 5)
assert.deepEqual(range([9, 1, 5]), { min: 1, max: 9 })
assert.deepEqual(
  summarizeRuns(samples, ['processTotals.privateBytesMiB']),
  { 'processTotals.privateBytesMiB': { median: 110, min: 100, max: 130, count: 5 } },
)
assert.throws(() => assertSample({ version: 1, processTotals: { processCount: 0 } }), /process tree/i)
```

Name the protected break: an even-sized median must average the middle two values, missing process data must fail rather than generate a misleading report, and only finite numbers count.

- [ ] **Step 2: Run the new test and verify RED**

Run: `node --test tests/regression/stage2-memory-statistics.test.cjs`

Expected: FAIL because `scripts/performance/stage2/statistics.cjs` and `schema.cjs` do not exist.

- [ ] **Step 3: Implement the minimal pure modules**

Required exports:

```js
module.exports = { median, range, summarizeRuns }
module.exports = { STAGE2_SAMPLE_VERSION, assertSample }
```

`summarizeRuns` must walk explicit dot-separated paths, reject missing/non-finite data, and never silently mix samples whose `scenario`, `temperature`, or `variant` differ.

- [ ] **Step 4: Run focused and full regression tests**

Run: `node --test tests/regression/stage2-memory-statistics.test.cjs`

Expected: PASS.

Run: `npm run test:unit`

Expected: the new tests pass; overall result remains exactly the documented 81/87 plus the new passing cases, with only the six pre-existing visual failures.

- [ ] **Step 5: Commit**

```text
test: define stage 2 memory sample statistics
```

---

### Task 2: Safe isolated profile and media workspace

**Files:**
- Create: `scripts/performance/stage2/workspace.cjs`
- Create: `scripts/performance/stage2/prepare-workspace.cjs`
- Create: `tests/regression/stage2-memory-workspace.test.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: source profile path and one or more source media roots supplied on the CLI.
- Produces: `prepareWorkspace(options): Promise<WorkspaceManifest>` with absolute `profilePath`, `nativeProfilePath`, `nativeCachePath`, copied-media mappings, copied local-track count/bytes, source hashes, and output paths.

- [ ] **Step 1: Write failing safety and rewrite tests**

Create a temporary synthetic profile containing `LxDatas/lx.data.db`, a local list row whose `meta.filePath` points at two temporary media files, and unrelated rows. Assert:

```js
await assert.rejects(
  prepareWorkspace({ profileSource, outputRoot: profileSource, mediaRoots }),
  /destination.*source/i,
)
await assert.rejects(
  prepareWorkspace({ profileSource, outputRoot, mediaRoots, activeProfilePaths: [profileSource] }),
  /profile.*in use/i,
)
assert.notEqual((await fs.stat(copiedTrack)).ino, (await fs.stat(sourceTrack)).ino)
assert.equal(await fs.readFile(copiedTrack, 'hex'), await fs.readFile(sourceTrack, 'hex'))
assert.ok(rewrittenMeta.filePath.startsWith(manifest.mediaPath))
assert.equal(unrelatedRow.meta, originalUnrelatedMeta)
```

Also assert that a local DB path outside all declared media roots aborts preparation, and that symlink/junction inputs are rejected.

Name the protected break: the preparer must never alias, mutate, or leave references to real music files.

- [ ] **Step 2: Run the focused test and verify RED**

Run: `node --test tests/regression/stage2-memory-workspace.test.cjs`

Expected: FAIL because the workspace module does not exist.

- [ ] **Step 3: Implement workspace preparation**

Implement these rules:

```js
const manifest = await prepareWorkspace({
  profileSource,
  outputRoot,
  mediaRoots,
  copyBrowserCaches,
  activeProfilePaths,
})
```

- Resolve and compare all paths before copying.
- Refuse destinations inside a source and sources inside a destination.
- Use `lstat` to reject symbolic links/reparse-point media roots and entries.
- Use `fs.copyFile` for media; do not use hard-link APIs.
- Copy the stopped profile into `<output>/profile-template` and remove copied lock/port files (`lockfile`, `DevToolsActivePort`) only in the destination.
- Open only the copied `lx.data.db`; checkpoint its copied WAL, then update `my_list_music_info.meta` for `source == 'local'` rows under declared roots.
- Preserve relative paths under `<output>/media/root-N/` and update copied `filePath` plus local `picUrl`/lyric paths only when they point under the same declared source roots.
- Write `<output>/workspace-manifest.json` atomically. Include SHA-256 for the copied DB and each media file, Electron version, git commit, and a `sourceProfileWasInactive` flag.
- The CLI obtains active profile paths from `Get-CimInstance Win32_Process` command lines and passes them to `prepareWorkspace`; injected `activeProfilePaths` keeps the core testable.

- [ ] **Step 4: Add CLI and package script**

Add:

```json
"memory:stage2:prepare": "node scripts/performance/stage2/prepare-workspace.cjs"
```

Required CLI shape:

```text
npm run memory:stage2:prepare -- --profile-source=<path> --media-root=<path> [--media-root=<path>] --output=<path>
```

The CLI must print only the manifest path on success and a non-zero exit code on any safety failure.

- [ ] **Step 5: Verify tests**

Run the focused test, then `npm run test:unit` and `npm run check:backend-boundaries`.

- [ ] **Step 6: Commit**

```text
feat: add isolated stage 2 memory workspace
```

---

### Task 3: CDP diagnostics and whole-process-tree sampler

**Files:**
- Create: `scripts/performance/stage2/cdp-client.cjs`
- Create: `scripts/performance/stage2/renderer-probe.cjs`
- Create: `scripts/performance/stage2/process-tree.ps1`
- Create: `scripts/performance/stage2/sample.cjs`
- Create: `tests/regression/stage2-memory-sampler.test.cjs`
- Modify: `scripts/performance/capture-electron-baseline.cjs`

**Interfaces:**
- Produces: `connectRenderer(port)`, `installProbe(client)`, `collectRendererMetrics(client)`, `collectProcessTree(rootPid, sampleMs)`, and `captureSample(context)`.
- Consumes: an already-running isolated Electron browser PID and CDP port.

- [ ] **Step 1: Write failing sampler tests**

Use an injected fake CDP transport and literal PowerShell JSON. Assert that:

```js
assert.equal(sample.processTotals.privateBytesMiB, 150)
assert.equal(sample.processes.find(p => p.type === 'gpu-process').privateBytesMiB, 70)
assert.deepEqual(sample.gpuMemory, {
  available: false,
  reason: 'No reliable GPU-memory counter is available in this capture path.',
})
assert.equal(sample.renderer.liveObjectUrls, 1)
assert.equal(sample.renderer.workers.live, 2)
assert.equal(sample.renderer.contexts.webgl, 1)
```

Exercise the generated probe in a VM-backed fake window: `URL.createObjectURL` increments, `URL.revokeObjectURL` decrements, worker construction/termination changes live counts, and repeated `canvas.getContext('webgl')` for the same canvas is counted once.

Name the protected break: counts must describe live resources, not cumulative creations or duplicate getter calls.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/regression/stage2-memory-sampler.test.cjs`

Expected: FAIL because sampler modules do not exist.

- [ ] **Step 3: Implement CDP client and early probe**

`installProbe` must call `Page.addScriptToEvaluateOnNewDocument`, reload once, wait for app readiness, and expose only `window.__LX_STAGE2_MEMORY_PROBE__.snapshot()` in the isolated test Renderer. The probe tracks:

- live blob/object URLs and create/revoke totals;
- live Worker instances and created/terminated totals;
- unique 2D, WebGL, WebGL2, and bitmaprenderer canvas contexts;
- current DOM images/video/canvas counts and loaded image natural pixels;
- `Performance.getMetrics` values: `JSHeapUsedSize`, `JSHeapTotalSize`, `Documents`, `Frames`, `Nodes`, `LayoutCount`, and `RecalcStyleCount`.

CDP `Target.getTargets` worker/service-worker counts must be reported separately from constructor tracking.

- [ ] **Step 4: Implement PowerShell process-tree sampler**

`process-tree.ps1` accepts root PID and sample milliseconds. It recursively discovers descendants both before and after the CPU interval so a sidecar/utility spawned during sampling is not omitted. Each row includes PID, parent PID, image name, parsed Electron type (or `browser`/`sidecar`), Working Set MiB, Private Bytes MiB, CPU one-core percent, threads, and handles. Totals are computed from rows, not a second process query.

- [ ] **Step 5: Implement native artwork cache measurement and sample schema**

Recursively count files/bytes only below the manifest's `nativeCachePath`. `captureSample` must attach scenario, phase, temperature, variant, run index, elapsed time, Renderer data, process rows/totals, native cache, and unavailable GPU-memory marker, then call `assertSample` before writing JSON.

- [ ] **Step 6: Preserve the old baseline command through shared sampling**

Refactor `capture-electron-baseline.cjs` to call the new sampler without changing its documented CLI/output semantics. Do not delete the command.

- [ ] **Step 7: Verify tests**

Run focused test, `npm run test:unit`, `npm run typecheck`, and `npm run check:backend-boundaries`.

- [ ] **Step 8: Commit**

```text
feat: capture stage 2 renderer and process resources
```

---

### Task 4: Functionally equivalent scenario drivers

**Files:**
- Create: `scripts/performance/stage2/scenarios.cjs`
- Create: `scripts/performance/stage2/scenario-actions.cjs`
- Create: `scripts/performance/stage2/scenario-config.example.json`
- Create: `tests/regression/stage2-memory-scenarios.test.cjs`

**Interfaces:**
- Consumes: a CDP evaluator, copied-media root mappings, and an immutable run config.
- Produces: named scenario functions returning `{ readiness, actions, checkpoints }`.

- [ ] **Step 1: Write failing scenario contract tests**

Using a fake page driver, require the exact catalog:

```js
[
  'discover-idle',
  'discover-scroll',
  'search-results',
  'local-tracks',
  'local-albums-200',
  'playback-normal',
  'playback-folia',
  'playback-aura',
  'playback-diorama',
  'navigation-pressure',
  'library-scan',
]
```

Assert that search uses a config-provided non-empty `source`, `keyword`, and `expectedMinimumResults`; local album pressure requires at least 200 distinct artwork identities; all stable scenarios request a 10-second stabilization; navigation pressure uses exactly 10 loops and checkpoints `[10_000, 30_000, 60_000]`.

Name the protected break: Discover must never be substituted for a real search-result scenario, and an empty/too-small fixture must fail rather than produce a fake baseline.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/regression/stage2-memory-scenarios.test.cjs`

- [ ] **Step 3: Implement deterministic page actions**

Use these routes:

```text
#/discover
#/search?source=<source>&type=music&page=1&text=<keyword>
#/local?view=tracks
#/local?view=albums
#/setting
```

Actions must wait on observable readiness (route hash, non-empty rendered lists, visible controls, scan completion text) and then the fixed stabilization time. Scrolling must record distinct image/artwork URLs encountered. Playback scenarios must use the same copied local track and restore settings after each run. Folia, Aura, and Diorama remain separate scenarios, not a combined smoke action.

Before library scan, write `lx_local_music_library_folders` in the copied profile's Renderer localStorage using only manifest destination roots. Reject any folder outside the workspace.

- [ ] **Step 4: Define checked-in example config**

The example contains explicit fields, not local paths or credentials:

```json
{
  "window": { "width": 1280, "height": 800 },
  "theme": "follow-profile",
  "search": { "source": "wy", "keyword": "周杰伦", "expectedMinimumResults": 10 },
  "stabilizeMs": 10000,
  "navigationLoops": 10,
  "recoveryCheckpointsMs": [10000, 30000, 60000]
}
```

Runtime output must copy the resolved config into the report directory.

- [ ] **Step 5: Verify focused and smoke contracts**

Run focused test and `npm run smoke:renderer -- --port=<isolated-test-port>` only against a temporary test profile. If a real instance is not available yet, record the live smoke as pending in the task report; do not point it at `%APPDATA%\\LX-TA`.

- [ ] **Step 6: Commit**

```text
feat: add stage 2 memory scenario drivers
```

---

### Task 5: Electron launch, five-run orchestration, and report generation

**Files:**
- Create: `scripts/performance/stage2/run.cjs`
- Create: `scripts/performance/stage2/report.cjs`
- Create: `tests/regression/stage2-memory-runner.test.cjs`
- Modify: `package.json`

**Interfaces:**
- Consumes: prepared workspace manifest, scenario config, scenario/variant filters, run count.
- Produces: raw samples, run log, summary JSON, and Markdown report under a caller-selected output directory.

- [ ] **Step 1: Write failing orchestration tests**

Inject fake launcher/scenarios/sampler. Assert:

```js
assert.equal(calls.filter(c => c.kind === 'launch').length, 10) // five cold + five warm samples in fixture
assert.equal(summary.groups.control['local-tracks'].runs.length, 5)
assert.deepEqual(summary.groups.control['navigation-pressure'].checkpoints, [10000, 30000, 60000])
assert.match(markdown, /Median.*Range/i)
assert.match(markdown, /GPU memory.*not available/i)
```

The test must also prove SIGINT/failure closes only PIDs launched by this runner and preserves raw samples already written.

Name the protected break: orchestration must not cherry-pick a best run, conflate cold/warm samples, or leave test Electron/sidecar processes behind.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/regression/stage2-memory-runner.test.cjs`

- [ ] **Step 3: Implement isolated Electron launch**

Launch repository Electron with:

```text
node_modules/.bin/electron . --remote-debugging-port=<reserved-port>
```

and environment:

```text
LX_TEST_USER_DATA_PATH=<run-profile>
LX_NATIVE_PROFILE_PATH=<workspace/native-profile>
LX_NATIVE_CACHE_PATH=<workspace/native-cache>
LX_NATIVE_RELEASE=true
```

Every cold run profile is freshly copied from `profile-template`. A warm group performs five separate Electron launches against one group-specific profile that has already completed a non-measured priming launch. The launcher records root PID, command, environment keys (not secret values), git commit, Electron/Node versions, start/end timestamps, and exit status. Shutdown sends the normal close signal first, waits with a timeout, then kills only the recorded process tree if needed.

- [ ] **Step 4: Implement run matrix and atomic output**

Default `--runs=5`; reject values below 5 unless `--verification-only=true`. The count applies independently to cold and warm groups. Append each validated sample to JSONL immediately. Group by exact scenario + phase + temperature + variant and compute medians/ranges from all five samples.

- [ ] **Step 5: Implement Markdown report**

The report includes test conditions, per-process-type and total memory, CPU/threads/handles, Renderer resources, native cache, 10/30/60 recovery, errors, raw-file paths, and an explicit statement that GPU memory is unavailable. It must not claim Stage 2 completion or optimization benefits.

- [ ] **Step 6: Add package script**

```json
"memory:stage2:run": "node scripts/performance/stage2/run.cjs"
```

CLI:

```text
npm run memory:stage2:run -- --workspace=<manifest> --config=<json> --output=<dir> --runs=5
```

- [ ] **Step 7: Verify focused/full tests**

Run focused test, `npm run test:unit`, `npm run typecheck`, `npm run lint`, and `npm run check:backend-boundaries`.

- [ ] **Step 8: Commit**

```text
feat: orchestrate repeatable stage 2 memory runs
```

---

### Task 6: Test-only attribution variants

**Files:**
- Create: `scripts/performance/stage2/variants.cjs`
- Create: `tests/regression/stage2-memory-variants.test.cjs`
- Modify only if required by evidence: `src/renderer/components/layout/View.vue`
- Modify only if required by evidence: `src/renderer/backend/electron.ts`
- Modify only if required by evidence: `src/main/worker/index.ts`
- Modify only if required by evidence: `src/renderer/worker/index.ts`

**Interfaces:**
- Consumes: `--variant=<name>` from the Stage 2 runner.
- Produces: one isolated change per variant and records the exact effective controls in every sample.

- [ ] **Step 1: Write failing variant contract tests**

Require these initial variants:

```text
control
no-remote-images
no-remote-video
no-keep-alive
artwork-128
no-renderer-worker
no-db-worker
```

Tests assert control changes nothing; network variants use CDP Fetch interception and block only remote Image/Media resource types; local/file/native-cache artwork remains allowed; every application-side test gate requires both `LX_STAGE2_MEMORY_TEST=true` and its specific flag.

Name the protected break: attribution switches must not leak into normal startup or disable unrelated resources.

- [ ] **Step 2: Run focused test and verify RED**

Run: `node --test tests/regression/stage2-memory-variants.test.cjs`

- [ ] **Step 3: Implement CDP-only variants first**

Implement remote image/video blocking in `variants.cjs`. Implement visual attribution primarily by comparing the already separate normal/Folia/Aura/Diorama scenarios; do not add a product default that disables those visuals.

- [ ] **Step 4: Add the smallest app-side gates only where CDP cannot isolate the source**

- `no-keep-alive`: render the route component without `<keep-alive>` only when both test environment variables are present.
- `artwork-128`: cap local-list artwork requests at 128 only in the test variant; default code path and product setting remain unchanged.
- Worker variants: delay or skip the named worker only when the matching test gate is present; if the application cannot complete the scenario without it, mark the variant `not-measurable` rather than adding fake data.

Do not implement projection/pagination or Native Library in this task. Data-object attribution is performed with heap snapshots and existing adapter call/response sizes; a later Stage 2B prototype requires separate evidence and plan.

- [ ] **Step 5: Verify no production-default behavior changed**

Run focused test, `npm run test:unit`, `npm run typecheck`, `npm run lint`, Backend contract, boundary guard, renderer build, and renderer smoke against an isolated profile with no Stage 2 environment variables. Confirm the six known visual failures remain the only regression failures.

- [ ] **Step 6: Commit each application-side variant separately**

Use one local commit per independently measurable gate, for example:

```text
test: add keep-alive memory attribution gate
test: add artwork-size memory attribution gate
```

Do not combine gates whose A/B results must be interpreted separately.

---

### Task 7: Run Stage 2A baseline and publish attribution evidence

**Files:**
- Create: `docs/hybrid-native-evaluation/stage-2a-memory-baseline.md`
- Create: `docs/hybrid-native-evaluation/stage-2a-attribution-report.md`
- Modify: `docs/hybrid-native-evaluation/migration-plan.md`
- Raw outputs: caller-selected ignored directory outside tracked docs.

**Interfaces:**
- Consumes: completed Stage 2A harness, stopped real profile, copied media roots, and fixed config.
- Produces: the Stage 2A decision evidence. No Stage 2B code is part of this task.

- [ ] **Step 1: Confirm safe preconditions**

Run `git status --short`, confirm branch `hybrid-native`, confirm the installed LX-TA process tree is fully stopped, and run workspace preparation. Verify every rewritten local track path is inside the workspace and every copied media SHA-256 matches its source at preparation time.

- [ ] **Step 2: Run a one-scenario verification pass**

Run `local-tracks` with `--verification-only=true --runs=1`. Inspect root PID ancestry, sidecar inclusion, Renderer probe counters, native cache path, and cleanup. This pass is not part of the five-run result.

- [ ] **Step 3: Run the control baseline**

Run every required scenario with at least five cold samples and five warm samples. Keep cold and warm groups distinct. If download/transcode cannot be repeated without real output/network variability, report it unavailable with the reason rather than manufacturing a sample.

- [ ] **Step 4: Run attribution variants one at a time**

For each applicable source, run the same scenario/config five times under control and one changed variant. Never compare different pages, result counts, track sets, or visual modes. Record failed/not-measurable variants.

- [ ] **Step 5: Write baseline and attribution documents**

The baseline document records conditions, scenario medians/ranges, process rows/types, Renderer metrics, cache, recovery, and raw artifact hashes. The attribution document ranks sources by repeatable total Private Bytes effect, states confidence/limitations, and identifies the largest controllable source.

Explicitly answer:

- Does a local-tracks or large-artwork scenario already meet `>= 10%` or `>= 100 MiB` improvement? (Baseline alone normally cannot answer improvement; say so.)
- Does 10-loop navigation recover to within 5% at 60 seconds?
- Are JS heap, DOM, canvas/WebGL, worker, or object URL counts monotonically growing?
- Is whole-library/data duplication plausibly above the Stage 2C gate?
- Is Native LibraryService justified now? The default answer is “not yet” unless evidence meets the handoff thresholds.

- [ ] **Step 6: Run the Stage 2A regression gate**

Run build, typecheck, lint, Backend contract, boundary guard, Native tests, regression, renderer smoke, and native-media smoke against isolated data. Record exact pass counts and the known six-failure baseline.

- [ ] **Step 7: Commit documentation and stop at the decision gate**

```text
docs: record stage 2a memory baseline and attribution
```

Do not start Stage 2B or Stage 2C in this task. Review the evidence, then create a separate evidence-driven optimization plan for the top source.
