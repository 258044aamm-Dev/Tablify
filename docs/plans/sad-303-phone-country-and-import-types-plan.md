# SAD-303 — Country codes for phone fields, and keeping email / phone field types through import and export

**Status:** **Implemented and delivered** in five commits (`1d55035`, `b5a5cdc`, `efb6c85`, `88a0a7f`, and the docs commit) — see [`docs/evidence/SAD-303.md`](../evidence/SAD-303.md). This file is kept as the approved design record; the code now differs from it only where the notes below say so.
**Issue:** [SAD-303](https://linear.app/sad-mod/issue/SAD-303/please-address-the-following-two-issues) · priority **2** · labels *Improvement*, *Feature*
**Repository baseline:** `main` at `5927997` (`release: v2.0.0-beta.5 metadata and notes`), 2026-10-18.
**Plan date:** 2026-10-19.
**Owner decisions taken for this plan** (answered 2026-10-19):

| # | Question | Decision |
|---|----------|----------|
| 1 | Meaning of “field types during export” | **Import detection + round-trip consistency.** Detect email/phone/URL at import. Make exported CSV/XLSX re-import to the same field types and values. No non-standard type metadata is written into export files. |
| 2 | Country data / parsing | **`libphonenumber-js/min`** (measured +36.5 KB gzip on the bundle). |
| 3 | Storage | **E.164 in the cell** (`+8801712345678`) plus an optional **per-field default country** (`phoneCountry: "BD"`). |
| 4 | Bare-digit phone columns | **Header-name assist**: a column of 7–15 digit values whose header is phone-like is imported as Phone; otherwise it stays Number. |

---

## 0. TL;DR — what ships

1. **Phone fields get a country.**
   A new anchored panel edits a phone cell: searchable country picker (name, ISO code, dial code), live national formatting, and an E.164 preview. The stored value is canonical E.164; the cell displays the international format; `tel:` links use E.164; export writes E.164. Each phone field can carry an optional default country in the `.tablify` file (additive key, **no `formatVersion` bump**), editable in Add / Modify Field.
2. **Import recognises email, phone and URL columns.**
   `infer.ts` gains three detectors with a documented precedence. A column of bare digits is only treated as Phone when its header is phone-like — so IDs, account numbers and postal codes stay Number. Export → import round-trips keep the same field types and values.
3. **Everything else stays put.**
   No change to number/date/checkbox/select inference, the grid's selection and keyboard model, the command/undo model, `.tablify` parsing of existing files, Airtable sync, filters/queries, formula evaluation, or the CSV/XLSX writers. Untouched behaviour is listed explicitly in §4.10 and §6.3.

---

## 1. The issue, stated precisely

### 1.1 Issue 1 — country codes for the phone field

The request has five separate requirements, and they land in different layers:

| Requirement (issue text) | Layer | Plan section |
|---|---|---|
| “Add a country code selector … select a country and its corresponding international dialing code” | UI | §4.4, §4.5 |
| “Provide an appropriate default country code while allowing users to change it” | model + UI + format | §4.6, §4.2 |
| “Make it look modern with an intuitive design and searchable option” | UI/CSS | §4.4 |
| “Handled correctly when storing” | model/format | §4.3 |
| “Handled correctly when displaying and exporting” | view + export | §4.7 |

### 1.2 Issue 2 — “field types during export”

The issue text is internally inconsistent: it says values are put into generic text fields **when importing**, then asks to “update the export logic”. CSV and XLSX have no phone/email cell type — there is nothing in either format that can carry “this column is a phone number”:

- **CSV** is untyped text (`src/io/export/csv.ts:17-24`).
- **XLSX** writes every non-number/non-boolean/non-date value as a text cell (`src/io/export/xlsx.ts:17-28`); Excel has no phone or email type.
- **Markdown** is display text (`src/io/export/markdown.ts:17-24`).

So “preserve the type through export” can only mean: **the exported values must still be recognisable on re-import**, and the importer must actually recognise them. That is the decision recorded above (Q1). The plan therefore:

1. adds email / phone / URL detection to `src/io/infer.ts`;
2. maps them to real field types in `src/io/import/build.ts`;
3. proves a CSV and an XLSX round-trip preserves types and values (§6.1, `tests/io/roundtrip.fieldTypes.test.ts`);
4. leaves the three export writers byte-untouched. E.164 is written as a text value by both the CSV and XLSX writers, so it re-imports unchanged and is re-detected exactly.

### 1.3 Explicitly out of scope

- Migrating or rewriting existing phone values in files that are simply opened (no silent data mutation).
- A global “default country” plugin setting (the field-level default is the decision; locale is only the fallback).
- Phone extensions (`ext. 123`), carrier/line-type detection, phone number formatting for display in Airtable.
- Writing hidden type metadata into exports.
- Country flag artwork or an emoji-flag dependency (see §3.3 for why).

---

## 2. What the code does today (verified, not assumed)

### 2.1 The phone field is a plain string type

- `FieldTypeName` includes `'phone'` (`src/model/types.ts:10-13`), registered to `phoneType` (`src/model/fieldTypes/registry.ts:27`).
- `phoneType` is a five-method object: `validate` / `parse` / `format` / `defaultValue` / `readOnly` (`src/model/fieldTypes/string.ts:64-90`).
  - `validate`: `/^\+?[\d\s\-().]{5,20}$/` — digits, spaces, dashes, parentheses, leading `+`.
  - `parse`: `input.trim()` — **no normalisation**.
  - `format`: `String(value)` — the stored text is the display text.
- No field-level options exist for phone; `FieldDefinition` supports only `options` (select), `required`, `unique`, `min`, `max`, `regex`, `formula`, `linkTableId`, `airtable` (`src/model/types.ts:41-61`).

### 2.2 Every path a phone value travels

| Stage | Code | Today's behaviour | Consequence for this feature |
|---|---|---|---|
| Cell edit | `createEditor` → plain `<input type="text">` (`src/views/grid/editors/index.ts:59-125`) | Initial value = `format()` = raw; on commit `parse()` = trim | No country UI at all |
| Edit routing | `tableView.startEdit` (`src/views/tableView.ts:1199-1247`) | Only select/attachment/date/date_time open a panel (`:1218-1227`); everything else gets an inline editor | Phone must join the panel branch |
| Grid display | `GridView` contact branch (`src/views/grid/GridView.ts:1380-1382`) → `renderContactLink` (`src/views/grid/cellRender.ts:240-259`) | Link text = stored raw value; `tel:` href from a loose regex (`:228`) | Display can be formatted without touching the value |
| Copy / paste | `tableView.ts:1156-1171` | Copy goes through `formatValue` → `format()` (identity for phone, so raw); paste runs `parseInput` | Copy stays raw; paste will normalise when the field has a country |
| Search | `searchableText` (`src/model/rowFilter.ts:38-53`) | Non-select strings short-circuit to raw | Searching still works on E.164 digits (see §4.7) |
| Sort | `sortText` (`src/model/viewOrder.ts:10-13`) | Strings sort raw | Unchanged |
| Query (`{Phone} = "…"`) | `query/evaluate.ts:150` treats phone as text | Raw comparison | Unchanged |
| CSV / MD export | `cellText` (`src/io/export/view.ts:33-52`) | Phone returns the raw string | E.164 is exported as-is — no writer change needed |
| XLSX export | `xlsxCell` (`src/io/export/xlsx.ts:17-28`) | Everything else → text | E.164 → text cell, preserved |
| Airtable pull/push | `remoteToLocal` / `localToRemote` (`src/sync/values.ts:73-82`, `:120-134`) | Phone is a string both ways | E.164 is a valid Airtable phone string; no code change |
| Field type change | `planTypeChange` (`src/model/fieldChange.ts:27-65`) | Converts via old `format()` → new `parse()` | Stays raw→raw; new keys must be dropped on type change (§5.2) |
| Format save | `orderField` (`src/format/serialize.ts:29`, `:78-98`) | Known keys in spec order, unknown keys preserved | New key must be added to `FIELD_KEYS` for stable order |
| Format load | `parse` (`src/format/parse.ts:100-125`) | Type-checks `formula`, `linkTableId`, `airtable` | New key needs the same treatment |
| Schema | `tablify.schema.json:70-180` | `additionalProperties: true` | An unknown key would pass, but it must be a documented property |

### 2.3 The editor is a plain text input

`src/views/grid/editors/index.ts:59-125` builds a bare input, focuses it, commits on Enter/blur/Escape-cancels, and skips only `date`/`date_time` (line 69). There is no composite control (a country button beside an input) anywhere in the codebase.

### 2.4 Import inference has no email/phone/URL detector

`src/io/infer.ts:29` defines exactly five inferred types (`text`, `number`, `date`, `checkbox`, `single_select`). The matcher list (`:171-175`) is checkbox → number → date; then `single_select`; then `text`. Consequences, verified with the current code:

- An email column is `text` — or worse, `single_select` when it has ≤20 distinct values and ≤50 % distinct rows, because nothing claims it before the select rule.
- A phone column is `text` / `number` / `single_select`, never `phone`.
- `build.ts` maps only those five types (`src/io/import/build.ts:45-51`), so even a hand-made phone inference could not reach the field type.
- `inferTable` receives no headers (`:238-246`), so header-name evidence is unavailable today.

### 2.5 Existing tests that pin today's behaviour

| Test | What it pins | Impact |
|---|---|---|
| `tests/model/fieldTypes.test.ts:340-356` | `phoneType.parse('+1 555-1234')` preserves format; `validate` accepts formatted numbers | The proposed `parse` only normalises **valid** numbers, and `+1 555-1234` is not valid (7 digits for US), so this test still passes — verified with libphonenumber-js. |
| `tests/views/grid/cellFormatting.test.ts:448-470` | Phone cell is a `tel:+15551234567` link | Href must stay E.164; link text will change to the formatted number (assertions must be added, not weakened). |
| `tests/e2e/fieldTypes.browser.ts:227` | Phone edit uses an inline editor and stores `'+880 1712-345678'` | Must change to `expect: 'panel'`; the stored value becomes E.164 (§6.2). |
| `tests/io/infer.perf.test.ts` | 5,000 × 10 inference types and < 500 ms | Column list has no email/phone/URL values; types stay identical. Phone matcher adds work; re-measure (§6.4). |
| `tests/io/import.build.test.ts:22-45` | Number/date/checkbox/select types and values | Unchanged; new tests are additive. |

### 2.6 Baseline numbers (measured on this clone, 2026-10-19)

| Check | Baseline |
|---|---|
| `npm run build` → `main.js` | 851,625 bytes raw · 201,903 bytes gzip |
| Test suite | **124 files / 1,942 tests passed** (`npx vitest run`, 2026-10-19, 97.7 s) |
| Lint | **119 warnings, 0 errors** (`npm run lint`, 2026-10-19) |
| P4-03 strict inference accuracy | **73.3 %** (22/30 columns) — already below the proposed 90 % threshold (`docs/reports/p4-03-accuracy.md`) |
| Inference perf, FX-XLSX-sized 5,000 × 10 | **median 14.2 ms, p95 14.4 ms** (`tests/io/infer.perf.test.ts` on this machine) |

---

## 3. Research and measurements

### 3.1 `libphonenumber-js` vs a hand-written country table

All numbers below were **measured in this repository** by bundling probe modules with the repo's own esbuild settings (`--bundle --minify --format=cjs --platform=browser --target=es2022`), not taken from a README.

| Candidate | Raw bundle delta | Gzip delta | Accuracy | Maintenance |
|---|---|---|---|---|
| `libphonenumber-js/min` — `parsePhoneNumberFromString` + `AsYouType` + `getCountries` + `getCountryCallingCode` | **+152.8 KB** | **+36.5 KB** | Google libphonenumber metadata: 245 regions, per-country validation, national/international formatting | Upstream, MIT, released frequently |
| `libphonenumber-js/min` — parse only (no `AsYouType`) | +122.0 KB | +30.0 KB | Same validation; no live formatting | — |
| `libphonenumber-js/max` | +224.4 KB | +57.6 KB | Stricter digit validation + line type | Not needed for this feature |
| Hand-written table (ISO + dial code + grouping masks) | ~+15 KB | ~+4–6 KB | Length-based validation only; every national format maintained by hand | 245 rows of factual data, diverges over time |

Decision (owner): **`libphonenumber-js/min`**, pinned exactly, matching the repository's exact-pin style for runtime dependencies (`read-excel-file: "8.0.3"`, `write-excel-file: "1.4.30"`). Reasons: correct E.164 conversion for national inputs across all 245 regions (e.g. `01712-345678` + `BD` → `+8801712345678`), live as-you-type formatting without a second formatter, and a tested `tel:` parser. The cost is 18 % of the current bundle — recorded below, and reversible behind a thin provider if the size ever becomes a problem.

**Measured API behaviour (node, same package version):**

| Input | Default country | `parsePhoneNumberFromString(...)` |
|---|---|---|
| `01712-345678` | `BD` | `+8801712345678`, valid |
| `01712345678` | `BD` | `+8801712345678`, valid |
| `8801712345678` | `BD` | `+8801712345678`, valid |
| `+8801712345678` | — | `+8801712345678`, valid, country `BD` |
| `12345` | `BD` | parses, **invalid** (too short) |
| `555-1234` | `US` | parses, **invalid** |
| `2024-01-01` | `US` | parses as digits, **invalid** |
| `+1 (415) 555-2671` | `US` | `+14155552671`, valid |
| `+15551234567` → `formatInternational()` | — | `+1 555 123 4567` |
| `+8801712345678` → `formatInternational()` | — | `+880 1712 345678` |
| `AsYouType('BD').input('01712345678')` step by step | — | `0` → `01` → … → `01712-345678` |

**Performance measured:** 5,000 parses + `isValid()` = **69 ms**; 245 × `getCountryCallingCode` = **23 ms**; 245 × `Intl.DisplayNames` = **11 ms**; cold `require('libphonenumber-js/min')` = **9–34 ms** (Node, three runs). None of these is on a hot render path; the country list is built once and memoised per locale.

### 3.2 Bundle and startup impact

| Metric | Before | After (upper bound, measured probe) | Delta |
|---|---|---|---|
| `main.js` raw | 851,625 B | ~1,004,400 B | **+17.9 %** |
| `main.js` gzip | 201,903 B | ~238,400 B | **+18.1 %** |
| Cold module parse | — | — | +9–34 ms once, at plugin load |

Obsidian loads `main.js` from the local vault, so this is disk-read + parse cost, not a download. The plan requires recording the real post-change size in the evidence file, not just this estimate.

### 3.3 Country flags cannot be emoji on Windows

Windows' Segoe UI Emoji deliberately ships no country-flag glyphs; Chromium therefore renders regional-indicator pairs as the letters (`BD`, `US`). This is a known, longstanding Windows/Chromium behaviour ([Chromium issue 40766658](https://issues.chromium.org/issues/40766658), [osnews](https://www.osnews.com/story/141675/the-dumb-reason-why-flag-emojis-arent-working-on-your-site-in-chrome-on-windows/)). Obsidian on Windows is Electron/Chromium, so an emoji flag would show as two letters there anyway.

**Design consequence:** no emoji flags and no 250-file flag sheet. The selector uses a **monogram badge** — the 2-letter ISO code in a small rounded tile — which renders identically on Windows, macOS, Linux, iOS and Android, adds zero assets, and still gives each row a visual anchor. This is the “modern” part that survives every platform.

### 3.4 E.164 is the right stored form

E.164 is the ITU standard: `+`, 1–3 digit country code, national number, no spaces, ≤15 digits ([ITU overview](https://didlogic.com/learn/e164-explained-international-number-format/)). It is unambiguous across countries (unlike a bare national number), it sorts and compares as text, and Airtable accepts it in a phone-number field as a string.

Because the cell value stays a **string**, every existing reader keeps working: `cellText`, XLSX text cells, Airtable string mapping, query text comparisons, and older Tablify versions that do not know about the new field key.

### 3.5 Country names without shipping a name table

`Intl.DisplayNames(['en'], { type: 'region' }).of('BD')` → `Bangladesh`; with `['bn']` → `বাংলাদেশ`. It is available in every Chromium that Obsidian 1.14+ runs on and in the Node used by Vitest. Country **names** can therefore be generated, not shipped. Measured: 245 lookups in 11 ms.

Special codes returned by `getCountries()` (`XK`, `AC`, `TA`) also resolve (`Kosovo`, `Ascension Island`, `Tristan da Cunha`). If `Intl.DisplayNames` were ever unavailable, the fallback is the ISO code — a graceful degradation, not a crash.

### 3.6 Excel/CSV realities that shape the rules

- Tablify's CSV parser returns every cell as a string, and its XLSX writer writes phone values as text cells — so the E.164 form survives Tablify's own round-trip. If a user passes the file through Excel/Sheets first, that program may coerce a digit string to a number (or `8.80171E+12`); Tablify cannot un-mangle scientific notation, so such a column stays Number and the user can retype. This is documented in the troubleshooting section, not hidden.
- XLSX gives back `number` for numeric cells and `string` for text cells (`src/io/import/xlsx.ts`). Phone detection therefore accepts integers (7–15 digits) as well as text.
- CSV has no types at all, so the header is the only surviving column-level evidence. That is exactly why the header assist exists.

### 3.7 The labelled accuracy set will change

`scripts/gen-fixtures.mjs:270-330` builds the P4-03 labelled set. It currently labels the `Email` column as **text** (line ~290). Once email detection exists, that label is wrong. The plan regenerates the set with `Email` → `email` and three new columns (`Phone` international, `Mobile` national digits, `Website` URLs), regenerates `samples/fixtures/HASHES.json`, extends `scripts/infer-accuracy.ts`'s `TYPES` list, and records the new (measured) accuracy — including the fact that the previous 73.3 % baseline was already below its proposed threshold.

---

## 4. Design

### 4.1 Principles

1. **The cell value remains a string.** No new `CellValue` shape, no reader changes, no migration.
2. **Additive format change only.** `phoneCountry` is optional; absent means “use the reader's region”. No `formatVersion` bump.
3. **Two sources of truth, one canonical form.** E.164 is stored; display is derived. The stored form is what exports, syncs and filters see.
4. **Never block a user.** If a number cannot be validated, keep the trimmed text (today's behaviour) instead of refusing the edit.
5. **Opening and dismissing writes nothing** (COD-68's rule), even if the stored value is in a legacy format the panel would normalise if edited.
6. **Reuse the existing surfaces.** `createPanelCard`, `anchorPanel`, `wirePanelDismiss`, the dropdown CSS, `createEditCellCommand`, and the `editField` command path.

### 4.2 Data model and format change

**`FieldDefinition`** gains one optional key (`src/model/types.ts`):

```ts
/**
 * phone only (SAD-303). ISO 3166-1 alpha-2 default country, uppercase, e.g. "BD".
 * Absent = use the reader's region. Additive: no formatVersion change.
 */
phoneCountry?: string;
```

**Example field in a file:**

```json
{
  "id": "fld_phone",
  "name": "Phone",
  "type": "phone",
  "phoneCountry": "BD"
}
```

**Example cell:** `"values": { "fld_phone": "+8801712345678" }`

**Rules:**

| Rule | Why |
|---|---|
| Key order: after `regex`, before `formula` (`serialize.ts:29`) | Existing files keep their exact byte layout; a field with a formula is never a phone field, so no existing field reorders. |
| Written only when the user explicitly picks a default | Keeps new phone fields identical to today's unless asked. |
| Unknown keys are already preserved by `orderField` (`serialize.ts:92-97`) | Older Tablify versions round-trip the key instead of dropping it; they simply ignore it. |
| Parse type-checks string only (`parse.ts:100-125` pattern) | A malformed value in a hand-edited file must not make the table unopenable; the UI validates the code itself. |
| Schema: `{ "type": "string", "pattern": "^[A-Z]{2}$" }` | Machine-checkable documentation; `additionalProperties` stays `true`. |
| Dropped when a field's type changes away from phone (`fieldChange.ts`) | Same rule as `options`, `formula`, `linkTableId`. |

### 4.3 The value lifecycle

```
user types in the panel
        │  national digits, e.g. "01712-345678"   (country = BD)
        ▼
toE164(text, country)  ── valid ──▶  "+8801712345678"  ──▶ command stack ──▶ .tablify
        │
        └── not valid ──▶ trimmed text (today's behaviour, never lose input)

display:   formatPhoneDisplay("+8801712345678") ──▶ "+880 1712 345678"
tel:       telHref("+8801712345678")             ──▶ "tel:+8801712345678"
export:    cellText(...)                          ──▶ "+8801712345678"   (unchanged code)
search:    raw string (E.164 digits)              ──▶ "1712" matches
sort:      raw string
sync:      raw string
```

**Normalisation rules (`phoneType.parse`), exactly:**

| Input | Field | Result |
|---|---|---|
| `+880 1712-345678` | any | `+8801712345678` (valid international → normalise) |
| `01712-345678` | `phoneCountry: "BD"` | `+8801712345678` |
| `01712345678` | `phoneCountry: "BD"` | `+8801712345678` |
| `01712-345678` | no `phoneCountry` | unchanged text (no country to assume) |
| `+1 555-1234` | any | unchanged (invalid, so never silently rewritten) |
| `12345` | `phoneCountry: "BD"` | unchanged (invalid) |
| `''` | any | `null` |

This preserves every existing file value and the existing unit test, and it means **paste** into a phone field also benefits without any new UI.

### 4.4 The phone panel

The date picker (COD-75) established the pattern: an anchored card from `src/views/grid/select/panel.ts`, focus inside the panel, one `setValue` per commit. The phone panel is the fourth screen in that container.

**Number view**

```
┌────────────────────────────────────────────┐  320 px card (352 on touch), radius 16
│ ┌───────────┐ ┌──────────────────────────┐ │
│ │ BD  +880 ▾│ │ 01712-345678             │ │  44 px row
│ └───────────┘ └──────────────────────────┘ │
│  +880 1712 345678                 ✓ valid  │  11.5 px mono preview
│ ────────────────────────────────────────── │
│  Clear                             Done    │  ghost · accent pill
└────────────────────────────────────────────┘
```

**Country view** (replaces the number view inside the same card — no second panel, so dismissal cannot race)

```
┌────────────────────────────────────────────┐
│ ‹  Country                                 │
│ ┌────────────────────────────────────────┐ │
│ │ ⌕ Search country or +code               │ │
│ └────────────────────────────────────────┘ │
│ SUGGESTED                                  │
│  BD  Bangladesh                    +880  ✓ │
│ ALL COUNTRIES                              │
│  AF  Afghanistan                    +93   │
│  …  (245 rows, max-height ~260 px)         │
└────────────────────────────────────────────┘
```

**Decisions inside the panel**

| Element | Decision | Why |
|---|---|---|
| Country trigger | Monogram badge (ISO) + dial code + chevron | Flags are unavailable on Windows (§3.3); the badge is universal and asset-free |
| Number field | Focused on open, caret at the end, mono | Typing immediately works — no slower than the old inline editor |
| Live formatting | `AsYouType(country)` national format while typing | Matches how modern phone inputs behave; normalisation happens once, on commit |
| Preview | `formatInternational()` of the parsed value, or “Not valid for Bangladesh” | Gives immediate, honest feedback without blocking a commit |
| Paste / typed `+` | Country switches automatically to the parsed country | Users paste E.164 far more often than they retype it |
| Typing a national number | Stays in the selected country; never guesses | Guessing the country is exactly how data gets corrupted |
| Suggested group | (1) country parsed from the current value, (2) field default, (3) reader's region — deduped | The three countries a user is most likely to need, in order |
| All countries | Alphabetical by localized name | Predictable |
| Search | Name (localized + English), ISO code, dial code with or without `+`, aliases (UK, USA, UAE, Holland, Burma, …) | “Searchable option” in the issue; matches how people actually search |
| Keyboard | ↑/↓ move, Enter picks, Esc leaves the country view (or cancels the panel), typing filters | Mirrors `FieldTypePicker` (COD-76) and the select panel |
| Clear | Writes `null` as one undo step | Same as the select/date panels |
| Done / Enter (number view) | Commits one `setValue` | Same commit contract as every editor |
| Dismiss (press outside) | **Commits if the text changed**, cancels if untouched | Preserves the old inline editor's blur-commit behaviour; Escape is the explicit cancel |
| Untouched | Returns the stored value verbatim; the host compares and writes nothing | COD-68: opening and dismissing a cell must never write |
| Mobile | `@media (pointer: coarse)`: 44 px rows, card width `min(352, vw-24)`; panel flips above the cell | Apple/Material hit targets; `anchorPanel` already flips |
| ARIA | `role="dialog"` card, `role="combobox"` search, `role="listbox"`/`role="option"` rows, `aria-activedescendant`, live status for validity | Mirrors the existing pickers; the a11y tests can assert it |

**Where it opens:** `startEdit` adds `phone` to the panel branch (`tableView.ts:1218-1227`), and `openCellPanel` constructs `PhonePanel` exactly like `DatePicker` (`:1281-1305`), including `equivalentStored`-style no-write behaviour and `grid.root.focus()` on close.

### 4.5 Country data and search (pure model, no DOM)

New module `src/model/phone/countries.ts`:

```ts
export interface CountryRow {
  iso: string;        // "BD"
  dial: string;       // "880"
  name: string;       // localized, from Intl.DisplayNames
  english: string;    // English name, for search and tests
}

export function allCountries(locale?: string): readonly CountryRow[];   // memoised per locale
export function countryRow(iso: string, locale?: string): CountryRow | undefined;
export function searchCountries(query: string, locale?: string): readonly CountryRow[];
export function isDialCodeQuery(q: string): boolean;                    // "+880", "880"
```

- Countries come from `getCountries()` (245), dial codes from `getCountryCallingCode`.
- Names from `Intl.DisplayNames` (English + locale), with a feature check and ISO fallback.
- Aliases (~15) are static: UK→GB, USA/America→US, UAE→AE, Holland→NL, Burma→MM, Ivory Coast→CI, Czech Republic→CZ, Swaziland→SZ, Macedonia→MK, Turkey→TR, etc.
- Ranking: exact ISO/dial → name starts-with → token starts-with → substring; ties alphabetical. Deterministic, therefore testable.
- Lowercase input is normalised (`getCountryCallingCode` **throws** on lowercase, verified — always uppercase before calling it).

### 4.6 Default-country resolution

```
1. field.phoneCountry                        (explicit, stored in the file)
2. region of the reader's locale             (new Intl.Locale(navigator.language).region)
3. "US"                                      (documented fallback)
```

Pure function `defaultCountryFor(field, locale)` in `src/model/phone/phoneValue.ts`, with `locale` injectable so tests never depend on the machine. No new plugin-setting UI (out of scope, §1.3).

In **Add / Modify Field**, a “Default country” row appears only for `phone`. It shows the badge + name + dial code and opens the same searchable list (an anchored popover above the modal, z-index 1000, the `FieldTypePicker` pattern). A “No default (use my region)” row clears it.

### 4.7 Display, and what deliberately stays raw

| Consumer | Uses | Reason |
|---|---|---|
| Grid cell text | **formatted** `+880 1712 345678` | Issue requirement (“displaying”) |
| `tel:` href | **E.164** | Correct dialling; also works on mobile |
| Cell tooltip | **raw stored** | Lets a user see/copy exactly what is stored |
| Copy cell | **raw stored** | Copy/paste round-trips without reformatting |
| Search | **raw stored** (E.164) | Unchanged code path; digits still match. Optional future: index formatted text too |
| Sort / query / grouping | **raw stored** | No behaviour change |
| CSV / Markdown / XLSX | **raw stored** (E.164) | Unambiguous, re-importable; no writer change |
| Airtable | **raw stored** | String both ways |

**Important:** `phoneType.format()` stays `String(value)` — identity. Formatting lives in `formatPhoneDisplay()` and is called only by the cell renderer and the panel. This is deliberate blast-radius control: `format()` is used by grouping, type conversion, export fallbacks, link labels and editors; changing it would silently reformat group headings and converted values. The issue asks for display in the grid, and that is where the change is made.

### 4.8 Import inference

**New inferred types:** `'email' | 'phone' | 'url'`.

**Rule order** (first match wins; replaces `infer.ts:8-27` documentation and the `MATCHERS` array at `:171-175`):

| # | Type | Rule |
|---|---|---|
| 0 | — | Empty values ignored; no non-empty values → `text` (unchanged) |
| 1 | `checkbox` | **Unchanged** |
| 2 | `date` | **Unchanged** (checked before phone so `2024-01-01` can never be read as a phone number) |
| 3 | `email` | Every non-empty value matches `/^[^\s@]+@[^\s@]+\.[^\s@]+$/` and is ≤ 254 chars |
| 4 | `url` | Every non-empty value matches `/^https?:\/\/\S+$/i` (strict: a scheme is required, same as `urlType.validate`) |
| 5 | `phone` | Every non-empty value has 7–15 digits and only `+ digits space - ( ) .`, **and** either (a) starts with `+` and `parsePhoneNumberFromString(v)?.isValid()`, or (b) the column header is phone-like |
| 6 | `number` | **Unchanged** rule, but now reached after phone. A pure-number column still lands here because (a) has no `+` and (b) is false without a phone-like header |
| 7 | `single_select` | **Unchanged** thresholds |
| 8 | `text` | Everything else |

**Header assist** (the owner's decision): tokens are split with `/[^\p{L}\p{N}]+/u` and matched exactly against:
`phone, phones, mobile, mobiles, cell, cellphone, tel, telephone, telefon, tlf, fone, fono, whatsapp, whats, handy, movil, celular, mobitel, মোবাইল, ফোন, 电话, 手机, 手機`.
Exact token matching keeps `Telephone notes` matching (the token `telephone` is present and the values are still phone-shaped) while `Phonebook ID` does not (token `phonebook`).

**Why this order is safe** — verified against the current rules:

| Existing column | Old type | New type | Why |
|---|---|---|---|
| `Price` (`123.45`) | number | number | email/url/phone all false |
| `Quantity` (`42`) | number | number | phone false (1–2 digits) |
| `Index` (`1..10000`) | number | number | phone false unless header phone-like |
| `Created` (`2026-10-19`) | date | date | date before phone |
| `Done` (`true/false`) | checkbox | checkbox | checkbox first |
| `Status` (`Todo/Doing`) | single_select | single_select | all detectors false |
| `Email` (`user0@example.com`) | text | **email** | intended change (labelled set relabelled) |
| `Code` (`X0000C`) | text | text | no detector matches |
| `Country` (`BD/US`) | single_select | single_select | no digits; not phone |

**False positives checked in tests:**

- ISO codes, account numbers with an “Account” header, postal codes `12345` (5 digits < 7), years `2024`.
- `1,234.50` (comma), `2026-10-19` (date), `8.80171E+12` (number via exponent).
- Strings with 16+ digits (E.164 max is 15).
- `+` followed by junk (`+abc`, `+1`) → invalid → falls through to text/select.
- A phone-shaped column with a non-phone header and no `+` (e.g. `(555) 123-4567` under “Contact”) stays text — deliberately conservative.

**Field metadata on import:** if every `+`-prefixed value in a phone column resolves to the same country, `build.ts` sets `field.phoneCountry` to it; mixed countries leave it absent. This makes new rows in an imported table default to the right country without guessing.

**Value conversion (`convertCell`):**

| Type | Conversion |
|---|---|
| `email` | `String(v).trim().toLowerCase()` — same as `emailType.parse` |
| `url` | `String(v).trim()` |
| `phone` | `String(v).trim()`; if it starts with `+` and is valid, store E.164; otherwise keep the digits/text as-is (never invent a country) |

### 4.9 Why the round-trip guarantee holds

1. Email is exported lowercased text with `@` and a dot → the email detector re-fires.
2. Phone is exported as E.164 (leading `+`) or as the original digits; either `+` validity or the preserved column header re-fires the phone rule.
3. URL is exported with its scheme → the URL detector re-fires.
4. Number/date/checkbox keep their existing export forms (numeric cell, real date cell, boolean/text) → their existing rules re-fire.
5. `single_select` exports option **names**, and re-import creates fresh option IDs — the values are semantically identical but IDs differ. This is existing behaviour and is asserted as names in the round-trip test, not IDs.

Proof lives in `tests/io/roundtrip.fieldTypes.test.ts` for both CSV and XLSX (§6.1).

### 4.10 Explicit “do not touch” list

To honour “the new modification shouldn't influence other existing features”:

- `createEditCellCommand`, `TableStore`, `CommandStack`, drag/drop, row actions, keyboard shortcuts (except the panel routing in `startEdit`).
- CSV/Markdown/XLSX **writers** — zero diff.
- `cellText` — zero diff.
- `searchableText`, `sortText`, `compileQuery` — zero diff.
- `validateTable` rules (required/unique/min/max/regex) — zero diff.
- The numeric, date, checkbox, select, attachment, link and formula field types — zero diff.
- `sync/values.ts`, `sync/fieldMap.ts` — zero diff.
- `formatVersion` writing rules — zero diff.
- Existing `.tablify` files — no rewrite on open.

---

## 5. File-by-file implementation plan

References are to the baseline commit. New files are marked **(new)**.

### 5.1 Commit 1 — phone data layer (pure, no UI)

| # | File | Change |
|---|---|---|
| 1 | `package.json`, `package-lock.json` | Add `"libphonenumber-js": "1.13.15"` to `dependencies` (exact pin, matching the Excel deps). |
| 2 | `src/model/phone/countries.ts` **(new, ~170 lines)** | `CountryRow`, `allCountries(locale)` (memoised), `countryRow`, `searchCountries`, `COUNTRY_ALIASES`, `PHONE_HEADER_TOKENS` + `isPhoneHeader(name)` (used by import and UI copy). No DOM, no Obsidian. |
| 3 | `src/model/phone/phoneValue.ts` **(new, ~150 lines)** | `defaultCountryFor(field, locale)`, `parsePhone(input, country)`, `toE164(input, country?)`, `formatPhoneDisplay(value)`, `splitStored(value, field, locale)` → `PhoneParts` (the panel keeps the `dirty` flag, not the model), `formatAsYouType(input, country)`, `telHref(value)`, `isValidPhone(value)`. Pure; the only third-party import is `libphonenumber-js/min`. |
| 4 | `src/model/types.ts` | `FieldDefinition.phoneCountry?: string` with the doc comment from §4.2. |
| 5 | `src/model/fieldTypes/string.ts` | `parse(input, field)` normalises per §4.3. `validate` unchanged (E.164 already fits `PHONE_RE`). `format` unchanged. Export `EMAIL_RE`, `URL_RE`, `PHONE_RE` for the importer so the rules cannot drift. |
| 6 | `src/format/serialize.ts` | Add `'phoneCountry'` to `FIELD_KEYS` after `'regex'` (`:29`). |
| 7 | `src/format/parse.ts` | In the field loop (`:100-125`): `if (field.phoneCountry !== undefined && typeof field.phoneCountry !== 'string') return error`. |
| 8 | `tablify.schema.json` | Add the `phoneCountry` property to `$defs.field`. |
| 9 | `FORMAT_SPEC.md` | §3 key table + a note: optional, phone only, no `formatVersion` change, older readers preserve it. |
| 10 | `THIRD_PARTY_NOTICES.md` **(new)** | MIT notice for the newly bundled library (repo already ships `LICENSE-FONTS`; bundled MIT code needs its notice preserved). |

**Tests:** `tests/model/phone/countries.test.ts` **(new)**, `tests/model/phone/phoneValue.test.ts` **(new)**, extend `tests/model/fieldTypes.test.ts`, `tests/format/format.test.ts`, `tests/schema.test.ts`.

### 5.2 Commit 2 — the per-field default country

| # | File | Change |
|---|---|---|
| 1 | `src/model/tableSession.ts` | `FieldEdit.phoneCountry?: string \| null` (`:52-65`); `NewFieldExtras.phoneCountry?: string` (`:524-533`); `applyNewFieldExtras` sets it (`:536-550`); `editFieldImpl` applies the patch next to `regex` (`:241-262`), validating `/^[A-Z]{2}$/` + `isSupportedCountry` and deleting on `null`/`''`; add `'phoneCountry'` to `FIELD_EDIT_KEYS` (`:553-563`) so a no-op save adds no undo entry. |
| 2 | `src/model/fieldChange.ts` | In `planTypeChange` (`:27-65`): `if (target !== 'phone') delete next.phoneCountry;` (same rule as `options`/`formula`/`linkTableId`). |
| 3 | `src/views/grid/phone/CountryList.ts` **(new, ~180 lines)** | Shared search + list component: `setQuery`, `setActive`, `render`, `onPick`, roles/ARIA, keyboard navigation. No panel chrome, no model writes. |
| 4 | `src/views/grid/phone/CountrySelect.ts` **(new, ~150 lines)** | The Add/Modify Field control: a trigger row + an anchored popover on `document.body` (z-index 1000) hosting `CountryList` plus “No default (use my region)”. Mirrors `FieldTypePicker.position()`/`wireDismiss()` (`:515-580`). |
| 5 | `src/views/grid/AddFieldModal.ts` | New row “Default country” built next to the regex row; shown only when `this.type === 'phone'` inside `showTypeRows` (`:291-299`); pre-filled in edit mode from `initial.phoneCountry`; `collectExtras` adds `phoneCountry` only when chosen (`:360-384`); the edit-mode patch includes `phoneCountry` (`submitEdit`, `:423-451`). |
| 6 | `styles.css` | `.tablify__af-country*` row + badge styles; popover reuses `.tablify__panel`. No token changes. |
| 7 | `src/views/grid/fieldTypePicker.ts` | *Optional copy polish:* phone description → “Country code, stored as +880…” (test only requires length > 8). |

**Tests:** extend `tests/views/addFieldModal.test.ts` (row appears only for phone; create/edit/clear), `tests/model/tableSession.test.ts` / `tests/model/editField.test.ts` (undo, no-op save), `tests/model/addFieldExtras.test.ts`, `tests/views/grid/fieldTypePicker.test.ts` if copy changes.

### 5.3 Commit 3 — the phone cell panel

| # | File | Change |
|---|---|---|
| 1 | `src/views/grid/phone/PhonePanel.ts` **(new, ~330 lines)** | The card (§4.4). Public surface: `open(anchor)`, `close()`, `element`, `{ field, value, theme, locale?, onCommit, onCancel? }`. Owns focus, two views, live formatting, `dirty` tracking, ARIA. **No store access.** |
| 2 | `src/views/tableView.ts` | `startEdit` panel branch gains `field.type === 'phone'` (`:1218-1227`). `openCellPanel` gains a phone block modelled on the date block (`:1281-1305`): `finish(commit, next)` compares with the stored value and only then calls `s.setValue` + `afterChange`; focus returns to the grid. |
| 3 | `src/views/grid/editors/index.ts` | `createEditor` returns `null` for `phone` (next to the date check, `:69`), so no inline input is ever created. `parseInput`/`commitValue` still handle phone (paste, tests). |
| 4 | `src/views/grid/cellRender.ts` | `renderContactLink` (`:240-259`): for phone, link text = `formatPhoneDisplay(value)`, `title` = raw stored value, `href` = `telHref(value)`. `contactHref` (`:226-233`) delegates to `telHref`. Email/URL untouched. |
| 5 | `src/views/grid/GridView.ts` | **No change** — the existing branch at `:1380` already calls `renderContactLink`. |
| 6 | `styles.css` | New `/* ---- phone panel (SAD-303) ---- */` block: `.tablify__phone-*`, `.tablify__country-*`, badge, preview states, `:focus-visible`, `@media (pointer: coarse)`. Reuses `.tablify__panel`, `.tablify__dropdown-input`, `.tablify__dropdown-list`. No existing selector edited; no new theme tokens (so `tests/ui/contrast.test.ts` is untouched). |
| 7 | `src/ui/faIcons.ts` | **No change** — `phone`, `magnifying-glass`, `check`, `chevron-left`, `chevron-down`, `xmark` already exist. |

**Tests:** `tests/views/grid/phonePanel.test.ts` **(new)**, `tests/views/grid/phonePanelHost.test.ts` **(new, modelled on `datePanelHost.test.ts`)**, extend `tests/views/grid/cellFormatting.test.ts`, update `tests/e2e/fieldTypes.browser.ts` (phone → panel), optional Playwright capture route.

### 5.4 Commit 4 — import inference for email / phone / URL

| # | File | Change |
|---|---|---|
| 1 | `src/io/infer.ts` | `InferredType` += `'email' \| 'phone' \| 'url'` (`:29`). Add `headers?: readonly string[]` to `InferenceOptions`; `inferColumn` reads `options.header`. New matchers (`matchesEmail`, `matchesUrl`, `matchesPhone`) using the regexes exported from `string.ts` and `libphonenumber-js/min`; new `MATCHERS` order per §4.8; reason strings in the same style as today. Update the header comment (`:1-31`) so the recorded rules match the code. |
| 2 | `src/io/import/build.ts` | `TYPE_MAP` += the three types (`:45-51`); `convertCell` cases per §4.8 (`:68-104`); pass headers to `inferTable` (`:139`); set `field.phoneCountry` when a phone column's `+` values agree on one country (`:146-160`). |
| 3 | `scripts/gen-fixtures.mjs` | Relabel `Email` → `email`; add `Phone` (international), `Mobile` (national digits, header-assisted), `Website` (URLs), plus a “Phone ID” negative control (bare digits under a non-phone header, labelled number). Regenerate `samples/fixtures/labeled/labeled-set.json` and `HASHES.json`. |
| 4 | `scripts/infer-accuracy.ts` | `TYPES` += email/phone/url so precision/recall tables include them. |
| 5 | `docs/reports/p4-03-accuracy.md` | Regenerated by the script; commit the measured result. |

**Tests:** extend `tests/io/infer.test.ts` (≈30 new cases), `tests/io/import.build.test.ts`, `tests/io/import.importer.test.ts`; new `tests/io/roundtrip.fieldTypes.test.ts`; update `tests/io/infer.perf.test.ts` expectations if the phone matcher changes timings (types must not change).

### 5.5 Commit 5 — docs, changelog, evidence

| File | Change |
|---|---|
| `CHANGELOG.md` | Two entries under `## [Unreleased]` → `### Added` / `### Fixed`, in the existing voice (user-visible behaviour first, cause last). |
| `docs/user-guide.md` | §4 (cell types / phone links), §12 (import: email/phone/URL detection, header assist, bare-digit rule), §13 (export: phone is E.164, round-trip), §17 (troubleshooting: “my phone column came in as Number”, scientific notation). |
| `docs/decisions/phone-number-data.md` **(new)** | The §3.1 measurement table, the license, the pin, and the fallback plan. |
| `docs/evidence/SAD-303.md` **(new)** | Commit hash, commands, test counts, bundle sizes before/after, accuracy report, manual desktop/mobile results, NOT RUN items with reasons. |
| `docs/testing/matrix.md` | Only if a manual mobile scenario is added (no existing row changes). |

---

## 6. Test plan

### 6.1 New test files

| File | Covers |
|---|---|
| `tests/model/phone/countries.test.ts` | 245 rows; dial codes for BD/US/GB/IN; search by name, localized name, ISO, `+880`, `880`, aliases (UK/USA/UAE); ranking determinism; unknown query → empty; `Intl.DisplayNames` absent → ISO fallback (mock). |
| `tests/model/phone/phoneValue.test.ts` | The full §4.3 table; `splitStored` for E.164, legacy raw, empty; `formatPhoneDisplay` for valid/invalid/legacy; `telHref`; `defaultCountryFor` (field > locale > US); `AsYouType` sequences; lowercase country never reaches `getCountryCallingCode`. |
| `tests/views/grid/phonePanel.test.ts` | Opens with stored value; country view search/pick; typing formats live; preview valid/invalid; commit produces E.164; Clear → `null`; Escape cancels; outside press commits only when dirty; untouched returns stored verbatim; keyboard; ARIA roles; coarse-pointer class; focus returns to input after picking a country. |
| `tests/views/grid/phonePanelHost.test.ts` | `startEdit` routes phone to the panel (no inline input); one commit = one undo step; undo restores the old value; opening + dismissing writes nothing (rev unchanged); Escape writes nothing; `tel:` href updates after commit. |
| `tests/io/roundtrip.fieldTypes.test.ts` | CSV: import fixture with email/phone/URL/number/date/checkbox/select → export → re-import; assert identical field types, values and option **names**. XLSX: same through the real writer/reader. Bare-digit phone column survives via its header. |
| `THIRD_PARTY_NOTICES.md` check (optional test) | Exists and contains `libphonenumber-js`. |

### 6.2 Updated test files

| File | Change | Why |
|---|---|---|
| `tests/io/infer.test.ts` | Add email/phone/URL matrices, header assist on/off, precedence, false positives, reason strings | New rules |
| `tests/io/import.build.test.ts` | New columns typed correctly; values converted; `phoneCountry` inferred; existing assertions unchanged | New mapping |
| `tests/io/infer.perf.test.ts` | Re-measure; keep the < 500 ms assertion | New matcher cost |
| `tests/model/fieldTypes.test.ts` | Add parse-normalisation cases; **keep** the legacy `+1 555-1234` case | §4.3 |
| `tests/format/format.test.ts` | `phoneCountry` round-trips, key order, unknown field keys still preserved | Format change |
| `tests/schema.test.ts` | Schema accepts `phoneCountry: "BD"`; rejects `"bd"` / `"BGD"` | Schema |
| `tests/model/tableSession.test.ts`, `tests/model/editField.test.ts` | Create/edit/clear default country; undo; no-op save has no undo entry; type change drops it | Model |
| `tests/views/addFieldModal.test.ts` | Row only for phone; pre-fill; extras; clear | UI |
| `tests/views/grid/cellFormatting.test.ts` | Assert formatted **text** as well as the `tel:` href; legacy value renders unchanged | Display |
| `tests/e2e/fieldTypes.browser.ts` | `fld_phone` → `expect: 'panel'`; interact with the panel instead of an input | Panel replaced the editor |
| `tests/views/grid/editors.test.ts` | `createEditor('phone')` returns `null`; `parseInput` still normalises | Routing |

### 6.3 Regression matrix (feature × proof)

| Existing feature | Touched? | Proof it still works |
|---|---|---|
| New table / default fields | No | Full suite + `tests/menus/fileMenuModel.test.ts` |
| Cell selection, arrows, Enter/F2, double-click, long-press | Only the phone branch of `startEdit` | `tests/views/grid/keyboard.test.ts`, `editTriggers.test.ts`, `longPress.test.ts`, `phonePanelHost.test.ts` |
| Undo/redo | One new commit path, same command | `tests/model/commands.test.ts`, `phonePanelHost.test.ts`, `datePanelHost.test.ts` |
| Copy / paste | Phone parse only | `tests/views/grid/grid.test.ts`, new paste case |
| Search / query / sort / grouping | No code change | `tests/model/rowFilter.test.ts`, `query/*`, `grouping.test.ts` |
| Validation rules | No | `tests/model/validation.test.ts` |
| Field type change | One added `delete` | `tests/model/editField.test.ts` (phone ↔ text) |
| CSV / XLSX / Markdown export | No writer change | `tests/io/export.*` (all), new round-trip |
| CSV / XLSX import (other types) | Matcher order only for email/phone/URL | `tests/io/infer.test.ts`, `import.build.test.ts`, `import.e2e.test.ts`, perf test |
| Airtable sync | No code change | `tests/sync/*` (all) |
| Formula / link fields | No | `tests/formula/*`, `tests/links/*` |
| Embeds / themes / contrast | No token change | `tests/embed/*`, `tests/ui/*` |
| File format for existing files | No write on open | `tests/format/format.test.ts`, schema samples |

### 6.4 Performance checks

| Check | Target | Method |
|---|---|---|
| Import inference, FX-XLSX-sized (5,000 × 10) | still < 500 ms p95 | existing `tests/io/infer.perf.test.ts`; record medians before/after |
| Country list build (245 rows × names) | < 50 ms once | unit timing in `countries.test.ts` (informational, not flaky) |
| Phone panel open | < 100 ms | `phonePanel.test.ts` timing, plus manual |
| `main.js` size | recorded, not capped | `npm run build` + `ls -l` in evidence |

### 6.5 Manual checks (recorded in `docs/evidence/SAD-303.md`)

- Desktop (Windows/macOS): light + dark panel; search “bangla”, “880”, “+880”, “uk”; type a national BD number; paste an E.164 number; commit; undo; export CSV and reopen it.
- Modal: create a phone field with default BD, edit to US, clear; save; reopen the file.
- Mobile (iOS/Android): 44 px rows, keyboard does not cover the list, panel flips near the bottom, `tel:` link opens the dialler.
- Airtable: pull a table with a phone field, edit a value, push, confirm the E.164 string arrives.
- Backward compatibility: open a pre-change table with phone values and confirm the file is byte-identical on open (no save), and that values render best-effort.

---

## 7. Sequencing and verification gates

| Commit | Scope | Gate |
|---|---|---|
| 1 | Data layer, format/schema, notices | `npm test` + `npm run lint` + `npm run build`; format tests green |
| 2 | Field default country + modal | same + manual create/edit/undo |
| 3 | Phone panel + display | same + jsdom panel host tests + Playwright `test:fields` |
| 4 | Import inference + labelled set + accuracy report | same + perf test + round-trip suite |
| 5 | Docs, changelog, evidence | `npm run check` (lint + test + guard + docs + icons + build) and evidence file |

Every commit must keep the lint warning count at the current baseline (119) or lower, and must not change any existing test's meaning without saying so in the commit message.

---

## 8. Acceptance criteria

A reviewer can tick these without reading the implementation:

1. A phone cell opens a panel with a **searchable** country list (name, ISO, dial code, aliases) and the current country visibly selected.
2. Choosing a country and typing a national number and pressing Enter stores **E.164** (`+8801712345678`); the cell shows `+880 1712 345678`; the link is `tel:+8801712345678`.
3. A phone field can carry `phoneCountry` in the `.tablify` file; it survives save/reopen, export/import, and is dropped when the type changes away from phone.
4. `phoneCountry` is **absent** from files whose user never chose a default; existing files are not rewritten on open.
5. Opening and dismissing a phone cell (or pressing Escape) writes nothing and changes no row revision.
6. Every existing phone value in an old file still validates and still displays (unformatted when it cannot be parsed).
7. Importing a CSV/XLSX with email, phone and URL columns creates `email`, `phone`, `url` fields — including a bare-digit phone column whose header is phone-like — and leaves number/date/checkbox/select inference unchanged.
8. Exporting that table to CSV and XLSX and importing it again yields the same field types and the same values (option IDs excepted, names equal).
9. `npm run check` passes; the new tests cover the panel, the model, the format, the importer and the round-trip.
10. Bundle delta and inference timings are recorded in the evidence file as measured numbers, not estimates.

---

## 9. Risks and mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Bundle grows ~18 % (raw and gzip) | Certain | Moderate | Measured and accepted (§3.1); exact pin; provider seam if it must be swapped later; size recorded in evidence |
| R2 | Metadata parse adds startup time | Certain | Low | Measured 9–34 ms cold; no work at import beyond module load |
| R3 | A formatted phone display surprises users of old files | Medium | Low | Only parsed values are reformatted; raw values render exactly as stored; changelog says so |
| R4 | Inference false positives (IDs, postal codes) | Medium | High (wrong type) | Conservative rule set; header assist only for phone-shaped values; 7–15 digit bound; labelled accuracy report; negative-control fixtures |
| R5 | Email columns with few distinct values were `single_select` and now become `email` | Certain | Low (intended) | Documented in the changelog as a fix; labelled set relabelled |
| R6 | Panel focus/blur races (country list closing the panel) | Medium | Medium | Country list is a view **inside** the card, not a second panel; jsdom + Playwright tests |
| R7 | `Intl.DisplayNames` missing or locale-dependent | Low | Low | Feature check + ISO fallback; locale injected in tests |
| R8 | Existing phone values are national numbers with no country; they cannot be formatted | Certain | Low | Display best-effort; the field default + one edit normalises them; no mass migration |
| R9 | Airtable shows a different phone layout after a push | Low | Low | Airtable stores the string; E.164 is accepted; noted in evidence |
| R10 | Playwright e2e suite fails because phone moved from editor to panel | Certain | Low | Updated in the same commit as the panel |
| R11 | Adding a field key breaks older readers | Very low | High | Optional key; `orderField` preserves unknown keys; no `formatVersion` bump; tested with a pre-change sample file |

---

## 10. Open items (not blocking)

1. **Search by formatted text** — today search matches stored E.164 digits. If users search `1712 345` with a space, it will miss. Deferred; the fix is one line in `searchableText` if requested.
2. **Global default country setting** — deliberately not added; `phoneCountry` is per field and locale is the fallback. Easy to add later in `settings.ts`.
3. **URL detection** — included because it is the same class of bug and a strict rule (`http(s)://` only) is safe. If the owner prefers issue-literal scope, drop rule 4 and its tests; nothing else depends on it.
4. **Normalising pre-existing values** — not done on open. A future “Normalise phone column” action could offer it explicitly.
5. **Phone extensions** — not parsed; text after the number is preserved as typed.

---

## Appendix A — measured numbers used in this plan

| Measurement | Value | Command / method |
|---|---|---|
| Baseline `main.js` | 851,625 B raw · 201,903 B gzip | `npm run build`; `ls -l`; `gzip -c` |
| `libphonenumber-js/min` probe (parse + AsYouType + countries + calling codes) | 152.8 KB raw · 36.5 KB gzip | temporary probe module bundled with the repo's esbuild flags (`--bundle --minify --format=cjs --platform=browser --target=es2022`), removed afterwards |
| Parse-only probe | 122.0 KB raw · 30.0 KB gzip | same, without `AsYouType` |
| `libphonenumber-js/max` probe | 224.4 KB raw · 57.6 KB gzip | same |
| 5,000 parses + `isValid()` | 69 ms | Node on the sandbox CPU |
| 245 × `getCountryCallingCode` | 23 ms | Node |
| 245 × `Intl.DisplayNames` (English) | 11 ms | Node |
| Cold `require('libphonenumber-js/min')` | 9–34 ms | `process.hrtime` around `require` |
| Package license / version | MIT / 1.13.15 | `npm view` |
| Countries in metadata | 245 (includes XK, AC, TA) | `getCountries().length` |
| Baseline test suite | 124 files / 1,942 tests passed | `npx vitest run`, 2026-10-19 |
| Baseline lint | 119 warnings, 0 errors | `npm run lint`, 2026-10-19 |
| Baseline inference accuracy | 73.3 % (22/30) | `docs/reports/p4-03-accuracy.md` |
| Baseline inference perf (5,000 × 10) | median 14.2 ms · p95 14.4 ms | `tests/io/infer.perf.test.ts` |

## Appendix B — proposed public API (sketch)

```ts
// src/model/phone/countries.ts
export interface CountryRow { iso: string; dial: string; name: string; english: string }
export function allCountries(locale?: string): readonly CountryRow[];
export function countryRow(iso: string, locale?: string): CountryRow | undefined;
export function searchCountries(query: string, locale?: string): readonly CountryRow[];
export function isPhoneHeader(header: string): boolean;

// src/model/phone/phoneValue.ts
export interface PhoneParts { country: string | null; national: string; e164: string | null }
export function defaultCountryFor(field: FieldDefinition, locale?: string): string;
export function parsePhone(input: string, country?: string): PhoneParts;
export function toE164(input: string, country?: string): string | null;
export function formatPhoneDisplay(value: CellValue | undefined): string;
export function formatAsYouType(input: string, country: string): string;
export function splitStored(value: CellValue | undefined, field: FieldDefinition, locale?: string): PhoneParts;
export function telHref(value: string): string | null;

// src/views/grid/phone/PhonePanel.ts
export interface PhonePanelOptions {
  field: FieldDefinition;
  value: CellValue | undefined;
  theme?: 'light' | 'dark';
  locale?: string;
  onCommit: (value: CellValue) => void;
  onCancel?: () => void;
}
export class PhonePanel {
  constructor(options: PhonePanelOptions);
  open(anchor: HTMLElement): void;
  close(): void;
  readonly element: HTMLElement;
}
```

## Appendix C — inference reason strings (shown in the import report)

| Type | Reason |
|---|---|
| email | `all N non-empty values look like email addresses` |
| url | `all N non-empty values are http(s) URLs` |
| phone (international) | `all N non-empty values are valid international phone numbers` |
| phone (header) | `all N non-empty values are 7–15 digit phone numbers and the header says "Phone"` |
| number / date / checkbox / single_select / text | unchanged |

These strings are asserted in `tests/io/infer.test.ts` so the report cannot silently drift from the rules.
