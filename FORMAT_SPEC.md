# FORMAT_SPEC.md — `.tablify` File Format v1

**Status:** Authoritative specification  
**Date:** 2026-10-09  
**Linear:** SAD-17 (P0-03)  
**Companion:** `tablify.schema.json` (JSON Schema draft 2020-12)  

---

## 0. Overview

The `.tablify` format is a plain-text JSON file that stores an Airtable-like table with typed fields, rows, and view settings. Each file is self-contained and human-readable.

**Key properties:**
- Storage format: Pretty-printed JSON text
- Version: `formatVersion: 1`
- Row identity: Stable IDs keyed by field ID (not name)
- Reserved keys: `sync` (per row) and `syncLink` (per table) exist as `null` for forward compatibility with v1.1
- Unknown keys: Preserved on round-trip save

---

## 1. File encoding and formatting

| Property | Value |
|----------|-------|
| Character encoding | UTF-8 |
| Byte order mark (BOM) | Not permitted |
| Line endings | LF (`\n`) |
| Indentation | 2 spaces |
| Trailing newline | Required (file ends with `\n` after closing `}`) |
| Key order | As specified in §2 (top-level), §3 (field), §4 (row), §5 (view) |
| Trailing commas | Not permitted (standard JSON) |

---

## 2. Top-level structure

The file is a single JSON object with these keys **in this exact order**:

