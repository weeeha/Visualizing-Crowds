# Wealth Pile: Design Spec

**Date:** 2026-10-11
**Status:** Draft for review
**Repo:** weeeha/Visualizing-Crowds, branch `claude/wealth-visualization-ea780b`, folder `wealth/`

## TL;DR

A standalone, shareable 3D page. A small labeled figure of Elon Musk stands on top of a to-scale heap. A toggle switches the heap between **Cash** (his net worth in $100 bills) and **Bodies** (estimated deaths from the USAID cuts). Both heaps are sized from real volumes, so the bodies heap comes out about 1.6x taller than the cash heap. Only the outer shell of each heap is rendered; a hidden core cone carries the rest of the volume.

## Goals

- One image that makes the comparison physical: a fortune as a heap of cash, a policy outcome as a heap of people, same ground, same scale.
- Every number traceable: source, URL and date on the page; volume math in a methods footnote.
- 60 fps on a recent laptop in Chrome and Safari.

## Non-goals

- Integration with the crowd visualizer v1 (separate app, shares only stack and visual tone).
- Live net-worth feeds. Figures are a static data file updated by hand.
- Photo likenesses. Musk is a stylized labeled figure.
- Graphic or gory imagery. Bodies are faceless mannequins or shrouds.
- Production deploy. Preview only until Nick says go.

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Format | Standalone shareable piece |
| Image | Musk standing on a heap; toggle Cash / Bodies |
| Scale | To scale, real volumes, scale person at the base |
| Musk | Stylized figure + callout label, no photo |
| Scene | 3D, Three.js, orbit camera |
| Realism | Realistic materials and lighting, few instanced models |
| Rendering | Outer shell only (2 layers) over a hidden core cone |
| Default death figure | 500,000 (CGD low end) |
| Other billionaires | Dropdown in Cash mode; Bodies toggle shown for Musk only |

## Data

All figures live in `wealth/data/figures.ts`. Each entry carries `value`, `label`, `source`, `url`, `asOf`, and a `status` string shown in the UI.

### Net worth

