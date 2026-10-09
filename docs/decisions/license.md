# Decision D-O3 — Plugin license

**Step:** P6-06 (Linear SAD-49)
**Date:** 2026-10-09
**Status:** DECIDED (owner answer, 2026-10-09)
**Decider:** MD Limon Islam (owner), confirming the roadmap default

---

## 1. Decision

**Tablify 1.0.0 is released under the MIT License.**

- `LICENSE` contains the full MIT text, copyright `2026 MD Limon Islam`.
- `package.json` declares `"license": "MIT"` (consistent since P0).
- The bundled fonts (Poppins, Lora) remain under the SIL Open Font License — see `LICENSE-FONTS` (font license is separate from the code license and is included in the build, per P3-10).

## 2. Context

D-O3 was listed open in `spec/roadmap.md` §3.3 with the default "MIT, to match the reference's license model", needed before release (P6-06). The owner confirmed MIT on 2026-10-09 during P6 planning.

## 3. Consequences

- The GitHub release and the future community-plugin submission list MIT.
- `README.md` links `LICENSE` (verified by `scripts/check-docs-links.mjs`).
- Deviation note: `LICENSE` was created in the P6-05 commit (instead of P6-06) so the documentation link check passes at every commit; this step confirms its presence as the spec action requires.
