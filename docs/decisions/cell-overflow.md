# Decision D-CO1 — a long cell offers the rest of its value; the grid itself never changes

**Step:** SAD-376
**Date:** 2026-10-21
**Status:** DECIDED
**Decider:** Owner (issue SAD-376: *"Improve the table cell overflow behavior"*), implemented per the
measurements below. Every option the owner chose was asked as a direct question; the alternatives
in §3 are recorded because they were rejected on evidence, not taste.

---

## 1. Decision

**A cell whose *displayed* text is longer than a global character limit offers the rest of its value
through three layers that add up, and nothing else about the grid moves:**

| Layer | Trigger | Surface |
|---|---|---|
| In-cell control | hover (or touch, with the setting) | 20 px ⤢ button in the capsule's top-right corner |
| Preview card | 200 ms resting on the control | `role="group"` card, copy + expand |
| Expanded panel | click the control / the card's expand / **Expand cell** | the shared float panel, `role="dialog"` |

Default: **on**, **80 characters**, counted after formatting and chips. Four settings under
*Settings → Tablify → Cells*: the feature, the limit (20–2000), the card, the touch reveal.

Isolation is the contract, not a hope: the ellipsis, the column widths, the row heights, the cell's
own click, the `.tablify` format, the store, the command stack, export, search, sort and filter are
all untouched. The feature reads text that is already on screen.

## 2. Why a character count and not a measurement

**Because CSS measures and JavaScript does not.** `styles.css` gives `.tablify__cell-text`
`overflow: hidden; text-overflow: ellipsis; white-space: nowrap`, and the long-text variant swaps
that for `-webkit-line-clamp: 2` with `text-overflow: clip`. So:

- **`scrollWidth > clientWidth` is not a truncation test here.** A two-line-clamped cell reports
  `scrollWidth == clientWidth` while still cutting text (measured: 84 px of content in a 28 px box,
  `scrollWidth` equal on both axes) — and in jsdom it is 0, so the test suite could never pin it.
- **`::after { content: '…' }` type tricks cannot tell you if the ellipsis fired** without a
  second, duplicate layout box per cell, which is a per-cell layout cost on a virtualised grid.

The display string already exists as one variable in `GridView.fillRow` before it is appended, so
one `text.length > maxChars` covers every field type with no per-type code and no second formatting
path that could drift from the first. It is also the only rule that is *predictable* for the user,
which matters more than pixel-perfect: a limit you can set is better than a guess you cannot see.

**Cost of the approximation:** a cell whose glyphs are wide enough to be visually cut while under
80 characters does not offer Expand. That is bounded, documented in the user guide, and adjustable
to as low as 20.

## 3. Alternatives rejected

| Rejected | Why |
|---|---|
| **Geometric detection (`scrollWidth`/`scrollHeight`)** | Cannot see a line clamp (§2), costs a forced layout read per rendered cell on every paint, and returns 0 in the test environment — the rule would be unpinnable by the suite. |
| **Per-column limit** | The ticket is about how a *cell* reads, and a per-column setting multiplies the settings surface for a case nobody asked for. One global number is one thing to understand. |
| **Inline row growth (the cell simply gets taller)** | Changes the row pitch, the virtualised window and the scroll position of every view — the exact "do not disrupt the layout" clause in the ticket. Rejected on the ticket text. |
| **A modal** | Removes the grid from view and forces a decision (close) before continuing. The anchored float panel is what every other cell panel in this plugin already uses, and it dismisses on any press outside. |
| **Editing the value from the expanded view** | Turns a read affordance into a write path: an undo step, a save, a validation error and a focus question. Expanded is read-only, and the editor is one key away (**Enter**). |
| **A `title` tooltip** | Native tooltips cannot be themed, cannot carry buttons, and a `title` next to an `aria-label` produces two tooltips (SAD-109). |
| **Putting Copy on the grid's own clipboard** | `TableView.clipboardText` is the *range* clipboard: writing to it would change what **Paste** inserts, i.e. change an existing feature. Copy content goes to the system clipboard only. |
| **A keyboard-only dialog card (focus trap)** | A second focus-trapping dialog above a virtualised grid is a large accessibility change for a hover affordance. The card is pointer-only with no tabbable element; the panel is the keyboard surface, reached from the cell menu. |

## 4. The three defects this decision survived

Recorded because each one was found by measuring rather than by reasoning, and each is now pinned by
a test so it cannot come back:

1. **The in-cell control rendered as Obsidian's host pill** (26 × 30 px, bordered, accent ink)
   because `.tablify__cell-expand` (0,1,0) lost to the host's `button:not(.clickable-icon)` (0,1,1).
   Every rule is now element-qualified inside `.tablify` (0,2,1) and resets fill, ink, weight,
   height, padding, border, radius and shadow — the SAD-76 (RC-B) convention the toolbar already
   follows. Pinned in `tests/ui/cellOverflowCss.test.ts`.
2. **The expanded panel hung 28 px off a 390 px screen**: it was 360 px wide while `anchorPanel()`
   clamps against the shared `PANEL_WIDTH` (320). It is now exactly `PANEL_WIDTH`, and the CSS test
   asserts against the imported constant, so the stylesheet and the clamp cannot drift.
3. **Tab never reaches the in-cell control** — inside the grid, Tab moves the cell selection
   (P5-02). The keyboard route is therefore the cell menu's **Expand cell** (Menu key / Shift+F10),
   which is now pinned by a test of its own rather than assumed.

## 5. Consequences

- One new leaf module (`src/views/grid/cellOverflow.ts`) and one UI module
  (`cellOverflowUi.ts`); `settings.ts` imports the leaf, never the reverse.
- `GridView` grows four fields and one public method (`openCellOverflow`) that delegates to the
  method the panel already had; the cell menu grows one conditional item.
- Bundle (dev builds, `npm run build`): `main.js` 1,364,359 → 1,385,295 B and `styles.css`
  351,167 → 358,717 B, i.e. +1.5 % on the script and +2.2 % on the stylesheet. The size gate in
  `tests/ui/fonts.test.ts` was raised to 1,950,000 B with those measured numbers, per the
  P4-05 / P5-01 / SAD-71 precedent for an additive feature.
- Reversibility: turning **Expand long cells** off restores the grid to its pre-SAD-376 rendering
  exactly — the classes, the control and the card all disappear, and no file was ever written.
