# Tablify specification

This directory is the authoritative specification for Tablify. Linear issues are the tracker. They link here, and the text here wins if they disagree.

**Status:** planning only. No code exists yet. The GitHub repo (`258044aamm-Dev/Tablify`) is empty.

**Intended location:** `spec/` at the root of the plugin repo. Copy this directory into the repo unchanged. Linear descriptions will link to the files once the repo exists.

## Reading order

1. `glossary.md`: terms and IDs.
2. `roadmap.md`: summary, decisions (§3), phases and dependencies (§4–§6), the file format contract (§7), risks (§8), the release definition of done (§9), and the MVP acceptance scenarios A1–A11 (§10).
3. `features.md`: what the plugin does, feature by feature (§1 and §2).
4. `guidelines.md`: the global rules (§0), assumptions (§1), and the phase rules.
5. `phases/P0.md` to `phases/P8.md`: objectives and gate per phase.
6. `steps/P*.md`: one file per step. Each one lists its objective, prerequisites, actions, dependencies, outputs, verification, performance, and acceptance criteria.
7. `branding.md`: colors, fonts, and theme decisions for the UI.

## Files

| Path | Contents | Source |
|------|----------|--------|
| `glossary.md` | Terms, test codes, fixtures, decision IDs | Written for this spec |
| `roadmap.md` | Plan and decisions | Copied from `ROADMAP.md` |
| `features.md` | Feature documentation | Copied from `FEATURES.md` |
| `guidelines.md` | Global rules, step definitions, phase gates | Copied from `IMPLEMENTATION_GUIDELINES.md` |
| `branding.md` | UI branding plan | Copied from `BRANDING.md` |
| `phases/P0.md` to `P8.md` | One file per phase, with its gate and step list | Split from `guidelines.md` |
| `steps/P0-01.md` to `P8-04.md` | One file per step | Split from `guidelines.md`. P3-09 to P3-11 written for this spec |

## Steps

Scope: MVP = release 1.0, v1.1 = release 1.1, v2 = release 2.0.

