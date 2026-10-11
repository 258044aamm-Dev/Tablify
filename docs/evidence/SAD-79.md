# SAD-79: Step 4, grid geometry and header capsules

- **Linear:** SAD-79 (owner decisions S-2 visuals, S-6)
- **Date:** 2026-10-11
- **Base commit:** `d67e2b5`

## Change

### Grid shell and geometry (prototype `#tableInnerContainer`, `Prototype/index.html` 215-227, `style.css` 28-73, `script.js` 435-640)

- **One scroll container.** The grid root scrolls both axes, like the prototype's container:
  - The header is sticky at the top (z 3).
  - Frozen header slots sit at z 2 and frozen body slots at z 1.
  - Shell: 1px border, radius 16, padding 12 (8 below 640px), inset shadow, all from the prototype classes.
- **Slots.** Each row starts with a 32px checkbox slot and a 40px `#` slot, then the field slots. All are separated by 6px (`border-spacing: 6px 8px`).
  - Default column width is 160.
  - Stored widths render as they are, and resizing clamps at 120–520 (`colResizeStart`). The prototype's `min-w-[160px]` on the `th` has no effect under `table-layout: fixed`: measured in Chromium, a stored 120px column renders at 120. The plan's "min 160" was therefore inaccurate, and the prototype wins.
- **Fill mode.** When the columns are narrower than the shell, every slot scales by one factor: (content width − 6·(n+1)) / Σ natural (`fillWidths`). This is what the prototype's `width:100%` table does; at the owner viewport each 160px field becomes 247px. When the columns are wider than the shell, it scrolls.
- **Frozen columns.** When freeze is on, the checkbox and `#` slots freeze together with the primary column. Sticky offsets are the resolved slot positions (`syncFrozenOffsets`). Frozen slots paint the inner background plus the prototype's 8-way shadow, which fills the gaps so scrolled content never shows between them.
- **Row pitch.** Pitch is 50 / 50 / 56 for capsules of 34 / 34 / 40 (`virtual.ts rowHeightPx`, `rowHeightKey`). Short and Medium look the same in the prototype, as the plan noted. The root carries `tablify--rh-small|medium|large` for the capsule CSS.
- **Shrink to content (S-6).**
  - The shell is as tall as its content (header + rows × pitch + Insert Row + padding), capped at the space left in the card.
  - Virtualization only matters past the cap.
  - The card now wraps its content too (`flex: 0 1 auto`), capped at the pane: 1520×480 at the owner viewport, the same as the prototype.
  - The empty-state sentence is gone.

### Header capsules (prototype `renderHeader`, `script.js` 470-560)

Markup per field: `.tablify__header-capsule` > grip · key (primary only, accent) · name · sort arrow · type badge · ⋮, followed by a resize handle.

| Part | Prototype | Plugin |
|---|---|---|
| Capsule | 40px tall in a 45px slot, padding 8/14, radius 16 | Same |
| Header text | `th` UA bold (700) beats the row's `font-semibold`; the name is Poppins 600 12px, tracking 0.3px | Same. The header is 700 and the name 600. |
| Grip / key | FA webfont characters, 11px / 9px | Inline FA 6.4.0 SVGs. Margins reproduce each glyph's measured advance (7.6 / 9.6px; webfont characters also carry the 0.55px tracking). |
| Sort arrow | 9px mono accent ↑/↓, plus the key index for multi-key sorts | Same, through CSS `attr()`, so the cell's textContent stays the field name |
| Type badge | JBM 9px, padding 2/6, radius 4, FA icon + type | Same, via `fieldTypeBadge.ts` (`typeIcon`, `typeLabel`). The badge advance matches to 0.06px. |
| ⋮ | 20×20 | Same |

**Behaviour.** All of it goes through the existing view commands, so it is saved and undoable:

| Interaction | Prototype | Plugin |
|---|---|---|
| Click the name | `headerSortClick`: off → asc → desc → off; collapses a multi-sort | `cycleHeaderSort` |
| Shift-click | Adds, flips, then removes one key | Same |
| ⋮ | Opens the column menu | Opens the **existing** header menu (`openHeaderMenu`), anchored under the button |
| Resize handle | Live preview, clamp 120–520 | Live preview; **one** `columnWidths` write on release; a cancelled pointer (`pointercancel`) writes nothing |
| Grip drag | Drops onto the column under the pointer (+1 when moving right) | `moveColumnOnto`, pointer events (works on touch). A press without travel is not a drag. |

