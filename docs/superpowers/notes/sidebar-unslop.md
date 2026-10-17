# Sidebar: unslop constraints (before build)

Phase 0 bindings: tokens live on `:root` in `src/styles.css` (paper, ground, ink, muted, line, chip-border). No icon library, no detector or token gate in this repo, so the Phase 2 audit is grep + rendered passes.

| Rule area | Planned in Task 12 | Constraint applied |
|---|---|---|
| States & a11y (contrast) | `--muted: #7a756c` on `#f4f2ee` ≈ 4.1:1 | Move up the ramp: `--muted: #69645b` (≈ 5.2:1) |
| Type | Uppercase `.label` eyebrow on every section | Sentence-case 12px muted labels, no caps eyebrow |
| Type | Sizes written inline (34/13/12/11/10) | Declared as `--fs-*` tokens, 5 sizes total |
| Layout (state stability) | Overflow notice and Compare section appear/disappear and push content | Reserved at rest: the count subline always renders (2-line min-height) and carries the overflow message; Compare always renders with a 2-line min-height and an honest empty sentence |
| Raw hex | `#fff`, notice `#f3e3dc` / `#7a2e22` inline | Tokens `--surface`, `--warn-bg`, `--warn-ink`; no pure white |
| Radii | 99px and 6px inline | `--r-sm: 6px`, `--r-pill: 999px` |
| Responsive | Chips about 22px tall | `min-height: 28px` on chips and buttons |
| Copy | Camera buttons "Aerial" / "Eye level" | "Aerial view" / "Eye-level view" |
| Keyboard | Focus ring on chips, inputs, slider | Also on the checkbox and the ratio input |

## Audit (after build, WebKit screenshots at 1440×900 and 375×812)

| Pass | Result |
|---|---|
| Grep (gradients, blur, transitions, raw colors in components, banned copy, exclamation marks) | 0 hits in `src/ui/*` |
| Counts | 4 font sizes, all tokens; 2 radii (`--r-sm`, `--r-pill`); no shadows |
| Squint | Count number dominates; one saturated accent per view (red highlight in the scene) |
| Contrast | Muted text `#69645b` on `#f4f2ee` ≈ 5.2:1; warn ink on paper passes |
| Keyboard | Visible 2px ink ring on chips, inputs, slider, checkbox |
| State stability | Overflow message and Compare lines render in slots reserved at rest; chip selection changes colour only |
| 375px | Sidebar stacks under the scene, no horizontal scroll, chips 28px tall |
| Finding fixed | Native checkbox used system blue (second accent) → `accent-color: var(--ink)` |
