# SAD-71 — Prototype parity: evidence

Plan and gap analysis: `docs/plans/prototype-parity-review.md`. Owner decisions D-1 (full
prototype restyle) and D-2 (keep Poppins + Lora, add JetBrains Mono) recorded in
`spec/branding.md §4/§5` and in the SAD-71 Linear thread.

## Commits (each pushed to `main` with a Linear comment on SAD-71)

| Step | Commit | Scope | New red→green tests |
| --- | --- | --- | --- |
| 1 | `b5ddf16` | Resize refit (ResizeObserver), empty-state Insert Row pill, scoped form-control selectors | `tests/views/grid/geometry.test.ts`, `tests/ui/formControlSpecificity.test.ts` (8) |
| 2 | `37e30f5` | Token ladder: bg/bg-card/bg-inner/bg-capsule/bg-subtle/bg-stripe/on-accent; contrast re-measure | `tests/ui/theme.test.ts` (toEqual map), `tests/ui/contrast.test.ts` (+5) |
| 3 | `074c34e` | Toolbar: inline SVG icons, pill buttons, anchored Options popover card, focus-ring language, mono row count; AddFieldModal `.tablify__modal` | `tests/views/grid/toolbarParity.test.ts` (6 red → green) |
| 4 | `aac675c` | Capsule grid: capsule cells + header capsules (grip dots, `data-field-type` badge via `::after`), tinted shell, separators/striping retired, frozen cells opaque | `tests/views/grid/capsule.test.ts` (7); `geometry.test.ts` separator contract updated |
| 5 | `eb9ea1d` | JetBrains Mono latin-400 woff2 bundled (SIL OFL), `@font-face`, LICENSE-FONTS | `tests/ui/fonts.test.ts` (+3 assertions) |
| 6 | `b2b9626` | Workspace card, themed view surface, theme-flip sync, 6px scrollbars, bundle guard 1.85 MB | `tests/views/card.test.ts` (3) |
| 7 | (this commit) | CHANGELOG `[Unreleased]`, review doc into `docs/plans/`, this evidence file | — |

## Gates

Every step ran the full `npm run check` (lint + vitest + check:guard + check:docs + esbuild
build) before push. Final state at Step 7: **728 tests green**, **0 lint errors**, 81
warnings (pre-existing baseline), guard/docs/build pass. No existing test was weakened;
the only contract changes are recorded in-code and in the Step 3/4 Linear comments
(`textContent` contracts preserved; separators moved from inline styles to capsule gaps).

## Contrast (check-contrast.mjs, both themes)

- Body text on bg/card/inner/capsule: light 16.04 / 17.14 / 14.97 / 17.14, dark 14.57 /
  13.22 / 14.16 / 12.60 — all ≥ 4.5:1 (AA).
- Muted on bg / inner: light 5.34 / 4.98, dark 7.06 / 6.10.
- Ink-on-accent (onAccent token): 5.23 (light terracotta) / 5.74 (dark) — replaces the
  rejected white-on-accent 2.83:1.
- Focus on bg: 3.07 light / 5.74 dark (UI component, ≥3:1).
- Border on bg: 1.25 / 1.45 — documented decorative deviation (borders are not text).

## Bundle

`tests/ui/fonts.test.ts` records: main.js ≈ 1.69 MB (dev, inline sourcemap) + styles.css
15 KB + fonts 80,956 B (Poppins ×2, Lora ×2, JetBrainsMono 21,168 B) + license 11 KB =
**1,797,031 B total**, under the 1.85 MB guard (raised with rationale from 1.80 MB in
Step 6; production release build is minified without the sourcemap).

## Performance

No structural change to virtualization, pooling, or the render path: capsule gaps are
transparent borders inside border-box cells, so row pitch, column widths and frozen
offsets are unchanged (geometry suite passes bit-identically). P6-02 bench expectation:
within noise; re-run recorded at release time.

## Pending on owner

- Device screenshots on a real vault (desktop + mobile, light + dark) confirming prototype
  parity — the visual sign-off this issue and SAD-69 scope F wait on. Drop them into
  `docs/evidence/SAD-71/` (any names; referenced from the SAD-71 thread).

## Deferred to v1.1 (owner-accepted)

Checkbox/select-all column and bulk delete; row-number column (frozen-geometry test
contracts map every header/row child; adding a column is a model change, not a restyle);
title row and in-pane export. Toasts stay Obsidian `Notice`. Dataset tabs / Ask Claude /
New Table / saved-indicator remain out of scope (prototype-only furniture).
