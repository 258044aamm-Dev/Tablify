# SAD-81 visual parity report

Two runs of tests/visual/capture-compare.ts; see docs/evidence/SAD-81.md for commands and reading notes.

## Run A: default + options (all fixtures)

### dark-owner-new-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×480 | 1520×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×287 | 1462×287 | 0.06 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.38 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.13 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.63 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-owner-new-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×480 | 1520×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×287 | 1462×287 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.38 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.13 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.63 % | none |
| insert-row | 1436×38 | 1436×38 | 0.05 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### dark-owner-empty-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×330 | 1520×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×137 | 1462×137 | 0.01 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 972×40 | 972×40 | 0.05 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 243×45 | 243×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |

### dark-owner-empty-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×330 | 1520×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×137 | 1462×137 | 0.05 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 972×40 | 972×40 | 0.26 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 243×45 | 243×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |
| options-panel | 302×360 | 302×360 | 0.12 % | none |

### dark-owner-populated-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×430 | 1520×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×237 | 1462×237 | 0.16 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 572×40 | 572×40 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 143×45 | 143×45 | 0.00 % | none |
| body-cell | 566×34 | 566×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 143×42 | 143×42 | 0.62 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-owner-populated-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×430 | 1520×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×237 | 1462×237 | 0.18 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 572×40 | 572×40 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 143×45 | 143×45 | 0.00 % | none |
| body-cell | 566×34 | 566×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 143×42 | 143×42 | 0.62 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×388 | 302×388 | 0.11 % | none |

### dark-owner-grouped-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×730 | 1520×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×537 | 1462×537 | 0.49 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.38 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.13 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.63 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-owner-grouped-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×730 | 1520×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×537 | 1462×537 | 0.51 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.38 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.13 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.63 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### dark-desktop-new-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×480 | 1352×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×287 | 1294×287 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.72 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-desktop-new-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×480 | 1352×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×287 | 1294×287 | 0.10 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.72 % | none |
| insert-row | 1268×38 | 1268×38 | 0.06 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### dark-desktop-empty-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×330 | 1352×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×137 | 1294×137 | 0.03 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 856×40 | 856×40 | 0.16 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.41 % | none |
| header-num | 214×45 | 214×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |

### dark-desktop-empty-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×330 | 1352×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×137 | 1294×137 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 856×40 | 856×40 | 0.40 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.41 % | none |
| header-num | 214×45 | 214×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |
| options-panel | 302×360 | 302×360 | 0.12 % | none |

### dark-desktop-populated-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×430 | 1352×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×237 | 1294×237 | 0.18 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 503×40 | 503×40 | 0.31 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 1.86 % | none |
| header-num | 126×45 | 126×45 | 0.00 % | none |
| body-cell | 497×34 | 497×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 126×42 | 126×42 | 0.32 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-desktop-populated-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×430 | 1352×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×237 | 1294×237 | 0.21 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 503×40 | 503×40 | 0.31 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 1.86 % | none |
| header-num | 126×45 | 126×45 | 0.00 % | none |
| body-cell | 497×34 | 497×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 126×42 | 126×42 | 0.32 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×388 | 302×388 | 0.11 % | none |

### dark-desktop-grouped-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×730 | 1352×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×537 | 1294×537 | 0.56 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.72 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-desktop-grouped-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×730 | 1352×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×537 | 1294×537 | 0.57 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.72 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### dark-mobile-new-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×572 | 366×588 | — | `height`: 572px → 588px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 0.16 % | none |
| title | 142×64 | 142×64 | — | none |
| file-chip | 186×38 | 186×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 15.22 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 37.07 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 58.25 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.45 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×279 | 332×279 | 0.45 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.33 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | 1.01 % | none |
| insert-row | 314×38 | 314×38 | 0.01 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-mobile-new-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×572 | 366×588 | — | `height`: 572px → 588px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 31.58 % | none |
| title | 142×64 | 142×64 | — | none |
| file-chip | 186×38 | 186×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 33.29 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 36.06 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 37.00 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 36.32 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×279 | 332×279 | 33.07 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 35.81 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 12.15 % | none |
| header-num | 40×45 | 40×45 | — | none |
| body-cell | 152×34 | 152×34 | 4.57 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | — | none |
| insert-row | 314×38 | 314×38 | 26.14 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | 13×13 | 13×13 | — | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### dark-mobile-empty-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×422 | 366×438 | — | `height`: 422px → 438px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 0.16 % | none |
| title | 144×64 | 144×64 | — | none |
| file-chip | 184×38 | 184×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 15.22 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 37.07 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 58.25 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.45 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×129 | 332×129 | 0.04 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 198×40 | 198×40 | 0.23 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 50×45 | 50×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 314×38 | 314×38 | 0.01 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |

