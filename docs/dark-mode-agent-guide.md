# Dark Mode Agent Guide

This guide is for agents implementing a full dark/night mode for this LX Music desktop fork. Follow it as an engineering plan, not as a visual suggestion list.

## References

- MDN `prefers-color-scheme`: detects whether the user requested light or dark colors at OS/user-agent level.
  <https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@media/prefers-color-scheme>
- MDN `color-scheme`: lets the app opt browser-provided UI such as scrollbars/form controls into light/dark rendering. MDN also recommends an early `<meta name="color-scheme">` to reduce load flashes.
  <https://developer.mozilla.org/en-US/docs/Web/CSS/color-scheme>
- WCAG 2.2 quick reference: normal text needs 4.5:1 contrast, large text 3:1, and UI components/non-text indicators 3:1.
  <https://www.thewcag.com/resources/templates/quick-reference>
- Material dark theme guidance: dark themes should use layered surfaces/elevation and tuned color roles, not simple inversion.
  <https://m1.material.io/material-design/elevation-shadows.html>

## Current Project Facts

- Theme state already exists. Do not create a parallel theme framework.
- Settings already include `theme.id`, `theme.lightId`, and `theme.darkId` in `src/common/defaultSetting.ts`.
- The renderer shell already exposes `themeShouldUseDarkColors` and applies `themeShellLight` / `themeShellDark` in `src/renderer/App.vue`.
- Global variables live mainly in `src/renderer/assets/styles/index.less`.
- Theme generation lives in `src/common/theme/createThemes.js` and helpers in `src/common/theme/utils.js`.
- Many newer custom surfaces already use shell variables in `src/renderer/App.vue`, for example `--shell-*`.
- Regression tests are string-based Node tests under `tests/regression`. Use them to guard conventions.

## Goal

Implement dark mode by moving the app toward semantic design tokens and predictable theme surfaces. Avoid manual one-off component fixes where possible.

Success means:

- The app can render light and dark modes from the same component code.
- Components use semantic variables such as `--surface-*`, `--text-*`, `--border-*`, not hard-coded `rgba(255,255,255,...)` or `rgba(0,0,0,...)`.
- Existing user themes and custom theme editing continue to work.
- Floating island, play detail, queue drawer, dialogs, menus, toolbar, sidebar, lists, and settings remain readable.
- Text contrast meets WCAG AA where feasible: 4.5:1 for normal text, 3:1 for large text; visible UI boundaries/icons/focus states target at least 3:1.

## Non-Goals

- Do not redesign the app.
- Do not rewrite all theme generation in one large pass.
- Do not globally invert colors.
- Do not replace the existing theme setting model.
- Do not blindly convert every white/black occurrence. Album art overlays, glows, shadows, glass highlights, badges, and icon glyphs often need manual judgement.

## Implementation Strategy

### Phase 1: Add Semantic Tokens

Add a semantic token layer on top of existing variables. Prefer adding this near the current `:root` block in `src/renderer/assets/styles/index.less` and the shell blocks in `src/renderer/App.vue`.

Required token groups:

```less
/* App and large regions */
--app-bg;
--app-bg-elevated;
--content-bg;
--sidebar-bg;

/* Surfaces */
--surface-base;
--surface-soft;
--surface-raised;
--surface-strong;
--surface-glass;
--surface-hover;
--surface-active;

/* Text */
--text-primary;
--text-secondary;
--text-muted;
--text-inverse;
--text-on-accent;

/* Borders and dividers */
--border-subtle;
--border-strong;
--divider-subtle;
--focus-ring;

/* Controls */
--control-bg;
--control-bg-hover;
--control-bg-active;
--control-border;
--control-text;

/* Lists */
--list-row-hover;
--list-row-active;
--list-row-selected;

/* Overlays */
--overlay-scrim;
--menu-bg;
--modal-bg;
--drawer-bg;

/* Shadows and glass */
--shadow-soft;
--shadow-raised;
--glass-tint;
--glass-highlight;
--glass-rim;
```

Map existing tokens into these variables initially:

```less
:root {
  color-scheme: light;
  --text-primary: var(--color-font);
  --text-secondary: var(--color-font-label);
  --content-bg: var(--color-content-background);
  --surface-base: var(--color-main-background);
  --surface-hover: var(--color-list-hover-background);
  --surface-active: var(--color-list-active-background);
}

.themeShellDark {
  color-scheme: dark;
}
```

Use `themeShellLight` and `themeShellDark` for shell-specific overrides. If a variable must depend on custom theme colors, compute it from existing `--color-*` tokens with `color-mix()`.

### Phase 2: Build a Color Audit Script

Create a report-only script before mass replacement:

`scripts/quality/audit-theme-colors.cjs`

It should scan:

