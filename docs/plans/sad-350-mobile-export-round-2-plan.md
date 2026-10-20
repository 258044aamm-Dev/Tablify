# SAD-350 (round 2) — "Export cancelled" on Android: verified root cause and fix plan

**Mode:** Plan only. No source file was changed. Every claim below is either a line in this
repository (cited as `file:line`) or external evidence (cited as a footnote). Where a fact can
only be established on hardware, this plan says so and puts a probe there instead of assuming.

**Issue:** [SAD-350](https://linear.app/sad-mod/issue/SAD-350/export-is-not-working-on-mobile)
— *Export is not working on mobile.*

**Why a round 2 exists.** The round-1 fix is on `main` (`deae6f6` … `7c786ab`, see
`docs/plans/sad-350-mobile-export-plan.md`). On 2026-10-20T14:09Z, six hours after the last round-1 commit
(07:48Z), the owner reopened it with a precise symptom (Linear comment `6389e4bd`):

> "When I tap the Export button, a message indicates that the 'Export canceled, and no file was
> saved'."

That message is not generic: the exact string is emitted from six places
(`src/commands/export.ts:203,372,397`; `src/views/tableView.ts:362,376,392`). Tracing which of
them can fire on Android — and why a system dialog never appears — identifies the defect without
ambiguity (§2).

**Repository state analysed:** `main` @ `325faf8`, version `2.0.0-beta.6`.
**Baseline I ran before writing this:** `npx vitest run tests/io tests/commands tests/menus` →
**25 files / 233 tests, all passing** (unmodified checkout).

---

## 0. TL;DR

| | |
|---|---|
| **Root cause** | On Android, `window.showSaveFilePicker` **exists** (WebView ≥ 132) but Obsidian's WebView host does not implement the save-mode chooser, so Chromium cancels the request without showing a dialog and rejects with `AbortError`. `beginExportSave()` maps `AbortError → 'cancelled'` (`src/io/export/destination.ts:135`), and both callers treat `'cancelled'` as a **terminal, successful-to-abort outcome** (`src/commands/export.ts:371`, `src/views/tableView.ts:375`). The export therefore dies before the share/folder fallbacks that already exist and already work. |
| **Why round 1 missed it** | It assumed "the picker function exists ⇒ the dialog opens". The test suite pins that assumption (`tests/io/export.destination.test.ts:158-174`: mobile + picker ⇒ `'picker'`), and no test models a picker that exists but aborts instantly. |
| **Fix** | (1) Give the runtime a platform tag. (2) Stop equating *"no dialog appeared"* with *"the user cancelled"* on Android — classify a fast, focus-less `AbortError` as **`unavailable`** and let the existing chain continue. (3) Add the owner-requested opt-in vault fallback as the last resort. |
| **Diff size** | ~110 lines of production code across 5 files + 1 settings toggle; no change to export generation, menus, iOS, or desktop. |

---

## 1. The reported symptom, exactly

Owner's answer when asked when the notice appears:

> "It's a dialog for choosing a file format, like CSV, Excel, or Markdown. Then, when I tap the
> export button, I see that notice."

So the sequence is:

1. Export modal opens normally (format dropdown + **Full table** toggle + **Export** button).
2. Tap **Export**.
3. **No system dialog ever appears.**
4. Immediately: *"Export cancelled. No file was saved."*

That description is what makes the diagnosis below deterministic rather than speculative.

---

## 2. Root cause — verified

### 2.1 The exact code path

```
Tap Export  (ExportModal, src/commands/export.ts:289-297)
  └─ exportDeliveryMethod(runtime)  … src/commands/export.ts:292
       └─ returns 'picker' if window.showSaveFilePicker exists   (destination.ts:76,
          checked BEFORE every mobile branch — lines 76-80)
  └─ this.run()                                                (export.ts:364)
       ├─ beginExportSave(...)                                 (export.ts:369)
       │    └─ showSaveFilePicker(options)                     (destination.ts:132)
       │         └─ rejects with AbortError
       │              └─ isAbortError ? { kind: 'cancelled' }  (destination.ts:135)
       ├─ if (picker.kind === 'cancelled')                     (export.ts:371)
       │    └─ new Notice('Export cancelled. No file was saved.') (export.ts:372)
       │    └─ return;                          ← ⚠ the chain ends here
       └─ saveExportArtifact(...)   ← never reached: share → folder → … (destination.ts:178-191)
```

The same shape exists in the second entry point, `exportCurrentViewCsv()`
(`src/views/tableView.ts:373-377`), and in `saveExportArtifact()` itself
(`src/io/export/destination.ts:151`), which also returns `{ ok: false, cancelled: true }` for a
picker cancellation and skips every fallback.

### 2.2 Only one path can produce that notice in that situation

This is a deduction from the code, not a guess:

| Method | On Android | Would it print "cancelled"? |
|---|---|---|
| `'share'` (`destination.ts:77`) | `navigator.share` does not exist in Android System WebView [3][4] | No — branch not taken |
| `'folder'` (`destination.ts:78`) | Capacitor bridge present | No — a folder failure returns `{ ok:false, error }`, printed as *"Export failed…"* |
| `'download'` (`destination.ts:79`) | Excluded on mobile since `16752ab` | No |
| **`'picker'`** (`destination.ts:76`) | `showSaveFilePicker` **exists** in WebView ≥ 132 [1][8] | **Yes** — and it is the only one that does |

So on the owner's device the runtime resolves to `'picker'`, the picker rejects with
`AbortError`, and the "cancelled" branch fires. If `showSaveFilePicker` were absent, the device
would fall to `'folder'` and the export would have worked — which is exactly why round 1 passed
review while failing on hardware.

### 2.3 Why the picker aborts instead of opening a dialog

`showSaveFilePicker` in a WebView is **not** the browser implementation. Chromium delegates the
request to the embedding app through `WebChromeClient#onShowFileChooser()`; the File System
Access API is **disabled by default** in WebView precisely because existing apps do not expect
the new modes [5]. When the host does not handle `MODE_SAVE`, Chromium cancels the request
without showing anything and rejects with:

> `AbortError: Failed to execute 'showSaveFilePicker' on 'Window': The user aborted a request.`

This is documented as the observed behaviour of WebView 132+ in Cordova's `SystemWebChromeClient`
issue [2] and reproduced in another embedded browser [7] — where the report explicitly says:
*"An instant AbortError suggests the guest has no file-select handler for File System Access, so
Chromium cancels the request without showing a dialog."* Android's own
`FileChooserParams.MODE_SAVE` reference [6] confirms the save mode requires explicit host
implementation.

**What remains hardware-dependent** (and is therefore probed, not assumed): whether *Obsidian's*
`WebChromeClient` implements it today. The owner's report — no dialog, instant notice — is the
answer for their device: it does not. The fix must be correct for **both** outcomes, and §4.2
makes it so.

### 2.4 Why the already-shipped fallbacks never run

`saveExportArtifact()` contains the working Android tiers — share (`:178`), Capacitor folder
write (`:187`), desktop download (`:196`). All three sit **after** this line:

```ts
// src/io/export/destination.ts:151
if (picker.kind === 'cancelled') return { ok: false, cancelled: true };
```

`ExportModal.run()` never even gets that far: it returns at `src/commands/export.ts:371-374`.
The fallback code is not broken; it is **unreachable** whenever the picker aborts. That is why
`Download/Tablify` (implemented and unit-tested at `destination.ts:238-264`) has never written a
file on this device.

### 2.5 Why no test caught it

The suite encodes the faulty premise:

```ts
// tests/io/export.destination.test.ts:167 — currently asserts the buggy ordering
expect(exportDeliveryMethod({ isMobile: true, showSaveFilePicker: picker, ...share, ...folder }))
  .toBe('picker');
```

and

```ts
// tests/io/export.destination.test.ts:57-62
it('treats picker cancellation as cancellation and does not fall back to a download', …)
```

Both are correct for **desktop**. Neither models "the picker exists but the platform never
presented a UI" — the only case that fails on Android. The round-1 plan even predicted this
risk in its §5 risk table ("`showSaveFilePicker` exists in Obsidian Android's WebView but the
dialog never appears … §3.0 probe decides before implementation") — and the probe was never run
before shipping. This plan puts the probe *in the code path*, permanently, instead of in a
checklist.

### 2.6 Ruled out explicitly (so the diff stays small)

| Suspect | Verdict | Evidence |
|---|---|---|
| CSV/XLSX/Markdown generation | Not involved — nothing is generated before the picker call | `export.ts:369` runs before `prepareExportFile` at `:383` |
| File-menu wiring | Not involved — it calls the same `openExportModal()` | `src/menus/fileMenu.ts:99` → `src/commands/export.ts:84` |
| `Capacitor Filesystem` writer | Implemented and unit-tested; simply unreachable | `destination.ts:238-264`, tests 189-265 |
| iOS share path | Not involved on Android; untouched by this plan | `destination.ts:94-110`, `tests/commands/export.modal.mobile.test.ts` |
| `Platform.isMobile` detection | Correct | `export.ts:258`, `tableView.ts:341` |
| Obsidian API misuse | None — `showSaveFilePicker` is a real browser API, correctly feature-detected; the *capability inference* is what is wrong | `destination.ts:346-348` |

---

## 3. Owner decisions recorded for this round (2026-10-20)

1. **Device:** Android.
2. **Symptom timing:** notice appears on tap; **no system dialog is ever shown**.
3. **Android strategy:** *keep the system dialog first*, detect the silent abort, then fall back
   to `Download/Tablify`.
4. **Last resort:** allow an **opt-in** vault write (setting, **off by default**).

---

## 4. Design

### 4.0 The principle

> **"No dialog appeared" is not "the user cancelled".**

`AbortError` is overloaded: it means *user dismissed the UI* **and** *the UI was never shown*
(spec: "rejected if the user dismisses, **or if there are no share targets available**" [9]).
Desktop can treat it as a cancel because the dialog is guaranteed to be presentable. On Android
it cannot. The fix teaches the delivery layer the difference using a signal this repository has
already field-proven for `<input type="file">`.

**Existing precedent in this codebase** — `pickFileFromDevice()`
(`src/views/grid/attachmentImport.ts:43-101`):

```ts
export const NO_CHOOSER_MS = 1500;   // :43
// "A native chooser takes the window's focus: stop the 'nothing happened' clock while it is away."
win?.addEventListener('blur', onBlur, { once: true });   // :101
timer = timers.setTimeout(() => cleanup({ kind: 'unavailable' }), noChooserMs);  // :103
```

It answers **`unavailable`** — never `cancelled` — when a WebView silently fails to present a
chooser. `beginExportSave()` has no equivalent. Adding it is the whole fix.

### 4.1 Platform tag on the runtime

`browserExportSaveRuntime()` receives only `isMobile` (`destination.ts:321`), so the delivery
layer cannot tell Android from iOS. The round-1 plan specified a `mobilePlatform` tag
(§3.1.a) and its implementation record admits it was dropped ("would have been dead code").
It is no longer dead code: the abort policy is Android-specific by definition.

```ts
// destination.ts
export type MobilePlatform = 'ios' | 'android' | null;

export interface ExportSaveRuntime {
  isMobile: boolean;
  /** SAD-350 round 2: selects the AbortError policy in beginExportSave(). */
  mobilePlatform?: MobilePlatform;
  // …existing fields unchanged…
}
```

Wiring (3 call sites → one helper, §5.2):

```ts
export function browserExportSaveRuntime(isMobile: boolean, mobilePlatform: MobilePlatform = null): ExportSaveRuntime
```

The parameter is **optional and defaulted**, so every existing test and the visual harness keep
compiling and behaving exactly as before (they get `null` → desktop policy).

### 4.2 Classify a silent abort as `unavailable`, not `cancelled`

No new `ExportPickerStart` variant is needed — `'unavailable'` already exists
(`destination.ts:56`) and is already handled by :

- `saveExportArtifact()` → falls through to the share/folder tiers (only `'cancelled'` is terminal, `:151`);
- `ExportModal.run()` → no early return (only `'cancelled'` is, `export.ts:371`);
- `exportCurrentViewCsv()` → same (`tableView.ts:375`).

Add one optional field so the reason survives to the error message:

```ts
export type ExportPickerStart =
  | { kind: 'handle'; handle: SaveFileHandle }
  | { kind: 'unavailable'; reason?: string }     // ← reason added
  | { kind: 'cancelled' }
  | { kind: 'failed'; error: string };
```

**The classifier** (Android only; desktop and iOS keep today's behaviour byte-for-byte):

```ts
/**
 * SAD-350 round 2: an AbortError that arrives without the app ever losing focus, and sooner
 * than a human could dismiss a dialog, is a WebView that never presented one — not a cancel.
 * Same signal, same reasoning as pickFileFromDevice() (views/grid/attachmentImport.ts:93-103).
 */
export const PICKER_SILENT_ABORT_MS = 1000;

function watchPickerPresentation(enabled: boolean): { presented(): boolean; stop(): void } {
  if (!enabled || typeof window === 'undefined') return { presented: () => true, stop: () => {} };
  let seen = false;
  const mark = (): void => { seen = true; };
  const onVisibility = (): void => { if (document.visibilityState === 'hidden') seen = true; };
  window.addEventListener('blur', mark);
  document.addEventListener('visibilitychange', onVisibility);
  return {
    presented: () => seen,
    stop: () => {
      window.removeEventListener('blur', mark);
      document.removeEventListener('visibilitychange', onVisibility);
    },
  };
}
```

Applied inside `beginExportSave()` (replacing the two bare `isAbortError` ternaries at
`destination.ts:135` and `:139`, both of which funnel through one local function):

```ts
const startedAt = Date.now();
const watch = watchPickerPresentation(runtime.mobilePlatform === 'android');
const settleError = (error: unknown): ExportPickerStart => {
  const elapsedMs = Date.now() - startedAt;
  const presented = watch.presented();
  watch.stop();
  if (!isAbortError(error)) {
    recordPickerAttempt({ elapsedMs, presented, errorName: nameOf(error), outcome: 'failed' });
    return { kind: 'failed', error: errorMessage(error) };
  }
  const silentAbort =
    runtime.mobilePlatform === 'android' && !presented && elapsedMs <= PICKER_SILENT_ABORT_MS;
  recordPickerAttempt({
    elapsedMs: elapsedMs, presented,
    errorName: 'AbortError',
    outcome: silentAbort ? 'unavailable' : 'cancelled',
  });
  return silentAbort
    ? { kind: 'unavailable', reason: 'The system save dialog did not open on this device.' }
    : { kind: 'cancelled' };
};
```

**Why this cannot regress desktop:** `watchPickerPresentation` is a no-op unless
`mobilePlatform === 'android'` (`presented()` returns `true`), so the condition
`!presented` is false and the result is always `'cancelled'` — the exact current behaviour,
guarded by the existing tests at `tests/io/export.destination.test.ts:57-62, 91-112`.

**Honest limitation (documented in code and §8):** if some Android build presents the dialog
*inside* the WebView without any focus change, a genuine cancel within 1000 ms would be treated
as a silent abort and the file would be written to `Download/Tablify` instead of discarded. The
outcome is non-destructive (unique name, path announced) and the two signals plus a named
constant make it tunable.

### 4.3 Error text carries the reason

In `saveExportArtifact()`, extend the reason collection so a final failure explains itself:

```ts
// destination.ts, replacing line 176
if (picker.kind === 'failed') reasons.push(`Save picker failed: ${picker.error}.`);
else if (picker.kind === 'unavailable' && picker.reason) reasons.push(picker.reason);
```

### 4.4 Both callers stay as they are (deliberately)

`ExportModal.run()` (`export.ts:364-403`) and `exportCurrentViewCsv()` (`tableView.ts:337-397`)
need **no control-flow change**: `'cancelled'` remains terminal (a real cancel must not then
write a file), and `'unavailable'` already flows into `saveExportArtifact()`'s chain. The only
edits in these files are the platform tag (§4.1) and the opt-in vault hook (§4.5).

### 4.5 Opt-in vault fallback (owner decision 4)

Kept **off by default**, so documented behaviour ("no destination silently writes into the
vault", `docs/user-guide.md` §13) is unchanged unless the user asks for the safety net.

- `destination.ts` gains one optional tier, expressed as a capability like every other:

```ts
export interface ExportSaveRuntime {
  // …
  /** SAD-350 round 2: opt-in last resort when no native destination works. */
  saveToVault?: (artifact: ExportArtifact) => Promise<FolderSave>;
}
```

  ordered **after** the Capacitor folder tier and **before** the desktop download tier
  (desktop runtimes never receive it, so desktop is untouched):

```ts
if (runtime.saveToVault) {
  const saved = await runtime.saveToVault(artifact);
  if (saved.ok) return { ok: true, method: 'vault', fileName: saved.fileName, displayPath: saved.displayPath };
  reasons.push(saved.error);
}
```

- `ExportSaveResult['method']` gains `'vault'`; `exportSuccessMessage()` gains one line —
  **in both copies** (`src/commands/export.ts:169` and `src/views/tableView.ts:1867`, the
  function is duplicated today).

- The Obsidian-aware writer lives in the wiring layer (not in the pure module), next to
  `flushPendingExportEdits()`:

```ts
/** SAD-350 round 2: opt-in last resort — write next to the table, never overwriting.
 *  Reuses the import/export shared naming rule (src/io/import/importer.ts:49). */
export async function writeExportToVault(app: App, source: TFile, artifact: ExportArtifact): Promise<FolderSave> {
  const folder = source.parent?.path ?? '';
  const dot = artifact.fileName.lastIndexOf('.');
  const base = dot === -1 ? artifact.fileName : artifact.fileName.slice(0, dot);
  const ext = dot === -1 ? 'txt' : artifact.fileName.slice(dot + 1);
  const path = pickFreePath(folder, base, (p) => app.vault.getAbstractFileByPath(p) !== null, ext);
  if (!path) return { ok: false, error: 'No free file name found in the vault.' };
  try {
    if (typeof artifact.data === 'string') await app.vault.create(path, artifact.data);
    else await app.vault.createBinary(path, artifact.data);
  } catch (error) {
    return { ok: false, error: `Could not write into the vault: ${error instanceof Error ? error.message : String(error)}` };
  }
  return { ok: true, fileName: path.split('/').pop() ?? artifact.fileName, displayPath: path };
}
```

- Setting plumbing: one boolean in `TablifySettings`, persisted and normalized like the token;
  the plugin injects a getter so `ExportModal`/`TableView` (which only receive `App` + `TFile`)
  can read it without changing their constructors:

```ts
// commands/export.ts
let exportPreferences: () => { vaultFallback: boolean } = () => ({ vaultFallback: false });
export function setExportPreferences(get: () => { vaultFallback: boolean }): void { exportPreferences = get; }
```

```ts
// main.ts:23 — after registerExportCommand(this)
setExportPreferences(() => ({ vaultFallback: this.settings.exportVaultFallback }));
```

### 4.6 Diagnostics: record the last real attempt

The existing read-only probe reports `typeof showSaveFilePicker` and
`chosen delivery method`, neither of which can tell a working dialog from a silent abort
(`src/commands/export.ts:94-134`). Add a 15-line module-level record, written by actual
exports and read by the probe — no new UI, no new command, no test churn:

```ts
export interface PickerAttemptRecord {
  elapsedMs: number;
  presented: boolean;
  errorName: string;
  outcome: ExportPickerStart['kind'];
}
export function lastExportPickerAttempt(): PickerAttemptRecord | null;
```

New probe line: `last picker attempt: 4 ms, no focus change, AbortError → unavailable`.
That single line is what turns "it doesn't work on my phone" into a measurement.

---

## 5. Changes, file by file

| File | Change | Lines |
|---|---|---|
| `src/io/export/destination.ts` | `MobilePlatform`, `mobilePlatform?`, `saveToVault?`, `unavailable.reason?`, `PICKER_SILENT_ABORT_MS`, `watchPickerPresentation()`, classifier in `beginExportSave()`, reason collection, vault tier, `'vault'` in result, `browserExportSaveRuntime(isMobile, mobilePlatform?)`, `lastExportPickerAttempt()` | ~85 |
| `src/commands/export.ts` | `deviceRuntime()` helper (replaces 2 duplicated runtime constructions), `writeExportToVault()`, `setExportPreferences()`, vault hook in `ExportModal`, `'vault'` notice, one diagnostics line | ~35 |
| `src/views/tableView.ts` | `deviceRuntime()` in `exportCurrentViewCsv()`, vault hook, `'vault'` notice in its duplicate `exportSuccessMessage()` | ~10 |
| `src/settings.ts` | `exportVaultFallback: boolean` (default `false`), normalization, persistence, one settings toggle under a new **Export** heading | ~20 |
| `src/main.ts` | `setExportPreferences(...)` after `registerExportCommand(this)` | 2 |
| `tests/__mocks__/obsidian.ts` | add `vault.create` (mock currently has only `createBinary`, line 214) | 1 |
| `docs/` | user guide §13, changelog, this file's verification record | — |

**Not touched:** `src/io/export/{prepare,view,csv,xlsx,markdown,exporter}.ts`,
`src/io/import/*`, `src/menus/*`, `src/format/*`, `src/model/*`, `src/sync/*`,
`src/views/grid/*`, `src/embed/*`.

---

## 6. Test plan

### 6.1 `tests/io/export.destination.test.ts` (unit, no DOM)

1. **The regression itself:** Android + `showSaveFilePicker` that rejects instantly with
   `AbortError` + `saveToFallbackFolder` succeeds ⇒ result `{ ok: true, method: 'folder', … }`
   and the bridge received the bytes. *(This test fails on `main` today — proof the fix works.)*
2. A fast abort **with** a focus change ⇒ `{ kind: 'cancelled' }`, no folder write.
3. A slow abort (> `PICKER_SILENT_ABORT_MS`) with no focus change ⇒ `'cancelled'` (conservative).
4. `mobilePlatform: null` (desktop / unset) ⇒ unchanged: fast abort is still `'cancelled'` and
   `downloadFile` is not called. *(Pins non-regression.)*
5. `beginExportSave()` returns `{ kind:'unavailable', reason }` when iOS/Android picker is absent
   (unchanged) and still `{ kind:'handle' }` on success.
6. Silent abort + no folder bridge + no vault ⇒ error text contains
   `The system save dialog did not open on this device.` (honest, no false success).
7. Vault tier: after folder failure, `saveToVault` success ⇒ `{ ok:true, method:'vault' }`;
   its failure is appended to `reasons`.
8. `writeToCapacitorFolder`, `arrayBufferToBase64` and share-taxonomy suites: **unchanged**.

### 6.2 `tests/commands/export.modal.mobile.test.ts` (jsdom, end-to-end)

9. **Android modal:** `Platform.isAndroidApp = true`, `window.showSaveFilePicker` rejects
   instantly, `window.Capacitor.Plugins.Filesystem` present ⇒ clicking **Export** yields
   `Notice.messages.at(-1) === 'Saved Budget.csv (2 rows, 11 columns) to Download/Tablify/Budget.csv.'`
   and **never** `'Export cancelled. No file was saved.'`.
10. Same with a real cancel (blur fired) ⇒ `'Export cancelled. No file was saved.'` and the
    bridge was **not** called.
11. Desktop modal suite and the iOS share suite: run unmodified.

### 6.3 `tests/commands/currentViewExport.test.ts`

12. `exportCurrentViewCsv()` on Android with a silent abort ⇒ folder write + path notice.

### 6.4 `tests/settings/settings.test.ts`

13. Default is `false`; a stored `true` round-trips; unknown keys are still dropped; the
    existing token assertions updated for the extra field (a deliberate, listed test edit).

### 6.5 Repo gate

14. `npm run check` (lint + vitest + tabula guard + docs links + icons + flags + build) must pass —
    the same gate every SAD item uses.

### 6.6 On-device verification (the step round 1 skipped)

| # | Android step | Expected |
|---|---|---|
| 1 | **Export destination diagnostics** command | shows `showSaveFilePicker: function`, `chosen delivery method: picker`, and after one export attempt: `last picker attempt: … AbortError → unavailable` |
| 2 | Export… × CSV / XLSX / MD | file in `Download/Tablify/`, notice names the path, opens in Excel/Sheets |
| 3 | File-explorer → **Export Tablify Table** | same result (same modal, `fileMenu.ts:99`) |
| 4 | **Export current view as CSV** command | same result |
| 5 | Tap Export, then cancel *if a dialog ever appears* | "Export cancelled", nothing written |
| 6 | Enable the vault fallback; repeat step 2 with the Capacitor bridge hidden | file appears next to the table, notice names the path |
| 7 | Desktop (Win/macOS/Linux) | picker in Downloads; download fallback unchanged; cancel still cancels |

---

## 7. Non-regression analysis

| Behaviour | Protected by | After the fix |
|---|---|---|
| Desktop picker success | `destination.test.ts:28-55` | unchanged (platform `null`) |
| Desktop real cancel | `:57-62`, `:91-112` | unchanged, still terminal |
| Desktop picker failure → download | `:91-103` | unchanged |
| Desktop vault tier | runtime never sets `saveToVault` | unreachable |
| iOS share, tap→share ordering, retry modal | `export.modal.mobile.test.ts` (7 tests) | unchanged (`mobilePlatform==='ios'` ⇒ desktop policy for aborts; iOS uses share, not the picker) |
| Android folder writer (directories, base64, collisions, paths) | `destination.test.ts:258-320` | unchanged; now reachable |
| False "Download started" removal | `destination.test.ts:114-120` | unchanged |
| File menu, import, sync, grid, formats | their own suites | untouched files |
| "Never writes into the vault" | user guide §13 | still true by default; only with the opt-in setting |
| `formatVersion` / `.tablify` schema | no format file touched | unchanged |

**Test edits that are unavoidable and intentional:** (a) the settings deep-equal gains one
field; (b) no existing destination expectation changes — the `'picker'` matrix at `:168-179`
still holds (Android *is* picker-first; it now degrades correctly when the dialog is absent).

---

## 8. Risks and mitigations

| Risk | Mitigation |
|---|---|
| A genuine fast cancel is misread as a silent abort and a file is written | Two signals (focus/visibility **and** elapsed time) must *both* say "no UI"; the file is uniquely named and the path announced; the threshold is one exported constant |
| Focus events never fire on some Android builds | Then the first export is classified `unavailable` and the file is saved to `Download/Tablify` — the owner's chosen fallback — rather than dying. Fail-open by design |
| Obsidian later implements the SAF chooser | No code change: the dialog appears, focus is lost, an AbortError is a genuine cancel again. The picker stays first for exactly this reason |
| Capacitor bridge renamed/removed in a future Obsidian | Feature-detected (`destination.ts:357-362`); falls to vault (if enabled) or an honest error — never a false success |
| Vault fallback pollutes the vault | Off by default; documented; numbered names; never overwrites |
| Heuristic "feels" hacky vs. a rewrite | It is the idiom already shipped for attachments (`attachmentImport.ts`), it is unit-tested against an injected clock/events, and it is 30 lines instead of a delivery-layer rewrite |

---

## 9. Commit slicing

1. `fix(export): SAD-350 — a picker that never opened is not a cancel (Android)` —
   `destination.ts` classifier + platform tag + call-site wiring + tests 1-5, 9-10.
   *Independently shippable; this alone fixes the reported bug.*
2. `feat(export): SAD-350 — opt-in vault fallback + settings toggle` — settings, writer,
   `'vault'` result/notice, tests 7, 13.
3. `chore(export): SAD-350 — record the last picker attempt in the diagnostics probe` — §4.6.
4. `docs: SAD-350 round 2 — user guide, changelog, verification record`.

---

## 10. What only the hardware can confirm

1. That **Obsidian's** Android `WebChromeClient` does not implement `MODE_SAVE` on the owner's
   device. The symptom (no dialog + instant notice) says so; §6.6 step 1 measures it.
2. Which `Download` directory the Capacitor bridge accepts on that Android version
   (`EXTERNAL_STORAGE → EXTERNAL → DOCUMENTS` is already implemented and unit-tested;
   only the device's acceptance order is empirical).
3. That the saved XLSX opens after a folder write (byte integrity is covered by unit tests at `destination.test.ts:258-320`).

No part of the implementation depends on a guess about these: each of the three possible
outcomes is already handled by the chain in §4.2/§4.5.

---

## 11. Evidence

| # | Source | Used for |
|---|---|---|
| 1 | blink-dev, *Intent to Ship: File System Access on Android and WebView* — "enabled for android and webview in M132 … Jan 2025" | `showSaveFilePicker` **exists** in Android WebView |
| 2 | apache/cordova-android #1776 — *"showDirectoryPicker and showSaveFilePicker return errors indicating 'The user aborted a request'"* on WebView 132+ | the exact `AbortError` on a WebView that cannot present a dialog |
| 3 | W3C Web Share API support matrix / Chromium #765923 | Android WebView has no `navigator.share` (rules the share branch out) |
| 4 | `docs/plans/sad-350-mobile-export-plan.md` §1.2 (round-1 investigation, same conclusion) | prior evidence, unchanged |
| 5 | blink-dev (Torne, Chromium) — *"the File System Access API is disabled by default"*; host must implement `onShowFileChooser` | the host callback is the reason the dialog is absent |
| 6 | Android `WebChromeClient.FileChooserParams.MODE_SAVE` reference | save mode is opt-in for embedders |
| 7 | orca #25750 — *"An instant AbortError suggests the guest has no file-select handler … Chromium cancels the request without showing a dialog"* | third, independent reproduction of the failure shape |
| 8 | Chromium issue 40101963 — *"Support FileSystemAccess on webview … delegate to WebContentsDelegate"* | WebView delegates the chooser to the host app |
| 9 | W3C Web Share / MDN — `AbortError` = "user canceled **or there are no share targets available**" | why `AbortError` cannot be treated as a cancel by itself |
| 10 | Obsidian community plugin *Single HTML Export* — Android writes through `window.Capacitor.Plugins.Filesystem` to `Download/Obsidian HTML/`; *"the Obsidian app does not expose a native share sheet to plugins"* | validates the folder tier as the field-proven Android destination |

---

*Round 1 record (unchanged, kept for history): `docs/plans/sad-350-mobile-export-plan.md`.*

---

## 12. Implementation record (2026-10-20)

Authorized and delivered in four pushed steps, each with its own Linear progress note.

| # | Commit | What shipped |
|---|---|---|
| 1 | `019abd6` | This investigation and fix plan. |
| 2 | `d85d9dd` | The fix: Android picker abort policy + platform tag + `deviceExportRuntime()` + tests. |
| 3 | `02287df` | Opt-in vault last resort (`exportVaultFallback`, default off) + setting + tests. |
| 4 | *(this commit)* | Diagnostics `last picker attempt` line, user guide §13, changelog, this record. |

### Deviations from the plan, and why

1. **The vault tier is ordered after the desktop download**, not before it as §4.5 sketched.
   Enabling the setting must be unable to change a desktop export; a unit test pins that the
   desktop path still returns `method: 'download'`.
2. **`PICKER_SILENT_ABORT_MS` is 1000 ms** (the plan's illustrative constant). It is exported
   and asserted, not copied around.
3. **Two extra tests** beyond the plan's list cover the settings-merge bug the new toggle would
   have exposed: editing the Airtable token rebuilt settings from scratch and would have turned
   the flag back off. The token `onChange` now merges.

### Verification

- `npm run check` — **exit 0**: lint (0 errors, 119 pre-existing warnings unchanged) ·
  **142 files / 2,259 tests** · guard · docs (links) · icons · flags · build.
- Baseline on the same machine at the starting `HEAD`: **2,232 tests**. Final: **2,259** —
  **+27 new**, and the only pre-existing assertions edited are the five settings deep-equals that
  gained the new field.
- **The regression test genuinely fails on the old code.** Running the new end-to-end test with
  `src/` stashed (`git stash push -- src/`) produced
  `FAIL … saves to the shared folder instead of reporting a cancellation`; it passes with the fix.
- TypeScript: the repository already carries **383** `tsc` errors at baseline (tsc is not part of
  the gate; esbuild builds). After all four steps: **383, the exact same set — 0 new**.
- Desktop and iOS: their suites (`destination`, `export.modal`, `export.modal.mobile`,
  `currentViewExport`, `tableViewTitleRow`) run **unmodified** and pass.

### Still hardware-only (unchanged from §10)

The on-device matrix in §6.6 — in particular step 1, whose `last picker attempt` line now
distinguishes the two Android outcomes in one measurement.