### dark-mobile-empty-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×422 | 366×438 | — | `height`: 422px → 438px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 31.45 % | none |
| title | 144×64 | 144×64 | — | none |
| file-chip | 184×38 | 184×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 33.29 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 36.06 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 37.00 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 36.32 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×129 | 332×129 | 36.13 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 198×40 | 198×40 | 34.58 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 34.04 % | none |
| header-num | 50×45 | 50×45 | 72.04 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 314×38 | 314×38 | 28.98 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | missing | missing | — | — |
| options-panel | 302×360 | 302×360 | 0.12 % | none |

### dark-mobile-populated-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×490 | 366×506 | — | `height`: 490px → 506px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 0.23 % | none |
| title | 141×32 | 141×32 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 15.21 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 37.06 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 58.25 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.45 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×229 | 332×229 | 0.76 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.33 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | 1.01 % | none |
| insert-row | 314×38 | 314×38 | 0.01 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-mobile-populated-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×490 | 366×506 | — | `height`: 490px → 506px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 31.57 % | none |
| title | 141×32 | 141×32 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 33.28 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 36.05 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 37.00 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 36.28 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×229 | 332×229 | 33.92 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 35.81 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 12.15 % | none |
| header-num | 40×45 | 40×45 | — | none |
| body-cell | 152×34 | 152×34 | 6.35 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | — | none |
| insert-row | 314×38 | 314×38 | 26.15 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | 13×13 | 13×13 | — | none |
| options-panel | 302×388 | 302×388 | 0.11 % | none |

### dark-mobile-grouped-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×790 | 366×806 | — | `height`: 790px → 806px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 0.23 % | none |
| title | 114×32 | 114×32 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 15.21 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 37.06 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 58.25 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.45 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×529 | 332×529 | 0.31 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.33 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | 1.01 % | none |
| insert-row | 314×38 | 314×38 | 0.01 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### dark-mobile-grouped-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×790 | 366×806 | — | `height`: 790px → 806px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 31.50 % | none |
| title | 114×32 | 114×32 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 33.28 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 36.05 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 37.00 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.35 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 36.28 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×529 | 332×529 | 31.77 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 35.81 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 12.15 % | none |
| header-num | 40×45 | 40×45 | — | none |
| body-cell | 152×34 | 152×34 | 5.82 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | — | none |
| insert-row | 314×38 | 314×38 | 26.37 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | 13×13 | 13×13 | — | none |
| options-panel | 302×472 | 302×472 | 0.12 % | none |

### light-owner-new-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×480 | 1520×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×287 | 1462×287 | 0.05 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.36 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.04 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.52 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-owner-new-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×480 | 1520×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×287 | 1462×287 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.36 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.04 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.52 % | none |
| insert-row | 1436×38 | 1436×38 | 0.05 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### light-owner-empty-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×330 | 1520×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×137 | 1462×137 | 0.01 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 972×40 | 972×40 | 0.04 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 243×45 | 243×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |

### light-owner-empty-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×330 | 1520×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×137 | 1462×137 | 0.05 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 972×40 | 972×40 | 0.26 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 243×45 | 243×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |
| options-panel | 302×360 | 302×360 | 0.12 % | none |

### light-owner-populated-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×430 | 1520×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×237 | 1462×237 | 0.14 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 572×40 | 572×40 | 0.07 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 143×45 | 143×45 | 0.00 % | none |
| body-cell | 566×34 | 566×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 143×42 | 143×42 | 0.50 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-owner-populated-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×430 | 1520×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×237 | 1462×237 | 0.17 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 572×40 | 572×40 | 0.07 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 143×45 | 143×45 | 0.00 % | none |
| body-cell | 566×34 | 566×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 143×42 | 143×42 | 0.50 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×388 | 302×388 | 0.11 % | none |

