# Regression Testing Notes

This repository now keeps a small local regression suite so maintenance threads
can verify fragile UI fixes without rebuilding a full test system first.

## Default commands

- `npm run lint`
- `npm run typecheck`
- `npm run test:unit`
- `npm run build:renderer`
- `npm run quality:gate`

## Current regression items

### RG-001: Virtualized list async scroll crash after unmount

- Symptom:
  packaged app could crash with `TypeError: Cannot read properties of null (reading 'scrollTop')`
- Root cause:
  `VirtualizedList.vue` scheduled async resize / next-tick / animation-frame work
  that could still run after the scroll container ref had been cleared during
  unmount. At the same time, list scroll restoration could try to use `listRef`
  before the virtualized list had mounted.
- Guard strategy:
  add null protection around container reads, cancel deferred work on unmount,
  and wait one render tick before restoring list scroll when the controller ref
  is not ready yet.
- Test coverage:
  `tests/regression/virtualized-list-scroll-guard.test.cjs`

### RG-002: Floating-island rotating cover stays compact-only

- Symptom:
  expanded floating-island mode accidentally inherited the compact spinning-disc
  treatment and visually cropped the album art too aggressively.
- Root cause:
  the rotating-cover class was applied whenever playback was active, instead of
  only when the floating island was in compact pill mode.
- Guard strategy:
  gate the spinning-cover class by `isFloatingIslandCompact` so expanded mode
  keeps the normal cover presentation.
- Test coverage:
  `tests/regression/floating-island-cover-mode.test.cjs`

### RG-003: Compact floating-island controls remain clickable

- Symptom:
  after collapsing to the pill layout, the play button and expand button could
  appear visually but stop responding to pointer interaction, especially after
  the pill was pinned against the left sidebar area.
- Root cause:
  the compact controls were still living inside a tightly clipped cluster with
  no explicit stacking priority, and once the pill overlapped the draggable
  sidebar zone the compact controls themselves were still allowed to behave
  like drag-region content.
- Guard strategy:
  keep the compact controls and their immediate container above neighboring
  content, allow their hit area to remain visible in compact mode, and mark the
  compact control lane plus its buttons as `no-drag`.
- Test coverage:
  `tests/regression/floating-island-compact-interaction.test.cjs`

### RG-004: Compact cover rotation pauses in place

- Symptom:
  pausing playback in compact floating-island mode snapped the spinning cover
  back to its initial angle instead of freezing at the current rotation.
- Root cause:
  the rotation animation only existed while the playing class was attached, so
  removing that class destroyed the animation state and reset the transform.
- Guard strategy:
  keep the compact-cover animation mounted at all times and switch only its
  `animation-play-state` between `paused` and `running`.
- Test coverage:
  `tests/regression/floating-island-motion-state.test.cjs`

### RG-005: Compact-to-expanded floating-island transition stays smooth

- Symptom:
  expanding the compact floating island felt close to a visual flash because the
  compact controls and expanded content switched too abruptly.
- Root cause:
  the layout was mostly relying on width collapse without coordinated transform
  and opacity motion for the compact and expanded content groups.
- Guard strategy:
  animate content visibility with width, opacity, and horizontal transform
  together so the compact controls ease out while expanded content eases in.
- Test coverage:
  `tests/regression/floating-island-motion-state.test.cjs`

### RG-006: Layout view only mounts keep-alive route content after router resolution

- Symptom:
  startup could crash with `TypeError: Cannot read properties of null (reading 'nextSibling')`
  from Vue's patching logic while the renderer was resolving the initial route.
- Root cause:
  the layout shell rendered the dynamic `router-view` component directly inside
  `keep-alive` even when `router-view` had not yet produced a stable component
  instance during redirect / startup resolution, which left Vue patching against
  a missing host anchor.
- Guard strategy:
  require a concrete `Component` before mounting the keep-alive child so the
  cached route shell only participates in patching after route resolution is
  stable.
- Test coverage:
  `tests/regression/view-router-component-guard.test.cjs`

### RG-007: Sidebar collapse keeps a fixed icon column

- Symptom:
  collapsing the sidebar could produce visible horizontal jitter because icons
  shifted left/right while the navigation width animated, and later visual
  tweaks also made icons drift off the shared logo baseline or clip against the
  active tile edge.
- Root cause:
  collapsed state changed the navigation grid from `icon + label` into `icon`
  only, forcing Vue/CSS layout to recompute icon positions during the width
  transition; later the icon container sizing was no longer locked to the same
  square lane used by the brand logo.
- Guard strategy:
  keep the same icon column in both states and only collapse the label lane
  through width/opacity/transform transitions while keeping a fixed square icon
  box on the same shared left baseline as the brand logo.