| Step | Title | Scope | Linear |
|---|---|---|---|
| [P0-01](steps/P0-01.md) | P0-01 — Scaffold the plugin | MVP | SAD-15 |
| [P0-02](steps/P0-02.md) | P0-02 — Tooling | MVP | SAD-16 |
| [P0-03](steps/P0-03.md) | P0-03 — Format spec v1 | MVP | SAD-17 |
| [P0-04](steps/P0-04.md) | P0-04 — Extension guard | MVP | SAD-18 |
| [P1-01](steps/P1-01.md) | P1-01 — Field type registry | MVP | SAD-19 |
| [P1-02](steps/P1-02.md) | P1-02 — Row store | MVP | SAD-20 |
| [P1-03](steps/P1-03.md) | P1-03 — Serializer and parser | MVP | SAD-21 |
| [P1-04](steps/P1-04.md) | P1-04 — Validation engine | MVP | SAD-22 |
| [P1-05](steps/P1-05.md) | P1-05 — Undo and redo | MVP | SAD-23 |
| [P1-06](steps/P1-06.md) | P1-06 — Select options | MVP | SAD-24 |
| [P2-01](steps/P2-01.md) | P2-01 — Query parser | MVP | SAD-25 |
| [P2-02](steps/P2-02.md) | P2-02 — Filter engine | MVP | SAD-26 |
| [P2-03](steps/P2-03.md) | P2-03 — View state | MVP | SAD-27 |
| [P3-01](steps/P3-01.md) | P3-01 — Grid shell with virtual rows | MVP | SAD-28 |
| [P3-02](steps/P3-02.md) | P3-02 — Cell editors | MVP | SAD-29 |
| [P3-03](steps/P3-03.md) | P3-03 — Select dropdown and option manager | MVP | SAD-30 |
| [P3-04](steps/P3-04.md) | P3-04 — Attachment cell | MVP | SAD-31 |
| [P3-05](steps/P3-05.md) | P3-05 — Validation display | MVP | SAD-32 |
| [P3-06](steps/P3-06.md) | P3-06 — Keyboard navigation and shortcuts | MVP | SAD-33 |
| [P3-07](steps/P3-07.md) | P3-07 — Column and row layout | MVP | SAD-34 |
| [P3-08](steps/P3-08.md) | P3-08 — Filter bar | MVP | SAD-35 |
| [P3-09](steps/P3-09.md) | P3-09 — Design tokens and light/dark themes | MVP | SAD-65 |
| [P3-10](steps/P3-10.md) | P3-10 — Bundle and load fonts (Poppins, Lora) | MVP | SAD-66 |
| [P3-11](steps/P3-11.md) | P3-11 — Contrast and visual verification (desktop and mobile) | MVP | SAD-67 |
| [P4-01](steps/P4-01.md) | P4-01 — CSV parser | MVP | SAD-36 |
| [P4-02](steps/P4-02.md) | P4-02 — XLSX spike and library decision | MVP | SAD-37 |
| [P4-03](steps/P4-03.md) | P4-03 — Type inference | MVP | SAD-38 |
| [P4-04](steps/P4-04.md) | P4-04 — Import command | MVP | SAD-39 |
| [P4-05](steps/P4-05.md) | P4-05 — Export | MVP | SAD-40 |
| [P5-01](steps/P5-01.md) | P5-01 — File explorer menu | MVP | SAD-41 |
| [P5-02](steps/P5-02.md) | P5-02 — Table context menu | MVP | SAD-42 |
| [P5-03](steps/P5-03.md) | P5-03 — Long-press on mobile | MVP | SAD-43 |
| [P6-01](steps/P6-01.md) | P6-01 — Test matrix | MVP | SAD-44 |
| [P6-02](steps/P6-02.md) | P6-02 — Performance verification | MVP | SAD-45 |
| [P6-03](steps/P6-03.md) | P6-03 — Accessibility | MVP | SAD-46 |
| [P6-04](steps/P6-04.md) | P6-04 — Community plugin review checklist | MVP | SAD-47 |
| [P6-05](steps/P6-05.md) | P6-05 — Documentation | MVP | SAD-48 |
| [P6-06](steps/P6-06.md) | P6-06 — Release | MVP | SAD-49 |
| [P7-01](steps/P7-01.md) | P7-01 — Embed code block | v1.1 | SAD-50 |
| [P7-02](steps/P7-02.md) | P7-02 — Airtable client | v1.1 | SAD-51 |
| [P7-03](steps/P7-03.md) | P7-03 — Token storage | v1.1 | SAD-52 |
| [P7-04](steps/P7-04.md) | P7-04 — Sync metadata in the file | v1.1 | SAD-53 |
| [P7-05](steps/P7-05.md) | P7-05 — Field type mapping | v1.1 | SAD-54 |
| [P7-06](steps/P7-06.md) | P7-06 — Pull | v1.1 | SAD-55 |
| [P7-07](steps/P7-07.md) | P7-07 — Push | v1.1 | SAD-56 |
| [P7-08](steps/P7-08.md) | P7-08 — Conflict detection | v1.1 | SAD-57 |
| [P7-09](steps/P7-09.md) | P7-09 — Auto-create Airtable fields | v1.1 | SAD-58 |
| [P7-10](steps/P7-10.md) | P7-10 — Sync UI | v1.1 | SAD-59 |
| [P8-01](steps/P8-01.md) | P8-01 — Formula specification | v2 | SAD-60 |
| [P8-02](steps/P8-02.md) | P8-02 — Formula engine | v2 | SAD-61 |
| [P8-03](steps/P8-03.md) | P8-03 — Formula field UI | v2 | SAD-62 |
| [P8-04](steps/P8-04.md) | P8-04 — Linked records | v2 | SAD-63 |

## Open decisions

These must be answered, or the default used, before the step named. Defaults come from `roadmap.md` §3.3 and the Linear overview SAD-64.

| ID | Question | Needed by | Default |
|----|----------|-----------|---------|
| D-O1 | Formula level | P8-01 | Simple operators plus SUM, IF, CONCAT, date diff |
| D-O2 | XLSX library | P4-02 | Spike decides |
| D-O3 | License | P6-06 | MIT |
| D-O4 | Minimum Obsidian version | P0-01 | Lowest version that supports the APIs used |
| D-O5 | Export scope default | P4-05 | Current view |
| G-P1 | Confirm the proposed performance targets | P6-02 | Stay labeled proposed |
| G-B1 | Confirm the palette against an official Anthropic source | P3-11 | Label the palette unverified in the docs |
| Priority | Linear priority field vs. MVP / v1.1 / v2 labels | Before the Linear cleanup | Not decided |

## Not written yet

- `FORMAT_SPEC.md`, the `.tablify` format spec. It is a deliverable of P0-03 and must be written then. Until then, `roadmap.md` §7 is the summary contract.
- The repo `docs/` folder with evidence, gate notes, and decision records. Steps create these as they run.
- Code. Nothing in this directory is implemented.

## Changing the spec

Change the spec files first, then update the matching Linear issue. Do not change only Linear.
