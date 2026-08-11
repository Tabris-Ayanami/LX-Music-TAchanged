# Graphics and motion map

The goal is visual and interaction parity, not a literal Vue/React/CSS/Three.js port. The target selection rule is: XAML first, then Microsoft.UI.Composition, then Win2D where a retained-mode XAML tree is inefficient, and Direct3D/HLSL only for effects that actually require a programmable GPU pipeline.

Motion is a first-class migration priority. The Native UI must be designed and measured for 120 Hz from the shell slice onward; 60 Hz validation alone is not an acceptable performance result.

## 1. Observed visual system

The source and the reference screenshots under `F:\player\lx-music-desktop-master\截图反馈` show one coherent desktop system:

- Frameless shell with a compact left rail/sidebar, custom top window controls and a floating/attached bottom player.
- Light and dark palettes, translucent panels, soft blur, restrained borders/shadows, rounded pills and selected-navigation highlights.
- Dense song tables alongside cover-card grids; album/list detail uses large artwork, gradients and layered headers.
- Queue and contextual panels enter over the shell without replacing playback state.
- The play-detail surface expands into an immersive, artwork-led lyric experience with several user-selectable visualizer presets.
- Motion is mostly opacity/translation/scale, scrolling and progress interpolation. The expensive exceptions are the Aura background and Diorama preset.

Pixel values must be derived from source styles and golden screenshots during implementation. This document deliberately does not invent a redesigned design token set.

## 2. Technology inventory

| Legacy technology | Where it is used | Actual purpose | Native interpretation |
|---|---|---|---|
| Vue SFC + Less/CSS | Main shell, views, dialogs, lists, settings; legacy desktop lyric | Layout, themes, component states, transitions | WinUI 3 XAML controls/styles/templates; desktop lyric excluded |
| React 19 island | `components/layout/PlayDetail/FoliaVisualizerBridge.tsx` and vendored Folia | Immersive visualizer runtime and settings | Native presenter/view models; no React runtime |
| Framer Motion | Folia presets and overlays | Spring/tween layout, presence, lyric/object transitions | Composition animations and scoped expression/keyframe animations |
| Canvas 2D | Some Folia presets, text/layout/decor | Many primitives at high density | Win2D only where XAML element count becomes costly |
| Three.js + R3F | Diorama only | 3D camera, particle fields, textured/rasterized lyric surfaces | Direct3D/HLSL candidate after simpler parity attempt |
| WebGL worker | Aura artwork background | Downsample, Kawase-style blur, noise/UV distortion, crossfade | Composition/Win2D first; custom D3D shader only if measured/visually required |
| Web Animations/CSS animations | Lyric sweep, rotations, fades, panels, feedback | Timeline-synchronized and state motion | Composition/XAML animations with a shared motion policy |

The presence of Three.js is not a reason to use Direct3D elsewhere. Nine of ten Folia presets are DOM/canvas/Framer compositions, not 3D scenes.

## 3. Core shell and common effects

| Legacy implementation | Visual purpose | Native replacement | Difficulty | Risk |
|---|---|---|---|---|
| Frameless BrowserWindow + custom Vue title bar | Brand-consistent window chrome and window commands | WinUI `AppWindow`/title-bar customization; XAML hit targets | Medium | Drag regions, DPI and snap-layout compatibility |
| Less theme variables/classes | Shared light/dark/accent colors and spacing | XAML `ResourceDictionary`, theme resources and typed design tokens | Medium | Hidden per-component literals cause drift |
| CSS backdrop/filter blur and translucent layers | Glass-like shell, queue/detail overlays | System backdrop where suitable plus Composition backdrop/blur brush | Medium | Performance on low-end GPU, high contrast |
| Rounded panels, borders and shadows | Depth and grouping | XAML corner radius/borders; `ThemeShadow`/Composition shadow | Low | Shadow raster cost in scrolling lists |
| Sidebar active pill and hover feedback | Navigation location and affordance | XAML visual states + Composition opacity/translation | Low | Focus/keyboard state must match hover hierarchy |
| View/panel enter/exit transitions | Spatial continuity | `NavigationTransitionInfo` or scoped Composition animations | Medium | Cancellation during rapid navigation |
| Dialogs, menus, toasts and contextual panels | Modal/ephemeral feedback | WinUI ContentDialog/Flyout/custom TeachingTip/InfoBar templates | Medium | Z-order, focus trap, pointer dismissal |
| Song rows and cover grids | Dense library browsing | Virtualized ItemsRepeater/ListView/GridView templates | Medium | Virtualization lost by complex templates |
| Floating/attached player bar | Persistent playback access | XAML shell region; Composition expansion/morph hints | Medium | Must survive navigation and resize |
| Progress, volume and loading indicators | Continuous media feedback | XAML controls with Composition-driven visual layer | Low | Avoid UI-thread update per audio sample |