### light-owner-grouped-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×730 | 1520×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×537 | 1462×537 | 0.29 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.36 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.04 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.52 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-owner-grouped-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1520×730 | 1520×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×537 | 1462×537 | 0.31 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 253×40 | 253×40 | 0.36 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.04 % | none |
| header-num | 64×45 | 64×45 | 0.00 % | none |
| body-cell | 247×34 | 247×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 64×42 | 64×42 | 0.52 % | none |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### light-desktop-new-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×480 | 1352×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.44 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×287 | 1294×287 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.60 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-desktop-new-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×480 | 1352×480 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.43 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×287 | 1294×287 | 0.10 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.60 % | none |
| insert-row | 1268×38 | 1268×38 | 0.05 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### light-desktop-empty-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×330 | 1352×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.44 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×137 | 1294×137 | 0.03 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 856×40 | 856×40 | 0.16 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.41 % | none |
| header-num | 214×45 | 214×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |

### light-desktop-empty-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×330 | 1352×330 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 191×36 | 191×36 | — | none |
| file-chip | 200×22 | 200×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.43 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×137 | 1294×137 | 0.08 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 856×40 | 856×40 | 0.40 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.41 % | none |
| header-num | 214×45 | 214×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |
| options-panel | 302×360 | 302×360 | 0.12 % | none |

### light-desktop-populated-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×430 | 1352×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.44 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×237 | 1294×237 | 0.17 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 503×40 | 503×40 | 0.33 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.04 % | none |
| header-num | 126×45 | 126×45 | 0.00 % | none |
| body-cell | 497×34 | 497×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 126×42 | 126×42 | 0.26 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-desktop-populated-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×430 | 1352×430 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 172×36 | 172×36 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.43 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×237 | 1294×237 | 0.20 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 503×40 | 503×40 | 0.33 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.04 % | none |
| header-num | 126×45 | 126×45 | 0.00 % | none |
| body-cell | 497×34 | 497×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 126×42 | 126×42 | 0.26 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×388 | 302×388 | 0.11 % | none |

### light-desktop-grouped-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×730 | 1352×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.44 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×537 | 1294×537 | 0.34 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.60 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-desktop-grouped-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 1352×730 | 1352×730 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.43 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.08 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×537 | 1294×537 | 0.35 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 222×40 | 222×40 | 0.53 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 56×45 | 56×45 | 0.00 % | none |
| body-cell | 216×34 | 216×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 56×42 | 56×42 | 0.60 % | none |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### light-mobile-new-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×572 | 366×588 | — | `height`: 572px → 588px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 0.17 % | none |
| title | 142×64 | 142×64 | — | none |
| file-chip | 186×38 | 186×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 17.61 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 41.49 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 61.08 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.38 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×279 | 332×279 | 0.41 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.32 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | 0.83 % | none |
| insert-row | 314×38 | 314×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-mobile-new-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×572 | 366×588 | — | `height`: 572px → 588px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 35.97 % | none |
| title | 142×64 | 142×64 | — | none |
| file-chip | 186×38 | 186×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 37.37 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 38.65 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 39.74 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 40.69 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×279 | 332×279 | 41.28 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 39.51 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 15.86 % | none |
| header-num | 40×45 | 40×45 | — | none |
| body-cell | 152×34 | 152×34 | 7.28 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | — | none |
| insert-row | 314×38 | 314×38 | 30.10 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | 13×13 | 13×13 | — | none |
| options-panel | 302×472 | 302×472 | 0.09 % | none |

### light-mobile-empty-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×422 | 366×438 | — | `height`: 422px → 438px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 0.17 % | none |
| title | 144×64 | 144×64 | — | none |
| file-chip | 184×38 | 184×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 17.61 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 41.47 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 61.04 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.38 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×129 | 332×129 | 0.04 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 198×40 | 198×40 | 0.21 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 50×45 | 50×45 | 0.00 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 314×38 | 314×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | missing | missing | — | — |

### light-mobile-empty-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×422 | 366×438 | — | `height`: 422px → 438px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 35.82 % | none |
| title | 144×64 | 144×64 | — | none |
| file-chip | 184×38 | 184×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 37.38 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 38.68 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 39.78 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 40.69 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×129 | 332×129 | 43.32 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 198×40 | 198×40 | 36.72 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 34.79 % | none |
| header-num | 50×45 | 50×45 | 77.29 % | none |
| body-cell | missing | missing | — | — |
| row-number | missing | missing | — | — |
| insert-row | 314×38 | 314×38 | 36.70 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | missing | missing | — | — |
| options-panel | 302×360 | 302×360 | 0.12 % | none |