- `src/**/*.vue`
- `src/**/*.less`
- `src/**/*.ts`
- `src/**/*.js`
- `tests/regression/**/*.cjs`

Report hard-coded colors:

- Hex colors: `#fff`, `#ffffff`, `#000`, `#000000`, `#1f2937`, etc.
- RGB/A: `rgb(...)`, `rgba(...)`
- HSL/A: `hsl(...)`, `hsla(...)`
- CSS named colors except `transparent`, `currentColor`, and `inherit`
- `box-shadow` and gradient color stops

Output columns:

```text
file:line | property | color | suggested-token | confidence | notes
```

Suggested confidence:

- `high`: obvious text/surface/list/control color.
- `medium`: likely border/divider/shadow.
- `low`: gradient, glass, glow, album-art overlay, or component-specific effect.

Do not auto-edit low-confidence items.

### Phase 3: Guard New Hard-Coded Surface Colors

Add a regression test after the audit script is useful:

`tests/regression/theme-token-guard.test.cjs`

Recommended policy:

- Fail on new `#fff`, `#ffffff`, `#000`, `#000000` in renderer component styles unless the line contains an allow comment.
- Fail on new `rgba(255, 255, 255` or `rgba(0, 0, 0` in ordinary `background`, `color`, or `border` properties unless allowlisted.
- Allow explicit exceptions with `/* theme-token-allow: reason */`.

Do not enable the guard repo-wide until existing violations are inventoried. Start with newly touched files or a curated allowlist.

### Phase 4: Migrate High-Impact Surfaces First

Order matters. Convert shared/high-visibility surfaces before detail screens.

1. App shell:
   - `src/renderer/App.vue`
   - `src/renderer/assets/styles/index.less`
2. Sidebar and toolbar:
   - `src/renderer/components/layout/Aside/**`
   - `src/renderer/components/layout/Toolbar/**`
3. Reusable components:
   - `src/renderer/components/base/**`
   - `src/renderer/components/common/**`
   - menus, modals, buttons, list-add dialogs, tips
4. Lists and material views:
   - `src/renderer/components/material/**`
   - local music views
   - search views
   - song list views
5. Player-specific surfaces:
   - `PlayBar/FloatingIsland.vue`
   - `PlayDetail/index.vue`
   - `PlayDetail/PlayBar.vue`
   - `PlayQueueBtn.vue`
   - `VolumeBtn.vue`
   - lyric and comment panes
6. Settings and theme editor last, because those screens edit the same variables being changed.

### Phase 5: Replace by Role, Not by Color

Use role-based replacements:

```less
/* Bad */
background: rgba(255, 255, 255, 0.92);
color: rgba(36, 40, 48, 0.94);
border: 1px solid rgba(96, 111, 135, 0.14);

/* Good */
background: var(--surface-raised);
color: var(--text-primary);
border: 1px solid var(--border-subtle);
```

Common mappings:

```text
Plain page background      -> --content-bg / --app-bg
Card/dialog/drawer         -> --surface-raised / --modal-bg / --drawer-bg
Menu                       -> --menu-bg
Primary text               -> --text-primary
Secondary text             -> --text-secondary
Quiet labels               -> --text-muted
Thin line                  -> --divider-subtle
Button background          -> --control-bg
Button hover               -> --control-bg-hover
Selected row               -> --list-row-active
Hover row                  -> --list-row-hover
Focus outline              -> --focus-ring
```

Avoid these replacements:

```text
Album-art glow             -> inspect manually
Backdrop blur tint         -> inspect manually
Glass rim/highlight        -> inspect manually
Box shadows                -> inspect manually
Progress/audio visualizer  -> inspect manually
Brand/accent colors        -> keep accent-based unless contrast fails
```

### Phase 6: Theme Toggle Behavior

Respect existing theme settings first:

- `theme.lightId`
- `theme.darkId`
- system theme change IPC via `src/common/ipcNames.ts`
- `themeShouldUseDarkColors`

Desired behavior:

```text
theme mode = light  -> use theme.lightId
theme mode = dark   -> use theme.darkId
theme mode = system -> follow OS preference, using lightId/darkId
```

If the app already has equivalent behavior, do not replace it. Extend only where necessary.

Use `color-scheme`:

```less
:root {
  color-scheme: light dark;
}

.themeShellLight {
  color-scheme: light;
}

.themeShellDark {
  color-scheme: dark;
}
```

If editing HTML entry templates is necessary, add early:

```html
<meta name="color-scheme" content="light dark">
```

This helps user-agent controls and can reduce initial flashes.

### Phase 7: Verify Contrast

Add a small utility or script for token contrast checks:

`scripts/quality/check-theme-contrast.cjs`

Minimum checks:

