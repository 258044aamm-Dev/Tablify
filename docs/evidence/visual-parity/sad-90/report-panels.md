# Step 11 — panel parity (select, attachment, option manager)

`npx tsx tests/visual/capture-panels.ts --theme all --viewport owner,mobile --out .out/panels-all`

The card box, its offset from the cell it hangs from, the crop pixel difference and the
computed styles of the card and its parts. Crops and stacked montages (plugin above
prototype) sit next to this report.

## light · owner

### select-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 220×199 @ 724,306 | 220×199 @ 724,306 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / 0 | 6 / 0 | |
| crop pixels | 228×207 | 228×207 | 0.29 % differ |

Computed styles: no differences.

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (chips, the check, the placeholder in Lora at 11–12 px) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).

### attachment-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×136 @ 1236,306 | 320×136 @ 1236,306 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -9 | 6 / -9 | |
| crop pixels | 328×144 | 328×144 | 5.43 % differ |

| part | property | plugin | prototype |
|---|---|---|---|
| empty | `margin-bottom` | `0px` | `8px` |

**ACCEPTED:** the plugin hint reads "Vault-relative path — the file is checked when you press Enter. An unknown path still saves once you confirm."; the prototype line is demo narration ("... (spec §2.3). File picking is Obsidian-side — simulated here.") — the hint band is the bulk of the crop difference. The `empty` part's `margin-bottom` differs structurally (the plugin puts the 8px after the list, the prototype on the empty row itself) and the card box is identical in every combo. The remainder is glyph rasterisation: Chromium paints the inlined Font Awesome paths and Lora about a pixel differently from the prototype's webfont at 10–12 px (the accepted AA class, see docs/evidence/SAD-90.md).

### attachment-row

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×146 @ 1236,306 | 320×146 @ 1236,306 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -9 | 6 / -9 | |
| crop pixels | 328×154 | 328×154 | 5.12 % differ |

Computed styles: no differences.

### option-manager

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 448×273 @ 560,261 | 448×273 @ 560,261 | 0×0 @ 0,0 |
| offset under cell (top / left) | -39 / -164 | -39 / -164 | |
| crop pixels | 456×281 | 456×281 | 0.74 % differ |

Computed styles: no differences.

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (arrows, swatch edge, trash glyph, the Add button label) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).

## light · mobile

### select-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 220×199 @ 58,418 | 220×199 @ 58,418 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -406 | 6 / -150 | |
| crop pixels | 228×207 | 228×207 | 0.72 % differ |

Computed styles: no differences.

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (chips, the check, the placeholder in Lora at 11–12 px) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).

### attachment-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×136 @ 58,418 | 320×136 @ 58,418 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -738 | 6 / -150 | |
| crop pixels | 328×144 | 328×144 | 6.25 % differ |

| part | property | plugin | prototype |
|---|---|---|---|
| empty | `margin-bottom` | `0px` | `8px` |

**ACCEPTED:** the plugin hint reads "Vault-relative path — the file is checked when you press Enter. An unknown path still saves once you confirm."; the prototype line is demo narration ("... (spec §2.3). File picking is Obsidian-side — simulated here.") — the hint band is the bulk of the crop difference. The `empty` part's `margin-bottom` differs structurally (the plugin puts the 8px after the list, the prototype on the empty row itself) and the card box is identical in every combo. The remainder is glyph rasterisation: Chromium paints the inlined Font Awesome paths and Lora about a pixel differently from the prototype's webfont at 10–12 px (the accepted AA class, see docs/evidence/SAD-90.md).

### attachment-row

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×146 @ 58,418 | 320×146 @ 58,418 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -738 | 6 / -150 | |
| crop pixels | 328×154 | 328×154 | 5.26 % differ |

Computed styles: no differences.

### option-manager

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 358×288 @ 16,278 | 358×288 @ 16,278 | 0×0 @ 0,0 |
| offset under cell (top / left) | -134 / -448 | -134 / -192 | |
| crop pixels | 366×296 | 366×296 | 0.88 % differ |

Computed styles: no differences.

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (arrows, swatch edge, trash glyph, the Add button label) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).

## dark · owner

