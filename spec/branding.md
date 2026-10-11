# Tablify — UI Branding Plan (plan only)

Status: decisions recorded from owner answers on 2026-10-09. No code written.

## 1. Repository

- Repo: https://github.com/258044aamm-Dev/Tablify (currently empty).
- Linked in Linear on SAD-64 as an attachment.
- Access token: NOT stored in Linear, this file, the repo, or any `.tablify` file.
  The owner shared a token in chat. Treat it as exposed: revoke it and issue a new fine-grained token limited to this repo.
  Store the new token in a password manager or as a CI secret. Never commit it.

## 2. Branding scope (owner decision)

- Use an Anthropic-inspired palette and typography.
- Do NOT use the Anthropic name, logo, or wording in the plugin UI, store listing, or docs. This avoids implying endorsement.
- Owner should confirm with Anthropic if the scope changes.

## 3. Theme behavior (owner decision)

- The plugin ships its own light and dark Anthropic-style themes for the table UI.
- These apply regardless of the user's Obsidian theme.
- Impact: the plugin must not rely only on Obsidian CSS variables for table colors. Design tokens (see below) must be defined in the plugin and must meet contrast requirements in both modes.
- Phase impact: P3 (grid UI). Add a verification step for contrast in light and dark modes, and for mobile.

## 4. Fonts (owner decision)

- Bundle Poppins (headings) and Lora (body) with the plugin.
- Both are open-source (SIL Open Font License). Include the license file in the release.
- Verify the OFL terms before release (step to add to P6-06 license check).
- Impact: plugin size grows. Record the size in the P6 release evidence.
- **SAD-71 Step 5 (owner D-2, 2026-10-10):** add **JetBrains Mono** (SIL OFL, latin-400
  subset, `assets/fonts/JetBrainsMono-Regular.woff2`) for type badges, the row-count badge
  and mono chips — the prototype's mono voice. Poppins/Lora stay for headings/body; the
  prototype's Inter and DM Serif Display were considered and **declined** (this decision
  stands), so the Poppins-vs-Inter divergence is intentional and accepted.

## 5. Palette (prototype ladder — owner-approved 2026-10-10, SAD-71 D-6)

Superseded on 2026-10-10: the values now follow the design source
`Prototype/Anthropic Table Workspace.html` (its `tailwind.config` colour block), which the
owner confirmed as the target in [SAD-71](https://linear.app/sad-mod/issue/SAD-71). The
previous third-party summary (dark #141413 / light #faf9f5 / mid-gray #b0aea5 /
light-gray #e8e6dc) and the SAD-69 stopgaps (dark-surface #2a2926 / dark-header #33322d)
are **retired**; `src/ui/theme/tokens.ts` and `tests/ui/theme.test.ts` carry the live values.

| Token | Light | Dark | Intended use |
| --- | --- | --- | --- |
| bg | #FAF7F2 | #181715 | view background behind the card |
| bg-card | #FFFFFF | #22201D | workspace card, toolbar buttons, popovers |
| bg-inner | #F4EFE6 | #1B1A17 | grid shell (inner container) |
| bg-capsule | #FFFFFF | #262420 | cell + header capsules, option pills |
| border-subtle | #E6E0D5 | #38342E | all chrome borders (dividers, not identifiers) |
| bg-pill | #FFFFFF | #24221E | toolbar pill buttons, search input, float panels (prototype `.pill-btn`; SAD-76) |
| bg-pill-hover | #F6F2EA | #2D2A25 | pill hover surface |
| border-pill-hover | #D3CAB9 | #4A453E | pill hover border |
| border-capsule | #E6E0D5 | #3A3630 | header + cell capsule border (prototype `.header-capsule`) |
| text-title | #1E1B18 | #FAF7F2 | table title in the title row (prototype `#editableTableTitle`; SAD-77) |
| text-strong | #1E1B18 | #FFFFFF | title-link hover ink (prototype `hover:text-white`) |
| text | #1E1B18 | #ECE7E1 | body text |
| text-muted | #6E655C | #9CA3AF | 11px labels, row count, badges |
| accent | #CC785C | #d97757 | focus, selection, active pills, CTA |
| on-accent | #1E1B18 | #181715 | ink on accent (AA-checked; prototype's white is 2.83:1) |
| accent-blue | #6a9bcc | #6a9bcc | secondary accent (links, info) |
| accent-green | #788c5d | #788c5d | success and tertiary accent |

### 5.1 Deviations from the prototype, recorded

- **Muted clay, light:** prototype clay #8C827A measures 3.55:1 on #FAF7F2 — below AA for the
  11px labels that carry it. Ships as #6E655C (5.34:1). Dark keeps the prototype's gray-400.
- **On-accent ink:** prototype paints active tabs white on terracotta (2.83:1). Ships dark
  ink instead (5.23:1 light / 5.74:1 dark).
- **Subtle borders:** 1.25:1 (light) / 1.45:1 (dark) against their background — below WCAG
  1.4.11's 3:1 when a border is the *sole* identifier of a control. By design the surface
  step + shadow carry the boundary; focus/selection (3.07:1 / 5.74:1) carry the 3:1 duty.
  Same treatment as the pre-ladder focus-ring note in `docs/evidence/P3-11.md`.

### 5.2 History (kept for the audit trail)

- v1.0.0–v1.0.1 used the third-party summary above; its mid-gray `#b0aea5` as dark subtle/
  stripe surface put body text at 2.11:1 (SAD-69 D), fixed then by dark-surface/dark-header.
- The ladder retires both stopgaps; contrast pairs are asserted in `tests/ui/contrast.test.ts`
  and `scripts/check-contrast.mjs` (required pairs gate the script).

Open item: confirm the ladder against an official Anthropic source before release (G-B1).
Until confirmed, label it "unverified" in the plugin docs.

Accessibility rule: every text/background pair must meet WCAG 2.1 AA (4.5:1 for body text). Check the orange and green accents as text on light backgrounds before use; use them for non-text elements if they fail.

## 6. Roadmap impact

Added to Linear under phase 3 (SAD-10), label MVP:
- SAD-65 P3-09 Design tokens and light/dark themes (blocks SAD-66 and SAD-28)
- SAD-66 P3-10 Bundle and load fonts (blocks SAD-67)
- SAD-67 P3-11 Contrast and visual verification (blocked by SAD-28 and SAD-66)

- New design-token step (P3, before P3-01 grid UI): define the token file with the palette above, light and dark themes, and font loading.
- Verification: contrast check in both themes (automated check), visual check on desktop and mobile, and evidence under docs/evidence/.
- Data format is unaffected. Themes are a plugin setting, not stored in `.tablify` files.

## 7. Open questions

- Confirm the palette values against an official Anthropic source.
- Confirm that the Obsidian plugin may include the fonts (OFL check) before release.
