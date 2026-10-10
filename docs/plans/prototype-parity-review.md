> **Execution status (2026-10-10):** this review was executed in full under **SAD-71**.
> Commits on `main`: Step 1 `b5ddf16` (resize refit, empty-state pill, scoped selectors) ·
> Step 2 `37e30f5` (token ladder) · Step 3 `074c34e` (toolbar + Options popover) ·
> Step 4 `aac675c` (capsule grid) · Step 5 `eb9ea1d` (JetBrains Mono) · Step 6 `b2b9626`
> (workspace card, scrollbars) · Step 7 (this doc, CHANGELOG, evidence). Each step carried
> red->green tests and a full `npm run check` gate; per-step evidence is in the SAD-71
> Linear comments. Row-number column and checkbox/bulk-delete deferred to v1.1 per owner.

# Tablify — Prototype Parity Review & Fix Plan (PLAN ONLY)

**Date:** 2026-10-10 · **Repo:** `258044aamm-Dev/Tablify` @ `cafbd17` (v1.0.1) · **Linear:** SAD-69 (In Progress), SAD-70 (Done), parent SAD-68
**Sources:** owner screenshot from a real Obsidian vault (`uploads/image-1.png`, dark host theme `#1e1e2e`), `Prototype/Anthropic Table Workspace.html`, `src/views/grid/toolbar.ts`, `src/views/grid/GridView.ts`, `src/views/tableView.ts`, `src/ui/theme/tokens.ts`, `styles.css`, `spec/branding.md`, SAD-69 comments.
**Mode:** plan only — no code changed.
**Decisions resolved (owner, 2026-10-10):** D-1 full prototype restyle · D-2 keep Poppins/Lora + add JetBrains Mono for badges/counts/row-number · D-3 Options = anchored popover card · D-4 checkbox/select-all/bulk-delete deferred to v1.1 · D-5 title row deferred · D-6 palette ladder approved.
**Tracking:** filed as **SAD-71** (parent SAD-68, related to SAD-69, labels Bugs + MVP, priority 2); plan comment posted on SAD-69. SAD-69 stays In Progress until the Step-7 evidence matrix lands.

---

## 1. Verdict

The v1.0.1 toolbar is **functionally** where SAD-69 wanted it (search, query, Add row, Add Field, Options with row-height / freeze / hidden-field Show, undo/redo, row-count badge — all present and wired). But **visually it is not the prototype**. The implementation took the prototype as a *layout sketch for the toolbar row only* and kept the dense P3-01 grid language, the branding.md §5 two-step palette, and Poppins/Lora everywhere else. The screenshot also exposes four real defects that are parity-adjacent but wrong under any scope (stale grid width, host-CSS leak into inputs, 600 px black void, filler header column).

Pixel evidence from the screenshot (sampled): options panel `#33322d` and grid body `#141413` are plugin tokens (theme isolation works for surfaces), but the search/filter inputs sample `#1a1a28` — the **host** form-field color — and the grid box is ~1171 px wide inside a 1887 px view with a ~600 px empty black area under a single row.

---

## 2. What already matches the prototype