```json
{
  "formatVersion": 1,
  "tableId": "tbl_...",
  "name": "...",
  "fields": [...],
  "rows": [...],
  "views": [...],
  "syncLink": null
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `formatVersion` | integer | ✅ | Must be `1`. Unknown versions show an error and the file is not written to. |
| `tableId` | string | ✅ | Unique identifier for the table. Pattern: `tbl_` prefix followed by alphanumeric characters. |
| `name` | string | ✅ | Human-readable table name. Non-empty. |
| `fields` | array | ✅ | Array of field (column) definitions. At least one field required. See §3. |
| `rows` | array | ✅ | Array of row objects. May be empty. See §4. |
| `views` | array | ✅ | Array of view definitions. At least one view required. See §5. |
| `syncLink` | null \| object | ✅ | Reserved for v1.1 Airtable sync link metadata. Must be `null` in v1. |

### 2.1 Rules

- **Exactly one** field must have `"primary": true` (see §3).
- **Unknown keys** at any level are preserved on save (round-trip safe). The schema allows them.
- The file **must never** contain an Airtable token or any secret.
- `.tabula` files are never read, written, imported, detected, or migrated by this plugin.

---

## 3. Field definition

Each field object has these keys **in this order**:

```json
{
  "id": "fld_...",
  "name": "Status",
  "type": "single_select",
  "primary": false,
  "options": [...],
  "required": false,
  "unique": false,
  "min": null,
  "max": null,
  "regex": null
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | string | ✅ | Stable field identifier. Pattern: `fld_` prefix + alphanumeric. Unique within the table. |
| `name` | string | ✅ | Human-readable field name. Non-empty. May contain spaces and unicode. |
| `type` | string | ✅ | Field type. Must be one of the 19 types in §3.1. |
| `primary` | boolean | optional | Default `false`. Exactly one field must be `true`. Primary field cannot be hidden or deleted (R-D13). |
| `options` | array | conditional | Required for `single_select` and `multi_select` types. Array of option objects (§3.2). Omitted for other types. |
| `required` | boolean | optional | Default `false`. If `true`, cells must have a non-empty value. |
| `unique` | boolean | optional | Default `false`. If `true`, no two rows may have the same value. Case-sensitive. |
| `min` | number\|string\|null | optional | Minimum value constraint. Number for numeric types, ISO date string for date types. `null` if not set. |
| `max` | number\|string\|null | optional | Maximum value constraint. Same type rules as `min`. |
| `regex` | string\|null | optional | Regular expression for text validation. Only for `text` and `long_text` types. `null` if not set. |

### 3.1 Field types

| # | Type ID | Description | Value type in `values` |
|---|---------|-------------|----------------------|
| 1 | `text` | Short text | string \| null |
| 2 | `long_text` | Long text (multiline) | string \| null |
| 3 | `number` | Number | number \| null |
| 4 | `currency` | Currency amount | number \| null |
| 5 | `percent` | Percentage (stored as decimal, e.g. 0.75 = 75%) | number \| null |
| 6 | `duration` | Duration in milliseconds | number \| null |
| 7 | `rating` | Rating (integer, 1–10) | number \| null |
| 8 | `checkbox` | Boolean checkbox | boolean \| null |
| 9 | `date` | Date (YYYY-MM-DD) | string \| null |
| 10 | `date_time` | Date and time (ISO 8601) | string \| null |
| 11 | `url` | URL | string \| null |
| 12 | `email` | Email address | string \| null |
| 13 | `phone` | Phone number | string \| null |
| 14 | `single_select` | Single selection from options | string \| null (option ID) |
| 15 | `multi_select` | Multiple selections from options | string[] \| null (option IDs) |
| 16 | `attachment` | Vault-relative file path | string \| null |
| 17 | `auto_number` | Auto-incrementing number (system) | number (read-only, never null) |
| 18 | `created_time` | Row creation timestamp (system) | string (read-only, ISO 8601, never null) |
| 19 | `modified_time` | Last modification timestamp (system) | string (read-only, ISO 8601, never null) |

**System types** (17–19) are read-only. They are computed automatically and cannot be edited by the user.

### 3.2 Select option

```json
{
  "id": "opt_...",
  "name": "To do",
  "color": "gray"
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | string | ✅ | Option identifier. Unique within the field's options array. |
| `name` | string | ✅ | Display name. Non-empty. |
| `color` | string | ✅ | One of: `gray`, `brown`, `orange`, `yellow`, `green`, `blue`, `purple`, `pink`, `red` |

---

## 4. Row definition

Each row object has these keys **in this order**:

```json
{
  "id": "row_...",
  "rev": 3,
  "createdAt": "2026-10-09T08:00:00Z",
  "updatedAt": "2026-10-09T10:00:00Z",
  "values": {
    "fld_name": "Write spec",
    "fld_status": "opt_todo"
  },
  "sync": null
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | string | ✅ | Stable row identifier. Pattern: `row_` prefix + alphanumeric. Unique within the table. Generated once, never reused (R-D9). |
| `rev` | integer | ✅ | Revision counter. Starts at 1 on creation. Incremented by exactly 1 on every edit. |
| `createdAt` | string | optional | ISO 8601 timestamp of row creation. Set once, never changed. |
| `updatedAt` | string | ✅ | ISO 8601 timestamp of last modification. Updated on every edit. |
| `values` | object | ✅ | Cell values keyed by **field ID** (R-D8). See §4.1. |
| `sync` | null \| object | ✅ | Reserved for v1.1 Airtable sync metadata. Must be `null` in v1. |

### 4.1 Values object

- Keys are field IDs (e.g., `"fld_name"`, `"fld_status"`).
- Values are typed according to the field's type (see §3.1).
- A missing key means the cell is empty (equivalent to `null` for nullable types).
- System-type fields (`auto_number`, `created_time`, `modified_time`) must not appear in `values` if they are computed externally; alternatively, they may be stored for persistence.
- Row values must not reference field IDs not present in the `fields` array.

### 4.2 Row identity rules

- Row IDs are generated once and never reused (R-D9).
- Values are keyed by field ID, not name (R-D8). Renaming a field does not break data.
- `rev` increments exactly once per edit operation.
- Duplicate row (R-D11): new row gets a new `id` and `rev: 1`, but row IDs within the duplicate are kept.

---

## 5. View definition

Each view object has these keys **in this order**:

```json
{
  "id": "view_default",
  "name": "Default",
  "sort": [],
  "groupBy": null,
  "hidden": [],
  "frozenColumns": 1,
  "rowHeight": "medium",
  "columnWidths": {}
}
```

| Key | Type | Required | Description |
|-----|------|----------|-------------|
| `id` | string | ✅ | View identifier. Unique within the table. |
| `name` | string | ✅ | Human-readable view name. Non-empty. |
| `sort` | array | ✅ | Array of sort entries. Each: `{"fieldId": "fld_...", "direction": "asc" \| "desc"}`. Empty array = no sort. |
| `groupBy` | string\|null | ✅ | Field ID to group by, or `null` for no grouping. |
| `hidden` | string[] | ✅ | Array of field IDs to hide. Must not contain the primary field ID (R-D13). |
| `frozenColumns` | integer | ✅ | Number of columns frozen from the left. At least 1 (primary column is always frozen). |
| `rowHeight` | string | ✅ | One of: `"small"`, `"medium"`, `"large"`. |
| `columnWidths` | object | ✅ | Map of field ID to width in pixels (integer). Missing fields use the default width. |

### 5.1 View rules

- View settings are stored in the `.tablify` file (R-D10). The table travels with its layout.
- The primary field cannot be hidden (R-D13). If `hidden` contains the primary field ID, the file is invalid.
- At least one view must exist.

---

## 6. Reserved keys for future versions

| Key | Level | v1 value | Purpose |
|-----|-------|----------|---------|
| `sync` | Per row | `null` | v1.1 Airtable sync metadata (airtableId, syncedRev) |
| `syncLink` | Top level | `null` | v1.1 Airtable link configuration (baseId, tableId, etc.) |

These keys exist in v1 as `null` so that v1.1 can add sync metadata without requiring a file format migration.

---

## 7. Unknown key preservation

The parser and serializer must preserve unknown keys at every level:
- Top-level: unknown keys in the root object are preserved
- Field level: unknown keys in field objects are preserved
- Row level: unknown keys in row objects are preserved
- Values level: unknown keys in row values are preserved
- View level: unknown keys in view objects are preserved

This ensures forward compatibility — a v1 file opened by a future version that adds new keys will not lose those keys when saved back.

---

## 8. formatVersion enforcement

- The `formatVersion` key is required.
- If `formatVersion` is missing, the file is invalid — show an error and do not write.
- If `formatVersion` is not `1`, the file is from an unknown version — show an error and do not write.
- The plugin never silently migrates or overwrites a file it cannot fully parse.

---

## 9. `.tabula` exclusion statement

**The Tablify plugin never reads, writes, imports, detects, or migrates `.tabula` files.** The `.tablify` format is a separate, independent format. No code path in the plugin references `.tabula`.

---

## 10. Security constraints

- The file must never contain an Airtable token, API key, or any secret.
- The Airtable token is stored only in plugin settings (not in `.tablify` files).
- No field value, metadata key, or view setting may contain a secret.

---

## 11. Checklist: roadmap §7 contract coverage

Every field from the roadmap §7 contract appears in this spec:

| Roadmap §7 item | This spec section |
|-----------------|-------------------|
| `formatVersion` required | §2, §8 |
| `tableId` | §2 |
| `name` | §2 |
| `fields[]` with `id`, `name`, `type` | §3 |
| `fields[].primary` | §3 |
| `fields[].options` for select types | §3, §3.2 |
| `rows[]` with `id`, `rev`, `updatedAt` | §4 |
| `rows[].values` keyed by field ID | §4.1, R-D8 |
| `rows[].sync` reserved | §4, §6 |
| `views[]` with sort, groupBy, hidden, etc. | §5 |
| `syncLink` reserved | §2, §6 |
| Unknown keys preserved | §7 |
| `.tabula` not read | §9 |
| Never contains Airtable token | §10 |
| `formatVersion` unknown = error | §8 |