| Person | Value | Source | As of |
|---|---|---|---|
| Elon Musk | $1.004T | Forbes real-time (https://www.forbes.com/profile/elon-musk/) | 2026-10-10 |

Bloomberg's $914B (2026-10-02) is cited in the footnote as the lower published figure.

Bezos, Zuckerberg, Ellison and Page are filled from Forbes real-time on the build date, using the same source for all five so the comparison is consistent. No value enters the file without a source URL and date.

### Estimated deaths from USAID cuts

| id | Deaths | Source | Status label |
|---|---|---|---|
| `cgd-low` (default) | 500,000 | CGD, "Update on Lives Lost from USAID Cuts" (https://www.cgdev.org/blog/update-lives-lost-usaid-cuts) | Modeled estimate to date; range 500k to 1M |
| `bu-counter` | 750,000 | BU Impact Counter, Brooke Nichols (via https://www.taipeitimes.com/News/world/archives/2026/01/21/2003850973) | Modeled, not peer-reviewed, Jan 2026 |
| `lancet-2030` | 9,400,000 | The Lancet / ISGlobal, Feb 2026 (via https://www.cnn.com/2026/02/04/world/lancet-usaid-global-aid-cuts-intl) | Peer-reviewed projection to 2030, all aid cuts |

The footnote states these are model estimates, not counted deaths, and links the NPR/WBUR report (https://www.wbur.org/hereandnow/2026/07/21/usaid-cuts) noting lower estimates in the tens of thousands.

## Volume math

Heaps are cones at a 35° angle of repose: `r = cbrt(3V / (π · tan35°))`, `h = r · tan35°`.

| Constant | Value | Why |
|---|---|---|
| $100 bill | 156 × 66 × 0.11 mm = 1.13 cm³ | US currency spec |
| Body, piled | 0.10 m³ | Average adult ~0.066 m³ at ~0.5 packing gives ~0.13; over half of estimated deaths are children, so the mean is lower |
| Angle of repose | 35° | Typical for loose irregular objects |

| Heap | Volume | Radius | Height | Surface |
|---|---|---|---|---|
| Cash, $1.004T | 11,371 m³ | 24.9 m | 17.5 m | 2,385 m² |
| Cash, $914B | 10,352 m³ | 24.2 m | 16.9 m | 2,240 m² |
| Bodies, 500k | 50,000 m³ | 40.9 m | 28.6 m | 6,401 m² |
| Bodies, 750k | 75,000 m³ | 46.8 m | 32.7 m | 8,388 m² |
| Bodies, 9.4M | 940,000 m³ | 108.6 m | 76.1 m | 45,259 m² |

These values are the unit-test fixtures for `pile/volume.ts`.

## Rendering

### Shell over core

- **Core:** a cone mesh with the heap's true radius and height, shrunk inward by the shell thickness, colored a dark occluded tone. A few hundred triangles.
- **Shell:** two layers of instanced pieces scattered over the cone surface. Two layers so gaps in the top layer reveal more pieces, never the core.
- The outer silhouette always matches the true volume. Only the invisible interior is approximated.

| | Cash | Bodies (500k) |
|---|---|---|
| Piece | $10k bundle, 156 × 66 × 11 mm | Mannequin or shroud, ~0.5 m² footprint |
| Instances, 2 layers | ~460k | ~26k |

### Placement (`pile/shell.ts`)

Pure function, no Three.js. Input: cone (r, h), piece footprint, layer count, seed. Output: a `Float32Array` of transforms (position, rotation, scale, variant index). Points are placed by a seeded hash over a surface grid with jitter, so the layout is identical on every load. Each piece gets random yaw, a tilt that follows the slope, and for bodies one of 5 poses plus optional mirroring.

### Level of detail (cash)

Real instanced bundles within ~30 m of the camera; beyond that, the core cone shows a bundle-pattern texture and far instances are culled. The cutoff is tuned against measured fps. Bodies mode needs no LOD at the default figure. At 9.4M (~180k instances) the same far-texture approach applies.

### Scene

- Three.js, `MeshStandardMaterial`, one directional sun with soft shadows, SSAO pass.
- Warm paper ground and beige haze, matching the crowd visualizer's tone.
- Scale person (1.75 m) at the heap base, Musk figure at the peak with a callout: name, net worth, source.

### Camera (`render/camera.ts`)

- Opens close on Musk at the peak, user orbits out.
- Pitch clamped 10° to 60°; minimum distance keeps the camera outside the heap.
- On toggle the camera keeps its position; if the new heap would intersect or fill the view, it eases back over ~600 ms.

## Assets

- **Bill bundles:** canvas-generated texture (green-gray face, "100", paper band). No scanned currency imagery.
- **Mannequin (5 poses), shroud, Musk figure, scale person:** modeled in Blender via MCP, exported as `.glb`, each under ~200 KB. Faceless, neutral materials.

## Architecture

```
wealth/
  index.html
  main.tsx
  data/figures.ts       sourced figures
  pile/volume.ts        count × unit volume → { r, h, area }      (pure)
  pile/shell.ts         seeded surface sampling → transforms       (pure)
  render/scene.ts       renderer, lights, SSAO, ground
  render/cashHeap.ts    instanced bundles + far texture
  render/bodyHeap.ts    instanced mannequins / shrouds
  render/figures.ts     Musk + scale person
  render/camera.ts      clamped orbit, ease-back
  ui/                   toggle, estimate picker, person dropdown, footnote
  assets/               .glb models
```

Stack: Vite + TypeScript + Three.js; React for the overlay only. Pinned versions matching the crowd visualizer (three 0.170.0, react 18.3.1, vite 5.4.11).

### Scene interface

```ts
type Mode = 'cash' | 'bodies';
interface WealthState {
  mode: Mode;
  personId: PersonId;       // bodies mode only valid for 'musk'
  estimateId: EstimateId;   // used in bodies mode
}
interface WealthScene {
  update(state: WealthState): void;   // idempotent, diffed internally
  dispose(): void;
  onStats(cb: (s: { fps: number; instances: number; heap: { r: number; h: number } }) => void): void;
}
```

State is mirrored to the URL hash so a shared link opens the same view.

## Error handling

- No WebGL2: show a static poster image of both heaps with the same labels and footnote.
- `.glb` load failure: fall back to a procedural capsule figure so the heap still renders.
- Selecting a non-Musk person while in Bodies mode switches to Cash mode.

## Testing

- **Vitest:** volume fixtures above (±0.1 m); shell sampling deterministic per seed; coverage check (no surface cell left empty); every data entry has `source`, `url`, `asOf`.
- **Playwright, Chromium + WebKit:** canvas non-blank; toggle changes reported heap height; estimate picker updates label and heap; fps above 30 in the test browser.
- **Manual:** screenshot review in Chrome and Safari before calling it done.

## Delivery

1. **HTML draft** (single file, rough materials): both heaps at real size, toggle, mannequin vs. shroud switch. Nick picks the body style and overall look.
2. **App build** per the implementation plan.
3. **Vercel preview**, unlisted. Production only on explicit go.

## Open questions

- Body style: mannequin or shroud (decided at the HTML draft).
- Final values for the four non-Musk net worths (filled at build time, sourced).
