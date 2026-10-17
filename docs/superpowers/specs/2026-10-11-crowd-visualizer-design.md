# Crowd Visualizer: Design Spec

**Date:** 2026-10-11
**Status:** Draft for review
**Repo:** weeeha/Visualizing-Crowds

## TL;DR

A browser tool that shows what N people look like, from 50 to 20M+, standing in a real place. Stylized flat people (2D sprites in a 3D world) on a warm neutral ground, everyday clothing colors. A left sidebar controls count, place, density and camera. Large counts stay fast through three levels of detail that all derive from one number: the crowd's fill radius from a focus point.

## Goals

- Make crowd sizes tangible: drag a slider, see the crowd grow inside a place you recognize.
- Cover 50 → 20M+ people in one continuous experience.
- Run smoothly on a recent laptop in Chrome and Safari.

## Non-goals (v1)

- Guided story / scroll mode (planned v2, reuses the v1 scene; see "Future").
- Searching arbitrary places.
- Stadium seating tiers, straight-down overhead camera, walking or animated people.
- Phone-tuned performance (it should work, not be optimized).

## Decisions (from brainstorming)

| Topic | Decision |
|---|---|
| Purpose | Interactive explainer |
| Camera | Orbit, angled views only (pitch clamped 10°–60°) |
| Layout | Fill a place outline outward from a focus point at a real density |
| Places v1 | Open field, Times Square, National Mall, Michigan Stadium, Manhattan |
| People | Style B "simple human": hair, arms, two legs, ground shadow |
| World | Warm paper: off-white ground, beige haze |
| Palette | Everyday mix by default; "neutral + accent" reserved for a highlight mode |
| Page | Sidebar tool (controls left, scene right) |

Mockups for these decisions live in `.superpowers/brainstorm/` (local, gitignored).

## Architecture

Vite + TypeScript. Three.js (plain, imperative) renders the scene. React renders the sidebar only. The scene is a module with a narrow interface, so the UI (and later the story mode) never touches Three.js directly.

```
src/
  places/      place data (JSON) + loader + validation
  layout/      fill-radius math, cell occupancy (pure functions)
  crowd/       per-person attributes from a cell hash (TS + matching GLSL)
  render/      Three.js scene, camera, LOD tiers, sprite atlas
  ui/          React sidebar, comparisons
  state.ts     app state store shared by ui and render
scripts/
  extract-place.ts   one-off OSM → place JSON
```

### Scene interface

```ts
interface SceneState {
  count: number;            // 50 .. 50_000_000
  placeId: PlaceId;
  density: 1 | 2.5 | 4.5;   // people per m²: loose | concert | packed
  highlight: null | { oneIn: number };  // accent mode, off by default
  cameraPreset?: 'aerial' | 'eye';
}
interface CrowdScene {
  update(state: SceneState): void;   // idempotent, diffed internally
  dispose(): void;
  onStats(cb: (s: { fps: number; nearSprites: number; overflow: boolean; capacity: number }) => void): void;
}
```

## Units

### `places/`

