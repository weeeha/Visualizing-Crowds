# Crowd Visualizer v1 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A browser tool that renders 50 → 50M stylized people filling a real place, controlled from a sidebar.

**Architecture:** Pure TypeScript modules compute everything deterministic (place outlines, rasterized usable area, fill radius, per-person attributes from a cell hash). A plain Three.js scene draws three level-of-detail tiers that all share the same occupancy rule and hash (TS mirrored in GLSL). React renders only the sidebar and talks to the scene through a tiny store and a `CrowdScene.update(state)` interface.

**Tech Stack:** Vite 5.4, TypeScript 5.6, React 18.3, Three.js 0.170, Vitest 2.1, Playwright 1.48 (Chromium + WebKit), polygon-clipping 0.15, tsx 4.19.

**Spec:** `docs/superpowers/specs/2026-10-11-crowd-visualizer-design.md`

## Global Constraints

- Work on branch `feat/crowd-visualizer-v1` (created in Task 1 from `design/crowd-visualizer-spec`). Never commit to `main`.
- Pin exact dependency versions (`--save-exact`).
- Local coordinates: meters, origin at the place focus, +x east, +z south. Three.js ground plane is XZ, +y up.
- Densities: Loose `1`, Concert `2.5`, Packed `4.5` people/m².
- Count range: `50` to `50_000_000`, log-scale slider.
- Camera pitch clamped 10°–60° (OrbitControls polar angle 30°–80°).
- World colors: ground `#e3dfd7`, sky/fog `#ebe8e2`, place features (holes) `#cfd6d4`, outline `#c9c3b8`.
- Everyday palette and neutral+accent palette exactly as listed in the spec (`src/crowd/palettes.ts` is the single source; shaders read sizes from it).
- Performance targets: National Mall at 180k holds 60 fps; Manhattan at 20M holds ≥30 fps (recent laptop, `?debug` readout).
- Must work in Chrome and Safari. Every visual claim is checked in both.
- `THREE.ColorManagement.enabled = false` and `renderer.outputColorSpace = THREE.LinearSRGBColorSpace`: hex colors pass through unchanged so the render matches the approved mockups.
- UI copy: no exclamation marks, no em dashes.
- Run `me:unslop` before building the sidebar and again before calling it done.

**Spec deviations (deliberate, small):**
1. "Distance-to-focus field" is computed in shaders as `length(center)` (straight-line distance) instead of a texture. Same result, less code.
2. `SceneState.cameraPreset` becomes `camera: { preset, nonce }` so pressing the same preset twice re-flies the camera.
3. `CrowdScene.onStats` returns an unsubscribe function.
4. Fill radius counts lattice points exactly up to 2M people (area estimate beyond), so the "within 2%" requirement holds even when the crowd edge clips a place boundary.
5. "Slight head lean" is replaced by 4 pose variants in the sprite atlas.

## Review Focus

1. Typed count input with junk (`"abc"`, `"0"`, `"-5"`, `"1e12"`, `"1.5k"`): must clamp to 50…50M or revert, never NaN. Test lives in Task 7 (`parseCount`).
2. Narrow or resized window (phone width, sidebar stacked): canvas must match its container, no stretched render. Test lives in Task 8 (`e2e/scene.spec.ts`, mobile viewport).
3. Switching place while tiles are still building or the camera is mid-flight: no people from the previous place may remain. Test lives in Task 12 (`e2e/ui.spec.ts`, rapid place switch).
4. No WebGL2: the scene shows a plain message and the sidebar still works. Test lives in Task 8 (`e2e/scene.spec.ts`, `getContext` stub).
5. Count exactly at capacity and highlight `1 in N` extremes in the URL (`hl=1`, `hl=abc`): no overflow flicker, no divide-by-zero. Tests live in Task 5 (`count === capacity`) and Task 7 (`parseUrlState`).

---

## File Map

```
index.html                     app entry
hash-test.html                 GLSL/TS hash parity page (Task 9)
vite.config.ts                 Vite + Vitest config
playwright.config.ts           Chromium + WebKit e2e
src/
  main.tsx                     boot: URL → store → React
  App.tsx                      layout: Sidebar + SceneView
  SceneView.tsx                mounts CrowdScene, bridges store/stats
  styles.css                   tokens + layout
  state.ts                     SceneState, Density, createStore
  urlState.ts                  URL <-> SceneState
  crowd/hash.ts                hash3, unit, pickIndex, seedFromId, STREAM
  crowd/palettes.ts            all colors
  crowd/person.ts              personAt
  crowd/tiles.ts               buildNearTile, buildMidTile
  places/types.ts              Place, PlaceId, Ring
  places/geometry.ts           ringArea, pointInRing, bbox, ringSelfIntersects
  places/validate.ts           validatePlace
  places/openField.ts          makeOpenField
  places/index.ts              PLACES, getPlace
  places/data/*.json           extracted outlines (Task 4)
  layout/raster.ts             rasterize, usableAt, rasterBounds
  layout/fillRadius.ts         buildCountProfile, fillRadius, spacingFor
  layout/occupancy.ts          countOccupied (reference counter for tests)
  render/types.ts              CrowdScene, Layer, contexts, stats
  render/webgl.ts              supportsWebGL2
  render/lod.ts                lodRanges, BudgetGovernor
  render/tileSet.ts            tilesInRange, tileKey
  render/tileManager.ts        TileManager
  render/placeCache.ts         placeContext, countProfile
  render/world.ts              ground, place features
  render/camera.ts             CameraRig
  render/uniforms.ts           palette + fog uniforms
  render/atlas.ts              sprite atlas (canvas → DataTextures)
  render/shaders/hash.glsl.ts  GLSL hash
  render/shaders/near.ts       sprite shaders
  render/shaders/mid.ts        point shaders
  render/shaders/far.ts        ground crowd shader
  render/nearTier.ts           NearTier layer
  render/midTier.ts            MidTier layer
  render/farTier.ts            FarTier layer
  render/createScene.ts        createScene()
  debug/hashParity.ts          parity page script
  ui/useStore.ts               React binding
  ui/logScale.ts               slider mapping, parse/format counts
  ui/venues.ts                 sourced venue capacities + compareLines
  ui/Sidebar.tsx, CountControl.tsx, ChipGroup.tsx, HighlightControl.tsx, sidebar.css
  test/fixtures.ts             squarePlace() for unit tests
scripts/
  geo.ts                       projection + Douglas-Peucker
  place-recipes.ts             OSM ids per place
  extract-place.ts             Nominatim → src/places/data/*.json
  preview-places.ts            JSON → docs/place-previews/*.svg
e2e/*.spec.ts
```

---

### Task 1: Project scaffold

**Files:**
- Create: `package.json`, `tsconfig.json`, `vite.config.ts`, `playwright.config.ts`, `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`, `e2e/smoke.spec.ts`
- Modify: `.gitignore`

**Interfaces:**
- Consumes: nothing.
- Produces: `npm test` (Vitest), `npm run e2e` (Playwright, builds + previews on port 4173), `App` component with `aside[aria-label="Crowd controls"]` and `main[data-testid="scene"]`.

- [ ] **Step 1: Create the branch**

```bash
git checkout design/crowd-visualizer-spec
git checkout -b feat/crowd-visualizer-v1
```

- [ ] **Step 2: Write `package.json`**

```json
{
  "name": "visualizing-crowds",
  "private": true,
  "version": "0.1.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc --noEmit && vite build",
    "preview": "vite preview --port 4173 --strictPort",
    "test": "vitest run",
    "test:watch": "vitest",
    "e2e": "playwright test",
    "places": "tsx scripts/extract-place.ts",
    "places:preview": "tsx scripts/preview-places.ts"
  }
}
```

- [ ] **Step 3: Install pinned dependencies**

```bash
npm install --save-exact react@18.3.1 react-dom@18.3.1 three@0.170.0
npm install --save-exact -D typescript@5.6.3 vite@5.4.11 @vitejs/plugin-react@4.3.3 vitest@2.1.5 @playwright/test@1.48.2 @types/react@18.3.12 @types/react-dom@18.3.1 @types/three@0.170.0 @types/node@22.9.0 polygon-clipping@0.15.7 tsx@4.19.2
npx playwright install chromium webkit
```

- [ ] **Step 4: Write `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "noEmit": true,
    "types": ["vite/client", "node"]
  },
  "include": ["src", "scripts", "e2e", "vite.config.ts", "playwright.config.ts"]
}
```

- [ ] **Step 5: Write `vite.config.ts`**

```ts
import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: { main: fileURLToPath(new URL('./index.html', import.meta.url)) },
    },
  },
  test: {
    include: ['src/**/*.test.ts', 'scripts/**/*.test.ts'],
    environment: 'node',
    passWithNoTests: true,
    testTimeout: 30_000,
  },
});
```

- [ ] **Step 6: Write `playwright.config.ts`**

```ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: 'e2e',
  timeout: 90_000,
  expect: { timeout: 30_000 },
  use: { baseURL: 'http://localhost:4173' },
  webServer: {
    command: 'npm run build && npm run preview',
    url: 'http://localhost:4173',
    reuseExistingServer: true,
    timeout: 180_000,
  },
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'], launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] } },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
});
```

- [ ] **Step 7: Write `index.html`, `src/main.tsx`, `src/App.tsx`, `src/styles.css`**

`index.html`:
```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Visualizing Crowds</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import './styles.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

`src/App.tsx`:
```tsx
export function App() {
  return (
    <div className="app">
      <aside className="sidebar" aria-label="Crowd controls">
        <h1 className="title">Visualizing Crowds</h1>
      </aside>
      <main className="scene" data-testid="scene" />
    </div>
  );
}
```

`src/styles.css`:
```css
:root {
  --paper: #f4f2ee;
  --ground: #e3dfd7;
  --ink: #2b2925;
  --muted: #7a756c;
  --line: #e0dbd2;
  --chip-border: #cfc9be;
  --sidebar-w: 280px;
  font-family: system-ui, -apple-system, 'Segoe UI', sans-serif;
  color: var(--ink);
}
* { box-sizing: border-box; }
html, body, #root { height: 100%; margin: 0; }
body { background: var(--paper); }
.app { display: flex; height: 100%; }
.sidebar {
  width: var(--sidebar-w);
  flex: none;
  padding: 20px 18px;
  overflow-y: auto;
  border-right: 1px solid var(--line);
  background: var(--paper);
}
.scene { flex: 1; min-width: 0; min-height: 0; position: relative; background: var(--ground); }
.scene canvas { display: block; width: 100%; height: 100%; }
.title { font-size: 13px; font-weight: 600; margin: 0 0 16px; letter-spacing: 0.01em; }
@media (max-width: 720px) {
  .app { flex-direction: column-reverse; }
  .sidebar { width: auto; height: 45%; border-right: 0; border-top: 1px solid var(--line); }
}
```

- [ ] **Step 8: Write the smoke e2e test**

`e2e/smoke.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('app shell renders sidebar and scene container', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/');
  await expect(page.getByRole('complementary', { name: 'Crowd controls' })).toBeVisible();
  await expect(page.getByTestId('scene')).toBeVisible();
  expect(errors).toEqual([]);
});
```

- [ ] **Step 9: Update `.gitignore`**

Append:
```
test-results/
playwright-report/
```

- [ ] **Step 10: Run everything**

Run: `npm run build && npm test && npm run e2e`
Expected: build succeeds; Vitest "No test files found" passes; Playwright 2 passed (chromium, webkit).

- [ ] **Step 11: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + Three + Vitest + Playwright"
```

---

### Task 2: Cell hash, palettes, person attributes

**Files:**
- Create: `src/crowd/hash.ts`, `src/crowd/palettes.ts`, `src/crowd/person.ts`
- Test: `src/crowd/hash.test.ts`, `src/crowd/person.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `hash3(x: number, z: number, seed: number): number` (uint32)
  - `unit(h: number): number` in [0,1), top 24 bits
  - `pickIndex(h: number, n: number): number` in [0,n), integer math
  - `seedFromId(id: string): number` (30-bit, non-negative)
  - `STREAM = { jitterX: 0, jitterZ: 1, height: 2, shirt: 3, pants: 4, skin: 5, hair: 6, lod: 7, pick: 8, pose: 9 }`
  - palettes: `SHIRT, PANTS, SKIN, HAIR, NEUTRAL_SHIRT, NEUTRAL_PANTS, ACCENT, GROUND, SKY, FEATURE, EDGE, SHADOW` (hex strings)
  - `POSE_COUNT = 4`
  - `interface Person { cx; cz; jx; jz; height; shirt; pants; skin; hair; pose; lodRand; pickRand }` (all numbers)
  - `personAt(i: number, k: number, spacing: number, seed: number): Person`

- [ ] **Step 1: Write the failing hash tests**

`src/crowd/hash.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { hash3, pickIndex, seedFromId, unit } from './hash';

describe('hash3', () => {
  it('matches frozen golden values (GLSL parity depends on these)', () => {
    expect(hash3(0, 0, 0)).toBe(0);
    expect(hash3(1, 2, 3)).toBe(1631111411);
    expect(hash3(-5, 7, 42)).toBe(1108561844);
    expect(hash3(-1, -1, 1073741823)).toBe(3257144788);
  });

  it('is deterministic and distinguishes neighbours', () => {
    expect(hash3(10, 20, 5)).toBe(hash3(10, 20, 5));
    expect(hash3(10, 20, 5)).not.toBe(hash3(11, 20, 5));
    expect(hash3(-10, 20, 5)).not.toBe(hash3(10, 20, 5));
  });
});

describe('unit', () => {
  it('stays in [0, 1) with mean near 0.5', () => {
    let sum = 0;
    for (let i = 0; i < 100_000; i++) {
      const u = unit(hash3(i % 317, Math.floor(i / 317), 9));
      expect(u).toBeGreaterThanOrEqual(0);
      expect(u).toBeLessThan(1);
      sum += u;
    }
    expect(Math.abs(sum / 100_000 - 0.5)).toBeLessThan(0.01);
  });
});

describe('pickIndex', () => {
  it('spreads evenly over n buckets', () => {
    const n = 14;
    const buckets = new Array(n).fill(0);
    for (let i = 0; i < 140_000; i++) buckets[pickIndex(hash3(i, 7, 3), n)]++;
    for (const b of buckets) expect(Math.abs(b - 10_000)).toBeLessThan(1_000);
  });
});

