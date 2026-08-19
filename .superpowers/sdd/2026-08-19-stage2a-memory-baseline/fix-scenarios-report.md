# Stage 2A scenario review fixes

## Scope

- Corrected Discover scrolling to select a visible, vertically scrollable page below `#view`, prefer the active `.view-container`/Discover page, advance its `scrollTop`, and collect artwork identities as they enter the container viewport.
- Removed the navigation-pressure action's fixed 10-second sleep. The action now records `recoveryStartedAtMs` immediately after the tenth navigation loop and exposes a frozen recovery scheduling contract.
- Added strict scenario-config validation for positive-integer window dimensions (maximum 8192) and the currently supported `follow-profile` theme. Resolved config remains a deep copied, deeply frozen value; scenarios do not apply window or theme state.

No runner, report, schema, variants, package configuration, real LX-TA profile, media, or process was changed or exercised by this fix.

## TDD evidence

The focused scenario test was changed first. Against the old implementation:

```text
node --test tests/regression/stage2-memory-scenarios.test.cjs
tests 10, pass 6, fail 4
```

The four expected failures protected these breaks:

- contracts did not expose recovery metadata;
- Discover used `window.scrollBy` and did not operate on the component's scroll container;
- navigation did not return an action-completion timestamp and did sleep for 10 seconds;
- invalid window/theme config was accepted.

Each behavior was then taken GREEN individually. Final focused verification:

```text
node --test tests/regression/stage2-memory-scenarios.test.cjs
tests 10, pass 10, fail 0
```

Syntax checks passed for:

- `scripts/performance/stage2/scenario-actions.cjs`
- `scripts/performance/stage2/scenarios.cjs`
- `tests/regression/stage2-memory-scenarios.test.cjs`

`git diff --check` passed for the same scoped files; Git printed only the repository's Windows line-ending advisory.

## Contract changes

All scenario contracts now have these keys:

```js
{ readiness, actions, checkpoints, recovery }
```

For non-recovery scenarios, `recovery` is `null` and `checkpoints` is empty. Navigation pressure provides:

```js
recovery: {
  origin: 'actions-complete',
  checkpointsMs: [10_000, 30_000, 60_000],
  stableCheckpointMs: 10_000,
}
```

Its action result includes `recoveryStartedAtMs`. The runner can schedule every checkpoint against the absolute deadline `recoveryStartedAtMs + checkpointMs`; the 10-second checkpoint is the stable sample, so it must not add a separate stabilization wait.

Discover scroll action results now include:

```js
{
  artworkIdentities,
  newArtworkIdentities,
  scroll: { before, after, maximum, passes, container: { id, className } },
}
```

The action fails closed when it cannot find a visible scrollable Discover container, cannot advance `scrollTop`, or cannot observe artwork newly reached by scrolling.

## Residual risks

- The Discover selector and scroll proof were exercised with a VM-backed DOM fixture, not a real Electron Renderer. CSS-module class names can be hashed in production, so selection primarily relies on the active direct `.view-container` relationship plus computed overflow rather than the literal `.page` token.
- A live Discover response with no artwork beyond the first viewport now fails instead of yielding a weak baseline; this is intentional but may expose sparse/offline fixture problems during consolidated integration.
- Window and theme application/observation remain runner responsibilities. Explicit theme IDs other than `follow-profile` are rejected until the runner has a safe read/write/restore contract.
