# Tablify — Obsidian Community Plugin Review Checklist (P6-04)

**Date checked:** 2026-10-09 (live pages fetched on this date)
**Step:** P6-04 (SAD-47) · **Repo state:** `main` at the P6-04 commit
**Guidance sources (live, dated):**

- Plugin guidelines: <https://docs.obsidian.md/Plugins/Releasing/Plugin+guidelines>
- Developer policies: <https://docs.obsidian.md/community-directory/developer-policies>
- Submission requirements for plugins: <https://docs.obsidian.md/community-directory/submission-requirements-for-plugins>
- Submit your plugin: <https://docs.obsidian.md/plugins/releasing/submit-plugin>

Each item: **status** + evidence linking to code, a test, or a command. "N/A" items carry a reason. Verification per spec: a second person (owner) reviews this checklist; lint result recorded at the bottom.

---

## 1. General

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 1.1 | Avoid the global `app` object; use the plugin-provided reference | **PASS** | `src/menus/fileMenu.ts` — `const app = plugin.app;` (derived from the passed plugin); `src/commands/import.ts` / `export.ts` take `plugin.app`; no `window.app` anywhere (`grep -rn "window.app" src/` → 0 hits) |
| 1.2 | Avoid unnecessary console logging | **PASS (fixed in this step)** | The only `console.log` was the P0-01 sample command `tablify-hello` — **removed in this step** (`src/main.ts`); `grep -rn "console\." src/` → 0 hits |
| 1.3 | Organize code into folders | **PASS** | `src/` is organized: `commands/`, `format/`, `io/`, `menus/`, `model/`, `query/`, `ui/`, `utils/`, `views/` |
| 1.4 | No placeholder class names from the sample plugin (`MyPlugin`, `MyPluginSettings`, `SampleSettingTab`) | **PASS** | Plugin class is `TablifyPlugin` (`src/main.ts`); no `MyPlugin`/`Sample*` identifiers in `src/` |

## 2. Mobile

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 2.1 | No Node/Electron APIs (mobile crash risk) | **PASS** | esbuild browser build; production bundle has no Node built-ins (bundle check in evidence below); dependencies are browser-safe by decision D-O2 (`docs/decisions/xlsx.md` — `read-excel-file`/`write-excel-file` browser builds) |
| 2.2 | No regex lookbehind (iOS < 16.4) | **PASS** | `grep -rn "(?<" src/` → 0 hits |
| 2.3 | `isDesktopOnly` correct | **PASS** | `manifest.json` — `"isDesktopOnly": false`; long-press (P5-03) is the mobile path |

## 3. UI text

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 3.1 | Settings headings only with multiple sections; via `Setting.setHeading()`; no "settings" in heading text | **N/A** | The plugin has **no settings tab** in 1.0 (no `addSettingTab` in `src/` — nothing to configure). The `setHeading` requirement from the step spec cannot apply to code that does not exist; recorded per spec's "not applicable with reason" |
| 3.2 | Sentence case in UI | **PASS** | Menu labels in `src/menus/fileMenuModel.ts` / `tableMenuModel.ts` (e.g. "New table", "Import CSV/Excel as table", "Duplicate", "Change field type"), command names in `src/commands/*.ts` — all sentence case |

## 4. Security

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 4.1 | No `innerHTML` / `outerHTML` / `insertAdjacentHTML` with dynamic content | **PASS** | All 4 uses are pure clears (`= ''`): `GridView.ts` ×3, `select/Dropdown.ts` ×1. All element construction uses `createElement` + `textContent` (grep evidence in `docs/evidence/P6-04.md`) |
| 4.2 | No unsafe HTML insertion from file content | **PASS** | Cell values rendered via `textContent` only (`GridView.ts` render); validation via `title` attribute; no markdown-to-HTML rendering of file data in MVP |

## 5. Resource management

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 5.1 | Clean up resources on unload; use `registerEvent`/`addCommand` | **PASS** | All listeners/commands registered through plugin methods: `plugin.registerEvent(app.workspace.on('file-menu', …))` (`fileMenu.ts`), `plugin.addCommand` (`commands/*.ts`), `plugin.registerView` (`main.ts`); grid view cleans its pool + DOM in `destroy()` (`GridView.ts`) |
| 5.2 | Don't detach leaves in `onunload` | **PASS** | No `onunload` override exists — nothing is detached; leaves re-init on update by the host |

## 6. Commands

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 6.1 | No default hotkeys on commands | **PASS** | No `hotkeys` key in any `addCommand` (`grep -rn "hotkeys" src/` → 0); grid shortcuts are in-view key handling with a focus guard (`shouldHandleForGrid`), not command hotkeys |
| 6.2 | Appropriate callback type | **PASS** | Both commands run unconditionally (they open the import/export flows and surface their own errors): `callback:` used in `commands/import.ts`, `commands/export.ts` |