describe('seedFromId', () => {
  it('gives stable non-negative 30-bit seeds', () => {
    expect(seedFromId('manhattan')).toBe(46164787);
    expect(seedFromId('national-mall')).toBe(229345312);
    expect(seedFromId('open-field')).toBeLessThan(2 ** 30);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/crowd/hash.test.ts`
Expected: FAIL, cannot resolve `./hash`.

- [ ] **Step 3: Implement `src/crowd/hash.ts`**

```ts
/**
 * 32-bit integer hash of a lattice cell. Mirrored exactly in
 * src/render/shaders/hash.glsl.ts; any change here must change both
 * and the golden values in hash.test.ts.
 */
export function hash3(x: number, z: number, seed: number): number {
  let h = Math.imul(x | 0, 0x27d4eb2d) ^ Math.imul(z | 0, 0x165667b1) ^ Math.imul(seed | 0, 0x9e3779b1 | 0);
  h = Math.imul(h ^ (h >>> 15), 0x85ebca6b | 0);
  h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35 | 0);
  h ^= h >>> 16;
  return h >>> 0;
}

/** Uniform float in [0, 1) from the top 24 bits; exact in float32 so GLSL agrees. */
export const unit = (h: number): number => (h >>> 8) / 16777216;

/** Integer in [0, n) from the top 24 bits using integer math only (n <= 255). */
export const pickIndex = (h: number, n: number): number => Math.floor(((h >>> 8) * n) / 16777216);

/** FNV-1a of the place id, masked to 30 bits so `seed + stream` never overflows int32. */
export function seedFromId(id: string): number {
  let h = 0x811c9dc5;
  for (const ch of id) {
    h ^= ch.charCodeAt(0);
    h = Math.imul(h, 0x01000193);
  }
  return h & 0x3fffffff;
}

/** Independent random streams per person: hash3(i, k, seed + STREAM.x). */
export const STREAM = {
  jitterX: 0,
  jitterZ: 1,
  height: 2,
  shirt: 3,
  pants: 4,
  skin: 5,
  hair: 6,
  lod: 7,
  pick: 8,
  pose: 9,
} as const;
```

- [ ] **Step 4: Run hash tests**

Run: `npx vitest run src/crowd/hash.test.ts`
Expected: PASS (4 suites).

- [ ] **Step 5: Write `src/crowd/palettes.ts`**

```ts
// Everyday palette (approved mockup "A · Everyday mix").
export const SHIRT = ['#2f3e5c', '#3a3a3a', '#6b7a4b', '#a3542f', '#c9a227', '#4f6d8f', '#ece8de', '#8c2f39', '#5a7d7c', '#7a5c8e', '#d9822b', '#9fb3c8', '#b8b2a7', '#2e5e4e'] as const;
export const PANTS = ['#2b3445', '#1f1f22', '#4a5568', '#7b6a55', '#3b4a63', '#5b5148'] as const;
export const SKIN = ['#f1c9a5', '#e0ac83', '#c68863', '#8d5a3b', '#5c3a24'] as const;
export const HAIR = ['#1b1410', '#3b2a1e', '#6b4a2b', '#b08a5a', '#8a8a8a', '#2a2a2a'] as const;

// Highlight mode ("D · Neutral + accent", reserved for special cases).
export const NEUTRAL_SHIRT = ['#9a9893', '#b5b1a9', '#7e7c78', '#c8c3b9', '#8d8a84', '#a7a39b', '#6f6d6a'] as const;
export const NEUTRAL_PANTS = ['#5a5853', '#4a4946', '#6b6862'] as const;
export const ACCENT = '#d63c2f';

// World ("A · Warm paper").
export const GROUND = '#e3dfd7';
export const SKY = '#ebe8e2';
export const FEATURE = '#cfd6d4';
export const EDGE = '#c9c3b8';
export const SHADOW = '#d3cec4';
```

- [ ] **Step 6: Write the failing person test**

`src/crowd/person.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { personAt, POSE_COUNT } from './person';
import { HAIR, PANTS, SHIRT, SKIN } from './palettes';

describe('personAt', () => {
  it('is deterministic', () => {
    expect(personAt(3, -4, 0.63, 99)).toEqual(personAt(3, -4, 0.63, 99));
  });

  it('places the lattice center and keeps jitter within ±40% of spacing', () => {
    const s = 0.63;
    for (let i = -20; i < 20; i++) {
      const p = personAt(i, 5, s, 7);
      expect(p.cx).toBeCloseTo((i + 0.5) * s, 9);
      expect(p.cz).toBeCloseTo(5.5 * s, 9);
      expect(Math.abs(p.jx)).toBeLessThanOrEqual(0.4 * s);
      expect(Math.abs(p.jz)).toBeLessThanOrEqual(0.4 * s);
    }
  });

  it('keeps attributes in range', () => {
    for (let i = 0; i < 2000; i++) {
      const p = personAt(i, i * 3, 0.5, 1234);
      expect(p.height).toBeGreaterThanOrEqual(1.55);
      expect(p.height).toBeLessThan(1.9);
      expect(p.shirt).toBeLessThan(SHIRT.length);
      expect(p.pants).toBeLessThan(PANTS.length);
      expect(p.skin).toBeLessThan(SKIN.length);
      expect(p.hair).toBeLessThan(HAIR.length);
      expect(p.pose).toBeLessThan(POSE_COUNT);
      expect(p.lodRand).toBeLessThan(1);
      expect(p.pickRand).toBeLessThan(1);
    }
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/crowd/person.test.ts`
Expected: FAIL, cannot resolve `./person`.

- [ ] **Step 8: Implement `src/crowd/person.ts`**

```ts
import { hash3, pickIndex, STREAM, unit } from './hash';
import { HAIR, PANTS, SHIRT, SKIN } from './palettes';

export const POSE_COUNT = 4;

export interface Person {
  cx: number; // lattice center x (m)
  cz: number; // lattice center z (m)
  jx: number; // visual jitter x (m)
  jz: number; // visual jitter z (m)
  height: number; // m
  shirt: number;
  pants: number;
  skin: number;
  hair: number;
  pose: number;
  lodRand: number; // dissolve threshold shared by every LOD tier
  pickRand: number; // highlight "1 in N" threshold
}

export function personAt(i: number, k: number, spacing: number, seed: number): Person {
  const h = (stream: number) => hash3(i, k, seed + stream);
  return {
    cx: (i + 0.5) * spacing,
    cz: (k + 0.5) * spacing,
    jx: (unit(h(STREAM.jitterX)) - 0.5) * 0.8 * spacing,
    jz: (unit(h(STREAM.jitterZ)) - 0.5) * 0.8 * spacing,
    height: 1.55 + unit(h(STREAM.height)) * 0.35,
    shirt: pickIndex(h(STREAM.shirt), SHIRT.length),
    pants: pickIndex(h(STREAM.pants), PANTS.length),
    skin: pickIndex(h(STREAM.skin), SKIN.length),
    hair: pickIndex(h(STREAM.hair), HAIR.length),
    pose: pickIndex(h(STREAM.pose), POSE_COUNT),
    lodRand: unit(h(STREAM.lod)),
    pickRand: unit(h(STREAM.pick)),
  };
}
```

- [ ] **Step 9: Run all unit tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/crowd
git commit -m "feat(crowd): cell hash, palettes and per-person attributes"
```

---

### Task 3: Place model, geometry, validation, open field

**Files:**
- Create: `src/places/types.ts`, `src/places/geometry.ts`, `src/places/validate.ts`, `src/places/openField.ts`, `src/test/fixtures.ts`
- Test: `src/places/geometry.test.ts`, `src/places/validate.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces:
  - `type PlaceId = 'open-field' | 'times-square' | 'national-mall' | 'michigan-stadium' | 'manhattan'`, `PLACE_IDS: readonly PlaceId[]`
  - `type Ring = [number, number][]` (closed: first point equals last)
  - `interface Place { id: PlaceId; name: string; outer: Ring; holes: Ring[]; focus: [number, number]; areaM2: number; source: string }`
  - `ringArea(r: Ring): number` (signed), `pointInRing(p: [number, number], r: Ring): boolean`, `bbox(r: Ring): BBox`, `ringSelfIntersects(r: Ring): boolean`, `interface BBox { minX; minZ; maxX; maxZ }`
  - `validatePlace(p: Place): string[]` (empty = valid)
  - `makeOpenField(): Place`
  - test helper `squarePlace(half: number, hole?: number): Place`

- [ ] **Step 1: Write `src/places/types.ts`**

```ts
export const PLACE_IDS = ['open-field', 'times-square', 'national-mall', 'michigan-stadium', 'manhattan'] as const;
export type PlaceId = (typeof PLACE_IDS)[number];

/** Closed ring of [x, z] meters; first point equals last point. */
export type Ring = [number, number][];

export interface Place {
  id: PlaceId;
  name: string;
  outer: Ring;
  holes: Ring[];
  /** Always [0, 0]: coordinates are relative to the focus. */
  focus: [number, number];
  areaM2: number;
  source: string;
}
```

- [ ] **Step 2: Write the failing geometry tests**

`src/places/geometry.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { bbox, pointInRing, ringArea, ringSelfIntersects } from './geometry';
import type { Ring } from './types';

const square: Ring = [[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]];
const bowtie: Ring = [[0, 0], [10, 10], [10, 0], [0, 10], [0, 0]];

describe('geometry', () => {
  it('computes area', () => expect(Math.abs(ringArea(square))).toBe(100));
  it('tests points', () => {
    expect(pointInRing([5, 5], square)).toBe(true);
    expect(pointInRing([15, 5], square)).toBe(false);
  });
  it('computes bbox', () => expect(bbox(square)).toEqual({ minX: 0, minZ: 0, maxX: 10, maxZ: 10 }));
  it('detects self-intersection', () => {
    expect(ringSelfIntersects(square)).toBe(false);
    expect(ringSelfIntersects(bowtie)).toBe(true);
  });
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx vitest run src/places/geometry.test.ts`
Expected: FAIL, cannot resolve `./geometry`.

- [ ] **Step 4: Implement `src/places/geometry.ts`**

```ts
import type { Ring } from './types';

export interface BBox { minX: number; minZ: number; maxX: number; maxZ: number; }

/** Signed shoelace area of a closed ring. */
export function ringArea(r: Ring): number {
  let s = 0;
  for (let i = 0; i < r.length - 1; i++) s += r[i][0] * r[i + 1][1] - r[i + 1][0] * r[i][1];
  return s / 2;
}

/** Even-odd point-in-polygon test. */
export function pointInRing([x, z]: [number, number], r: Ring): boolean {
  let inside = false;
  for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
    const [xi, zi] = r[i];
    const [xj, zj] = r[j];
    if (zi > z !== zj > z && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) inside = !inside;
  }
  return inside;
}

export function bbox(r: Ring): BBox {
  const b = { minX: Infinity, minZ: Infinity, maxX: -Infinity, maxZ: -Infinity };
  for (const [x, z] of r) {
    b.minX = Math.min(b.minX, x); b.maxX = Math.max(b.maxX, x);
    b.minZ = Math.min(b.minZ, z); b.maxZ = Math.max(b.maxZ, z);
  }
  return b;
}

const orient = (a: [number, number], b: [number, number], c: [number, number]) =>
  Math.sign((b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]));

function segmentsCross(a: [number, number], b: [number, number], c: [number, number], d: [number, number]): boolean {
  const o1 = orient(a, b, c), o2 = orient(a, b, d), o3 = orient(c, d, a), o4 = orient(c, d, b);
  return o1 * o2 < 0 && o3 * o4 < 0;
}

/** True if any two non-adjacent edges properly cross. O(n²), fine for ≤ a few thousand points. */
export function ringSelfIntersects(r: Ring): boolean {
  const n = r.length - 1; // number of edges
  for (let i = 0; i < n; i++) {
    for (let j = i + 2; j < n; j++) {
      if (i === 0 && j === n - 1) continue; // first and last edge share the closing point
      if (segmentsCross(r[i], r[i + 1], r[j], r[j + 1])) return true;
    }
  }
  return false;
}
```

- [ ] **Step 5: Run geometry tests**

Run: `npx vitest run src/places/geometry.test.ts`
Expected: PASS.

- [ ] **Step 6: Write the test fixture and failing validation tests**

`src/test/fixtures.ts`:
```ts
import { ringArea } from '../places/geometry';
import type { Place, Ring } from '../places/types';

const sq = (h: number, cx = 0, cz = 0): Ring => [
  [cx - h, cz - h], [cx + h, cz - h], [cx + h, cz + h], [cx - h, cz + h], [cx - h, cz - h],
];

/** Square place of side 2*half centered on the focus, optional centered square hole of side 2*hole. */
export function squarePlace(half: number, hole?: number): Place {
  const outer = sq(half);
  const holes = hole ? [sq(hole)] : [];
  const areaM2 = Math.abs(ringArea(outer)) - holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);
  return { id: 'open-field', name: 'Test square', outer, holes, focus: [0, 0], areaM2, source: 'test' };
}
```

`src/places/validate.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { validatePlace } from './validate';
import { makeOpenField } from './openField';
import { squarePlace } from '../test/fixtures';

describe('validatePlace', () => {
  it('accepts a square with a hole', () => expect(validatePlace(squarePlace(100, 10))).toEqual([]));

  it('rejects an open ring', () => {
    const p = squarePlace(100);
    p.outer = p.outer.slice(0, -1);
    expect(validatePlace(p).join()).toMatch(/not closed/);
  });

  it('rejects a hole outside the outer ring', () => {
    const p = squarePlace(100);
    p.holes = [[[200, 200], [210, 200], [210, 210], [200, 210], [200, 200]]];
    p.areaM2 -= 100;
    expect(validatePlace(p).join()).toMatch(/not inside outer/);
  });

  it('rejects a wrong areaM2', () => {
    const p = squarePlace(100);
    p.areaM2 = 1;
    expect(validatePlace(p).join()).toMatch(/areaM2/);
  });

  it('rejects a non-zero focus', () => {
    const p = squarePlace(100);
    p.focus = [1, 0];
    expect(validatePlace(p).join()).toMatch(/focus/);
  });
});

describe('makeOpenField', () => {
  it('is valid and holds 50M people at 1/m²', () => {
    const f = makeOpenField();
    expect(validatePlace(f)).toEqual([]);
    expect(f.areaM2).toBeGreaterThan(50_000_000);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/places/validate.test.ts`
Expected: FAIL, cannot resolve `./validate`.

- [ ] **Step 8: Implement `src/places/validate.ts` and `src/places/openField.ts`**

`src/places/validate.ts`:
```ts
import { pointInRing, ringArea, ringSelfIntersects } from './geometry';
import type { Place, Ring } from './types';

export function validatePlace(p: Place): string[] {
  const errs: string[] = [];
  const checkRing = (r: Ring, label: string) => {
    if (r.length < 4) errs.push(`${label}: fewer than 4 points`);
    const a = r[0], b = r[r.length - 1];
    if (!a || !b || a[0] !== b[0] || a[1] !== b[1]) errs.push(`${label}: not closed`);
    else if (ringSelfIntersects(r)) errs.push(`${label}: self-intersects`);
  };
  checkRing(p.outer, 'outer');
  p.holes.forEach((h, i) => {
    checkRing(h, `hole ${i}`);
    if (!h.every((pt) => pointInRing(pt, p.outer))) errs.push(`hole ${i}: not inside outer`);
  });
  if (p.focus[0] !== 0 || p.focus[1] !== 0) errs.push('focus must be [0, 0] (coordinates are relative to the focus)');
  const area = Math.abs(ringArea(p.outer)) - p.holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);
  if (Math.abs(area - p.areaM2) > area * 0.01) errs.push(`areaM2 ${p.areaM2} differs from computed ${Math.round(area)}`);
  return errs;
}
```

`src/places/openField.ts`:
```ts
import { ringArea } from './geometry';
import type { Place, Ring } from './types';

const RADIUS = 4050; // m; 128-gon area ≈ 51.5 km², room for 50M at 1/m²
const SIDES = 128;

export function makeOpenField(): Place {
  const outer: Ring = [];
  for (let i = 0; i <= SIDES; i++) {
    const a = ((i % SIDES) / SIDES) * Math.PI * 2;
    outer.push([Math.round(RADIUS * Math.cos(a) * 100) / 100, Math.round(RADIUS * Math.sin(a) * 100) / 100]);
  }
  return {
    id: 'open-field',
    name: 'Open field',
    outer,
    holes: [],
    focus: [0, 0],
    areaM2: Math.round(Math.abs(ringArea(outer))),
    source: `Generated ${SIDES}-gon, radius ${RADIUS} m`,
  };
}
```

- [ ] **Step 9: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 10: Commit**

```bash
git add src/places src/test
git commit -m "feat(places): place model, geometry, validation, open field"
```

---

### Task 4: Extract the four real places from OpenStreetMap

**Files:**
- Create: `scripts/geo.ts`, `scripts/place-recipes.ts`, `scripts/extract-place.ts`, `scripts/preview-places.ts`, `src/places/index.ts`, `src/places/data/{times-square,national-mall,michigan-stadium,manhattan}.json`, `docs/place-previews/*.svg`
- Test: `scripts/geo.test.ts`, `src/places/places.test.ts`

**Interfaces:**
- Consumes: `Place`, `Ring`, `PlaceId` (Task 3), `ringArea` (Task 3), `validatePlace` (Task 3), `makeOpenField` (Task 3).
- Produces: `PLACES: Place[]` in display order (Open field, Times Square, National Mall, Michigan Stadium, Manhattan), `getPlace(id: PlaceId): Place`.

OSM ids were confirmed with Nominatim on 2026-10-11 (Overpass was unavailable that day; Nominatim `lookup` returns full polygons):

| Place | Outer | Extra | Holes | Focus (lat, lon) |
|---|---|---|---|---|
| Times Square | W702540318 (place=square, ≈6,400 m²) | | | centroid |
| National Mall | W1558212097 National Mall, W1552426509 Washington Monument Grounds, R21050367 Constitution Gardens, W1332068226 Lincoln Memorial | corridor: bbox of W990979896 Reflecting Pool padded 45 m north/south (elm walks) | W990979896 Reflecting Pool, R359559 Constitution Gardens Pond, W24238580 Capitol Reflecting Pool | 38.8898, -77.0115 (Capitol west front) |
| Michigan Stadium | R1637002 outer ring only (stands + field as flat standing area) | | | centroid |
| Manhattan | R3954665 Manhattan Island, largest polygon, keep its own holes (lakes, reservoir) | | | 40.7644, -73.9730 (Central Park south edge) |

- [ ] **Step 1: Write the failing geo tests**

`scripts/geo.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { projector, simplify } from './geo';

describe('projector', () => {
  it('maps the focus to the origin and north to -z', () => {
    const p = projector(38.89, -77.01);
    const [x0, z0] = p([-77.01, 38.89]);
    expect(x0).toBeCloseTo(0, 9);
    expect(z0).toBeCloseTo(0, 9);
    const [x, z] = p([-77.01, 38.891]);
    expect(x).toBeCloseTo(0, 6);
    expect(z).toBeCloseTo(-110.54, 1);
  });
});

describe('simplify', () => {
  it('drops collinear points and keeps the ring closed', () => {
    const ring: [number, number][] = [[0, 0], [5, 0], [10, 0], [10, 5], [10, 10], [0, 10], [0, 0]];
    const out = simplify(ring, 0.1);
    expect(out).toEqual([[0, 0], [10, 0], [10, 10], [0, 10], [0, 0]]);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run scripts/geo.test.ts`
Expected: FAIL, cannot resolve `./geo`.

- [ ] **Step 3: Implement `scripts/geo.ts`**

```ts
export type LonLat = [number, number];
type Pt = [number, number];

/** Equirectangular projection to local meters around the focus; +x east, +z south. */
export function projector(focusLat: number, focusLon: number) {
  const kx = 111320 * Math.cos((focusLat * Math.PI) / 180);
  const kz = 110540;
  return ([lon, lat]: LonLat): Pt => [(lon - focusLon) * kx, -(lat - focusLat) * kz];
}

function segDist(p: Pt, a: Pt, b: Pt): number {
  const dx = b[0] - a[0], dz = b[1] - a[1];
  const len2 = dx * dx + dz * dz;
  const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((p[0] - a[0]) * dx + (p[1] - a[1]) * dz) / len2));
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dz));
}

function dpOpen(pts: Pt[], tol: number): Pt[] {
  if (pts.length <= 2) return pts.slice();
  let maxD = 0, idx = 0;
  for (let i = 1; i < pts.length - 1; i++) {
    const d = segDist(pts[i], pts[0], pts[pts.length - 1]);
    if (d > maxD) { maxD = d; idx = i; }
  }
  if (maxD <= tol) return [pts[0], pts[pts.length - 1]];
  const left = dpOpen(pts.slice(0, idx + 1), tol);
  return left.slice(0, -1).concat(dpOpen(pts.slice(idx), tol));
}

/** Douglas-Peucker for a closed ring: split at the point farthest from the start. */
export function simplify(ring: Pt[], tol: number): Pt[] {
  const open = ring.slice(0, -1);
  let far = 0, farD = -1;
  for (let i = 1; i < open.length; i++) {
    const d = Math.hypot(open[i][0] - open[0][0], open[i][1] - open[0][1]);
    if (d > farD) { farD = d; far = i; }
  }
  const a = dpOpen(open.slice(0, far + 1), tol);
  const b = dpOpen(open.slice(far).concat([open[0]]), tol);
  return a.slice(0, -1).concat(b);
}
```

- [ ] **Step 4: Run geo tests**

Run: `npx vitest run scripts/geo.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `scripts/place-recipes.ts`**

```ts
import type { PlaceId } from '../src/places/types';

export interface Recipe {
  id: Exclude<PlaceId, 'open-field'>;
  name: string;
  /** [lat, lon], or the bbox center of the first outer feature. */
  focus: [number, number] | 'centroid';
  outer: string[];
  /** Keep the inner rings of outer features as holes (Manhattan lakes). */
  keepOwnHoles?: boolean;
  /** Add the bbox of a feature, padded north/south, to the outer union. */
  corridor?: { around: string; padNS: number };
  holes: string[];
  /** Douglas-Peucker tolerance in meters. */
  tolerance: number;
}

export const RECIPES: Recipe[] = [
  { id: 'times-square', name: 'Times Square', focus: 'centroid', outer: ['W702540318'], holes: [], tolerance: 0.3 },
  {
    id: 'national-mall',
    name: 'National Mall',
    focus: [38.8898, -77.0115],
    outer: ['W1558212097', 'W1552426509', 'R21050367', 'W1332068226'],
    corridor: { around: 'W990979896', padNS: 45 },
    holes: ['W990979896', 'R359559', 'W24238580'],
    tolerance: 0.5,
  },
  { id: 'michigan-stadium', name: 'Michigan Stadium', focus: 'centroid', outer: ['R1637002'], holes: [], tolerance: 0.3 },
  { id: 'manhattan', name: 'Manhattan', focus: [40.7644, -73.973], outer: ['R3954665'], keepOwnHoles: true, holes: [], tolerance: 4 },
];
```

- [ ] **Step 6: Write `scripts/extract-place.ts`**

```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import polygonClipping, { type MultiPolygon, type Polygon } from 'polygon-clipping';
import { RECIPES, type Recipe } from './place-recipes';
import { projector, simplify, type LonLat } from './geo';
import { ringArea } from '../src/places/geometry';
import { validatePlace } from '../src/places/validate';
import type { Place, Ring } from '../src/places/types';

const UA = 'visualizing-crowds/0.1 (https://github.com/weeeha/Visualizing-Crowds)';
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
const round2 = ([x, z]: [number, number]): [number, number] => [Math.round(x * 100) / 100, Math.round(z * 100) / 100];

async function fetchPolygons(osmId: string): Promise<LonLat[][][]> {
  const url = `https://nominatim.openstreetmap.org/lookup?format=jsonv2&polygon_geojson=1&osm_ids=${osmId}`;
  const res = await fetch(url, { headers: { 'User-Agent': UA } });
  if (!res.ok) throw new Error(`${osmId}: HTTP ${res.status}`);
  const hits = (await res.json()) as { geojson: { type: string; coordinates: unknown } }[];
  await sleep(1100); // Nominatim policy: at most 1 request per second
  if (!hits[0]) throw new Error(`${osmId}: not found`);
  const g = hits[0].geojson;
  if (g.type === 'Polygon') return [g.coordinates as LonLat[][]];
  if (g.type === 'MultiPolygon') return g.coordinates as LonLat[][][];
  throw new Error(`${osmId}: unsupported geometry ${g.type}`);
}

function bboxCenter(polys: LonLat[][][]): [number, number] {
  let minLon = Infinity, maxLon = -Infinity, minLat = Infinity, maxLat = -Infinity;
  for (const p of polys) for (const [lon, lat] of p[0]) {
    minLon = Math.min(minLon, lon); maxLon = Math.max(maxLon, lon);
    minLat = Math.min(minLat, lat); maxLat = Math.max(maxLat, lat);
  }
  return [(minLat + maxLat) / 2, (minLon + maxLon) / 2];
}

const polyArea = (p: Polygon) => Math.abs(ringArea(p[0] as Ring));
const largest = (mp: MultiPolygon): Polygon => mp.reduce((a, b) => (polyArea(b) > polyArea(a) ? b : a));

async function extract(r: Recipe): Promise<Place> {
  const outerFeatures: LonLat[][][][] = [];
  for (const id of r.outer) outerFeatures.push(await fetchPolygons(id));
  const [lat, lon] = r.focus === 'centroid' ? bboxCenter(outerFeatures[0]) : r.focus;
  const proj = projector(lat, lon);

  const outerGeoms: Polygon[] = outerFeatures.flatMap((f) =>
    f.map((poly) => (r.keepOwnHoles ? poly : poly.slice(0, 1)).map((ring) => ring.map(proj))),
  );
  if (r.corridor) {
    const pts = (await fetchPolygons(r.corridor.around)).flatMap((p) => p[0].map(proj));
    const xs = pts.map((p) => p[0]), zs = pts.map((p) => p[1]);
    const [x0, x1] = [Math.min(...xs), Math.max(...xs)];
    const [z0, z1] = [Math.min(...zs) - r.corridor.padNS, Math.max(...zs) + r.corridor.padNS];
    outerGeoms.push([[[x0, z0], [x1, z0], [x1, z1], [x0, z1], [x0, z0]]]);
  }

  const union = polygonClipping.union(outerGeoms[0], ...outerGeoms.slice(1));
  if (union.length > 1) {
    console.warn(`${r.id}: union has ${union.length} parts (m²: ${union.map((p) => Math.round(polyArea(p))).join(', ')}); keeping the largest`);
  }
  let shape: MultiPolygon = [largest(union)];
  if (r.holes.length) {
    const holeGeoms: Polygon[] = [];
    for (const id of r.holes) for (const p of await fetchPolygons(id)) holeGeoms.push([p[0].map(proj)]);
    shape = polygonClipping.difference(shape, ...holeGeoms);
  }

  const [outerRaw, ...holesRaw] = largest(shape);
  const outer = simplify(outerRaw as Ring, r.tolerance).map(round2);
  const holes = holesRaw
    .map((h) => simplify(h as Ring, r.tolerance).map(round2))
    .filter((h) => h.length >= 4 && Math.abs(ringArea(h)) >= 20);
  const areaM2 = Math.abs(ringArea(outer)) - holes.reduce((s, h) => s + Math.abs(ringArea(h)), 0);
  const ids = [...r.outer, ...(r.corridor ? [r.corridor.around] : []), ...r.holes];

  const place: Place = {
    id: r.id,
    name: r.name,
    outer,
    holes,
    focus: [0, 0],
    areaM2: Math.round(areaM2),
    source: `OpenStreetMap ${ids.join(', ')} via Nominatim (ODbL), focus ${lat.toFixed(5)}, ${lon.toFixed(5)}, extracted ${new Date().toISOString().slice(0, 10)}`,
  };
  const errors = validatePlace(place);
  if (errors.length) throw new Error(`${r.id} failed validation:\n  ${errors.join('\n  ')}\nTry a smaller tolerance.`);
  return place;
}

const wanted = process.argv.slice(2);
mkdirSync('src/places/data', { recursive: true });
for (const r of RECIPES.filter((x) => wanted.length === 0 || wanted.includes(x.id))) {
  const place = await extract(r);
  writeFileSync(`src/places/data/${r.id}.json`, JSON.stringify(place) + '\n');
  console.log(`${r.id}: ${place.outer.length} outer pts, ${place.holes.length} holes, ${Math.round(place.areaM2).toLocaleString()} m²`);
}
```

- [ ] **Step 7: Run the extraction**

Run: `npm run places`
Expected: four lines like `times-square: 40 outer pts, 0 holes, 6,389 m²`. If one fails validation, lower its `tolerance` in `place-recipes.ts` and rerun just that id (`npm run places -- national-mall`). If the National Mall union warns about several parts, note the part areas and continue; Step 10 decides whether the gap matters.

- [ ] **Step 8: Write `src/places/index.ts` and the failing data test**

`src/places/index.ts`:
```ts
import { makeOpenField } from './openField';
import { validatePlace } from './validate';
import type { Place, PlaceId } from './types';
import timesSquare from './data/times-square.json';
import nationalMall from './data/national-mall.json';
import michiganStadium from './data/michigan-stadium.json';
import manhattan from './data/manhattan.json';

const ALL: Place[] = [
  makeOpenField(),
  timesSquare as unknown as Place,
  nationalMall as unknown as Place,
  michiganStadium as unknown as Place,
  manhattan as unknown as Place,
];

/** Places that fail validation are left out of the chip list (spec: error handling). */
export const PLACES: Place[] = ALL.filter((p) => {
  const errs = validatePlace(p);
  if (errs.length) console.error(`Place ${p.id} skipped:`, errs);
  return errs.length === 0;
});

export function getPlace(id: PlaceId): Place {
  const p = PLACES.find((x) => x.id === id);
  if (!p) throw new Error(`Unknown place ${id}`);
  return p;
}
```

`src/places/places.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { PLACES } from './index';
import { validatePlace } from './validate';

const AREA_RANGES: Record<string, [number, number]> = {
  'open-field': [50e6, 53e6],
  'times-square': [4_000, 9_000],
  'national-mall': [800_000, 2_000_000],
  'michigan-stadium': [35_000, 60_000],
  manhattan: [50e6, 58e6],
};

describe('committed places', () => {
  it('lists the five v1 places in order', () => {
    expect(PLACES.map((p) => p.id)).toEqual(['open-field', 'times-square', 'national-mall', 'michigan-stadium', 'manhattan']);
  });
  for (const p of PLACES) {
    it(`${p.id} is valid`, () => expect(validatePlace(p)).toEqual([]));
    it(`${p.id} has a plausible area`, () => {
      const [lo, hi] = AREA_RANGES[p.id];
      expect(p.areaM2).toBeGreaterThanOrEqual(lo);
      expect(p.areaM2).toBeLessThanOrEqual(hi);
    });
  }
  it('national mall has its water features as holes', () => {
    expect(PLACES.find((p) => p.id === 'national-mall')!.holes.length).toBeGreaterThanOrEqual(2);
  });
});
```

- [ ] **Step 9: Run tests**

Run: `npm test`
Expected: PASS. If an area range fails, open the SVG preview (next step) before touching the range; a wrong area usually means a wrong outline.

- [ ] **Step 10: Generate previews and hand-check against the map**

`scripts/preview-places.ts`:
```ts
import { mkdirSync, writeFileSync } from 'node:fs';
import { PLACES } from '../src/places/index';
import { bbox } from '../src/places/geometry';

mkdirSync('docs/place-previews', { recursive: true });
for (const p of PLACES) {
  const b = bbox(p.outer);
  const pad = Math.max(b.maxX - b.minX, b.maxZ - b.minZ) * 0.05;
  const vb = [b.minX - pad, b.minZ - pad, b.maxX - b.minX + 2 * pad, b.maxZ - b.minZ + 2 * pad].join(' ');
  const path = (r: [number, number][]) => 'M' + r.map(([x, z]) => `${x},${z}`).join('L') + 'Z';
  const sw = (b.maxX - b.minX) / 400;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="800">
<path d="${[p.outer, ...p.holes].map(path).join(' ')}" fill="#e3dfd7" fill-rule="evenodd" stroke="#2b2925" stroke-width="${sw}"/>
<circle cx="0" cy="0" r="${sw * 6}" fill="#d63c2f"/>
<text x="${b.minX}" y="${b.minZ - pad / 3}" font-size="${sw * 14}">${p.name} · ${Math.round(p.areaM2).toLocaleString()} m² · red dot = focus</text>
</svg>`;
  writeFileSync(`docs/place-previews/${p.id}.svg`, svg);
}
console.log('wrote docs/place-previews/*.svg');
```

Run: `npm run places:preview`, then open each SVG in the browser next to https://www.openstreetmap.org (satellite: any imagery layer). Check:
- Times Square: the bowtie of plazas between the building lines around 42nd–47th St.
- National Mall: one connected shape from the Capitol end to the Lincoln Memorial; Reflecting Pool, Constitution Gardens Pond and Capitol Reflecting Pool are holes; red dot at the Capitol west front (just east of the shape is fine).
- Michigan Stadium: full bowl footprint, no hole.
- Manhattan: island outline, Central Park lakes/reservoir as holes, red dot at the park's south edge.

If the National Mall has a visible gap (two parts warned in Step 7), increase `padNS` or add the missing park's OSM id to `outer`, rerun Step 7 and re-check.

- [ ] **Step 11: Commit**

```bash
git add scripts src/places docs/place-previews
git commit -m "feat(places): extract Times Square, National Mall, Michigan Stadium, Manhattan from OSM"
```

---

### Task 5: Rasterized usable area and fill radius

**Files:**
- Create: `src/layout/raster.ts`, `src/layout/fillRadius.ts`, `src/layout/occupancy.ts`
- Test: `src/layout/raster.test.ts`, `src/layout/fillRadius.test.ts`

**Interfaces:**
- Consumes: `Place` (Task 3), `bbox` (Task 3), `PLACES` (Task 4), `squarePlace` (Task 3).
- Produces:
  - `interface Raster { x0; z0; cell; w; h; mask: Uint8Array; usableArea }` (mask 1 = usable, row-major, row = z)
  - `cellSizeFor(maxDim: number): number`, `rasterize(place: Place): Raster`, `usableAt(r: Raster, x: number, z: number): boolean`, `rasterBounds(r: Raster): { minX; minZ; maxX; maxZ }`
  - `spacingFor(density: number): number` (= 1/√density)
  - `interface CountProfile { spacing; exactBin; exactCum: Float64Array; exactMaxR; coarseBin; coarseCum: Float64Array; maxDist; totalArea; density }`
  - `buildCountProfile(r: Raster, density: number, exactLimit?: number): CountProfile`
  - `interface FillResult { radius: number; overflow: boolean; capacity: number }`
  - `fillRadius(p: CountProfile, count: number): FillResult`
  - `countOccupied(r: Raster, spacing: number, radius: number): number` (reference counter)
- Occupancy rule (used everywhere, CPU and GPU): person at lattice `(i, k)` with center `((i+0.5)s, (k+0.5)s)` is present iff `usableAt(center)` and `|center| < radius`.

- [ ] **Step 1: Write the failing raster tests**

`src/layout/raster.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { rasterize, usableAt } from './raster';
import { squarePlace } from '../test/fixtures';

describe('rasterize', () => {
  it('measures a 200 m square within 1%', () => {
    const r = rasterize(squarePlace(100));
    expect(Math.abs(r.usableArea - 40_000) / 40_000).toBeLessThan(0.01);
  });

  it('subtracts holes', () => {
    const r = rasterize(squarePlace(100, 10));
    expect(Math.abs(r.usableArea - 39_600) / 39_600).toBeLessThan(0.01);
    expect(usableAt(r, 0, 0)).toBe(false);
    expect(usableAt(r, 50, 50)).toBe(true);
    expect(usableAt(r, 500, 0)).toBe(false);
  });

  it('keeps textures within 2048 texels', () => {
    const r = rasterize(squarePlace(10_000));
    expect(Math.max(r.w, r.h)).toBeLessThanOrEqual(2048);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/layout/raster.test.ts`
Expected: FAIL, cannot resolve `./raster`.

- [ ] **Step 3: Implement `src/layout/raster.ts`**

```ts
import { bbox } from '../places/geometry';
import type { Place } from '../places/types';

export interface Raster {
  x0: number; // world x of column 0's left edge
  z0: number; // world z of row 0's top edge
  cell: number; // m per texel
  w: number;
  h: number;
  mask: Uint8Array; // 1 = usable (inside outer, outside holes)
  usableArea: number; // m²
}

/** Texel size so the mask stays ≤ 2048 on its long side, never finer than 0.5 m. */
export const cellSizeFor = (maxDim: number): number => Math.max(0.5, maxDim / 2040);

/** Scanline even-odd fill over outer + holes, sampling texel centers. */
export function rasterize(place: Place): Raster {
  const b = bbox(place.outer);
  const cell = cellSizeFor(Math.max(b.maxX - b.minX, b.maxZ - b.minZ));
  const x0 = b.minX - cell;
  const z0 = b.minZ - cell;
  const w = Math.ceil((b.maxX - x0) / cell) + 1;
  const h = Math.ceil((b.maxZ - z0) / cell) + 1;
  const mask = new Uint8Array(w * h);
  const rings = [place.outer, ...place.holes];
  const xs: number[] = [];
  let usable = 0;
  for (let row = 0; row < h; row++) {
    const z = z0 + (row + 0.5) * cell;
    xs.length = 0;
    for (const r of rings) {
      for (let i = 0; i < r.length - 1; i++) {
        const [ax, az] = r[i];
        const [bx, bz] = r[i + 1];
        if ((az <= z && bz > z) || (bz <= z && az > z)) xs.push(ax + ((z - az) / (bz - az)) * (bx - ax));
      }
    }
    xs.sort((a, c) => a - c);
    for (let j = 0; j + 1 < xs.length; j += 2) {
      const c0 = Math.max(0, Math.ceil((xs[j] - x0) / cell - 0.5));
      const c1 = Math.min(w, Math.ceil((xs[j + 1] - x0) / cell - 0.5));
      for (let c = c0; c < c1; c++) {
        mask[row * w + c] = 1;
        usable++;
      }
    }
  }
  return { x0, z0, cell, w, h, mask, usableArea: usable * cell * cell };
}

export function usableAt(r: Raster, x: number, z: number): boolean {
  const c = Math.floor((x - r.x0) / r.cell);
  const row = Math.floor((z - r.z0) / r.cell);
  if (c < 0 || row < 0 || c >= r.w || row >= r.h) return false;
  return r.mask[row * r.w + c] === 1;
}

export const rasterBounds = (r: Raster) => ({
  minX: r.x0,
  minZ: r.z0,
  maxX: r.x0 + r.w * r.cell,
  maxZ: r.z0 + r.h * r.cell,
});
```

- [ ] **Step 4: Run raster tests**

Run: `npx vitest run src/layout/raster.test.ts`
Expected: PASS.

- [ ] **Step 5: Write `src/layout/occupancy.ts` (reference counter used by tests)**

```ts
import { rasterBounds, usableAt, type Raster } from './raster';

/** Brute-force count of people present at this radius. Slow; for tests and checks only. */
export function countOccupied(r: Raster, spacing: number, radius: number): number {
  const b = rasterBounds(r);
  const iMin = Math.floor(Math.max(-radius, b.minX) / spacing) - 1;
  const iMax = Math.ceil(Math.min(radius, b.maxX) / spacing) + 1;
  const kMin = Math.floor(Math.max(-radius, b.minZ) / spacing) - 1;
  const kMax = Math.ceil(Math.min(radius, b.maxZ) / spacing) + 1;
  let n = 0;
  for (let k = kMin; k <= kMax; k++) {
    const cz = (k + 0.5) * spacing;
    for (let i = iMin; i <= iMax; i++) {
      const cx = (i + 0.5) * spacing;
      if (Math.hypot(cx, cz) < radius && usableAt(r, cx, cz)) n++;
    }
  }
  return n;
}
```

- [ ] **Step 6: Write the failing fill-radius tests**

`src/layout/fillRadius.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildCountProfile, fillRadius, spacingFor } from './fillRadius';
import { countOccupied } from './occupancy';
import { rasterize } from './raster';
import { PLACES } from '../places/index';
import { squarePlace } from '../test/fixtures';

const within2pct = (actual: number, expected: number) => expect(Math.abs(actual - expected) / expected).toBeLessThan(0.02);

describe('fillRadius on real places', () => {
  for (const place of PLACES) {
    const raster = rasterize(place);
    const profile = buildCountProfile(raster, 2.5);
    for (const count of [1_000, 100_000, 1_000_000]) {
      it(`${place.id} @ ${count.toLocaleString()} puts the right number of people down`, () => {
        const res = fillRadius(profile, count);
        const placed = countOccupied(raster, spacingFor(2.5), res.radius);
        if (count > res.capacity) {
          expect(res.overflow).toBe(true);
          within2pct(placed, res.capacity);
        } else {
          expect(res.overflow).toBe(false);
          within2pct(placed, count);
        }
      });
    }
  }

  it('open field @ 5M uses the area estimate and stays within 2%', () => {
    const open = PLACES[0];
    const raster = rasterize(open);
    const res = fillRadius(buildCountProfile(raster, 2.5), 5_000_000);
    within2pct(countOccupied(raster, spacingFor(2.5), res.radius), 5_000_000);
  });
});

describe('overflow boundary', () => {
  const raster = rasterize(squarePlace(50));
  const profile = buildCountProfile(raster, 1);

  it('count exactly at capacity is not overflow', () => {
    const cap = fillRadius(profile, 50).capacity;
    expect(fillRadius(profile, cap).overflow).toBe(false);
    expect(fillRadius(profile, cap + 1).overflow).toBe(true);
  });

  it('capacity equals the exact lattice count for small places', () => {
    const cap = fillRadius(profile, 50).capacity;
    expect(cap).toBe(countOccupied(raster, 1, 1e9));
  });

  it('radius grows with count', () => {
    expect(fillRadius(profile, 500).radius).toBeLessThan(fillRadius(profile, 5000).radius);
  });
});
```

- [ ] **Step 7: Run to verify it fails**

Run: `npx vitest run src/layout/fillRadius.test.ts`
Expected: FAIL, cannot resolve `./fillRadius`.

- [ ] **Step 8: Implement `src/layout/fillRadius.ts`**

```ts
import { rasterBounds, usableAt, type Raster } from './raster';

export const spacingFor = (density: number): number => 1 / Math.sqrt(density);

export interface CountProfile {
  spacing: number;
  density: number;
  /** Exact lattice counts by distance, 1 cm bins, up to exactMaxR. */
  exactBin: number;
  exactCum: Float64Array;
  exactMaxR: number;
  /** Area by texel-center distance, texel-sized bins, for counts beyond exactMaxR. */
  coarseBin: number;
  coarseCum: Float64Array;
  maxDist: number;
  totalArea: number;
}

export interface FillResult { radius: number; overflow: boolean; capacity: number; }

const EXACT_BIN = 0.01;

function cumulative(bins: Float64Array): Float64Array {
  const c = new Float64Array(bins.length + 1);
  for (let i = 0; i < bins.length; i++) c[i + 1] = c[i] + bins[i];
  return c;
}

function interp(cum: Float64Array, bin: number, r: number): number {
  const t = r / bin;
  const i = Math.floor(t);
  if (i >= cum.length - 1) return cum[cum.length - 1];
  return cum[i] + (cum[i + 1] - cum[i]) * (t - i);
}

const coarseArea = (p: Pick<CountProfile, 'coarseCum' | 'coarseBin'>, r: number) => interp(p.coarseCum, p.coarseBin, r);

/**
 * Counts people exactly (lattice points) out to the radius holding ~exactLimit people,
 * and estimates by area beyond that, where edge effects are a tiny fraction of the total.
 */
export function buildCountProfile(raster: Raster, density: number, exactLimit = 2_000_000): CountProfile {
  const spacing = spacingFor(density);
  const b = rasterBounds(raster);
  const maxDist = Math.hypot(Math.max(Math.abs(b.minX), Math.abs(b.maxX)), Math.max(Math.abs(b.minZ), Math.abs(b.maxZ)));

  const coarseBin = raster.cell;
  const coarse = new Float64Array(Math.ceil(maxDist / coarseBin) + 1);
  const cellArea = raster.cell * raster.cell;
  for (let row = 0; row < raster.h; row++) {
    const z = raster.z0 + (row + 0.5) * raster.cell;
    for (let c = 0; c < raster.w; c++) {
      if (raster.mask[row * raster.w + c] !== 1) continue;
      const x = raster.x0 + (c + 0.5) * raster.cell;
      coarse[Math.floor(Math.hypot(x, z) / coarseBin)] += cellArea;
    }
  }
  const coarseCum = cumulative(coarse);
  const totalArea = raster.usableArea;

  // Radius that holds ~10% more than exactLimit by area estimate.
  const targetArea = Math.min(totalArea, (exactLimit * 1.1) / density);
  let lo = 0, hi = maxDist;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (coarseArea({ coarseCum, coarseBin }, mid) < targetArea) lo = mid; else hi = mid;
  }
  const exactMaxR = targetArea >= totalArea ? maxDist : hi;

  const exact = new Float64Array(Math.ceil(exactMaxR / EXACT_BIN) + 1);
  const iMin = Math.floor(Math.max(-exactMaxR, b.minX) / spacing) - 1;
  const iMax = Math.ceil(Math.min(exactMaxR, b.maxX) / spacing) + 1;
  const kMin = Math.floor(Math.max(-exactMaxR, b.minZ) / spacing) - 1;
  const kMax = Math.ceil(Math.min(exactMaxR, b.maxZ) / spacing) + 1;
  for (let k = kMin; k <= kMax; k++) {
    const cz = (k + 0.5) * spacing;
    for (let i = iMin; i <= iMax; i++) {
      const cx = (i + 0.5) * spacing;
      const d = Math.hypot(cx, cz);
      if (d < exactMaxR && usableAt(raster, cx, cz)) exact[Math.floor(d / EXACT_BIN)]++;
    }
  }

  return { spacing, density, exactBin: EXACT_BIN, exactCum: cumulative(exact), exactMaxR, coarseBin, coarseCum, maxDist, totalArea };
}

export function fillRadius(p: CountProfile, count: number): FillResult {
  const exactTotal = p.exactCum[p.exactCum.length - 1];
  const capacity = p.exactMaxR >= p.maxDist ? exactTotal : Math.floor(p.totalArea * p.density);
  if (count > capacity) return { radius: p.maxDist, overflow: true, capacity };

  if (count <= exactTotal) {
    // Smallest bin j with exactCum[j + 1] >= count; everyone in bins 0..j has d < (j + 1) * bin.
    let lo = 0, hi = p.exactCum.length - 2;
    while (lo < hi) {
      const mid = (lo + hi) >> 1;
      if (p.exactCum[mid + 1] >= count) hi = mid; else lo = mid + 1;
    }
    return { radius: (lo + 1) * p.exactBin, overflow: false, capacity };
  }

  const target = count / p.density;
  let lo = p.exactMaxR, hi = p.maxDist;
  for (let i = 0; i < 60; i++) {
    const mid = (lo + hi) / 2;
    if (coarseArea(p, mid) < target) lo = mid; else hi = mid;
  }
  return { radius: hi, overflow: false, capacity };
}
```

- [ ] **Step 9: Run tests**

Run: `npm test`
Expected: PASS. The real-place suite takes a few seconds (it rasterizes Manhattan and the open field).

- [ ] **Step 10: Commit**

```bash
git add src/layout
git commit -m "feat(layout): rasterized usable area and exact fill radius"
```

---

### Task 6: Tile builders

**Files:**
- Create: `src/crowd/tiles.ts`
- Test: `src/crowd/tiles.test.ts`

**Interfaces:**
- Consumes: `hash3`, `unit`, `pickIndex`, `STREAM` (Task 2), `personAt` (Task 2), `SHIRT` (Task 2), `Raster`, `usableAt`, `rasterize` (Task 5), `squarePlace` (Task 3).
- Produces:
  - `NEAR_TILE = 50`, `MID_TILE = 100` (meters)
  - `tileLatticeRange(t: number, size: number, spacing: number): [number, number]` (inclusive start, exclusive end)
  - `interface NearTileData { count; person: Float32Array /* cx, cz, height, pose */; jitter: Float32Array /* jx, jz */; look: Float32Array /* shirt, pants, skin, hair */; rand: Float32Array /* lodRand, pickRand */ }`
  - `interface MidTileData { count; position: Float32Array /* cx, 0, cz */; jitter: Float32Array; shirt: Float32Array; rand: Float32Array }`
  - `buildNearTile(r: Raster, spacing: number, seed: number, tx: number, tz: number): NearTileData`
  - `buildMidTile(r: Raster, spacing: number, seed: number, tx: number, tz: number): MidTileData`
- Tiles include every usable lattice person in the tile regardless of radius; shaders cull by radius so slider drags never rebuild tiles.

- [ ] **Step 1: Write the failing tests**

`src/crowd/tiles.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { buildMidTile, buildNearTile, tileLatticeRange } from './tiles';
import { personAt } from './person';
import { rasterize, usableAt } from '../layout/raster';
import { squarePlace } from '../test/fixtures';

const raster = rasterize(squarePlace(300, 20));
const s = 0.63;

describe('tileLatticeRange', () => {
  it('covers centers in [t*size, (t+1)*size)', () => {
    const [i0, i1] = tileLatticeRange(1, 50, s);
    expect((i0 + 0.5) * s).toBeGreaterThanOrEqual(50);
    expect((i0 - 0.5) * s).toBeLessThan(50);
    expect((i1 - 0.5) * s).toBeLessThan(100);
    expect((i1 + 0.5) * s).toBeGreaterThanOrEqual(100);
  });
});

describe('buildNearTile', () => {
  it('is deterministic and only contains usable centers', () => {
    const a = buildNearTile(raster, s, 42, 0, 0);
    expect(a).toEqual(buildNearTile(raster, s, 42, 0, 0));
    expect(a.count).toBeGreaterThan(0);
    for (let n = 0; n < a.count; n++) {
      expect(usableAt(raster, a.person[n * 4], a.person[n * 4 + 1])).toBe(true);
    }
  });

  it('skips the hole', () => {
    // The 40 m hole is centered on the origin: tile (0,0) covers [0,50)², so ~400 m² of it is hole.
    const t = buildNearTile(raster, s, 42, 0, 0);
    expect(t.count).toBeLessThan((50 * 50 - 300) / (s * s));
  });

  it('matches personAt for the first person', () => {
    const t = buildNearTile(raster, s, 42, 2, 2);
    const [i0] = tileLatticeRange(2, 50, s);
    const [k0] = tileLatticeRange(2, 50, s);
    const p = personAt(i0, k0, s, 42);
    expect(t.person[0]).toBeCloseTo(p.cx, 4);
    expect(t.look[0]).toBe(p.shirt);
    expect(t.rand[0]).toBeCloseTo(p.lodRand, 6);
  });
});

describe('buildMidTile', () => {
  it('contains exactly the people of the four near tiles it covers', () => {
    const near = [[2, 2], [3, 2], [2, 3], [3, 3]].reduce((sum, [x, z]) => sum + buildNearTile(raster, s, 7, x, z).count, 0);
    expect(buildMidTile(raster, s, 7, 1, 1).count).toBe(near);
  });
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx vitest run src/crowd/tiles.test.ts`
Expected: FAIL, cannot resolve `./tiles`.

- [ ] **Step 3: Implement `src/crowd/tiles.ts`**

```ts
import { hash3, pickIndex, STREAM, unit } from './hash';
import { personAt } from './person';
import { SHIRT } from './palettes';
import { usableAt, type Raster } from '../layout/raster';

export const NEAR_TILE = 50;
export const MID_TILE = 100;

export function tileLatticeRange(t: number, size: number, spacing: number): [number, number] {
  return [Math.ceil((t * size) / spacing - 0.5), Math.ceil(((t + 1) * size) / spacing - 0.5)];
}

export interface NearTileData {
  count: number;
  person: Float32Array; // cx, cz, height, pose
  jitter: Float32Array; // jx, jz
  look: Float32Array; // shirt, pants, skin, hair
  rand: Float32Array; // lodRand, pickRand
}

export interface MidTileData {
  count: number;
  position: Float32Array; // cx, 0, cz
  jitter: Float32Array; // jx, jz
  shirt: Float32Array;
  rand: Float32Array; // lodRand, pickRand
}

export function buildNearTile(r: Raster, spacing: number, seed: number, tx: number, tz: number): NearTileData {
  const [i0, i1] = tileLatticeRange(tx, NEAR_TILE, spacing);
  const [k0, k1] = tileLatticeRange(tz, NEAR_TILE, spacing);
  const max = Math.max(0, (i1 - i0) * (k1 - k0));
  const person = new Float32Array(max * 4), jitter = new Float32Array(max * 2);
  const look = new Float32Array(max * 4), rand = new Float32Array(max * 2);
  let n = 0;
  for (let k = k0; k < k1; k++) {
    for (let i = i0; i < i1; i++) {
      if (!usableAt(r, (i + 0.5) * spacing, (k + 0.5) * spacing)) continue;
      const p = personAt(i, k, spacing, seed);
      person[n * 4] = p.cx; person[n * 4 + 1] = p.cz; person[n * 4 + 2] = p.height; person[n * 4 + 3] = p.pose;
      jitter[n * 2] = p.jx; jitter[n * 2 + 1] = p.jz;
      look[n * 4] = p.shirt; look[n * 4 + 1] = p.pants; look[n * 4 + 2] = p.skin; look[n * 4 + 3] = p.hair;
      rand[n * 2] = p.lodRand; rand[n * 2 + 1] = p.pickRand;
      n++;
    }
  }
  return { count: n, person: person.slice(0, n * 4), jitter: jitter.slice(0, n * 2), look: look.slice(0, n * 4), rand: rand.slice(0, n * 2) };
}

export function buildMidTile(r: Raster, spacing: number, seed: number, tx: number, tz: number): MidTileData {
  const [i0, i1] = tileLatticeRange(tx, MID_TILE, spacing);
  const [k0, k1] = tileLatticeRange(tz, MID_TILE, spacing);
  const max = Math.max(0, (i1 - i0) * (k1 - k0));
  const position = new Float32Array(max * 3), jitter = new Float32Array(max * 2);
  const shirt = new Float32Array(max), rand = new Float32Array(max * 2);
  let n = 0;
  for (let k = k0; k < k1; k++) {
    for (let i = i0; i < i1; i++) {
      const cx = (i + 0.5) * spacing, cz = (k + 0.5) * spacing;
      if (!usableAt(r, cx, cz)) continue;
      position[n * 3] = cx; position[n * 3 + 1] = 0; position[n * 3 + 2] = cz;
      jitter[n * 2] = (unit(hash3(i, k, seed + STREAM.jitterX)) - 0.5) * 0.8 * spacing;
      jitter[n * 2 + 1] = (unit(hash3(i, k, seed + STREAM.jitterZ)) - 0.5) * 0.8 * spacing;
      shirt[n] = pickIndex(hash3(i, k, seed + STREAM.shirt), SHIRT.length);
      rand[n * 2] = unit(hash3(i, k, seed + STREAM.lod));
      rand[n * 2 + 1] = unit(hash3(i, k, seed + STREAM.pick));
      n++;
    }
  }
  return { count: n, position: position.slice(0, n * 3), jitter: jitter.slice(0, n * 2), shirt: shirt.slice(0, n), rand: rand.slice(0, n * 2) };
}
```

- [ ] **Step 4: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/crowd/tiles.ts src/crowd/tiles.test.ts
git commit -m "feat(crowd): near and mid tile builders"
```

---

### Task 7: App state, URL state, log slider math, venue comparisons

**Files:**
- Create: `src/state.ts`, `src/urlState.ts`, `src/ui/logScale.ts`, `src/ui/venues.ts`
- Test: `src/state.test.ts`, `src/urlState.test.ts`, `src/ui/logScale.test.ts`, `src/ui/venues.test.ts`

**Interfaces:**
- Consumes: `PlaceId`, `PLACE_IDS` (Task 3).
- Produces:
  - `type Density = 1 | 2.5 | 4.5`, `DENSITIES`, `COUNT_MIN = 50`, `COUNT_MAX = 50_000_000`, `clampCount(n: number): number`
  - `interface SceneState { count; placeId: PlaceId; density: Density; highlight: null | { oneIn: number }; camera: { preset: 'aerial' | 'eye'; nonce: number } }`
  - `DEFAULT_STATE: SceneState` (180,000 on the National Mall, concert density, aerial)
  - `interface Store<T> { get(): T; set(patch: Partial<T>): void; subscribe(fn: () => void): () => void }`, `createStore<T extends object>(initial: T): Store<T>`
  - `parseUrlState(search: string, fallback: SceneState): SceneState`, `serializeUrlState(s: SceneState): string`
  - `countToPos(count: number): number`, `posToCount(pos: number): number`, `niceRound(n: number): number`, `parseCount(text: string): number | null`, `formatCount(n: number): string`, `shortCount(n: number): string`
  - `interface Venue { name: string; people: number; source: string }`, `VENUES: Venue[]`, `compareLines(count: number, venues?: Venue[], n?: number): string[]`, `formatRatio(r: number, name: string): string`

- [ ] **Step 1: Write the failing tests**

`src/state.test.ts`:
```ts
import { describe, expect, it, vi } from 'vitest';
import { clampCount, createStore, DEFAULT_STATE } from './state';

describe('createStore', () => {
  it('merges patches and notifies subscribers', () => {
    const store = createStore(DEFAULT_STATE);
    const fn = vi.fn();
    const off = store.subscribe(fn);
    store.set({ count: 500 });
    expect(store.get().count).toBe(500);
    expect(store.get().placeId).toBe(DEFAULT_STATE.placeId);
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    store.set({ count: 600 });
    expect(fn).toHaveBeenCalledTimes(1);
  });
});

describe('clampCount', () => {
  it('clamps to 50..50M', () => {
    expect(clampCount(3)).toBe(50);
    expect(clampCount(9e9)).toBe(50_000_000);
    expect(clampCount(1234.6)).toBe(1235);
  });
});
```

`src/urlState.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseUrlState, serializeUrlState } from './urlState';
import { DEFAULT_STATE } from './state';

describe('url state', () => {
  it('round-trips', () => {
    const s = { ...DEFAULT_STATE, placeId: 'manhattan' as const, count: 20_000_000, density: 4.5 as const, highlight: { oneIn: 100 } };
    expect(parseUrlState('?' + serializeUrlState(s), DEFAULT_STATE)).toEqual(s);
  });

  it('falls back on junk', () => {
    const s = parseUrlState('?place=mars&count=abc&density=3&hl=1', DEFAULT_STATE);
    expect(s).toEqual(DEFAULT_STATE);
  });

  it('clamps huge counts', () => {
    expect(parseUrlState('?count=999999999999', DEFAULT_STATE).count).toBe(50_000_000);
  });
});
```

`src/ui/logScale.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { countToPos, formatCount, niceRound, parseCount, posToCount, shortCount } from './logScale';

describe('log slider', () => {
  it('maps the ends', () => {
    expect(posToCount(0)).toBe(50);
    expect(posToCount(1)).toBe(50_000_000);
    expect(countToPos(50)).toBe(0);
    expect(countToPos(50_000_000)).toBeCloseTo(1, 9);
  });

  it('round-trips within one slider step', () => {
    for (let p = 0; p <= 1.0001; p += 0.01) {
      const c = posToCount(p);
      expect(Math.abs(countToPos(c) - p)).toBeLessThan(0.005);
      expect(posToCount(countToPos(c))).toBe(c);
    }
  });

  it('rounds to two significant digits above 100', () => {
    expect(niceRound(183_456)).toBe(180_000);
    expect(niceRound(87)).toBe(87);
  });
});

describe('parseCount', () => {
  it('reads plain numbers, commas and suffixes', () => {
    expect(parseCount('180000')).toBe(180_000);
    expect(parseCount('20,000,000')).toBe(20_000_000);
    expect(parseCount('1.5k')).toBe(1_500);
    expect(parseCount('2M')).toBe(2_000_000);
    expect(parseCount(' 300 ')).toBe(300);
  });

  it('clamps or rejects junk', () => {
    expect(parseCount('abc')).toBeNull();
    expect(parseCount('')).toBeNull();
    expect(parseCount('-5')).toBe(50);
    expect(parseCount('0')).toBe(50);
    expect(parseCount('1e12')).toBe(50_000_000);
  });
});

describe('formatting', () => {
  it('formats counts', () => {
    expect(formatCount(1234567)).toBe('1,234,567');
    expect(shortCount(1_000)).toBe('1k');
    expect(shortCount(20_000_000)).toBe('20M');
    expect(shortCount(50)).toBe('50');
  });
});
```

`src/ui/venues.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { compareLines, formatRatio, VENUES } from './venues';

const V = [
  { name: 'Big', people: 100_000, source: 'x' },
  { name: 'Mid', people: 20_000, source: 'x' },
  { name: 'Small', people: 5_000, source: 'x' },
];

describe('compareLines', () => {
  it('picks the two closest venues in log space', () => {
    expect(compareLines(180_000, V)).toEqual(['≈ 1.8 × Big', '≈ 9 × Mid']);
  });
  it('says nothing when every venue dwarfs the crowd', () => {
    expect(compareLines(50, V)).toEqual([]);
  });
});

describe('formatRatio', () => {
  it('formats', () => {
    expect(formatRatio(1.0, 'Big')).toBe('≈ Big');
    expect(formatRatio(2.04, 'Big')).toBe('≈ 2 × Big');
    expect(formatRatio(37.4, 'Big')).toBe('≈ 37 × Big');
    expect(formatRatio(0.25, 'Big')).toBe('≈ 25% of Big');
  });
});

describe('VENUES', () => {
  it('every venue cites a source URL', () => {
    for (const v of VENUES) expect(v.source).toMatch(/^https:\/\//);
  });
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npm test`
Expected: FAIL, cannot resolve `./state`, `./urlState`, `./logScale`, `./venues`.

- [ ] **Step 3: Implement `src/state.ts`**

```ts
import type { PlaceId } from './places/types';

export const DENSITIES = [1, 2.5, 4.5] as const;
export type Density = (typeof DENSITIES)[number];

export const COUNT_MIN = 50;
export const COUNT_MAX = 50_000_000;
export const clampCount = (n: number): number => Math.min(COUNT_MAX, Math.max(COUNT_MIN, Math.round(n)));

export interface SceneState {
  count: number;
  placeId: PlaceId;
  density: Density;
  highlight: null | { oneIn: number };
  camera: { preset: 'aerial' | 'eye'; nonce: number };
}

export const DEFAULT_STATE: SceneState = {
  count: 180_000,
  placeId: 'national-mall',
  density: 2.5,
  highlight: null,
  camera: { preset: 'aerial', nonce: 0 },
};

export interface Store<T> {
  get(): T;
  set(patch: Partial<T>): void;
  subscribe(fn: () => void): () => void;
}

export function createStore<T extends object>(initial: T): Store<T> {
  let state = initial;
  const subs = new Set<() => void>();
  return {
    get: () => state,
    set(patch) {
      state = { ...state, ...patch };
      subs.forEach((f) => f());
    },
    subscribe(fn) {
      subs.add(fn);
      return () => subs.delete(fn);
    },
  };
}
```

- [ ] **Step 4: Implement `src/urlState.ts`**

```ts
import { PLACE_IDS, type PlaceId } from './places/types';
import { clampCount, DENSITIES, type Density, type SceneState } from './state';

export function parseUrlState(search: string, fallback: SceneState): SceneState {
  const q = new URLSearchParams(search);
  const place = q.get('place') ?? '';
  const count = Number(q.get('count'));
  const density = Number(q.get('density'));
  const hl = Number(q.get('hl'));
  return {
    ...fallback,
    placeId: (PLACE_IDS as readonly string[]).includes(place) ? (place as PlaceId) : fallback.placeId,
    count: Number.isFinite(count) && count > 0 ? clampCount(count) : fallback.count,
    density: (DENSITIES as readonly number[]).includes(density) ? (density as Density) : fallback.density,
    highlight: Number.isFinite(hl) && hl >= 2 ? { oneIn: Math.round(hl) } : fallback.highlight,
  };
}

export function serializeUrlState(s: SceneState): string {
  const q = new URLSearchParams({ place: s.placeId, count: String(s.count), density: String(s.density) });
  if (s.highlight) q.set('hl', String(s.highlight.oneIn));
  return q.toString();
}
```

- [ ] **Step 5: Implement `src/ui/logScale.ts`**

```ts
import { clampCount, COUNT_MAX, COUNT_MIN } from '../state';

const SPAN = Math.log(COUNT_MAX / COUNT_MIN);

export const countToPos = (count: number): number =>
  Math.min(1, Math.max(0, Math.log(clampCount(count) / COUNT_MIN) / SPAN));

/** Two significant digits above 100 so slider values read as round numbers. */
export function niceRound(n: number): number {
  if (n < 100) return Math.round(n);
  const mag = 10 ** (Math.floor(Math.log10(n)) - 1);
  return Math.round(n / mag) * mag;
}

export const posToCount = (pos: number): number =>
  clampCount(niceRound(COUNT_MIN * Math.exp(Math.min(1, Math.max(0, pos)) * SPAN)));

export function parseCount(text: string): number | null {
  const m = text.trim().replace(/,/g, '').match(/^(-?\d*\.?\d+(?:e\d+)?)\s*([kKmM]?)$/);
  if (!m) return null;
  const mult = { '': 1, k: 1e3, K: 1e3, m: 1e6, M: 1e6 }[m[2] as '' | 'k' | 'K' | 'm' | 'M'];
  const n = Number(m[1]) * mult;
  return Number.isFinite(n) ? clampCount(n) : null;
}

export const formatCount = (n: number): string => Math.round(n).toLocaleString('en-US');

export function shortCount(n: number): string {
  if (n >= 1e6) return `${n / 1e6}M`;
  if (n >= 1e3) return `${n / 1e3}k`;
  return String(n);
}
```

- [ ] **Step 6: Implement `src/ui/venues.ts`**

```ts
export interface Venue { name: string; people: number; source: string; }

// Every number below must be confirmed against its source in Step 8 before commit.
export const VENUES: Venue[] = [
  { name: 'Royal Albert Hall', people: 5_272, source: 'https://www.royalalberthall.com/about-the-hall/' },
  { name: 'The O2 arena', people: 20_000, source: 'https://www.theo2.co.uk/' },
  { name: 'Wembley Stadium', people: 90_000, source: 'https://www.wembleystadium.com/' },
  { name: 'Michigan Stadium', people: 107_601, source: 'https://mgoblue.com/facilities/michigan-stadium/1' },
  { name: 'Chicago (2020 census)', people: 2_746_388, source: 'https://www.census.gov/quickfacts/chicagocityillinois' },
  { name: 'New York City (2020 census)', people: 8_804_190, source: 'https://www.census.gov/quickfacts/newyorkcitynewyork' },
];

const trim = (s: string) => s.replace(/\.0$/, '');

export function formatRatio(r: number, name: string): string {
  if (r >= 0.95 && r < 1.05) return `≈ ${name}`;
  if (r >= 1) return `≈ ${r < 10 ? trim(r.toFixed(1)) : Math.round(r).toLocaleString('en-US')} × ${name}`;
  return `≈ ${Math.round(r * 100)}% of ${name}`;
}

export function compareLines(count: number, venues: Venue[] = VENUES, n = 2): string[] {
  return venues
    .filter((v) => count / v.people >= 0.05)
    .map((v) => ({ v, score: Math.abs(Math.log(count / v.people)) }))
    .sort((a, b) => a.score - b.score)
    .slice(0, n)
    .map(({ v }) => formatRatio(count / v.people, v.name));
}
```

- [ ] **Step 7: Run tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 8: Verify every venue number against its source**

For each entry in `VENUES`, fetch the `source` URL (WebFetch or browser) and confirm the capacity/population. If the page states a different figure, use the page's figure. If the page cannot be loaded or doesn't state a figure, find an official page that does and replace the URL, or delete the entry. Record each confirmation (venue, figure, URL, date) in the commit message body.

- [ ] **Step 9: Commit**

```bash
git add src/state.ts src/state.test.ts src/urlState.ts src/urlState.test.ts src/ui/logScale.ts src/ui/logScale.test.ts src/ui/venues.ts src/ui/venues.test.ts
git commit -m "feat(state): store, URL state, log slider math, sourced venue comparisons"
```

---

### Task 8: Render foundation (scene, camera, world, stats, WebGL2 fallback)

**Files:**
- Create: `src/render/types.ts`, `src/render/webgl.ts`, `src/render/lod.ts`, `src/render/tileSet.ts`, `src/render/placeCache.ts`, `src/render/world.ts`, `src/render/camera.ts`, `src/render/uniforms.ts`, `src/render/createScene.ts`, `src/SceneView.tsx`
- Modify: `src/main.tsx`, `src/App.tsx`, `src/styles.css`
- Test: `src/render/lod.test.ts`, `src/render/tileSet.test.ts`, `e2e/scene.spec.ts`

**Interfaces:**
- Consumes: `SceneState`, `Density`, `Store`, `createStore`, `DEFAULT_STATE` (Task 7), `parseUrlState`, `serializeUrlState` (Task 7), `getPlace` (Task 4), `rasterize`, `rasterBounds`, `Raster` (Task 5), `buildCountProfile`, `fillRadius`, `spacingFor`, `CountProfile`, `FillResult` (Task 5), `seedFromId` (Task 2), palette constants (Task 2), `bbox` (Task 3).
- Produces:
  - `interface SceneStats { fps; nearSprites; midPoints; overflow; capacity; radius }`
  - `interface CrowdScene { update(s: SceneState): void; dispose(): void; onStats(cb: (s: SceneStats) => void): () => void }`
  - `interface PlaceContext { place: Place; raster: Raster; seed: number }`
  - `interface CrowdParams { radius: number; spacing: number; highlight: null | { oneIn: number } }`
  - `interface FrameContext { camera: THREE.PerspectiveCamera; lodCenter: THREE.Vector2; lod: LodRanges; pxPerUnit: number; fog: { color: THREE.Color; near: number; far: number }; deadline: number }`
  - `interface Layer { readonly kind: 'near' | 'mid' | 'far'; readonly object: THREE.Object3D; setPlace(ctx: PlaceContext): void; setCrowd(p: CrowdParams): void; frame(f: FrameContext): void; count(): number; dispose(): void }`
  - `interface LodRanges { nearStart; nearEnd; midStart; midEnd }`, `lodRanges(o: { density; nearBudget; midBudget; pxPerUnit }): LodRanges`, `class BudgetGovernor { budget: number; sample(fps: number, nowMs: number): boolean }`, `MID_BUDGET = 1_500_000`
  - `tileKey(tx, tz): string`, `parseTileKey(k): [number, number]`, `tilesInRange(center: { x: number; z: number }, outerR: number, innerR: number, crowdR: number, size: number, b: { minX; minZ; maxX; maxZ }): string[]` (sorted nearest first)
  - `placeContext(id: PlaceId): PlaceContext`, `countProfile(id: PlaceId, density: Density): CountProfile` (memoized)
  - `paletteUniforms()`, `fogUniforms()`, `applyFog(u, f: FrameContext)`
  - `createScene(container: HTMLElement): CrowdScene | null` (null = no WebGL2)
  - `window.__crowdStats: SceneStats` (latest stats, used by e2e)
  - `SceneView` React component

- [ ] **Step 1: Write the failing LOD and tile-set tests**

`src/render/lod.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { BudgetGovernor, lodRanges } from './lod';

describe('lodRanges', () => {
  const base = { density: 2.5, nearBudget: 400_000, midBudget: 1_500_000, pxPerUnit: 1000 };

  it('keeps near sprites within budget', () => {
    const r = lodRanges(base);
    expect(Math.PI * r.nearEnd ** 2 * base.density).toBeLessThanOrEqual(400_000 * 1.0001);
  });

  it('orders the bands', () => {
    const r = lodRanges(base);
    expect(r.nearStart).toBeLessThan(r.nearEnd);
    expect(r.nearEnd).toBeLessThan(r.midStart);
    expect(r.midStart).toBeLessThan(r.midEnd);
  });

  it('shrinks with a smaller budget', () => {
    expect(lodRanges({ ...base, nearBudget: 100_000 }).nearEnd).toBeLessThan(lodRanges(base).nearEnd);
  });
});

describe('BudgetGovernor', () => {
  it('drops 25% after 2 s under 50 fps and never below the floor', () => {
    const g = new BudgetGovernor(400_000, 50_000);
    expect(g.sample(30, 0)).toBe(false);
    expect(g.sample(30, 1000)).toBe(false);
    expect(g.sample(30, 2000)).toBe(true);
    expect(g.budget).toBe(300_000);
    for (let t = 2500; t < 60_000; t += 500) g.sample(10, t);
    expect(g.budget).toBe(50_000);
  });

  it('resets when fps recovers', () => {
    const g = new BudgetGovernor();
    g.sample(30, 0);
    g.sample(60, 1500);
    expect(g.sample(30, 2000)).toBe(false);
    expect(g.budget).toBe(400_000);
  });
});
```

`src/render/tileSet.test.ts`:
```ts
import { describe, expect, it } from 'vitest';
import { parseTileKey, tileKey, tilesInRange } from './tileSet';

const bounds = { minX: -1000, minZ: -1000, maxX: 1000, maxZ: 1000 };

describe('tilesInRange', () => {
  it('returns tiles around the center, nearest first', () => {
    const keys = tilesInRange({ x: 0, z: 0 }, 60, 0, 1e9, 50, bounds);
    expect(keys[0]).toMatch(/^(-1|0),(-1|0)$/);
    expect(keys).toContain('0,0');
    expect(keys).toContain('-2,0'); // nearest edge 50 m away
    expect(keys).not.toContain('-2,-2'); // nearest corner 70.7 m away
    expect(keys).not.toContain('2,0');
  });

  it('excludes tiles fully inside the inner radius', () => {
    const keys = tilesInRange({ x: 0, z: 0 }, 300, 200, 1e9, 50, bounds);
    expect(keys).not.toContain('0,0');
    expect(keys).toContain('5,0');
  });

  it('excludes tiles beyond the crowd radius', () => {
    const keys = tilesInRange({ x: 0, z: 0 }, 300, 0, 40, 50, bounds);
    expect(keys.every((k) => parseTileKey(k).every((t) => t >= -1 && t <= 0))).toBe(true);
  });

  it('round-trips keys', () => expect(parseTileKey(tileKey(-3, 7))).toEqual([-3, 7]));
});
```

- [ ] **Step 2: Run to verify they fail**

Run: `npx vitest run src/render`
Expected: FAIL, cannot resolve `./lod`, `./tileSet`.

- [ ] **Step 3: Implement `src/render/lod.ts` and `src/render/tileSet.ts`**

`src/render/lod.ts`:
```ts
export interface LodRanges { nearStart: number; nearEnd: number; midStart: number; midEnd: number; }

export const MID_BUDGET = 1_500_000;
const PERSON_H = 1.75;

/**
 * Distances (from the LOD center) where sprites fade to dots and dots fade to the ground shader.
 * Each tier ends where its budget runs out or the figure gets too small to matter, whichever is first.
 */
export function lodRanges(o: { density: number; nearBudget: number; midBudget: number; pxPerUnit: number }): LodRanges {
  const byBudget = (b: number) => Math.sqrt(b / (Math.PI * o.density));
  const byPixels = (px: number) => (PERSON_H * o.pxPerUnit) / px;
  const nearEnd = Math.min(byBudget(o.nearBudget), byPixels(3));
  const midEnd = Math.max(nearEnd * 1.5, Math.min(byBudget(o.midBudget), byPixels(1)));
  return { nearStart: nearEnd * 0.85, nearEnd, midStart: midEnd * 0.85, midEnd };
}

export class BudgetGovernor {
  budget: number;
  private lowSince: number | null = null;

  constructor(initial = 400_000, private readonly floor = 50_000) {
    this.budget = initial;
  }

  /** Feed an fps sample; returns true when the budget dropped. */
  sample(fps: number, nowMs: number): boolean {
    if (fps >= 50) {
      this.lowSince = null;
      return false;
    }
    if (this.lowSince === null) {
      this.lowSince = nowMs;
      return false;
    }
    if (nowMs - this.lowSince >= 2000 && this.budget > this.floor) {
      this.budget = Math.max(this.floor, Math.round(this.budget * 0.75));
      this.lowSince = nowMs;
      return true;
    }
    return false;
  }
}
```

`src/render/tileSet.ts`:
```ts
export const tileKey = (tx: number, tz: number): string => `${tx},${tz}`;
export const parseTileKey = (k: string): [number, number] => {
  const [a, b] = k.split(',').map(Number);
  return [a, b];
};

const nearDist = (px: number, pz: number, x0: number, z0: number, x1: number, z1: number) =>
  Math.hypot(Math.max(x0 - px, 0, px - x1), Math.max(z0 - pz, 0, pz - z1));
const farDist = (px: number, pz: number, x0: number, z0: number, x1: number, z1: number) =>
  Math.hypot(Math.max(Math.abs(px - x0), Math.abs(px - x1)), Math.max(Math.abs(pz - z0), Math.abs(pz - z1)));

/** Tiles touching the annulus [innerR, outerR] around center, inside the crowd disk and bounds. Nearest first. */
export function tilesInRange(
  center: { x: number; z: number },
  outerR: number,
  innerR: number,
  crowdR: number,
  size: number,
  b: { minX: number; minZ: number; maxX: number; maxZ: number },
): string[] {
  const x0 = Math.max(center.x - outerR, b.minX, -crowdR), x1 = Math.min(center.x + outerR, b.maxX, crowdR);
  const z0 = Math.max(center.z - outerR, b.minZ, -crowdR), z1 = Math.min(center.z + outerR, b.maxZ, crowdR);
  if (x0 >= x1 || z0 >= z1) return [];
  const out: { k: string; d: number }[] = [];
  for (let tx = Math.floor(x0 / size); tx * size < x1; tx++) {
    for (let tz = Math.floor(z0 / size); tz * size < z1; tz++) {
      const rx0 = tx * size, rz0 = tz * size, rx1 = rx0 + size, rz1 = rz0 + size;
      const d = nearDist(center.x, center.z, rx0, rz0, rx1, rz1);
      if (d > outerR) continue;
      if (farDist(center.x, center.z, rx0, rz0, rx1, rz1) < innerR) continue;
      if (nearDist(0, 0, rx0, rz0, rx1, rz1) >= crowdR) continue;
      out.push({ k: tileKey(tx, tz), d });
    }
  }
  return out.sort((a, c) => a.d - c.d).map((o) => o.k);
}
```

- [ ] **Step 4: Run unit tests**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Write `src/render/types.ts`, `src/render/webgl.ts`, `src/render/placeCache.ts`, `src/render/uniforms.ts`**

`src/render/types.ts`:
```ts
import type * as THREE from 'three';
import type { Place } from '../places/types';
import type { Raster } from '../layout/raster';
import type { SceneState } from '../state';
import type { LodRanges } from './lod';

export interface SceneStats {
  fps: number;
  nearSprites: number;
  midPoints: number;
  overflow: boolean;
  capacity: number;
  radius: number;
}

export interface CrowdScene {
  update(state: SceneState): void;
  dispose(): void;
  onStats(cb: (s: SceneStats) => void): () => void;
}

export interface PlaceContext { place: Place; raster: Raster; seed: number; }
export interface CrowdParams { radius: number; spacing: number; highlight: null | { oneIn: number }; }

export interface FrameContext {
  camera: THREE.PerspectiveCamera;
  lodCenter: THREE.Vector2;
  lod: LodRanges;
  pxPerUnit: number;
  fog: { color: THREE.Color; near: number; far: number };
  /** performance.now() value by which tile building must stop this frame. */
  deadline: number;
}

export interface Layer {
  readonly kind: 'near' | 'mid' | 'far';
  readonly object: THREE.Object3D;
  setPlace(ctx: PlaceContext): void;
  setCrowd(p: CrowdParams): void;
  frame(f: FrameContext): void;
  count(): number;
  dispose(): void;
}

declare global {
  interface Window {
    __crowdStats?: SceneStats;
    __hashParity?: { ok: boolean; mismatches: number; total: number };
  }
}
```

`src/render/webgl.ts`:
```ts
export function supportsWebGL2(): boolean {
  try {
    return !!document.createElement('canvas').getContext('webgl2');
  } catch {
    return false;
  }
}
```

`src/render/placeCache.ts`:
```ts
import { getPlace } from '../places/index';
import type { PlaceId } from '../places/types';
import { rasterize } from '../layout/raster';
import { buildCountProfile, type CountProfile } from '../layout/fillRadius';
import { seedFromId } from '../crowd/hash';
import type { Density } from '../state';
import type { PlaceContext } from './types';

const contexts = new Map<PlaceId, PlaceContext>();
const profiles = new Map<string, CountProfile>();

export function placeContext(id: PlaceId): PlaceContext {
  let ctx = contexts.get(id);
  if (!ctx) {
    const place = getPlace(id);
    ctx = { place, raster: rasterize(place), seed: seedFromId(id) };
    contexts.set(id, ctx);
  }
  return ctx;
}

export function countProfile(id: PlaceId, density: Density): CountProfile {
  const key = `${id}@${density}`;
  let p = profiles.get(key);
  if (!p) {
    p = buildCountProfile(placeContext(id).raster, density);
    profiles.set(key, p);
  }
  return p;
}
```

`src/render/uniforms.ts`:
```ts
import * as THREE from 'three';
import { ACCENT, HAIR, NEUTRAL_PANTS, NEUTRAL_SHIRT, PANTS, SHIRT, SKIN, SKY } from '../crowd/palettes';
import type { FrameContext } from './types';

const colors = (hexes: readonly string[]) => hexes.map((h) => new THREE.Color(h));

export function paletteUniforms() {
  return {
    uShirt: { value: colors(SHIRT) },
    uPants: { value: colors(PANTS) },
    uSkin: { value: colors(SKIN) },
    uHair: { value: colors(HAIR) },
    uNeutral: { value: colors(NEUTRAL_SHIRT) },
    uNeutralPants: { value: colors(NEUTRAL_PANTS) },
    uAccent: { value: new THREE.Color(ACCENT) },
  };
}

export function fogUniforms() {
  return {
    uFogColor: { value: new THREE.Color(SKY) },
    uFogNear: { value: 1000 },
    uFogFar: { value: 10000 },
    uCamPos: { value: new THREE.Vector3() },
  };
}

export function applyFog(u: Record<string, THREE.IUniform>, f: FrameContext): void {
  u.uFogNear.value = f.fog.near;
  u.uFogFar.value = f.fog.far;
  (u.uCamPos.value as THREE.Vector3).copy(f.camera.position);
}
```

- [ ] **Step 6: Write `src/render/world.ts`**

```ts
import * as THREE from 'three';
import { EDGE, FEATURE, GROUND } from '../crowd/palettes';
import type { Place } from '../places/types';

/** Huge flat ground. Ground layers never write depth, so draw order (renderOrder) decides stacking. */
export function createGround(): THREE.Mesh {
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(200_000, 200_000).rotateX(-Math.PI / 2),
    new THREE.MeshBasicMaterial({ color: GROUND, depthWrite: false }),
  );
  mesh.renderOrder = 0;
  return mesh;
}

/** Holes as flat fills plus a thin outline of the place boundary. */
export function createPlaceFeatures(place: Place): THREE.Group {
  const group = new THREE.Group();
  const holeMat = new THREE.MeshBasicMaterial({ color: FEATURE, depthWrite: false });
  for (const h of place.holes) {
    const shape = new THREE.Shape(h.slice(0, -1).map(([x, z]) => new THREE.Vector2(x, -z)));
    const mesh = new THREE.Mesh(new THREE.ShapeGeometry(shape).rotateX(-Math.PI / 2), holeMat);
    mesh.position.y = 0.03;
    mesh.renderOrder = 2;
    group.add(mesh);
  }
  const line = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints(place.outer.map(([x, z]) => new THREE.Vector3(x, 0.05, z))),
    new THREE.LineBasicMaterial({ color: EDGE, depthWrite: false }),
  );
  line.renderOrder = 3;
  group.add(line);
  return group;
}

export function disposeObject(obj: THREE.Object3D): void {
  obj.traverse((o) => {
    const m = o as THREE.Mesh;
    m.geometry?.dispose();
    const mat = m.material as THREE.Material | THREE.Material[] | undefined;
    if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
    else mat?.dispose();
  });
}
```

- [ ] **Step 7: Write `src/render/camera.ts`**

```ts
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { bbox } from '../places/geometry';
import type { Place } from '../places/types';

const FOV = 45;
const MIN_POLAR = THREE.MathUtils.degToRad(30); // pitch 60°
const MAX_POLAR = THREE.MathUtils.degToRad(80); // pitch 10°
const TAN_HALF = Math.tan(THREE.MathUtils.degToRad(FOV / 2));
const ease = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

interface Flight { t0: number; dur: number; fromPos: THREE.Vector3; toPos: THREE.Vector3; fromTarget: THREE.Vector3; toTarget: THREE.Vector3; }

export class CameraRig {
  readonly camera = new THREE.PerspectiveCamera(FOV, 1, 0.5, 80_000);
  readonly controls: OrbitControls;
  private bounds = { minX: -100, minZ: -100, maxX: 100, maxZ: 100 };
  private flight: Flight | null = null;

  constructor(dom: HTMLElement) {
    this.camera.position.set(0, 300, 300);
    this.controls = new OrbitControls(this.camera, dom);
    this.controls.minPolarAngle = MIN_POLAR;
    this.controls.maxPolarAngle = MAX_POLAR;
    this.controls.enableDamping = true;
    this.controls.dampingFactor = 0.08;
    this.controls.screenSpacePanning = false;
    this.controls.minDistance = 6;
  }

  setBounds(place: Place): void {
    const b = bbox(place.outer);
    const padX = (b.maxX - b.minX) * 0.2, padZ = (b.maxZ - b.minZ) * 0.2;
    this.bounds = { minX: b.minX - padX, minZ: b.minZ - padZ, maxX: b.maxX + padX, maxZ: b.maxZ + padZ };
    const halfDiag = Math.hypot(b.maxX - b.minX, b.maxZ - b.minZ) / 2;
    this.controls.maxDistance = Math.max(200, (2.5 * halfDiag) / TAN_HALF);
  }

  flyTo(preset: 'aerial' | 'eye', crowdRadius: number, nowMs: number): void {
    const target = new THREE.Vector3(0, 0, 0);
    const az = this.controls.getAzimuthalAngle();
    const polar = preset === 'aerial' ? THREE.MathUtils.degToRad(45) : MAX_POLAR;
    const dist =
      preset === 'aerial'
        ? THREE.MathUtils.clamp((1.4 * Math.max(crowdRadius, 15)) / TAN_HALF, 30, this.controls.maxDistance)
        : 30;
    const toPos = new THREE.Vector3().setFromSphericalCoords(dist, polar, az).add(target);
    this.flight = { t0: nowMs, dur: 1200, fromPos: this.camera.position.clone(), toPos, fromTarget: this.controls.target.clone(), toTarget: target };
    this.controls.enabled = false;
  }

  tick(nowMs: number): void {
    const f = this.flight;
    if (f) {
      const t = Math.min(1, (nowMs - f.t0) / f.dur);
      const k = ease(t);
      this.camera.position.lerpVectors(f.fromPos, f.toPos, k);
      this.controls.target.lerpVectors(f.fromTarget, f.toTarget, k);
      if (t >= 1) {
        this.flight = null;
        this.controls.enabled = true;
      }
    }
    this.controls.update();
    // Keep the orbit target on the ground and near the place.
    const tg = this.controls.target;
    const cx = THREE.MathUtils.clamp(tg.x, this.bounds.minX, this.bounds.maxX);
    const cz = THREE.MathUtils.clamp(tg.z, this.bounds.minZ, this.bounds.maxZ);
    const dx = cx - tg.x, dy = -tg.y, dz = cz - tg.z;
    if (dx || dy || dz) {
      tg.set(cx, 0, cz);
      this.camera.position.add(new THREE.Vector3(dx, dy, dz));
    }
  }

  resize(w: number, h: number): void {
    this.camera.aspect = w / Math.max(1, h);
    this.camera.updateProjectionMatrix();
  }

  dispose(): void {
    this.controls.dispose();
  }
}
```

- [ ] **Step 8: Write `src/render/createScene.ts`**

```ts
import * as THREE from 'three';
import { SKY } from '../crowd/palettes';
import { fillRadius, spacingFor, type FillResult } from '../layout/fillRadius';
import type { SceneState } from '../state';
import { CameraRig } from './camera';
import { BudgetGovernor, lodRanges, MID_BUDGET } from './lod';
import { countProfile, placeContext } from './placeCache';
import type { CrowdScene, FrameContext, Layer, PlaceContext, SceneStats } from './types';
import { supportsWebGL2 } from './webgl';
import { createGround, createPlaceFeatures, disposeObject } from './world';

// Hex colors pass through untouched so the render matches the approved mockups.
THREE.ColorManagement.enabled = false;

const FRAME_BUILD_MS = 4;

export function createScene(container: HTMLElement): CrowdScene | null {
  if (!supportsWebGL2()) return null;

  const renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  renderer.outputColorSpace = THREE.LinearSRGBColorSpace;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  container.appendChild(renderer.domElement);

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  const fog = new THREE.Fog(SKY, 1000, 10000);
  scene.fog = fog;

  const rig = new CameraRig(renderer.domElement);
  scene.add(createGround());

  // Crowd tiers are added in later tasks: near sprites, mid dots, far ground shader.
  const layers: Layer[] = [];
  for (const l of layers) scene.add(l.object);

  let current: SceneState | null = null;
  let ctx: PlaceContext | null = null;
  let features: THREE.Group | null = null;
  let fill: FillResult = { radius: 0, overflow: false, capacity: 0 };
  const governor = new BudgetGovernor();
  const subs = new Set<(s: SceneStats) => void>();

  function update(next: SceneState): void {
    const prev = current;
    current = next;
    const placeChanged = !prev || prev.placeId !== next.placeId;
    if (placeChanged) {
      ctx = placeContext(next.placeId);
      if (features) {
        scene.remove(features);
        disposeObject(features);
      }
      features = createPlaceFeatures(ctx.place);
      scene.add(features);
      rig.setBounds(ctx.place);
      for (const l of layers) l.setPlace(ctx);
    }
    fill = fillRadius(countProfile(next.placeId, next.density), next.count);
    for (const l of layers) l.setCrowd({ radius: fill.radius, spacing: spacingFor(next.density), highlight: next.highlight });
    if (placeChanged || prev!.camera.nonce !== next.camera.nonce) {
      rig.flyTo(next.camera.preset, fill.radius, performance.now());
    }
  }

  function resize(): void {
    const w = container.clientWidth, h = container.clientHeight;
    renderer.setSize(w, h);
    rig.resize(w, h);
  }
  const observer = new ResizeObserver(resize);
  observer.observe(container);
  resize();

  // LOD center: where a ray through the lower-middle of the screen hits the ground.
  // That is where the viewer sees people largest, between the camera and the orbit target.
  const lodCenter = new THREE.Vector2();
  const LOD_NDC = new THREE.Vector2(0, -0.4);
  const groundPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  const raycaster = new THREE.Raycaster();
  const hit = new THREE.Vector3();
  let frames = 0, lastStats = performance.now(), raf = 0;

  function emitStats(fps: number): void {
    if (!current) return;
    const sum = (kind: Layer['kind']) => layers.filter((l) => l.kind === kind).reduce((s, l) => s + l.count(), 0);
    const stats: SceneStats = {
      fps: Math.round(fps),
      nearSprites: sum('near'),
      midPoints: sum('mid'),
      overflow: fill.overflow,
      capacity: fill.capacity,
      radius: fill.radius,
    };
    window.__crowdStats = stats;
    subs.forEach((cb) => cb(stats));
  }

  function loop(now: number): void {
    raf = requestAnimationFrame(loop);
    rig.tick(now);
    const cam = rig.camera, target = rig.controls.target;
    raycaster.setFromCamera(LOD_NDC, cam);
    if (raycaster.ray.intersectPlane(groundPlane, hit)) lodCenter.set(hit.x, hit.z);
    else lodCenter.set(target.x, target.z);
    const d = cam.position.distanceTo(target);
    fog.near = d * 3;
    fog.far = d * 14 + 500;
    const pxPerUnit = renderer.domElement.height / (2 * Math.tan(THREE.MathUtils.degToRad(cam.fov / 2)));
    const f: FrameContext = {
      camera: cam,
      lodCenter,
      lod: lodRanges({ density: current?.density ?? 2.5, nearBudget: governor.budget, midBudget: MID_BUDGET, pxPerUnit }),
      pxPerUnit,
      fog: { color: fog.color, near: fog.near, far: fog.far },
      deadline: performance.now() + FRAME_BUILD_MS,
    };
    for (const l of layers) l.frame(f);
    renderer.render(scene, cam);
    frames++;
    if (now - lastStats >= 500) {
      const fps = (frames * 1000) / (now - lastStats);
      frames = 0;
      lastStats = now;
      governor.sample(fps, now);
      emitStats(fps);
    }
  }
  raf = requestAnimationFrame(loop);

  return {
    update,
    onStats(cb) {
      subs.add(cb);
      return () => subs.delete(cb);
    },
    dispose() {
      cancelAnimationFrame(raf);
      observer.disconnect();
      for (const l of layers) l.dispose();
      if (features) disposeObject(features);
      rig.dispose();
      renderer.dispose();
      renderer.domElement.remove();
      subs.clear();
    },
  };
}
```

- [ ] **Step 9: Write `src/SceneView.tsx`, rewrite `src/App.tsx` and `src/main.tsx`, extend `src/styles.css`**

`src/SceneView.tsx`:
```tsx
import { useEffect, useRef, useState } from 'react';
import { createScene } from './render/createScene';
import type { SceneStats } from './render/types';
import type { SceneState, Store } from './state';

export function SceneView({ store, stats }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }> }) {
  const ref = useRef<HTMLElement>(null);
  const [unsupported, setUnsupported] = useState(false);

  useEffect(() => {
    const scene = createScene(ref.current!);
    if (!scene) {
      setUnsupported(true);
      return;
    }
    scene.update(store.get());
    const offStore = store.subscribe(() => scene.update(store.get()));
    const offStats = scene.onStats((value) => stats.set({ value }));
    return () => {
      offStore();
      offStats();
      scene.dispose();
    };
  }, [store, stats]);

  return (
    <main className="scene" data-testid="scene" ref={ref}>
      {unsupported && <p className="scene-msg">This needs WebGL2, try a recent Chrome or Safari.</p>}
    </main>
  );
}
```

`src/App.tsx`:
```tsx
import { SceneView } from './SceneView';
import type { SceneStats } from './render/types';
import type { SceneState, Store } from './state';

export function App({ store, stats }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }>; debug: boolean }) {
  return (
    <div className="app">
      <aside className="sidebar" aria-label="Crowd controls">
        <h1 className="title">Visualizing Crowds</h1>
      </aside>
      <SceneView store={store} stats={stats} />
    </div>
  );
}
```

`src/main.tsx`:
```tsx
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
import type { SceneStats } from './render/types';
import { createStore, DEFAULT_STATE, type SceneState } from './state';
import { parseUrlState, serializeUrlState } from './urlState';
import './styles.css';

const debug = new URLSearchParams(location.search).has('debug');
const store = createStore<SceneState>(parseUrlState(location.search, DEFAULT_STATE));
const stats = createStore<{ value: SceneStats | null }>({ value: null });

let urlTimer = 0;
store.subscribe(() => {
  clearTimeout(urlTimer);
  urlTimer = window.setTimeout(() => {
    history.replaceState(null, '', `?${serializeUrlState(store.get())}${debug ? '&debug' : ''}`);
  }, 200);
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App store={store} stats={stats} debug={debug} />
  </StrictMode>,
);
```

Append to `src/styles.css`:
```css
.scene-msg {
  position: absolute;
  inset: 0;
  display: grid;
  place-items: center;
  margin: 0;
  padding: 24px;
  color: var(--muted);
  font-size: 14px;
  text-align: center;
}
```

- [ ] **Step 10: Write the scene e2e test**

`e2e/scene.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('scene renders a canvas and reports stats for the National Mall', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto('/?place=national-mall&count=1000&density=2.5');
  await expect(page.locator('[data-testid="scene"] canvas')).toBeVisible();
  await page.waitForFunction(() => (window.__crowdStats?.radius ?? 0) > 0);
  const stats = await page.evaluate(() => window.__crowdStats!);
  expect(stats.overflow).toBe(false);
  expect(stats.capacity).toBeGreaterThan(1_000_000);
  expect(errors).toEqual([]);
});

test('canvas matches its container at phone width', async ({ page }) => {
  await page.setViewportSize({ width: 375, height: 812 });
  await page.goto('/');
  const canvas = page.locator('[data-testid="scene"] canvas');
  await expect(canvas).toBeVisible();
  const [c, s] = await Promise.all([canvas.boundingBox(), page.getByTestId('scene').boundingBox()]);
  expect(Math.abs(c!.width - s!.width)).toBeLessThan(2);
  expect(Math.abs(c!.height - s!.height)).toBeLessThan(2);
});

test('shows a message without WebGL2 and keeps the sidebar', async ({ page }) => {
  await page.addInitScript(() => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const proto = HTMLCanvasElement.prototype as any;
    const orig = proto.getContext;
    proto.getContext = function (this: HTMLCanvasElement, type: string, ...rest: unknown[]) {
      if (type === 'webgl2') return null;
      return orig.call(this, type, ...rest);
    };
  });
  await page.goto('/');
  await expect(page.getByText('This needs WebGL2, try a recent Chrome or Safari.')).toBeVisible();
  await expect(page.getByRole('complementary', { name: 'Crowd controls' })).toBeVisible();
});
```

- [ ] **Step 11: Run unit + e2e**

Run: `npm test && npm run e2e`
Expected: all PASS in chromium and webkit.

- [ ] **Step 12: Look at it**

Run `npm run dev`, open `http://localhost:5173/?place=national-mall&count=180000` in the Browser pane (front the tab and set an explicit viewport first, e.g. 1440×900). Expected: warm ground, the Mall outline, water features as pale fills, camera flies in, orbit/zoom works and cannot tip below 10° or above 60°. No people yet.

