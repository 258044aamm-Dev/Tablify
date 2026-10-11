# Tablify user guide

Everything in this guide covers the 1.0.0 (MVP) feature set, on desktop and mobile.

## Contents

1. [Creating a table](#1-creating-a-table)
2. [The `.tablify` file format](#2-the-tablify-file-format)
3. [Fields and field types](#3-fields-and-field-types)
4. [Editing cells](#4-editing-cells)
5. [Keyboard use](#5-keyboard-use)
6. [Select options](#6-select-options)
7. [Attachments](#7-attachments)
8. [Validation](#8-validation)
9. [Undo and redo](#9-undo-and-redo)
10. [Filtering and search](#10-filtering-and-search)
11. [View settings: width, order, hide, freeze, sort, row height](#11-view-settings)
12. [Importing CSV and Excel](#12-importing-csv-and-excel)
13. [Exporting CSV, Excel, Markdown](#13-exporting-csv-excel-markdown)
14. [The file-explorer menu](#14-the-file-explorer-menu)
15. [The table context menu](#15-the-table-context-menu)
16. [Mobile: long-press](#16-mobile-long-press)
17. [Troubleshooting](#17-troubleshooting)
18. [Formula and link fields](#18-formula-and-link-fields)

---

## 1. Creating a table

Right-click a folder in the file explorer → **New table**. Tablify creates `Untitled table.tablify` (numbered on collision, e.g. `Untitled table 2.tablify`) and opens it in the grid. A new table has five fields and three empty rows, so you can start typing straight away:

| Field | Type | Notes |
| --- | --- | --- |
| Name | Text | Primary field (frozen on the left) |
| Notes | Long text | |
| Status | Single select | Options: Todo, In progress, Done |
| Due date | Date | |
| Attachments | Attachment | |

Rename, retype, hide or delete any of them as usual. Tables created by **Import** or **Duplicate** keep their own fields and rows.

The primary field cannot be hidden or deleted; it labels each row.

### The title row

The top of every table shows its **name**, the file's **vault path**, and four links:

- **Name**: click it, type, then press **Enter** (or click away) to rename the table *file*, in the same folder. **Esc** cancels. Names cannot be empty, cannot start with `.`, and cannot contain `\ / : * ? " < > | # ^ [ ]`. If a file with that name already exists in the folder, the rename is refused with a notice and the old name stays. Obsidian updates links to the table as usual.
- **Import…**: the same flow as **Import CSV / Excel as table** ([§12](#12-importing-csv-and-excel)).
- **Export…**: saves pending edits, then opens the Export dialog for this table ([§13](#13-exporting-csv-excel-markdown)).
- **Export CSV**: one click, no dialog. Writes the **current view** (visible fields in their order, with the active sort, search and query) as `<name>.csv` next to the table, numbered if that name is taken. Never overwrites.
- **Copy Markdown**: copies the same current view to the clipboard as a Markdown table.

## 2. The `.tablify` file format

A `.tablify` file is pretty-printed JSON with:

- `tableId` — a stable, unique table identifier,
- `fields` — typed column definitions,
- `rows` — each row has a stable `id`, a `rev` (revision, bumped on each edit), `updatedAt`, and its values keyed by field ID,
- `views` — your saved layout (sort, hidden fields, widths, freeze, row height).

Because values are keyed by field ID, **renaming a field never breaks data**. Because the view settings live in the file, your layout travels with the file (sync, backup, share).

Tablify supports **only its own `.tablify` extension** — see the note below.

> **Note:** Tablify does not support `.tabula` files. It never opens, imports, detects, or migrates them.

## 3. Fields and field types

**Add Field** in the toolbar adds a column: give it a name, pick a type, and it appears at the right of the table. Adding a field is a single undo step.

Use the header menu (**Change field type…**) to change a column's type. A type is offered only when **every** existing value converts cleanly — otherwise nothing changes and the menu shows the reason. This protects you from silent data loss.

| Type | Accepts |
|---|---|
| Text | any string |
| Long text | multi-line strings |
| Number | integers or decimals |
| Date | ISO `yyyy-mm-dd` |
| Checkbox | true/false |
| Single select | one option from a list (with optional color) |
| Attachment | references to files in your vault |
| Formula | the result of an expression over other fields in the same row. Read-only (section 18) |
| Link | rows in another table (section 18) |

## 4. Editing cells

- Click a cell to select it; press **Enter** (or double-click) to edit; **Enter** commits, **Escape** cancels; clicking away also commits.
- Paste tab-separated text (e.g. copied from a spreadsheet) with **Ctrl/Cmd+V** — a rectangular range is filled; **Ctrl/Cmd+C** copies the selected range as tab-separated text.

## 5. Keyboard use

The grid handles keys only when the grid has focus. Full table in [docs/shortcuts.md](shortcuts.md):

| Shortcut | Action |
|---|---|
| Arrow keys | Move selection |
| Tab / Shift+Tab | Next / previous cell |
| Enter | Edit cell / commit |
| Escape | Cancel edit |
| Ctrl/Cmd+Z | Undo |
| Ctrl/Cmd+Shift+Z or Ctrl/Cmd+Y | Redo |
| Ctrl/Cmd+C | Copy range (tab-separated) |
| Ctrl/Cmd+V | Paste range |

Accessibility: the grid exposes ARIA grid semantics (`role="grid"`, row/column counts and indices, sorted-column announcement, invalid-cell announcement). Screen-reader results are recorded in [docs/accessibility/audit.md](accessibility/audit.md).

## 6. Select options

Single-select cells open a searchable dropdown:

- Type to filter; **Enter** picks the highlighted option.
- Type a new name and choose **Create** to add the option.
- Rename, recolor, reorder, or delete options from the option manager. Deleting an option that is in use asks for confirmation and **clears those cells** (no dangling references). The rename/delete step is undoable.

## 7. Attachments

Attachment cells reference files **already in your vault** (for example a PDF next to your table). Tablify validates the path and asks for confirmation; it never copies or moves your files.

## 8. Validation

A field can be marked **required** or **unique**; number fields can have a min/max. Invalid cells get a visible marker, `aria-invalid`, and a tooltip explaining the rule (hover or focus the cell). Validation runs on edit and when the file changes on disk.

## 9. Undo and redo

**Ctrl/Cmd+Z** / **Ctrl/Cmd+Shift+Z** (or Ctrl/Cmd+Y). Every local edit is undoable: cell edits, row insert/duplicate/delete, clear, paste, sort, hide, freeze, add field, field-type change. Undo restores deleted rows with their **original row IDs and positions**.

The Search or query box is the exception: it is saved, but it is **not** undoable, so Ctrl/Cmd+Z steps through your edits rather than through your typing. Undo covers local edits only.

## 10. Filtering and search

### The toolbar

Below the title row sits one toolbar row: the **Search or query** box, then **Sync**, **↶** (undo), **↷** (redo), **Filter**, **Add Row**, **Add Field** and **Options**.

- **Sync** opens Airtable sync for this table, the same as the command **Airtable sync for this table** ([sync rules](sync-rules.md)). Below 1280 px window width it shows only its cloud icon.
- **↶ / ↷** are the same as Ctrl/Cmd+Z and Ctrl/Cmd+Shift+Z (§9).
- **Filter** opens the filter builder (below).
- **Add Row** appends an empty row; **Add Field** opens the new-field dialog; **Options** opens view settings (§11).

On a narrow pane the box takes its own line and the buttons scroll sideways beneath it.

### The Search or query box

One box does both jobs. Free words search; `field:value` terms query. They combine: `ship Status:Done` shows the rows that contain "ship" **and** whose Status is Done.

- **Search words**: matched against the visible text of every cell, case-insensitively. For a single-select field this is the option's *label*, not its stored id.
- **Query terms**: the query language ([grammar](query-grammar.md)), e.g. `Status:Done`, `Amount:>100`, `Task:~grid`, `"Estimate (h)":>5`, `Tags:UI,Perf`, `Due:empty`. Quote a field name or value that contains spaces.

Typing is debounced (200 ms). The text is saved in the file's `views` section (the words as the search, the terms as the query), so the filter survives closing and reopening the file. **Options → Clear filters** empties the box.

An invalid term shows the parser's message under the box, with the position counted from the start of the box (e.g. `Expected value after '>' (position 13)`), and the box gets an accent border. While a term is invalid the query part is ignored rather than silently returning nothing; the search words still apply. Free words on their own never cause an error.

A **row count** above the grid shows what the filter is doing: `40 rows` unfiltered, `12 rows (of 40)` when filtering.

### The filter builder

**Filter** opens the same filter as rows of *field · operator · value*, joined by **and**. Every row is exactly one query term, so the builder and the box always agree; the **Equivalent query string** at the bottom shows the text that **Apply filter** will put in the box. Search words in the box are kept as they are.

| Field type | Operators |
|---|---|
| Text, long text, URL, email, phone, attachment | is · contains · is empty |
| Single select | is · is not · is empty |
| Multiple select | contains any of · is empty |
| Checkbox | is (true / false) · is empty |
| Number, currency, percent, duration, rating, auto number | = · > · < · is empty |
| Date, date and time, created time, modified time | is · is after · is before · is empty |

Formula and link fields cannot be filtered and are not listed.

- In an **is** row, separate several values with commas to match any of them (`a, b`). To match a value that itself contains a comma, a quote, or leading/trailing spaces, put it in double quotes and double any quote inside: `"Write docs, draft"`, `"say ""hi"""`. Select fields offer a dropdown of their options instead.
- Rows without a value are skipped. **Clear all** removes every row; **Cancel** (or Esc) leaves the box unchanged.
- Terms the builder cannot show (a field that no longer exists) are kept unchanged and listed at the top. If the box's query part has an error, the builder says so, and **Apply filter** replaces that part.

## 11. View settings

**Options** in the toolbar opens the view-settings panel: row height, frozen columns, hidden fields, and **Clear filters**. Column width and order, hide and sort also live on the header menu and the table menu.

- **Column width** — drag the column edge (120–520 px, stored per field); columns without a stored width are 160 px. When the columns are narrower than the pane, they stretch proportionally to fill it.
- **Column order** — drag a header by its grip, or use the menu to move left/right.
- **Hide field** — from the header menu; the primary field cannot be hidden. Hidden fields are listed in **Options** with a **Show** button each, so a hidden column can always be brought back.
- **Freeze** — freeze the first N columns; they stay pinned on the left while the rest scroll horizontally. A new table starts with its primary column frozen.
- **Sort** — click a header name, or use the menu; the sorted column is announced to screen readers (`aria-sort`).
- **Row height** — small / medium / large.

### Column headers

Each column header is a capsule:

- **Grip** (⠿) — drag it onto another header to move the column there.
- **Key** — marks the primary field.
- **Name** — click to sort by the column: ascending, then descending, then off. **Shift-click** adds the column as another sort key (or flips or removes it) without dropping the others; the arrow then shows the column's position in the sort (↑2). A plain click on a multi-column sort replaces it with that column alone, ascending.
- **Type badge** — the field type, with its icon.
- **⋮** — opens the header menu, the same menu as right-clicking the header.
- **Right edge** — drag to resize.

Sorting, moving and resizing from the header are saved and undoable, like the same actions in the menu. Embedded tables show the header read-only.

Each row starts with a selection slot and its row number. The **Insert Row** pill under the last row adds a row, the same as **Add Row** in the toolbar. The grid is only as tall as its rows, up to the height of the pane, and scrolls inside past that, with the header pinned.

Row height, freeze and unhide are undoable; search and query are not (see §9).

All of it is saved in the file's `views` section and restored on reopen (verified by scenario A11 in the test matrix).

## 12. Importing CSV and Excel

Right-click a folder → **Import CSV / Excel as table**, run the command **Import CSV / Excel as table** from the command palette, or click **Import…** in a table's title row.

- **CSV**: RFC 4180 (quoted fields, CRLF, embedded newlines, BOM handled; delimiter detection).
- **XLSX**: reads the first sheet; dates come in as dates.
- Column types are **inferred** from the values with strict, documented rules (ambiguous values become text rather than a wrong type — see the measured accuracy note in the [changelog](../CHANGELOG.md#known-limitations)).
- The new file opens in the grid; import is atomic — a failure leaves **no partial file**.

## 13. Exporting CSV, Excel, Markdown

Run **Export table (CSV, Excel, Markdown)** from the command palette or the file-explorer menu, or click **Export…** in the table's title row. (**Export CSV** and **Copy Markdown** next to it are one-click shortcuts for the current view; see [the title row](#the-title-row).) The dialog has:

- **Format** — CSV, XLSX, or Markdown.
- **Full table** checkbox — **off (default): export the current view** (your filter, sort, visible fields, column order); **on**: every field and row.

Export writes a new file next to the table (collision-safe naming) and never modifies the table.

## 14. The file-explorer menu

Right-click in the file explorer:

| Target | Items |
|---|---|
| `.tablify` file | Open, Duplicate, Export |
| Folder | New table, Import CSV / Excel as table |
| Other files / vault root | (no items) |

**Duplicate** creates `<name> copy.tablify` with a new table ID but the same rows and revisions.

## 15. The table context menu

Right-click (or **Menu key** / **Shift+F10**) in the grid:

| Target | Items |
|---|---|
| Cell | Copy, Paste, Clear |
| Row | Insert row above, Insert row below, Duplicate row, Copy row, Delete row |
| Header | Change field type…, Hide field, Sort ascending, Sort descending, Freeze |

Disabled items show why they are disabled. Undoable actions are undoable from here too.

## 16. Mobile: long-press

On iOS and Android, **press and hold (~0.5 s)** a row to open the same menu as a desktop right-click. Normal scrolling still works: scrolling, short taps, or moving your finger during the hold never open the menu.

## 17. Troubleshooting

- **"Broken table" file**: if a `.tablify` file contains invalid JSON, Tablify shows an error and **leaves the file unchanged on disk**. Fix the JSON (or restore from backup) and reopen.
- **Imported column came out as text**: type inference is deliberately strict; mixed or ambiguous columns stay text. Change the type from the header menu — it converts only when every value converts cleanly.
- **Table did not reload after I edited the JSON by hand**: close and reopen the view; Tablify re-reads and re-validates the file (schema-validated, `formatVersion: 1`).
- **`.tabula` files**: not supported, on purpose. Tablify ignores them.

---

## 18. Formula and link fields

These two types are new in format version 2. A table that uses one is saved as version 2. Older versions of Tablify cannot open version 2 files, so update the plugin on every device that uses the vault before you add one.

### Formula fields

- Add a field, choose **Formula**, and type an expression. Refer to other fields in the same row with braces, for example `{Price} * {Quantity}`.
- The cell shows the computed value and updates when a field it uses changes. You cannot type into a formula cell. To change it, use **Edit formula…** from the column's header menu.
- If a formula cannot be computed, the cell shows a short code such as `#DIV/0!`, `#NAME?` (unknown field name), or `#CYCLE!` (the formula depends on itself). Hover over the cell to read the reason.
- Formula results are not saved in the file. They are computed when the table opens.
- Dates and times use your local time zone.
- The full list of functions and the rules are in `docs/formula-spec.md`.

### Link fields

- Add a field, choose **Link**, and pick the table it links to. Then open the cell (Enter, double-click, or **Choose linked rows…** in the cell menu) to pick rows in a search list.
- Each linked row appears as a chip in the cell.
- A link stays linked when you rename the other file or its rows. The link is stored by ID, not by name.
- If a linked row is deleted, its chip is dashed and the cell is marked as broken. The link is kept, so you can see what was lost. Uncheck the row in the picker to remove the link.
- To find every broken link in your vault, run **Check link integrity (all tables)** from the command palette.
- Renaming a field does not update formulas that refer to it. They show `#NAME?` until you edit them. Field rename is not built yet.
- Sorting, search and export use the linked row names, joined with commas. A broken link shows as `Missing row`. Export writes names only, so it cannot restore links on import.
- If a link cell holds a link to a table other than its field's target, its menu offers **Remove links to other tables**. To link into a second table, add a second Link field.
- Tablify's own **Duplicate** gives the copy a new ID. Obsidian's file **Duplicate** copies the ID, so the copy is not linked. Its file menu then offers **Give this copy a new table ID** (close the table tab first). Lookups and rollups are not available.

