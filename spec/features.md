# Tablify Plugin — Feature Documentation

**Status:** Approved scope (21 features reviewed; 20 included, 1 excluded)
**Reference project:** [airtable-tabula](https://github.com/MehulG/airtable-tabula) (Obsidian plugin, `.tabula` JSON format)

## 0. Scope rules

- The plugin is a **new, separate plugin**.
- It **does not read, write, import, detect, or convert `.tabula` files** in any form. No `.tabula` file-type registration, no `.tabula` import path, and no migration tool.
- The new file extension is `.tablify` (proposed name; the same format is used everywhere in this document).

## 1. Included features

| # | Feature | Decision | Notes |
|---|---------|----------|-------|
| 1 | Custom `.tablify` file format | Yes | Human-readable text, Git-friendly diffs |
| 2 | Typed fields | Yes | text, long text, number, currency, percent, duration, rating, checkbox, date, date & time, URL, email, phone |
| 3 | Selects and attachments | Yes | Colored single/multi select, searchable dropdown, create-on-type, option manager; attachments as vault-relative paths |
| 4 | System fields | Yes | Auto number, created time, last-modified time |
| 5 | Grid view with inline editing | Yes | Spreadsheet-style cell editing |
| 6 | Search, filter builder, query string | Yes | Same operators as Tabula (see §2.6) |
| 7 | Multi-sort, group by, hide fields, column resize/reorder, freeze primary column, row height | Yes | View-level settings |
| 8 | Undo / redo | Yes | Advantage over Tabula |
| 9 | Keyboard navigation and shortcuts | Yes | Advantage over Tabula |
| 10 | Field validation rules | Yes | Advantage over Tabula |
| 11 | Formula (computed) fields | Yes | Advantage over Tabula (out of scope there) |
| 12 | Linked records between tables | Yes | Advantage over Tabula (out of scope there) |
| 13 | Kanban, Calendar, Gallery views | **No** | Excluded from this version |
| 14 | Import CSV / Excel with type inference | Yes | Parity with Tabula |
| 15 | Export to CSV, Excel, Markdown table | Yes | Advantage over Tabula |
| 16 | File explorer right-click menu | Yes | See §3.1 |
| 17 | Table right-click menu | Yes | See §3.2 |
| 18 | Embed a live table in a note | Yes | Advantage over Tabula |
| 19 | Optional Airtable sync | Yes | Parity with Tabula; optional, plugin works offline |
| 20 | Sync conflict detection | Yes | Advantage over Tabula |
| 21 | Auto-create missing Airtable fields on push | Yes | Advantage over Tabula |

## 2. Feature details

### 2.1 `.tablify` file format (Feature 1)
- Plain UTF-8 text file. Structure: a header with the schema (field names, types, options), followed by row data.
- Each row has a stable ID so that sync, undo, and Git diffs stay accurate.
- Only `.tablify` is recognised by the plugin. Opening a `.tabula` file is not handled by this plugin.

### 2.2 Typed fields (Feature 2)
Supported types: text, long text, number, currency, percent, duration, rating, checkbox, date, date & time, URL, email, phone.

### 2.3 Selects and attachments (Feature 3)
- Single and multi select with colored options.
- Searchable dropdown. Typing a value that does not exist creates it (create-on-type).
- Option manager to rename, recolor, reorder, and delete options.
- Attachment cells store vault-relative paths (for example `Assets/photo.png`). The user types the path and presses Enter.

### 2.4 System fields (Feature 4)
- **Auto number:** sequential, read-only.
- **Created time** and **Last-modified time:** set automatically, read-only.

### 2.5 Grid view (Feature 5)
- Spreadsheet-style grid with inline cell editing.
- Editing a cell commits on Enter or blur and cancels on Escape.

### 2.6 Search and filtering (Feature 6)

| Pattern | Meaning |
|---------|---------|
| `field:value` | equals / is / contains (multi) |
| `field:~value` | text contains |
| `field:>n` / `field:<n` | number (or date before/after) |
| `field:!value` | is not (single select) |
| `field:a,b` | is any of / contains any |
| `field:empty` | is empty |

- Field names are case-insensitive.
- Names with spaces are quoted: `"My Field":Done`.
- The filter builder UI and the query string produce the same result.

### 2.7 View settings (Feature 7)
Multi-sort, group by, hide/show fields, column resize and reorder, freeze primary column, and row height. These are saved per view.

### 2.8 Undo / redo (Feature 8)
Undo and redo cover cell edits, row add and delete, column changes, and option changes.

### 2.9 Keyboard navigation (Feature 9)
Arrow keys move between cells. Tab and Enter move to the next cell. Copy and paste work on cell ranges. Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z undo and redo.

### 2.10 Validation rules (Feature 10)
Per-field rules: required, unique, min and max (numbers and dates), and regex (text). Invalid cells are highlighted and the reason is shown on hover. Validation runs on edit and on save.

### 2.11 Formula fields (Feature 11)
Computed columns that reference other fields in the same row. The formula syntax is defined in a later spec.

### 2.12 Linked records (Feature 12)
A link field points to rows in another `.tablify` table in the same vault. Linked rows are stored by stable row ID, so renaming a row does not break the link.

### 2.13 Excluded: Kanban, Calendar, Gallery (Feature 13)
Not part of this version.

### 2.14 Import CSV / Excel (Feature 14)
- Command: **Import CSV / Excel as table**.
- The first row becomes the headers. Column types are inferred (text, number, date, checkbox, or single select when a column has few distinct values).
- Creates a new `.tablify` file and opens it.

### 2.15 Export (Feature 15)
Export the current view or full table to **CSV**, **Excel (.xlsx)**, or **Markdown table**. Export respects the current filter and hidden fields if the user chooses "current view".

### 2.16 File explorer right-click (Feature 16)

| Target | Menu items |
|--------|------------|
| `.tablify` file | Open, Duplicate, Export |
| Folder | New table, Import CSV / Excel as table |

### 2.17 Table right-click (Feature 17)

| Target | Menu items |
|--------|------------|
| Cell | Copy, Paste, Clear |
| Row | Insert row above, Insert row below, Duplicate row, Copy row, Delete row |
| Column header | Change field type, Hide field, Sort ascending, Sort descending, Freeze column |

### 2.18 Embedded table in a note (Feature 18)
A fenced code block in a note references a `.tablify` file. The plugin renders a live, editable table inside the note. Changes save to the source file.

### 2.19 Optional Airtable sync (Feature 19)
1. Store a personal access token in plugin settings only. It is not written to `.tablify` files.
2. Link a `.tablify` table to an Airtable base and table.
3. **Pull from Airtable** and **Push to Airtable** are manual actions.
4. The required token scopes are `data.records:read`, `data.records:write`, and `schema.bases:read`.
5. The plugin works fully offline when sync is not configured.

### 2.20 Sync conflict detection (Feature 20)
Each row stores the last-synced revision. Before a push, the plugin compares local and remote revisions. If both sides changed, the plugin shows a conflict list (keep local, keep remote, or keep both) and does not overwrite silently.

### 2.21 Auto-create Airtable fields on push (Feature 21)
When pushing, fields that exist locally but not in Airtable are created first, using the matching Airtable field type. The user confirms the list of fields before creation.

## 3. Right-click summary

- **File explorer:** §2.16
- **Table cell, row, and column header:** §2.17
- The file explorer menu uses Obsidian's `file-menu` event.
- The table menu is a custom `contextmenu` handler on the table view, which opens an Obsidian `Menu`. Exact wiring is part of the implementation spec.

## 4. Open items (for later)

- Final file extension (`.tablify` is the proposed name).
- Formula syntax (§2.11).
- Plugin name and ID.