- [ ] **Step 13: Commit**

```bash
git add -A
git commit -m "feat(render): scene, camera rig, world, stats, WebGL2 fallback"
```

---

### Task 9: GLSL hash with browser parity test

**Files:**
- Create: `src/render/shaders/hash.glsl.ts`, `hash-test.html`, `src/debug/hashParity.ts`, `e2e/hash-parity.spec.ts`
- Modify: `vite.config.ts` (add the second HTML entry)

**Interfaces:**
- Consumes: `hash3`, `seedFromId` (Task 2).
- Produces: `HASH_GLSL` string defining `uint hash3(int x, int z, int seed)`, `float unitHash(uint h)`, `int pickIndex(uint h, int n)`; `window.__hashParity`.

- [ ] **Step 1: Write the failing e2e test**

`e2e/hash-parity.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('GLSL hash matches the TypeScript hash bit for bit', async ({ page }) => {
  await page.goto('/hash-test.html');
  await page.waitForFunction(() => window.__hashParity !== undefined);
  const r = await page.evaluate(() => window.__hashParity!);
  expect(r.total).toBe(4 * 64 * 64);
  expect(r.mismatches).toBe(0);
  expect(r.ok).toBe(true);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/hash-parity.spec.ts`
Expected: FAIL (404 / timeout waiting for `__hashParity`).

