# Tablify — SAD-376: table cell overflow / **Expand**

> **Execution status (2026-10-20): plan only.** No source file is modified by this document.
> Nothing is committed, pushed or built. Every statement about the codebase below was read out of
> the working tree at `019abd6` (`main`), not remembered or assumed; where something could only be
> checked at implementation time it is marked **VERIFY** with the exact command.
>
> **Delivered (2026-10-21):** every phase below shipped to `main` in six commits — `5b003e3`
> (settings), `d24fbd2` (predicate + icon), `ebc4239` (control, panel, CSS, threading), `54d4030`
> (hover card), `d20af69` (menu + touch), `ff43af1` (browser-found fixes + evidence). Two plan
> assumptions did not survive contact with a real browser — the control's selector lost to
> Obsidian's own button rule, and a 360 px panel hung off a 390 px phone — both are corrected and
> pinned by tests; see `docs/decisions/cell-overflow.md` §4. As-built record:
> [`docs/evidence/SAD-376.md`](../evidence/SAD-376.md).

**Date:** 2026-10-20 · **Repo:** `MakeTheNewHistory/Tablify` @ `019abd6` · **Mode:** plan only
**Ticket:** [SAD-376 — Improve the table cell overflow behavior](https://linear.app/sad-mod/issue/SAD-376/improve-the-table-cell-overflow-behavior)
(project *Tablify*, labels *Feature* / *Improvement*, priority Normal, no comments)

---

## 1. Verdict

The feature is **cheap to add and cheap to keep isolated**, because of two facts found in the code:

1. **Truncation is purely CSS.** No JavaScript measures or clamps text. `styles.css` gives
   `.tablify__cell-text` `overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, and the
   long-text variant swaps that for `-webkit-line-clamp: 2` with `text-overflow: clip` and
   `white-space: pre-wrap`. **Leaving CSS alone is the whole "preserve today's ellipsis" "
   requirement** — we add no rule that changes an existing selector's box.
2. **A cell's display text already exists as one string before it is appended**
   (`GridView.fillRow`, the `text` span). One length check after the per-type branches covers every
   field type with no per-type code, no refactor of `cellRender.ts`, and no second
   formatting path that could drift from the first.

So the work is: **one settings object**, **one pure predicate**, **one in-cell button**, **one hover
card**, **one anchored panel**, **one menu entry**, and CSS that is entirely additive. The
`.tablify` file format, the schema, the store, the command stack, export, search, sort, filter,
editing, row drag, selection, column geometry and the virtualizer are **not touched at all** (§9).

The main risks are not functional, they are **behavioural edge cases**: a new clickable thing inside
a cell that already owns click, double-click, hover-tooltip and drag semantics. §9 lists every one
with the mitigation and the test that pins it.

---

## 2. Decisions locked with the owner (2026-10-20)

These were asked and answered explicitly; the plan does not invent alternatives to them.

| # | Question | Decision |
|---|---|---|
| D1 | What defines "the configured size limit"? | **A global plugin setting: a character limit.** Stored in plugin `data.json` beside the Airtable token. Not per column, not per file. No `formatVersion` change. |
| D2 | Defaults | **Enabled by default, limit 80 characters.** 80 was chosen so an ordinary short value (names, dates, statuses, numbers) never shows the affordance. |
| D3 | What appears on hover | **Both layers**, each independently switchable in settings: the **in-cell expand icon** and the **hover preview card** from the reference screenshot (wrapped full text, `copy` + `expand` icons top-right). |
| D4 | Interaction ladder | **Icon → card → panel.** Hover a truncated cell → the in-cell icon fades in. Rest on **that icon** → the preview card opens (screenshot). Click the card's expand icon → the anchored panel with the full content. Clicking the **in-cell icon** skips the card and opens the panel directly. |
| D5 | Where full content opens | **The existing anchored float panel** (`.tablify__panel` + `anchorPanel()` + `wirePanelDismiss()`), the same primitive the select, date, phone, rating and attachment panels use. Not a modal, not an inline row growth. |
| D6 | Touch / no-hover | **Both**, switchable: an `Expand cell` entry in the existing cell context menu (long-press on mobile, right-click on desktop) **and** the icon kept visible on coarse pointers, mirroring how the SAD-108 drag grips stay visible under `hover: none`. |
| D7 | Which cells participate | **Any cell whose rendered display text exceeds the limit** — one generic rule, chip cells included, no per-type list. |

Deliberately **not** decided by the owner, so this plan picks the smallest defensible option and
flags it (§14): the card's auto-open delay, the panel's maximum height, and whether `Copy` from the
card/panel writes the view's internal paste buffer (it will **not**).

---

## 3. Requirement → implementation map

Straight from the ticket body, so that closing SAD-376 is a checklist, not an opinion.

| Ticket requirement | How it is met | Pinned by |
|---|---|---|
| "Preserve the existing ellipsis-based truncation behavior by default." | No existing CSS selector is modified. The button is `position: absolute` inside the capsule and adds **no text node**, so `cell.textContent`, the `:empty::before` em dash and the ellipsis geometry are byte-identical. | CSS contract test + a rest-state pixel diff against today (§10.2, §10.4) |
| "Display the Expand option only when the cell's content exceeds the defined size limit." | `isOverflowing(displayText, maxChars)` — one pure predicate, called once per cell in `fillRow`. Content exactly at the limit does **not** get the affordance (`>` not `>=`). | `cellOverflow.test.ts` boundary cases |
| "Show the option on hover without disrupting the table layout or cell interactions." | Absolute positioning (no layout box), `opacity: 0` + `pointer-events: none` at rest, revealed only inside `@media (hover: hover)`; no listener per cell — one delegated `click`/`pointerover`/`pointerout` on the grid's content element. | CSS contract test, `capsule.test.ts` invariants still green, visual diff at rest |
| "Ensure the expanded content is readable and can be collapsed back to its original state." | Panel body: Lora 13/20, `white-space: pre-wrap`, `overflow-wrap: anywhere`, `max-height` with internal scroll; `Escape`, a × button, and a press outside all close it; the cell is never modified, so "collapse" is simply "close". | `cellOverflowPanel.test.ts` (open/close/copy) |
| "Maintain consistency with the existing design system and support responsive layouts." | Existing panel card, existing theme tokens via `applyTheme`, existing icon pipeline (`faIcon`), existing hover-reveal precedent. Panel placement/clamping/flip comes from `anchorPanel()` unchanged, which already clamps to `innerWidth - 24` and flips above the anchor. | axe + contrast suites, `cellOverflow.test.ts` at phone width |
| "Avoid regressions in existing table functionality." | §9 enumerates the 11 interactions a new in-cell control can reach; each has a mitigation and a test. | Full `npm run check` + visual parity capture |

---

## 4. What the code actually does today (evidence)

### 4.1 Truncation is CSS, in exactly three places

| Where | What it says |
|---|---|
| `styles.css:2027` | `.tablify__cell { min-width: 0; padding: 4px; }` — the slot (prototype `<td>`). |
| `styles.css:2033` | `.tablify__capsule` — `display:flex; height:34px; padding:8px 14px; overflow:hidden;` fixed box, 28 px under `.tablify--rh-small`, 40 px under `.tablify--rh-large`. |
| `styles.css:2060` | `.tablify__cell-text { flex:1 1 auto; min-width:0; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }` |
| `styles.css:4741` | `.tablify__cell--long-text .tablify__cell-text { -webkit-line-clamp:2; white-space:pre-wrap; text-overflow:clip; }`, and `-webkit-line-clamp:1` under `.tablify--rh-small`. |
| `styles.css:2070` | `.tablify__capsule > .tablify__cell-text:empty::before { content:'—' }` — the empty-cell dash. Depends on `textContent` being `''`. |

Consequence: **we never need to detect visual clipping** — and we must not try to, because jsdom has
no layout (`scrollWidth`/`clientWidth` are 0), so any geometric test would be untestable in this
repo's unit suite. The character limit is both what the owner asked for (D1) and the only
implementation that keeps the whole feature covered by Vitest.

### 4.2 The one render path a cell goes through

`src/views/grid/GridView.ts`

- `fillRow()` (~line 1355) rebuilds **every** cell of a row on every render: `rowEl.innerHTML = ''`,
  then per field a `.tablify__cell` slot (`styleCell`), a `.tablify__capsule` child, and a
  `.tablify__cell-text` span that the per-type `if/else` chain fills (formula error → link chips →
  select chips → checkbox → rating → timestamp → url/email/phone → attachment chips → number →
  formatted → plain `String(value)`).
- Immediately after the chain: `capsule.appendChild(text); cell.appendChild(capsule);` then
  validation state, numeric class, long-text class, `data-field-id`, `role="gridcell"`,
  `aria-colindex`, `aria-description`, and the selection paint.
- Rows are **pooled and recycled** (`RowPool`, `rowPool.ts`) and rows outside the window are
  detached. → **No per-cell listeners, ever.** The grid already uses one delegated `pointerdown`
  for row drag (SAD-80) and one delegated `click` / `dblclick` on the root for selection and edit.
- Delegated `click` on `this.root` (~line 393) does selection, `onCellClick`, `onCellReselect`; a
  click that bubbles from a new in-cell `<button>` would therefore **also select the cell** unless it
  is stopped at the content level. The existing in-cell controls already do exactly this:
  `createCheckboxControl` (`cellRender.ts:120-132`), `renderContactLink` (`:324`), attachment thumb
  (`:391-397`) all `stopPropagation()` and stop `Enter`/`Space`.
- Column geometry: `DEFAULT_COLUMN_WIDTH = 160`, `RESIZE_MIN_WIDTH = 120`, `RESIZE_MAX_WIDTH = 520`;
  row pitch `44 / 50 / 56` px for small / medium / large (`virtual.ts`, `ROW_CHROME_PX = 16`).
- A trailing `#`-row-grip and the header grip are the repo's **hover-reveal precedent**
  (`.tablify__hc-grip`, `styles.css:2105`, revealed only inside the single
  `@media (hover: hover)` block at `styles.css:2325`; pinned by `tests/ui/hoverGrips.test.ts`).

### 4.3 There is no settings plumbing into the view — and it is a documented cut

`src/views/tableView.ts:67`:

```ts
/** Plugin-level services the view cannot reach itself (it has no access to plugin settings). */
export interface TableViewHooks { openSync?(view: TableView): void; }
```

`main.ts` registers the view with `{ openSync: (v) => this.openSyncFor(v) }`; the embed path
(`src/embed/register.ts`) constructs its own `EmbedView` → `GridView` and passes what it has. So a
new **setting** has to travel: `plugin.settings` → hooks/options → `GridView`. `src/settings.ts`
today is scalar-only (`airtableToken`), `normalizeSettings()` **drops unknown keys** by design, and
`DEFAULT_SETTINGS` is `Object.freeze`d.

### 4.4 The panel primitive we reuse (do not rebuild it)

`src/views/grid/select/panel.ts` (91 lines) exports exactly three things and is already used by the
select dropdown, the option manager, the attachment menu/panel, the phone panel, the rating panel
and the date picker:

- `createPanelCard(testid, theme, bodyClass)` → `{ card, body }`; `card` is `.tablify__panel`
  (`role="dialog"`, `position:fixed`, `z-index:70`, radius 16, shadow, 220–320 px, themed by
  `applyTheme`);
- `anchorPanel(card, anchor)` → `left` clamped to the viewport, `top = anchor.bottom + 6`, flips
  above when it would run off the bottom;
- `wirePanelDismiss(card, onDismiss)` → `mousedown` + `touchstart` outside, plus `Escape`; returns
  the unwire function.

`ImagePreviewModal` shows the *other* surface (Obsidian `Modal` + `dressProtoModal`) — **not** used
here, per D5.

### 4.5 Menus are a pure model

`src/menus/tableMenuModel.ts` — `cellEntries(ctx: CellContext)` returns `cell.edit`, `cell.copy`,
optional link items, `cell.paste`, `cell.clear`; `cellMenu()` appends row items after `SEPARATOR`.
Items are disabled **with a reason** rather than hidden, except where they never apply. Unit-tested
in `tests/menus/tableMenuModel.test.ts`. The view dispatches by `entry.id` in `openCellMenu`
(`tableView.ts` ~1218 builds the ctx; the action switch is nearby).

### 4.6 Icons are generated, and the glyph we need is not there yet

`src/ui/faIcons.ts` is produced by `scripts/gen-fa-icons.mjs` from the pinned
`@fortawesome/fontawesome-free@6.4.0` devDependency; `npm run check:icons` fails if the committed
file is stale, and `tests/ui/faIconBox.test.ts` pins Font Awesome's whole-pixel box.

- `copy` exists (`faIcons.ts:13`).
- **`up-right-and-down-left-from-center` (the diagonal two-arrow glyph in the screenshot) does not
  exist in the file, but it does exist in FA 6.4.0**: verified against the published package
  (viewBox `0 0 512 512`, path
  `M344 0H488c13.3 0 24 10.7 24 24V168c0 9.7-5.8 18.5-14.8 22.2s-19.3 1.7-26.2-5.2l-39-39-87 87c-9.4 9.4-24.6 9.4-33.9 0l-32-32c-9.4-9.4-9.4-24.6 0-33.9l87-87L327 41c-6.9-6.9-8.9-17.2-5.2-26.2S334.3 0 344 0zM168 512H24c-13.3 0-24-10.7-24-24V344c0-9.7 5.8-18.5 14.8-22.2s19.3-1.7 26.2 5.2l39 39 87-87c9.4-9.4 24.6-9.4 33.9 0l32 32c9.4 9.4 9.4 24.6 0 33.9l-87 87 39 39c6.9 6.9 8.9 17.2 5.2 26.2s-12.5 14.8-22.2 14.8z`).
  Add it **through the generator**, never by editing `faIcons.ts` by hand.
  `expand` also exists but is a different glyph (corner brackets, 448×512) — not the screenshot.

### 4.7 Test and gate reality

- `npm test` = `vitest run`; `vitest.config.ts` aliases `obsidian` → `tests/__mocks__/obsidian.ts`,
  which already implements `Setting` with `addText` / `addToggle` / `addButton` / `setName` /
  `setDesc` (so the settings UI is testable, as `tests/settings/settings.test.ts` already does).
- `npm run check` = `lint && test && check:guard && check:docs && check:icons && check:flags && build`.
  The guard **fails the build if the string `tabula` appears anywhere in `src/`** — new code must not
  contain it, not even in a comment.
- `npm run check:docs` validates links → any doc we add must not introduce a dead relative link.
- **`node_modules/` is absent in this clone** (fresh clone, no install). `npm install` (lockfile
  present) is step 0 of Phase 0; until then no test, build or icon check can run.
- Invariants that already exist and must stay green: `capsule.test.ts:74`
  (`cell.textContent === 'r0c0'`), `:99` (header `textContent`), `duplicateTooltips.test.ts`
  (never both `title` and `aria-label` on one element), `hoverGrips.test.ts` (hover-only reveal
  contract), `axeGrid.test.ts`, `contrast.test.ts`, `noPrototypeAnnotations.test.ts`
  (no "Feature N" / "simulated" / "UI-only" / "spec §" **outside comments**).

---

## 5. Design

### 5.1 Shape

```
plugin data.json ──► settings.ts ──► plugin.settings ──┬─► TableView (via TableViewHooks.readSettings)
   (cellOverflow)                                     └─► EmbedView (via register.ts options)
                                                                 │
                                                                 ▼
                                                        GridView({ overflow })
                                                                 │
              ┌──────────────────────────────────────────────────┼──────────────────────────────┐
              ▼                                                  ▼                              ▼
      cellOverflow.ts (pure)                        cellOverflowUi.ts (DOM)          tableMenuModel.ts (pure)
      isOverflowing(text, max)                      card + panel                      cell.expand entry
      normalizeCellOverflow()                       delegated wiring                 │
              │                                                  ▲                              │
              └────────────── fillRow() appends the button ──────┘                     TableView menu action
```

### 5.2 Module responsibilities

| Module | Kind | Why a separate module |
|---|---|---|
| `src/settings.ts` (extended) | config | one place that owns plugin data; keeps `normalizeSettings`'s "drop unknown keys" contract |
| `src/views/grid/cellOverflow.ts` (new, ~70 lines) | **pure** | `normalizeCellOverflow`, `isOverflowing`, `overflowCopyText` — no DOM, no Obsidian, unit-testable in the existing Node/jsdom suite, exactly like `tableMenuModel.ts` / `virtual.ts` |
| `src/views/grid/CellOverflowCard.ts` (new, ~150 lines) | DOM | the screenshot card; owns its timers and its own dismissal |
| `src/views/grid/CellOverflowPanel.ts` (new, ~120 lines) | DOM | the expanded panel, built on `select/panel.ts` so placement/dismissal cannot drift from the other panels |
| `GridView.ts` (extended) | wiring | knows rows, cells, fields; one delegated listener each for click and hover; closes the card on render/scroll/destroy |
| `tableView.ts` (extended) | wiring | supplies the config through the existing hooks; does the virtualizer-safe menu path |
| `tableMenuModel.ts` (extended) | pure | one new entry, with the existing disabled-with-reason convention |

### 5.3 Interaction state machine

```
            pointer over capsule (mouse only, hoverCard on)
  REST ─────────────────────────────────────────────► ICON VISIBLE (opacity 1, pointer-events auto)
   ▲   (icon opacity 0, pointer-events none)                  │
   │                                                          │ pointer rests on ICON ≥ 200 ms
   │ pointer leaves cell (+150 ms grace)                       ▼
   └───────────────────────────────────────────────────  CARD OPEN (fixed, anchored)
                                                              │
                              click ⤢ on card ────────────────┤
                              click icon (direct) ────────────┤
                                                              ▼
                                                          PANEL OPEN (anchored, role=dialog)
                                                              │  Esc / × / press outside / click another cell
                                                              ▼
                                                             REST
```

Rules:

1. **At rest the icon is inert**: `opacity: 0; pointer-events: none`. A click anywhere on the cell
   behaves exactly as it does today — this is what keeps selection, drag and double-click untouched.
2. The icon becomes interactive at the moment it is visible (hover / focus / coarse pointer). A
   click that lands on it is a deliberate click on a visible control, and it opens the panel.
3. The card never opens from a pointer merely crossing the cell: it needs **`ICON_REST_MS = 200`**
   on the icon itself. This is the single most important anti-flicker rule — a table is mostly
   pointer travel.
4. The card survives a short exit from the icon (**`CARD_GRACE_MS = 150`**) so the pointer can cross
   the 6 px gap into the card and reach its buttons.
5. One card, one panel per grid. Opening either closes the other. Both close on `render()`, on grid
   `scroll` (row recycling would otherwise leave a card over a different row), on `setModel()`, on
   `destroy()`.
6. Keyboard never sees the card. The icon is a real `<button>`; `Tab` reaches it, `Enter`/`Space`
   open the **panel** (which owns the copy action), `Escape` closes. `keydown` on the button is
   stopped so the grid's editor shortcut does not also fire (`stopButtonKeys` precedent,
   `GridView.ts:1558`).