## 4. Artwork and play-detail effects

| Legacy implementation | Visual purpose | Native replacement | Difficulty | Risk |
|---|---|---|---|---|
| Large cover image with masks/gradients/shadows | Focus and legibility over artwork | XAML image/gradient overlay; Composition mask/shadow where needed | Medium | Cover decode size and transition churn |
| Cover color extraction / dynamic palette | Tie controls/background to current artwork | C# off-thread image sampling + cached palette; theme resources | Medium | Contrast and flash on track changes |
| Aura `WebWorkerBackgroundRender` + WebGL shaders | Soft animated artwork-derived ambient field and crossfade | Start with Composition layers + Win2D blur/noise; D3D pixel shader only if parity fails | High | GPU memory, resize, device loss, worker timing parity |
| Cover rotation/scale/parallax | Playback state and depth | Composition rotation/scale/expression animations | Low | Pause/resume phase discontinuity |
| Detail open/close transform | Connect compact player to immersive surface | Coordinated Composition animations/connected animation | High | Interrupted animations and layout changes |
| Lyric opacity/scale/translation hierarchy | Current line emphasis and readable context | Virtualized/recycled lyric presenter + Composition per-line transforms | High | Layout churn and accessibility at large text sizes |
| Per-word progress sweep (`lyric-font-player`) | Word-level karaoke timing | Win2D text layout/drawing or masked Composition text layers | High | Grapheme shaping, bidi/CJK timing, frame accuracy |
| Manual lyric scroll + snap-back | Direct navigation without fighting auto-follow | ScrollViewer state machine + Composition/scroll-linked visuals | Medium | User/clock ownership race |

## 5. Folia visualizer presets

The source registry under `src/renderer/vendor/folia/components/visualizer` contains ten named presets. Each should be migrated as an independently testable sub-feature after baseline play-detail and lyric timing work.

| Preset / legacy implementation | Visual purpose | Native replacement | Difficulty | Risk |
|---|---|---|---|---|
| Classic / 流光 — React + Framer text/layout | Familiar centered lyric emphasis and flowing transitions | XAML text presenter + Composition transforms/opacity | Medium | Font metrics and transition timing |
| Cadenza / 心象 — React + motion tuning | Emotion-led lyric staging and animated decoration | XAML/Composition; Win2D for dense decorative layers only | Medium-High | Preset-specific timing depends on lyric segmentation |
| Partita / 云阶 — layered React layout | Stepped/spatial lyric composition | XAML ItemsRepeater + Composition offsets | Medium-High | Resize and long-line layout |
| Fume / 浮名 — React plus generated background treatment | Hazy, drifting lyric atmosphere | Composition sprites/blur/noise; possible Win2D surface | High | Blur fill-rate and overdraw |
| Cappella / 群唱 — React, avatar/emotion image assets | Multi-voice/persona presentation | XAML image/text layers + Composition entrance/voice emphasis | High | Speaker mapping, asset memory, timing |
| Tilt / 倾诉 — React transforms | Angled/intimate lyric movement | Composition transform matrix and clipped XAML text | Medium | Text clarity under transform |
| Claddagh / 回环 — React motion | Circular/repeating relational motion | Composition orbit/expression animations | High | Interruptibility and reduced-motion fallback |
| Diorama / 镜台 — R3F, Three.js, GLSL, 3D geometry/camera/particles | True 3D lyric corridor/tableau with depth and particles | Isolated D3D renderer + HLSL hosted in composition; prototype a 2.5D Composition fallback first | Very high | Shader/geometry port, text rasterization, device loss, power use |
| Monet / 莫奈 — React/canvas background pipeline and audio overlay | Painterly color field, floating decor and lyric rail | Win2D surfaces + Composition; audio data sampled at UI-safe rate | High | Reproducing painterly blend and audio response |
| Pendolo / 时计 — React plus clockwork canvas/timeline | Pendulum/clockwork lyric choreography | Composition expressions/keyframes; Win2D for clockwork canvas | High | Timeline precision and cancellation |

Folia also supplies configurable backgrounds (`common`, `latent`, `monet`, `nomand`, `sora`, URL image). Treat the background as a separate `IImmersiveBackground` capability so preset choreography does not own image acquisition, decoding or cache lifetime.

## 6. Other dynamic visuals