- [ ] **Step 3: Write `src/render/shaders/hash.glsl.ts`**

```ts
/** GLSL ES 3.0 mirror of src/crowd/hash.ts. Unsigned multiply wraps mod 2^32 exactly like Math.imul. */
export const HASH_GLSL = /* glsl */ `
uint hash3(int x, int z, int seed) {
  uint h = (uint(x) * 0x27d4eb2du) ^ (uint(z) * 0x165667b1u) ^ (uint(seed) * 0x9e3779b1u);
  h = (h ^ (h >> 15u)) * 0x85ebca6bu;
  h = (h ^ (h >> 13u)) * 0xc2b2ae35u;
  h ^= h >> 16u;
  return h;
}
float unitHash(uint h) { return float(h >> 8u) / 16777216.0; }
int pickIndex(uint h, int n) { return int(((h >> 8u) * uint(n)) >> 24u); }
`;
```

- [ ] **Step 4: Write `hash-test.html` and `src/debug/hashParity.ts`**

`hash-test.html`:
```html
<!doctype html>
<html lang="en">
  <head><meta charset="UTF-8" /><title>Hash parity</title></head>
  <body>
    <pre id="out">running</pre>
    <script type="module" src="/src/debug/hashParity.ts"></script>
  </body>
</html>
```

