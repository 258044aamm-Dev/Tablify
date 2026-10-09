# Glossary

Terms used across the spec. Read this before any step.

## Product

| Term | Meaning |
|------|---------|
| Tablify | The Obsidian plugin this spec describes. |
| `.tablify` | The only file type the plugin reads and writes. A JSON text file with `formatVersion: 1`. |
| `.tabula` | Files from the reference plugin (airtable-tabula). Tablify never reads, writes, imports, detects, or migrates them. |
| Table | One `.tablify` file: fields, rows, and view settings. |
| Field | A column. Each field has a stable ID and a type. |
| Row | A record. Each row has a stable ID (`row_` prefix), a revision number `rev`, and timestamps. |
| View | Saved settings for one table: sort, group, hidden fields, column order and widths, frozen columns, row height. |
| Query | Filter text, for example `status:todo`. Grammar in `spec/features.md` §2.6. |
| Embed | A note code block (fence language `tablify`) that shows a table. v1.1. |
| Airtable sync | Optional pull and push with an Airtable base. v1.1. |
| Formula field | A computed field. v2. |
| Linked record | A link from one table to a row in another. v2. |

## Releases

| Label | Meaning |
|-------|---------|
| MVP / 1.0 | Features 1–10 and 14–17 in `spec/features.md`. Phases 0–6 plus the phase 3 UI steps. |
| v1.1 | Features 18–21: embed, Airtable sync, conflict detection, auto-create fields. Phase 7. |
| v2 | Features 11–12: formulas and linked records. Phase 8. |

## Decisions and open items

| ID | Meaning |
|----|---------|
| D1–D7 | Locked decisions. Listed in `spec/roadmap.md` §3.1. |
| R-D8–R-D14 | Recommended decisions. Listed in `spec/roadmap.md` §3.2. |
| D-O1–D-O5 | Open decisions. Listed in `spec/roadmap.md` §3.3 and `spec/README.md`. |
| G-P1 | Owner must confirm the proposed performance targets. |
| G-B1 | Owner must confirm the palette against an official Anthropic source. |
| G-A1–G-A6, G-L1–G-L2 | Global assumptions and limitations. Listed in `spec/guidelines.md` §1. |

## Testing

| Code | Meaning |
|------|---------|
| T-U | Unit test. One function or module. |
| T-M | Model-based test. Real code checked against a simple reference model. |
| T-D | Differential test. Our code checked against an independent implementation. |
| T-F | Fuzz test. Malformed input must not crash or corrupt data. Run at least 10,000 cases. |
| T-I | Integration test in a real Obsidian vault. |
| T-E | End-to-end UI test. A user flow from the UI to the file on disk. |
| T-P | Performance test. A measured value against a PERF target. |
| T-S | Security or privacy check. Secrets and forbidden references. |
| T-M-DEV | Manual test on a real device, with a recorded result. |
| NOT RUN | A check that could not be run. It must state the reason, and it blocks the phase gate until the owner accepts the risk. |

Full definitions: `spec/guidelines.md` §0.2.

## Fixtures

| Fixture | Size | Use |
|---------|------|-----|
| FX-S | 100 rows, 8 columns (all types) | Unit and integration tests |
| FX-M | 1,000 rows, 12 columns (all types) | Target scale, performance, regression |
| FX-L | 10,000 rows, 12 columns | Stress only. Not a release target |
| FX-CSV-RFC | — | RFC 4180 examples and edge cases |
| FX-XLSX | 5,000 rows, 10 columns | Dates, merged cells, cached formulas, multiple sheets |
| FX-TABULA | — | Dummy `.tabula` files. Used only to show they are ignored |

Full definitions: `spec/guidelines.md` §0.3.

## Performance and quality

| Term | Meaning |
|------|---------|
| PERF-1 to PERF-8 | Performance targets. Listed in `spec/guidelines.md` §0.7. PERF-5 comes from the roadmap. The rest are proposed. |
| p95 | 95th percentile of 10 measured runs. A target is met only if p95 is within the limit. |
| S1 | Data loss, corruption, or secret leak. Stop and fix first. |
| S2 | Crash, wrong result, or blocked MVP scenario. Must be fixed before the step is accepted. |
| S3 | Functional defect with a workaround. Fix before the phase gate, or defer with owner sign-off. |
| S4 | Cosmetic or minor. Backlog. |
| Evidence | Recorded proof for a step: commit, environment, commands, results, logs. Stored under `docs/evidence/`. |
| Phase gate | Conditions to finish a phase. Listed in `spec/guidelines.md` §0.6 and each `spec/phases/P*.md`. |

## Acceptance scenarios

A1–A11 are the MVP acceptance scenarios in `spec/roadmap.md` §10. A9 is the `.tabula`-is-ignored check.
