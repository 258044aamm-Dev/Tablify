# Tablify — Rollback plan (P6-06)

---

# 2.0.0-beta.6 — 2026-10-20

**Release:** v2.0.0-beta.6 (pre-release) · **Format version 2** · inline cell image rendering and lightbox preview (SAD-347), interactive fractional star ratings (SAD-304), phone country & E.164 storage + email/URL/phone import inference (SAD-303), and mobile keyboard/toolbar/placeholder/bottom-bar refinements (SAD-305, SAD-306, SAD-307, SAD-308); no file-format version change

## Situation

Beta.6 extends cell rendering, editing panels, and mobile layout ergonomics without changing
`formatVersion`. Attachment cells pointing to vault images render inline thumbnails with a
click-to-preview lightbox (`SAD-347`); Rating cells accept `0` and two-decimal fractions with
click-to-rate stars and a slider panel (`SAD-304`); Phone fields accept an optional additive
`defaultCountry` property and store canonical E.164 strings (`SAD-303`); and mobile viewports keep
the table and active editor visible when the on-screen keyboard opens (`SAD-305`), truncate the
search placeholder cleanly (`SAD-306`), reserve clearance above Obsidian's mobile bottom bar for
**Insert Row** (`SAD-307`), and scroll the toolbar three tools at a time (`SAD-308`).

## Rolling back

| Situation | Action |
|---|---|
| Any of the beta.6 rendering, panel or mobile layout changes is not wanted | Reinstall 2.0.0-beta.5 using its `main.js`, `manifest.json`, and `styles.css` release assets. No table data is lost. |
| A table with fractional ratings or `defaultCountry` on a phone field is opened in beta.5 | Beta.5 opens the file; phone values are plain strings (`+8801712345678`) that beta.5 reads as strings, and `defaultCountry` is ignored if unused. |
| A table contains formula or link fields | Keep Tablify 2.x installed. Tablify 1.0.2 and earlier cannot open `formatVersion: 2` files. |

## Release verification checklist (2.0.0-beta.6)

- [x] `npm run check` on the release commit: 136 test files / 2,171 tests; lint 0 errors (119 existing warnings); guard, docs links (164 files), FA icon check and build pass.
- [x] Production `main.js` built twice with an identical SHA-256; assets hashed and recorded in the [release notes](2.0.0-beta.6.md).
- [ ] Owner: install on desktop and mobile; verify inline attachment image thumbnails, lightbox preview, star ratings, phone country picker, and mobile keyboard/toolbar/bottom-bar layout in light and dark themes.
- [ ] Owner: revoke/rotate the temporary GitHub credential used for publication.

# 2.0.0-beta.5 — 2026-10-18

**Release:** v2.0.0-beta.5 (pre-release) · **Format version 2** · the two popups the plugin draws (date, field type), the cell-focusing fix, and the COD-69–COD-74 tranche (field window, edit-switch click, value rendering, freeze-the-primary, branded file menu); no file-format change

## Situation

Beta.5 changes how cells are edited and read, not how a table is stored. The date and
date-time pickers and the field type list are panels the plugin draws instead of the
browser's own controls; the focused cell now drops its highlight when a press lands
outside the table; and cells render values the way a person reads them (chips, stars,
links, grouped digits, local timestamps). None of it touches the `.tablify` format:
a table written by beta.4 opens unchanged in beta.5, and a table written by beta.5
opens in beta.4 — a downgrade only costs the new panels and rendering. Freezing is
now the primary column only; a table saved by an older build with several frozen
columns opens with the primary column frozen and the rest scrolling normally.

## Rolling back

| Situation | Action |
|---|---|
| The drawn pickers, the new rendering or the focusing rule is not wanted | Reinstall 2.0.0-beta.4 using its `main.js`, `manifest.json`, and `styles.css` release assets. No table data changes. |
| A table was saved by beta.5 and then downgraded | It opens in beta.4 unchanged — the format is the same. Only the `freezeMode` key (dropped by beta.5 on save) is absent, which beta.4 also tolerates. |
| A table contains formula or link fields | Keep Tablify 2.x installed. Tablify 1.0.2 and earlier cannot open `formatVersion: 2` files. |

## Release verification checklist (2.0.0-beta.5)

- [x] `npm run check` on the release commit: 124 test files / 1,942 tests; lint 0 errors (119 existing warnings); guard, docs links (156 files), FA icon check and build pass.
- [x] `npm run test:fields` (Chromium, production `TableView`): 102/102 checks.
- [x] Production `main.js` built twice with an identical SHA-256; assets hashed and recorded in the [release notes](2.0.0-beta.5.md).
- [ ] Owner: install on desktop and mobile; verify the date picker, the field type panel and the outside-tap clearing, in light and dark.
- [ ] Owner: revoke/rotate the temporary GitHub credential used for publication.

