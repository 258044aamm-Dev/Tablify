# Tablify — Rollback plan (P6-06)

---

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