7. Touch (coarse pointer, `touchReveal` on): no hover, so the icon is drawn at rest and the cell menu
   gains **Expand cell**. The panel is still anchored/clamped/flipped by `anchorPanel()`.

### 5.4 Wireframe (matches the reference screenshot)

```
                                 ┌──────────────────────────────┐
   one-line capsule              │  ⧉   ⤢                       │   ← card: copy, expand (the screenshot)
  ┌────────────────────────  ⤢┐  │                              │
  │ A very long value that…   │  │ A very long value that the   │
  └───────────────────────────┘  │ configured limit cut off in  │
         ▲ in-cell icon          │ the table.                   │
         │                       └──────────────────────────────┘
         │ hover                    anchored 6 px below the cell
         │
  ┌──────────────────────────────────────────────┐
  │  Expand cell                              ×  │   ← panel: full text, Lora 13/20, scrollable
  │  A very long value that the configured       │
  │  limit cut off in the table.                 │
  │  ─────────────────────────────────────────   │
  │  ⧉ Copy content                              │
  └──────────────────────────────────────────────┘
```

---

## 6. File-by-file implementation plan

> Line numbers are from `019abd6` and will drift; every insertion below names the **anchor text** to
> search for, not just a line.

### 6.1 `src/settings.ts` — the limit and its switches