# 2.0.0-beta.4 — 2026-10-17

**Release:** v2.0.0-beta.4 (pre-release) · **Format version 2** · field editor, field rename with reference rewriting, header shows the name only (COD-67), plus the COD-66 and COD-68 editor fixes; no file-format change

## Situation

Beta.4 changes how a field is edited, not how a table is stored. Clicking a column header or using
⋮ → **Field details…** opens the same dialog that creates a field, and renaming a field now
rewrites `{Old}` in formulas and the old name in saved view queries. Both edits are single undo
steps. The type badge is removed from column headers by design.

Existing `.tablify` files are read and written exactly as in beta.3, and Airtable sync maps fields
by id, so a rename does not disturb a linked table.

## Rolling back

| Situation | Action |
|---|---|
| The field editor or the badge-less header is not wanted | Reinstall 2.0.0-beta.3 using its `main.js`, `manifest.json`, and `styles.css` release assets. No table data changes. |
| A rename was undone/redone and a formula looks wrong | One **Undo** restores the name, the formulas and the query together. If the change was already saved and the file was closed, restore the file from a backup; the rewrite is not reversible from the file alone. |
| A table contains formula or link fields | Keep Tablify 2.x installed. Tablify 1.0.2 and earlier cannot open `formatVersion: 2` files. |

## Release verification checklist (2.0.0-beta.4)

- [x] `npm run check` on the release commit: 114 test files / 1,695 tests; lint 0 errors (119 existing warnings); guard, docs links, icons and build pass.
- [x] `npm run test:fields` (Chromium, production `TableView`): 77/77 checks.
- [x] Production `main.js` built twice with an identical SHA-256; assets hashed and recorded in the [release notes](2.0.0-beta.4.md).
- [ ] Owner: install on desktop and mobile; verify header click, ⋮ → **Field details…**, rename with a formula and a query present, and a single Undo.
- [ ] Owner: revoke/rotate the temporary GitHub credential used for publication.

# 2.0.0-beta.3 — 2026-10-16

**Release:** v2.0.0-beta.3 (pre-release) · **Format version 2** · export destinations (SAD-129); no file-format change

## Situation

Beta.3 adds external save destinations for CSV, XLSX, and file-based Markdown exports, plus explicit share/download fallbacks. It does not modify `.tablify` files or change the format version. The save picker, mobile share sheet, and overwrite/collision behavior have not been manually tested inside Obsidian desktop or mobile; this limitation is disclosed in the [release notes](2.0.0-beta.3.md).

## Rolling back

| Situation | Action |
|---|---|
| Export destination/picker behavior is unsuitable | Reinstall 2.0.0-beta.2 using its `main.js`, `manifest.json`, and `styles.css` release assets. The beta.3 export change does not alter table data. |
| A table contains formula or link fields | Keep Tablify 2.x installed. Tablify 1.0.2 and earlier cannot open `formatVersion: 2` files. |
| An export was saved outside the vault | The exported file is independent of the plugin install; uninstalling or downgrading Tablify does not remove it. |

## Release verification checklist (2.0.0-beta.3)

- [x] `npm ci` and `npm run check` passed: 111 test files / 1,658 tests; lint 0 errors (119 existing warnings), guard, docs links, icons, and build checks pass.
- [x] Production `main.js` built twice with an identical SHA-256; production dependency audit (`npm audit --omit=dev`) reports 0 vulnerabilities.
- [x] SHA-256 hashes for `main.js`, `manifest.json`, and `styles.css` recorded in the [release notes](2.0.0-beta.3.md).
- [x] The native picker/share/overwrite behavior not tested in Obsidian is explicitly disclosed.
- [ ] Owner: install the release on desktop and mobile and verify picker, share/download fallback, and destination behavior.
- [ ] Owner: revoke/rotate the temporary GitHub credential used for publication.

# 2.0.0-beta.2 — 2026-10-12

**Release:** v2.0.0-beta.2 (pre-release) · **Format version 2** · prototype-parity tranche (SAD-75 to SAD-92); no file-format change since 2.0.0-beta.1

## Situation

2.0.0-beta.2 carries the prototype-parity work (title row and toolbar, one search/query box with the filter builder, capsule grid, row selection and reorder, Options panel with Group by, select / option-manager / attachment panels) on top of 2.0.0-beta.1. The format rules are unchanged: a table that uses a formula or link field is saved as `formatVersion: 2`, and Tablify 1.0.2 and earlier refuse to open such a file. Tables without those fields stay at version 1 and open in any version.