| Area | Legacy source | Native target | Notes |
|---|---|---|---|
| Desktop lyric audio visualizer | `renderer-lyric/components/common/AudioVisualizer.vue` | Legacy separate-window spectrum | No Native replacement; feature explicitly canceled |
| Main audio-reactive overlays | player analyser + Folia `AudioOverlay` | Read-only amplitude/band snapshot service | Never expose the real-time audio callback directly to UI |
| Local library album/artist spatial presentation | local views/components and screenshot evidence | XAML/Composition carousel/spatial transforms | Prefer virtualized XAML; use Win2D only if element density proves problematic |
| Cover loading/crossfade | image utilities/components | Composition crossfade with generation/cancellation | Late cover result must not replace the newer track |
| Skeleton/spinner/feedback motion | shared Vue components/styles | XAML progress/visual states | Respect reduced motion and avoid indefinite decorative CPU use |
| Theme/color transitions | theme store and Less | Resource changes plus short Composition crossfade | Contrast must remain valid mid-transition |

## 7. Animation behavior contract

- Media-timed lyric visuals use player time as the clock; they must seek deterministically and must not accumulate animation drift.
- Navigation and panel animations are interruptible. A new command cancels or retargets the current animation without leaving opacity, hit-testing or focus in an intermediate state.
- Prefer compositor-thread opacity, translation, scale, rotation and clip changes. Do not animate layout properties in long lists.
- On the reference display locked to 120 Hz, common interaction and scrolling animations target a sustained 120 fps presentation cadence and an 8.33 ms per-frame budget. Report p50/p95/p99 app-side frame time, missed-vsync count and frames exceeding both 8.33 ms and 16.67 ms.
- A 60 Hz pass cannot verify the 120 Hz gate. Also test 60 Hz fallback and at least one 144 Hz/variable-refresh configuration to ensure timing is refresh-rate independent.
- Aura, Folia and other scalable effects reduce particle count, blur passes, render resolution or decorative layers before allowing pointer/scroll/transport feedback to fall below the 120 Hz cadence.
- The future app must expose a reduced-motion policy. It should remove decorative parallax/orbits/particles and shorten or replace large spatial transitions while retaining state feedback.
- Keyboard focus, high-contrast mode, text scaling and screen-reader semantics are part of visual parity, even where the Electron reference is incomplete.
- Render audio-reactive state at a bounded presentation cadence and aggregate analyser data off the UI thread.

## 8. Screenshot and motion verification

For each canonical screenshot, capture Electron and Native at the same content, window size, scale factor, theme, font configuration and playback time. Compare geometry and color with masked nondeterministic regions (timestamps, network images), then manually review typography, clipping and depth. Motion requires short synchronized recordings and event markers for start, peak, settle and interrupted exit; a still image cannot validate easing or lyric timing.

Test at 100%, 125%, 150% and 200% scale, resized/narrow window states, light/dark/high-contrast, reduced motion and integrated/discrete GPU configurations. Use 120 Hz as the primary acceptance mode, with 60 Hz and 144 Hz/VRR secondary runs. Track frame time, missed presents, UI-thread utilization, GPU memory and device-loss recovery for Aura/Diorama separately.

## 9. Implementation order

1. Extract visual/motion tokens, golden fixtures and 120 Hz frame instrumentation without changing Electron.
2. Build the shell and lists with reusable Composition motion primitives; scrolling and common transitions must pass the 120 Hz gate in Slice 1.
3. Build static play-detail, cover crossfade and lyric line/word motion with the same frame instrumentation.
4. Port non-3D Folia presets as an early vertical slice immediately after lyric foundation, each with its own 120 Hz quality-scaling gate.
5. Add artwork-derived/Aura backgrounds with adaptive render cost.
6. Prototype Diorama's visual result in 2.5D; use Direct3D/HLSL only when evidence shows it cannot meet parity and the result still meets the 120 Hz target on reference hardware.

The visual-review checklist additionally includes reduced-motion fallbacks, compositor-friendly properties, animation interruption, focus states and image decode/memory budgets. It supports parity and performance; it does not authorize a redesign.

## 10. Slice 1 implementation record

The first Native shell uses XAML for all layout, typography, controls, virtualized song rows and album/artist cards. View changes animate only compositor-owned opacity and `Visual.Offset` with the legacy `.23,1,.32,1` easing family; no layout property is animated. Light/Dark theme dictionaries establish the pale-blue/white and deep navy surfaces visible in the reference screenshots.

No Win2D, Direct3D, HLSL, Three.js port or graphics worker exists. Album/artist browsing currently uses a uniform virtualized card grid rather than the Electron two-dimensional planet layout, and the bottom player-shaped surface is explicitly disabled because playback is outside Slice 1. These are known visual differences, not parity claims.

The code path is suitable for high-refresh compositor presentation, but suitability is not measurement. The user will perform the visual interaction review; a 120 Hz PresentMon/ETW trace and 8.33 ms frame evidence remain required before `performance_verified`.
