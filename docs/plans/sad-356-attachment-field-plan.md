# SAD-356 — Attachment field: pick a file, or enter a URL / path

**Issue:** [SAD-356](https://linear.app/sad-mod/issue/SAD-356/attachment-field) · priority **2** · label *Bug*
**Project:** Tablify · **Repo:** `MakeTheNewHistory/Tablify` @ `9ff1a61` (v2.0.0-beta.6)
**Plan date:** 2026-10-20 · **Status: executed 2026-10-20** (all four steps landed on `main`, pushed, tracked in Linear; issue **In Review**)

> **Execution status — COMPLETE.** Evidence: [`docs/evidence/SAD-356.md`](../evidence/SAD-356.md).
>
> | Step | Commit | Result |
> |---|---|---|
> | 1 | `69d6bdc` | `isRemoteAttachmentPath` + `isAttachmentValueEmpty` (append-only), `attachmentImport.ts` (`pickFileFromDevice` / `importPickedFile` / `sanitizeAttachmentFileName` / `uniqueAttachmentPath`), 14 tests |
> | 2 | `4ab5dbe` | `AttachmentMenu.ts` (two entries, `setBusy` / `setMessage`, Escape + outside-press dismissal), one SAD-356 CSS block, 8 tests |
> | 3 | `954fbd9` | `AttachmentPanel` (`onChooseFile`, `setBusy`, `setMessage`, URL skips the vault check), `tableView` (`openAttachmentPanelAt`, `openAttachmentMenu`, `chooseAttachmentFile`), 2 mock stubs, 9 new `selectPanels` cases + the 3 re-pointed artefacts |
> | 4 | this commit | user guide §7, `CHANGELOG` (`Unreleased → Added`), `docs/evidence/SAD-356.md`, the two visual-parity notes, this block |
>
> **Gate at close-out:** `npm run check` green — lint **0 errors / 119 warnings** (unchanged),
> **140 files / 2231 tests** (baseline 138 / 2200), guard, docs links, icons, build
> (`main.js` 1,191,142 → 1,199,934 B).
>
> **As-built deviations from this plan** (all owner decisions or facts found while implementing):
> 1. **No import size cap** (owner decision D5) — `MAX_IMPORT_BYTES`, the `too-large` outcome and its
>    test were dropped from §4.2; `importPickedFile` copies whatever the picker returns.
> 2. **`normalizeAttachmentPath` was mangling URLs** — it collapses `//`, so the first URL typed into
>    the panel was stored as `https:/…`. `onAdd` now stores remote values verbatim (found by the new
>    *"stores a URL as typed"* test, not by reading the code).
> 3. **`setBusy(null)` left the busy label on screen** after a cancel; both panels now treat the
>    message line as one channel (busy label clears when the work ends, failures are set afterwards).
> 4. **`isRemoteAttachmentPath` had to be added to `tableView.ts`'s import list** as well as the
>    panel's — the first full run failed on the missing binding, which is why the suite is run before
>    every commit rather than after the last one.
> 5. The three artefacts of §4.8 were re-pointed exactly as planned, with no assertion weakened.

> Everything marked *(verified)* was read in this clone, run in it, or read in the Obsidian typings —
> not recalled. Line numbers are from `9ff1a61`. Measured baselines are at the end of §1.

---

## 0. TL;DR

| Concern | Decision |
|---|---|
| **The bug, precisely** | Nothing in the codebase can open a file picker. `grep -rniE "type=[\"']file\|FilePicker\|showOpenFilePicker" src/` → **0 hits** *(verified)*. Tapping an Attachment cell opens `AttachmentPanel`, which focuses a **text input** for a vault-relative path. On a phone that is a keyboard with no way to browse the device. "The file picker does not open" is literally true: it was never wired. |
| **Fix** | An empty Attachment cell now opens a small **selection menu** (`AttachmentMenu`) anchored to the cell: **Choose a file…** and **Enter a URL or file path…**. A filled cell keeps today's panel and gains one **Choose a file…** button. |
| **"Choose a file"** | `<input type="file">` → the picked `File` is **copied into the vault** through `app.fileManager.getAvailablePathForAttachment()` + `app.vault.createBinary()`, and the resulting **vault-relative path** is what the cell stores. |
| **"Enter a URL or file path"** | Opens the **existing** `AttachmentPanel` unchanged (input focused). A value matching `http(s)://` or `data:image/` is stored without the vault check; anything else keeps today's vault check + *Save anyway* confirmation. |
| **Mobile fallback** | If no chooser appears (no `change`/`cancel` within a bounded wait), the menu says so and leaves the user on the path/URL entry. No silent failure. |
| **Storage & format** | **No `formatVersion` bump, no schema change, no new dependency, no `manifest.json` change.** Attachment cells keep `string \| null` (`FORMAT_SPEC.md:150`). |
| **Code size** | +2 files (`attachmentImport.ts` ~120 lines, `AttachmentMenu.ts` ~95 lines), +2 helpers in `attachment.ts`, +~45 lines in `AttachmentPanel.ts`, +~95 lines in `tableView.ts`, +~65 lines of CSS, +2 stubs in the test mock, 2 new test files, 3 additive tests. |
| **Blast radius** | **Exactly 3 existing artefacts must be edited**, all because the issue itself changes what an *empty* Attachment cell does: one jsdom test, one visual-parity harness helper, one real-browser e2e branch (§4.8). Every other test passes **unedited** — that is the bar this plan sets, and §5 shows why each one holds. |

### Owner decisions (recorded 2026-10-20, before planning)

| # | Question | Owner answer |
|---|---|---|
| D1 | What does "Choose a File" store? | **Copy into the vault**, store the vault-relative path (Obsidian's attachment folder). |
| D2 | Which cells get the menu? | **Empty cells → menu.** Filled cells keep today's panel **plus** a *Choose a file…* button. |
| D3 | URL strictness | **Strict:** `http(s)://` and `data:image/…` are remote values (no vault check); everything else is a vault path (validated as today). |
| D4 | Platform refuses a picker | **Fall back to the path/URL entry with a clear message.** |

### Assumptions (stated, low risk)

- **A1 — the trigger gesture does not change.** The menu opens exactly where the panel opens today: **double-click**, **Enter**, or the **second tap** on an already-selected cell on touch (`tableView.ts:684-691`, SAD-96). A first tap keeps selecting the cell. Making a *single* tap open a panel would change selection semantics for every cell type; out of scope, listed in §10.
- **A2 — one file per pick.** The model stores one path per cell (`AttachmentPanel.ts:8-11`), so the picker is single-select. Multi-select would be a schema decision.
- **A3 — no file-type filter.** An Attachment cell already accepts any vault file (`.pdf`, `.csv`, `.docx`, …), so the input carries no `accept` attribute.
- **A4 — the panel's placeholder and hint strings stay byte-identical.** `tests/views/grid/selectPanels.test.ts:228` pins the placeholder and `tests/visual/capture-panels.ts:193-196` quotes the hint verbatim in the visual-parity note. The URL affordance is carried by the menu item's **label**, not by rewriting those strings.
- **A5 — no new icon glyph.** The generated icon set has no `upload`/`folder-open` (`grep -c upload src/ui/faIcons.ts` → **0**, verified); adding one means editing the generated `src/ui/faIcons.ts` and its `GLYPHS` list. The new entries reuse **`plus`** (`scripts/gen-fa-icons.mjs:34`) and **`link`** (`:55`), which are already inlined, so `npm run check:icons` is untouched.

---

## 1. Root cause, verified

### 1.1 What the user's tap does today

| Step | Code *(verified)* | What happens |
|---|---|---|
| 1 | `src/views/grid/GridView.ts:1466-1482` — `onCellReselect` / `onCellActivate` | A second tap (touch) or a double-click reports the cell. |
| 2 | `src/views/tableView.ts:1394-1425` — `startEdit()` | `field.type === 'attachment'` (line 1418) is in the panel list → `openCellPanel(...)`, never an inline editor. |
| 3 | `src/views/tableView.ts:1544-1568` — `openCellPanel()` | Resolves `anchor` = the cell's `.tablify__capsule`. |
| 4 | `src/views/tableView.ts:1642-1668` | `new AttachmentPanel({ checkPath, resolveImageUrl, onPreviewImage, onAdd, onRemove, onDismiss }).open(anchor)`. |
| 5 | `src/views/grid/AttachmentPanel.ts:84-89, 107-116` | Builds one `<input type="text">` (`Vault-relative path, e.g. Assets/photo.png`) and calls `this.input.focus()` on `open()`. |

There is no file dialog anywhere in that chain — the panel is a **path text field**, and its own hint
says so: *"Vault-relative path — the file is checked when you press Enter."* (`AttachmentPanel.ts:55`).
The prototype the plugin mirrors said the quiet part out loud: *"File picking is Obsidian-side —
simulated here."* (`Prototype/script.js:1006`). SAD-356 closes that gap for real.

### 1.2 Why `checkAttachmentPath` cannot be the fix

`checkAttachmentPath` (`src/views/grid/attachment.ts:104-118`) only answers "does this path exist in the
vault?" — for a `https://…` value it answers *no* and offers *Save anyway*. It has no concept of a remote
value, and it must not gain one silently: `tests/views/grid/attachment.test.ts:38-46` pins the
missing-file message. The URL distinction therefore lives in a **new** helper (§4.1) and
`checkAttachmentPath` is **not touched**.

### 1.3 Everything an attachment value touches

| Layer | File : lines *(verified)* | Behaviour | SAD-356 impact |
|---|---|---|---|
| Field type | `src/model/fieldTypes/attachment.ts:1-28` | `validate` = `string \| null`; `parse` trims; `format` = `String(value)` | **none** |
| Format | `FORMAT_SPEC.md:150`, `tablify.schema.json` | `string \| null` | **none** |
| Path helpers | `src/views/grid/attachment.ts:5-122` | normalise / image detect / vault check / image URL resolve | **+** two new pure helpers |
| Cell render | `src/views/grid/cellRender.ts:331-421`, `GridView.ts:1459-1466` | paperclip chip or inline image thumbnail | **none** |
| Panel | `src/views/grid/AttachmentPanel.ts:26-259` | list + path input + vault warning + image preview | **+** optional button, `setBusy`, `setMessage` |
| Host wiring | `src/views/tableView.ts:1642-1668` | value read/write, one undo step per change | **+** menu branch, copy-and-write path |
| Embeds | `src/embed/embedView.ts:176-235`, `embed/register.ts:62-75` | read-only grid, no panel | **none** |
| Copy / export / search / sort / query / sync | `src/io/export/*`, `src/query/evaluate.ts:153`, `src/sync/values.ts:31-82` | reads the stored string | **none** |

### 1.4 Measured baseline on this clone (2026-10-20, after `npm install`)

| Check | Baseline *(measured now)* |
|---|---|
| `npx vitest run` | **138 files / 2200 tests, all passing** (≈140 s) |
| `npx eslint src/ tests/` | **0 errors, 119 warnings** |
| Expected after this plan | **140 files / ≈2219 tests passing**; lint still 0 errors / 119 warnings |

---

## 2. Platform research (verified vs. device-only)

| Fact | Evidence | Consequence |
|---|---|---|
| Obsidian has **no** official "open a file picker" API. `App`, `Vault`, `FileManager`, `Platform` expose no dialog member. | `obsidian.d.ts` (v1.7.2 typings, fetched from unpkg) — full member list read. | The picker must be a DOM `<input type="file">`. |
| `FileManager.getAvailablePathForAttachment(filename, sourcePath?)` returns a **deduped, folder-aware** path following *Settings → Files and links → Default location for new attachments*. | <https://docs.obsidian.md/Reference/TypeScript+API/FileManager/getAvailablePathForAttachment> (`(filename: string, sourcePath?: string): Promise<string>`, "1.5.7"); present in `obsidian.d.ts` v1.7.2 line **1563**, v1.8.7 line **1601**. | Copy destination. `manifest.json` says `minAppVersion: 1.14`, so it is guaranteed present. |
| `Vault.createBinary(path, data: ArrayBuffer, options?)` exists. | `obsidian.d.ts` v1.7.2 line **4301**, v1.8.7 line **4385**; <https://docs.obsidian.md/Reference/TypeScript+API/Vault>. | Writing the picked bytes; usable for text files too, so one code path. |
| Obsidian mobile is Capacitor-based (`class CapacitorAdapter` is declared in `obsidian.d.ts`). Capacitor's Android `BridgeWebChromeClient` implements `onShowFileChooser` → `showFilePicker(...)` = the system picker. iOS `WKWebView` handles `<input type="file">` natively. | `obsidian.d.ts` `CapacitorAdapter`; `ionic-team/capacitor` `android/.../BridgeWebChromeClient.java:276-301, 375` (fetched). | The picker works in principle on Android and iOS — **and** an unknown/blocked case exists, which is exactly why D4 is in the design. |
| Plugins must avoid Node/Electron on mobile; the Vault API is the supported route. | <https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines> | Nothing platform-specific is added; `isDesktopOnly` stays `false`. |
| Obsidian ≥1.13 exposes `app.emulateMobile` to exercise mobile branches on desktop. | <https://obsidian.md/changelog.xml> | Used in the verification script (§7.4). |

**Honest limitation:** this sandbox has no Obsidian GUI and no phone (`docs/testing/matrix.md`), so the
device rows in §7.4 are recorded **NOT RUN — run [T-M-DEV-SAD356-…]** until the owner executes them. The
code is written so a missing chooser is a *message*, never a crash or a silent no-op.

---

## 3. Design

### 3.1 The flow

```
tap Attachment cell (dblclick / Enter / 2nd tap — unchanged)
        │
        ├── cell has a value ─────────► AttachmentPanel  (today's panel, unchanged layout)
        │                                  └─ + [Choose a file…]   ← new, optional button
        │                                       └─ device picker → copy into vault → setValue (1 undo step)
        │                                  └─ path input … (unchanged; URL now skips the vault check)
        │
        └── cell is empty ────────────► AttachmentMenu   (new, 2 entries)
                                           ├─ [Choose a file…]           → same picker + copy
                                           └─ [Enter a URL or file path…] → closes, opens AttachmentPanel
                                                 (a refused/absent picker lands here too, with a message)
```

### 3.2 Design decisions

1. **New `src/views/grid/attachmentImport.ts` — pure helpers + one DOM function, zero Obsidian imports.**
   Mirrors `attachment.ts`'s injected-interface style (`VaultLike`, `attachment.ts:57-75`), so every rule is
   unit-tested in jsdom/node with no vault and no module mocking.
2. **New `src/views/grid/AttachmentMenu.ts` — a dumb view like `AttachmentPanel`.** Same card factory
   (`createPanelCard`), anchoring (`anchorPanel`) and dismissal (`wirePanelDismiss`) as every other panel
   (`src/views/grid/select/panel.ts:33-91`) — which is why it lands in the same place and closes on
   Escape/outside press for free. The host owns the vault and the write.
3. **`AttachmentPanel` gains three *optional* things:** `onChooseFile?`, `setBusy()`, `setMessage()`. When
   the option is absent, the panel renders **byte-identically** to today — that is what keeps
   `selectPanels.test.ts:199-260` and `attachmentImagePreview.test.ts:76-140` green without edits.
4. **The copy is one `setValue` + `afterChange()`**, exactly like `onAdd` today (`tableView.ts:1650-1656`)
   → one undo step, one save. Undo restores the previous (empty) value; the copied file stays in the vault
   (a file is not a cell value — documented in §7.1).
5. **A Notice on success** (`Saved to Attachments/photo.png`): the write happens outside the cell, so the
   user must see where the file landed. Same voice as `Created option "X"` (`tableView.ts:1717`).
6. **Nothing is stored outside the vault.** No absolute paths, no `content://` URIs, no base64 — a picked
   file becomes a normal vault file, so the chip, the SAD-347 thumbnail, export and sync behave as they
   already do.
7. **The existing strings, classes and test ids of the panel are untouched** (A4). New elements get their
   own classes: `tablify__attach-menu`, `tablify__attach-menu-item`, `tablify__attach-pick`,
   `tablify__attach-msg`, plus `data-testid="tablify-attachment-menu"` / `"tablify-attachment-pick"`.
8. **The one behaviour that is deliberately re-pointed** is "empty Attachment cell opens the path panel".
   Three existing artefacts pin it and must move with the issue (§4.8). Nothing else re-pins.

---

## 4. File-by-file changes

### 4.1 `src/views/grid/attachment.ts` — two pure helpers (append only)

```ts
/**
 * SAD-356: true when a cell value is a remote resource rather than a vault path — an `http(s)://` URL
 * or an inline `data:image/*` URI. The same family `resolveAttachmentImageUrl` renders, and the same
 * family that must skip the vault existence check (`checkAttachmentPath`).
 */
export function isRemoteAttachmentPath(raw: string): boolean {
  const trimmed = raw.trim();
  return /^https?:\/\//i.test(trimmed) || /^data:image\//i.test(trimmed);
}

/**
 * SAD-356: true when an attachment cell holds no path at all. Mirrors `attachmentPaths()`
 * (`views/grid/cellRender.ts:331-334`) so the cell, the panel and the menu agree on "empty".
 */
export function isAttachmentValueEmpty(value: CellValue | undefined | null): boolean {
  if (Array.isArray(value)) return value.every((entry) => String(entry).trim() === '');
  return typeof value !== 'string' || value.trim() === '';
}
```

The module currently has no imports; add `import type { CellValue } from '../../model/types.js';`.
Nothing else changes — `checkAttachmentPath` keeps its exact signature and message.

### 4.2 `src/views/grid/attachmentImport.ts` — **new file** (~120 lines)

```ts
/**
 * SAD-356 — bringing a file from the device into the vault.
 *
 * Two independent pieces, both free of Obsidian imports so they run in jsdom:
 *  - `pickFileFromDevice()` — a real `<input type="file">`, and an honest answer when a WebView
 *    never opens a chooser (the case that must fall back to the path/URL entry, owner decision D4).
 *  - `importPickedFile()` — copies the picked `File` into the vault through Obsidian's own attachment
 *    folder (`getAvailablePathForAttachment`) and returns the vault-relative path the cell stores.
 *    Calls are injected (`AttachmentVaultIo`), the same shape `attachment.ts` uses for `VaultLike`.
 *
 * Nothing here touches the .tablify format: the cell keeps one vault-relative path string.
 */

export interface AttachmentTimers {
  setTimeout(fn: () => void, ms: number): unknown;
  clearTimeout(handle: unknown): void;
}

export type PickOutcome =
  | { kind: 'file'; file: File }
  | { kind: 'cancelled' }
  /** No chooser ever appeared (some WebViews) — the caller shows the fallback message. */
  | { kind: 'unavailable' };

export interface PickFileOptions {
  accept?: string;
  doc?: Document;
  /** How long to wait before a silent WebView is called `unavailable`. */
  noChooserMs?: number;
  timers?: AttachmentTimers;
}

export const NO_CHOOSER_MS = 1500;

export function pickFileFromDevice(options: PickFileOptions = {}): Promise<PickOutcome> {
  const doc = options.doc ?? document;
  const timers = options.timers ?? {
    setTimeout: (fn, ms) => setTimeout(fn, ms),
    clearTimeout: (h) => clearTimeout(h as number),
  };
  const noChooserMs = options.noChooserMs ?? NO_CHOOSER_MS;

  return new Promise<PickOutcome>((resolve) => {
    const input = doc.createElement('input');
    input.type = 'file';
    input.multiple = false;
    if (options.accept) input.accept = options.accept;
    // Off-screen but connected: some WebViews ignore a click on a detached input.
    input.style.position = 'fixed';
    input.style.left = '-1000px';
    input.style.width = '1px';
    input.style.height = '1px';
    input.tabIndex = -1;
    input.setAttribute('aria-hidden', 'true');

    let settled = false;
    let timer: unknown = null;
    const win = doc.defaultView;

    const cleanup = (outcome: PickOutcome): void => {
      if (settled) return;
      settled = true;
      if (timer !== null) timers.clearTimeout(timer);
      input.removeEventListener('change', onChange);
      input.removeEventListener('cancel', onCancel);
      win?.removeEventListener('blur', onBlur);
      input.remove();
      resolve(outcome);
    };
    const onChange = (): void => {
      const file = input.files?.[0] ?? null;
      cleanup(file ? { kind: 'file', file } : { kind: 'cancelled' });
    };
    // Chromium 113+ and WebKit fire `cancel` when the user dismisses the dialog.
    const onCancel = (): void => cleanup({ kind: 'cancelled' });
    // A native chooser takes the window's focus: stop the "nothing happened" clock while it is away.
    const onBlur = (): void => {
      if (timer !== null) timers.clearTimeout(timer);
      timer = null;
    };

    input.addEventListener('change', onChange);
    input.addEventListener('cancel', onCancel);
    win?.addEventListener('blur', onBlur, { once: true });
    doc.body.appendChild(input);
    timer = timers.setTimeout(() => cleanup({ kind: 'unavailable' }), noChooserMs);
    // Clicked from inside the caller's own click handler, so the browser's user activation holds.
    input.click();
  });
}

/** The subset of the Obsidian vault this module needs. Injected by the host view. */
export interface AttachmentVaultIo {
  getAvailablePathForAttachment?(filename: string, sourcePath?: string): Promise<string>;
  createBinary(path: string, data: ArrayBuffer): Promise<unknown>;
  getAbstractFileByPath(path: string): unknown | null;
}

export type ImportOutcome =
  | { ok: true; path: string }
  | { ok: false; reason: 'too-large' | 'failed'; message: string };

/** Mobile memory is the scarce resource: `arrayBuffer()` holds the whole file. */
export const MAX_IMPORT_BYTES = 25 * 1024 * 1024;

export function sanitizeAttachmentFileName(name: string): string {
  const base = name.replace(/\\/g, '/').split('/').pop() ?? '';
  const cleaned = base.replace(/[<>:"|?*\u0000-\u001F]/g, '').trim();
  return cleaned === '' || cleaned === '.' || cleaned === '..' ? 'attachment' : cleaned;
}

/** `photo.png` → `photo 1.png` → `photo 2.png`, inside `folder` ('' = vault root). */
export function uniqueAttachmentPath(name: string, folder: string, exists: (path: string) => boolean): string {
  const dir = folder.replace(/^\/+|\/+$/g, '');
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  const join = (n: string): string => (dir ? `${dir}/${n}` : n);
  let candidate = join(name);
  for (let i = 1; exists(candidate); i += 1) candidate = join(`${stem} ${i}${ext}`);
  return candidate;
}

/**
 * Copy `file` into the vault and return the path to store. Obsidian decides the folder
 * (`getAvailablePathForAttachment`, which also dedupes); the fallback keeps the behaviour testable
 * and never overwrites.
 */
export async function importPickedFile(
  file: File,
  io: AttachmentVaultIo,
  sourcePath = '',
  maxBytes = MAX_IMPORT_BYTES,
): Promise<ImportOutcome> {
  if (file.size > maxBytes) {
    return {
      ok: false,
      reason: 'too-large',
      message: `"${file.name}" is larger than 25 MB — copy it into the vault yourself and enter its path.`,
    };
  }
  const name = sanitizeAttachmentFileName(file.name);
  try {
    const target = io.getAvailablePathForAttachment
      ? normalizeAttachmentPath(await io.getAvailablePathForAttachment(name, sourcePath))
      : uniqueAttachmentPath(name, '', (p) => io.getAbstractFileByPath(p) !== null);
    if (!target) return { ok: false, reason: 'failed', message: 'Could not find a place in the vault for that file.' };
    await io.createBinary(target, await file.arrayBuffer());
    return { ok: true, path: target };
  } catch (e) {
    return { ok: false, reason: 'failed', message: `Could not copy that file into the vault: ${(e as Error).message}` };
  }
}
```

`normalizeAttachmentPath` is imported from `./attachment.js` — the module already owns path normalisation,
so nothing is duplicated.

### 4.3 `src/views/grid/AttachmentMenu.ts` — **new file** (~95 lines)

```ts
/**
 * SAD-356 — the menu an **empty** Attachment cell opens: choose a device file, or type a URL / path.
 *
 * The card is the same prototype `#floatPanel` host every cell panel uses (`select/panel.ts`), so it
 * lands in the same place and dismisses the same way. It is a view only: the host owns the vault, the
 * copy and the write (`TableView.openAttachmentMenu`).
 */
import { faIcon } from '../../ui/faIcons.js';
import { anchorPanel, createPanelCard, wirePanelDismiss } from './select/panel.js';
import type { FieldDefinition } from '../../model/types.js';

export interface AttachmentMenuOptions {
  field: FieldDefinition;
  theme?: 'light' | 'dark';
  /** Open the device picker. The host resolves it, copies the file and writes the cell. */
  onChooseFile: () => void;
  /** Hand over to the existing path panel (`AttachmentPanel`), input focused. */
  onEnterPath: () => void;
  onDismiss?: () => void;
}

export class AttachmentMenu {
  private container: HTMLElement;
  private body: HTMLElement;
  private status: HTMLElement;
  private buttons: HTMLButtonElement[] = [];
  private unwireDismiss: (() => void) | null = null;

  constructor(private opts: AttachmentMenuOptions) {
    const { card, body } = createPanelCard('tablify-attachment-menu', opts.theme ?? 'light', 'tablify__attach');
    card.classList.add('tablify__panel--attach');
    card.setAttribute('aria-label', `Add an attachment to ${opts.field.name}`);
    this.container = card;
    this.body = body;

    const head = document.createElement('div');
    head.className = 'tablify__attach-head';
    const icon = document.createElement('span');
    icon.className = 'tablify__attach-icon';
    icon.innerHTML = faIcon('paperclip', 11);
    head.appendChild(icon);
    head.appendChild(document.createTextNode('Add an attachment'));
    this.body.appendChild(head);

    const list = document.createElement('div');
    list.className = 'tablify__attach-menu';
    list.setAttribute('role', 'menu');
    this.buttons.push(
      this.item(list, 'plus', 'Choose a file…', () => opts.onChooseFile()),
      this.item(list, 'link', 'Enter a URL or file path…', () => opts.onEnterPath()),
    );
    this.body.appendChild(list);

    // Hidden until the host has something to say (a refused picker, a failed copy).
    this.status = document.createElement('div');
    this.status.className = 'tablify__attach-msg';
    this.status.setAttribute('role', 'status');
    this.status.hidden = true;
    this.body.appendChild(this.status);
  }

  get element(): HTMLElement { return this.container; }

  open(anchor: HTMLElement): void {
    if (!this.container.isConnected) document.body.appendChild(this.container);
    anchorPanel(this.container, anchor);
    this.buttons[0]?.focus();
    this.unwireDismiss ??= wirePanelDismiss(this.container, () => {
      this.close();
      this.opts.onDismiss?.();
    });
  }

  /** The fallback message (owner decision D4) — e.g. the WebView never opened a chooser. */
  setMessage(text: string): void {
    this.status.textContent = text;
    this.status.hidden = text === '';
  }

  /** While the copy runs: one label, every entry disabled, `aria-busy` for screen readers. */
  setBusy(label: string | null): void {
    this.container.setAttribute('aria-busy', label ? 'true' : 'false');
    for (const button of this.buttons) button.disabled = label !== null;
    if (label) this.setMessage(label);
  }

  close(): void {
    this.unwireDismiss?.();
    this.unwireDismiss = null;
    this.container.remove();
  }

  private item(list: HTMLElement, icon: 'plus' | 'link', label: string, run: () => void): HTMLButtonElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tablify__attach-menu-item';
    button.setAttribute('role', 'menuitem');
    const glyph = document.createElement('span');
    glyph.className = 'tablify__attach-menu-icon';
    glyph.innerHTML = faIcon(icon, 11);
    button.appendChild(glyph);
    button.appendChild(document.createTextNode(label));
    button.addEventListener('click', () => run());
    list.appendChild(button);
    return button;
  }
}
```

`faIcon` is typed `FaGlyph` (`src/ui/faIcons.ts`), so `'plus' | 'link'` type-checks and a typo fails the
build rather than shipping a blank glyph.

### 4.4 `src/views/grid/AttachmentPanel.ts` — additive only

1. Options (`AttachmentPanel.ts:26-47`) gain:

```ts
  /** SAD-356: open the device picker. Absent for any caller that only wants the path field. */
  onChooseFile?: () => void;
```

2. Field `private msg: HTMLElement | null = null;` next to `warn` (line 62), and — **after**
   `this.body.appendChild(hint)` (line 98) so nothing above moves:

```ts
    // SAD-356: a filled cell can still take a file from the device. Absent by default, so a panel
    // built without it renders exactly as it always has.
    if (opts.onChooseFile) {
      const pick = document.createElement('button');
      pick.type = 'button';
      pick.className = 'tablify__attach-pick';
      pick.dataset.testid = 'tablify-attachment-pick';
      const glyph = document.createElement('span');
      glyph.className = 'tablify__attach-pick-icon';
      glyph.innerHTML = faIcon('plus', 10);
      pick.appendChild(glyph);
      pick.appendChild(document.createTextNode('Choose a file…'));
      pick.addEventListener('click', () => this.opts.onChooseFile?.());
      this.msg = document.createElement('div');
      this.msg.className = 'tablify__attach-msg';
      this.msg.setAttribute('role', 'status');
      this.msg.hidden = true;
      this.body.appendChild(pick);
      this.body.appendChild(this.msg);
    }
```

3. Two new methods beside `setValue`/`close` (no existing method changes):

```ts
  /** SAD-356: the host's message line (a refused picker, a failed copy). */
  setMessage(text: string): void {
    if (!this.msg) return;
    this.msg.textContent = text;
    this.msg.hidden = text === '';
  }

  /** SAD-356: disable the panel's controls while a picked file is copied into the vault. */
  setBusy(label: string | null): void {
    this.container.setAttribute('aria-busy', label ? 'true' : 'false');
    for (const el of Array.from(this.body.querySelectorAll<HTMLButtonElement | HTMLInputElement>('button, input'))) {
      el.disabled = label !== null;
    }
    if (label) this.setMessage(label);
  }
```

4. One behavioural line in `onKey` (`AttachmentPanel.ts:139-144`) so the URL route is honest:

```ts
    const check = isRemoteAttachmentPath(raw) ? undefined : this.opts.checkPath?.(raw);
```

with `isRemoteAttachmentPath` added to the existing import from `./attachment.js` (line 23).

*Not changed:* `INPUT_PLACEHOLDER` (49), `HINT` (55), `paths()` (170-174), `render()` (176-252), the
`tablify__attach-warn` / *Save anyway* flow, the SAD-347 preview banner and row thumbnail. `render()`
also re-focuses the input only when the container is connected (line 250-251), which stays true.

### 4.5 `src/views/tableView.ts` — the host

**(a) imports** (next to lines 47 and 54):

```ts
import { AttachmentMenu } from './grid/AttachmentMenu.js';
import {
  checkAttachmentPath,
  isAttachmentValueEmpty,
  normalizeAttachmentPath,
  resolveAttachmentImageUrl,
} from './grid/attachment.js';
import { importPickedFile, pickFileFromDevice, type AttachmentVaultIo } from './grid/attachmentImport.js';
```

**(b) `openCellPanel`'s attachment branch (1642-1668)** splits in two. The **panel construction moves into
its own method** — that is what lets the menu's *Enter a URL or file path…* open the panel without
re-entering the empty-cell branch (a re-entrancy bug the naive version would have):

```ts
    if (field.type === 'attachment') {
      // SAD-356: an empty cell asks how to fill it — a device file, or a URL / vault path.
      if (isAttachmentValueEmpty(value())) this.openAttachmentMenu(rowId, field, anchor);
      else this.openAttachmentPanelAt(rowId, field, anchor);
      return;
    }
```

**(c) three new private methods** after `openCellPanel` (~line 1690):

```ts
  /**
   * SAD-356 — the filled-cell panel, exactly as it was, plus the device picker. Split out of
   * `openCellPanel` so the empty-cell menu can open it directly (going back through `openCellPanel`
   * would land on the menu again while the cell is still empty).
   */
  private openAttachmentPanelAt(rowId: string, field: FieldDefinition, anchor: HTMLElement): void {
    const s = this.session;
    const grid = this.grid;
    if (!s || !grid) return;
    const value = (): CellValue => s.store.getRow(rowId)?.values[field.id] ?? null;
    const closePanel = (): void => {
      panel.close();
      grid.root.focus();
    };
    const panel = new AttachmentPanel({
      field,
      value: value(),
      theme: this.isDark() ? 'dark' : 'light',
      checkPath: (raw) => checkAttachmentPath(raw, this.app.vault),
      resolveImageUrl: (path) => resolveAttachmentImageUrl(path, this.app.vault),
      onPreviewImage: (path, url) => new ImagePreviewModal(this.app, { path, url }).open(),
      // SAD-356: a filled cell can also take a file from the device.
      onChooseFile: () => void this.chooseAttachmentFile(rowId, field, panel),
      onAdd: (raw) => {
        const path = normalizeAttachmentPath(raw);
        if (!path) return;
        s.setValue(rowId, field.id, path);
        panel.setValue(path);
        this.afterChange();
      },
      onRemove: () => {
        s.setValue(rowId, field.id, null);
        panel.setValue(null);
        this.afterChange();
      },
      onDismiss: () => closePanel(),
    });
    panel.open(anchor);
  }

  /**
   * SAD-356 — an empty Attachment cell: two ways in. The menu is the same `#floatPanel` card as
   * every other cell panel, so placement and dismissal are the ones the grid already uses.
   */
  private openAttachmentMenu(rowId: string, field: FieldDefinition, anchor: HTMLElement): void {
    const grid = this.grid;
    if (!grid) return;
    const menu = new AttachmentMenu({
      field,
      theme: this.isDark() ? 'dark' : 'light',
      onChooseFile: () => void this.chooseAttachmentFile(rowId, field, menu),
      onEnterPath: () => {
        menu.close();
        this.openAttachmentPanelAt(rowId, field, anchor);
      },
      onDismiss: () => grid.root.focus(),
    });
    menu.open(anchor);
  }

  /**
   * SAD-356 — pick a file, copy it into the vault, store the vault-relative path.
   *
   * One `setValue` + `afterChange()`, so the write is exactly one undo step (the same contract the
   * panel's path entry has). The copy itself is not undoable: the file is a vault artefact, not a
   * cell value — the Notice says where it went.
   */
  private async chooseAttachmentFile(
    rowId: string,
    field: FieldDefinition,
    ui: { setBusy(label: string | null): void; setMessage(text: string): void; close?(): void },
  ): Promise<void> {
    const s = this.session;
    if (!s) return;
    ui.setBusy('Opening your file picker…');
    const picked = await pickFileFromDevice();
    if (picked.kind === 'unavailable') {
      ui.setBusy(null);
      // Owner decision D4: say so, and leave the user on the path/URL entry rather than a dead end.
      ui.setMessage('This device did not open a file picker. Enter the file path or a URL instead.');
      return;
    }
    if (picked.kind === 'cancelled') {
      ui.setBusy(null);
      return;
    }

    const io: AttachmentVaultIo = {
      getAvailablePathForAttachment: this.app.fileManager.getAvailablePathForAttachment?.bind(this.app.fileManager),
      createBinary: (path, data) => this.app.vault.createBinary(path, data),
      getAbstractFileByPath: (path) => this.app.vault.getAbstractFileByPath(path),
    };
    ui.setBusy('Copying into your vault…');
    const result = await importPickedFile(picked.file, io, this.file?.path ?? '');
    ui.setBusy(null);
    if (!result.ok) {
      ui.setMessage(result.message);
      return;
    }

    s.setValue(rowId, field.id, result.path);
    this.afterChange();
    new Notice(`Saved to ${result.path}`);
    ui.close?.();
    this.grid?.root.focus();
  }
```

*Note on types:* `getAvailablePathForAttachment?` is optional in `AttachmentVaultIo`, so a build without it
falls back to `uniqueAttachmentPath` instead of crashing — and `this.app.fileManager` carries the method in
the real API (`obsidian.d.ts:1563`) and in the test mock after §4.7.

### 4.6 `styles.css` — one block, appended after the SAD-347 attachment rules (~line 3095)

```css
/* SAD-356: the empty cell's menu and the panel's "Choose a file…" button. Plugin-only rows — the
   prototype has no equivalent (the same call the `.tablify__attach-warn` row makes). Every value is a
   `--tablify-*` token, like the rest of the panel. */
.tablify .tablify__attach-menu {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.tablify button.tablify__attach-menu-item,
.tablify button.tablify__attach-pick {
  display: flex;
  align-items: center;
  gap: 6px;
  width: 100%;
  margin: 0;
  padding: 6px 8px;
  background: transparent;
  border: 1px solid transparent;
  border-radius: 8px;
  color: var(--tablify-text);
  font-family: inherit;
  font-size: 11px;
  line-height: 16px;
  text-align: left;
  cursor: pointer;
  appearance: none;
}

.tablify button.tablify__attach-pick {
  justify-content: center;
  margin-top: 6px;
  border-color: var(--tablify-border-subtle);
  background: var(--tablify-bg-inner);
}

.tablify button.tablify__attach-menu-item:hover,
.tablify button.tablify__attach-pick:hover {
  background: var(--tablify-bg-capsule);
  border-color: var(--tablify-border-capsule-hover, var(--tablify-accent-primary));
}

.tablify button.tablify__attach-menu-item:focus-visible,
.tablify button.tablify__attach-pick:focus-visible {
  outline: 2px solid var(--tablify-focus);
  outline-offset: 1px;
}

.tablify button.tablify__attach-menu-item:disabled,
.tablify button.tablify__attach-pick:disabled {
  color: var(--tablify-text-muted);
  cursor: default;
}

.tablify__attach-menu-icon,
.tablify__attach-pick-icon {
  display: inline-flex;
  color: var(--tablify-accent-primary);
}

.tablify .tablify__attach-msg {
  margin-top: 6px;
  font-size: 10px;
  line-height: 14px;
  color: var(--tablify-text-muted);
}
```

Existing style tests this block must satisfy: buttons element-qualified (`.tablify button.…`,
`tests/ui/formControlSpecificity.test.ts`) and only `--tablify-*` variables
(`tests/ui/tokensNoObsidianVars.test.ts`).

### 4.7 `tests/__mocks__/obsidian.ts` — two additive stubs

`App.vault` (lines 204-215) and `App.fileManager` (212-219) gain what the host now calls, so a `TableView`
test can drive the real copy path:

```ts
  // SAD-356: the attachment copy path. Defaults that write nothing; a test may replace them with spies.
  createBinary: async (path: string): Promise<TFile> => new TFile(path),
```
```ts
  getAvailablePathForAttachment: async (filename: string): Promise<string> => `Attachments/${filename}`,
```

No existing test changes behaviour: no current code path calls either method.

### 4.8 The three existing artefacts that **must** be updated (and why)

This is the honest cost of D2: the issue changes what an *empty* Attachment cell does, and three places
pinned the old answer.

| # | File : lines *(verified)* | What it pins today | Required edit |
|---|---|---|---|
| 1 | `tests/views/grid/selectPanels.test.ts:364-390` — *"opens the attachment panel and saves a missing path through the vault check"* | presses **Enter on the empty Attachments cell** (column 4) and expects `[data-testid="tablify-attachment-panel"]` | after `enterAt(view, 4)`, click the menu's second entry, then keep every existing assertion (`.tablify__attach-empty`, `.tablify__attach-input`, the warn + *Save anyway* + stored path). Net diff ≈ 4 lines; nothing is weakened — the missing-path rule is still asserted end-to-end, now through the real gesture: <br>`const menu = need(document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-menu"]'), 'attachment menu');`<br>`need(menu.querySelectorAll<HTMLButtonElement>('.tablify__attach-menu-item')[1], 'Enter path entry').click();` |
| 2 | `tests/visual/capture-panels.ts:293-303` — `openAttachmentPlugin()` | presses **Enter on the empty Attachments cell**, then captures the panel | click the menu's *Enter a URL or file path…* entry after the Enter, then `waitForTimeout(120)`. Without this the `attachment-panel` / `attachment-row` captures find no panel at all (the harness selector is `[data-testid="tablify-attachment-panel"]`). `seedAttachment()` (306-318) needs no change. |
| 3 | `tests/e2e/fieldTypes.browser.ts:233, 338-341` | `{ fieldId: 'fld_attach', … expect: 'panel' }` on row 0 (an **empty** cell), then *"attachment: panel renders an input"* | `surface()` counts `.tablify__panel` (lines 143-155), so the menu still reads as `panel` — only the input check breaks. Replace that branch with: assert **2** `[role="menuitem"]` in the menu, click the second, then assert the panel's input exists; keep `dismiss(page)` after. |

No other test, script or doc asserts the empty-cell behaviour (`grep -rn "tablify-attachment-panel\|attach-input\|attachments" tests/` reviewed in full).

### 4.9 Files that need **no** change (deliberate)

`src/model/fieldTypes/attachment.ts`, `FORMAT_SPEC.md`, `tablify.schema.json`, `src/views/grid/cellRender.ts`,
`src/views/grid/GridView.ts`, `src/views/grid/ImagePreviewModal.ts`, `src/embed/*`, `src/sync/*`, `src/io/*`,
`src/query/*`, `src/ui/faIcons.ts` (A5), `manifest.json`, `package.json`, `main.js`.

---

## 5. Non-regression contract

| Existing behaviour | Pinned by | Why SAD-356 cannot break it |
|---|---|---|
| Attachment chips and SAD-347 image thumbnails + lightbox | `tests/views/grid/cellFormatting.test.ts:534-565`, `attachmentImagePreview.test.ts` | `cellRender.ts` / `GridView.ts` are not edited |
| A path not in the vault still warns, *Save anyway* still saves | `tests/views/grid/attachment.test.ts:38-57` + artefact #1 in §4.8 | `checkAttachmentPath` untouched; the warn flow untouched; the test keeps those assertions, only the route to the panel changes |
| The panel's placeholder, hint, empty text, `testid`, focus-on-open, Escape/outside dismissal | `selectPanels.test.ts:199-260` | new markup is appended **after** the hint and only when `onChooseFile` is passed |
| Every attachment write is exactly one undo step and saves | `selectPanels.test.ts` undo assertions | the new write is the same `s.setValue` + `this.afterChange()` pair |
| Double-click / Enter / second tap open a surface; first tap selects | `tests/views/grid/keyboard.test.ts`, `cellFocus.test.ts`, `tests/views/editTriggers.test.ts` | `startEdit` and the `GridView` callbacks are unchanged; only the attachment branch of `openCellPanel` splits |
| Cell text (`textContent`) and capsule geometry | `tests/ui/rowHeightSmall.test.ts`, `cellFormatting.test.ts` | no render change at all |
| No new `formatVersion`; files round-trip byte-identically | `tests/format/format.test.ts`, `tests/io/roundtrip.fieldTypes.test.ts` | stored value type unchanged (`string \| null`) |
| Icons, tokens, control specificity, axe | `tests/ui/*` | A5 (no glyph added), only `--tablify-*` tokens, element-qualified selectors, `role`/`aria` on every new control |
| `.tabula` never referenced | `scripts/check-tabula-guard.sh` | no new mentions |

---

## 6. Tests

### 6.1 New — `tests/views/grid/attachmentImport.test.ts`

| # | Test | Asserts |
|---|---|---|
| 1 | `isRemoteAttachmentPath` | `https://…`, `HTTP://…`, `data:image/png;base64,…` → true; `Assets/a.png`, `www.example.com`, `C:\x.png`, `''` → false |
| 2 | `isAttachmentValueEmpty` | `null`, `''`, `'  '`, `[]`, `['']` → true; `'Assets/a.png'`, `['a.png']` → false |
| 3 | `sanitizeAttachmentFileName` | `…/DCIM/photo.jpg` → `photo.jpg`; `a:b*c?.png` → `abc.png`; `''` / `'..'` → `attachment`; unicode + spaces preserved |
| 4 | `uniqueAttachmentPath` | `photo.png` with `photo.png` present → `photo 1.png`, then `photo 2.png`; folder prefix respected; extension-less `README` dedupes to `README 1` |
| 5 | `importPickedFile` uses Obsidian's folder | `getAvailablePathForAttachment` called with `(name, sourcePath)`; the returned path is normalised; `createBinary` receives the file's bytes |
| 6 | `importPickedFile` fallback | without `getAvailablePathForAttachment` a free path is chosen and never overwrites |
| 7 | `importPickedFile` failures | `createBinary` throws → `{ ok: false, reason: 'failed' }`; `size > MAX_IMPORT_BYTES` → `too-large` and **no** `createBinary` call |
| 8 | `pickFileFromDevice` happy path | fake `Document`/timers: an `input[type=file]` is created and `.click()`ed, `change` with stubbed `files` resolves `{ kind: 'file' }`, the input is **removed** from the DOM |
| 9 | `pickFileFromDevice` cancel / unavailable | `cancel` → `cancelled`; no event + timer → `unavailable` (the D4 path); the input and listeners are cleaned up in both cases |

### 6.2 New — `tests/views/grid/attachmentMenu.test.ts` (jsdom)

| # | Test |
|---|---|
| 10 | renders two `role="menuitem"` entries with the exact labels *Choose a file…* / *Enter a URL or file path…*, the card `data-testid="tablify-attachment-menu"`, and focuses the first entry on `open()` |
| 11 | *Choose a file…* calls `onChooseFile` once; *Enter a URL or file path…* calls `onEnterPath` once |
| 12 | Escape **and** an outside `mousedown` both close it (`isConnected === false`) and call `onDismiss` once |
| 13 | `setMessage('…')` shows a `role="status"` line; `setBusy('Copying…')` disables both entries and sets `aria-busy`; `setBusy(null)` reverses both |

### 6.3 Additive — extend `tests/views/grid/selectPanels.test.ts`

| # | Test | Asserts |
|---|---|---|
| 14 | empty attachment cell + Enter | menu present, panel **absent** |
| 15 | filled attachment cell + Enter | panel present, menu absent, `[data-testid="tablify-attachment-pick"]` rendered |
| 16 | menu → *Enter a URL or file path…* | menu gone, `[data-testid="tablify-attachment-panel"]` open with its input focused |
| 17 | menu → *Choose a file…* with `pickFileFromDevice` → `unavailable` (`vi.mock` the module, exactly as `tableViewTitleRow.test.ts:12` does for `commands/export.js`) | fallback message shown, menu stays open, store **not** written (undo stack depth unchanged) |
| 18 | menu → *Choose a file…* with a `File` + stubbed vault | the cell holds the returned vault path, menu closed, **one** undo step, one `Notice`, and **undo** empties the cell |
| 19 | panel's path entry with `https://example.com/a.png` | saves with **no** *Save anyway* warning (D3), while a missing vault path still shows it |
| 20 | *(the re-pointed test #1 of §4.8 must stay green)* | empty cell → menu → panel → missing path → *Save anyway* → stored path |

### 6.4 Not touched

`tests/views/grid/attachment.test.ts`, `attachmentImagePreview.test.ts`, `cellFormatting.test.ts`,
`tests/views/editTriggers.test.ts`, `tests/ui/*`, `tests/format/*`.

---

## 7. Documentation, evidence and gates

### 7.1 Files to write or edit

| File | Change |
|---|---|
| `docs/user-guide.md` §7 (lines 282-289) | Replace *"it never copies or moves your files"* with the real, two-part story: an empty cell offers **Choose a file…** (the file is **copied into your vault**, following *Settings → Files and links → Default location for new attachments*; the cell stores that vault path) or **Enter a URL or file path…**; a filled cell can add another file from the device; a `https://` URL or `data:image/…` URI is stored as-is; undo removes the cell value but not the copied file; on a device that refuses a file picker, Tablify says so and the path field still works. |
| `CHANGELOG.md` → `## [Unreleased]` → **Fixed** | One entry in the house voice: what was broken (no picker existed at all), what now happens (menu with two routes; file copied into the vault via Obsidian's attachment folder; URL stored as-is; fallback message), and the invariants (*no new dependency, no `formatVersion` change, the path field is unchanged*). |
| `docs/evidence/SAD-356.md` | New: baseline vs. after numbers (§1.4 / §7.3), commands run, the automated test list, the two manual device rows (NOT RUN + script), the visual notes (§7.2). |
| `docs/plans/sad-356-attachment-field-plan.md` | This document, plus an **Execution status** block when the work lands (the convention SAD-98's plan uses). |
| *(none)* | No `docs/decisions/` file: nothing architectural is decided beyond §0. `minAppVersion` and the format stay put. |

### 7.2 Visual parity — a documented deviation

`tests/visual/capture-panels.ts` compares the attachment panel against the prototype (`attachment-panel`
182-203, `attachment-row` 205-217). The new *Choose a file…* button and message line are **plugin-only
rows** — the prototype has no equivalent (the same precedent as the plugin-only `.tablify__attach-warn`
row, which is not in the script's `parts` list). So:

1. the new controls are **not** added to `parts`;
2. both notes gain one sentence: *"SAD-356 adds a plugin-only **Choose a file…** button and a status line below the hint (no prototype equivalent), so the card is taller than the prototype's by that row."*;
3. `npx tsx tests/visual/capture-panels.ts` is re-run and the two crops attached to the evidence file. It is **not** part of `npm run check`, so the gate is unaffected either way.

### 7.3 Gates

```
npm run lint          # 0 errors, 119 warnings (baseline unchanged)
npm run test          # 138 files / 2200 tests  →  expect 140 files / ≈2219 tests, all green
npm run check:guard   # no .tabula
npm run check:docs    # links resolve (user-guide + CHANGELOG + evidence)
npm run check:icons   # untouched (A5) — must stay green
npm run build         # main.js builds; record the size delta in the evidence file
npm run check         # all of the above in one go
```

Optional but recommended before closing: `npm run test:fields` (real browser, ~15 s) and
`npx tsx tests/visual/capture-panels.ts` — the two places where this change is observable end-to-end.

### 7.4 Manual verification script (recorded in the evidence file)

| Case | Steps | Expected |
|---|---|---|
| T-M-DEV-SAD356-DESKTOP | New table → Attachments cell (empty) → double-click → *Choose a file…* | The OS dialog opens; the file appears in the vault's attachment folder; the cell shows its chip; **one** Ctrl+Z empties the cell and the file stays; a `Saved to …` notice appeared |
| T-M-DEV-SAD356-DESKTOP-URL | Empty cell → *Enter a URL or file path…* → `https://example.com/a.png` → Enter | Saves immediately, **no** *Save anyway*; a missing `Assets/…` path still warns and still saves after *Save anyway* |
| T-M-DEV-SAD356-DESKTOP-FILLED | A cell that already holds a path → double-click | Today's panel, now with **Choose a file…**; using it replaces the path, one undo step |
| T-M-DEV-SAD356-ANDROID | Obsidian 1.14+ on Android: tap the cell twice → *Choose a file…* | The system picker opens; the photo is copied; the chip appears; no plugin error in `adb logcat`. If no picker: the fallback message appears and the path field works |
| T-M-DEV-SAD356-IOS | Same on iOS | The Files/Photos sheet opens (iOS 11+ WKWebView); same expectations |
| T-M-DEV-SAD356-EMULATE | Desktop `app.emulateMobile(true)` → repeat the Android case | The same code path runs with `Platform.isMobile === true`; nothing is desktop-gated |
| T-M-DEV-SAD356-BIGFILE | Pick a > 25 MB file | Refused with the *too-large* message, nothing written, vault unchanged |

---

## 8. Implementation order (one commit per step, matching the repo's convention)

| # | Commit | Contents | Gate after |
|---|---|---|---|
| 1 | `feat(grid): SAD-356 pure attachment import helpers` | `attachment.ts` (+2 helpers), `attachmentImport.ts`, `attachmentImport.test.ts` | `npx vitest run tests/views/grid/attachmentImport.test.ts tests/views/grid/attachment.test.ts` |
| 2 | `feat(grid): SAD-356 empty-cell attachment menu` | `AttachmentMenu.ts`, `attachmentMenu.test.ts`, CSS block | `npm run lint && npm run check:icons` |
| 3 | `feat(views): SAD-356 choose-a-file in the attachment panel and host wiring` | `AttachmentPanel.ts` (+3 additive pieces), `tableView.ts` (a/b/c), mock stubs, `selectPanels.test.ts` additions **+ the 3 edits of §4.8** | full `npm run test` (+ `npm run test:fields`) |
| 4 | `docs: SAD-356 user guide, changelog, and verification evidence` | user-guide §7, CHANGELOG, `docs/evidence/SAD-356.md`, this plan's status block, `capture-panels.ts` notes + fresh crops | `npm run check` |

---

## 9. Risks

| Risk | Likelihood | Mitigation in the design |
|---|---|---|
| A WebView never opens a chooser | Medium (device-dependent) | `pickFileFromDevice` returns `unavailable`; the menu says so and keeps the path/URL route one tap away (D4). Unit-tested (#9, #17). |
| Large file → mobile OOM | Low–medium | `MAX_IMPORT_BYTES` (25 MB) guard **before** `arrayBuffer()`; the message says what to do instead. *If the owner prefers no cap, delete one `if` and its test.* |
| Two taps needed on touch (A1) is still read as "broken" | Medium | The dead end is gone (the picker exists once the menu opens), but the gesture is unchanged by design. §10 lists the single-tap variant and its cost. |
| The empty-cell pin has to move in 3 places | Certain | Enumerated in §4.8 with the exact edits and the reason; each keeps its original assertion strength. |
| New button shifts the panel's visual-parity crops | Certain, harmless | Recorded as a plugin-only deviation (§7.2) with fresh captures. |
| `getAvailablePathForAttachment` absent on an old app build | Very low (`minAppVersion: 1.14`; API since 1.5.7) | optional in `AttachmentVaultIo`; the dedupe fallback runs instead (tested, #6) |
| Undo leaves the copied file behind | By design | Documented in the guide and the CHANGELOG; the cell value is the only undoable part, as with every field |
| A URL that is not an image shows a paperclip chip | By design (unchanged since SAD-347) | No new behaviour; the field still accepts any string (`attachmentType.validate`) |

---

## 10. Open questions for the owner (not blocking; the plan assumes the stated default)

1. **Single tap on an already-empty Attachment cell?** Today the first tap only selects (SAD-96). Opening
   the menu on the *first* tap of an *empty Attachment cell only* is ~3 lines in `GridView`, but it makes
   that one cell type behave unlike every other cell. Default: **keep the gesture uniform** (A1).
2. **25 MB cap.** Default: **keep** (one `if`; protects phones). Drop it if you prefer no limit.
3. **Keep the picked file's name, or prefix it with the table name?** Default: **keep the name**; Obsidian
   dedupes collisions (`photo 1.jpg`), which is what users expect from Obsidian itself.
4. **Probe a URL** (HEAD request) before storing it? Default: **no** — Tablify has never validated
   reachability, and a network check would make an offline export/sync path depend on the network.
