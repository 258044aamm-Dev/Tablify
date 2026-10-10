# SAD-76: Step 1, platform fixes (fonts, host CSS leak, search gutter, header ring, hidden popover)

- **Linear:** SAD-76
- **Date:** 2026-10-10
- **Base commit:** `d5c4676` (Step 0 harness)
- **Verification:** `npm run visual:compare` (SAD-75 harness: real `TableView` under the hostile Obsidian-style host CSS), dark + light, owner (1568×795) + mobile (390×844) viewports, `new` + `populated` fixtures, default + Options-open states.

## Root causes fixed

| RC | Cause | Fix |
|---|---|---|
| **A: fonts never load** | Obsidian injects `styles.css` as an inline `<style>`, so `url('assets/fonts/…')` resolved against the app origin. Every surface fell back to Georgia/Arial. | `scripts/embed-fonts.mjs` writes `@font-face` rules with **base64 data URIs** from `assets/fonts/*.woff2` between `@tablify-fonts` markers in `styles.css`. Added the weights the prototype loads: Lora 500/600, Poppins 500, JetBrains Mono 500 (byte-identical `@fontsource` latin subsets, SIL OFL). 9 faces; `styles.css` goes from 18.7 KB to 228.8 KB. |
| **B: host buttons win** | Obsidian's `button:not(.clickable-icon)` (0,1,1; hover 0,2,1) beat `.tablify__toolbar-button` / `__option-button` / `__insert-row` (0,1,0): `#313244` fill, `#89b4fa` text, weight 600, 30 px height. | Every control selector is now `.tablify button.<class>` / `.tablify select.<class>` (0,2,1; hover 0,3,1), and it resets fill, ink, weight, height, line-height, margin, shadow and appearance. Pills use the prototype `.pill-btn` values through new tokens `bg-pill`, `bg-pill-hover` and `border-pill-hover` (dark `#24221E` / `#2D2A25` / `#4A453E`; light `#FFFFFF` / `#F6F2EA` / `#D3CAB9`). |
| **C: search icon over the "S"** | `.tablify__search-input { padding-left: 40px }` (0,1,0) lost to the scoped `padding` shorthand (0,2,1). | The 40 px gutter moved to `.tablify__toolbar input.tablify__search-input`. |
| **D: header double ring** | `.tablify__header .tablify__cell--frozen { background: … }` used the shorthand, which **resets `background-clip` to `border-box`**. The frozen capsule painted its 3 px gutter, so the visible box sat 3 px outside the inset ring. | Frozen capsules use two layers: the capsule paint is clipped to `padding-box` and the gutter is painted in the shell colour, so scrolled columns stay masked. The ring uses the prototype capsule border (new token `border-capsule`, dark `#3A3630`). The drop shadow uses spread −3 px so it hugs the visible capsule. |
| **New: Options always open** | `.tablify__options { display: flex }` overrode the `hidden` attribute, so the popover was permanently open (visible in the owner screenshot). | `.tablify [hidden] { display: none !important }`. The toggle, the query-error and empty-hint visibility now work as coded. |

Not in this step: geometry (38 px pills, radius 16, 40 px header), toolbar contents and order, title row, grid shrink, checkbox and # columns. These are Steps 2–8 (SAD-77…83).

## Visual evidence

`visual-parity/sad-76/toolbar-before-after-prototype.png`: top is base `a3b4952`, middle is this step, bottom is the prototype. The full per-region report is `visual-parity/sad-76/report.md`.

| Region (dark, owner, new table) | Base `a3b4952` | This step |
|---|---|---|
| Add Row fill / text / weight | `rgb(49,50,68)` / `rgb(137,180,250)` / 600 | `rgb(36,34,30)` / `rgb(236,231,225)` / 500, matching the prototype |
| Add Row pixel mismatch | 81.47 % | 22.12 % (the rest is geometry: 32 px vs 38 px, radius 14 vs 16) |
| Options pixel mismatch | 81.37 % | 23.37 % |
| Toolbar row pixel mismatch | 33.74 % | 11.05 % |
| Search `padding-left` | 16 px | 40 px |
| Header capsule visible fill | capsule colour across the 3 px gutter (double ring) | gutter = shell `rgb(27,26,23)`; single 1 px `rgb(58,54,48)` ring |
| Font families in use | serif fallback | Lora 400/500, Poppins 600 and JetBrains Mono 400 report `loaded` in `document.fonts` (the faces come from the data URIs) |
| Options popover on open | always visible | hidden until the Options button is pressed |

## Tests

- `tests/ui/fonts.test.ts`: the old assertion that `styles.css` references `assets/fonts/…` encoded the bug and is replaced. New tests check that no relative `url()` remains, that every prototype family/weight/style is embedded as a data URI, and that the generated block matches `assets/fonts` byte for byte (catches a stale `styles.css`).
- `tests/ui/formControlSpecificity.test.ts`: new tests check that every Tablify button class is element-qualified inside `.tablify`, that the pill resets the host-set properties, that the search gutter is at the scoped specificity, that frozen capsules clip to `padding-box`, and that `[hidden]` wins.
- `tests/ui/theme.test.ts`: the palette table now includes the six new prototype values. `spec/branding.md §5` is updated to match.
- `npm run check`: lint 0 errors / 119 warnings (unchanged); **1252/1252** tests (1245 + 7 new); guard PASS; docs PASS; build OK.

Harness: crops are clamped to the viewport (the mobile toolbar overflows horizontally). Known harness gap, to fix in the grid step: `toPrototypeDoc()` loses the header name of some field types (e.g. `email`).