- Test coverage:
  `tests/regression/sidebar-collapse-layout.test.cjs`

### RG-008: Sidebar brand keeps a fixed logo lane

- Symptom:
  the `LX Music` logo at the top-left could still jump horizontally while the
  rest of the sidebar icons stayed visually stable during collapse/expand.
- Root cause:
  the brand block was switching to a centered layout and directly removing the
  text link, so the logo anchor point changed between expanded and collapsed
  states.
- Guard strategy:
  keep a fixed-width logo lane in the brand row and only collapse the brand
  text lane through width/opacity/transform transitions.
- Test coverage:
  `tests/regression/aside-brand-stability.test.cjs`

### RG-009: Floating island centers against the whole window

- Symptom:
  on wide windows the floating player looked visually offset even when the
  configured left and right window gutters were the same value.
- Root cause:
  the player host itself is the floating island root, so turning it into a flex
  container did not actually center the component once it hit its max width.
- Guard strategy:
  center the floating player host with `left: 50%` plus `translateX(-50%)`, and
  size it from a single window-gutter calculation while keeping the lifted
  bottom offset in the same rule set.
- Test coverage:
  `tests/regression/floating-island-window-centering.test.cjs`

### RG-010: Floating island keeps a fixed center lane and left cover anchor

- Symptom:
  the expanded floating player could look visually off-center, and the compact
  animation made the cover drift instead of keeping it pinned while the right
  side collapsed inward.
- Root cause:
  the main transport controls were absolutely positioned over a content-driven
  layout, and compact cover placement still used an extra horizontal transform.
- Guard strategy:
  reserve a dedicated center grid lane for the main controls and remove compact
  cover offsets so the cover stays on a fixed left anchor while the right side
  compresses, and pin the compact shell itself to the left window gutter.
- Test coverage:
  `tests/regression/floating-island-layout-balance.test.cjs`

### RG-011: Play-detail close transition keeps compact-cover rotation continuity

- Symptom:
  shrinking from full-screen play detail back to compact floating mode could
  briefly show the cover at its zero angle and then snap to the current
  spinning direction, which looked like a visible flicker.
- Root cause:
  close transitions could reuse a stale origin snapshot and the temporary motion
  cover did not carry the live compact-cover transform, so the final frame did
  not match the compact player's current rotation angle.
- Guard strategy:
  capture and persist cover transform in transition snapshots, force live-origin
  reads when closing play detail, and apply the captured transform to the motion
  cover element.
- Test coverage:
  `tests/regression/play-detail-transition-cover-transform.test.cjs`

### RG-014: Popup and selection surfaces stay opaque and stable above cached pages

- Symptom:
  selection dropdowns, popup menus, and modal surfaces could visually bleed the
  content underneath, and cached pages could keep document-level click handlers
  alive after deactivation.
- Root cause:
  shared surfaces were relying on translucent panel backgrounds, while some
  global listeners were only cleaned up on unmount even though route views are
  cached with `keep-alive`.
- Guard strategy:
  use near-opaque theme-tinted surfaces, isolate their paint layers, and detach
  document listeners when cached views deactivate.
- Test coverage:
  `tests/regression/surface-visibility-guard.test.cjs`

### RG-015: List hover states stay explicit across all affected list views

- Symptom:
  song rows in key list views could appear to have no hover state at all under
  the refreshed shell theme.
- Root cause:
  shared hover variables were too weak for the new light shell and were also
  vulnerable to lazy chunk style ordering.
- Guard strategy:
  pin stronger row hover / active surfaces directly in the affected list views,
  while keeping them theme-derived.
- Test coverage:
  `tests/regression/surface-visibility-guard.test.cjs`

## How to add the next regression item

1. Give the issue a stable id such as `RG-002`.
2. Add one focused test file or extend an existing regression test file.
3. Prefer testing the smallest invariant that proves the bug cannot reappear.
4. Update this document with:
   - symptom
   - root cause
   - guard strategy
   - test file path
5. Run `npm run quality:gate`.

## Quality gate notes

- `npm run typecheck` now validates the three real application entrypoints
  separately:
  - `src/common/tsconfig.json`
  - `src/main/tsconfig.json`
  - `src/renderer/tsconfig.json`
- Keep `npm run quality:gate` blocking on `typecheck`; if one of those three
  projects goes red, treat it as a real regression.
- `npm run quality:gate` also runs `build:renderer`; treat a production build
  failure as a release blocker, not a best-effort warning.

## Thread handoff note

When opening a new maintenance thread, ask to run the local quality gate and
reference this file if the task is about regression prevention or test-system
growth.