| Item | Evidence |
|---|---|
| Toolbar row order: search left; Add row / Add Field / Options right | `toolbar.ts` topRow; screenshot |
| Search capsule with inset icon, `border-radius: 999px` intent | `styles.css .tablify__search*` (though see D-2 leak) |
| Row-count badge above the table, right aligned | `toolbar.ts renderRowCount()`; screenshot "1 row" |
| Options content (row height, freeze, hidden + Show, clear filters) | exceeds prototype (prototype's Options is a stub toast) |
| Accent `#d97757` = prototype dark terracotta | `tokens.ts`, prototype `tailwind.config` |
| Theme isolation intent (plugin tokens, not host vars) | `applyTheme()`; surfaces sample correctly |

---

## 3. Gap register (prototype → current → screenshot evidence)

### A. Layout & structure
| # | Prototype (`Prototype/Anthropic Table Workspace.html`) | Current code | Screenshot |
|---|---|---|---|
| A1 | Whole workspace in one card: `bg-anthropic-paper-card dark:bg-anthropic-dark-card border rounded-[24px]…p-7 shadow-xl` | No wrapper; toolbar + grid sit directly on host bg | toolbar floats on host purple `#1e1e2e` |
| A2 | Inner table container: `bg-…-inner w-full overflow-x-auto rounded-2xl border p-2 sm:p-3 shadow-inner` | `GridView` root = flat box, 1px `--tablify-border`, square corners | hard-edged rectangle |
| A3 | Table `border-separate border-spacing-y-2 border-spacing-x-1.5` → **detached capsule cells** with 8/6 px gaps | contiguous rows, `borderBottom: 1px solid var(--tablify-border)` per row (`GridView.ts` rowPool factory) | classic dense grid |
| A4 | Bottom **"Insert Row"** full-width pill inside the container | absent (only toolbar Add row) | empty table = black void, no affordance |
| A5 | Checkbox column + mono `#` row-number column | absent | — |
| A6 | Header capsules: grip icon + title + **type badge** (9 px mono, bordered) + ellipsis menu | plain text header cells (`renderHeader()`), menu only | flat olive band |
| A7 | Title row (serif editable title + version chip) and Export CSV / Copy Markdown buttons | absent (export exists as a command/modal elsewhere) | — |
| A8 | Dataset tabs, Saved indicator, New Table, Ask Claude | absent | app-level chrome, recommend **out of scope** |

### B. Surfaces & palette (dark)
| Token | Prototype | Current (`tokens.ts`) | Screenshot |
|---|---|---|---|
| app bg | `#181715` | `#141413` | host shows through anyway (A1) |
| card | `#22201D` | — (missing) | — |
| inner | `#1B1A17` | — (missing) | body reads `#141413` |
| capsule / pill | `#262420` / `#24221E` | stripe `#2a2926`, subtle `#33322d` | header `#33322d` (too light vs prototype capsule) |
| border | `#38342E` / `#3A3630` (subtle) | `#b0aea5` **mid-gray, both themes** | bright 1 px frame around panel + grid (E6) |
| text / muted | `#ECE7E1` / gray-400 | `#faf9f5` / `#b0aea5` | — |
| accent (light) | `#CC785C` | `#d97757` both themes | — |

Light theme diverges the same way (`#FAF7F2/#FFFFFF/#F4EFE6/#E6E0D5` vs `#faf9f5/#e8e6dc/#b0aea5`).

### C. Typography
| # | Prototype | Current |
|---|---|---|
| C1 | Inter (UI/body), DM Serif Display (titles), JetBrains Mono (badges, row count, `#` column) | Poppins (headings) + Lora (body) — `spec/branding.md §4` owner decision; **no mono at all** |
| C2 | row count: `text-[11px] font-mono text-anthropic-clay tracking-wider` | `styles.css .tablify__rowcount`: 11 px Lora, `opacity .8` |
| C3 | header labels 11 px semibold uppercase tracking-wider clay | header cells 12-ish px Poppins 600, full-strength text |

### D. Components
| # | Prototype | Current | Screenshot |
|---|---|---|---|
| D1 | Inputs: `rounded-full`, icon inset, focus = terracotta border + `box-shadow 0 0 0 2px rgba(204,120,92,.15)` | 999 px radius + 2 px solid outline focus; **but host CSS wins** (RC-3) | inputs render rectangular, host bg `#1a1a28` |
| D2 | Options: prototype button is a stub; its *language* for surfaces = centered/anchored cards (`rounded-2xl`, card bg, `backdrop-blur-sm`, shadow) | full-width **inline** panel in the toolbar flow, `bg-subtle`, 12 px radius | huge olive block pushing the grid down |
| D3 | Active control language: solid terracotta pill, white text (dataset tabs) | `is-active` = 2 px accent border on same bg | "Medium" = orange outline |
| D4 | Add Field modal: centered card `max-w-sm rounded-2xl p-6 shadow-2xl` over `bg-black/60 backdrop-blur-sm`, terracotta CTA | Obsidian `Modal` + `Setting` rows → host-styled dialog | (not in screenshot) |
| D5 | Toast: bottom-center capsule, terracotta border | Obsidian `Notice` | recommend keep Notice (platform-native), record deviation |
| D6 | Scrollbars: 6 px, themed track/thumb per mode | unstyled host scrollbars | — |

### E. Defects visible in the screenshot (wrong under any scope)
| # | Defect | Root cause |
|---|---|---|
| E1 | Grid box ~1171 px in a 1887 px view; right third is host bg | `GridView.ts:101` sets root width once from `opts.viewportWidth`; `tableView.ts:241` measures `contentEl.clientWidth` at render; **no `onResize()`/ResizeObserver** |
| E2 | Search + filter inputs show host form-field bg/radius | `styles.css` single-class selectors (0,1,0) lose to Obsidian's `input[type='search']`-style attribute selectors (0,1,1) → violates `branding.md §3` "apply regardless of the user's Obsidian theme" |
| E3 | ~600 px black void under a single row | `GridView.ts:100` `height = opts.viewportHeight ?? 600`; `tableView` never passes a height; no empty-state treatment |
| E4 | Empty header space right of "Name" reads as an unnamed column (vertical divider + bordered band) | `renderHeader()` sets `minWidth:100%` on a flex header whose last cell keeps its right border; filler area uses header bg |
| E5 | Row divider + container border in bright `#b0aea5` on dark | single border token for both themes (B) |

---

## 4. Root causes

1. **RC-1 Scope of SAD-69 A:** the plan said "layout follows the prototype" but only delivered toolbar row order; the grid kept the dense virtualized language. No step ever specified capsule/card parity.
2. **RC-2 Token set too small:** `Theme` has bg/bgSubtle/bgStripe but no card/inner/capsule steps and one high-contrast border token for both themes.
3. **RC-3 CSS specificity:** plugin selectors lose to Obsidian attribute selectors on form controls.
4. **RC-4 Fixed geometry:** px width/height captured once; no resize path.
5. **RC-5 Font decision drift:** `branding.md §4` (Poppins/Lora) predates/ignores the prototype's Inter/DM Serif/JetBrains Mono; no mono face for badges/counts.
6. **RC-6 Undefined surface:** Options panel had no prototype reference, so it landed as an inline block in the toolbar's flex column.

---

## 5. Fix plan (tests first, per repo convention: new tests must fail on v1.0.1)

### Step 0 — failing tests / parity harness
- `tests/views/grid/geometry.test.ts`: fire a container resize → root width/height follow (fails: fixed px).
- `tests/views/grid/emptyState.test.ts`: 0–n rows always render grid shell + Insert Row affordance; no fixed 600 px height (fails).
- `tests/ui/tokens.test.ts` extension: theme exposes `bgCard`, `bgInner`, `bgCapsule`, `borderSubtle` in both themes (fails).
- `tests/ui/contrast.test.ts` extension: every text pair of the new ladder ≥ 4.5:1 in both themes; muted-small-text pair included (must fail on prototype's raw light-clay 3.55:1 → forces the accessible clay variant).
- `tests/views/toolbar.test.ts` extension: options surface is an anchored popover (not in toolbar flow); active row-height uses solid-accent class; rowcount carries mono class.
- Selector-specificity guard: a styles test asserting form-control rules are scoped (e.g. `.tablify__toolbar input.tablify__search-input`, 0,2,1) so Obsidian's 0,1,1 cannot win.

### Step 1 — defects (no design decisions needed)
1. **Resize:** implement `onResize()` in `TableView` (Obsidian lifecycle) re-measuring `contentEl` and updating grid geometry; keep virtualization math unchanged.
2. **Specificity:** re-scope input/button rules under `.tablify__toolbar` / `.tablify-view` + element qualifier; verify in a real vault with a custom host theme.
3. **Height/empty state:** grid shell fills available height via flex on `.tablify-view` (drop the 600 px default); when content is shorter than the shell, shell shows inner tint + Insert Row button (prototype A4).
4. **Header filler:** no right border on the last header cell; filler area takes shell tint without divider (kills E4).

### Step 2 — token re-ladder (needs owner approval, closes part of G-B1)
- Extend `Theme`/`cssVars`/`applyTheme` with: light `bgCard #FFFFFF`, `bgInner #F4EFE6`, `bgCapsule #FFFFFF`, `borderSubtle #E6E0D5`, muted-small `#6E655C` (accessible clay); dark `bg #181715`, `bgCard #22201D`, `bgInner #1B1A17`, `bgCapsule #262420`, `borderSubtle #38342E`, text `#ECE7E1`, muted-small gray-400 `#9CA3AF`, accent light `#CC785C` / dark `#D97757`.
- Keep `#b0aea5` out of dark borders entirely; `styles.css` swaps `--tablify-border` → `--tablify-border-subtle` for chrome, keeps a ≥3:1 boundary only where it is the sole identifier (focus/selection).
- Update `spec/branding.md §5` (mark values verified-against-prototype), `docs/evidence/P3-11.md`, contrast script pairs.
- **Known deviation to sign off:** prototype subtle borders measure ~1.5:1 against adjacent bg (WCAG 1.4.11 wants 3:1 when the border is the only identifier). Mitigation: surface step + shadow carry the boundary; focus ring stays ≥3:1. Same precedent as the existing 2.96:1 focus-ring note.

### Step 3 — toolbar & options restyle
- Search/query capsules: prototype padding (`pl-10 pr-4 py-2.5`), focus = accent border + rgba ring (replace 2 px outline).
- Buttons: `rounded-2xl`, leading terracotta glyph. Prototype uses Font Awesome CDN; plugin stays offline → **inline SVG** glyphs (plus / columns / sliders / undo / redo), no new dependency.
- **Options → anchored popover card (owner-decided):** right-aligned under the button, `max-width 320`, card bg, `borderSubtle`, radius 16, shadow; existing Esc + outside-click close. Row-height group = pill segment, active = solid terracotta + white text. Freeze = restyled select/stepper. Hidden fields = rows with Show pill. Clear filters = ghost button.
- Row count: mono stack, muted-small color, letter-spacing.

### Step 4 — grid capsule restyle (only if scope = full parity)
- Wrap grid in `.tablify__grid-shell` (bgInner, radius 16, borderSubtle, padding 8–12, inner shadow).
- Rows: drop `borderBottom` + striping; row margin-bottom 8 px; cells = capsules (bgCapsule, borderSubtle, radius 16, subtle shadow, 6 px horizontal gap). Frozen cells keep capsule bg opaque.
- Header capsules: grip glyph (inline SVG), name, type badge (mono 9 px, inner bg, borderSubtle), existing menu as ellipsis.
- Add mono row-number column; **defer** checkbox selection + bulk delete (needs a row-selection model; prototype-only feature, file-format impact) — decision D-4.
- Insert Row pill at shell bottom.
- Virtualization/RowPool unchanged in shape; re-run P6-02 bench (accept ≤10 % regression).

### Step 5 — typography (owner-decided: keep Poppins/Lora, add mono)
- Bundle **JetBrains Mono 400** (SIL OFL) for type badges, row-count badge, row-number column and version-style chips; update `fonts.test.ts`, `LICENSE-FONTS`, P6-06 release-size evidence.
- Poppins stays for headings/capsule titles (12 px semibold tracking-wide); Lora stays for body.
- Retune: header labels 11 px Poppins SemiBold uppercase tracking-wider muted-small; row-count 11 px mono muted-small tracking-wider.
- Record in `spec/branding.md §4`: the prototype's Inter/DM Serif trio was considered and declined; the Poppins-vs-Inter divergence is intentional and accepted.

### Step 6 — card wrapper & scrollbars (scope = full parity)
- `.tablify__card` around toolbar + grid (bgCard, radius 24, borderSubtle, shadow, padding 16–28); `.tablify-view` gets page padding + bg.
- 6 px themed scrollbars inside `.tablify` scope.

### Step 7 — evidence & close-out
- Screenshot matrix: desktop light/dark + mobile, before/after, into `docs/evidence/` (completes SAD-69 F).
- CHANGELOG 1.0.2 entry; user-guide tweak; `npm run check` green; then close SAD-69.

### Step 8 — Linear hygiene (done, 2026-10-10)
- Filed **SAD-71** — *Visual parity with Prototype/Anthropic Table Workspace.html (capsule grid, card wrapper, token ladder, popover options)* — under SAD-68, labels Bugs + MVP, priority 2, full plan in the description; related-link to SAD-69; plan comment posted on SAD-69. SAD-69 stays In Progress until the Step-7 evidence matrix lands and F is ticked.

---

## 6. Decisions needed from owner

| # | Decision | **Owner answer (2026-10-10)** |
|---|---|---|
| D-1 | Parity scope | **Full prototype restyle** — Steps 0–7 |
| D-2 | Fonts | **Keep Poppins + Lora**; add JetBrains Mono for badges/row-count/row-number; retune sizes/weights toward prototype |
| D-3 | Options surface | **Anchored popover card** |
| D-4 | Row checkbox / select-all / bulk delete | **Deferred to v1.1** (row-selection model); row-number column now |
| D-5 | Title row / in-pane export buttons | **Deferred** — Obsidian owns the file title; export stays a command |
| D-6 | Palette ladder + subtle-border WCAG deviation | **Approved** (via D-1); record in branding §5 / P3-11 |
| D-7 | Tracking | **New SAD-68 sub-issue + plan comment on SAD-69** — done: **SAD-71** |

## 7. Acceptance (for the chosen scope)

- Side-by-side with the prototype in light + dark: surfaces, borders, radii, type, active-state language match per scope; host theme swaps change nothing inside `.tablify-view` (inputs included).
- All text/background pairs ≥ 4.5:1; focus/selection ≥ 3:1 or explicitly signed off.
- Grid refits on pane resize; empty and 1-row tables show tinted shell + Insert Row, never a black void.
- New tests fail on `cafbd17`, pass after; `npm run check` green; P6-02 bench within 10 %.
- Evidence screenshots in `docs/evidence/`; SAD-69 F ticked and closed.

## 8. Out of scope (app-level prototype chrome)

Dataset tabs, "Saved to Anthropic Cloud" indicator, New Table, Ask Claude modal, footer — these belong to the prototype's standalone app frame, not to a single-file Obsidian view. Toasts stay Obsidian `Notice` (D5) unless owner insists.