### select-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 220×199 @ 724,306 | 220×199 @ 724,306 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / 0 | 6 / 0 | |
| crop pixels | 228×207 | 228×207 | 0.42 % differ |

| part | property | plugin | prototype |
|---|---|---|---|
| manage | `color` | `rgb(217, 119, 87)` | `rgb(204, 120, 92)` |

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (chips, the check, the placeholder in Lora at 11–12 px) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).

### attachment-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×136 @ 1236,306 | 320×136 @ 1236,306 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -9 | 6 / -9 | |
| crop pixels | 328×144 | 328×144 | 5.39 % differ |

| part | property | plugin | prototype |
|---|---|---|---|
| empty | `margin-bottom` | `0px` | `8px` |

**ACCEPTED:** the plugin hint reads "Vault-relative path — the file is checked when you press Enter. An unknown path still saves once you confirm."; the prototype line is demo narration ("... (spec §2.3). File picking is Obsidian-side — simulated here.") — the hint band is the bulk of the crop difference. The `empty` part's `margin-bottom` differs structurally (the plugin puts the 8px after the list, the prototype on the empty row itself) and the card box is identical in every combo. The remainder is glyph rasterisation: Chromium paints the inlined Font Awesome paths and Lora about a pixel differently from the prototype's webfont at 10–12 px (the accepted AA class, see docs/evidence/SAD-90.md).

### attachment-row

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×146 @ 1236,306 | 320×146 @ 1236,306 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -9 | 6 / -9 | |
| crop pixels | 328×154 | 328×154 | 5.09 % differ |

Computed styles: no differences.

### option-manager

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 448×273 @ 560,261 | 448×273 @ 560,261 | 0×0 @ 0,0 |
| offset under cell (top / left) | -39 / -164 | -39 / -164 | |
| crop pixels | 456×281 | 456×281 | 0.60 % differ |

Computed styles: no differences.

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (arrows, swatch edge, trash glyph, the Add button label) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).

## dark · mobile

### select-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 220×199 @ 58,418 | 220×199 @ 58,418 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -406 | 6 / -150 | |
| crop pixels | 228×207 | 228×207 | 0.91 % differ |

| part | property | plugin | prototype |
|---|---|---|---|
| manage | `color` | `rgb(217, 119, 87)` | `rgb(204, 120, 92)` |

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (chips, the check, the placeholder in Lora at 11–12 px) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).

### attachment-panel

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×136 @ 58,418 | 320×136 @ 58,418 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -738 | 6 / -150 | |
| crop pixels | 328×144 | 328×144 | 6.14 % differ |

| part | property | plugin | prototype |
|---|---|---|---|
| empty | `margin-bottom` | `0px` | `8px` |

**ACCEPTED:** the plugin hint reads "Vault-relative path — the file is checked when you press Enter. An unknown path still saves once you confirm."; the prototype line is demo narration ("... (spec §2.3). File picking is Obsidian-side — simulated here.") — the hint band is the bulk of the crop difference. The `empty` part's `margin-bottom` differs structurally (the plugin puts the 8px after the list, the prototype on the empty row itself) and the card box is identical in every combo. The remainder is glyph rasterisation: Chromium paints the inlined Font Awesome paths and Lora about a pixel differently from the prototype's webfont at 10–12 px (the accepted AA class, see docs/evidence/SAD-90.md).

### attachment-row

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 320×146 @ 58,418 | 320×146 @ 58,418 | 0×0 @ 0,0 |
| offset under cell (top / left) | 6 / -738 | 6 / -150 | |
| crop pixels | 328×154 | 328×154 | 5.17 % differ |

Computed styles: no differences.

### option-manager

| | plugin | prototype | Δ |
|---|---|---|---|
| card | 358×288 @ 16,278 | 358×288 @ 16,278 | 0×0 @ 0,0 |
| offset under cell (top / left) | -134 / -448 | -134 / -192 | |
| crop pixels | 366×296 | 366×296 | 0.71 % differ |

Computed styles: no differences.

**ACCEPTED:** the remaining crop difference is glyph/text rasterisation (arrows, swatch edge, trash glyph, the Add button label) — the card, every part and the placement are identical (docs/evidence/SAD-90.md, the accepted AA class).
