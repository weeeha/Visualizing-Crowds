# v1 verification (2026-10-11)

## Tests

- Unit (Vitest): 91 passed.
- E2E (Playwright, Chromium + WebKit): 30 committed checks passed in both engines (smoke, scene, WebGL2 fallback, phone width, GLSL hash parity, near tier, tile-drop regression, LOD, overflow, sidebar interactions).
- Sweep (not committed): every place × {1k, 180k, 20M} at concert density in both engines, 30/30 passed: no console or WebGL errors, `overflow === count > capacity`, overflow message shown when expected.

## Performance (this Mac, production build, real GPU, 1440×900, `?debug`)

Median / minimum fps over 10 s of orbiting, after a 10 s settle.

| Case | Chrome | WebKit (Safari engine) | Tiers drawing |
|---|---|---|---|
| National Mall, 180k, aerial | 60 / 60 | 60 / 60 | ~172k sprites, ~227k dots |
| Manhattan, 20M, aerial | 60 / 60 | 60 / 60 | ground shader only (people under a pixel) |
| Manhattan, 20M, zoomed in | 60 / 60 | 60 / 60 | ~400k sprites, ~1.45M dots |

Targets (Mall 180k ≥ 60 fps, Manhattan 20M ≥ 30 fps) met in both engines. The sprite budget governor did not drop.

## Visual pass

| Place | 1k | 180k | 20M |
|---|---|---|---|
| Open field | small disk at center | disk, sprites up close | ground-shader disk |
| Times Square | fills part of the plaza | overflow, plaza full, message shown | overflow, same |
| National Mall | crescent at the Capitol end | fills around the Capitol Reflecting Pool, pools empty | overflow, whole Mall full |
| Michigan Stadium | small disk | overflow (capacity 119,170 at 2.5/m²) | overflow |
| Manhattan | small disk | disk south of Central Park | disk clipped by the shoreline, lakes empty |

Close-up check: style B figures, everyday palette, upright from every orbit angle, poses vary, no people on water. Tier seams checked while zooming from eye level to aerial on the Mall and Manhattan: no hole, no ring, no horizontal speckle line after the Task 11 fixes.

Phone width (375×812): sidebar stacks below the scene, no horizontal scroll.

## Findings fixed during verification

1. Aerial views spent the sprite budget on empty ground under the camera (0 sprites on the Mall). The budget now counts only tiles that hold crowd, nearest the camera first (`budgetReach`).
2. WebKit logged `drawElementsInstanced: no buffer is bound` after tiles were dropped: tiles shared the quad's buffers. Each tile now owns its quad (regression test in `e2e/near.spec.ts`).

## Not verified

- Real Safari.app (WebKit via Playwright stands in for it here) and the deployed preview URL: checked after deploy.
- Older or integrated GPUs, and phones beyond the 375px layout check.