`src/debug/hashParity.ts`:
```ts
import { hash3, seedFromId } from '../crowd/hash';
import { HASH_GLSL } from '../render/shaders/hash.glsl';

const SIZE = 64;
const SEEDS = [0, 12345, seedFromId('manhattan'), 1073741823];

const VERT = `#version 300 es
in vec2 p; void main() { gl_Position = vec4(p, 0.0, 1.0); }`;
const FRAG = `#version 300 es
precision highp float; precision highp int;
uniform int uSeed; out vec4 o;
${HASH_GLSL}
void main() {
  ivec2 c = ivec2(gl_FragCoord.xy);
  uint h = hash3(c.x - 32, c.y - 32, uSeed);
  o = vec4(float(h & 255u), float((h >> 8u) & 255u), float((h >> 16u) & 255u), float(h >> 24u)) / 255.0;
}`;

function run(): { ok: boolean; mismatches: number; total: number } {
  const canvas = document.createElement('canvas');
  canvas.width = canvas.height = SIZE;
  const gl = canvas.getContext('webgl2');
  if (!gl) throw new Error('no webgl2');
  const sh = (type: number, src: string) => {
    const s = gl.createShader(type)!;
    gl.shaderSource(s, src);
    gl.compileShader(s);
    if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s) ?? 'compile');
    return s;
  };
  const prog = gl.createProgram()!;
  gl.attachShader(prog, sh(gl.VERTEX_SHADER, VERT));
  gl.attachShader(prog, sh(gl.FRAGMENT_SHADER, FRAG));
  gl.linkProgram(prog);
  gl.useProgram(prog);
  gl.bindBuffer(gl.ARRAY_BUFFER, gl.createBuffer());
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 3, -1, -1, 3]), gl.STATIC_DRAW);
  const loc = gl.getAttribLocation(prog, 'p');
  gl.enableVertexAttribArray(loc);
  gl.vertexAttribPointer(loc, 2, gl.FLOAT, false, 0, 0);

  const tex = gl.createTexture();
  gl.bindTexture(gl.TEXTURE_2D, tex);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA8, SIZE, SIZE, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  const fb = gl.createFramebuffer();
  gl.bindFramebuffer(gl.FRAMEBUFFER, fb);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, tex, 0);
  gl.viewport(0, 0, SIZE, SIZE);

  let mismatches = 0, total = 0;
  const px = new Uint8Array(SIZE * SIZE * 4);
  for (const seed of SEEDS) {
    gl.uniform1i(gl.getUniformLocation(prog, 'uSeed'), seed);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
    gl.readPixels(0, 0, SIZE, SIZE, gl.RGBA, gl.UNSIGNED_BYTE, px);
    for (let y = 0; y < SIZE; y++) {
      for (let x = 0; x < SIZE; x++) {
        const o = (y * SIZE + x) * 4;
        const gpu = (px[o] | (px[o + 1] << 8) | (px[o + 2] << 16) | (px[o + 3] << 24)) >>> 0;
        if (gpu !== hash3(x - 32, y - 32, seed)) mismatches++;
        total++;
      }
    }
  }
  return { ok: mismatches === 0, mismatches, total };
}

const result = run();
window.__hashParity = result;
document.getElementById('out')!.textContent = JSON.stringify(result);
```

