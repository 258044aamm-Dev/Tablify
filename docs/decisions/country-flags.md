# Decision D-CF1 — country flags are bundled SVGs, not emoji

**Step:** SAD-355
**Date:** 2026-10-20
**Status:** DECIDED
**Decider:** Owner (issue SAD-355: *"Use an icon or flag for each country"*), implemented per the measurements below

---

## 1. Decision

**Inline SVG from `country-flag-icons` 1.6.20 (MIT) at build time, generated into `src/ui/flags.ts`
by `scripts/gen-flags.mjs`.** The package is a **devDependency**; no runtime dependency is added
and the plugin makes no network request.

The two-letter monogram (`.tablify__country-badge`) remains in the codebase as the **fallback** for
a code with no asset. At the pinned versions there are none: 245 regions supported by
`libphonenumber-js`, 245 flag files.

## 2. Why not an emoji flag (🇧🇩 = U+1F1E7 U+1F1E9)

An emoji flag costs zero bytes and renders correctly on macOS, iOS and Android. It does not render
as a flag on the two desktop platforms this plugin also targets:

| Platform | What a regional-indicator pair renders as |
|---|---|
| macOS / iOS / Android | the flag |
| **Windows 10 / 11** | **two letters** — Segoe UI Emoji ships no flag glyphs |
| **Linux without Noto Color Emoji** | **tofu** |

`.tablify__country-badge`'s original comment (`styles.css`) recorded exactly this and chose the
monogram for it. The monogram is consistent everywhere but is not what the issue asked for, so the
asset ships instead — and the note is rewritten to explain the new arrangement rather than left
contradicting the code.

## 3. Why not a remote sprite

The plugin ships offline, and `tests/visual/lib/routes.ts` aborts every external request by
deliberate policy ("the production harness must make zero external requests"). A CDN flag set would
fail that rule and break in a vault with no network.

## 4. Measured cost

| | value |
|---|---|
| Regions in the picker (`libphonenumber-js` `getCountries()`) | 245 |
| Regions with a flag asset in `country-flag-icons@1.6.20/3x2` | **245 — 0 missing** |
| Raw SVG bytes for those 245 | 162,901 B (159 KB) |
| Same, minified + inlined in `src/ui/flags.ts` | 157,376 B |
| Gzipped | ≈ 42 KB |
| Package total before | 1,550,014 B |
| Package total after | **1,713,905 B** |
| Cap (`tests/ui/fonts.test.ts:145`) | 1,900,000 B |
| Headroom | **186,095 B** |

The cap is **not** raised: every previous raise in that test's comment block was an owner decision,
and this change does not need one.

## 5. How coverage is guaranteed

The generator iterates `getCountries()` from `libphonenumber-js`, **not** the flag package's
directory listing. The picker's list *is* that function's output, so:

- a region the parser supports always has a flag in the table, and
- a future `libphonenumber-js` bump that adds a region the pinned flag package lacks makes
  `npm run check:flags` **fail**, rather than rendering a blank row at runtime.

`check:flags` runs inside `npm run check`, beside `check:icons` (the Font Awesome generator's
guard), so both generated asset files are held to the same rule.

## 6. Rendering and semantics

- 21 × 14 (3:2), `border-radius: 3px`, with a hairline **ring** (`box-shadow`, not `border`, so the
  ratio and the width stay exact). Without it, a mostly-white flag (JP, PL, ID, BO) dissolves into
  the white card in the light theme.
- `aria-hidden="true"`, `focusable="false"`, no `<title>`: the flag is decorative and the row's
  accessible name stays the country name beside it. 245 `<img alt>` would double that name.
- The mark also carries `data-iso`, because a flag has no text and identity has to stay readable by
  tests and by anyone inspecting the DOM.
- Vector, so it stays crisp at 200 % zoom and on HiDPI.

## 7. What this decision does **not** change

- The list's order, contents, search scoring or aliases.
- `phoneCountry`, `formatVersion`, the schema, or how a stored value is read.
- Any surface other than the country row and the two country triggers.

## 8. If the numbers ever change

The fallback path is already there: `paintCountryMark()` draws the monogram whenever
`flagIcon(iso)` returns `''`. Dropping the flags entirely is `git revert` of one commit plus
`rm src/ui/flags.ts`.
