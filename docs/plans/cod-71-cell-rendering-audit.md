# COD-71 — is the raw-value bug limited to single / multi select?

> Investigation only. Nothing in `src/` was changed; the fixture and screenshots live in `/home/user/repro/`.
> Companion plan: `docs/plans/cod-71-select-cell-plan.md`.

## 1. How this was checked

1. Every registered field type was read (`src/model/fieldTypes/registry.ts`, 21 types) together with its
   `format()`.
2. A fixture with **one row carrying a value for every type** was mounted in the real `TableView`
   (production bundle, Chromium, dark theme) and each cell's rendered text was read back —
   screenshot `repro/cod71-alltypes.png`.
3. `getFieldType(type).format(value, field)` was computed for the same values, in Node, to see what the
   rest of the app (copy, search, export) already prints.
4. The prototype's own formatter table was read (`Prototype/script.js`, `FT.*.fmt` / `toText`, and the
   `cellInnerHtml` special cases) to know what the intended display is.
5. Every other surface that shows a cell was traced: embed view, group headers, link chips, link picker,
   copy cell / copy row, search, query builder, dropdown, CSV / XLSX / Markdown export, sort.

## 2. Result — it is not only select fields

The grid renders **the stored value** for every type (one shared `else` in `GridView.fillRow`). For most
types the stored value *is* the display text, so nothing looks wrong. For six types it is not.

| Type | Stored | Grid shows today | `format()` (copy / search / export) | Prototype | Verdict |
|---|---|---|---|---|---|
| text | `Hello world` | Hello world | Hello world | same | **OK** |
| long_text | text | one line | same | clamped to 2 lines | parity |
| number | `1234567` | `1234567` | `1234567` | `1,234,567`, right-aligned | cosmetic |
| **currency** | `123456` (minor units) | **`123456`** | `1234.56` | `$1,234.56` | **wrong** |
| **percent** | `0.25` | **`0.25`** | `25%` | `25%` | **wrong** |
| **duration** | `90000` (ms) | **`90000`** | `1m 30s` | `1m 30s` | **wrong** |
| rating | `4` | `4` | `4` | 5 stars + `4/5` | parity |
| **checkbox** | `true` | **`true`** | `✓` | clickable box icon | **wrong** |
| date | `2026-10-17` | `2026-10-17` | `2026-10-17` | same | **OK** |
| date_time | ISO string | `2026-10-17T14:30:00.000Z` | same | local `2026-10-17T14:30` | parity |
| url / email / phone | text | plain text | same | clickable link | parity |
| **single_select** | `opt_a` | **`opt_a`** | `Alpha` | coloured chip | **wrong** |
| **multi_select** | `[opt_a, opt_b]` | **`opt_a, opt_b`** | `Alpha, Beta` | coloured chips | **wrong** |
| attachment | path | `Files/brief.pdf` | same | paperclip chip | parity |
| auto_number | `7` | `7` | `7` | `7`, muted mono | **OK** |
| created_time / modified_time | ISO string | full ISO | same | local datetime, muted | parity |
| formula | `2` | `2` (errors styled) | `2` | `2`, locale number | **OK** |
| link | refs | chips (dedicated branch) | — | chips + peek | **OK** |

### Three classes

- **Class A — the stored value is not the display value (6 types):** `single_select`, `multi_select`,
  `currency`, `percent`, `duration`, `checkbox`. These are the ones where the grid is *wrong*, not just
  plain, and all six are already fixed by the model's own `format()`.
- **Class B — legible but unformatted / missing parity styling:** number separators and right alignment,
  rating stars, `date_time` / `created_time` / `modified_time` local time, `url`/`email`/`phone` links,
  attachment chips, `long_text` clamp.
- **Class C — correct as-is:** `text`, `date`, `auto_number`, `formula`, `link`.

## 3. Why the ticket is about select fields

The CSV/XLSX importer only ever produces five types — `text`, `number`, `date`, `checkbox`,
`single_select` (`src/io/import/build.ts`, `TYPE_MAP`). So an imported table can only exhibit:

- **single_select → `opt_…`** (the reported bug; the loudest, because every row has a value),
- **checkbox → `true`** (no `✓`),
- number without thousands separators (cosmetic),
- date is already its display text.

`multi_select`, currency, percent, duration and rating can only appear if the user adds those fields —
which is why the report is framed as a select problem even though the defect is shared.

## 4. Other surfaces — the grid is the only broken one