`src/debug/hashParity.ts` sets `window.__hashParity`; the global type comes from `src/render/types.ts`. Add `import '../render/types';` at the top if TypeScript does not see the global.

- [ ] **Step 5: Register the page in `vite.config.ts`**

Replace the `input` object:
```ts
      input: {
        main: fileURLToPath(new URL('./index.html', import.meta.url)),
        hashTest: fileURLToPath(new URL('./hash-test.html', import.meta.url)),
      },
```

- [ ] **Step 6: Run the parity test in both browsers**

Run: `npx playwright test e2e/hash-parity.spec.ts`
Expected: 2 passed (chromium, webkit), `mismatches: 0`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(render): GLSL hash with bit-exact browser parity test"
```

---

### Task 10: Sprite atlas and near tier

**Files:**
- Create: `src/render/atlas.ts`, `src/render/shaders/near.ts`, `src/render/tileManager.ts`, `src/render/nearTier.ts`, `e2e/near.spec.ts`
- Modify: `src/render/createScene.ts` (register the layer)

**Interfaces:**
- Consumes: `Layer`, `PlaceContext`, `CrowdParams`, `FrameContext` (Task 8), `tilesInRange`, `parseTileKey` (Task 8), `paletteUniforms`, `fogUniforms`, `applyFog` (Task 8), `buildNearTile`, `NEAR_TILE` (Task 6), `rasterBounds` (Task 5), palettes + `POSE_COUNT` (Task 2).
- Produces:
  - `ATLAS_W = 256`, `ATLAS_H = 256`, `CELL_W = 64`, `CELL_H = 160`, `PX_PER_M = 80`; `interface Atlas { weights: THREE.DataTexture; shadow: THREE.DataTexture }`; `createAtlas(): Atlas`
  - Atlas encoding: `weights` RGBA = (shirt, pants, skin, hair) coverage weights; `shadow` R = shadow coverage. Figure cells sit in the bottom 160 rows (v ∈ [0, 0.625]), one 64-px column per pose.
  - `class TileManager { group: THREE.Group; sync(wanted: string[], deadline: number): void; clear(): void; count(): number }` with builder `(tx, tz) => { obj: THREE.Object3D; count: number } | null`
  - `class NearTier implements Layer` (kind `'near'`)

- [ ] **Step 1: Write the failing e2e test**

`e2e/near.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('near tier draws sprites on the National Mall', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?place=national-mall&count=1000&density=2.5');
  await page.waitForFunction(() => (window.__crowdStats?.nearSprites ?? 0) > 0, null, { timeout: 60_000 });
  await page.waitForTimeout(1500); // let the camera flight finish
  await page.getByTestId('scene').screenshot({ path: info.outputPath('mall-1k.png') });
  expect(errors).toEqual([]);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/near.spec.ts`
Expected: FAIL (timeout: nearSprites stays 0).

- [ ] **Step 3: Write `src/render/atlas.ts`**

```ts
import * as THREE from 'three';
import { POSE_COUNT } from '../crowd/person';

export const ATLAS_W = 256;
export const ATLAS_H = 256;
export const CELL_W = 64;
export const CELL_H = 160;
export const PX_PER_M = 80; // 160 px cell = 2.0 m

// Pure mask colors; the shader replaces each with the person's palette color.
const MASK = { shirt: '#ff0000', pants: '#00ff00', skin: '#0000ff', hair: '#000000' };
const H = 1.75; // reference figure height in meters (scaled per person in the shader)

export interface Atlas { weights: THREE.DataTexture; shadow: THREE.DataTexture; }

type Ctx = CanvasRenderingContext2D;
const m = (v: number) => v * PX_PER_M;
function rr(ctx: Ctx, x: number, y: number, w: number, h: number, r: number) {
  ctx.beginPath();
  ctx.roundRect(x, y, w, h, Math.min(r, w / 2, h / 2));
  ctx.fill();
}
function circle(ctx: Ctx, x: number, y: number, r: number) {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  ctx.fill();
}

/** Style B "simple human": hair, arms, two legs. Pose 0 arms down, 1 phone up, 2 wide stance, 3 hands in pockets. */
export function drawFigure(ctx: Ctx, pose: number, ox: number): void {
  const fx = ox + CELL_W / 2;
  const fy = ATLAS_H - 4; // feet line
  const top = fy - m(H - 0.22); // shoulders
  const stance = pose === 2 ? 0.05 : 0;

  ctx.fillStyle = MASK.pants;
  rr(ctx, fx - m(0.15 + stance), fy - m(0.86), m(0.13), m(0.86), m(0.03));
  rr(ctx, fx + m(0.02 + stance), fy - m(0.86), m(0.13), m(0.86), m(0.03));

  ctx.fillStyle = MASK.shirt;
  rr(ctx, fx - m(0.21), top, m(0.42), m(H - 1.04), m(0.07));

  const armDown = (x: number) => {
    ctx.fillStyle = MASK.shirt;
    rr(ctx, x, top + m(0.03), m(0.09), m(0.58), m(0.04));
    ctx.fillStyle = MASK.skin;
    circle(ctx, x + m(0.045), top + m(0.64), m(0.045));
  };
  if (pose === 0 || pose === 2) {
    armDown(fx - m(0.29));
    armDown(fx + m(0.2));
  } else if (pose === 1) {
    ctx.fillStyle = MASK.shirt;
    rr(ctx, fx - m(0.29), top - m(0.34), m(0.09), m(0.4), m(0.04));
    ctx.fillStyle = MASK.skin;
    circle(ctx, fx - m(0.245), top - m(0.36), m(0.045));
    armDown(fx + m(0.2));
  } else {
    ctx.fillStyle = MASK.shirt;
    rr(ctx, fx - m(0.28), top + m(0.03), m(0.09), m(0.45), m(0.04));
    rr(ctx, fx + m(0.19), top + m(0.03), m(0.09), m(0.45), m(0.04));
  }

  const hy = fy - m(H - 0.12);
  ctx.fillStyle = MASK.skin;
  circle(ctx, fx, hy, m(0.11));
  ctx.fillStyle = MASK.hair;
  ctx.beginPath();
  ctx.arc(fx, hy, m(0.115), Math.PI * 1.02, Math.PI * 1.98);
  ctx.fill();
}

function drawShadow(ctx: Ctx, ox: number): void {
  ctx.fillStyle = '#000000';
  ctx.beginPath();
  ctx.ellipse(ox + CELL_W / 2 + m(0.06), ATLAS_H - 4, m(0.3), m(0.07), 0, 0, Math.PI * 2);
  ctx.fill();
}

function canvas(): [HTMLCanvasElement, Ctx] {
  const c = document.createElement('canvas');
  c.width = ATLAS_W;
  c.height = ATLAS_H;
  return [c, c.getContext('2d', { willReadFrequently: true })!];
}

function texture(data: Uint8Array, format: THREE.PixelFormat): THREE.DataTexture {
  const t = new THREE.DataTexture(data, ATLAS_W, ATLAS_H, format, THREE.UnsignedByteType);
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.magFilter = THREE.LinearFilter;
  t.generateMipmaps = true;
  t.unpackAlignment = 1;
  t.needsUpdate = true;
  return t;
}

export function createAtlas(): Atlas {
  const [, fig] = canvas();
  const [, sh] = canvas();
  for (let pose = 0; pose < POSE_COUNT; pose++) {
    drawFigure(fig, pose, pose * CELL_W);
    drawShadow(sh, pose * CELL_W);
  }
  const f = fig.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
  const s = sh.getImageData(0, 0, ATLAS_W, ATLAS_H).data;
  const weights = new Uint8Array(ATLAS_W * ATLAS_H * 4);
  const shadow = new Uint8Array(ATLAS_W * ATLAS_H);
  for (let row = 0; row < ATLAS_H; row++) {
    const src = (ATLAS_H - 1 - row) * ATLAS_W; // flip: data row 0 is the bottom (v = 0)
    for (let x = 0; x < ATLAS_W; x++) {
      const i = (src + x) * 4, o = row * ATLAS_W + x;
      const a = f[i + 3] / 255, r = f[i] / 255, g = f[i + 1] / 255, b = f[i + 2] / 255;
      weights[o * 4] = Math.round(r * a * 255);
      weights[o * 4 + 1] = Math.round(g * a * 255);
      weights[o * 4 + 2] = Math.round(b * a * 255);
      weights[o * 4 + 3] = Math.round(Math.max(0, 1 - (r + g + b)) * a * 255);
      shadow[o] = s[i + 3];
    }
  }
  return { weights: texture(weights, THREE.RGBAFormat), shadow: texture(shadow, THREE.RedFormat) };
}
```

- [ ] **Step 4: Write `src/render/shaders/near.ts`**

```ts
import { HAIR, NEUTRAL_PANTS, NEUTRAL_SHIRT, PANTS, SHIRT, SKIN } from '../../crowd/palettes';
import { CELL_H, ATLAS_H, CELL_W, ATLAS_W, PX_PER_M } from '../atlas';

const QUAD_W = CELL_W / PX_PER_M; // 0.8 m
const QUAD_H = CELL_H / PX_PER_M; // 2.0 m
const FOOT = 4 / PX_PER_M; // feet sit 4 px above the cell bottom

export const NEAR_VERT = /* glsl */ `
in vec4 aPerson; // center x, center z, height (m), pose
in vec2 aJitter;
in vec4 aLook;   // shirt, pants, skin, hair
in vec2 aRand;   // lod dissolve, highlight pick
uniform vec3 uCamPos;
uniform vec2 uLodCenter;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform float uRadius;
uniform float uOneIn;
uniform int uHighlight;
out vec2 vUv;
out float vFogDist;
flat out ivec4 vLook;
flat out int vPick;
void main() {
  vec2 center = aPerson.xy;
  float fade = smoothstep(uFadeStart, uFadeEnd, distance(center, uLodCenter));
  if (length(center) >= uRadius || aRand.x < fade) { gl_Position = vec4(2.0, 2.0, 2.0, 1.0); return; }
  vec3 base = vec3(center.x + aJitter.x, 0.0, center.y + aJitter.y);
  vec2 toCam = normalize(uCamPos.xz - base.xz);
  vec3 right = vec3(toCam.y, 0.0, -toCam.x);
  float s = aPerson.z / 1.75;
  vec3 world = base + right * (position.x * ${QUAD_W.toFixed(4)} * s)
             + vec3(0.0, (position.y * ${QUAD_H.toFixed(4)} - ${FOOT.toFixed(4)}) * s, 0.0);
  vUv = vec2((aPerson.w + position.x + 0.5) * ${(CELL_W / ATLAS_W).toFixed(4)}, position.y * ${(CELL_H / ATLAS_H).toFixed(4)});
  vLook = ivec4(aLook);
  vPick = (uHighlight == 1 && aRand.y < 1.0 / uOneIn) ? 1 : 0;
  vFogDist = distance(world, uCamPos);
  gl_Position = projectionMatrix * viewMatrix * vec4(world, 1.0);
}
`;

export const NEAR_FRAG = /* glsl */ `
uniform sampler2D uAtlas;
uniform sampler2D uShadow;
uniform vec3 uShirt[${SHIRT.length}];
uniform vec3 uPants[${PANTS.length}];
uniform vec3 uSkin[${SKIN.length}];
uniform vec3 uHair[${HAIR.length}];
uniform vec3 uNeutral[${NEUTRAL_SHIRT.length}];
uniform vec3 uNeutralPants[${NEUTRAL_PANTS.length}];
uniform vec3 uAccent;
uniform int uHighlight;
uniform vec3 uShadowColor;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
in vec2 vUv;
in float vFogDist;
flat in ivec4 vLook;
flat in int vPick;
void main() {
  vec4 w = texture(uAtlas, vUv);
  float cov = w.r + w.g + w.b + w.a;
  vec3 col;
  if (cov >= 0.5) {
    vec3 shirt = uShirt[vLook.x];
    vec3 pants = uPants[vLook.y];
    if (uHighlight == 1) {
      shirt = vPick == 1 ? uAccent : uNeutral[vLook.x % ${NEUTRAL_SHIRT.length}];
      pants = uNeutralPants[vLook.y % ${NEUTRAL_PANTS.length}];
    }
    col = (shirt * w.r + pants * w.g + uSkin[vLook.z] * w.b + uHair[vLook.w] * w.a) / cov;
  } else if (texture(uShadow, vUv).r >= 0.5) {
    col = uShadowColor;
  } else {
    discard;
  }
  gl_FragColor = vec4(mix(col, uFogColor, smoothstep(uFogNear, uFogFar, vFogDist)), 1.0);
}
`;
```

- [ ] **Step 5: Write `src/render/tileManager.ts`**

```ts
import * as THREE from 'three';
import { parseTileKey } from './tileSet';

export interface BuiltTile { obj: THREE.Mesh | THREE.Points; count: number; }
type Entry = BuiltTile | null; // null = tile has nobody in it; remembered so it isn't rebuilt

export class TileManager {
  readonly group = new THREE.Group();
  private tiles = new Map<string, Entry>();

  constructor(private readonly build: (tx: number, tz: number) => BuiltTile | null) {}

  /** Drop tiles no longer wanted, then build missing ones nearest-first until the deadline. */
  sync(wanted: string[], deadline: number): void {
    const want = new Set(wanted);
    for (const [k, t] of this.tiles) {
      if (!want.has(k)) {
        this.drop(t);
        this.tiles.delete(k);
      }
    }
    for (const k of wanted) {
      if (this.tiles.has(k)) continue;
      if (performance.now() >= deadline) break;
      const [tx, tz] = parseTileKey(k);
      const t = this.build(tx, tz);
      this.tiles.set(k, t);
      if (t) this.group.add(t.obj);
    }
  }

  clear(): void {
    for (const t of this.tiles.values()) this.drop(t);
    this.tiles.clear();
  }

  count(): number {
    let n = 0;
    for (const t of this.tiles.values()) if (t) n += t.count;
    return n;
  }

  private drop(t: Entry): void {
    if (!t) return;
    this.group.remove(t.obj);
    t.obj.geometry.dispose();
  }
}
```

- [ ] **Step 6: Write `src/render/nearTier.ts`**

```ts
import * as THREE from 'three';
import { SHADOW } from '../crowd/palettes';
import { buildNearTile, NEAR_TILE } from '../crowd/tiles';
import { rasterBounds } from '../layout/raster';
import type { Atlas } from './atlas';
import { NEAR_FRAG, NEAR_VERT } from './shaders/near';
import { TileManager, type BuiltTile } from './tileManager';
import { tilesInRange } from './tileSet';
import type { CrowdParams, FrameContext, Layer, PlaceContext } from './types';
import { applyFog, fogUniforms, paletteUniforms } from './uniforms';

export class NearTier implements Layer {
  readonly kind = 'near' as const;
  readonly object: THREE.Group;
  private readonly tiles: TileManager;
  private readonly material: THREE.ShaderMaterial;
  private readonly quad = new THREE.PlaneGeometry(1, 1).translate(0, 0.5, 0);
  private ctx: PlaceContext | null = null;
  private crowd: CrowdParams | null = null;

  constructor(atlas: Atlas) {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: NEAR_VERT,
      fragmentShader: NEAR_FRAG,
      uniforms: {
        uAtlas: { value: atlas.weights },
        uShadow: { value: atlas.shadow },
        uLodCenter: { value: new THREE.Vector2() },
        uFadeStart: { value: 0 },
        uFadeEnd: { value: 1 },
        uRadius: { value: 0 },
        uOneIn: { value: 50 },
        uHighlight: { value: 0 },
        uShadowColor: { value: new THREE.Color(SHADOW) },
        ...paletteUniforms(),
        ...fogUniforms(),
      },
    });
    this.tiles = new TileManager((tx, tz) => this.buildTile(tx, tz));
    this.object = this.tiles.group;
  }

  setPlace(ctx: PlaceContext): void {
    this.ctx = ctx;
    this.tiles.clear();
  }

  setCrowd(p: CrowdParams): void {
    if (this.crowd?.spacing !== p.spacing) this.tiles.clear();
    this.crowd = p;
    const u = this.material.uniforms;
    u.uRadius.value = p.radius;
    u.uHighlight.value = p.highlight ? 1 : 0;
    u.uOneIn.value = p.highlight?.oneIn ?? 50;
  }

  frame(f: FrameContext): void {
    if (!this.ctx || !this.crowd) return;
    const u = this.material.uniforms;
    (u.uLodCenter.value as THREE.Vector2).copy(f.lodCenter);
    u.uFadeStart.value = f.lod.nearStart;
    u.uFadeEnd.value = f.lod.nearEnd;
    applyFog(u, f);
    const wanted = tilesInRange({ x: f.lodCenter.x, z: f.lodCenter.y }, f.lod.nearEnd, 0, this.crowd.radius, NEAR_TILE, rasterBounds(this.ctx.raster));
    this.tiles.sync(wanted, f.deadline);
  }

  count(): number {
    return this.tiles.count();
  }

  dispose(): void {
    this.tiles.clear();
    this.material.dispose();
    this.quad.dispose();
  }

  private buildTile(tx: number, tz: number): BuiltTile | null {
    const d = buildNearTile(this.ctx!.raster, this.crowd!.spacing, this.ctx!.seed, tx, tz);
    if (d.count === 0) return null;
    const g = new THREE.InstancedBufferGeometry();
    g.index = this.quad.index;
    g.setAttribute('position', this.quad.getAttribute('position'));
    g.setAttribute('aPerson', new THREE.InstancedBufferAttribute(d.person, 4));
    g.setAttribute('aJitter', new THREE.InstancedBufferAttribute(d.jitter, 2));
    g.setAttribute('aLook', new THREE.InstancedBufferAttribute(d.look, 4));
    g.setAttribute('aRand', new THREE.InstancedBufferAttribute(d.rand, 2));
    g.instanceCount = d.count;
    // Instanced geometry has no useful bounds of its own; give it the tile's so frustum culling works.
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((tx + 0.5) * NEAR_TILE, 1, (tz + 0.5) * NEAR_TILE), NEAR_TILE * 0.75 + 2);
    const mesh = new THREE.Mesh(g, this.material);
    mesh.renderOrder = 10;
    return { obj: mesh, count: d.count };
  }
}
```

- [ ] **Step 7: Register the layer in `src/render/createScene.ts`**

Add imports:
```ts
import { createAtlas } from './atlas';
import { NearTier } from './nearTier';
```
Replace:
```ts
  // Crowd tiers are added in later tasks: near sprites, mid dots, far ground shader.
  const layers: Layer[] = [];