Add a nested, frozen-by-default block. Keep `normalizeSettings`'s contract: unknown keys dropped,
never throws, invalid values fall back.

```ts
/** SAD-376: how a cell that is longer than the limit may be read in full. */
export interface CellOverflowSettings {
  /** Offer the expand affordance at all. */
  enabled: boolean;
  /** Character limit above which a cell offers Expand. */
  maxChars: number;
  /** Show the hover preview card (the reference screenshot). Off = the icon only. */
  hoverCard: boolean;
  /** On coarse pointers, keep the icon visible at rest and offer Expand cell in the cell menu. */
  touchReveal: boolean;
}

export const CELL_OVERFLOW_MIN_CHARS = 20;
export const CELL_OVERFLOW_MAX_CHARS = 2000;

export const DEFAULT_CELL_OVERFLOW: Readonly<CellOverflowSettings> = Object.freeze({
  enabled: true,
  maxChars: 80,
  hoverCard: true,
  touchReveal: true,
});

export interface TablifySettings {
  airtableToken: string;
  /** SAD-376. */
  cellOverflow: CellOverflowSettings;
}

export const DEFAULT_SETTINGS: Readonly<TablifySettings> = Object.freeze({
  airtableToken: '',
  cellOverflow: DEFAULT_CELL_OVERFLOW,
});

/** SAD-376: whatever is in plugin data → a usable overflow configuration. Never throws. */
export function normalizeCellOverflow(raw: unknown): CellOverflowSettings { /* §6.1.2 */ }
```

