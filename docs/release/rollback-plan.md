# Tablify 1.0.0 — Rollback plan (P6-06)

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

- 1.0.0 stays tagged and its release assets remain downloadable — any later release can be rolled back to it by installing the v1.0.0 assets from this release page (manual path above).
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
