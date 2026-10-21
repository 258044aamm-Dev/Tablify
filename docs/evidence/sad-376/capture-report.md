# SAD-376 — cell-overflow capture report (real plugin, visual harness)

Each combo: (1) hover on a cell whose text is cut off, (2) resting on its control — the
preview card, (3) the anchored panel, opened from the card's expand glyph. Every state is
asserted before it is shot; the numbers below are read from the live computed styles.

## Measured

| state | dark-owner | dark-desktop | dark-mobile | light-owner | light-desktop | light-mobile |
|---|---|---|---|---|---|---|
| `textLen` | 217 | 217 | 217 | 217 | 217 | 217 |
| `long_clipped` | true | true | true | true | true | true |
| `short_clipped` | false | false | false | false | false | false |
| `long_scroll_h` | 84 | 84 | 140 | 84 | 84 | 140 |
| `long_client_h` | 28 | 28 | 28 | 28 | 28 | 28 |
| `text_overflow` | clip | clip | clip | clip | clip | clip |
| `line_clamp` | 2 | 2 | 2 | 2 | 2 | 2 |
| `long_hasClass` | true | true | true | true | true | true |
| `short_hasClass` | false | false | false | false | false | false |
| `control_hidden_opacity` | 0 | 0 | 0 | 0 | 0 | 0 |
| `control_hidden_events` | none | none | none | none | none | none |
| `short_control` | true | true | true | true | true | true |
| `long_width` | 292 | 257 | 180 | 292 | 257 | 180 |
| `short_width` | 292 | 257 | 180 | 292 | 257 | 180 |
| `control_w` | 20 | 20 | 20 | 20 | 20 | 20 |
| `control_h` | 20 | 20 | 20 | 20 | 20 | 20 |
| `control_css_w` | 20px | 20px | 20px | 20px | 20px | 20px |
| `control_css_h` | 20px | 20px | 20px | 20px | 20px | 20px |
| `control_border` | 0px | 0px | 0px | 0px | 0px | 0px |
| `control_radius` | 8px | 8px | 8px | 8px | 8px | 8px |
| `control_ink` | rgb(156, 163, 175) | rgb(156, 163, 175) | rgb(156, 163, 175) | rgb(110, 101, 92) | rgb(110, 101, 92) | rgb(110, 101, 92) |
| `control_bottom` | 293 | 293 | 309 | 293 | 293 | 309 |
| `hover_opacity` | 1 | 1 | 1 | 1 | 1 | 1 |
| `hover_clamp` | 2 | 2 | 2 | 2 | 2 | 2 |
| `hover_text_overflow` | clip | clip | clip | clip | clip | clip |
| `hover_events` | auto | auto | auto | auto | auto | auto |
| `hover_label` | Show full content of Notes | Show full content of Notes | Show full content of Notes | Show full content of Notes | Show full content of Notes | Show full content of Notes |
| `control_x` | 672 | 598 | 332 | 672 | 598 | 332 |
| `control_y` | 273 | 273 | 289 | 273 | 273 | 289 |
| `role` | group | group | group | group | group | group |
| `card_w` | 320 | 320 | 320 | 320 | 320 | 320 |
| `card_h` | 134 | 134 | 134 | 134 | 134 | 134 |
| `card_x` | 672 | 598 | 58 | 672 | 598 | 58 |
| `card_y` | 299 | 299 | 315 | 299 | 299 | 315 |
| `card_gap` | 6 | 6 | 6 | 6 | 6 | 6 |
| `inside_x` | true | true | true | true | true | true |
| `inside_y` | true | true | true | true | true | true |
| `viewport_w` | 1568 | 1400 | 390 | 1568 | 1400 | 390 |
| `viewport_h` | 795 | 900 | 844 | 795 | 900 | 844 |
| `body_max_h` | 254.4px | 288px | 270.08px | 254.4px | 288px | 270.08px |
| `body_wrap` | pre-wrap | pre-wrap | pre-wrap | pre-wrap | pre-wrap | pre-wrap |
| `body_break` | anywhere | anywhere | anywhere | anywhere | anywhere | anywhere |
| `body_text_len` | 217 | 217 | 217 | 217 | 217 | 217 |
| `body_full` | true | true | true | true | true | true |
| `tools` | tablify-cell-overflow-card-copy+tablify-cell-overflow-card-expand | tablify-cell-overflow-card-copy+tablify-cell-overflow-card-expand | tablify-cell-overflow-card-copy+tablify-cell-overflow-card-expand | tablify-cell-overflow-card-copy+tablify-cell-overflow-card-expand | tablify-cell-overflow-card-copy+tablify-cell-overflow-card-expand | tablify-cell-overflow-card-copy+tablify-cell-overflow-card-expand |
| `tabbable` | 2 | 2 | 2 | 2 | 2 | 2 |
| `panel_role` | dialog | dialog | dialog | dialog | dialog | dialog |
| `panel_w` | 320 | 320 | 320 | 320 | 320 | 320 |
| `panel_x` | 412 | 373 | 58 | 412 | 373 | 58 |
| `panel_y` | 306 | 306 | 322 | 306 | 306 | 322 |
| `panel_inside_x` | true | true | true | true | true | true |
| `panel_inside_y` | true | true | true | true | true | true |
| `panel_full` | true | true | true | true | true | true |
| `card_closed` | true | true | true | true | true | true |

## Shots

- dark-owner.1-cell-hover.png
- dark-owner.2-card.png
- dark-owner.3-panel.png
- dark-desktop.1-cell-hover.png
- dark-desktop.2-card.png
- dark-desktop.3-panel.png
- dark-mobile.1-cell-hover.png
- dark-mobile.2-card.png
- dark-mobile.3-panel.png
- light-owner.1-cell-hover.png
- light-owner.2-card.png
- light-owner.3-panel.png
- light-desktop.1-cell-hover.png
- light-desktop.2-card.png
- light-desktop.3-panel.png
- light-mobile.1-cell-hover.png
- light-mobile.2-card.png
- light-mobile.3-panel.png