Each place is a JSON file in local meters (origin at the place's focus point, +x east, +z south):

```ts
interface Place {
  id: PlaceId;
  name: string;
  outer: [number, number][];      // closed ring, meters
  holes: [number, number][][];    // water, buildings, monuments
  focus: [number, number];        // where the crowd packs first (stage / steps)
  areaM2: number;                 // precomputed usable area (outer − holes)
  source: string;                 // OSM way/relation ids + extraction date
}
```

| Place | Focus | Notes |
|---|---|---|
| Open field | center | Generated circle, radius large enough for 50M at 1/m² |
| Times Square | center of the pedestrian plazas | Street + plaza area between building lines |
| National Mall | Capitol west front | Capitol → Lincoln Memorial; Reflecting Pool and other water as holes |
| Michigan Stadium | field center | Pitch + stands footprint treated as flat standing area |
| Manhattan | Central Park south edge | Land outline; the city-scale context for millions |

`scripts/extract-place.ts` queries the Overpass API once per place, projects lat/lon to local meters (equirectangular around the focus point is accurate enough at these sizes), simplifies the rings, and writes JSON. Output is committed and hand-checked against satellite imagery. A validator asserts closed rings, holes inside outer, and no self-intersections.

### `layout/`

Pure functions, no Three.js.

- `fillRadius(place, count, density) → { radius, overflow, capacity }`
  The crowd covers `count / density` m². Rasterize the place's usable area into a coarse grid (cell size scales with place size: 1 m for Times Square, up to 10 m for Manhattan), bucket cell areas by distance from focus, take the cumulative sum, and find the radius where it reaches the target area. If the target exceeds `areaM2`, return the full extent with `overflow: true` and `capacity = areaM2 × density`.
- `isOccupied(cellX, cellZ, ctx) → boolean`: inside outer, outside holes, and distance to focus < radius.
- Precomputed per place: a **mask texture** (usable area) and a **distance-to-focus field** used by the GPU tiers so they agree exactly with the CPU result.

### `crowd/`

People live on a jittered grid with spacing `1 / sqrt(density)`. A person is fully determined by `hash(cellX, cellZ, placeSeed)`:

- position jitter (±40% of spacing), height 1.55–1.90 m, slight head lean
- indices into shirt, pants, skin, hair palettes; pose variant (0–3)
- highlight flag: `hash < 1 / oneIn` when highlight mode is on

The same integer hash is implemented in TypeScript and GLSL. A unit test feeds identical inputs to both (GLSL evaluated in a headless WebGL test page) and compares outputs.

**Everyday palette** (from the approved mockup):
- Shirts: `#2f3e5c #3a3a3a #6b7a4b #a3542f #c9a227 #4f6d8f #ece8de #8c2f39 #5a7d7c #7a5c8e #d9822b #9fb3c8 #b8b2a7 #2e5e4e`
- Pants: `#2b3445 #1f1f22 #4a5568 #7b6a55 #3b4a63 #5b5148`
- Skin: `#f1c9a5 #e0ac83 #c68863 #8d5a3b #5c3a24`
- Hair: `#1b1410 #3b2a1e #6b4a2b #b08a5a #8a8a8a #2a2a2a`

**Highlight mode** swaps everyone to the neutral palette (`#9a9893 #b5b1a9 #7e7c78 #c8c3b9 #8d8a84 #a7a39b #6f6d6a`, pants `#5a5853 #4a4946 #6b6862`) and paints flagged people `#d63c2f`.

### `render/`

**Sprite atlas.** Generated at startup on an offscreen canvas: 4 pose variants of the style-B figure, each region painted a pure mask color (skin, shirt, pants, hair channels). The fragment shader replaces each mask color with the person's palette color. No image assets.

**Three LOD tiers.** All three use `isOccupied` (CPU) or the mask + distance textures (GPU) with the same radius, so the crowd edge is consistent across tiers.

| Tier | Range | Drawn as | Built |
|---|---|---|---|
| Near | within ~150 m of camera target, scaled by zoom | Instanced cylindrical billboards (rotate around Y only), soft ground shadow | CPU, per 50 m tile, cached; tiles regenerate when the camera moves |
| Mid | out to where a person is < ~2 px tall | `THREE.Points`, one shirt-colored dot per person | CPU per tile, larger tiles |
| Far | everything beyond | Ground-plane shader: per-pixel occupancy from mask + distance textures, speckle noise from the cell hash in palette colors | GPU only, cost independent of count |

Tier boundaries cross-fade over a short band to hide the switch. Near-sprite budget starts at 400k instances and drops in 25% steps if FPS stays under 50 for 2 s.

**World.** Warm-paper ground `#e3dfd7`, sky gradient `#f4f2ee → #ebe8e2`, light distance haze. Holes render as slightly different flat fills (water `#cfd6d4` with a `#c9c3b8` edge). Thin outline of the place boundary.

**Camera.** OrbitControls with pitch clamped to 10°–60°, zoom from ~5 m above the crowd to fitting the whole place. Changing place eases the camera to fit. Presets: Aerial (45°, fit place) and Eye level (10°, near the focus).

### `ui/`

Left sidebar, ~280 px, scene fills the rest.

- **Count:** big live number; log-scale slider 50 → 50M with tick labels (50, 1k, 100k, 1M, 20M); editable number field.
- **Place:** chips for the five places.
- **Density:** Loose (1/m²), Concert (2.5/m²), Packed (4.5/m²).
- **Compare:** "≈ N × {venue}" lines for the 2 closest reference venues. Capacities live in `ui/venues.ts`, each with a source URL, verified during implementation (no unsourced numbers).
- **Camera:** Aerial / Eye level.
- **Highlight:** off by default; toggle reveals "1 in N" input.
- **Overflow notice** when the count exceeds place capacity.
- Small FPS readout (toggle with `?debug`).

Typography and spacing follow the brainstorm mockup. The unslop audit runs before building the sidebar and again before calling it done.

## Data flow

```
sidebar input → state store → scene.update(state)
                                ├─ layout.fillRadius (memoized by place, count, density)
                                ├─ upload radius uniform → far tier
                                └─ mark near/mid tiles dirty → rebuild on next frames (time-sliced)
scene.onStats → sidebar (fps, overflow, capacity)
```

Slider drags update the radius uniform every frame (cheap). Tile rebuilds are time-sliced at ≤4 ms per frame so dragging stays smooth.

## Error handling

- No WebGL2: the scene area shows a plain message ("This needs WebGL2, try a recent Chrome or Safari"). The sidebar still works and shows the numbers.
- Count above capacity: fill the whole place, show "Overflow: {place} holds about {capacity} at this density."
- Place JSON fails validation: excluded from the chip list, console error in dev.

## Testing

- **Unit (Vitest):**
  - `fillRadius`: occupied area equals `count / density` within 2% for every place at 1k, 100k and 1M; overflow when expected.
  - Hash determinism and TS ↔ GLSL parity.
  - Place validation for all committed JSON.
  - Log-slider mapping round-trips (value → position → value).
- **Visual:** a scripted check in Chrome and Safari for each place at 1k, 180k and 20M (or capacity): page renders, crowd edge visible, no tier seams.
- **Performance:** with `?debug`, the National Mall at 180k holds 60 fps and Manhattan at 20M holds ≥30 fps on Nick's laptop. Recorded in the PR.

## Future (not v1)

- **Story mode** (layout C): scroll-driven steps 50 → 1k → 20k → 180k → 1M → 20M with camera flights and captions, ending in the sidebar tool. Drives the same `CrowdScene.update` plus a camera path.
- More places (Trafalgar Square, Tiananmen Square, Central London), live place search.
- Overhead sprite variant for a straight-down view.
- Idle animation (sway, head turns).
