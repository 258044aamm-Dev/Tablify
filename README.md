# Tablify

Airtable-like tables in Obsidian, stored as `.tablify` files. Works on **desktop and mobile**.

Tablify adds typed, structured tables to your vault: text, numbers, dates, checkboxes, single-select options, attachments and more — with filtering, sorting, frozen columns, undo/redo, keyboard editing, CSV/Excel import and CSV/Excel/Markdown export.

> **Supported file type: `.tablify` only.** Tablify does **not** support `.tabula` files: it never opens, imports, detects, or migrates them.

## Features

- **Typed fields** — text, long text, number, date, checkbox, single select (with color), attachment, plus system fields (row ID, revision, updated at).
- **Grid editing** — spreadsheet-style grid with virtualized rows, so 1,000-row tables stay smooth; click or keyboard navigation; copy/paste ranges as tab-separated text.
- **Filtering and search** — a search box and a query bar (`status:Done amount:>100`) in the toolbar above the grid, with a live row count and inline errors for invalid queries.
- **View settings in the file** — column width, order, hidden fields, frozen columns, row height, and sorting are saved inside the `.tablify` file and travel with it. The **Options** menu changes row height and freeze, and brings hidden columns back.
- **Undo/redo** — every edit is undoable (Ctrl/Cmd+Z / Ctrl/Cmd+Shift+Z).
- **Validation** — required/unique/number-range rules with visible invalid-cell markers.
- **Import** — CSV (RFC 4180, Excel-compatible) and XLSX files become new `.tablify` tables, with type inference.
- **Export** — the current filtered view or the full table, to CSV, XLSX, or Markdown.
- **Context menus** — right-click in the file explorer (new table, import, duplicate, export), right-click in the grid (cell/row/header actions), and long-press on mobile.

## Requirements

- Obsidian **1.14.0** or newer.
- Desktop (Windows, macOS, Linux) and mobile (iOS, Android).

## Installation

### From the Community directory (when approved)

1. Open **Settings → Community plugins**.
2. **Browse** and search for "Tablify".
3. **Install**, then **Enable**.

### Manual installation

1. Download `main.js`, `manifest.json`, and `styles.css` from the [latest release](https://github.com/258044aamm-Dev/Tablify/releases/latest).
2. Put them in `<vault>/.obsidian/plugins/tablify/`.
3. Reload Obsidian and enable **Tablify** under **Settings → Community plugins**.

### With BRAT

1. Install and enable [BRAT](https://github.com/TfTHacker/obsidian42-brat).
2. Run **BRAT: Add a beta plugin for testing** and enter `258044aamm-Dev/Tablify`.

## Getting started

1. Right-click a folder in the file explorer → **New table**. A `.tablify` file opens in the grid with five fields — `Name` (primary text), `Notes` (long text), `Status` (single select: Todo / In progress / Done), `Due date` (date) and `Attachments` — and three empty rows, ready to type into.
2. Double-click (or press Enter on) a cell to edit. Use the header menu to change field types, sort, hide, or freeze columns; the toolbar's **Options** menu sets row height and freeze, and shows hidden columns again.
3. See the [user guide](docs/user-guide.md) for every feature, and the [shortcut table](docs/shortcuts.md) for keyboard use.

## Documentation

- [User guide](docs/user-guide.md) — every MVP feature explained.
- [Keyboard shortcuts](docs/shortcuts.md).
- [Changelog](CHANGELOG.md).

## Known limitations in 1.0.0

See the [changelog](CHANGELOG.md#known-limitations) for the current, measured list.

## Data and privacy

Tables are plain JSON files in your vault. Tablify makes **no network requests** and collects nothing. Attachment fields only reference files already in your vault.

## License

[MIT](LICENSE) © MD Limon Islam. Bundled fonts (Poppins, Lora) are under the SIL Open Font License — see [LICENSE-FONTS](LICENSE-FONTS). The title-row, toolbar and filter-builder icons are [Font Awesome Free](https://fontawesome.com) 6.4.0 glyphs (© Fonticons, Inc.), licensed [CC BY 4.0](https://fontawesome.com/license/free).

## Formulas and linked records (format version 2)

- **Formula** fields compute a value from other fields in the same row. The language is in [`docs/formula-spec.md`](docs/formula-spec.md). Formula results are not saved in the file.
- **Link** fields point at rows in other tables, by table ID and row ID. A link survives renaming a file or a row. A link to a deleted row is shown as broken, and the saved value is kept. Run **Check link integrity (all tables)** to list broken links.
- A table that uses a formula or link field is saved as **format version 2**. A table without them is saved as version 1, as before.
- **Update before you use them.** Versions of Tablify released before Phase 8 refuse to open a version 2 file ("Unsupported formatVersion") and never write to it. Update the plugin on every device that uses the vault before adding a formula or link field.
- **Limits.** Copying a file with Obsidian's own Duplicate keeps its table ID, so links keep pointing at the original, and the integrity check reports the duplicate. Lookups and rollups are not included.

## Airtable sync (v1.1, optional)

Sync is optional. Tablify works fully offline when it is not configured.

1. Create an Airtable personal access token. Grant these scopes: `data.records:read`, `data.records:write`, and `schema.bases:read`.
2. Add `schema.bases:write` only if you want Tablify to create missing fields in Airtable. Without it, field creation fails with a clear message and nothing is created.
3. In Tablify settings, paste the token under **Airtable sync**. It is stored in the plugin's settings only. It is never written to a `.tablify` file, an export, or a log.
4. Open a `.tablify` table and run the command **Airtable sync for this table**. Link it to a base and table, then pull or push.

Conflicts (a row changed both here and in Airtable) are never overwritten silently. You choose keep local, keep remote, or keep both. Deleting records in Airtable never removes rows here without your choice.
