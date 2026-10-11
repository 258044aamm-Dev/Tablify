# Baseline measurement — plugin vs prototype (2026-10-11, `6dbdf00`)

One command, 32 combinations: `dark,light` × `owner 1568×795, mobile 390×844` × `new,populated` × `default,options,selected,grouped`.
Raw per-region output: [`report.md`](report.md). Selected crops: [`crops/`](crops/).
Bar in use across the programme: **≤ 0.5 % pixel difference per crop**.

## Desktop 1568×795 — inside the bar (leave alone)

`card` (size-identical), `title-row` 0.33 %, `title` —, `file-chip` —, `search` size 890×889, `grid-shell` 0.06–0.18 %, `header-capsule` 0.36–0.38 %, `header-name` —, `header-num` 0.00 %, `body-cell` 0.00 %, `insert-row` 0.05 %, `header-check` 0.00 %, `row-check` 0.00 %, `options-panel` 0.21–0.22 %, `btn-add-row` 0.05 %, `btn-add-field` 0.10 %, `btn-filter` 0.00 %.

## Desktop — above the bar

| Region | dark | light | Worst combo |
|---|---|---|---|
| type-badge (grouped) | 6.86 % | 7.05 % | `*-owner-populated-grouped` |
| group-header | 5.73 % | 5.73 % | `*-owner-new-grouped` |
| selection-summary | 5.04 % | 2.18 % | `dark-owner-populated-selected` |
| btn-sync | 3.40 % | 3.80 % | `*-owner-new-default` |
| btn-options | 1.41 % | 1.44 % | `*-owner-new-default` |
| toolbar-row | 1.28 % | 1.27 % | `*-owner-new-default` |
| btn-redo / btn-undo | 0.85 / 0.78 % | 0.92 / 0.85 % | `*-owner-new-default` |
| row-number | 0.63 % | 0.52 % | `*-owner-new-default` |

## Mobile 390×844 — systematic divergence

| Region | dark | light | Size (plugin vs prototype) |
|---|---|---|---|
| btn-add-field | 58.25 % | 61.08 % | 102×38 vs **77×54** |
| btn-add-row | 37.07 % | 41.49 % | 99×38 vs **74×54** |
| btn-filter | 36.32 % | 40.69 % | 80×38 (label shifted) |
| grid-shell | 33.92 % | 42.58 % | same size, page shifted 16 px |
| toolbar-row | 33.29 % | 37.38 % | 332×**86** vs 332×**102** |
| title-row | 31.58 % | 35.98 % | — |
| insert-row | 26.15 % | 33.99 % | — |
| header-capsule | 35.81 % | 39.51 % | — |
| card | — | — | 366×**572** vs 366×**588** |
| type-badge | 12.15 % | 15.86 % | — |
| body-cell | 6.35 % | 9.48 % | — |

**Cause:** `.tablify button.tablify__toolbar-button { white-space: nowrap; flex: 0 0 auto }` + `.tablify__toolbar-actions { overflow-x: auto }` (`styles.css` 261–300). The prototype's buttons shrink and wrap their labels instead (`Add / Row` on two lines), which is the whole 16 px.

## Harness notes

* 112 of 112 combos report a `box-shadow` string difference that does **not** change rendering (the prototype's Tailwind ring variables emit extra `rgba(0,0,0,0)` layers). Normalise before judging.
* `--fixture populated --state grouped` **hangs** (`capture-compare.ts:199`): `samples/v2/customers.tablify` has no select field to group by.
* No capture route exists yet for Export / Import / Sync dialogs, the select panel, the option manager, the attachment panel, the context-menu cards, the invalid badge/cells or the embed surface — and none for `:hover` / `:focus-visible` / `:active` states.
