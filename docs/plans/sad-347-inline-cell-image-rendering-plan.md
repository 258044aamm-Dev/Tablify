# SAD-347 — Inline per-cell image rendering mechanism

**Issue:** [SAD-347](https://linear.app/sad-mod/issue/SAD-347/inline-per-cell-image-rendering-mechanism) · priority **2** · labels *Improvement*, *Feature*  
**Project:** Tablify · **Branch:** `main` (`563e78d`)  
**Plan date:** 2026-10-20 · **Status:** Planned (awaiting implementation sign-off)

---

## 0. TL;DR — what ships

| Concern | Decision |
|---|---|
| **Scope** | Existing `attachment` fields render inline image thumbnails when the stored path or URL points to an image (`.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.avif`, `.ico`, or `data:image/*`). Non-image attachments (`.pdf`, `.csv`, `.docx`, etc.) keep the existing paperclip chip unchanged. |
| **Storage & format** | **Zero schema or `formatVersion` change.** Cells still store a vault-relative path string (`"Assets/photo.png"`) or legacy path array. Existing `.tablify` files open and save byte-identically. |
| **Cell visual layout** | **Thumbnail + filename chip** (`.tablify__chip--file.tablify__chip--image`) inside `.tablify__cell--attachment`. The capsule trades vertical padding (2px on medium/large, 1px on small — the same rule `.tablify__cell--select` and `.tablify__cell--long-text` use) so crisp rounded thumbnails (`16px` small / `20px` medium / `26px` large) fit inside the existing `28px` / `34px` / `40px` capsules without changing row pitch (`44px` / `50px` / `56px`) or virtual-scroll math. |
| **Text contract** | The filename text node stays inside the chip and the `<img>` / `<svg>` carries no text content, so `cell.textContent` and `chip.textContent` remain 100% identical to today (`"Assets/photo.png"`). |
| **Interaction & preview** | 1. **Cell thumbnail click:** Clicking the inline thumbnail opens a themed **Image Lightbox (`ImagePreviewModal`)** (`stopPropagation`, so it does not trigger cell edit or move selection).<br>2. **Rest of cell:** Clicking the filename or cell body selects the cell; **Enter** / double-click / touch re-tap opens `AttachmentPanel` as today.<br>3. **`AttachmentPanel` preview:** Shows a thumbnail in the attachment row plus a larger preview card inside the panel; clicking the preview opens the lightbox. |
| **Missing / broken fallback** | If a vault image path does not exist in `app.vault`, or if `<img>` fires `error` at runtime, the chip cleanly falls back to the standard **paperclip icon + filename chip** (`.tablify__chip--file`). No broken browser image icon ever appears. |
| **Embeds** | `EmbedView` (` ```tablify ` code blocks in notes) wires the same vault resource resolver and lightbox preview. |
| **Dependencies** | **None added.** |

### Owner decisions recorded (2026-10-20)

| # | Question | Owner Answer |
|---|---|---|
| 1 | Where should inline per-cell images be rendered? | **Existing `attachment` fields** when the stored path/URL is an image; non-image attachments stay paperclip chips. No schema change. |
| 2 | How should the inline image be displayed inside the cell capsule? | **Best option selected:** Thumbnail + filename chip scaled to fit existing Small (`28px`), Medium (`34px`), and Large (`40px`) capsule heights — zero impact on virtual-row math, row pitch, or `cell.textContent` contracts. |
| 3 | What interaction or preview behavior is wanted? | **Click thumbnail for lightbox + preview in `AttachmentPanel`**, while clicking the rest of the cell selects/edits normally. |
| 4 | How should missing vault images or failed loads behave? | **Fall back to standard paperclip chip** so the cell never looks broken or loses its text. |

---

## 1. What the codebase does today (verified, not guessed)

### 1.1 Every path an `attachment` value travels

| Layer | File & lines | Current verified behaviour | Impact of SAD-347 |
|---|---|---|---|
| Data model & validation | `src/model/fieldTypes/attachment.ts:1-28` | `validate` accepts `string \| null`; `parse` trims (`'' → null`); `format` returns `''` or `String(value)`. | **Untouched** |
| File format & schema | `FORMAT_SPEC.md:149`, `tablify.schema.json` | `attachment` cell value is `string \| null` (legacy arrays tolerated by readers). | **Untouched** |
| Path check & normalisation | `src/views/grid/attachment.ts:5-38` | `normalizeAttachmentPath` normalises slashes/trim; `checkAttachmentPath` checks `vault.getAbstractFileByPath(path) !== null`. | Extended with pure image-extension check & resource URL resolver |
| Cell DOM rendering | `src/views/grid/cellRender.ts:330-352` | `attachmentPaths(value)` returns `string[]`; `renderAttachmentChips(host, value)` builds `<span class="tablify__chip tablify__chip--file" title="…">` with `faIcon('paperclip', 9)` + path text. | Extended with optional `AttachmentChipOptions` (`resolveUrl`, `onPreview`) |
| Grid cell dispatch | `src/views/grid/GridView.ts:1450-1452` | Calls `renderAttachmentChips(text, val)` when `field.type === 'attachment'`. | Adds `tablify__cell--attachment` class and forwards `resolveAttachmentUrl` / `onPreviewAttachment` |
| Virtual row math | `src/views/grid/virtual.ts:18-48` | Fixed capsule height (`28` / `34` / `40` px) + `16px` chrome = `44` / `50` / `56` px pitch. `RowPool` recycles row DOM nodes. | **Untouched** — thumbnails fit inside fixed capsule heights |
| Attachment panel | `src/views/grid/AttachmentPanel.ts:45-207` | `#floatPanel` card (`320px`) showing `.tablify__attach-row` items, path input, vault warning + `"Save anyway"`. | Extended to render image preview & row thumbnail when `resolveUrl` returns an image URL |
| TableView host wiring | `src/views/tableView.ts:650-710, 1601-1622` | Constructs `GridView` and opens `AttachmentPanel` on cell edit (`Enter` / `dblclick` / touch reselect). | Wires vault `resolveAttachmentImageUrl` and `ImagePreviewModal` into `GridView` and `AttachmentPanel` |
| Note embed view | `src/embed/embedView.ts:176-235`, `src/embed/register.ts:62-75` | Mounts `GridView` inside markdown notes (`320px` height). | Wires `resolveAttachmentUrl` and `onPreviewAttachment` so embeds render inline images too |
| Copy / Export / Search / Sort / Query / Sync | `src/io/export/*`, `src/model/rowFilter.ts`, `src/query/evaluate.ts:153`, `src/sync/*` | All read `row.values[field.id]` or `attachmentType.format()`. | **Zero diff** |

### 1.2 Existing tests that pin attachment & capsule behaviour

| Test file | What it asserts | How SAD-347 keeps it green |
|---|---|---|
| `tests/views/grid/attachment.test.ts:1-55` | `normalizeAttachmentPath`, `checkAttachmentPath`, `confirmAttachmentSave` | Existing functions keep exact signatures and return types |
| `tests/views/grid/cellFormatting.test.ts:534-565` | `.tablify__chip--file` count, `chips.map(c => c.textContent)` equals `['Files/brief.pdf', 'Files/data.csv']`, `.tablify__chip-icon` exists, `textOf(grid, 'f_attach')` equals `'Files/brief.pdf Files/data.csv'` | Chips keep `.tablify__chip--file`, keep `.tablify__chip-icon` (hidden when `<img>` is active, visible on fallback), and `<img>` has empty `textContent` so `chip.textContent` and `textOf` are unchanged |
| `tests/views/grid/selectPanels.test.ts:199-248, 349-375` | `AttachmentPanel` header `'Attachments'`, `.tablify__attach-path`, remove button, missing-file warning + `'Save anyway'`, host `TableView` Enter key opens `[data-testid="tablify-attachment-panel"]` | Panel keeps all existing classes, `testid`s, and focus rules; preview elements are additive when `resolveUrl` resolves an image |
| `tests/e2e/fieldTypes.browser.ts:563-572` | `attachment: one paperclip chip per file` (`Files/brief.pdf`) | `.pdf` is not an image, so it renders the exact paperclip chip; new image check added alongside it |
| `tests/ui/rowHeightSmall.test.ts:27-43` | `.tablify--rh-small .tablify__capsule` has `height: 28px` and `padding: 4px 14px`; medium `34px`; large `40px` | Base capsule rules are untouched; `.tablify__cell--attachment > .tablify__capsule` is a separate selector, matching `.tablify__cell--select > .tablify__capsule` |
| `tests/ui/formControlSpecificity.test.ts:1-142` | Every `input`/`select`/`textarea` rule and listed button class is element-qualified inside `.tablify` | All new CSS button/control selectors follow `.tablify button.tablify__*` |
| `tests/ui/tokensNoObsidianVars.test.ts:1-102` | No element in the grid uses non-`--tablify-*` CSS variables | All new styles use `--tablify-*` tokens only |
| `tests/ui/axeGrid.test.ts:1-71` | Zero critical/serious axe-core violations on `GridView` | Every `<img>` has a meaningful `alt` attribute and interactive thumbnail buttons have `aria-label` |

### 1.3 Baseline measurements (verified on this clone, 2026-10-20)

| Check | Baseline |
|---|---|
| `npm run lint` | **0 errors, 119 warnings** |
| `npm run build` → `main.js` | **1,168,730 B** raw · **264,884 B** gzip |
| `styles.css` | **332,244 B** |
| Targeted attachment & formatting tests | **3 files / 66 tests passing** (`attachment.test.ts`, `cellFormatting.test.ts`, `selectPanels.test.ts`) |

---

## 2. Architecture & Technical Design

### 2.1 Image path detection & Obsidian resource resolution (`src/views/grid/attachment.ts`)

Obsidian stores files inside the user's vault and exposes `vault.getResourcePath(file: TFile): string` (as well as `vault.adapter.getResourcePath(normalizedPath: string): string`, verified in `node_modules/obsidian/obsidian.d.ts:3305, 10305`) to convert a vault file into an `app://...` or `capacitor://...` URI that Chromium/WebView `<img>` tags can load directly.

```ts
/** Supported raster and vector image extensions for inline cell rendering (SAD-347). */
export const IMAGE_EXTENSIONS: ReadonlySet<string> = new Set([
  'png', 'jpg', 'jpeg', 'gif', 'webp', 'svg', 'bmp', 'avif', 'ico',
]);

/**
 * True when `rawPath` is a `data:image/*` URI or has a supported image file extension
 * (ignoring query strings and hash fragments on URLs).
 */
export function isImageAttachmentPath(rawPath: string): boolean {
  const trimmed = rawPath.trim();
  if (!trimmed) return false;
  if (/^data:image\/(png|jpe?g|gif|webp|bmp|avif|svg\+xml|x-icon)[;,]/i.test(trimmed)) {
    return true;
  }
  const clean = trimmed.split(/[?#]/, 1)[0] ?? '';
  const dot = clean.lastIndexOf('.');
  if (dot < 0 || dot === clean.length - 1) return false;
  const ext = clean.slice(dot + 1).toLowerCase();
  return IMAGE_EXTENSIONS.has(ext);
}
```

**Resolution contract (`resolveAttachmentImageUrl(raw: string, vault?: VaultLike): string | null`):**

1. Trim `raw`. If `!isImageAttachmentPath(raw)`, return `null`.
2. If `raw` is a `data:image/...` URI or an `https?://` URL with an image extension, return `raw.trim()`.
3. Normalize `const path = normalizeAttachmentPath(raw)`. If `!path` or `!vault`, return `null`.
4. Query `const file = vault.getAbstractFileByPath(path)`.
   - If `file === null` or `file === undefined`, return `null` (file does not exist in vault → cell renders paperclip chip).
   - If `typeof file === 'object' && file !== null && 'children' in file`, return `null` (it is a `TFolder`, not a file).
5. Resolve resource URL:
   - If `typeof vault.getResourcePath === 'function'`, call `vault.getResourcePath(file)` and return if non-empty.
   - Else if `typeof vault.adapter?.getResourcePath === 'function'`, call `vault.adapter.getResourcePath(path)` and return if non-empty.
   - Otherwise return `null`.

```ts
export interface VaultLike {
  getAbstractFileByPath(path: string): unknown | null;
  /** SAD-347: Obsidian Vault.getResourcePath(file: TFile) -> browser resource URI. */
  getResourcePath?(file: unknown): string | null;
  /** SAD-347: fallback to DataAdapter.getResourcePath(normalizedPath). */
  adapter?: {
    getResourcePath?(normalizedPath: string): string | null;
  };
}
```

Because `getResourcePath` and `adapter` are optional on `VaultLike`, every existing test mock (`{ getAbstractFileByPath: ... }`) continues to type-check without modification.

---

### 2.2 Inline cell DOM & visual layout (`src/views/grid/cellRender.ts`, `styles.css`)

#### Why Thumbnail + Filename inside `.tablify__chip--file` is the right architecture

```
┌─ .tablify__capsule (height: 28px small / 34px medium / 40px large) ──────────┐
│  ┌─ .tablify__chip.tablify__chip--file.tablify__chip--image ──────────────┐  │
│  │  [🖼 20×20]  Assets/photo.png                                           │  │
│  └────────────────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────────────────┘
```

1. **Zero virtual-scroll impact:** `GridView` and `virtual.ts` rely on uniform row heights (`rowHeightPx`: `44px` small, `50px` medium, `56px` large). By trading vertical capsule padding on `.tablify__cell--attachment > .tablify__capsule` (identical to `.tablify__cell--select` and `.tablify__cell--long-text`), the chip grows gracefully to hold a crisp thumbnail (`16×16` in small, `20×20` in medium, `26×26` in large) without changing row height by a single pixel.
2. **Zero text-contract breakage:**
   - `chip.textContent` remains `path` (`"Assets/photo.png"`).
   - `.tablify__cell-text`'s `textContent` remains `paths.join(' ')`.
   - Screen readers and test harnesses reading `cell.textContent` see the exact same file path string as before.
3. **Multi-attachment support:** Legacy array values (e.g. `['Assets/a.png', 'Files/spec.pdf']`) render an image chip for `Assets/a.png` and a paperclip chip for `Files/spec.pdf` side by side in the same cell.

#### DOM structure built by `renderAttachmentChips`

```ts
export interface AttachmentChipOptions {
  /**
   * SAD-347: resolve a stored path to a browser-renderable image URL when the path is an image
   * that exists in the vault (or is a direct image URL). Return null for non-images or missing
   * files so the chip renders the standard paperclip icon.
   */
  resolveUrl?: (path: string) => string | null;
  /**
   * SAD-347: called when the user clicks the inline image thumbnail in a chip. The thumbnail
   * owns its click (`stopPropagation`), like the checkbox and contact link, so clicking the
   * thumbnail opens the lightbox without moving cell selection or opening the cell editor.
   */
  onPreview?: (path: string, url: string) => void;
}

export function renderAttachmentChips(
  host: HTMLElement,
  value: CellValue | undefined,
  options: AttachmentChipOptions = {},
): void
```

For each `path` in `attachmentPaths(value)`:
- Create `<span class="tablify__chip tablify__chip--file" title="${path}">`.
- Create `<span class="tablify__chip-icon">${faIcon('paperclip', 9)}</span>`.
- Compute `const imageUrl = isImageAttachmentPath(path) ? (options.resolveUrl?.(path) ?? null) : null`.
- **If `imageUrl` is non-null:**
  - Add class `tablify__chip--image` to `chip`.
  - Set `icon.hidden = true` (kept in the DOM so both `.tablify__chip-icon` queries and runtime `onerror` fallback work instantaneously).
  - Build the thumbnail container:
    - When `options.onPreview` is provided: `<button type="button" class="tablify__chip-thumb-btn" aria-label="Preview ${path}" title="Preview ${path}">`
      - `click` listener: `e.stopPropagation(); e.preventDefault(); options.onPreview(path, imageUrl);`
      - `dblclick` listener: `e.stopPropagation();` (so double-clicking the thumbnail does not also open the editor after opening the lightbox)
      - `keydown` listener: `if (e.key === 'Enter' || e.key === ' ') e.stopPropagation();`
    - When `options.onPreview` is omitted: `<span class="tablify__chip-thumb-wrap">`
  - Inside the container, create `<img class="tablify__chip-thumb" src="${imageUrl}" alt="${fileNameOf(path)}" loading="lazy" decoding="async" draggable="false" />`.
  - Wire runtime fallback on `img`:
    ```ts
    img.addEventListener('error', () => {
      chip.classList.remove('tablify__chip--image');
      thumbEl.remove();
      icon.hidden = false;
    });
    ```
  - Append `thumbEl`, `icon`, and `document.createTextNode(path)` to `chip`.
- **If `imageUrl` is null:**
  - Append `icon` and `document.createTextNode(path)` to `chip` (byte-for-byte identical to today).

---

### 2.3 Lightbox Modal (`src/views/grid/ImagePreviewModal.ts`)

When the user clicks an inline thumbnail in a cell (or clicks the image preview inside `AttachmentPanel`), `ImagePreviewModal` opens a themed modal card on `document.body`:

```
┌──────────────────────────────────────────────────────────┐
│  📎  photo.png                  Assets/photo.png      ✕  │  ← header (.tablify__lightbox-head)
├──────────────────────────────────────────────────────────┤
│                                                          │
│              ┌────────────────────────────┐              │
│              │                            │              │
│              │       [Full Image]         │              │  ← stage (.tablify__lightbox-stage)
│              │                            │              │
│              └────────────────────────────┘              │
│                                                          │
└──────────────────────────────────────────────────────────┘
```

**Key properties of `ImagePreviewModal`:**
- Uses `applyTheme(backdrop, theme)` from `src/ui/theme/tokens.js` so it works identically in `TableView`, `EmbedView`, and standalone unit tests without depending on Obsidian's `Modal` class or host CSS variables.
- Attributes:
  - Backdrop: `class="tablify tablify__lightbox-backdrop"`, `data-testid="tablify-image-lightbox"`, `role="dialog"`, `aria-modal="true"`, `aria-label="Image preview: ${path}"`.
  - Card: `class="tablify__pmodal tablify__lightbox-card"`.
  - Header: file basename (`Poppins 13px 600`), full vault-relative path (`JetBrains Mono 11px muted`), and close button `<button type="button" class="tablify__lightbox-close" aria-label="Close image preview">${faIcon('xmark', 12)}</button>`.
  - Stage: `.tablify__lightbox-stage` containing `<img class="tablify__lightbox-img" src="${url}" alt="${path}" />`.
  - Error fallback: if `img` fires `error`, hides `img` and reveals `.tablify__lightbox-fallback` (`"Unable to load image: ${path}"`).
- **Dismissal & event isolation:**
  - Closes on clicking the backdrop outside `.tablify__lightbox-card`, clicking `.tablify__lightbox-close`, or pressing `Escape`.
  - Crucial detail: the `keydown` (`Escape`) and `mousedown`/`touchstart` listeners on the lightbox use capture / `stopImmediatePropagation()` when closing the lightbox so that if the user opened the lightbox *from inside an open `AttachmentPanel`*, pressing `Escape` or clicking the lightbox closes **only the lightbox** and leaves `AttachmentPanel` open underneath!
  - Singleton safety: opening a new `ImagePreviewModal` automatically closes any existing open `[data-testid="tablify-image-lightbox"]` first.
  - Focus management: focuses the close button on open and restores focus to `document.activeElement` (the cell, grid, or panel) on close.

---

### 2.4 Image preview inside `AttachmentPanel` (`src/views/grid/AttachmentPanel.ts`)

`AttachmentPanelOptions` is extended with two optional callbacks:

```ts
export interface AttachmentPanelOptions {
  field: FieldDefinition;
  value?: CellValue;
  onAdd: (path: string) => void;
  onRemove: (index: number) => void;
  checkPath?: (raw: string) => AttachmentSaveResult;
  /** SAD-347: resolve a vault path or URL to a browser image URL, or null if not a valid image. */
  resolveUrl?: (path: string) => string | null;
  /** SAD-347: open the full-size lightbox for a resolved image. */
  onPreviewImage?: (path: string, url: string) => void;
  onDismiss?: () => void;
  theme?: 'light' | 'dark';
}
```

When `AttachmentPanel.render()` runs for each `path` in `this.paths()`:
1. Compute `const imageUrl = isImageAttachmentPath(path) ? (this.opts.resolveUrl?.(path) ?? null) : null`.
2. **In `.tablify__attach-row`:**
   - If `imageUrl` is non-null, prepend a `24 × 24 px` rounded thumbnail `<img class="tablify__attach-row-thumb" src="${imageUrl}" alt="${path}" />` before `.tablify__attach-path` (with an `error` listener that removes the thumbnail if loading fails).
3. **Preview banner (`.tablify__attach-preview`):**
   - For the primary image attachment with a valid `imageUrl`, render a preview container `.tablify__attach-preview` (with `data-testid="tablify-attachment-preview"`) inside `.tablify__attach-list` above the row:
     - Shows `<img class="tablify__attach-preview-img" src="${imageUrl}" alt="${path}" />` (`max-height: 128px; max-width: 100%; object-fit: contain; border-radius: 8px`).
     - Clicking `.tablify__attach-preview` calls `this.opts.onPreviewImage?.(path, imageUrl)` (or opens `ImagePreviewModal` directly if `onPreviewImage` is not supplied).
     - If the preview `<img>` fires `error`, `.tablify__attach-preview` removes itself cleanly so no broken image is shown.
4. **Resting focus:** `this.input.focus()` at the end of `render()` is preserved unchanged so typing a new path and pressing `Enter` works identically to today.

---

### 2.5 Host Wiring (`GridView`, `TableView`, `EmbedView`, `register.ts`)

1. **`src/views/grid/GridView.ts`**:
   - Add to `GridOptions`:
     ```ts
     /** SAD-347: resolve an attachment path to a renderable image URL (null for non-images/missing). */
     resolveAttachmentUrl?: (path: string) => string | null;
     /** SAD-347: open the image lightbox when an inline attachment thumbnail is clicked. */
     onPreviewAttachment?: (path: string, url: string) => void;
     ```
   - In `fillRow()` (`GridView.ts:1450-1452`):
     ```ts
     } else if (field.type === 'attachment') {
       // COD-73 / SAD-347: one chip per file, with an inline thumbnail when the file is an image.
       cell.classList.add('tablify__cell--attachment');
       renderAttachmentChips(text, val, {
         resolveUrl: this.opts.resolveAttachmentUrl,
         onPreview: this.opts.onPreviewAttachment,
       });
     ```
2. **`src/views/tableView.ts`**:
   - Helper method `resolveAttachmentUrl(raw: string): string | null`:
     `return resolveAttachmentImageUrl(raw, this.app.vault);`
   - Helper method `openImagePreview(path: string, url: string): void`:
     `new ImagePreviewModal({ path, url, theme: this.isDark() ? 'dark' : 'light' }).open();`
   - Pass `resolveAttachmentUrl: (p) => this.resolveAttachmentUrl(p)` and `onPreviewAttachment: (p, url) => this.openImagePreview(p, url)` to `new GridView(...)`.
   - Pass `resolveUrl: (p) => this.resolveAttachmentUrl(p)` and `onPreviewImage: (p, url) => this.openImagePreview(p, url)` to `new AttachmentPanel(...)` in `openCellPanel()`.
3. **`src/embed/embedView.ts` & `src/embed/register.ts`**:
   - Add `resolveAttachmentUrl?: (path: string) => string | null` to `EmbedViewOptions`.
   - In `EmbedView.ensureGrid()`, pass `resolveAttachmentUrl: this.opts.resolveAttachmentUrl` and `onPreviewAttachment: (path, url) => new ImagePreviewModal({ path, url, theme: this.theme() }).open()`.
   - In `src/embed/register.ts`, pass `resolveAttachmentUrl: (p) => resolveAttachmentImageUrl(p, app.vault)` to `new EmbedView(...)`.

---

## 3. Explicit "Do Not Touch" List (Zero-Regression Guarantee)

To guarantee that SAD-347 has **zero unintended side effects** on existing features:

| Subsystem | Files | Why it is unaffected |
|---|---|---|
| `.tablify` file format & serialization | `src/format/parse.ts`, `src/format/serialize.ts`, `tablify.schema.json`, `FORMAT_SPEC.md` | **Zero diff.** Attachment values remain `string \| null`. |
| Field type registry & `attachmentType` | `src/model/fieldTypes/attachment.ts`, `src/model/fieldTypes/registry.ts` | **Zero diff.** `validate`, `parse`, `format`, `defaultValue` are untouched. |
| Virtual row math & row pooling | `src/views/grid/virtual.ts`, `src/views/grid/rowPool.ts` | **Zero diff.** Row heights (`44` / `50` / `56` px) and capsule heights (`28` / `34` / `40` px) do not change. |
| Selection, keyboard nav & cell editing | `src/views/tableController.ts`, `src/views/grid/keyboard.ts`, `src/views/grid/selection.ts` | **Zero diff.** Thumbnail click calls `stopPropagation()` (same pattern as checkbox and URL/phone links); cell click, double-click, and `Enter` behave identically. |
| Undo / Redo & Command stack | `src/model/commands.ts`, `src/model/tableSession.ts`, `src/model/tableStore.ts` | **Zero diff.** Previewing an image is read-only and never mutates the store or command stack. |
| Search, Query, Sort, Grouping | `src/model/rowFilter.ts`, `src/query/*`, `src/model/viewOrder.ts`, `src/views/grid/grouping.ts` | **Zero diff.** All operate on model values. |
| CSV / XLSX / Markdown Import & Export | `src/io/import/*`, `src/io/export/*`, `src/io/infer.ts` | **Zero diff.** Export continues to write the vault-relative path string. |
| Airtable Sync | `src/sync/*` | **Zero diff.** |
| Theme tokens & contrast ladder | `src/ui/theme/tokens.ts`, `src/ui/theme/contrast.ts` | **Zero diff.** Uses existing `--tablify-*` CSS variables only. |

---

## 4. File-by-File Implementation Plan (3 Commits)

### Commit 1 — Image detection, vault resource resolution & inline cell thumbnail rendering

`SAD-347: render inline image thumbnails in attachment cells with paperclip fallback`

| # | File | Change |
|---|---|---|
| 1 | `src/views/grid/attachment.ts` | Add `IMAGE_EXTENSIONS`, `isImageAttachmentPath(rawPath)`, `resolveAttachmentImageUrl(rawPath, vault?)`; extend `VaultLike` with optional `getResourcePath` and `adapter.getResourcePath`. |
| 2 | `src/views/grid/cellRender.ts` | Add `AttachmentChipOptions` (`resolveUrl`, `onPreview`); update `renderAttachmentChips(host, value, options?)` to render `.tablify__chip--image` with `<img class="tablify__chip-thumb">`, interactive `.tablify__chip-thumb-btn` when `onPreview` is wired, hidden `.tablify__chip-icon`, and automatic `error` event fallback to the paperclip chip. |
| 3 | `src/views/grid/GridView.ts` | Add `resolveAttachmentUrl` and `onPreviewAttachment` to `GridOptions`; add `tablify__cell--attachment` class on attachment cells in `fillRow()` and pass the options into `renderAttachmentChips`. |
| 4 | `styles.css` | Add `.tablify__cell--attachment > .tablify__capsule` padding adjustment (matching `.tablify__cell--select`), `.tablify__chip--image`, `.tablify button.tablify__chip-thumb-btn` (scoped per `formControlSpecificity.test.ts`), and `.tablify__chip-thumb` sizing for default (`20px`), `.tablify--rh-small` (`16px`), and `.tablify--rh-large` (`26px`). |
| 5 | `tests/__mocks__/obsidian.ts` | Add `getResourcePath: (file: TFile): string => \`app://local/\${file.path}\`` to `App.vault` so `TableView` and `EmbedView` tests resolve vault `TFile` images out of the box. |
| 6 | `tests/views/grid/attachment.test.ts` | Add unit tests for `isImageAttachmentPath` (all image extensions, uppercase, query/hash, non-images, data URIs) and `resolveAttachmentImageUrl` (existing vault image via `getResourcePath` and `adapter.getResourcePath`, missing vault file → `null`, folder → `null`, non-image → `null`, `https://` image URL). |
| 7 | `tests/views/grid/cellFormatting.test.ts` | Add jsdom tests for inline image rendering in attachment cells: image path with `resolveAttachmentUrl` renders `<img class="tablify__chip-thumb">`, preserves `chip.textContent` and `cell.textContent`, mixed `[image, pdf]` list renders one image chip and one paperclip chip, missing vault file renders paperclip chip, and firing `error` on `<img>` reverts the chip to the paperclip icon. |

### Commit 2 — Image Lightbox modal, `AttachmentPanel` preview & host wiring (`TableView` + `EmbedView`)

`SAD-347: add image lightbox preview, attachment panel preview, and host wiring`

| # | File | Change |
|---|---|---|
| 1 | `src/views/grid/ImagePreviewModal.ts` *(new, ~135 lines)* | Themed lightbox dialog (`[data-testid="tablify-image-lightbox"]`): header with filename, mono path, and close button; centered full-size `<img>`; graceful error fallback message; backdrop click, close button, and `Escape` dismissal (isolated from underlying panels); focus restoration. |
| 2 | `src/views/grid/AttachmentPanel.ts` | Extend `AttachmentPanelOptions` with `resolveUrl` and `onPreviewImage`; render `.tablify__attach-preview` card and `.tablify__attach-row-thumb` when an attachment path resolves to an image URL; wire click to open lightbox and `onerror` to hide broken previews cleanly. |
| 3 | `src/views/tableView.ts` | Wire `resolveAttachmentUrl` and `onPreviewAttachment` into `GridView`, and `resolveUrl` / `onPreviewImage` into `AttachmentPanel`. |
| 4 | `src/embed/embedView.ts` | Add `resolveAttachmentUrl` to `EmbedViewOptions`; wire `resolveAttachmentUrl` and `onPreviewAttachment` into the embed's `GridView`. |
| 5 | `src/embed/register.ts` | Pass `resolveAttachmentUrl: (p) => resolveAttachmentImageUrl(p, app.vault)` to `new EmbedView(...)`. |
| 6 | `styles.css` | Add styles for `.tablify__attach-preview`, `.tablify__attach-preview-img`, `.tablify__attach-row-thumb`, and `.tablify__lightbox-*` (all button selectors scoped as `.tablify button.tablify__*`, all colors using `--tablify-*` tokens). |
| 7 | `tests/views/grid/attachmentImagePreview.test.ts` *(new)* | End-to-end jsdom tests for:<br>• clicking `.tablify__chip-thumb-btn` in `GridView` / `TableView` opens `[data-testid="tablify-image-lightbox"]` without starting cell edit;<br>• pressing `Escape` or clicking backdrop closes the lightbox and returns focus;<br>• `AttachmentPanel` shows `.tablify__attach-preview` and `.tablify__attach-row-thumb` for an existing vault image, and hides them for `.pdf` or missing files;<br>• clicking the preview inside `AttachmentPanel` opens the lightbox, and pressing `Escape` closes the lightbox while keeping `AttachmentPanel` open;<br>• `EmbedView` renders inline image thumbnails and opens the lightbox on thumbnail click. |

### Commit 3 — Documentation, changelog & verification evidence

`SAD-347: document inline attachment image previews in user guide, changelog, and evidence`

| # | File | Change |
|---|---|---|
| 1 | `docs/user-guide.md` | Update §3 ("What a cell shows" — Attachment bullet) and §7 ("Attachments") to describe inline image thumbnails, clicking a thumbnail to open the preview, and automatic paperclip fallback for non-image or missing files. |
| 2 | `CHANGELOG.md` | Add `SAD-347` entry under `## [Unreleased]` describing inline image rendering in Attachment cells, `AttachmentPanel` previews, and the click-to-preview lightbox. |
| 3 | `docs/evidence/SAD-347.md` *(new)* | Record commit hashes, gate results, test counts, bundle sizes before/after, and verification matrix. |
| 4 | `docs/plans/sad-347-inline-cell-image-rendering-plan.md` | Update status to implemented. |

---

## 5. Test & Verification Plan

### 5.1 Unit & Integration Tests (`vitest`)

| Test suite | Scenarios covered |
|---|---|
| `tests/views/grid/attachment.test.ts` | • `isImageAttachmentPath`: `.png`, `.jpg`, `.jpeg`, `.gif`, `.webp`, `.svg`, `.bmp`, `.avif`, `.ico` (lower & uppercase), URL query/hash stripping (`https://example.com/a.png?w=100#top`), `data:image/png;base64,...`, rejection of `.pdf`, `.csv`, `.txt`, extensionless paths, empty strings.<br>• `resolveAttachmentImageUrl`: resolves existing `TFile` via `vault.getResourcePath`, falls back to `vault.adapter.getResourcePath`, returns `null` when file is missing in vault, returns `null` when path is a `TFolder`, returns `null` for `.pdf` even when file exists in vault, passes through `https://` image URLs and `data:image/*` URIs. |
| `tests/views/grid/cellFormatting.test.ts` | • Attachment cell with image path + `resolveAttachmentUrl` renders `.tablify__chip--file.tablify__chip--image` with `<img class="tablify__chip-thumb">`.<br>• `chip.textContent` and `cell.textContent` still equal the path string.<br>• Row height classes (`.tablify--rh-small`, default medium, `.tablify--rh-large`) keep `.tablify__cell--attachment` markup intact.<br>• Legacy array `['Assets/pic.png', 'Docs/readme.pdf']` renders an image thumbnail chip for the first and a paperclip chip for the second.<br>• Missing file (`resolveAttachmentUrl` returns `null`) renders standard paperclip chip.<br>• Runtime `error` event on `<img class="tablify__chip-thumb">` strips `--image`, removes the broken `<img>`, and reveals `.tablify__chip-icon` (paperclip). |
| `tests/views/grid/attachmentImagePreview.test.ts` *(new)* | • Clicking `.tablify__chip-thumb-btn` opens `ImagePreviewModal` (`[data-testid="tablify-image-lightbox"]`) with the resolved `src` and path caption, and does **not** open `AttachmentPanel` or an inline editor.<br>• Clicking the filename text (outside the thumbnail button) selects the cell without opening the lightbox.<br>• `ImagePreviewModal` closes on `Escape`, close button click, and backdrop click; handles `<img>` load error with fallback message.<br>• `AttachmentPanel` renders `.tablify__attach-preview` and `.tablify__attach-row-thumb` when the stored path is a resolvable image; clicking the preview opens `ImagePreviewModal`; pressing `Escape` closes the lightbox while `AttachmentPanel` stays open.<br>• Adding a new image path in `AttachmentPanel` immediately updates the panel preview and the grid cell thumbnail; removing it clears both (`rev` increments once per edit, undoable via `session.undo()`).<br>• `EmbedView` renders inline image thumbnails and opens the lightbox on click. |

### 5.2 Guard & Quality Gates (run on every commit)

1. `npm run lint` — **0 errors**, warnings ≤ 119 (baseline).
2. `npm test` (`vitest run`) — all existing 128+ test files plus the new test suite pass.
3. `npm run check:guard` — no `.tabula` references in `src/`.
4. `npm run check:docs` — all relative Markdown links in `README.md`, `CHANGELOG.md`, and `docs/**/*.md` resolve.
5. `npm run check:icons` — `src/ui/faIcons.ts` matches `scripts/gen-fa-icons.mjs`.
6. `npm run build` — clean esbuild bundle; record `main.js` raw/gzip and `styles.css` byte delta.

---

## 6. Risks & Mitigations

| # | Risk | Likelihood | Impact | Mitigation |
|---|---|---|---|---|
| R1 | Obsidian's CSS specificity overrides new button styles (`button:not(.clickable-icon)` is `0,1,1`) | High if unscoped | Broken button styling & `formControlSpecificity.test.ts` failure | Scope every new `<button>` rule as `.tablify button.tablify__chip-thumb-btn` and `.tablify button.tablify__lightbox-close` (`≥ 0,2,1`). |
| R2 | Pressing `Escape` while the lightbox is open over `AttachmentPanel` closes both the lightbox and `AttachmentPanel` | Medium | Annoying UX | `ImagePreviewModal` registers its `Escape` / pointer listener in the capture phase and calls `ev.stopImmediatePropagation()` when closing the lightbox. Tested explicitly in `attachmentImagePreview.test.ts`. |
| R3 | Pooled rows (`RowPool`) retain stale `<img>` nodes or event listeners when virtual scrolling recycles rows | Low | Stale image flash on scroll | `GridView.fillRow` clears `rowEl.innerHTML = ''` and rebuilds cells via `renderAttachmentChips` on every row assignment; `loading="lazy"` and `decoding="async"` keep scroll frames non-blocking. |
| R4 | Image path exists in cell JSON, is in the vault, but the file is corrupt or zero bytes | Low | Broken browser image icon in cell | `img.addEventListener('error', ...)` removes `.tablify__chip-thumb-btn` and un-hides `.tablify__chip-icon` (paperclip), reverting seamlessly to the standard paperclip chip. |
| R5 | Accessibility check (`axeGrid.test.ts`) flags `<img>` or `<button>` without accessible names | Low | CI failure | Every `<img>` carries `alt="${fileName}"` and every `.tablify__chip-thumb-btn` carries `aria-label="Preview ${path}"`. |

---

## Appendix A — Public API Sketch

```ts
// src/views/grid/attachment.ts
export const IMAGE_EXTENSIONS: ReadonlySet<string>;
export function isImageAttachmentPath(rawPath: string): boolean;
export function resolveAttachmentImageUrl(raw: string, vault?: VaultLike): string | null;

// src/views/grid/cellRender.ts
export interface AttachmentChipOptions {
  resolveUrl?: (path: string) => string | null;
  onPreview?: (path: string, url: string) => void;
}
export function renderAttachmentChips(
  host: HTMLElement,
  value: CellValue | undefined,
  options?: AttachmentChipOptions,
): void;

// src/views/grid/ImagePreviewModal.ts
export interface ImagePreviewModalOptions {
  path: string;
  url: string;
  theme?: 'light' | 'dark';
  onClose?: () => void;
}
export class ImagePreviewModal {
  constructor(options: ImagePreviewModalOptions);
  get element(): HTMLElement;
  open(): void;
  close(): void;
}
```

## Appendix B — New CSS Classes & Test Selectors

- **Grid cell & chip:** `.tablify__cell--attachment`, `.tablify__chip--image`, `.tablify button.tablify__chip-thumb-btn`, `.tablify__chip-thumb-wrap`, `.tablify__chip-thumb`
- **Attachment panel:** `.tablify__attach-preview`, `[data-testid="tablify-attachment-preview"]`, `.tablify__attach-preview-img`, `.tablify__attach-row-thumb`
- **Image lightbox:** `.tablify__lightbox-backdrop`, `[data-testid="tablify-image-lightbox"]`, `.tablify__lightbox-card`, `.tablify__lightbox-head`, `.tablify__lightbox-title`, `.tablify__lightbox-path`, `.tablify button.tablify__lightbox-close`, `.tablify__lightbox-stage`, `.tablify__lightbox-img`, `.tablify__lightbox-fallback`