```
with:
```ts
  const layers: Layer[] = [new NearTier(createAtlas())];
```

- [ ] **Step 8: Run tests**

Run: `npm test && npm run e2e`
Expected: all PASS; `test-results/**/mall-1k.png` exists.

- [ ] **Step 9: Look at it in Chrome and Safari**

Run `npm run dev`. In the Browser pane (front the tab, set 1440×900) and in Safari, open `http://localhost:5173/?place=national-mall&count=180000`. Compare with the approved mockup (style B, warm paper, everyday palette). Check:
- people stand upright from every orbit angle, never mirrored or sideways;
- four poses visible (phone-up arms here and there);
- no people on the Reflecting Pool;
- the crowd edge is a clean arc from the Capitol end;
- sprites fade out in a band far from the camera (no mid tier yet, so the far crowd is empty: expected for now).
Open `?debug` later (Task 12) for numbers; for now watch the frame rate in Chrome DevTools' FPS meter.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(render): sprite atlas and near sprite tier"
```

---

### Task 11: Mid and far tiers

**Files:**
- Create: `src/render/shaders/mid.ts`, `src/render/shaders/far.ts`, `src/render/midTier.ts`, `src/render/farTier.ts`, `e2e/lod.spec.ts`
- Modify: `src/render/createScene.ts` (register layers)

**Interfaces:**
- Consumes: everything Task 10 consumes, plus `buildMidTile`, `MID_TILE` (Task 6), `HASH_GLSL` (Task 9), `Raster` (Task 5).
- Produces: `class MidTier implements Layer` (kind `'mid'`), `class FarTier implements Layer` (kind `'far'`, `count()` returns 0).
- Dissolve contract (all tiers use the same `lodRand` = stream 7 and the lattice **center** distance to `lodCenter`):
  - near draws iff `lodRand >= smoothstep(nearStart, nearEnd, d)`
  - mid draws iff `lodRand < smoothstep(nearStart, nearEnd, d)` and `lodRand >= smoothstep(midStart, midEnd, d)`
  - far draws iff `lodRand < smoothstep(midStart, midEnd, d)`
  - every tier also requires `|center| < radius` and a usable center.

- [ ] **Step 1: Write the failing e2e test**

`e2e/lod.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('Manhattan at 20M renders dots and reports no overflow', async ({ page }, info) => {
  const errors: string[] = [];
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await page.goto('/?place=manhattan&count=20000000&density=2.5');
  // Software GL in CI can shrink the sprite budget; either tier drawing proves the pipeline.
  await page.waitForFunction(() => (window.__crowdStats?.midPoints ?? 0) + (window.__crowdStats?.nearSprites ?? 0) > 0, null, { timeout: 60_000 });
  const s = await page.evaluate(() => window.__crowdStats!);
  expect(s.overflow).toBe(false);
  expect(s.radius).toBeGreaterThan(1000);
  await page.waitForTimeout(1500);
  await page.getByTestId('scene').screenshot({ path: info.outputPath('manhattan-20m.png') });
  expect(errors).toEqual([]);
});

test('Times Square at 1M overflows', async ({ page }) => {
  await page.goto('/?place=times-square&count=1000000&density=2.5');
  await page.waitForFunction(() => window.__crowdStats !== undefined);
  const s = await page.evaluate(() => window.__crowdStats!);
  expect(s.overflow).toBe(true);
  expect(s.capacity).toBeLessThan(1_000_000);
});
```

- [ ] **Step 2: Run to verify it fails**

Run: `npx playwright test e2e/lod.spec.ts`
Expected: first test FAILS (midPoints stays 0); the overflow test already passes.

- [ ] **Step 3: Write `src/render/shaders/mid.ts`**

```ts
import { NEUTRAL_SHIRT, SHIRT } from '../../crowd/palettes';

export const MID_VERT = /* glsl */ `
in vec2 aJitter;
in float aShirt;
in vec2 aRand; // lod dissolve, highlight pick
uniform vec2 uLodCenter;
uniform float uNearStart;
uniform float uNearEnd;
uniform float uMidStart;
uniform float uMidEnd;
uniform float uRadius;
uniform float uPxPerUnit;
uniform vec3 uCamPos;
uniform int uHighlight;
uniform float uOneIn;
uniform vec3 uShirt[${SHIRT.length}];
uniform vec3 uNeutral[${NEUTRAL_SHIRT.length}];
uniform vec3 uAccent;
out vec3 vColor;
out float vFogDist;
void main() {
  vec2 center = position.xz;
  float d = distance(center, uLodCenter);
  float nearFade = smoothstep(uNearStart, uNearEnd, d);
  float midFade = smoothstep(uMidStart, uMidEnd, d);
  if (length(center) >= uRadius || aRand.x >= nearFade || aRand.x < midFade) {
    gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
    gl_PointSize = 0.0;
    return;
  }
  vec3 world = vec3(center.x + aJitter.x, 0.9, center.y + aJitter.y);
  vec4 mv = modelViewMatrix * vec4(world, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(0.5 * uPxPerUnit / -mv.z, 1.0, 6.0);
  int shirt = int(aShirt);
  if (uHighlight == 1) vColor = aRand.y < 1.0 / uOneIn ? uAccent : uNeutral[shirt % ${NEUTRAL_SHIRT.length}];
  else vColor = uShirt[shirt];
  vFogDist = distance(world, uCamPos);
}
`;

export const MID_FRAG = /* glsl */ `
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
in vec3 vColor;
in float vFogDist;
void main() {
  gl_FragColor = vec4(mix(vColor, uFogColor, smoothstep(uFogNear, uFogFar, vFogDist)), 1.0);
}
`;
```

- [ ] **Step 4: Write `src/render/shaders/far.ts`**

```ts
import { NEUTRAL_SHIRT, SHIRT } from '../../crowd/palettes';
import { STREAM } from '../../crowd/hash';
import { HASH_GLSL } from './hash.glsl';

export const FAR_VERT = /* glsl */ `
out vec3 vWorld;
void main() {
  vec4 w = modelMatrix * vec4(position, 1.0);
  vWorld = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}
`;

export const FAR_FRAG = /* glsl */ `
precision highp int;
uniform sampler2D uMask;
uniform vec2 uMaskOrigin;
uniform float uMaskCell;
uniform ivec2 uMaskRes;
uniform float uSpacing;
uniform float uRadius;
uniform int uSeed;
uniform vec2 uLodCenter;
uniform float uFadeStart;
uniform float uFadeEnd;
uniform vec3 uShirt[${SHIRT.length}];
uniform vec3 uNeutral[${NEUTRAL_SHIRT.length}];
uniform vec3 uAccent;
uniform int uHighlight;
uniform float uOneIn;
uniform vec3 uGround;
uniform vec3 uFogColor;
uniform float uFogNear;
uniform float uFogFar;
uniform vec3 uCamPos;
in vec3 vWorld;
${HASH_GLSL}
const vec3 CROWD_MEAN = vec3(0.47, 0.45, 0.42);

bool usable(vec2 p) {
  ivec2 c = ivec2(floor((p - uMaskOrigin) / uMaskCell));
  if (c.x < 0 || c.y < 0 || c.x >= uMaskRes.x || c.y >= uMaskRes.y) return false;
  return texelFetch(uMask, c, 0).r > 0.0;
}

vec3 personColor(ivec2 ik) {
  int shirt = pickIndex(hash3(ik.x, ik.y, uSeed + ${STREAM.shirt}), ${SHIRT.length});
  if (uHighlight == 1) {
    if (unitHash(hash3(ik.x, ik.y, uSeed + ${STREAM.pick})) < 1.0 / uOneIn) return uAccent;
    return uNeutral[shirt % ${NEUTRAL_SHIRT.length}];
  }
  return uShirt[shirt];
}

void main() {
  vec2 p = vWorld.xz;
  float foot = max(fwidth(p.x), fwidth(p.y));
  vec3 col;
  float alpha;
  if (foot < uSpacing) {
    // One cell per person: same occupancy rule and dissolve as the CPU tiers.
    ivec2 ik = ivec2(floor(p / uSpacing));
    vec2 center = (vec2(ik) + 0.5) * uSpacing;
    if (length(center) >= uRadius || !usable(center)) discard;
    float fade = smoothstep(uFadeStart, uFadeEnd, distance(center, uLodCenter));
    if (unitHash(hash3(ik.x, ik.y, uSeed + ${STREAM.lod})) >= fade) discard;
    col = personColor(ik);
    alpha = 0.8;
  } else {
    // Many people per pixel: speckle at a power-of-two multiple of the spacing so it doesn't shimmer.
    if (length(p) >= uRadius || !usable(p)) discard;
    float fade = smoothstep(uFadeStart, uFadeEnd, distance(p, uLodCenter));
    float level = exp2(ceil(log2(foot / uSpacing)));
    ivec2 ik = ivec2(floor(p / (uSpacing * level)));
    col = mix(personColor(ik), CROWD_MEAN, 0.5);
    alpha = 0.8 * fade;
  }
  vec3 c = mix(uGround, col, alpha);
  gl_FragColor = vec4(mix(c, uFogColor, smoothstep(uFogNear, uFogFar, distance(vWorld, uCamPos))), 1.0);
}
`;
```

- [ ] **Step 5: Write `src/render/midTier.ts`**

```ts
import * as THREE from 'three';
import { buildMidTile, MID_TILE } from '../crowd/tiles';
import { rasterBounds } from '../layout/raster';
import { MID_FRAG, MID_VERT } from './shaders/mid';
import { TileManager, type BuiltTile } from './tileManager';
import { tilesInRange } from './tileSet';
import type { CrowdParams, FrameContext, Layer, PlaceContext } from './types';
import { applyFog, fogUniforms, paletteUniforms } from './uniforms';

