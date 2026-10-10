# Changelog

All notable changes to the Tablify repository are documented here.

## 2026-10-10 — Prototype feature parity (SAD-72)

`Prototype/Anthropic Table Workspace.html` upgraded from a visual sketch
(~4 of 20 features) to a functional demonstration of **all 20 included
features** of `spec/features.md`, per
`docs/plans/prototype-feature-parity-plan.md`. Single self-contained HTML
file (D-O4); Tailwind CDN + Font Awesome CDN (D-O2); fonts Poppins / Lora /
JetBrains Mono; Feature 13 (Kanban/Calendar/Gallery) intentionally absent.

### Batches / commits

| Commit | Steps | Delivered |
|---|---|---|
| `bac6e85` | PR-00 | Rename to Tablify, neutral sample data, fonts, Ask-Claude modal removed, extension markers |
| `490771d` | PR-01…03 | `.tablify` document model (formatVersion 1, stable ids, views, localStorage persistence), 19-type field registry, selects + option manager, attachments panel, system fields, Source modal |
| `968fe05` | PR-04…05 | Full grid view (sticky/frozen, resize, drag-reorder, row heights, group-by) + complete §2.6 query grammar (field:value, `~ ! > <`, comma-OR, CSV-style quoting, `empty`) |
| `16a3669` | PR-06…07 | Undo/redo history, full keyboard navigation + range copy/paste (TSV), validation rules (required/unique/min/max/regex) with invalid-cell highlighting |
| `0608d13` | PR-08…09 | CSV import (real parser + type inference + override UI; XLSX simulated per D-O3), export dialog (CSV/Markdown real, XLSX simulated), cell/row/header context menus, vault sidebar with file/folder context menus |
| `d0f6166` | PR-10…11 + F11/F12 | Note-embed view (live grid inside simulated Obsidian note), formula engine (operators, {Field} refs, SUM/IF/CONCAT/DATEDIFF/ROUND/MIN/MAX/ABS, #ERR + circular guard, live preview), linked records (stable row IDs, picker, peek), simulated Airtable sync suite: link/unlink, pull/push with per-row revisions, conflict dialog (keep local/remote/both), confirm-gated auto-create of missing fields |
| *(this commit)* | PR-12 | In-app feature traceability checklist F01–F21 (header **Checklist** button), plan-doc evidence update, this changelog |

### Verification

- Headless smoke suites run per batch against the extracted `<script>`
  (Node, DOM stubs): query grammar, sorting/grouping, undo chains,
  range clipboard, validation, CSV parse/inference, import/export,
  row/table ops, formula evaluation (incl. DATEDIFF/CONCAT/IF/#ERR/circular),
  linked-record toggle + peek, full sync pull→conflict→resolve→auto-create→push,
  checklist render — 41 assertions green on the final file.
- No real tokens anywhere in the prototype (masked `pat_demo…` only,
  settings-only per §2.19); no `.tabula` references; Feature 13 absent.
- All pre-existing prototype behaviors preserved (tabs, search, add
  row/field, select + bulk delete, CSV export, copy Markdown, theme
  toggle, saved indicator, row count, toast, editable title).