**Embeds** pass no callbacks, so the header stays inert: the name is a static span, there is no ⋮, resize handle or Insert Row, and no control looks clickable when it isn't.

### Body

- Each value sits in `.tablify__capsule` (Lora 12px, padding 8/14, radius 16, ellipsis). Empty cells show the prototype's `—` through `:empty::before`, so textContent stays empty for every consumer.
- `#` cells show a grip and the 1-based row number (JBM 12px). The checkbox slot stays empty until SAD-80.
- The selected cell's outline (2px accent, offset −1) is drawn on the capsule. The editor overlay is placed on the capsule rect.

### Insert Row (S-6)

The prototype's pill sits inside the scroll container: 38px tall, 12px top margin, sticky-left, as wide as the visible area. The toolbar's Add Row is unchanged, and Insert Row calls the same `addRow`.

### Scroll performance

Rows now carry the prototype's markup: a capsule per value, two lead slots and a grip. That is roughly twice the elements per row, so a full rebuild costs about twice as much layout. To compensate, the scroll listener now skips the rebuild when the visible range hasn't changed. The browser has already moved the rows, and smooth scrolling fires several events per 50px row. Every other path still forces `render()`: data, selection, geometry and row height. Measured in Chromium, 1,000 rows, mean per frame (script + style + layout):

| Scroll pattern | Before (`d67e2b5`) | After |
|---|---|---|
| Smooth, 8px per frame | 3.9–4.3 ms | **1.2–1.6 ms** |
| Jump, new rows every frame (scrollbar drag) | 3.9–4.8 ms | 6.8–7.8 ms |

Both patterns stay well inside the 16.7 ms frame budget, and normal scrolling is about 3× cheaper than before. `bench-grid-scroll.mjs` (jsdom, a forced full render every call) still renders 22 DOM rows for 1,000. Its jsdom frame time is ~20 % above the baseline, because of the extra elements per row.

## Decisions and deviations from the prototype

1. **Insert Row is centred in the visible area.** The prototype's script gives the sticky pill `left = padding`. Chrome resolves sticky insets from the padded edge, so on any grid that scrolls sideways (mobile) the prototype's pill sits 8px right of centre and touches the right border. The plugin uses `left: 0`: identical whenever the grid fits, and symmetric when it scrolls. This accounts for most of the mobile grid-shell diff.
2. **No content shows through the frozen block.** When scrolled sideways, the prototype shows a sliver of the scrolled column between `#` and the frozen primary column, because its `syncFrozenOffsets` offsets are not quite flush. The plugin's frozen block is flush. See `visual-parity/sad-79/scroll/desktop-600px-hscroll.*`.
3. **The header masks the shell padding when the grid scrolls vertically.** The prototype never scrolls inside the shell. Sticky `top: 0` would pin the header 12px down, and rows would show through that band, so the header pins at `top: -padding` and pulls itself up by the same margin. At rest nothing moves; when scrolled, the header covers the band (`scroll/owner-1000rows-vscroll.plugin.png`).
4. **Truncated names keep their start** ("N…", as in the prototype). Obsidian makes buttons `inline-flex`, which never ellipsizes and clips both ends, so the name button is reset to `display: block; text-align: left`.
5. **Typed cell formatting is not part of this step.** The prototype renders email and URL values as accent links, and some types as chips. Steps 5–7 don't cover this. It shows up only in populated tables with such fields, as the remaining body diff on mobile; a follow-up is recorded for Step 8.
6. **Icon rasterization.** Webfont glyphs and inline SVGs anti-alias differently. The type badge (≤2.4 %) and the row-number grip (≤1 %) residue is this, with sizes and advances matched (the same residue as Sync and Options in SAD-77 and SAD-78).

## Tests

- **New `tests/views/grid/headerCapsule.test.ts` (24):**
  - fill mode against the measured prototype widths;
  - capsule markup, with textContent staying the name;
  - embeds have no dead controls;
  - sort arrow and multi-key index;
  - badge icon and label for every type;
  - name click / Shift-click sort without selecting a cell;
  - ⋮ anchoring;
  - Enter on header buttons;
  - resize: live preview, a single clamped commit, cancel;
  - grip drag, and a press without travel;
  - lead slots, body capsules, row-height class, Insert Row placement;
  - `cycleHeaderSort` and `moveColumnOnto`;
  - TableView wiring: sort, menu, resize and move are saved and undo in one step.
