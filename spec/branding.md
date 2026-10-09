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

## 5. Palette (from a third-party summary, NOT yet verified against an official Anthropic source)

| Token | Hex | Intended use |
| --- | --- | --- |
| dark | #141413 | primary text (light theme), dark theme background |
| light | #faf9f5 | light theme background, text on dark |
| mid-gray | #b0aea5 | secondary elements, borders |
| light-gray | #e8e6dc | subtle backgrounds, row striping |
| accent-orange | #d97757 | primary accent, focus, selection |
| accent-blue | #6a9bcc | secondary accent (links, info) |
| accent-green | #788c5d | success and tertiary accent |

Open item: confirm these values against an official Anthropic source before release. Until confirmed, label them "unverified" in the plugin docs.

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
