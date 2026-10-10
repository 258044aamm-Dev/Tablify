# SAD-75: Step 0, visual-parity harness

- **Linear:** SAD-75 (project "Tablify — Prototype Visual Fidelity + New-Table Defaults")
- **Date:** 2026-10-10
- **Environment:** Linux sandbox, Node 20.20.2, Playwright 1.64.0 headless Chromium (chrome-headless-shell 1248), deviceScaleFactor 1
- **Base commit:** `a3b4952`

## What was added

| File | Purpose |
|---|---|
| `tests/visual/harness/entry.ts` | Browser entry. Mounts the real `TableView` (the class Obsidian runs) with a fake `TFile`, inside an Obsidian-like `.workspace-leaf-content > .view-content` DOM. |
| `tests/visual/harness/index.html` | Harness page. |
| `tests/visual/harness/host-obsidian.css` | **Hostile host stylesheet.** It copies the Obsidian form-control rules that reach plugin views (`button:not(.clickable-icon)`, `input[type=…]`, `select`, all at specificity 0,1,1) with a Catppuccin Mocha-style palette, which is the host theme in the owner's screenshot. |
| `tests/visual/lib/harness.ts` | Bundles the entry with esbuild (`obsidian` → `tests/__mocks__/obsidian.ts`), injects `styles.css` **inline** the way Obsidian does (so relative `url()`s resolve against the page), and opens the prototype seeded with the same table through its `localStorage` store. Prototype-only chrome (brand header, vault sidebar, footer, Tables tabs row) is hidden and the 1152 px cap removed (owner decisions S-1, S-7). |
| `tests/visual/lib/regions.ts` | Region map: plugin selector(s) ↔ prototype selector(s), plus the computed properties to compare. |
| `tests/visual/capture-compare.ts` | CLI (`npm run visual:compare -- …`). For each theme × viewport × fixture × state it writes full-page screenshots, per-region crops and diffs, and `report.md` / `report.json`. |

The fixtures are `new` (the current `newTableText()` output with IDs and timestamps made deterministic), `empty` (`samples/v1/empty.tablify`) and `populated` (`samples/v2/customers.tablify`). The viewports are `owner` (1568×795, the CSS size of the owner screenshot), `desktop` (1400×900) and `mobile` (390×844).

Generated output (`tests/visual/harness/.out/`, `docs/evidence/visual-parity/latest/`) is git-ignored and excluded from ESLint.

## Baseline at `a3b4952`

Command:

```
npx tsx tests/visual/capture-compare.ts --theme dark --viewport owner --fixture new,empty --state default,options
```

Report and screenshots: [`visual-parity/baseline-a3b4952/`](visual-parity/baseline-a3b4952/report.md).

The harness reproduces every defect in the owner screenshot:

| Defect (plan RC) | Harness evidence |
|---|---|
| RC-A: fonts never load | plugin crops render in the serif fallback; prototype renders Lora / Poppins / JetBrains Mono |
| RC-B: host buttons win | `btn-add-row` computes `rgb(49,50,68)` fill, `rgb(137,180,250)` text, weight 600 (prototype `rgb(36,34,30)`, `rgb(236,231,225)`, 500); pixel mismatch 81.47 % |
| RC-C: search icon overlaps the text | `search` `padding-left` computes 16px (prototype 40px) |
| RC-D: header double ring | `header-capsule` border 3px transparent + inset ring (prototype 1px `rgb(58,54,48)`) |
| RC-E: geometry | `toolbar-row` / pills 30px tall (prototype 38px); `grid-shell` 564px tall for an empty table (prototype 137px) |

## Checks

`npm run lint` gives 0 errors and 119 warnings, the same as base. No `src/` file changed, so unit tests, guard, docs and build are unaffected; the full `npm run check` was run before this commit (see SAD-75 comment).
