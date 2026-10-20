# SAD-350 — Export is not working on mobile: investigation and fix plan

**Mode:** Plan only. No code has been changed. Every claim below was verified by reading this
repository's code or by cited external evidence — nothing is guessed. Where a fact can only be
established on a real device, the plan says so explicitly and gates the work on a probe
(§3.0) instead of assuming.

**Issue:** [SAD-350](https://linear.app/sad-mod/issue/SAD-350/export-is-not-working-on-mobile) —
file exporting fails on mobile for **both** entry points: the file's context menu
("Export Tablify Table") and the dedicated Export button (title-row **Export…** and the
`export-table` command). Desktop behavior must be preserved.

**Owner decisions recorded for this plan (2026-10-20):**

1. Tapping **Export** saves the file directly; no multi-step share workflow.
2. **iOS:** use the platform's standard save mechanism — the system **"Save to Files"**
   dialog (presented by iOS when a file is handed to `navigator.share`). The user must be able
   to reach the file afterward.
3. **Android:** use the platform's standard save mechanism too — the system **SAF
   "Create document" save dialog** (`ACTION_CREATE_DOCUMENT`, surfaced to web code as
   `window.showSaveFilePicker`), **not** a silent write into the Download folder. Because
   WebView support for this API depends on the host app and WebView version (§1.4), its
   availability inside Obsidian Android must be probed on a device first; the fallback tier
   for devices where the dialog cannot be shown is defined in §3.3 and confirmed by the probe.
4. Desktop keeps the current save-picker flow unchanged.

---

## 1. Verified root cause

### 1.1 Where exports go today (code walk)

All export entry points converge on one delivery layer:

| Entry point | Path |
|---|---|
| File-explorer menu → "Export Tablify Table" | `src/menus/fileMenu.ts` → `openExportModal()` |
| Title row **Export…** | `src/views/tableView.ts` `openExport()` → `openExportModal()` |
| Command "Export table (CSV, Excel, Markdown)" | `src/commands/export.ts` → `ExportModal` |
| Command "Export current view as CSV" | `src/views/tableView.ts` `exportCurrentViewCsv()` |

Both the modal (`ExportModal.run()`, `src/commands/export.ts`) and `exportCurrentViewCsv()` do:

1. `beginExportSave(...)` — tries `window.showSaveFilePicker` (File System Access API),
   correctly started **inside the click handler** so it holds user activation.
2. `await` pending-edit flush → `await app.vault.read()` → parse → `await buildExportArtifact()`
   (XLSX goes through `write-excel-file` and `blob.arrayBuffer()`).
3. `saveExportArtifact(...)` (`src/io/export/destination.ts`):
   a. picker handle if one was obtained;
   b. if `runtime.isMobile`: `navigator.canShare({files})` / `navigator.share({files})`;
   c. final fallback: a hidden `<a download>` click on a `blob:` URL — and **returns
      `{ ok: true, method: 'download' }` unconditionally when the click does not throw**.

Generation itself (CSV / XLSX / Markdown, scope resolution, formula computation) is pure,
fully unit-tested, and platform-independent — it is **not** the problem. The delivery layer is.

### 1.2 Why every mobile branch fails

Obsidian mobile is a Capacitor app: WKWebView on iOS, Android System WebView on Android.

| Step | iOS | Android |
|---|---|---|
| (a) `showSaveFilePicker` | Not implemented in WKWebView → `unavailable` | Historically absent; since WebView M132 the API can exist but only functions with host-app support (§1.4) — in Obsidian today the observed outcome is that no dialog appears, so the flow falls through |
| (b) `navigator.share({files})` | **Exists and works** (probed on a real iPhone inside Obsidian by the obsidian-orca project¹), **but** it requires *transient user activation*, and the `await` chain in step 2 (vault read, parse, XLSX build) runs **before** the share call. WebKit then rejects with `NotAllowedError`² — which is not `AbortError`, so the code falls through silently. | **Does not exist at all.** Android System WebView never implemented the Web Share API (Chromium issue 765923³; the W3C spec's support table lists "WebView Android: No"⁴). The branch is skipped. |
| (c) `<a download>` blob click | Does nothing in WKWebView — no download manager handles it. The click does not throw. | Does nothing in Android WebView for `blob:` URLs. The click does not throw. |

Net effect on both platforms: the user sees the success notice **"Download started: …"** while
no file is produced anywhere. This exactly matches the issue report.

The repository's own prior investigation anticipated this risk:
`docs/plans/sad-129-export-investigation-plan.md` — *"No actual Obsidian desktop/mobile runtime
test was performed. In particular, native picker availability … and mobile share-sheet behavior
remain to be manually verified."* SAD-350 is that unverified gap surfacing.

### 1.3 Evidence references

1. obsidian-orca issue #272 / PR #319 — real-iPhone probe inside Obsidian mobile: *"The web
   view has `navigator.share` and `navigator.canShare`, and both take a PDF File. Obsidian has
   no share call of its own, and the app carries no Capacitor Share plugin."*
   (github.com/zachhannum/obsidian-orca/issues/272)
2. "The download button that silently did nothing on mobile" (dev.to, 2026) — WebKit:
   `navigator.share()` requires transient user activation, *"and that activation is consumed by
   `await`"*; blob-anchor downloads are silent no-ops in mobile WebViews.
3. Chromium issue 765923 / Capacitor discussion #3213 — *"On Android WebView, navigator.share
   is not implemented."*
4. W3C Web Share API spec support matrix — WebView Android: No (share and canShare).
5. **Single HTML Export** Obsidian plugin (community-approved, ships today) — on Android it
   writes through `window.Capacitor.Plugins.Filesystem.writeFile` (the bridge the Obsidian
   mobile app itself exposes), trying directories `EXTERNAL_STORAGE → EXTERNAL → DOCUMENTS`
   in order because allowed locations vary by Android version; on iOS it hands a `File` to
   `navigator.share`. Its field notes also record that on iOS a Capacitor-Filesystem write
   *succeeds but the user cannot reach the file* — which is why iOS must use the Files dialog.
   (community.obsidian.md/plugins/single-html-export)
6. Obsidian forum (2026-07): Obsidian has **no first-class mobile save/share API** — plugins
   must use exactly these runtime-detected paths.
7. Chrome 132 release notes (Jan 2025): *"File System access shipped on Desktop in Chrome 86,
   with Chrome 132 it's available on Android and WebView"* — i.e. `showSaveFilePicker` backed
   by the SAF `ACTION_CREATE_DOCUMENT` dialog. (developer.chrome.com/release-notes/132)
8. blink-dev "Intent to Ship: File System Access on Android and WebView" + Cordova issue
   thread, Google's clarification: in a WebView the API needs the **host app** to implement
   extended `WebChromeClient#onShowFileChooser` callbacks (read/write flag, save mode), and
   those platform APIs were *"blocked until the next major Android release in 2026"*. So
   whether the dialog actually appears inside Obsidian Android depends on the user's WebView
   version **and** Obsidian's WebChromeClient — a device probe is mandatory (§3.0).
9. Capawesome "Android Scoped Storage in Capacitor Apps" (2026): `Directory.ExternalStorage`
   writes are blocked on Android 11+ regardless of permissions; `Directory.Documents` maps to
   an app-scoped folder on Android 11+. A silent "write to Download/" fallback is therefore
   unreliable on modern devices — an additional reason the SAF dialog is the right primary.

### 1.4 What "standard save dialog" means per platform (constraint summary)

- **Desktop (Electron/Chromium):** `showSaveFilePicker` — already used, works.
- **iOS:** there is no public Downloads folder and no `showSaveFilePicker` in WKWebView. The
  platform's save dialog for WebView content is the **Files sheet** reached by handing a
  `File` to `navigator.share` (evidence 1, 5). This is the iOS path.
- **Android:** the platform's save dialog is **SAF `ACTION_CREATE_DOCUMENT`**, surfaced to web
  code as `showSaveFilePicker` since WebView M132 — but functional inside Obsidian only if
  Obsidian's WebChromeClient cooperates (evidence 7, 8). No other dialog route exists from a
  plugin: Web Share is absent (evidence 3, 4), the Capacitor Filesystem bridge has no picker
  UI, and Obsidian ships no Capacitor Share/FilePicker plugin (evidence 1). Hence: try
  `showSaveFilePicker` first, verify on-device, and define an explicit fallback (§3.3).

---

## 2. Target behavior

| Platform | Export tap does | User feedback |
|---|---|---|
| Desktop | Unchanged: system save picker (start in Downloads) → Electron/browser download fallback | Unchanged notices |
| iOS / iPadOS | Opens the system sheet with the finished file attached; the user picks **Save to Files** (or AirDrop etc.). `AbortError` = cancelled, nothing saved. | "Export ready — choose Save to Files to store *Name.csv* (N rows, M columns)." on success; existing cancel notice on abort |
| Android, SAF dialog available | The system **"Save as"** dialog opens (name prefilled), user picks the location; file is written through the returned handle — same code path as desktop | Existing picker success notice ("Exported … to *Name.csv* in the selected location.") |
| Android, SAF dialog unavailable (probe-gated fallback, §3.3) | Best available non-dialog delivery with an **honest** notice naming the exact location — never a silent no-op | "Saved *Name.csv* to ‹path›." or a clear error |
| Any mobile where no method is available | **No false success.** The blob-anchor fallback becomes desktop-only | "Export failed. No file was saved. …" |

Two correctness requirements shared by both mobile platforms:

- **User activation:** `showSaveFilePicker` and `navigator.share` both demand transient user
  activation. The picker is already started inside the click (correct — keep). For iOS share,
  the artifact must be **prepared before the Export tap** so the tap handler calls `share`
  with no `await` in front of it.
- **Honesty:** every outcome notice must state what actually happened; the current
  unconditional "Download started" success is removed on mobile.

---

## 3. Implementation plan

Scope is deliberately confined to the delivery layer and its two thin callers. Generation
(`prepare.ts`, `view.ts`, `csv.ts`, `xlsx.ts`, `markdown.ts`), menus, import, sync, grid, and
the clipboard Markdown command are untouched.

### 3.0 Phase 0 — Android device probe (blocking gate for §3.3 only)

The one fact that cannot be established from documentation is how Obsidian Android's WebView
answers `showSaveFilePicker` **today** (evidence 8). Before finalizing the Android fallback
tier, run a 5-minute probe on a real Android device (Obsidian ≥ the app version matching
`minAppVersion` 1.14) and record the results in this file (orca-style, cf. evidence 1).

> **Implemented (2026-10-20):** the probe ships as the palette command **“Export destination
> diagnostics”** (`src/commands/export.ts`, `exportDiagnosticsReport()`). It is strictly
> read-only (typeof checks plus a no-UI `canShare` probe), prints the report to the console,
> copies it to the clipboard, and ends with the delivery method the export flow would take on
> that device. Run it on the phone and paste the output below. Item 2 (actually invoking the
> SAF dialog) is simply the Export button itself — if the system “Save as” dialog appears,
> the device is on the picker path.

1. `typeof window.showSaveFilePicker` — present at all?
2. If present: call it from a button tap with a `suggestedName` — does the SAF dialog appear?
   Does `createWritable()/write()/close()` produce a readable file? What error/behavior on a
   second call after cancel?
3. `typeof navigator.share` / `navigator.canShare` — expected `undefined` (confirms §1.2).
4. `Object.keys(window.Capacitor?.Plugins ?? {})` and
   `typeof window.Capacitor?.Plugins?.Filesystem?.writeFile` — fallback surface inventory.
5. Anchor `blob:` download — expected no-op (confirms the false-success removal is needed).

Probe outcomes and their effect on the plan:

- **Dialog works** → Android needs *no new delivery code at all*: the existing picker-first
  chain already covers it. Work reduces to §3.1.d (honest failures), §3.2 (iOS), tests, docs.
- **API absent or dialog never appears** → implement the §3.3 fallback and keep the
  picker-first chain so Android users gain the dialog automatically the moment their
  WebView/Obsidian combination starts supporting it (evidence 8 says that is coming).

The iOS side needs no probe: the share path is already device-verified inside Obsidian by
evidence 1, and the failure mode in our code is explained entirely by lost activation.

### 3.1 `src/io/export/destination.ts` — platform capabilities and delivery strategy

Keep the module pure/injectable (it is unit-tested in Node today); only extend the runtime
surface.

**a. Extend `ExportSaveRuntime`:**

```ts
export interface ExportSaveRuntime {
  isMobile: boolean;
  /** 'ios' | 'android' | null — from Platform.isIosApp / Platform.isAndroidApp. */
  mobilePlatform?: 'ios' | 'android' | null;
  showSaveFilePicker?: (options: SaveFilePickerOptions) => Promise<SaveFileHandle>;
  createFile?: (artifact: ExportArtifact) => File;
  canShareFile?: (file: File) => boolean;
  shareFile?: (file: File) => Promise<void>;
  /** Desktop-only from now on (see §3.1.d). */
  downloadFile?: (blob: Blob, fileName: string) => void;
  /** Probe-gated Android fallback (§3.3); absent unless the bridge exists. */
  saveToFallbackFolder?: (artifact: ExportArtifact) => Promise<FolderSave>;
}
export type FolderSave = { ok: true; displayPath: string } | { ok: false; error: string };
```

**b. New pure strategy selector** (unit-testable without DOM):

```ts
export type ExportDeliveryMethod = 'picker' | 'share' | 'folder' | 'download' | 'none';
export function exportDeliveryMethod(runtime: ExportSaveRuntime): ExportDeliveryMethod;
```

Order: `showSaveFilePicker` → (mobile) file share → (mobile) fallback folder →
(desktop only) download → `none`. Desktop resolves to `picker` as today; Android resolves to
`picker` wherever the SAF dialog is functional, else `folder`; iOS resolves to `share`
(WKWebView has no picker). The picker attempt must keep its current property of being
started inside the click handler — required for user activation on **both** desktop and
Android (evidence: Chrome docs' explicit "get the handle first, then process data" guidance).

One Android-specific hardening: today `beginExportSave` treats any non-`AbortError` picker
rejection as `failed` and later falls through. Keep that, but surface the picker's error
string in the final notice when every later method also fails, so a half-supported WebView
(API present, dialog refused) produces a diagnosable message instead of a silent fallback.

**c. Fallback folder writer (probe-gated, §3.3)** in `browserExportSaveRuntime()`
(feature-detected; absent on desktop and in tests unless injected):

```ts
const fsBridge = (window as any).Capacitor?.Plugins?.Filesystem;
if (typeof fsBridge?.writeFile === 'function') {
  runtime.saveToFallbackFolder = (artifact) =>
    writeToCapacitorFolder(fsBridge, 'Download/Tablify', artifact);
}
```

`writeToCapacitorFolder` (new, exported for tests, bridge injected as a parameter):

- Tries `directory: 'EXTERNAL_STORAGE'`, then `'EXTERNAL'`, then `'DOCUMENTS'` — the
  device-dependent chain proven by Single HTML Export (evidence 5; `EXTERNAL_STORAGE` still
  succeeds on Android ≤ 10, the later entries cover 11+, see evidence 9). First success wins;
  failures are collected into the final error message.
- Text artifacts (CSV, MD): `{ data, encoding: 'utf8', recursive: true }`. The CSV BOM is part
  of the string (`src/io/export/csv.ts`) and survives utf8 writing unchanged.
- Binary artifact (XLSX `ArrayBuffer`): Capacitor writes base64 when `encoding` is omitted —
  add a small chunked `arrayBufferToBase64()` helper (chunked to avoid call-stack limits).
- **Never overwrite:** probe with `fsBridge.stat` and pick a numbered free name
  (`Name 2.csv`, …), reusing the naming rule of `pickFreePath`
  (`src/io/import/importer.ts`); if `stat` is unavailable, fall back to a timestamp suffix.
- Returns a user-readable `displayPath` (strip `file:///storage/emulated/0/`,
  percent-decoded) so the notice tells the user exactly where the file is.

**d. Stop the false success:** in `saveExportArtifact`, run the `downloadFile` fallback only
when `!runtime.isMobile`. On mobile, if picker/share/folder are unavailable or failed, return
`{ ok: false, error }` with the collected reasons. This single change already converts the
current silent failure into an honest error even before the new paths are added, and is
shippable on its own (§7, commit 1).

**e. Share result semantics:** keep `AbortError → cancelled`. `navigator.share` resolving
means the sheet action completed — iOS does not report *where* the user put the file
(evidence 2), so the success wording says "choose Save to Files" rather than claiming a
location.

### 3.2 `src/commands/export.ts` — `ExportModal`: prepare early, deliver on tap

Desktop flow is untouched. Mobile changes:

- **On open** (mobile only): `flushPendingExportEdits()` once, then start
  `prepareExportFile()` for the current (format, fullTable) selection and cache the settled
  result as `{ key, prepared }`. Re-run preparation whenever the dropdown/toggle changes.
  The table cannot be edited while the modal is open, so the snapshot cannot go stale.
- **Export tap, Android with working picker (`method === 'picker'`):** unchanged behavior —
  `beginExportSave` fires inside the tap (activation held); the pre-prepared artifact is then
  written through the handle. Pre-preparation also shrinks the gap between dialog dismissal
  and the write.
- **Export tap, iOS (`method === 'share'`):** if the cached preparation for the current key is
  settled-ok, build the `File` and call `runtime.shareFile(file)` **synchronously in the click
  handler** — no `await` before the call, preserving transient activation. If preparation is
  still in flight (slow storage / huge table), `await` it, attempt the share, and if WebKit
  rejects with `NotAllowedError`, swap the modal body to a single **"Save file"** CTA whose
  fresh tap repeats the share with the now-cached `File` (guaranteed-valid activation). This
  keeps one-tap behavior in practice with a safe, rare fallback instead of a hard failure.
- **Export tap, Android fallback (`method === 'folder'`):** no activation constraint —
  `await` the cached preparation, call `runtime.saveToFallbackFolder(artifact)`, show the
  path notice.
- **`method === 'none'`:** error notice, nothing saved (replaces today's fake
  "Download started").
- Success messages: extend `exportSuccessMessage()` with reworded `'share'` (Files dialog)
  and new `'folder'` methods; `'picker'` wording is reused on Android.

`browserExportSaveRuntime()` gains the platform tag:
`browserExportSaveRuntime(Platform.isMobile, Platform.isIosApp ? 'ios' : Platform.isAndroidApp ? 'android' : null)`
— both flags are long-standing public `Platform` fields.

### 3.3 Android fallback tier (only if the §3.0 probe shows the SAF dialog cannot appear)

Per the owner decision the dialog is the Android mechanism; this tier exists so that devices
whose WebView/Obsidian combination cannot show it (evidence 8) still get a working, honest
export instead of today's silent failure:

- Delivery: `writeToCapacitorFolder` (§3.1.c) targeting `Download/Tablify/` where the OS
  allows it, app-scoped Documents otherwise; the notice always names the real path.
- The picker stays first in the chain permanently, so these devices upgrade themselves to the
  standard dialog as soon as their WebView/Obsidian supports it — no further code change.
- If the probe instead shows the dialog working, this whole tier is dropped from the
  implementation (§3.1.c is then not built), keeping the diff minimal per the issue's
  "no unnecessary code" constraint.

### 3.4 `src/views/tableView.ts` — `exportCurrentViewCsv()`

Same delivery rules via a small shared helper (extracted so both callers stay thin — no third
copy of the logic):

- The current-view table is already in memory (`currentViewTable()`), and `toCsv` is pure and
  synchronous, so the artifact can be built with only microtask-level delay inside the
  command callback; picker (Android/desktop) starts inside the callback as today; iOS share
  is attempted immediately, with the same `NotAllowedError → one-button retry modal` net.
- Android fallback tier: build then `saveToFallbackFolder`, path notice.
- Desktop: unchanged.

### 3.5 Explicitly out of scope (non-regression guard)

- `src/io/export/{prepare,view,csv,xlsx,markdown,exporter}.ts` — no behavior change
  (only the `arrayBufferToBase64` helper is new, placed in `destination.ts`).
- Desktop picker/download flows, success/cancel notices, and the "never write into the vault"
  rule — unchanged on desktop **and** on mobile: iOS → Files dialog, Android → SAF dialog
  (or, fallback tier only, a public folder outside the vault). Nothing is ever silently
  written into the vault.
- `copyCurrentViewMarkdown` (clipboard), import, file-menu model, sync, grid — untouched.
- The file-menu entry (`fileMenu.ts`) needs **no change**: it already routes to the modal,
  which is where the fix lives — both reported broken entry points are covered by §3.2.

---

## 4. Test plan

### 4.1 Unit tests (extend existing suites; all injectable, no real DOM/Capacitor needed)

`tests/io/export.destination.test.ts` (extends the existing file):

- `exportDeliveryMethod()` matrix: desktop+picker → `picker`; Android+picker → `picker`;
  iOS (share capable, no picker) → `share`; Android (no picker, no share, folder bridge) →
  `folder`; desktop no picker → `download`; mobile with nothing → `none`.
- **Mobile never reports a download:** runtime `{ isMobile: true, downloadFile }` with no
  other method → `{ ok: false }` with error (regression test for the false success).
- Picker-failure diagnostics: `failed` picker + no other mobile method → error message
  contains the picker's reason (§3.1.b hardening).
- `writeToCapacitorFolder` with a fake bridge (built only if §3.3 ships): directory fallback
  order `EXTERNAL_STORAGE → EXTERNAL → DOCUMENTS`; first success wins; utf8 vs base64
  payloads (CSV keeps its BOM; XLSX round-trips byte-identically); collision → numbered name;
  all directories failing → aggregated error.
- `arrayBufferToBase64`: empty, 1-byte, chunk-boundary, and multi-chunk buffers against
  Node's `Buffer.toString('base64')`.
- Share rejection taxonomy: `AbortError` → cancelled; `NotAllowedError` → distinct
  "activation" failure kind the modal can react to (retry CTA), not a generic failure.

`tests/menus/fileMenuWiring.test.ts` / new `tests/io/export.modal.mobile.test.ts` (follows the
existing modal-test pattern; `tests/__mocks__/obsidian.ts` already exports a `Platform` mock —
add `isIosApp` / `isAndroidApp` fields there):

- iOS modal: preparation starts on open; Export tap calls `shareFile` with a `File` whose
  name/type/bytes match the selected format, and **the recorded call order shows no vault
  read between tap and share** (fake runtime + fake read log).
- Option change re-prepares; the shared `File` always matches the latest selection.
- `NotAllowedError` on first attempt → modal shows the "Save file" CTA; its tap shares the
  cached file and closes.
- Android modal with picker: `showSaveFilePicker` is called from the tap with the right
  suggested name/MIME, and the pre-prepared bytes are written through the handle.
- Android fallback modal (if §3.3 ships): Export tap → `saveToFallbackFolder` called with the
  artifact; success notice contains the display path; failure notice contains the aggregated
  reasons; nothing written into the vault in any case.
- Desktop modal: behavior byte-for-byte identical to today's tests (guard against regression).

`tests/views/tableController.test.ts` area: `exportCurrentViewCsv()` per-platform delivery.

### 4.2 Repo gates

`npm run check` (lint, vitest, tabula guard, docs links, icons, build) must pass — same gate
as SAD-129/SAD-347.

### 4.3 Manual device verification (the step SAD-129 skipped — required before closing)

Matrix, each cell exercising cancel + success:

| | iPhone (iOS) | iPad | Android phone |
|---|---|---|---|
| §3.0 probe recorded in this file | n/a (covered by evidence 1) | n/a | **first, before fallback work** |
| File-menu "Export Tablify Table" × CSV/XLSX/MD | Files dialog; file readable afterward in the Files app | same | SAF save dialog (or fallback path notice); file readable in the chosen location |
| Title-row **Export…** / command palette | same | same | same |
| "Export current view as CSV" command | same | same | same |
| Pending edit made just before export | exported file contains the edit | — | same |
| Cancel at the system dialog | "Export cancelled", nothing saved | same | same (SAF cancel → `AbortError`) |
| Desktop (Win/macOS/Linux) regression | picker opens in Downloads, download fallback unchanged | | |

Also verify: XLSX opened in Excel/Sheets after an Android save (binary integrity through the
handle, and through base64 if §3.3 ships); repeated exports never overwrite (SAF appends
"(1)" itself — evidence: Android docs; the fallback uses numbered names); iOS cancel leaves
no notice other than "Export cancelled".

---

## 5. Risks and mitigations

| Risk | Mitigation |
|---|---|
| `showSaveFilePicker` exists in Obsidian Android's WebView but the dialog never appears (host-app gap, evidence 8) | §3.0 probe decides before implementation; §3.1.b surfaces the picker's own error text; picker-first chain + fallback tier means users are never stranded, and the standard dialog activates automatically once the WebView/Obsidian support lands |
| WebKit's transient-activation window varies across iOS versions | Artifact is prepared **before** the tap, so the share call carries zero awaited work in the common path; the `NotAllowedError` retry CTA covers the residual case deterministically |
| Scoped storage blocks `EXTERNAL_STORAGE` on Android 11+ (evidence 9) — fallback tier only | Directory fallback chain with honest path reporting; aggregated error if all fail — never a silent no-op |
| Obsidian might change/remove the Capacitor bridge | Everything is feature-detected at runtime; absence degrades to an explicit error notice, never a crash or false success |
| Large XLSX → base64 memory/stack pressure (fallback tier only) | Chunked conversion; realistic table sizes are far below WebView limits |
| `navigator.share` resolving ≠ file saved (user may pick another target) | Honest notice wording ("choose Save to Files"); an iOS platform limitation, documented in the user guide |
| Desktop regressions | Desktop code path is untouched; dedicated regression tests pin current behavior |

---

## 6. Documentation updates

- `docs/user-guide.md` §13: replace the incorrect "mobile share sheet … otherwise a
  browser/Electron download" paragraph with the actual per-platform behavior (iOS Files
  dialog; Android SAF save dialog, with the fallback behavior described only if §3.3 ships;
  desktop unchanged).
- This plan file records the §3.0 probe results and, after implementation, the verification
  evidence (repo convention, cf. `sad-129-…`, `sad-347-…`).
- Changelog entry for the next beta.

## 7. Implementation record (2026-10-20)

Implementation was authorized on 2026-10-20 with two owner decisions: commit directly to
`main`, and build the §3.3 Android fallback now (feature-detected; the §3.0 on-device probe
remains open and only documents which path a given device takes — no outcome requires a code
change).

Delivered, as the commit slicing below:

1. `16752ab` — the download fallback is desktop-only; a mobile failure reports the real
   reason every method was skipped or failed (§3.1.d). 3 regression tests.
2. `195f3dd` — iOS: `exportDeliveryMethod()` + `shareExportArtifact()` (outcome taxonomy:
   cancelled / activation / unsupported / failed); the Export modal pre-builds per
   (format, fullTable) choice and the tap reaches the share call synchronously;
   `ExportShareRetryModal` covers a preparation that outlives the tap; the current-view CSV
   command shares the in-memory view the same way (§3.2, §3.4). 6 jsdom modal tests pin the
   tap→share ordering, re-preparation, cancel, retry and honest failures.
3. `e094f3f` — Android: the SAF dialog needs no new delivery code (picker-first, started
   inside the tap — §3.2); the §3.3 fallback ships as `writeToCapacitorFolder()` behind
   runtime feature detection (`EXTERNAL_STORAGE → EXTERNAL → DOCUMENTS`, numbered or
   timestamped collision-free names, utf8 for text with the CSV BOM preserved, chunked
   base64 for XLSX, decoded display paths, aggregated honest errors). 11 tests including an
   Android modal end-to-end.
4. Docs: user guide §13 rewritten per platform, changelog entry, this record.

Deviation from §3.1.a: the planned `mobilePlatform` runtime tag was **not** added — every
decision is capability-based (`exportDeliveryMethod`), so the tag would have been dead code.
All other sections were implemented as written.

### Verification results

- Full suite after each commit; final state: **137 files, 2,191 tests, all passing**
  (2,171 at baseline → 20 new tests).
- `npm run lint`: 0 errors; the 119 pre-existing warnings are unchanged.
- `npm run build`, `npm run check:docs`, `npm run check:icons`, `npm run check:guard`: pass.
- Desktop regression: the pre-existing export modal, destination, title-row and view suites
  run unmodified except for the three new mobile expectations; all pass.
- **Outstanding manual step (§4.3):** the §3.0 Android probe and the device matrix (iPhone /
  iPad / Android phone, three formats, both entry points, cancel paths) still need a run on
  real hardware before release — the same step SAD-129 recorded as skipped. Probe results
  should be appended here.

## 8. Suggested commit slicing (as planned)

1. `fix(export): SAD-350 remove false download success on mobile` (§3.1.d + its tests) —
   smallest honest-failure fix, independently shippable before the probe.
2. `feat(export): SAD-350 iOS Files-dialog save with activation-safe share` (§3.2 iOS branch,
   §3.4, tests).
3. *(probe-dependent)* `feat(export): SAD-350 Android delivery` — either nothing beyond
   commit 1 (dialog already works via the existing picker-first chain) or the §3.3 fallback
   tier with its tests.
4. `docs: SAD-350 user guide + probe results + plan verification evidence`.