### light-mobile-populated-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×490 | 366×506 | — | `height`: 490px → 506px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 0.24 % | none |
| title | 141×32 | 141×32 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 17.60 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 41.45 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 61.04 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.38 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×229 | 332×229 | 0.70 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.32 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | 0.83 % | none |
| insert-row | 314×38 | 314×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-mobile-populated-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×490 | 366×506 | — | `height`: 490px → 506px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 35.98 % | none |
| title | 141×32 | 141×32 | — | none |
| file-chip | 186×22 | 186×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 37.38 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 38.68 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 39.78 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 40.66 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×229 | 332×229 | 42.58 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 39.51 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 15.86 % | none |
| header-num | 40×45 | 40×45 | — | none |
| body-cell | 152×34 | 152×34 | 9.48 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | — | none |
| insert-row | 314×38 | 314×38 | 33.99 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | 13×13 | 13×13 | — | none |
| options-panel | 302×388 | 302×388 | 0.11 % | none |

### light-mobile-grouped-default

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×790 | 366×806 | — | `height`: 790px → 806px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 0.24 % | none |
| title | 114×32 | 114×32 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 17.60 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 41.45 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 61.04 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.38 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×529 | 332×529 | 0.28 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.32 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | 0.83 % | none |
| insert-row | 314×38 | 314×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| row-check | 13×13 | 13×13 | 0.00 % | none |

### light-mobile-grouped-options

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| card | 366×790 | 366×806 | — | `height`: 790px → 806px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 36.42 % | none |
| title | 114×32 | 114×32 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 37.38 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 38.68 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 39.78 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 40×33 | 40×33 | — | none |
| btn-filter | 80×38 | 80×38 | 40.66 % | none |
| btn-redo | 37×38 | 37×38 | — | none |
| btn-undo | 37×38 | 37×38 | — | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×529 | 332×529 | 39.92 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 39.51 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 18×16 | 18×16 | — | none |
| type-badge | 49×22 | 49×22 | 15.86 % | none |
| header-num | 40×45 | 40×45 | — | none |
| body-cell | 152×34 | 152×34 | 8.69 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| row-number | 40×42 | 40×42 | — | none |
| insert-row | 314×38 | 314×38 | 29.31 % | none |
| header-check | 13×13 | 13×13 | — | none |
| row-check | 13×13 | 13×13 | — | none |
| options-panel | 302×472 | 302×472 | 0.10 % | none |

## Run B: grouped (new + grouped fixtures)

### dark-owner-new-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.18 % | none |
| card | 1520×514 | 1520×514 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×321 | 1462×321 | 0.05 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 311×40 | 311×40 | 0.29 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 78×45 | 78×45 | 0.00 % | none |
| body-cell | 305×34 | 305×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | `color`: rgb(217, 119, 87) → rgb(204, 120, 92) |
| group-header | 84×16 | 84×16 | 5.73 % | none |
| group-chip | missing | missing | — | — |
| group-row | 1436×34 | 1424×26 | — | `width`: 1436px → 1424px<br>`height`: 34px → 26px |

### dark-owner-grouped-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.18 % | none |
| card | 1520×747 | 1520×884 | — | `height`: 747px → 884px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.33 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.28 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×555 | 1462×691 | 8.07 % | `height`: 555px → 691px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 311×40 | 311×40 | 0.29 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 78×45 | 78×45 | 0.00 % | none |
| body-cell | 305×34 | 305×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1436×38 | 1436×38 | — | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | `color`: rgb(217, 119, 87) → rgb(204, 120, 92) |
| group-header | 102×22 | 103×22 | 3.84 % | none |
| group-chip | 71×22 | 71×22 | 1.66 % | none |
| group-row | 1436×40 | 1424×32 | — | `width`: 1436px → 1424px<br>`height`: 40px → 32px |

### dark-desktop-new-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.18 % | none |
| card | 1352×514 | 1352×514 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×321 | 1294×321 | 0.06 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 274×40 | 274×40 | 0.26 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 69×45 | 69×45 | 0.00 % | none |
| body-cell | 268×34 | 268×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | `color`: rgb(217, 119, 87) → rgb(204, 120, 92) |
| group-header | 84×16 | 84×16 | 5.73 % | none |
| group-chip | missing | missing | — | — |
| group-row | 1268×34 | 1256×26 | — | `width`: 1268px → 1256px<br>`height`: 34px → 26px |