| Surface | Path | Select value shown as | Status |
|---|---|---|---|
| Grid (view + embed) | `GridView.fillRow` | `opt_…` | **bug** (embeds reuse the same GridView, so they inherit the fix) |
| Copy cell / copy row | `tableView.formatValue` → `format()` | `Alpha` | OK |
| Search | `rowFilter.searchableText` → `format()` | `Alpha` (comment says so explicitly) | OK |
| Group by header | `grouping.labelOf` + `optionChipColors` | chip with the option name | OK |
| Link chips / link picker labels | `link.ts:90` → `format()` | label text | OK |
| Select dropdown / Manage options | `Dropdown` reads `field.options` | names + colours | OK |
| Query builder value list | `filterBuilder` reads `field.options` | names | OK |
| CSV / Markdown export | `export/view.ts cellText` → `format()` | names | OK |
| XLSX export | same resolver | names / numbers | OK |
| Sort | `viewOrder.sortText` on raw values | raw — **by design** (sorting by id is stable) | OK |

`TableView` and embedded tables share `GridView`; there is no second cell renderer in `src/`.

## 5. Decision taken after this audit

**S2, all six Class A types, in COD-71** — selects get chips, currency/percent/duration switch to
`format()`, checkbox becomes a clickable box. The leftover parity items (Class B) go to a separate
follow-up issue. The scopes below are kept for the record.

## 6. What a fix can cover — three scopes

### S1 — selects only (current plan)

`GridView`: one extra branch → chips from `field.options`; multi-select gets the smaller chip.
Everything else untouched. Fixes the reported bug; leaves currency / percent / duration / checkbox raw.

- Files: `GridView.ts`, `styles.css`, one new test file, the `test:fields` pin.
- Risk: low. One new DOM shape for two types.

### S2 — all six Class A types (recommended)

The same branch for selects (chips), and the generic `else` becomes
`getFieldType(field.type).format(val, field)` instead of `String(val)`:

- select → chips (branch), currency → `1234.56`, percent → `25%`, duration → `1m 30s`,
  checkbox → `✓`, number/date/rating/system/attachment → byte-identical to today (`format()` returns
  the same string), formula and link keep their existing branches.
- The rendered text then equals what copy, search and export already produce — one formatter, one answer.
- Files: as S1 plus two lines in `GridView.ts`; tests grow to cover the six. **(chosen)**
- Risk: low-medium — it changes the *text* of four more types, all of them toward the existing
  `format()` contract. `test:fields` pins must be updated deliberately (`fld_cur 123456 → 1234.56`,
  `fld_pct 0.25 → 25%`, `fld_dur 90000 → 1m 30s`, `fld_check` is not in the rendered list but the
  checkbox matrix does read it).
- Note: `format()` for currency has **no `$`** and for numbers has **no separators**, so S2 fixes the
  unit error, not the full prototype look. That is honest to the data model (which stores no currency
  code) and is the better half of the fix.

### S3 — full prototype parity (not recommended for this ticket)

Adds right alignment, thousands separators, star ratings, local-time rendering, anchors for
url/email/phone, attachment chips, long-text clamp, an interactive checkbox. Touches layout, the
formula runtime display and the visual-parity captures — a design change, not a bug fix.

## 7. What the fix must not disturb (any scope)

- Stored values: selects keep option ids, currency keeps minor units, percent keeps 0…1 — display only.
- Sort: still compares raw values (`viewOrder.sortText`), so the row order does not change when the
  display does.
- Export round-trip: CSV keeps `true` / `false` and raw numbers (`export/view.ts` is a separate
  function on purpose), so a CSV import → export → import stays lossless.
- Search, filters, group keys, link labels: unchanged, they already format.
- The F2 pins in `test:fields`: updated only where the behaviour intentionally changes, with the reason
  recorded (that is what the pin exists for).

## 8. Evidence

- `repro/cod71-alltypes.png` — one row, one value per type, rendered by the production bundle.
- `repro/cod71-panel.png` — the imported Status column: dropdown right, cells raw ids.
- Model probe: `format()` output per type (Node, `tsx`).
- `docs/evidence/COD-66-all-fields.md` §3 F2 — the original finding and the pin.
- `docs/evidence/SAD-79.md` §5, `docs/evidence/SAD-81.md` "Out of scope" — the earlier note that the
  cell renderer writes `String(value)` and that chips could reuse `optionChipColors`.
