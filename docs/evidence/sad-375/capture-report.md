# SAD-375 — fade capture report (real plugin, visual harness)

Captured from the bundled plugin harness (`tests/visual/harness`) at 390×844 (phone) and 1568×795
(owner/desktop). Computed opacities are read from the live `::before` / `::after` overlays; the
run fails if any state disagrees with the class-gated contract, if a phone overlay generates no
box, or if a desktop overlay generates one. Context uses `reducedMotion: 'reduce'`, so states are
exact with no transition in flight.

| Theme | State | scrollLeft / overflow | fade classes on the wrapper | ::before | ::after | ::before / ::after content |
|---|---|---|---|---|---|---|
| light | at-rest | 0 / 453 | `tablify__toolbar-actions-wrap is-fade-end` | 0 | 1 | "" / "" |
| light | mid-scroll | 227 / 453 | `tablify__toolbar-actions-wrap is-fade-end is-fade-start` | 1 | 1 | "" / "" |
| light | at-end | 453 / 453 | `tablify__toolbar-actions-wrap is-fade-start` | 1 | 0 | "" / "" |
| dark | at-rest | 0 / 453 | `tablify__toolbar-actions-wrap is-fade-end` | 0 | 1 | "" / "" |
| dark | mid-scroll | 227 / 453 | `tablify__toolbar-actions-wrap is-fade-end is-fade-start` | 1 | 1 | "" / "" |
| dark | at-end | 453 / 453 | `tablify__toolbar-actions-wrap is-fade-start` | 1 | 0 | "" / "" |
| light | desktop control | — | `tablify__toolbar-actions-wrap` | n/a | n/a | none / none |
| dark | desktop control | — | `tablify__toolbar-actions-wrap` | n/a | n/a | none / none |

Expected per state: at-rest `0 / 1` (right fade only), mid-scroll `1 / 1`, at-end `1 / 0`
(left fade only); phone overlays generate a box (`"" / ""`). Desktop control: no `is-fade`
classes and `none / none` content — the opacities of a nonexistent pseudo are initial values
and carry no meaning; the content check is the proof that nothing paints.

Deviation note: the visual-parity harness compares `toolbar-row` against the prototype
(`tests/visual/lib/regions.ts`), which has no fade — the prototype is desktop-oriented and the
phone scroll row itself is already a plugin-only layout (SAD-308). The fade is the SAD-375
owner-sanctioned improvement beyond the prototype, same class of deviation as SAD-308.

Manual device runbook (T-M-DEV) remains NOT RUN — no iOS/Android device in this environment.