**6.1.1 The shared-reference trap (this must not be missed).**
`DEFAULT_SETTINGS` is frozen and `normalizeSettings()` currently returns `{ ...DEFAULT_SETTINGS }` in
four early-return branches. A shallow spread would hand every caller **the same frozen
`DEFAULT_CELL_OVERFLOW` object**; the settings tab assigns `this.host.settings = normalizeSettings(…)`
and later mutates a single field, which under `Object.freeze` is a silent no-op (or a throw in strict
mode). Every branch — including the existing token-invalid ones — must therefore rebuild the nested
object:

```ts
const defaults = (): TablifySettings => ({
  airtableToken: DEFAULT_SETTINGS.airtableToken,
  cellOverflow: { ...DEFAULT_CELL_OVERFLOW },
});
```

`tests/settings/settings.test.ts` uses `toEqual(DEFAULT_SETTINGS)`, which is **structurally equal**
and will not catch a shared reference — so add one explicit test:
`expect(normalizeSettings(null).cellOverflow).not.toBe(DEFAULT_CELL_OVERFLOW)`.

**6.1.2 `normalizeCellOverflow`**

```ts
export function normalizeCellOverflow(raw: unknown): CellOverflowSettings {
  const d = DEFAULT_CELL_OVERFLOW;
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) return { ...d };
  const r = raw as Record<string, unknown>;
  const bool = (v: unknown, fallback: boolean): boolean => (typeof v === 'boolean' ? v : fallback);
  const n = r.maxChars;
  const maxChars =
    typeof n === 'number' && Number.isFinite(n)
      ? Math.min(CELL_OVERFLOW_MAX_CHARS, Math.max(CELL_OVERFLOW_MIN_CHARS, Math.round(n)))
      : d.maxChars;
  return {
    enabled: bool(r.enabled, d.enabled),
    maxChars,
    hoverCard: bool(r.hoverCard, d.hoverCard),
    touchReveal: bool(r.touchReveal, d.touchReveal),
  };
}
```

`saveSettings()` must write the nested object explicitly (`{ airtableToken, cellOverflow: { … } }`) —
it deliberately writes only known keys, and that stays true.

**6.1.3 Settings UI** (`TablifySettingTab.display`, after the existing *Airtable* section):

```ts
new Setting(containerEl).setName('Cells').setHeading();

new Setting(containerEl)
  .setName('Expand long cells')
  .setDesc('Show an expand control on a cell whose text is longer than the limit below.')
  .addToggle((t) => t.setValue(settings.cellOverflow.enabled).onChange((v) => save({ enabled: v })));

new Setting(containerEl)
  .setName('Expand above this many characters')       // sentence case (review checklist 3.2)
  .setDesc(`Between ${CELL_OVERFLOW_MIN_CHARS} and ${CELL_OVERFLOW_MAX_CHARS}.`)
  .addText((text) => { text.inputEl.type = 'number'; … });

new Setting(containerEl).setName('Show the preview card on hover')…   // hoverCard
new Setting(containerEl).setName('Show the expand control on touch devices')… // touchReveal
```

Each `onChange` writes through `normalizeSettings` and saves (existing pattern), then asks the
plugin to refresh open tables (§6.7). Multiple headings are now correct per review-checklist 3.1
("headings only with multiple sections" — satisfied).

### 6.2 `src/views/grid/cellOverflow.ts` — the pure core (new)

```ts
/** SAD-376: is this cell's display text longer than the configured limit? */
export function isOverflowing(displayText: string, maxChars: number): boolean {
  if (!displayText) return false;
  // Code points, not UTF-16 units: an emoji must count as one character to the reader.
  return [...displayText].length > maxChars;
}
```

No trimming (the limit applies to what is shown, exactly), and `>` not `>=` (D-ticket wording:
"exceeds"). Also here: the two timing constants (§5.3), the shared `CARD_SELECTOR` class names, and
`copyToClipboard(text)`:

```ts
export function copyToClipboard(text: string): void {
  void navigator.clipboard?.writeText(text).catch(() => undefined);
}
```

*Decision (flagged in §14):* copying from the card/panel writes the **system clipboard only**. It
does **not** set `TableView.clipboardText`, so it cannot change what **Paste** pastes. That state is
per-view and feeds the cell menu's Paste item; quietly rewriting it from a read-only preview would be
a behaviour change to an existing feature. If the owner wants the two joined, it is one optional
callback (`onCopyText`) on `GridOptions` — noted, not built.

### 6.3 `GridView.fillRow` — one block, after the text is built

Anchor: the two lines `capsule.appendChild(text);` / `cell.appendChild(capsule);` (they appear once,
~line 1478). Insert between them:

```ts
capsule.appendChild(text);
// SAD-376: a cell whose display text is longer than the configured limit offers Expand. The
// button is absolute, carries no text node, and is inert at rest, so the ellipsis, the em dash
// and cell.textContent are exactly what they were.
if (this.overflow.enabled) {
  const shown = text.textContent ?? '';
  if (isOverflowing(shown, this.overflow.maxChars)) {
    cell.classList.add('tablify__cell--overflow');
    capsule.appendChild(createExpandButton(field.name));   // markup only; behaviour is delegated
  }
}
cell.appendChild(capsule);
```

`createExpandButton(fieldName)` (in `CellOverflowCard.ts` or a small `cellOverflowUi.ts`):

```ts
export function createExpandButton(fieldName: string): HTMLButtonElement {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'tablify__cell-expand';
  btn.dataset.overflowExpand = '1';           // the delegated hook
  // aria-label only — never title+aria-label together (duplicateTooltips.test.ts).
  btn.setAttribute('aria-label', `Show full content of ${fieldName}`);
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.innerHTML = faIcon('up-right-and-down-left-from-center'); // generated markup, no user text
  return btn;
}
```

Why this exact spot: `text.textContent` is final here for **every** branch (including chips, links,
timestamps, attachment chips and the plain fallback), and `capsule` is in hand as the positioning
context. Nothing earlier is safe (the chain has not run) and nothing later can reach the capsule
without re-querying.

### 6.4 `GridView` — options, delegated wiring, lifecycle

**Options** (`GridOptions`, after `onPreviewAttachment`):

```ts
/** SAD-376: the overflow/Expand configuration. Absent = DEFAULT_CELL_OVERFLOW. */
overflow?: CellOverflowSettings;
```

Constructor: `this.overflow = opts.overflow ?? DEFAULT_CELL_OVERFLOW;` and reflect it on the root so
CSS can tell the two modes apart without JS per cell:

```ts
this.root.classList.toggle('tablify--overflow', this.overflow.enabled);
this.root.classList.toggle('tablify--overflow-touch', this.overflow.enabled && this.overflow.touchReveal);
```

`setModel()` keeps the current config; add `setOverflow(next)` that stores it, re-applies the two
classes and re-renders only when something changed (used by §6.6).