- **New `tests/views/grid/scrollRender.test.ts` (4):**
  - an in-range scroll keeps the row DOM;
  - a range change re-renders;
  - `setModel` re-renders and the next scroll does not bring back stale values;
  - a row count that shrinks re-renders.
  - Verified to fail with the skip removed.
- **Updated:**
  - `frozenColumns` (20): lead slots, offsets 0 / 38 / 76, fill-mode offsets.
  - `capsule` (7).
  - `geometry` (6): Insert Row inside the shell.
  - `virtual` (8): pitch 50 / 50 / 56, capsule heights, `rowHeightKey`.
  - `tableView`: row height expectations.
  - `theme` (7): `textFaint` / `textPlaceholder` tokens.
  - `tokensNoObsidianVars`.
  - `formControlSpecificity`: header name, ⋮ and Insert Row are element-qualified.
- **`npm run check`:** lint 0 errors (119 warnings, unchanged); vitest **1421** passing (was 1389); guard, docs and icons PASS; build OK.

## Visual verification

Command: `npx tsx tests/visual/capture-compare.ts --theme all --viewport all --fixture all --state default`. That is 18 combos: dark and light × owner 1568×795, desktop 1400×900 and mobile 390×844 × the new (5 fields × 3 empty rows), empty and populated fixtures. The full report is `visual-parity/sad-79/report.md`.

**Harness changes** (`tests/visual/lib`):
- `openPrototype` now dispatches `resize` after injecting the CSS, so the prototype's script lays out the sticky Insert Row at the final width.
- `regions.ts`:
  - `header-capsule`, `header-name`, `type-badge` and `body-cell` retargeted to the new markup;
  - new `header-num` and `row-number` regions;
  - pixel comparison enabled for the grid regions.

**Sizes.** Every grid region in all 18 combos is the same size as the prototype's:
- shell 1462×287 (owner, new);
- header capsule 253×40;
- name 39×16;
- `#` header 64×45;
- body capsule 247×34;
- row number 64×42;
- Insert Row 1436×38.

The card matches everywhere except the mobile height. That 16px difference is the toolbar (deviation 4 of SAD-78).

| Region (worst of 18 combos) | Pixel mismatch |
|---|---|
| grid-shell | owner/desktop ≤ 0.30 %; mobile 0.11–1.22 % (deviations 1 and 5, plus the SAD-80 checkboxes) |
| header-capsule | ≤ 0.53 % |
| header-num, body-cell | 0.00 % |
| insert-row | ≤ 0.01 % |
| row-number | ≤ 1.01 % (deviation 6) |
| type-badge | ≤ 2.41 % (deviation 6) |

| Region (owner, new) | Dark | Light |
|---|---|---|
| grid-shell | 0.17 % | 0.08 % |
| header-capsule | 0.38 % | 0.36 % |
| type-badge | 2.13 % | 2.04 % |
| header-num | 0.00 % | 0.00 % |
| body-cell | 0.00 % | 0.00 % |
| row-number | 0.63 % | 0.52 % |
| insert-row | 0.00 % | 0.00 % |

**Other regions are unchanged** from SAD-78: title row 0.16–0.39 %, toolbar row 1.27–1.45 %, Add Row 0.05 %, ↶ 0.78–0.85 %.

**Behaviour under scroll** (1,000-row fixture, primary column frozen):

| Check | Owner | Mobile |
|---|---|---|
| Shell height | 553px, card bottom flush with the pane gutter | 526px |
| DOM rows | 17–22 | 16–21 |
| Mid-scroll | row 501 first; header pinned 1px from the shell edge | same |
| End | row 1000 and Insert Row fully visible | same |
| Sideways (300px) | — (fits) | frozen header and body aligned (x = 93); Insert Row stays in view at x = 9, 314px wide |

**Crops:** `visual-parity/sad-79/`:
- grid-shell and header-capsule plugin / prototype / diff crops for the six new-table combos;
- populated grid shells for dark-owner and dark-mobile;
- full plugin pages for dark-owner and light-mobile;
- `scroll/`: vertical, sideways and side-by-side captures.