### dark-desktop-grouped-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.18 % | none |
| card | 1352×852 | 1352×884 | — | `height`: 852px → 884px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.38 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.45 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.41 % | none |
| btn-sync | 72×38 | 72×38 | 3.40 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×660 | 1294×691 | 4.32 % | `height`: 660px → 691px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 274×40 | 274×40 | 0.26 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 69×45 | 69×45 | 0.00 % | none |
| body-cell | 268×34 | 268×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1268×38 | 1268×38 | 0.21 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | `color`: rgb(217, 119, 87) → rgb(204, 120, 92) |
| group-header | 102×22 | 103×22 | 3.84 % | none |
| group-chip | 71×22 | 71×22 | 1.66 % | none |
| group-row | 1268×40 | 1256×32 | — | `width`: 1268px → 1256px<br>`height`: 40px → 32px |

### dark-mobile-new-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.18 % | none |
| card | 366×606 | 366×622 | — | `height`: 606px → 622px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 0.16 % | none |
| title | 142×64 | 142×64 | — | none |
| file-chip | 186×38 | 186×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 15.22 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 37.07 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 58.25 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.45 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×313 | 332×313 | 0.41 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.28 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 0×16 | 0×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 314×38 | 314×38 | 0.01 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | `color`: rgb(217, 119, 87) → rgb(204, 120, 92) |
| group-header | 84×16 | 84×16 | 5.73 % | none |
| group-chip | missing | missing | — | — |
| group-row | 754×34 | 742×26 | — | `width`: 754px → 742px<br>`height`: 34px → 26px |

### dark-mobile-grouped-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.18 % | none |
| card | 366×820 | 366×960 | — | `height`: 820px → 960px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 0.23 % | none |
| title | 114×32 | 114×32 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 15.21 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 37.06 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 58.25 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.45 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.85 % | none |
| btn-undo | 37×38 | 37×38 | 0.78 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×560 | 332×683 | 3.67 % | `height`: 560px → 683px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.28 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 0×16 | 0×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 314×38 | 314×38 | — | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | `color`: rgb(217, 119, 87) → rgb(204, 120, 92) |
| group-header | 102×22 | 103×22 | 3.84 % | none |
| group-chip | 71×22 | 71×22 | 1.66 % | none |
| group-row | 754×40 | 742×32 | — | `width`: 754px → 742px<br>`height`: 40px → 32px |

### light-owner-new-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.20 % | none |
| card | 1520×514 | 1520×514 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×321 | 1462×321 | 0.04 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 311×40 | 311×40 | 0.28 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 78×45 | 78×45 | 0.00 % | none |
| body-cell | 305×34 | 305×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1436×38 | 1436×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | none |
| group-header | 84×16 | 84×16 | 5.73 % | none |
| group-chip | missing | missing | — | — |
| group-row | 1436×34 | 1424×26 | — | `width`: 1436px → 1424px<br>`height`: 34px → 26px |

### light-owner-grouped-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.20 % | none |
| card | 1520×747 | 1520×884 | — | `height`: 747px → 884px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1462×36 | 1462×36 | 0.35 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1462×38 | 1462×38 | 1.27 % | none |
| search | 890×38 | 889×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.80 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1462×555 | 1462×691 | 8.71 % | `height`: 555px → 691px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 311×40 | 311×40 | 0.28 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 78×45 | 78×45 | 0.00 % | none |
| body-cell | 305×34 | 305×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1436×38 | 1436×38 | — | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | none |
| group-header | 102×22 | 103×22 | 4.24 % | none |
| group-chip | 71×22 | 71×22 | 1.66 % | none |
| group-row | 1436×40 | 1424×32 | — | `width`: 1436px → 1424px<br>`height`: 40px → 32px |