**Delegated click** (constructor, on `this.content`, which is an ancestor of every cell and a
descendant of `root`, so `stopPropagation()` here keeps the root's selection handler out):

```ts
this.content.addEventListener('click', (e) => {
  const btn = (e.target as HTMLElement | null)?.closest?.('[data-overflow-expand]') as HTMLElement | null;
  if (!btn) return;
  e.preventDefault();
  e.stopPropagation();          // the cell owns the click; the grid must not also select/edit
  const cell = btn.closest('.tablify__cell') as HTMLElement | null;
  if (cell) this.openOverflowPanel(cell);
});
```

**Delegated hover** (one pair of listeners, not one per cell):

```ts
this.content.addEventListener('pointerover', (e) => { /* pointerType === 'mouse' only */ });
this.content.addEventListener('pointerout',  (e) => { /* … */ });
```

`openOverflowPanel(cell)` derives **everything from the DOM** — no per-cell state survives a
re-render:

```ts
const text = cell.querySelector<HTMLElement>('.tablify__cell-text')?.textContent ?? '';
const col  = Number(cell.dataset.colIndex);
const field = this.fields[col];
const anchor = cell.querySelector<HTMLElement>('.tablify__capsule') ?? cell;   // same anchor the select panel uses
```

**Lifecycle**: `this.overflowUi?.close()` at the top of `render()`, in `setModel()`, in the `scroll`
handler (before the early return), and in `destroy()`.

**Keyboard**: the button gets a `keydown` listener that stops `Enter`/`Space` (reuse the existing
`stopButtonKeys` helper, `GridView.ts:1558`) so the grid's `enterEdit` cannot also fire.

### 6.5 `CellOverflowCard.ts` + `CellOverflowPanel.ts` (new)

```ts
// CellOverflowCard.ts — the screenshot card. Pointer-only; not in the tab order.
export interface OverflowCardOptions {
  text: string;
  anchor: HTMLElement;           // the capsule
  theme: 'light' | 'dark';
  onExpand: () => void;
}
export function openOverflowCard(o: OverflowCardOptions): { close(): void };
```

- Node: `.tablify__cellcard` — fixed, `z-index: 70` (same layer as every panel), width
  `min(320px, 100vw - 24px)`, radius 16, `--tablify-bg-pill`/`--tablify-border-subtle` tokens via
  `applyTheme`, shadow as `.tablify__panel` has.
- `role="group"` + `aria-label="Cell content preview"`; **not** `aria-hidden` (its buttons are
  focusable, and an `aria-hidden` subtree with focusable children fails axe, which this repo runs in
  `axeGrid.test.ts`).
- Top-right tool row: `copy` (`aria-label="Copy content"`) and
  `up-right-and-down-left-from-center` (`aria-label="Expand cell"`, `aria-haspopup="dialog"`).
- Body: the full text, `white-space: pre-wrap`, `overflow-wrap: anywhere`, `max-height: 40vh`,
  `overflow: auto`. Plain text only — chips in a select/link cell are read as their labels, by design
  (§14).
- Geometry: reuse the arithmetic of `anchorPanel` (place below, flip above when short of room,
  clamp `left` to `8 … innerWidth - width - 12`). It is 12 lines; duplicating it beats making
  `anchorPanel` do a second job, and the CSS/behaviour contract test pins both.

```ts
// CellOverflowPanel.ts — the anchored panel, built on the shared card primitive.
export class CellOverflowPanel {
  constructor(opts: { text: string; fieldName: string; theme: 'light' | 'dark' });
  open(anchor: HTMLElement): void;   // createPanelCard + anchorPanel + wirePanelDismiss
  close(): void;
}
```

- `createPanelCard('tablify-cell-overflow-panel', theme, 'tablify__overflow-body')`, plus
  `.tablify__panel--overflow` for width (360 px, `max-width: min(360px, 100vw - 16px)` — the
  attachment panel sets exactly this precedent at `.tablify__panel--attach`, `styles.css:2900`).
- Header: the field name (muted, mono, 10 px — the same eyebrow treatment the other panels use) and
  a × button (`aria-label="Close"`).
- Body: the full text at **13/20 Lora**, `pre-wrap`, `overflow-wrap: anywhere`, `max-height: 50vh`,
  `overflow: auto`.
- Footer: one action, **Copy content** (`copy` glyph) — the screenshot's copy icon, at panel scale.
- Dismissal: `wirePanelDismiss` (outside press, `Escape`) + the × button. On close, return focus to
  the grid root, like `openCellPanel`'s `closePanel()` does.

**Never touches the store.** No `setValue`, no command, no `afterChange` → **zero** risk to undo,
save, sync, validation, formulas or links, because nothing is written.

### 6.6 `tableView.ts`

1. Extend the hooks (the comment at line 67 already explains why this is the channel):

```ts
export interface TableViewHooks {
  openSync?(view: TableView): void;
  /** SAD-376: current plugin settings, read at render time (the view cannot reach them). */
  readSettings?(): TablifySettings;
}
```

2. In `renderGrid()`, next to the other `GridView` options:

```ts
const overflow = this.hooks.readSettings?.().cellOverflow ?? DEFAULT_CELL_OVERFLOW;
… new GridView({ …, overflow })          // creation branch
… this.grid.setOverflow(overflow)        // else branch, before setModel/setSelection
```

3. Public `refreshGrid()` for the settings tab (§6.7):

```ts
/** SAD-376: re-read the overflow settings and repaint. No model change, no save. */
refreshGrid(): void { this.renderGrid(); }
```

4. **Menu** (`openCellMenu`): compute the flag from the DOM, not from a second formatting path:

```ts
const textEl = ...cell?.querySelector<HTMLElement>('.tablify__cell-text');
const overflowText = isOverflowing(textEl?.textContent ?? '', cfg.maxChars) && cfg.enabled && (!touchMenuRequiresReveal);
cellMenu({ …, overflowText })
```

and handle the action:

```ts
if (id === 'cell.expand') { this.openOverflowPanelAt(sel.row, sel.col); return; }
```

`openOverflowPanelAt` reuses `this.cellElement(sel)` (already exists, line 953) for the anchor and
`.tablify__cell-text` for the text.

> Rationale for reading the DOM instead of re-formatting: the display text is produced by a
> 12-branch chain in `GridView.fillRow` (link summaries, chips, timestamps, attachments…).
> Re-implementing it in `tableView.ts` would create a second source of truth that can drift — the
> exact bug class `cellRender.ts`'s header comment warns about. Reading the rendered span is exact
> by construction, and the cell is always on screen when its own menu is open.

### 6.7 `main.ts`

- Pass the hook: `new TableView(leaf, { openSync: …, readSettings: () => this.settings })`.
- Add a debounced `refreshOpenTables()` used by the settings tab after a save:

```ts
refreshOpenTables(): void {
  for (const leaf of this.app.workspace.getLeavesOfType(TABLIFY_VIEW_TYPE)) {
    const v = leaf.view;
    if (v instanceof TableView) v.refreshGrid();
  }
}
```

(`getLeavesOfType` is standard Obsidian; **VERIFY** at implementation time against
`tests/__mocks__/obsidian.ts` — if the mock lacks it, guard with `?.` and add it to the mock rather
than weakening the source.)

- The settings tab receives `this` (already does, as `SettingsHost`) → call `host.refreshOpenTables?.()`.
  Embeds pick the change up on their next render; documented, not force-refreshed (an embed may be
  mid-edit in another pane, and re-rendering it from a settings change would be a new behaviour).

### 6.8 Embeds — `src/embed/embedView.ts` + `src/embed/register.ts`

`EmbedViewOptions` gains `overflow?: CellOverflowSettings`, passed straight into `new GridView({…})`
(`embedView.ts:188`). `register.ts` passes `overflow: normalizeCellOverflow(plugin.settings.cellOverflow)`
— `registerEmbedProcessor(plugin)` already receives the plugin, so no new plumbing. Same feature,
same config, no separate code path.

### 6.9 `src/menus/tableMenuModel.ts`

```ts
export interface CellContext {
  …
  /** SAD-376: the cell's display text is longer than the configured limit. */
  overflowText?: boolean;
}

export function cellEntries(ctx: CellContext): MenuEntry[] {
  const entries: MenuEntry[] = [
    { id: 'cell.edit', … },
    // SAD-376: only offered when there is more to read.
    ...(ctx.overflowText ? [{ id: 'cell.expand', label: 'Expand cell', enabled: true }] : []),
    { id: 'cell.copy', label: 'Copy', enabled: true },
  ];
  …
}
```

Hidden rather than disabled when it does not apply — the file's own rule is "items that do not apply
are disabled with a reason", and the one precedent for a conditional entry is the link item
(`cell.links`), which is also conditional. Also add it to the table's own right-click summary in
`docs/user-guide.md` §15 and to `spec/features.md` §2.17.

### 6.10 `src/ui/faIcons.ts` + `scripts/gen-fa-icons.mjs`

1. Append to `GLYPHS` in the generator:

```js
  // SAD-376: the expand affordance (the reference screenshot's diagonal two-arrow glyph)
  'up-right-and-down-left-from-center',
```

2. `npm install` (node_modules is absent), then `node scripts/gen-fa-icons.mjs` — **never** hand-edit
   `faIcons.ts`; `npm run check:icons` fails on a stale hand edit.
3. `copy` is already present; nothing else to add.

### 6.11 `styles.css` — two additive blocks

**Block A**, immediately after the `.tablify__cell-text` rule (`styles.css:2060`):

```css
/* SAD-376: the expand affordance. Absolute, so it takes no space in the capsule and no text can
   shift; inert at rest; revealed only where a pointer can hover (the SAD-108 grip rule), and kept
   visible on coarse pointers when the plugin setting says so. */
.tablify__cell--overflow > .tablify__capsule {
  position: relative;          /* containing block for the button; the capsule has no other abs child */
}

.tablify__cell-expand {
  position: absolute;
  right: 4px;
  top: 50%;
  transform: translateY(-50%);
  display: grid;
  place-items: center;
  width: 20px;
  height: 20px;
  padding: 0;
  border: 0;
  border-radius: 8px;
  background: linear-gradient(to right, transparent, var(--tablify-bg-capsule) 35%);
  color: var(--tablify-text-muted);
  font-size: 10px;
  opacity: 0;
  pointer-events: none;        /* at rest a press belongs to the cell, exactly as before */
  transition: opacity 120ms ease;
}

.tablify__cell-expand:focus-visible {
  outline: 2px solid var(--tablify-focus);
  outline-offset: -2px;        /* the capsule clips at overflow: hidden */
}

@media (hover: hover) {
  .tablify__cell--overflow:hover > .tablify__capsule > .tablify__cell-expand,
  .tablify--overflow .tablify__cell-expand:focus-visible {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (hover: none) {
  .tablify--overflow-touch .tablify__cell-expand {
    opacity: 1;
    pointer-events: auto;
  }
}

@media (prefers-reduced-motion: reduce) {
  .tablify__cell-expand { transition: none; }
}
```

The `@media` blocks go into (or immediately beside) the existing single hover block at
`styles.css:2325`, so `hoverGrips.test.ts`'s one-level `@media` reader still sees everything.

**Block B**, after `.tablify__panel--attach` (`styles.css:2900`): `.tablify__cellcard`,
`.tablify__cellcard-tools`, `.tablify__cellcard-body`, `.tablify__panel--overflow`,
`.tablify__overflow-body`, `.tablify__overflow-text`, `.tablify__overflow-foot`. Every colour is an
existing `--tablify-*` token, so `contrast.test.ts` and `tokensNoObsidianVars.test.ts` keep passing
without new token work.

Two CSS facts to respect:

- `.tablify__capsule` has `overflow: hidden` → the focus ring must be inset (`outline-offset: -2px`,
  as above) or it will be clipped.
- Row heights are 28 / 34 / 40 px. The 20 px control with `translateY(-50%)` fits all three; the
  `tablify--rh-small` capsule is 28 px tall with 4 px vertical padding, leaving 20 px — the button
  exactly fills it, which is why `height: 20px` is a constant and not a percentage.

---

## 7. Accessibility

| Concern | Handling |
|---|---|
| Reachable without a mouse | The icon is a real `<button>`, so `Tab` reaches it in reading order; the card is pointer-only and never required. |
| Name | `aria-label="Show full content of <field name>"`; **no `title`** (dual-tooltip rule, `duplicateTooltips.test.ts`). |
| Role of what opens | Panel: `role="dialog"` (from `createPanelCard`), `aria-haspopup="dialog"` on the trigger. Card: `role="group"` with a label, no `aria-hidden`. |
| Focus | `Enter`/`Space` on the icon opens the panel and focus moves to its first control; close returns focus to `grid.root` (the pattern `openCellPanel`'s `closePanel()` uses). `Escape` closes (`wirePanelDismiss`). |
| Screen-reader text | Unchanged: cells keep `aria-description="Row N, column X"`; the icon contributes no text node, so `cell.textContent` (and therefore any SR reading of the cell) is identical. |
| Zoom / responsive | Panel width `min(360px, 100vw - 16px)`; `anchorPanel` clamps `left` and flips vertically; card capped at 320 px / `40vh`. |
| Reduced motion | Transition disabled under `prefers-reduced-motion: reduce`. |
| Contrast | Muted text token on the capsule's own background (already the token the empty dash and the header eyebrow use). `contrast.test.ts` covers it; the axe run in `axeGrid.test.ts` must stay clean with a truncated cell in the fixture. |

---

## 8. What we are **not** changing (the isolation contract)

No diff will touch: `.tablify` file format or `FORMAT_SPEC.md`; `tablify.schema.json`; `formatVersion`;
`src/model/**` (store, commands, session, validation, view, types); `src/format/**`; `src/io/**`
(import/export); `src/query/**`; `src/formula/**`; `src/sync/**`; `src/links/**`;
`src/views/grid/cellRender.ts` (no per-type branch is modified); `virtual.ts`; `rowPool.ts`;
column widths, frozen columns, grouping, sorting, filtering; the editor factories; any existing
`MenuEntry` id; any existing CSS selector's declarations (only new rules are added, plus
`position: relative` **scoped to `.tablify__cell--overflow > .tablify__capsule`**).

The one deliberate addition to an existing surface is the `Expand cell` menu item — additive, and
only present when the cell actually overflows.

---

## 9. Non-regression analysis: every interaction the new control can reach

| # | Existing behaviour | How the new control could break it | Mitigation | Test that pins it |
|---|---|---|---|---|
| R1 | Click selects the cell; second click / dblclick edits | A bubbling button click also selects, deselects or edits | `stopPropagation()` at the content-level delegated listener, before the root's click handler; `preventDefault()` | `cellOverflow.test.ts`: click icon → panel opens **and** selection/`onCellClick`/`onCellActivate` are not called |
| R2 | A cell's text is exactly `cell.textContent` (search, copy, tests) | A button with a label adds text | Button holds only an SVG; name lives in `aria-label` | new assertion on a long value: `cell.textContent === original` (plus existing `capsule.test.ts:74`) |
| R3 | The empty-cell em dash via `:empty::before` | A child in the span would defeat `:empty` | Button is appended to the **capsule**, never to `.tablify__cell-text`; empty text never overflows | `:empty` assertion in `cellOverflow.test.ts` |
| R4 | Ellipsis / 2-line clamp geometry | Extra padding or a flex sibling shrinks the text box | `position: absolute`; no `padding`/`margin`/flex change on the capsule or span | CSS contract test (`position: absolute`, rest `opacity: 0`, `pointer-events: none`) + rest-state pixel diff |
| R5 | Row height / pitch 44-50-56 and the virtualizer | A taller capsule would desync `totalHeight` | Nothing changes the capsule's box; the control is 20 px inside 28/34/40 px | `virtual.test.ts` untouched + `geometry.test.ts` untouched + visual diff |
| R6 | Hover tooltips already owned by cells (validation SAD-109, rating SAD-304, formula, broken link) | A `title` on the button → twin tooltips | No `title` anywhere in the new markup | `duplicateTooltips.test.ts` extended to a truncated fixture |
| R7 | Keyboard: `Enter` opens the editor on the selected cell | Focused icon lets `Enter` reach the grid | `stopButtonKeys` on the button (existing helper) | `keyboard.test.ts` + a case in `cellOverflow.test.ts` |
| R8 | Row drag from the `#` cell; column resize/drag | A pointerdown on the icon could start a drag | The icon is inside the capsule, not the lead; `pointer-events: none` at rest | existing row-drag tests |
| R9 | Panels already open (select/date/phone/rating/attachment) | Two overlapping dialogs | Opening the overflow panel closes the card; the other panels are opened from the editor path, and the icon is unreachable while an editor covers the cell | `cellOverflow.test.ts` (card closes on panel open) |
| R10 | Scroll & re-render (row recycling) | A fixed card left over a different row | Close on `scroll`, `render`, `setModel`, `destroy` | `scrollRender.test.ts` + a case asserting `document.querySelector('.tablify__cellcard')` is null after `grid.render()` |
| R11 | Settings data written on every keystroke | A nested object written as `[object Object]` or dropped | `saveSettings` writes the nested keys explicitly; round-trip test | `settings.test.ts` additions |
| R12 | Other tables / embeds in the same session | A stale config after a settings change | `setOverflow` on the `else` branch of `renderGrid`, plus `refreshGrid()` from the settings tab | `tableView.test.ts` addition (spy on `setOverflow`) |

**Performance.** Per cell: one `[...text].length` on an already-built string (only when enabled) and,
for the overflowing minority, one `<button>` + one SVG. Listeners: **two delegated** (`click`,
`pointerover`/`pointerout`) per grid, never per cell — the pooling constraint from §4.2 forces this
anyway. Expected cost at the release target (1,000 rows × 12 columns, ~35 rows in the window): ≤ 420
string-length checks per render, ~0.1 ms; the button count is bounded by the visible rows.

---

## 10. Test plan

### 10.1 `tests/views/grid/cellOverflow.test.ts` (new, jsdom) — behaviour

- `isOverflowing` boundaries: `maxChars - 1`, `maxChars`, `maxChars + 1`, empty, whitespace-only,
  a 2-code-point emoji counted as 1, a 100k-character value (no throw).
- Render: no icon at `≤ maxChars`; an icon at `> maxChars`; none when `enabled: false`; none for an
  empty cell; **present for `long_text`, `select`, `link`, `attachment`, `formula` and `number`**
  when their display text is long (D7's "any cell" rule); `cell.textContent` unchanged; the text span
  still `:empty` when the value is empty.
- Root classes: `tablify--overflow` / `tablify--overflow-touch` present per config; absent when
  disabled.
- Click: opens the panel (`[data-testid="tablify-cell-overflow-panel"]`), and the grid's
  `onCellClick`, `onCellReselect`, `onCellActivate` are **not** called (spies).
- Panel: title is the field name; body text equals the full display text (not the truncated one);
  Copy writes the full text (`navigator.clipboard.writeText` spy); `Escape` and an outside
  `mousedown` close it; the × closes it.
- Card: opens only after the delay with fake timers; survives the grace gap; its expand icon opens
  the panel and closes itself; no card when `hoverCard: false`; no card for `pointerType: 'touch'`.
- Lifecycle: `grid.render()` closes an open card; `grid.destroy()` removes both.
- a11y: `aria-label` present, **no `title`** on the button; `aria-haspopup="dialog"`.
- Phone width (390 px): the panel's `left` stays ≥ 8 and `left + width ≤ innerWidth - 8`.

### 10.2 `tests/ui/cellOverflowCss.test.ts` (new) — the CSS contract, in the `hoverGrips.test.ts` style

Reuse that file's one-level `@media` rule reader to assert: rest state `opacity: 0` **and**
`pointer-events: none`; reveal rule exists only inside `@media (hover: hover)`; a `@media (hover: none)`
rule `.tablify--overflow-touch .tablify__cell-expand` sets `opacity: 1`; `position: absolute`;
no rule sets `width`/`padding`/`margin` on `.tablify__cell-text` or `.tablify__capsule` that did not
exist before; `.tablify__cellcard` and `.tablify__panel--overflow` z-index values are ≥ the panel's.

### 10.3 Settings + menu (extend existing files)

- `tests/settings/settings.test.ts`: defaults (enabled, 80, card on, touch on); clamping
  (`5 → 20`, `99999 → 2000`, `80.6 → 81`, `NaN`/`'80'`/`null` → 80); booleans of the wrong type →
  defaults; unknown keys dropped; **`normalizeSettings(null).cellOverflow` is a fresh object, not
  `DEFAULT_CELL_OVERFLOW`**; `saveSettings` round-trip writes exactly `{airtableToken, cellOverflow}`;
  legacy `data.json` with only `airtableToken` → full defaults.
- `tests/menus/tableMenuModel.test.ts`: `cell.expand` present only with `overflowText: true`; its
  position is directly after `cell.edit`; existing ids and order unchanged when the flag is absent.
- `tests/views/tableView.test.ts`: the menu action opens the panel for an overflowing cell and does
  nothing for a short one; `refreshGrid()` repaints without saving (no `requestSave` call).

### 10.4 Visual / evidence (`docs/evidence/sad-376/`)

- A new `tests/visual/capture-overflow.ts` on the existing harness (`tests/visual/lib/harness.ts`,
  which mounts the real `TableView` with `styles.css` inline):
  1. **rest state, feature off vs on** — must be pixel-identical (this is the ticket's "no layout
     disruption" claim, measured, not asserted);
  2. hover on a 200-character text cell (light + dark, medium + small + large row heights);
  3. hover on a 2-line `long_text` cell;
  4. the card; 5. the panel; 6. the panel at 390 px width; 7. a `select`/`attachment` cell (chips);
  8. the cell menu with `Expand cell`.
- Record in `docs/evidence/sad-376.md`: commit, date, Chromium version, viewport sizes, the diff
  numbers for (1), and the axe result.
- **NOT RUN** items must be listed explicitly (no iOS/Android device here): the touch reveal and the
  long-press path on a real phone — marked NOT RUN with the reason, per `spec/guidelines.md` §0.1.

### 10.5 Full gate

```
npm install
npm run lint          # eslint src/ tests/
npm test              # vitest run  (existing suites must stay green: 301+ grid/model tests, ui/*)
npm run check:icons   # after `node scripts/gen-fa-icons.mjs`
npm run check:docs    # any doc link we add must resolve
npm run check:guard   # the word "tabula" must not appear in src/
npm run build         # main.js is a committed artifact; rebuild it
npm run check         # all of the above in one shot
```

---

## 11. Phases

Each phase is shippable-green on its own; nothing is half-wired at a phase boundary.

| Phase | Content | Acceptance | Evidence |
|---|---|---|---|
| **P0** | `npm install`; baseline: run the full suite, capture rest-state screenshots of a fixture with 200-character and 2-line cells (feature absent) | Suite green; baseline images stored | `docs/evidence/sad-376/baseline-*.png` |
| **P1** | `settings.ts` (+ tests) — model only, no UI surface yet | New settings tests green; every existing settings test untouched and green | test output |
| **P2** | `cellOverflow.ts` pure predicate (+ boundary tests) | Table in §10.1 green | test output |
| **P3** | Settings UI + `refreshOpenTables()` | The four controls render under a *Cells* heading; a change repaints an open table without saving | capture + `tableView.test.ts` |
| **P4** | Button in `fillRow`, delegated click, CSS block A, icon glyph | Rest state pixel-identical to P0; click opens a stub panel; R1–R8 green | visual diff ~0 px; test output |
| **P5** | Hover card (timers, dismissal, theme) | Delay/grace behaviour, lifecycle closes, dark/light captures | captures + tests |
| **P6** | Panel (`CellOverflowPanel`), copy, focus return | Full text readable, `Escape`/×/outside close, focus back to the grid | captures + tests |
| **P7** | Menu entry + touch reveal + embeds | Long-press menu shows `Expand cell`; `hover: none` keeps the icon; embed shows the same affordance | tests + NOT RUN note for real devices |
| **P8** | Docs (`docs/user-guide.md` §4d, `spec/features.md` §2.5 + §2.17, `CHANGELOG.md`, `docs/decisions/cell-overflow.md`), evidence file, full `npm run check` | Gate green; evidence complete with the NOT RUN list | `docs/evidence/sad-376.md` |

---

## 12. Documents to update when it ships

| File | Change |
|---|---|
| `docs/user-guide.md` | new §4d **Reading a long cell in full** (icon, card, panel, the setting), plus `Expand cell` in §15 *The table context menu* |
| `docs/user-guide.md` §17 *Troubleshooting* | "The expand control does not appear" → the 80-character limit and its setting |
| `spec/features.md` | §2.5 *Grid view*: one bullet; §2.17 *Table right-click*: the new item |
| `CHANGELOG.md` | `### Added` entry in the repo's measured voice (what it does, what it does **not** change: no `formatVersion`, no write path, no per-column setting) |
| `docs/decisions/cell-overflow.md` (new) | D1–D7 with the alternatives rejected (geometric `scrollWidth` detection, per-column limit, inline row growth, modal) and why |
| `README.md` | one line in **Features** only if the owner wants it in the shop window |

---

## 13. Verification commands used for this plan (read-only)

```
git clone https://github.com/MakeTheNewHistory/Tablify && cd Tablify && git log --oneline -1  # 019abd6
wc -l src/views/grid/*.ts src/views/grid/*/*.ts src/ui/*.ts                                # sizes
grep -rn "truncat|ellipsis|text-overflow" src/ styles.css                                  # CSS-only truncation
sed -n '2020,2080p;4725,4770p' styles.css                                                  # capsule + clamp rules
sed -n '1280,1559p' src/views/grid/GridView.ts                                             # fillRow
sed -n '300,470p'  src/views/grid/GridView.ts                                              # delegated listeners
cat src/views/grid/select/panel.ts src/views/grid/rowPool.ts src/views/grid/virtual.ts     # primitives
sed -n '55,140p' src/views/tableView.ts && cat src/main.ts                                 # settings plumbing
sed -n '1,175p' src/menus/tableMenuModel.ts                                                # menu model
sed -n '1,60p' tests/ui/hoverGrips.test.ts && head -45 tests/views/grid/duplicateTooltips.test.ts
curl -sL "https://unpkg.com/@fortawesome/fontawesome-free@6.4.0/svgs/solid/up-right-and-down-left-from-center.svg"
```

---

## 14. Open items (flagged, not guessed)

1. **Card auto-open delay (200 ms) and grace (150 ms)** — constants in `cellOverflow.ts`, tuned by
   feel at P5 against the captures. If the owner wants "instant on hover", it is one constant.
2. **Panel max height** — 50 vh with internal scroll; the screenshot shows no scrollbar, but a
   5,000-character value must not exceed the viewport.
3. **Chip cells in the card/panel** — select/link/attachment cells preview as their **plain label
   text**, not as chips. Reproducing chips would mean a second renderer; if the owner wants it, the
   panel can accept a `Node` instead of a string (small, additive).
4. **Copy does not touch the Paste buffer** (§6.2) — reversible decision, one optional callback.
5. **`getLeavesOfType` in the Obsidian mock** — **VERIFY**; add to the mock if missing rather than
   weakening `main.ts`.
6. **`tsconfig` module syntax for a type-only import of `TablifySettings` into `tableView.ts`** —
   **VERIFY** (`cat tsconfig.json`); use `import type` either way.
7. **2-line `long_text` at small row height** clamps to 1 line; a 60-character value in a narrow
   column is clamped in the DOM but under the 80-character limit, so no icon appears. That is the
   documented behaviour of a character limit (D1). If the owner wants *visual* truncation to also
   count, that is the geometric trigger we rejected in D1 and would need a resize/observer pass.

---

## 15. Definition of done for SAD-376

- [ ] `npm run check` green at the shipped commit (lint, all suites, guard, docs, icons, flags, build).
- [ ] Rest-state visual diff **0 px** with the feature enabled at its default limit.
- [ ] Every row of §3 satisfied and every row of §9 covered by a named test.
- [ ] Settings round-trip proven (no shared frozen object, no dropped key, legacy data preserved).
- [ ] Dark, light, small/medium/large row heights, phone width: captured.
- [ ] `docs/evidence/sad-376.md` written, including the **NOT RUN** device items.
- [ ] `CHANGELOG.md`, `docs/user-guide.md`, `spec/features.md`, `docs/decisions/cell-overflow.md` updated.
- [ ] No change to `FORMAT_SPEC.md`, `tablify.schema.json`, `formatVersion`, or the write path.