## 7. Workspace

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 7.1 | No `workspace.activeLeaf` access | **PASS** | `grep -rn "activeLeaf" src/` → 0; file open uses `app.workspace.getLeaf(false).openFile(file)` (`fileMenu.ts`) |
| 7.2 | No managed references to custom views (`registerView` returns the view, doesn't store it) | **PASS** | `src/main.ts` — `this.registerView(TABLIFY_VIEW_TYPE, (leaf) => new TableView(leaf))` |

## 8. Vault

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 8.1 | Vault API over Adapter API | **PASS** | All file I/O through `app.vault.read/create/process/modify` (`commands/`, `menus/fileMenu.ts`, `views/tableView.ts`); no `vault.adapter` in `src/` |
| 8.2 | No iterating all files to find by path | **PASS** | Only `vault.getAbstractFileByPath(...)` (`fileMenu.ts` ×2, `attachment.ts`, `commands/import.ts`, `commands/export.ts`); no `getFiles().find(...)` |
| 8.3 | `normalizePath()` for user-defined paths | **PASS (by construction)** | Paths are built from host-provided `TFolder`/`TFile` paths via `joinPath` (`fileMenuModel.ts`) — already host-normalized; user-typed free-text paths do not exist in 1.0 (no settings). Recorded rather than double-normalized |
| 8.4 | `Vault.process` for background modification (atomicity) | **PASS** | Table saves go through `TextFileView.setViewData/save()` (host-managed atomic write path, `views/tableView.ts`); import writes via `vault.create` after collision check (`uniqueName`) — no partial-file failure test gap (P4-04 failure tests) |

## 9. Styling

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 9.1 | No hardcoded styling; use CSS classes/variables | **PASS (with note)** | Colors exclusively via CSS variables (`styles.css` + `src/ui/theme/tokens.ts` apply `--tablify-*` vars; e.g. `header.style.background = 'var(--background-primary)'`). Inline `style.*` usage is **layout only** (flex/position/size/borders-with-vars) required by the virtualized grid; class names (`tablify__*`) carry themeable styling in `styles.css`. Note recorded: further migration of layout inline styles to `styles.css` is possible post-1.0 |

## 10. TypeScript

| # | Guideline item | Status | Evidence |
|---|---|---|---|
| 10.1 | `const`/`let` over `var` | **PASS** | `grep -rn "\bvar " src/` → 0 hits |
| 10.2 | async/await over raw Promises | **PASS** | `grep -rn ".then(" src/` → 0 hits |

## 11. Submission requirements (submission-requirements-for-plugins)

| # | Item | Status | Evidence |
|---|---|---|---|
| 11.1 | `manifest.json` valid (id, name, version, minAppVersion, description, author, isDesktopOnly) | **PASS** | `manifest.json` + `tests/manifest.test.ts` (id `tablify`, name `Tablify`, minAppVersion `1.14`, decision D-O4 in `docs/decisions/min-app-version.md`) |
| 11.2 | `versions.json` maps versions → min app version | **PASS** | `versions.json` (updated to 1.0.0 in P6-06) |
| 11.3 | No obfuscated/minified-only code; source available | **PASS** | Full TypeScript source in the repo; production bundle is esbuild output from that source |
| 11.4 | License present | **PASS (P6-06)** | MIT per decision D-O3 (owner, 2026-10-09): `LICENSE` + `docs/decisions/license.md` land in P6-06 per the phase plan |
| 11.5 | Brand/assets: no AI-generated imagery submitted as promotional material without disclosure | **N/A** | No promotional assets submitted with 1.0 |
| 11.6 | One plugin per repo submission; repo public | **PASS** | Single plugin (`tablify`) in `258044aamm-Dev/Tablify`, public repo |

## 12. Step-spec reference items (from `spec/steps/P6-04.md`)

| # | Item | Status | Evidence |
|---|---|---|---|
| 12.1 | Settings headings via `Setting` heading API | **N/A** | No settings tab in 1.0 (see 3.1) |
| 12.2 | `requestUrl` for network calls | **N/A** | Zero network calls in 1.0 (`grep -rn "requestUrl\|fetch(" src/` → 0) |
| 12.3 | `activeDocument` when working with DOM windows | **N/A (with note)** | No pop-out-specific DOM handling exists; the grid attaches inside its own view container. If pop-out windows are supported post-1.0, revisit |
| 12.4 | No leaf detach on unload | **PASS** | See 5.2 |
| 12.5 | No unsafe HTML insertion | **PASS** | See 4.1/4.2 |
| 12.6 | No bundled Node-only code | **PASS** | See 2.1 + bundle check below |
| 12.7 | **Sample code removed** | **FIXED IN THIS STEP** | `tablify-hello` command removed from `src/main.ts` (was P0-01 scaffold; console.log only; no test or doc depends on it). Full regression re-run below |

## 13. Lint result (spec action 3)

`npm run lint` at this commit: **0 errors, 82 warnings** (pre-existing style warnings: `no-non-null-assertion` etc., unchanged from P5). Recorded per spec; gate rule "lint passes" = 0 errors.

## 14. Bundle check (Node-only code)

- Production build (`node esbuild.config.mjs production`): succeeds; bundle guard check passes under the 1,750,000 B dev limit (`npm run check`).
- Runtime bundle contains no Node built-in requires (esbuild browser platform; `esbuild.config.mjs` sets browser target).

## 15. Owner verification (second-person review)

- [ ] Owner reviews this checklist item-by-item (spec verification rule).
- [ ] Owner confirms the N/A reasons (3.1, 11.5, 12.1–12.3).
- [ ] Owner re-checks the live guidelines pages at submission time and records the new check date below.

**Re-check log:** 2026-10-09 (initial audit) — tester: Tablify Agent.