- `--text-primary` on `--content-bg`
- `--text-primary` on `--surface-base`
- `--text-secondary` on `--surface-base`
- `--text-muted` on `--surface-raised`
- `--control-text` on `--control-bg`
- `--text-on-accent` on `--color-primary`
- `--border-strong` on `--content-bg`
- `--focus-ring` on `--content-bg`

Targets:

- Normal text: `>= 4.5`
- Large/bold labels: `>= 3`
- Icons, borders, focus indicators, control outlines: `>= 3`

Do not claim full WCAG conformance from token checks alone. Dynamic backgrounds, album art, glass, and gradients require visual review.

### Phase 8: Visual QA Checklist

Manually or with screenshots, verify both light and dark modes:

- Startup shell and sidebar
- Sidebar collapsed/expanded active tiles
- Toolbar search collapsed/expanded
- Context menus
- Dialogs and modals
- Play queue drawer in floating and detail modes
- Floating island compact/expanded
- Full play detail page
- Lyrics over artwork
- Music comments
- Local music list/detail
- Search results and blank state
- Song-list detail pages
- Settings and theme editor

For each screen check:

- Text readability
- Hover state visible but not glaring
- Active state distinct from hover
- Focus ring visible
- Disabled state still legible
- Icons visible on their surfaces
- Dividers visible enough but not noisy
- Glass surfaces do not turn gray/dirty
- Album artwork overlays still preserve cover visibility

## Suggested Agent Workflow

Use this exact sequence for future implementation agents:

1. Read this guide.
2. Inspect current theme application in:
   - `src/renderer/App.vue`
   - `src/common/defaultSetting.ts`
   - `src/common/theme/createThemes.js`
   - `src/common/theme/utils.js`
   - `src/renderer/store/**`
3. Add semantic tokens without changing component visuals.
4. Run `npm.cmd run test:unit`.
5. Add the audit script in report-only mode.
6. Generate an audit report and save it under `docs/dark-mode-audit.md`.
7. Convert one surface family at a time.
8. After each family:
   - run `npm.cmd run test:unit`
   - run the audit script
   - visually inspect light/dark screenshots
9. Add/expand regression tests only after the migration rule is stable.
10. Do not package/release until both light and dark mode have been visually checked.

## Safe Auto-Replacement Rules

Only auto-replace high-confidence declarations. Keep changes small and reviewable.

Examples:

```text
color: var(--color-font)                         -> color: var(--text-primary)
color: var(--color-font-label)                   -> color: var(--text-muted)
background-color: var(--color-content-background)-> background-color: var(--content-bg)
background: rgba(247, 249, 253, 0.92)            -> background: var(--drawer-bg)
border-bottom: 1px solid rgba(..., 0.14)         -> border-bottom: 1px solid var(--divider-subtle)
```

Never auto-replace:

```text
linear-gradient(...)
radial-gradient(...)
box-shadow: ...
filter: drop-shadow(...)
backdrop-filter surfaces
album-art color extraction output
theme editor color picker internals
```

## Allowlist Convention

When a hard-coded color is intentional, add a short comment:

```less
background: rgba(255, 255, 255, 0.42); /* theme-token-allow: glass specular highlight */
box-shadow: 0 28px 80px rgba(0, 0, 0, 0.30); /* theme-token-allow: artwork depth shadow */
```

Allowed reasons should be specific:

- `glass specular highlight`
- `artwork depth shadow`
- `album overlay scrim`
- `brand asset color`
- `native window control color`
- `debug/test fixture`

## Project-Specific Notes

### Existing `themeShellDark`

`App.vue` already has shell variables. Prefer folding new dark-mode tokens into this layer instead of scattering dark overrides across components.

### Theme Generation

`src/common/theme/createThemes.js` generates built-in themes. If semantic tokens become part of generated theme config, update the generator and run:

```powershell
npm.cmd run build:theme
```

Then review generated files carefully.

### Custom Themes

Do not break user-created themes. If adding required tokens, provide fallback values in CSS:

```less
color: var(--text-primary, var(--color-font));
background: var(--surface-raised, var(--color-main-background));
```

### Glass Components

Liquid glass and floating island components use layered highlights and shadows. Treat them as special surfaces. Replace plain text/background colors first; leave optical highlights and shadows for manual tuning.

### Play Detail Page

The play detail page derives colors from album art. Do not force all of it to static dark tokens. The target is readable overlays and controls, not removing cover-derived atmosphere.

## Definition of Done

A dark-mode implementation is done when:

- A user can select light/dark/system mode.
- System mode follows OS preference.
- `color-scheme` is set appropriately.
- Shared semantic tokens exist with light and dark values.
- High-impact surfaces use semantic tokens.
- The audit script runs and reports only accepted/allowlisted hard-coded colors for touched areas.
- Contrast script passes required token pairs.
- `npm.cmd run test:unit` passes.
- Build succeeds with `npm.cmd run pack`.
- Visual QA has screenshots or notes for the checklist above.