No file-format change is introduced: a table written by beta.1 opens unchanged in beta.2, and a table written by beta.2 opens in beta.1. The only new view key is the optional `collapsedGroups` (FORMAT_SPEC §5), which beta.1 ignores.

## Rolling back

| Situation | Action |
|---|---|
| Testing in a copy of the vault | Delete the copy. The original is untouched. |
| Reinstalled 1.0.2 and a v2 file will not open | Reinstall 2.0.0-beta.2 (or 2.0.0-beta.1). Version 1.0.2 cannot open a v2 file, so it cannot remove the fields either. |
| Downgrade to 2.0.0-beta.1 | Download `main.js`, `manifest.json`, `styles.css` from the [v2.0.0-beta.1 release](https://github.com/258044aamm-Dev/Tablify/releases/tag/v2.0.0-beta.1) and replace the three files in `<vault>/.obsidian/plugins/tablify/`. |
| Downgrade a vault with no v2 files | Reinstall 1.0.2 from its release. |

Do not edit a v2 file by hand. Test on a copy of your vault first.

## Known issues carried by 2.0.0-beta.2

- Live Airtable and Obsidian checks have still not been run; the sync is tested against a fake server only (carried from beta.1).
- Renaming a field does not update formulas that use it; those formulas show `#NAME?` until edited. Field rename is not built.
- Link fields have one target table each; export writes link names only and import does not restore links; lookups and rollups are not included.
- Prototype parity is not claimed as complete. The remaining, measured gaps are recorded in `docs/evidence/SAD-92.md` (grouped-state geometry, search placeholder / Step 14, mobile insert-row offset).

## Release verification checklist (2.0.0-beta.2)

- [x] Clean build of the release commit (`npm ci` → `npm run check` → production build): lint 0 errors, 1545/1545 tests, `.tabula` guard, docs-link check, FA icon check all pass.
- [x] Version bump does not change the shipped bundle: production `main.js` and `styles.css` are byte-identical to the pre-bump build of `main` (sha256 `15ffb158…` / `3f246e74…`).
- [x] SHA-256 of `main.js` (`15ffb158…`), `manifest.json` (`be9e1de8…`), `styles.css` (`3f246e74…`) recorded in the release notes; the uploaded `main.js` was re-downloaded and matches byte for byte.
- [x] Re-build from a pristine export of the tag reproduces identical hashes for all three files (build determinism check).
- [ ] Owner: install release assets in a clean vault on **desktop** and **mobile**.
- [ ] Owner: walk the SAD-77 to SAD-92 parity checklist in light and dark; record in `docs/evidence/`.
- [ ] Owner: revoke the temporary GitHub credential used for this release.

# 2.0.0-beta.1 — 2026-10-10

**Release:** v2.0.0-beta.1 (pre-release) · **Format version 2** · Phase 7 and Phase 8

## Situation

2.0.0-beta.1 saves a file as `formatVersion: 2` when it has a formula or link field. Tablify 1.0.2 and earlier refuse to open a version 2 file, and show an error instead of the table. Files without these fields stay at version 1 and open in any version.

## Rolling back

| Situation | Action |
|---|---|
| Testing in a copy of the vault | Delete the copy. The original is untouched. |
| Reinstalled 1.0.2 and a v2 file will not open | Reinstall 2.0.0-beta.1. Version 1.0.2 cannot open a v2 file, so it cannot remove the fields either. |
| Downgrade a vault with no v2 files | Reinstall 1.0.2 from its release (see the 1.0.2 entry below). |

Do not edit a v2 file by hand. Test on a copy of your vault first.

## Known issues carried by 2.0.0-beta.1

See the CHANGELOG entry for 2.0.0-beta.1 (known limits). The main ones: live Airtable and Obsidian checks not run; no field rename.

---

# 1.0.1 — 2026-10-10

**Release:** v1.0.1, tagged 2026-10-10 · **Bug-fix release** over v1.0.0

## Situation

1.0.1 fixes the missing table toolbar (SAD-69) and the dark-theme contrast failure it exposed.
It is a drop-in replacement for 1.0.0: **no file-format change** (`formatVersion` stays `1`), no
migration, and no new dependency. Files written by 1.0.0 open unchanged, and files written by
1.0.1 open in 1.0.0 — the only difference is that 1.0.0 ignores the `search` and `query` keys
1.0.1 may have saved in a view.

## Rolling back to 1.0.0

1.0.0 stays tagged and its assets remain downloadable, so a downgrade is a straight reinstall:

| Install path | Action |
|---|---|
| Manual | Download `main.js`, `manifest.json`, `styles.css` from the [v1.0.0 release](https://github.com/258044aamm-Dev/Tablify/releases/tag/v1.0.0) and replace the three files in `<vault>/.obsidian/plugins/tablify/`. |
| BRAT | BRAT → remove `258044aamm-Dev/Tablify`, then re-add and pin to tag `v1.0.0`. |

No data step is needed. `.tablify` files are untouched by either version.

If a downgrade is needed because 1.0.1 misbehaves, please comment on SAD-69 first — the fix
commits are all on `main` and the issue is still open pending device verification.

## Known issues carried by 1.0.1

All of 1.0.0's known limitations still apply (see 1.0.0 below), plus:

1. The focus ring on the light theme measures **2.96:1**, just under the 3:1 non-text guideline
   (WCAG 1.4.11). Passes on dark (5.90:1). Needs an accent change — branding decision G-B1.
2. Header sort still replaces the whole sort array rather than supporting multi-field sort.
3. In-vault verification of the new toolbar on desktop and mobile is **not yet run** — this
   release exists so that it can be.

## Release verification checklist (1.0.1)

- [x] Clean build from the tagged commit (fresh clone → `npm ci` → production build → `npm run check`).
- [x] SHA-256 of `main.js`, `manifest.json`, `styles.css` recorded in the release notes.
- [x] Re-build from the tag reproduces identical hashes (build determinism check).
- [ ] Owner: install release assets in a clean vault on **desktop** and **mobile**.
- [ ] Owner: run A1 (new table) and A9 (`.tabula` ignored), then the SAD-69 toolbar checklist in
      light and dark. Record in `docs/evidence/P6-06.md` and comment on SAD-69.
- [ ] Owner: revoke the temporary GitHub credential used for this release.

---

# 1.0.0 — 2026-10-09

**Release:** v1.0.0, tagged 2026-10-09 · **First public release** (no prior version exists)

## Situation

1.0.0 is the first tagged release. There is no previous release to roll back **to** — rollback therefore means **removing 1.0.0 from a vault** or **pinning to source**, not downgrading.

## How users revert

| Situation | Action |
|---|---|
| Installed from Community directory | Disable **Tablify** in Settings → Community plugins, then "Uninstall". Data is untouched: tables are plain `.tablify` JSON in the vault. |
| Manual install | Delete `<vault>/.obsidian/plugins/tablify/` (contains `main.js`, `manifest.json`, `styles.css`) and reload Obsidian. |
| BRAT install | BRAT → remove `258044aamm-Dev/Tablify`, or disable the plugin. |
| Data rollback | `.tablify` files are the only data store; restore them from Sync/file backup. Uninstalling the plugin never modifies or deletes `.tablify` files. Open views on removed plugin: Obsidian shows an "unavailable view" placeholder until the file is reopened after reinstall. |

## Future releases

- Every release stays tagged with its assets downloadable, so any later release can be rolled back to any earlier one by installing that version's three files (manual path above).
- `versions.json` keeps the `0.0.1 → 1.14` mapping so older builds stay resolvable.

## Known issues carried by 1.0.0

From `CHANGELOG.md` §Known limitations (measured and disclosed):

1. Strict type inference: 73.3 % of labeled columns (`docs/reports/p4-03-accuracy.md`); ambiguous columns become text.
2. On-device matrix / screen-reader / official performance numbers are owner-run checklists in progress; sandbox numbers are labelled approximations.
3. CSV exports do not neutralize formula-triggering prefixes (`=`, `+`, `-`, `@`).
4. Column resize has no keyboard path (a11y backlog F-3); light-theme focus ring measures 2.96:1 vs the 3:1 non-text guideline (F-2).
5. jsdom PERF-4 frame-time number is informational only (no compositor in jsdom).

## Release verification checklist (this release)

- [x] Clean build from the tagged commit (fresh clone → `npm ci` → production build → `npm run check`).
- [x] SHA-256 of `main.js`, `manifest.json`, `styles.css` recorded in the release notes.
- [x] Re-build from the tag reproduces identical hashes (build determinism check).
- [ ] Owner: install release assets in a clean vault on desktop and mobile; run A1 (new table) and A9 (`.tabula` ignored). *(owner checklist — record in `docs/evidence/P6-06.md`)*
- [ ] Owner: revoke the temporary GitHub credential used for this release.
