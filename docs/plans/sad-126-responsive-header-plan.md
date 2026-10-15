# SAD-126 — Prioritize field name over type in responsive headers

**Issue:** SAD-126 · **Base:** `8af0ef6` · **Date:** 2026-10-15 · **Scope:** CSS-only header layout fix

## Goal and scope

In narrow table headers, the field-type badge should yield space before the field name. The field name should remain as legible as possible; if the header is too narrow for both, its existing ellipsis behavior remains available. Keep the badge's `data-type` and `title`, sort arrow, grip/key/menu controls, and DOM/text contracts unchanged. Limit changes to the capsule CSS and a targeted CSS regression test; no data/model, sorting, menu, column-sizing, or interaction logic changes.

## Cause

`buildHeaderCapsule` in `src/views/grid/GridView.ts` places the name and type badge in `.tablify__hc-main`. The name currently has normal flex sizing and ellipsis. The badge has `flex: 0 0 auto`, so it never yields its intrinsic width. Negative free space is therefore taken from the name first.

## Planned CSS change

Keep the name at its existing sizing (`flex: 0 1 auto`, the browser default) so it retains its intrinsic width in ordinary layouts and can still ellipsize if the header remains too narrow after the badge has yielded. Give the badge a much larger shrink weight, plus an explicit zero minimum and clipping:

```css
/* Name button and read-only name span */
flex: 0 1 auto;
min-width: 0;

/* Type badge */
flex: 0 999 auto;
min-width: 0;
overflow: hidden;
```

The badge's high shrink weight makes it absorb overwhelmingly more of the initial negative free space; once it reaches its padding/border minimum, remaining shrink can be taken from the name. The badge only changes when the capsule is crowded. `overflow: hidden` clips its inline SVG/type label instead of letting them escape the badge. Its `title` and `data-type` attributes continue to carry the full type.

Do **not** use a zero flex basis on the name: making its basis zero turns it into a growable remainder and can cause the name to give up width before the badge. Do not set `flex-grow` on the name or change the capsule's fixed controls.

## Files

- `styles.css`: explicit normal sizing for the button/static name (same as current default); allow the badge to shrink strongly and clip.
- `tests/views/grid/capsule.test.ts`: add a CSS rule assertion for name sizing/ellipsis and badge shrink/min-width/overflow.
- This plan file: record the targeted implementation decision.

No changes to `GridView.ts`, `CHANGELOG.md`, `spec/features.md`, or unrelated files.

## Verification

1. Targeted header/capsule tests: **32 passed**.
2. `npm run check`: **passed** (all 106 test files / 1,634 tests, guard/docs/icon checks, and build). Existing lint warnings remain outside this change.
3. Confirm `buildHeaderCapsule` markup contracts remain intact: header `textContent` is still exactly the field name; badge `data-type`/`title`, sort arrow, grip/key/menu and resize controls remain unchanged.

## Out of scope

No changes to column widths, fill/frozen-column behavior, sort/menu/drag/resize logic, other header controls, or dependencies. Do not alter the pre-existing local change to `scripts/check-tabula-guard.sh`.