### light-desktop-new-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.20 % | none |
| card | 1352×514 | 1352×514 | — | `box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 206×36 | 206×36 | — | none |
| file-chip | 221×22 | 221×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.44 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×321 | 1294×321 | 0.06 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 274×40 | 274×40 | 0.26 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 69×45 | 69×45 | 0.00 % | none |
| body-cell | 268×34 | 268×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1268×38 | 1268×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | none |
| group-header | 84×16 | 84×16 | 5.73 % | none |
| group-chip | missing | missing | — | — |
| group-row | 1268×34 | 1256×26 | — | `width`: 1268px → 1256px<br>`height`: 34px → 26px |

### light-desktop-grouped-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.20 % | none |
| card | 1352×852 | 1352×884 | — | `height`: 852px → 884px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 1294×36 | 1294×36 | 0.39 % | none |
| title | 138×36 | 138×36 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 1294×38 | 1294×38 | 1.44 % | none |
| search | 722×38 | 721×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 99×38 | 0.05 % | none |
| btn-add-field | 102×38 | 102×38 | 0.10 % | none |
| btn-options | 88×38 | 88×38 | 1.44 % | none |
| btn-sync | 72×38 | 72×38 | 3.84 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 1294×660 | 1294×691 | 4.57 % | `height`: 660px → 691px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 274×40 | 274×40 | 0.26 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 39×16 | 39×16 | — | none |
| type-badge | 49×22 | 49×22 | 2.23 % | none |
| header-num | 69×45 | 69×45 | 0.00 % | none |
| body-cell | 268×34 | 268×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 1268×38 | 1268×38 | 5.30 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | none |
| group-header | 102×22 | 103×22 | 4.24 % | none |
| group-chip | 71×22 | 71×22 | 1.66 % | none |
| group-row | 1268×40 | 1256×32 | — | `width`: 1268px → 1256px<br>`height`: 40px → 32px |

### light-mobile-new-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.20 % | none |
| card | 366×606 | 366×622 | — | `height`: 606px → 622px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×112 | 332×112 | 0.17 % | none |
| title | 142×64 | 142×64 | — | none |
| file-chip | 186×38 | 186×38 | — | none |
| toolbar-row | 332×86 | 332×102 | 17.61 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 41.49 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 61.08 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.38 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×313 | 332×313 | 0.38 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.27 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 0×16 | 0×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 314×38 | 314×38 | 0.00 % | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | none |
| group-header | 84×16 | 84×16 | 5.73 % | none |
| group-chip | missing | missing | — | — |
| group-row | 754×34 | 742×26 | — | `width`: 754px → 742px<br>`height`: 34px → 26px |

### light-mobile-grouped-grouped

| Region | Plugin | Prototype | Pixel diff | Style differences |
|---|---|---|---|---|
| options-panel | 302×530 | 302×530 | 0.21 % | none |
| card | 366×820 | 366×960 | — | `height`: 820px → 960px<br>`box-shadow`: rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.1) 0px 20px 25px -5px, rgba(0, 0, 0, 0.1) 0px 8px 10px -6px |
| title-row | 332×80 | 332×80 | 0.24 % | none |
| title | 114×32 | 114×32 | — | none |
| file-chip | 172×22 | 172×22 | — | none |
| toolbar-row | 332×86 | 332×102 | 17.60 % | `height`: 86px → 102px |
| search | 332×38 | 332×38 | — | `border-top-left-radius`: 999px → 9999px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| btn-add-row | 99×38 | 74×54 | 41.45 % | `width`: 99px → 74px<br>`height`: 38px → 54px |
| btn-add-field | 102×38 | 77×54 | 61.04 % | `width`: 102px → 77px<br>`height`: 38px → 54px |
| btn-options | 88×38 | 88×38 | — | none |
| btn-sync | 40×33 | 40×33 | 0.38 % | none |
| btn-filter | 80×38 | 80×38 | 0.00 % | none |
| btn-redo | 37×38 | 37×38 | 0.92 % | none |
| btn-undo | 37×38 | 37×38 | 0.85 % | none |
| row-count | 45×17 | 45×17 | — | none |
| grid-shell | 332×560 | 332×683 | 3.12 % | `height`: 560px → 683px<br>`box-shadow`: rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 2px 4px 0px inset |
| header-capsule | 158×40 | 158×40 | 0.27 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| header-name | 0×16 | 0×16 | — | none |
| type-badge | 49×22 | 49×22 | 0.56 % | none |
| header-num | 40×45 | 40×45 | 0.00 % | none |
| body-cell | 152×34 | 152×34 | 0.00 % | `box-shadow`: rgba(0, 0, 0, 0.05) 0px 1px 2px 0px → rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0) 0px 0px 0px 0px, rgba(0, 0, 0, 0.05) 0px 1px 2px 0px |
| insert-row | 314×38 | 314×38 | — | none |
| header-check | 13×13 | 13×13 | 0.00 % | none |
| sort-arrow | 12×16 | 12×16 | 0.00 % | none |
| group-header | 102×22 | 103×22 | 4.24 % | none |
| group-chip | 71×22 | 71×22 | 1.66 % | none |
| group-row | 754×40 | 742×32 | — | `width`: 754px → 742px<br>`height`: 40px → 32px |