export class MidTier implements Layer {
  readonly kind = 'mid' as const;
  readonly object: THREE.Group;
  private readonly tiles: TileManager;
  private readonly material: THREE.ShaderMaterial;
  private ctx: PlaceContext | null = null;
  private crowd: CrowdParams | null = null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: MID_VERT,
      fragmentShader: MID_FRAG,
      uniforms: {
        uLodCenter: { value: new THREE.Vector2() },
        uNearStart: { value: 0 },
        uNearEnd: { value: 1 },
        uMidStart: { value: 2 },
        uMidEnd: { value: 3 },
        uRadius: { value: 0 },
        uPxPerUnit: { value: 1000 },
        uHighlight: { value: 0 },
        uOneIn: { value: 50 },
        ...paletteUniforms(),
        ...fogUniforms(),
      },
    });
    this.tiles = new TileManager((tx, tz) => this.buildTile(tx, tz));
    this.object = this.tiles.group;
  }

  setPlace(ctx: PlaceContext): void {
    this.ctx = ctx;
    this.tiles.clear();
  }

  setCrowd(p: CrowdParams): void {
    if (this.crowd?.spacing !== p.spacing) this.tiles.clear();
    this.crowd = p;
    const u = this.material.uniforms;
    u.uRadius.value = p.radius;
    u.uHighlight.value = p.highlight ? 1 : 0;
    u.uOneIn.value = p.highlight?.oneIn ?? 50;
  }

  frame(f: FrameContext): void {
    if (!this.ctx || !this.crowd) return;
    const u = this.material.uniforms;
    (u.uLodCenter.value as THREE.Vector2).copy(f.lodCenter);
    u.uNearStart.value = f.lod.nearStart;
    u.uNearEnd.value = f.lod.nearEnd;
    u.uMidStart.value = f.lod.midStart;
    u.uMidEnd.value = f.lod.midEnd;
    u.uPxPerUnit.value = f.pxPerUnit;
    applyFog(u, f);
    const wanted = tilesInRange({ x: f.lodCenter.x, z: f.lodCenter.y }, f.lod.midEnd, f.lod.nearStart, this.crowd.radius, MID_TILE, rasterBounds(this.ctx.raster));
    this.tiles.sync(wanted, f.deadline);
  }

  count(): number {
    return this.tiles.count();
  }

  dispose(): void {
    this.tiles.clear();
    this.material.dispose();
  }

  private buildTile(tx: number, tz: number): BuiltTile | null {
    const d = buildMidTile(this.ctx!.raster, this.crowd!.spacing, this.ctx!.seed, tx, tz);
    if (d.count === 0) return null;
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(d.position, 3));
    g.setAttribute('aJitter', new THREE.BufferAttribute(d.jitter, 2));
    g.setAttribute('aShirt', new THREE.BufferAttribute(d.shirt, 1));
    g.setAttribute('aRand', new THREE.BufferAttribute(d.rand, 2));
    g.boundingSphere = new THREE.Sphere(new THREE.Vector3((tx + 0.5) * MID_TILE, 1, (tz + 0.5) * MID_TILE), MID_TILE * 0.75 + 2);
    const pts = new THREE.Points(g, this.material);
    pts.renderOrder = 5;
    return { obj: pts, count: d.count };
  }
}
```

- [ ] **Step 6: Write `src/render/farTier.ts`**

```ts
import * as THREE from 'three';
import { GROUND } from '../crowd/palettes';
import { FAR_FRAG, FAR_VERT } from './shaders/far';
import type { CrowdParams, FrameContext, Layer, PlaceContext } from './types';
import { applyFog, fogUniforms, paletteUniforms } from './uniforms';

export class FarTier implements Layer {
  readonly kind = 'far' as const;
  readonly object = new THREE.Group();
  private readonly material: THREE.ShaderMaterial;
  private mesh: THREE.Mesh | null = null;
  private mask: THREE.DataTexture | null = null;

  constructor() {
    this.material = new THREE.ShaderMaterial({
      glslVersion: THREE.GLSL3,
      vertexShader: FAR_VERT,
      fragmentShader: FAR_FRAG,
      depthWrite: false,
      uniforms: {
        uMask: { value: null },
        uMaskOrigin: { value: new THREE.Vector2() },
        uMaskCell: { value: 1 },
        uMaskRes: { value: new THREE.Vector2(1, 1) },
        uSpacing: { value: 1 },
        uRadius: { value: 0 },
        uSeed: { value: 0 },
        uLodCenter: { value: new THREE.Vector2() },
        uFadeStart: { value: 0 },
        uFadeEnd: { value: 1 },
        uHighlight: { value: 0 },
        uOneIn: { value: 50 },
        uGround: { value: new THREE.Color(GROUND) },
        ...paletteUniforms(),
        ...fogUniforms(),
      },
    });
  }

  setPlace(ctx: PlaceContext): void {
    this.disposeMesh();
    const r = ctx.raster;
    const mask = new THREE.DataTexture(r.mask, r.w, r.h, THREE.RedFormat, THREE.UnsignedByteType);
    mask.minFilter = THREE.NearestFilter;
    mask.magFilter = THREE.NearestFilter;
    mask.generateMipmaps = false;
    mask.unpackAlignment = 1;
    mask.needsUpdate = true;
    this.mask = mask;
    const u = this.material.uniforms;
    u.uMask.value = mask;
    (u.uMaskOrigin.value as THREE.Vector2).set(r.x0, r.z0);
    u.uMaskCell.value = r.cell;
    (u.uMaskRes.value as THREE.Vector2).set(r.w, r.h);
    u.uSeed.value = ctx.seed;
    const w = r.w * r.cell, h = r.h * r.cell;
    this.mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h).rotateX(-Math.PI / 2), this.material);
    this.mesh.position.set(r.x0 + w / 2, 0.01, r.z0 + h / 2);
    this.mesh.renderOrder = 1;
    this.object.add(this.mesh);
  }

  setCrowd(p: CrowdParams): void {
    const u = this.material.uniforms;
    u.uSpacing.value = p.spacing;
    u.uRadius.value = p.radius;
    u.uHighlight.value = p.highlight ? 1 : 0;
    u.uOneIn.value = p.highlight?.oneIn ?? 50;
  }

  frame(f: FrameContext): void {
    const u = this.material.uniforms;
    (u.uLodCenter.value as THREE.Vector2).copy(f.lodCenter);
    u.uFadeStart.value = f.lod.midStart;
    u.uFadeEnd.value = f.lod.midEnd;
    applyFog(u, f);
  }

  count(): number {
    return 0;
  }

  dispose(): void {
    this.disposeMesh();
    this.material.dispose();
  }

  private disposeMesh(): void {
    if (this.mesh) {
      this.object.remove(this.mesh);
      this.mesh.geometry.dispose();
      this.mesh = null;
    }
    this.mask?.dispose();
    this.mask = null;
  }
}
```

- [ ] **Step 7: Register both layers in `src/render/createScene.ts`**

Add imports:
```ts
import { FarTier } from './farTier';
import { MidTier } from './midTier';
```
Replace:
```ts
  const layers: Layer[] = [new NearTier(createAtlas())];
```
with:
```ts
  // Order matters: near builds first each frame so it gets the tile-building budget.
  const layers: Layer[] = [new NearTier(createAtlas()), new MidTier(), new FarTier()];
```

- [ ] **Step 8: Run tests**

Run: `npm test && npm run e2e`
Expected: all PASS; `manhattan-20m.png` shows a large speckled crowd shape on the island.

- [ ] **Step 9: Look for seams in Chrome and Safari**

`npm run dev`, then in the Browser pane (fronted, 1440×900) and Safari:
- `?place=national-mall&count=180000`: zoom slowly from eye level out to the whole Mall. Sprites should dissolve into dots and dots into the ground speckle without a visible ring, gap or doubled band.
- `?place=manhattan&count=20000000`: crowd fills a disk around the south of Central Park clipped by the shoreline; reservoir and lakes stay empty; no shimmering when orbiting.
- `?place=open-field&count=50000000&density=1`: fills nearly the whole circle.
If a band appears at a tier boundary, compare the three dissolve formulas in the Interfaces block above against the shader code before changing anything else.

- [ ] **Step 10: Commit**

```bash
git add -A
git commit -m "feat(render): mid dot tier and far ground-shader tier with shared dissolve"
```

---

### Task 12: Sidebar

**Files:**
- Create: `src/ui/useStore.ts`, `src/ui/ChipGroup.tsx`, `src/ui/CountControl.tsx`, `src/ui/HighlightControl.tsx`, `src/ui/Sidebar.tsx`, `src/ui/sidebar.css`, `e2e/ui.spec.ts`
- Modify: `src/App.tsx`

**Interfaces:**
- Consumes: `Store`, `SceneState`, `Density`, `DENSITIES` (Task 7), `countToPos`, `posToCount`, `parseCount`, `formatCount`, `shortCount` (Task 7), `compareLines` (Task 7), `PLACES`, `getPlace` (Task 4), `SceneStats` (Task 8).
- Produces: `Sidebar` component; `useStore<T>(store: Store<T>): T`.

- [ ] **Step 1: Run `me:unslop` in constraints mode for the sidebar**

Invoke the `me:unslop` skill for "sidebar for a crowd visualizer: big count, log slider, place chips, density chips, comparisons, camera buttons, highlight toggle, overflow notice". Write the constraints it returns into the PR notes file `docs/superpowers/notes/sidebar-unslop.md` and follow them in the steps below (they win over the CSS here if they conflict).

- [ ] **Step 2: Write the failing UI e2e test**

`e2e/ui.spec.ts`:
```ts
import { test, expect } from '@playwright/test';

test('typing a count updates the big number and the URL', async ({ page }) => {
  await page.goto('/?place=national-mall&count=1000');
  const input = page.getByLabel('Exact people count');
  await input.fill('1M');
  await input.press('Enter');
  await expect(page.getByTestId('count-big')).toHaveText('1,000,000');
  await expect(page).toHaveURL(/count=1000000/);
});

test('junk input reverts', async ({ page }) => {
  await page.goto('/?count=5000');
  const input = page.getByLabel('Exact people count');
  await input.fill('lots');
  await input.press('Enter');
  await expect(input).toHaveValue('5,000');
});

test('choosing a place and density updates state', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('radio', { name: 'Manhattan' }).click();
  await page.getByRole('radio', { name: 'Packed' }).click();
  await expect(page).toHaveURL(/place=manhattan/);
  await expect(page).toHaveURL(/density=4.5/);
  await expect(page.getByRole('radio', { name: 'Manhattan' })).toHaveAttribute('aria-checked', 'true');
});

test('overflow notice appears for Times Square at 1M', async ({ page }) => {
  await page.goto('/?place=times-square&count=1000000');
  await expect(page.getByRole('status')).toContainText('Overflow: Times Square holds about');
});

test('rapid place switching leaves the last place in charge', async ({ page }) => {
  await page.goto('/?place=national-mall&count=1000000');
  await page.getByRole('radio', { name: 'Manhattan' }).click();
  await page.getByRole('radio', { name: 'Times Square' }).click();
  await page.waitForTimeout(1500);
  const s = await page.evaluate(() => window.__crowdStats!);
  expect(s.overflow).toBe(true); // 1M cannot fit Times Square; a stale Manhattan/Mall state would say false
});

test('highlight toggle writes hl to the URL', async ({ page }) => {
  await page.goto('/');
  await page.getByLabel('Highlight 1 in').check();
  await expect(page).toHaveURL(/hl=50/);
});
```

- [ ] **Step 3: Run to verify it fails**

Run: `npx playwright test e2e/ui.spec.ts`
Expected: FAIL (labels and radios don't exist yet).

- [ ] **Step 4: Write the components**

`src/ui/useStore.ts`:
```ts
import { useSyncExternalStore } from 'react';
import type { Store } from '../state';

export const useStore = <T,>(store: Store<T>): T => useSyncExternalStore(store.subscribe, store.get);
```

`src/ui/ChipGroup.tsx`:
```tsx
export function ChipGroup<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  return (
    <div role="radiogroup" aria-label={label} className="chips">
      {options.map((o) => (
        <button
          key={String(o.value)}
          type="button"
          role="radio"
          aria-checked={o.value === value}
          className={o.value === value ? 'chip on' : 'chip'}
          onClick={() => onChange(o.value)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
```

`src/ui/CountControl.tsx`:
```tsx
import { useEffect, useState } from 'react';
import { countToPos, formatCount, parseCount, posToCount, shortCount } from './logScale';

const STEPS = 1000;
const TICKS = [50, 1_000, 100_000, 1_000_000, 20_000_000];

export function CountControl({ count, onChange }: { count: number; onChange: (n: number) => void }) {
  const [text, setText] = useState(formatCount(count));
  useEffect(() => setText(formatCount(count)), [count]);
  const commit = () => {
    const n = parseCount(text);
    if (n === null) setText(formatCount(count));
    else onChange(n);
  };
  return (
    <div className="count">
      <div className="count-big" data-testid="count-big">{formatCount(count)}</div>
      <div className="muted">people</div>
      <input
        className="count-slider"
        type="range"
        aria-label="People count"
        min={0}
        max={STEPS}
        step={1}
        value={Math.round(countToPos(count) * STEPS)}
        onChange={(e) => onChange(posToCount(Number(e.target.value) / STEPS))}
      />
      <div className="ticks" aria-hidden="true">
        {TICKS.map((t) => (
          <span key={t} style={{ left: `${countToPos(t) * 100}%` }}>{shortCount(t)}</span>
        ))}
      </div>
      <input
        className="count-input"
        aria-label="Exact people count"
        inputMode="numeric"
        value={text}
        onChange={(e) => setText(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => { if (e.key === 'Enter') commit(); }}
      />
    </div>
  );
}
```

`src/ui/HighlightControl.tsx`:
```tsx
export function HighlightControl({
  value,
  onChange,
}: {
  value: null | { oneIn: number };
  onChange: (v: null | { oneIn: number }) => void;
}) {
  const oneIn = value?.oneIn ?? 50;
  return (
    <div className="highlight">
      <label>
        <input type="checkbox" checked={value !== null} onChange={(e) => onChange(e.target.checked ? { oneIn } : null)} />
        Highlight 1 in
      </label>
      <input
        type="number"
        aria-label="Highlight ratio"
        min={2}
        step={1}
        value={oneIn}
        disabled={value === null}
        onChange={(e) => {
          const n = Math.round(Number(e.target.value));
          if (Number.isFinite(n) && n >= 2) onChange({ oneIn: n });
        }}
      />
    </div>
  );
}
```

`src/ui/Sidebar.tsx`:
```tsx
import type { ReactNode } from 'react';
import { PLACES, getPlace } from '../places/index';
import type { SceneStats } from '../render/types';
import type { Density, SceneState, Store } from '../state';
import { ChipGroup } from './ChipGroup';
import { CountControl } from './CountControl';
import { HighlightControl } from './HighlightControl';
import { formatCount } from './logScale';
import { useStore } from './useStore';
import { compareLines } from './venues';
import './sidebar.css';

const DENSITY_OPTIONS: { value: Density; label: string }[] = [
  { value: 1, label: 'Loose' },
  { value: 2.5, label: 'Concert' },
  { value: 4.5, label: 'Packed' },
];

function Section({ label, children }: { label: string; children: ReactNode }) {
  return (
    <section className="section">
      <h2 className="label">{label}</h2>
      {children}
    </section>
  );
}

export function Sidebar({ store, stats, debug }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }>; debug: boolean }) {
  const s = useStore(store);
  const st = useStore(stats).value;
  const lines = compareLines(s.count);
  const setCamera = (preset: 'aerial' | 'eye') => store.set({ camera: { preset, nonce: s.camera.nonce + 1 } });
  return (
    <aside className="sidebar" aria-label="Crowd controls">
      <h1 className="title">Visualizing Crowds</h1>
      <CountControl count={s.count} onChange={(count) => store.set({ count })} />
      <Section label="Place">
        <ChipGroup label="Place" options={PLACES.map((p) => ({ value: p.id, label: p.name }))} value={s.placeId} onChange={(placeId) => store.set({ placeId })} />
      </Section>
      <Section label="Density">
        <ChipGroup label="Density" options={DENSITY_OPTIONS} value={s.density} onChange={(density) => store.set({ density })} />
      </Section>
      {st?.overflow && (
        <p className="notice" role="status">
          Overflow: {getPlace(s.placeId).name} holds about {formatCount(st.capacity)} at this density.
        </p>
      )}
      {lines.length > 0 && (
        <Section label="Compare">
          <ul className="compare">{lines.map((l) => <li key={l}>{l}</li>)}</ul>
        </Section>
      )}
      <Section label="Camera">
        <div className="chips">
          <button type="button" className="chip" onClick={() => setCamera('aerial')}>Aerial</button>
          <button type="button" className="chip" onClick={() => setCamera('eye')}>Eye level</button>
        </div>
      </Section>
      <Section label="Highlight">
        <HighlightControl value={s.highlight} onChange={(highlight) => store.set({ highlight })} />
      </Section>
      {debug && st && (
        <p className="debug">
          {st.fps} fps · {formatCount(st.nearSprites)} sprites · {formatCount(st.midPoints)} dots · r {Math.round(st.radius)} m
        </p>
      )}
    </aside>
  );
}
```

`src/ui/sidebar.css`:
```css
.count { margin-bottom: 20px; }
.count-big { font-size: 34px; font-weight: 700; line-height: 1; letter-spacing: -0.02em; font-variant-numeric: tabular-nums; }
.muted { color: var(--muted); font-size: 12px; }
.count-slider { width: 100%; margin: 14px 0 2px; accent-color: var(--ink); }
.ticks { position: relative; height: 14px; font-size: 10px; color: var(--muted); }
.ticks span { position: absolute; transform: translateX(-50%); white-space: nowrap; }
.ticks span:first-child { transform: none; }
.ticks span:last-child { transform: translateX(-100%); }
.count-input {
  width: 100%;
  margin-top: 8px;
  padding: 6px 8px;
  border: 1px solid var(--chip-border);
  border-radius: 6px;
  font: inherit;
  font-size: 13px;
  font-variant-numeric: tabular-nums;
  background: #fff;
}
.section { margin-bottom: 16px; }
.label { margin: 0 0 6px; font-size: 11px; font-weight: 500; color: var(--muted); text-transform: uppercase; letter-spacing: 0.06em; }
.chips { display: flex; flex-wrap: wrap; gap: 4px; }
.chip {
  padding: 4px 10px;
  border: 1px solid var(--chip-border);
  border-radius: 99px;
  background: #fff;
  color: var(--ink);
  font: inherit;
  font-size: 12px;
  cursor: pointer;
}
.chip.on { background: var(--ink); border-color: var(--ink); color: #fff; }
.chip:focus-visible, .count-input:focus-visible, .count-slider:focus-visible { outline: 2px solid var(--ink); outline-offset: 2px; }
.notice { margin: 0 0 16px; padding: 8px 10px; border-radius: 6px; background: #f3e3dc; color: #7a2e22; font-size: 12px; }
.compare { margin: 0; padding: 0; list-style: none; font-size: 13px; line-height: 1.5; }
.highlight { display: flex; align-items: center; gap: 8px; font-size: 13px; }
.highlight input[type='number'] { width: 64px; padding: 4px 6px; border: 1px solid var(--chip-border); border-radius: 6px; font: inherit; }
.debug { margin-top: 24px; font-size: 11px; color: var(--muted); font-variant-numeric: tabular-nums; }
```

`src/App.tsx`:
```tsx
import { SceneView } from './SceneView';
import { Sidebar } from './ui/Sidebar';
import type { SceneStats } from './render/types';
import type { SceneState, Store } from './state';

export function App({ store, stats, debug }: { store: Store<SceneState>; stats: Store<{ value: SceneStats | null }>; debug: boolean }) {
  return (
    <div className="app">
      <Sidebar store={store} stats={stats} debug={debug} />
      <SceneView store={store} stats={stats} />
    </div>
  );
}
```

- [ ] **Step 5: Run tests**

Run: `npm test && npm run e2e`
Expected: all PASS in chromium and webkit.

- [ ] **Step 6: Run the `me:unslop` audit and fix what it finds**

Invoke `me:unslop` in audit mode on the running sidebar (Browser pane, fronted, 1440×900 and 375×812). Fix findings, rerun `npm run e2e`, and append the audit result to `docs/superpowers/notes/sidebar-unslop.md`.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat(ui): sidebar with count, place, density, compare, camera, highlight"
```

---

### Task 13: Verify, measure, ship a preview

**Files:**
- Create: `docs/superpowers/notes/v1-verification.md`

**Interfaces:**
- Consumes: the whole app.
- Produces: verification notes with numbers and a Vercel preview URL.

- [ ] **Step 1: Full test run**

Run: `npm run build && npm test && npm run e2e`
Expected: everything passes in both browsers. Paste the summary lines into the notes file.

- [ ] **Step 2: Performance on Nick's laptop**

`npm run build && npm run preview`, open `http://localhost:4173/?place=national-mall&count=180000&debug` in Chrome, wait 10 s after the camera settles, orbit for 10 s, and record the fps readout. Then `?place=manhattan&count=20000000&debug`. Targets: Mall ≥ 60 fps, Manhattan ≥ 30 fps. Record the sprite budget shown (if the governor dropped it, note to what). Repeat in Safari. If a target misses, record it as a finding with the numbers; do not tune constants in this task.

- [ ] **Step 3: Visual pass in Chrome and Safari**

For each place, at 1k, 180k and 20M (or overflow): page renders, crowd edge visible, no tier seams, holes empty, overflow notice when expected. Phone width (375×812): sidebar stacks below the scene and stays usable. Record pass/fail per row in the notes file.

- [ ] **Step 4: Ship a preview**

Invoke `me:ship` for repo `weeeha/Visualizing-Crowds`, branch `feat/crowd-visualizer-v1`: push the branch, open a PR against `main` with the notes file summarized in the description, deploy a Vercel **preview** (not production), and return the short preview link. Re-check the preview URL itself (not localhost) in Chrome and Safari before reporting.

- [ ] **Step 5: Commit the notes**

```bash
git add docs/superpowers/notes/v1-verification.md
git commit -m "docs: v1 verification notes"
git push
```
