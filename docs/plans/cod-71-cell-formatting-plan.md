# COD-71 — cell values render as text a person can read (six types)

> Plan only. `src/` is untouched; the only new files are this plan and
> `docs/plans/cod-71-cell-rendering-audit.md` (the investigation behind it).
> Issue: [COD-71](https://linear.app/code-bro/issue/COD-71/issue-single-select-fields-use-hard-coded-options-instead-of-imported) (P1, Bug, project Tablify)

## 1. What is actually broken

`GridView.fillRow()` prints the **stored value** for every cell it does not special-case:

```ts
text.textContent = val == null ? '' : String(Array.isArray(val) ? val.join(', ') : val);
```

Six field types do not store their display text, so the grid shows the wrong thing:

| Type | Stored | Grid today | Should read |
|---|---|---|---|
| `single_select` | `opt_a` | `opt_a` | chip **Alpha** |
| `multi_select` | `[opt_a, opt_b]` | `opt_a, opt_b` | chips **Alpha**, **Beta** |
| `currency` | `123456` (minor units) | `123456` | `1234.56` |
| `percent` | `0.25` | `0.25` | `25%` |
| `duration` | `90000` (ms) | `90000` | `1m 30s` |
| `checkbox` | `true` | `true` | a ticked box |

Everything else is already correct or merely plain — the full 21-type matrix, the prototype comparison
and the surface-by-surface audit are in `docs/plans/cod-71-cell-rendering-audit.md`.

The user's report reads as a *select* bug because a CSV import only produces text / number / date /
checkbox / single select — selects are simply the loudest case (every row shows `opt_…`).

## 2. Locked decisions

| Decision | Choice |
|---|---|
| Scope | **All six** types above, in COD-71 (not just selects) |
| Select look | **Chip with colour dot** — single select like the prototype; multi select smaller, no dot |
| Checkbox | **Clickable box** (`role="checkbox"`), one undo step per click — a real interaction, not a glyph |
| Leftover parity | **Separate follow-up issue**: rating stars, url/email/phone links, local timestamps, number separators + right alignment, attachment chips, long-text clamp |
| Delivery | Commit + push only; no tag, no release, no version bump; Linear → **In review** at the end |

## 3. Design

### 3.1 One dispatch in the renderer — `src/views/grid/GridView.ts`

Today's chain in `fillRow()`: formula error → link chips → `String(value)`.

```
else if (field.type === 'single_select' || field.type === 'multi_select')  → renderSelectChips(...)
else if (field.type === 'checkbox')                                        → renderCheckbox(...)
else                                                                       → getFieldType(type).format(val, field)
```

- The last line is the whole fix for currency / percent / duration: `format()` already returns
  `1234.56`, `25%`, `1m 30s`. For text, number, date, rating, url/email/phone, attachment and the
  system types `format()` returns exactly today's string — no visible change, one code path.
- Formula keeps its error branch; its value goes through `format()` (same output as today).
- Link keeps its chip branch.
- Attachment: `format()` stringifies arrays as `a,b`; today the renderer joins with `, `. Keep the
  array guard for attachment (or route every array through `join(', ')`) so a corrupt file renders as
  before.

### 3.2 Select chips — `renderSelectChips(host, field, value, theme)`

- `single_select`: one `span.tablify__chip` → `span.tablify__chip-dot` (aria-hidden) + the option
  name; `background` / `borderColor` / `color` from `optionChipColors(option.color, theme)` — the
  exact call the group header already makes (`GridView.ts:1214`), so no new palette and no per-hue CSS.
- `multi_select`: one `span.tablify__chip.tablify__chip--multi` per id (no dot, 10 px, prototype's
  smaller chip), **one space text node between chips** so `textContent` reads `Alpha Beta` and the
  spacing matches the prototype's `mr-1`.
- Theme comes from `this.root.classList.contains('tablify--dark')`, as the group header does.
- Unknown id / missing `options` / wrong shape → nothing rendered (identical to `format()`, copy,
  search and export today). The stored value is never touched.

### 3.3 Checkbox — `renderCheckbox(rowIndex, colIndex, ...)`

Markup inside `.tablify__cell-text`:

```html
<button type="button" class="tablify__check" role="checkbox" aria-checked="true|false"
        aria-label="<field name>">  faIcon('square-check') | faIcon('square')  </button>
```

- Click → `stopPropagation()` (no cell selection, no editor) → host callback
  `onToggleCheckbox(rowIndex, colIndex)`; `dblclick` on the button also stops, so a double click is
  two toggles and never opens the text editor.
- `TableView` implements the callback as `s.setValue(row.id, field.id, !isTrue)` + `afterChange()`:
  one command, one undo entry, saved like any other edit. `EmbedView` does the same through
  `doc.mutate` (embeds are editable; links are the only refused type).
- Keyboard: it is a real `<button>`; the existing `stopButtonKeys` guard keeps Enter/Space from
  reaching the grid's editor shortcut, so the button toggles natively. Focus ring via CSS.
- Icons: `scripts/gen-fa-icons.mjs` gains **regular-set** support (`{ set: 'regular', name: 'square' }`,
  the outline box the prototype uses) and regenerates `src/ui/faIcons.ts`; `check:icons` must pass.
  Fallback if that proves noisy: a CSS-drawn 14 px box for the unchecked state.
- `false` and `null` both render an empty box; clicking writes an explicit `true` / `false`. The
  never-touched → `null` behaviour of the editor path is unchanged (COD-66 F5 stays fixed).

### 3.4 CSS — `styles.css`

Next to the existing `.tablify__chip` rule (line 2623): cell scoping (vertical centring, max width),
`.tablify__chip--multi` (10 px, no dot, 4 px right margin), `.tablify__check` (button reset, 18 px,
accent colour when checked, muted when not, `:focus-visible` ring). No colour literals — palette only.

### 3.5 Edge cases

| Case | Behaviour |
|---|---|
| Empty value (any of the six) | nothing rendered; the em dash still shows |
| Select value with no matching option | nothing; value preserved in the file |
| Select field whose type does not match its value shape (corrupt) | nothing; no throw |
| Checkbox on a read-only-looking cell | checkbox is editable in every mode the plugin has; read-only types are auto/created/modified/formula, which are untouched |
| Narrow column / many multi values | chips clip inside the existing `.tablify__cell-text` ellipsis box |
| Imported `checkbox` values (`true`/`false`) | now render as a box; the stored boolean is unchanged |

## 4. Tests

### New — `tests/views/grid/cellFormatting.test.ts` (~16)

Selects (7): chip text; chip colours + dot; dark vs light ink; no `opt_` in the cell; multi order and
`textContent === 'Alpha Beta'`; empty → nothing; unknown id → nothing.
Currency / percent / duration (3): `1234.56`, `25%`, `1m 30s`, and the stored value untouched.
Checkbox (5): box for true, empty box for false and null; click calls the host callback once with the
right row/col and does not select or edit; `aria-checked` reflects state; keyboard (Enter) works.
Guard (1): text / number / date / rating / url render byte-identical to today.

Add one **import → render** test (jsdom): `buildTable(csv)` with values that exist in no preset
(`Alpha/Beta/Gamma`) → parse the produced file → render → the chips read the CSV values.

### Existing tests to change (deliberate, and only these)

- `tests/e2e/fieldTypes.browser.ts` `runRenderedValues()`: `fld_cur 123456 → '1234.56'`,
  `fld_pct 0.25 → '25%'`, `fld_dur 90000 → '1m 30s'`, `fld_single 'opt_a' → 'Alpha'`; add
  `fld_multi → 'Alpha Beta'`, a `.tablify__chip` presence check, and a `.tablify__check` click that
  flips the stored value and lands one undo step. Rewrite the "CURRENT contract" comment: it now pins
  only the four types that stay raw (rating, timestamps, links, attachments).
- `tests/views/grid/capsule.test.ts` / other `.tablify__cell-text` assertions: re-run and fix only
  what the six types touch.

### Browser proof

`npm run test:fields` (production `TableView`, Chromium) green; a read-only repro screenshot of the
imported CSV with chips + a checkbox click sequence; `npm run visual:compare` grid region should
improve (the prototype already draws chips and boxes).

## 5. Docs and evidence

| File | Change |
|---|---|
| `docs/evidence/COD-71.md` (new) | root cause, the six-type matrix, before/after screenshots, the tick-and-undo proof, gate numbers, blast radius |
| `docs/evidence/COD-66-all-fields.md` §3 F2 | six types marked **Fixed — COD-71**; the remaining four (rating, timestamps, links, attachments) explicitly left and linked to the follow-up |
| `docs/evidence/SAD-79.md` §5, `SAD-81.md` "Out of scope" | one-line "now rendered (COD-71)" notes |
| `CHANGELOG.md` (Unreleased → Fixed) | select values show their option chips, currency/percent/duration show real units, checkbox is a clickable box; stored values unchanged |
| `docs/user-guide.md` | short paragraph in the field-type section: what each of the six looks like and that clicking a checkbox is undoable |

## 6. Gate before calling it done

`npm run check` — lint 0 errors, full vitest (1721 + new), guard, docs links, FA icons (regenerated),
build. `npm run test:fields` — browser matrix. Negative control: a deliberately wrong expectation must
exit 1. `git status` — only the intended files.

## 7. Blast radius

| Area | Effect |
|---|---|
| Stored data / file format | none — display only, no key added or removed |
| Sort | none — sorts on raw values (`viewOrder.sortText`) |
| Copy / search / export | none — they already used `format()`; export keeps `true`/`false` and raw numbers for re-import (`export/view.ts` is separate on purpose) |
| Group headers / link chips / dropdown | none |
| Undo | one new command source (checkbox click), same `setValue` path → one entry per click |
| Selection / keyboard | checkbox stops its own clicks/keys; grid shortcuts elsewhere unchanged |
| Embeds | same GridView, so they inherit both fixes; the checkbox is wired through `doc.mutate` |
| Performance | +1 to 2 nodes per affected cell in the ~30 rendered rows; measured in the evidence doc |
| Visual parity | improves (chips + boxes match the prototype); the four remaining raw types stay as pinned |

## 8. Out of scope (follow-up issue)

Number thousands separators and right alignment; rating stars; local `date_time` / `created_time` /
`modified_time`; clickable url/email/phone; attachment chips; long-text two-line clamp; the `''` vs
`null` clearing inconsistency (F4); typed-cell styling beyond the six.

**Filed:** [COD-73](https://linear.app/code-bro/issue/COD-73/cell-display-parity-rating-stars-local-timestamps-links-number) —
Cell display parity: rating stars, local timestamps, links, number separators.

**Draft that became the issue:**

> **Cells still don't look like the prototype: rating, links, timestamps, numbers**
> After COD-71 six types render real values. What remains raw or plain: `rating` shows `4` instead of
> stars, `date_time` / `created_time` / `modified_time` show full ISO instead of local time, url /
> email / phone are not links, numbers have no separators and nothing is right-aligned, attachments
> are paths instead of chips, long text is one line. Evidence and the 21-type matrix:
> `docs/plans/cod-71-cell-rendering-audit.md` §2.

## 9. Delivery

Two steps, each committed, pushed and reported on COD-71:

- **Step A** — renderer dispatch, select chips, checkbox control, icon generator, CSS, tests, e2e pins.
- **Step B** — evidence doc, F2/SAD notes, CHANGELOG, user guide, follow-up issue filed, gate re-run;
  Linear comment with before/after shots; COD-71 → **In review**.

Rollback: revert Step A — nothing on disk changes, so the old display returns with the data intact.
