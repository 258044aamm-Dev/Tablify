# SAD-375 — Mobile toolbar swipe discoverability: implementation plan

**Issue:** [SAD-375](https://linear.app/sad-mod/issue/SAD-375/the-mobile-toolbar-supports-horizontal-swiping) (Improvement, P2)
**Status:** delivered; **In Review** (implementation: steps 1–4 below, evidence in [`docs/evidence/SAD-375.md`](../evidence/SAD-375.md))
**Baseline:** `325faf8` — `npm test` = **140 files / 2232 tests, all passing** (measured 2026-10-20, sandbox)

---

## 1. The issue

> "The mobile toolbar supports horizontal swiping, but the current UI does not make this
> interaction obvious to new users. Improve the discoverability of the swipe gesture by adding a
> subtle visual cue, such as a partially visible next toolbar item, a gradient fade at the edge, or
> another appropriate indicator consistent with the existing design system. Keep the interface clean
> and uncluttered, preserve the current toolbar functionality, and ensure the solution works well on
> mobile devices."

Constraints carried from the owner on top of the issue text:

1. **The new modification must not influence other existing features and functionalities.**
2. **No unnecessary code** — if existing code fulfills the requirement, extend it minimally; substantial
   code only where genuinely needed.
3. **No guessing** — every step below cites the code it touches.

### Owner decisions (recorded from this planning session)

| Decision | Choice | Consequence |
|---|---|---|
| Cue type | **Gradient fade at the scroll edge(s)** | Purely additive; SAD-308's 3-tools-at-a-time sizing and its tests stay untouched |
| Fade state | **Dynamic (scroll-aware)** | Small state sync in `Toolbar` (same pattern as `syncPlaceholder`); fades hide at the scroll ends and when everything fits |
| Scope | **Mobile only, `max-width: 639px`** | Desktop stays pixel-identical; the rules live inside the existing SAD-308 phone block |

Rejected alternatives, for the record:

- **Partially visible next item (peek)** — would require shrinking the mobile buttons below
  `calc((100% - 16px) / 3)`, deliberately revising SAD-308's "3 tools at a time" acceptance and the
  regression tests in `tests/ui/toolbarMobile.test.ts` that pin that sizing. Violates constraint 1.
- **Static fade (pure CSS)** — still painted at the scroll end where nothing remains off-screen; a
  misleading affordance.
- **COD-72-style edge shadow alone** — a valid design-language reuse, but the issue lists the
  gradient fade explicitly and the fade is the clearer "content continues" signal; the two are not
  combined (keep it clean).

---

## 2. What already exists (measured, not assumed)

The swipe **already works** — this ticket is purely about discoverability.

| Fact | Where |
|---|---|
| The tool row is a native horizontal scroller: `overflow-x: auto`, `scrollbar-width: none`, `::-webkit-scrollbar { display: none }` | `styles.css:275–291` (`.tablify__toolbar-actions`) |
| On phones (≤ 639 px) the search box takes its own row and the tool row shows **exactly 3 tools at a time**, sized `flex: 0 0 calc((100% - 16px) / 3)`, with `scroll-behavior: smooth` and `-webkit-overflow-scrolling: touch` | `styles.css:393–424` (`@media (max-width: 639px)`, SAD-308) |
| Touch swiping is native `overflow-x` scrolling — no JS gesture code exists or is needed | same |
| Button order (SAD-308): ↶ · ↷ · Add Field · Add Row · Filter · Sync · Options (7 buttons) | `src/views/grid/toolbar.ts:218–232` |
| The phone breakpoint is 639 px on both sides (CSS and TS) | `styles.css` media block; `MOBILE_PANE_MAX_WIDTH = 639` at `src/model/view.ts:44` |
| The tool row's DOM: `root.tablify__toolbar > topRow.tablify__toolbar-row > [searchWrap.tablify__search, actions.tablify__toolbar-actions > 7 buttons]` | `src/views/grid/toolbar.ts:199–235` |
| At phone width, 3 buttons + 2 × 8 px gaps fill the row **exactly** (3 × (100% − 16px)/3 + 16px = 100%), so the 4th tool is exactly at the edge and nothing peeks | arithmetic on the SAD-308 sizing |
| The surface behind the toolbar is the card: `.tablify__card { background: var(--tablify-bg-card) }` (white light / `#22201D` dark) | `styles.css:1025–1045` (background at `1035`) |
| Design-token system: every colour in `styles.css` must be a `var(--tablify-*)` token — hex literals are rejected | `tests/ui/theme.test.ts:80–110` |
| Existing "content continues past this edge" language: COD-72 frozen-column soft edge (`--tablify-frozen-edge-shadow`) | `styles.css:226–235`, `2398–2410` |
| Reduce-motion convention for transitions | `styles.css:3689`, `4975` (`@media (prefers-reduced-motion: reduce)`) |
| There is no RTL/`dir` handling anywhere in `src/` or `styles.css` | repo-wide grep |
| The visual harness captures a 390 × 844 mobile viewport and pixel-compares `toolbar-row` against the prototype | `tests/visual/capture-states.ts:242`, `tests/visual/lib/regions.ts:25` |

### Existing tests that pin the current behaviour (must stay green **unmodified**)

| File | What it pins |
|---|---|
| `tests/ui/toolbarMobile.test.ts` | SAD-308 phone block: 1/3-width buttons, `scroll-behavior: smooth`, Sync/Options label hiding, desktop layout preservation, SAD-308 button order, SAD-306 ellipsis |
| `tests/views/toolbar.test.ts` | Button order (`'.tablify__toolbar-actions > button'`), labels, glyphs, placeholder swap at 639 px, debounce, Options panel |
| `tests/views/toolbarParity.test.ts` | Options popover card styling; prototype component language |
| `tests/ui/theme.test.ts` | No hex literals outside `src/ui/theme/tokens.ts` |
| `tests/ui/noPrototypeAnnotations.test.ts` | No "Feature N", "simulated", "UI-only", "spec §" in `src/` strings |

**Important test-mechanics caveat:** `tests/ui/toolbarMobile.test.ts`'s `bodies(block, '.tablify__toolbar-actions')`
helper regex-matches selectors by *substring*, so any new rule whose selector contains
`.tablify__toolbar-actions…` (e.g. a wrapper class `.tablify__toolbar-actions-wrap`) is included in
those joins. Every assertion in that file is a positive `toContain` on declarations that remain on
the scroller rule (verified one by one in §7), so the file stays green without edits — but the new
tests in §5 must use exact-selector matching so they cannot pass "by accident" through the wrapper.

---

## 3. Design

### 3.1 The cue

Two soft, card-coloured gradient fades pinned over the tool row's scroll edges:

- **Right fade (`::after`)** — visible while more tools remain off-screen ("there is more this way").
  It paints over the right end of the last visible tool pill; at rest that is the tail of the 3rd
  tool plus the row edge. This is the standard, uncluttered "content continues" affordance.
- **Left fade (`::before`)** — visible once the row is scrolled (`scrollLeft > 0`), so tools sliding
  under the left edge are faded rather than hard-cut.

Both are `opacity: 0 → 1` class-toggled by scroll state, `pointer-events: none`, mobile-only.

### 3.2 Why a wrapper element is architecturally required

1. **A fade must paint *above* the scrolling pills.** A `background-image` on the scroller paints
   *behind* its children (CSS painting order: element background, then descendants), so the opaque
   pill buttons would cover it. An overlay is required.
2. **The overlay cannot live on the scroller itself.** An absolutely positioned pseudo-element on a
   `position: relative` scroll container belongs to the scrollable overflow area — it scrolls away
   with the content. (Same reason the frozen-column background mask is painted on an element outside
   the scrolled block, `styles.css:2385`.)
3. Therefore: wrap the scroller in `div.tablify__toolbar-actions-wrap` (`position: relative`) and
   paint the fades as its `::before` / `::after` (`position: absolute; z-index: 1; pointer-events: none`).
   Absolutely positioned pseudo-elements of the wrapper paint above the in-flow scroller (CSS
   painting order step 8 vs step 4), including above `transform`-stacked buttons during `:active`.
   Zero extra visible DOM; the wrapper is invisible chrome.

### 3.3 Why `transparent` in the gradient is safe here

Fading `var(--tablify-bg-card) → transparent` in a non-premultiplied interpolator would pass through
a gray haze. All engines that support `color-mix()` — already required by this stylesheet
(`styles.css:229`, `236`, `923`, `1501`) — implement premultiplied alpha gradient interpolation
(Chrome 72+, Safari 12.1+, Firefox 60+), so the fade keeps the card hue at every alpha. No extra
stops needed; no colour literals (token + `transparent` only).

### 3.4 Geometry

- Fade band width **24 px**, with a **30 % solid anchor** then a linear falloff:
  `linear-gradient(to right, var(--tablify-bg-card) 30%, transparent)` on the left,
  `to left` mirrored on the right. The solid anchor keeps the fade from dimming tool labels
  (on a 390 px phone the 3rd pill is ~106 px wide with 16 px padding; the gradient reaches
  transparent before its centred label).
- Fades span `top: 0; bottom: 0` of the wrapper. The scroller's ±4 px padding band
  (`padding: 4px 0; margin: -4px 0`, `styles.css:404–405`) exists only so focus rings/shadows are
  not clip-scroll-hidden; pills live in the content box the wrapper wraps. Horizontal shadows there
  are ≤ 1 px (`--tablify-pill-shadow`) and are not covered — acceptable and consistent with the
  "subtle" requirement. If a screenshot review disagrees, extend the pseudos with `top: -4px;
  bottom: -4px` — a one-line tweak, decided at evidence time.

---

## 4. Implementation

Four files change; nothing else. Public API of `Toolbar` is untouched.

### 4.1 `src/views/grid/toolbar.ts` — wrap the row, sync the fades

**(a) Fields** (next to `optionsButton` etc.):

```ts
  /** SAD-375: the tool-row scroller and its fade wrapper. */
  private readonly actions: HTMLElement;
  private readonly actionsWrap: HTMLElement;
```

**(b) Constructor** — replace the bare `actions` local + `topRow.appendChild(actions)` with:

```ts
    // SAD-308 order: ↶ · ↷ · Add Field · Add Row · Filter · Sync · Options.
    this.actions = document.createElement('div');
    this.actions.className = 'tablify__toolbar-actions';
    this.actions.appendChild(this.makeButton(ACTIONS.undo, '', 'Undo', 'undo'));
    // … unchanged button appends …
    this.actions.appendChild(this.optionsButton);

    // SAD-375: fade wrapper — the edge fades must sit on a non-scrolling box (§3.2).
    this.actionsWrap = document.createElement('div');
    this.actionsWrap.className = 'tablify__toolbar-actions-wrap';
    this.actionsWrap.appendChild(this.actions);

    topRow.appendChild(searchWrap);
    topRow.appendChild(this.actionsWrap);
```

(Only the `actions` variable becomes a field; the button lines are byte-identical otherwise.)

**(c) Wiring** — in `wireEvents()` (or beside the existing `resize` registration):

```ts
    this.actions.addEventListener('scroll', this.syncFade, { passive: true });
```

and next to `window.addEventListener('resize', this.syncPlaceholder);` in the constructor:

```ts
    window.addEventListener('resize', this.syncFade);
```

**(d) The sync** (next to `syncPlaceholder`, same style):

```ts
  /**
   * SAD-375: track the tool row's scroll position for the phone edge fades — the right fade
   * shows while tools remain off-screen, the left one once the row is scrolled. The 1px
   * tolerance absorbs subpixel rounding so the fades never flicker at the exact ends.
   */
  private readonly syncFade = (): void => {
    const el = this.actions;
    const overflow = el.scrollWidth - el.clientWidth;
    const scrollable = overflow > 1;
    this.actionsWrap.classList.toggle('is-fade-end', scrollable && el.scrollLeft < overflow - 1);
    this.actionsWrap.classList.toggle('is-fade-start', scrollable && el.scrollLeft > 1);
  };
```

Class semantics: `is-fade-start` = the *start* edge is cut (content precedes the viewport) → left
fade; `is-fade-end` = content follows the viewport → right fade.

**(e) `update()`** — after `this.syncPlaceholder();` add `this.syncFade();` (the constructor ends in
`this.update(options)`, so this covers initial paint; it is 2 reads + 2 idempotent toggles and
matches the "update derived pieces" contract documented at the top of the file).

**(f) `destroy()`** — add the symmetric removals:

```ts
    this.actions.removeEventListener('scroll', this.syncFade);
    window.removeEventListener('resize', this.syncFade);
```

**Not touched:** `syncPlaceholder`/`isMobileWidth`, Options popover logic (`outsideClose` still works —
the wrapper is inside `this.root`), `positionOptions` (anchored to `optionsButton`, unchanged),
debounce, callbacks, `ToolbarState`/`ToolbarCallbacks` interfaces.

### 4.2 `styles.css`

**(a) Base rule** — directly after the `.tablify__toolbar-actions::-webkit-scrollbar` block
(`styles.css:289–291`), keeping the desktop declaration (`flex: 0 1 auto`) byte-identical on the
scroller:

```css
/* SAD-375: non-scrolling wrapper for the tool row's edge fades (the fades must paint above the
   scrolling pills, so they cannot live on the scroller or in its background). Desktop geometry is
   unchanged: the wrapper is a same-sized flex shell. */
.tablify__toolbar-actions-wrap {
  position: relative;
  display: flex;
  flex: 0 1 auto;
  min-width: 0;
  max-width: 100%;
}
```

**(b) Inside the existing `@media (max-width: 639px)` block** (`styles.css:393–424`), after the
`.tablify__toolbar-actions` / button rules — keeping every existing declaration in place:

```css
  .tablify__toolbar-actions-wrap {
    flex: 1 1 100%;
    width: 100%;
  }

  /* SAD-375: swipe discoverability — card-coloured fades over the tool row's scroll edges,
     shown only while more tools lie beyond them (is-fade-start / is-fade-end, set by Toolbar).
     pointer-events: none keeps every pill tappable underneath. */
  .tablify__toolbar-actions-wrap::before,
  .tablify__toolbar-actions-wrap::after {
    content: '';
    position: absolute;
    top: 0;
    bottom: 0;
    width: 24px;
    z-index: 1;
    pointer-events: none;
    opacity: 0;
    transition: opacity 0.15s cubic-bezier(0.4, 0, 0.2, 1);
  }

  .tablify__toolbar-actions-wrap::before {
    left: 0;
    background: linear-gradient(to right, var(--tablify-bg-card) 30%, transparent);
  }

  .tablify__toolbar-actions-wrap::after {
    right: 0;
    background: linear-gradient(to left, var(--tablify-bg-card) 30%, transparent);
  }

  .tablify__toolbar-actions-wrap.is-fade-start::before,
  .tablify__toolbar-actions-wrap.is-fade-end::after {
    opacity: 1;
  }
```

The `cubic-bezier(0.4, 0, 0.2, 1)` matches the toolbar's existing transition curve
(`styles.css:209`, `317`).

**(c) Reduce motion** — in either existing `@media (prefers-reduced-motion: reduce)` block
(`styles.css:3689` or `4975`):

```css
  .tablify__toolbar-actions-wrap::before,
  .tablify__toolbar-actions-wrap::after {
    transition: none;
  }
```

**Placement rationale:** putting (b) inside the *first* 639 px block keeps
`tests/ui/toolbarMobile.test.ts`'s `phoneBlock()` helper (which extracts that first block) covering
the new rules, and keeps `desktopCss`-stripped assertions honest.

### 4.3 New tests

**`tests/ui/toolbarSwipeCue.test.ts`** — CSS-text assertions (house style, same `phoneBlock`/`bodies`
helpers as `tests/ui/toolbarMobile.test.ts`, matched **exactly** by rule selector):

1. The phone block contains the fade pseudo rules on `.tablify__toolbar-actions-wrap`: `content: ''`,
   `pointer-events: none`, `opacity: 0` default, `z-index: 1`.
2. Both gradients use `var(--tablify-bg-card)` and `transparent` only — no colour literals (also
   covered globally by `tests/ui/theme.test.ts`).
3. `.tablify__toolbar-actions-wrap.is-fade-start::before` / `.is-fade-end::after` exist and set
   `opacity: 1`.
4. Desktop CSS (phone block removed) contains **no** `is-fade-start` / `is-fade-end` selectors and no
   wrap fade pseudo rules — the cue cannot leak to desktop.
5. Belt-and-braces non-regression: the SAD-308 declarations are still in place —
   `overflow-x: auto` on the desktop scroller rule, `scroll-behavior: smooth` and
   `flex: 0 0 calc((100% - 16px) / 3)` in the phone block — and the wrapper's base rule exists with
   `position: relative`.
6. `prefers-reduced-motion` disables the fade transition.

**`tests/views/toolbarSwipeCue.test.ts`** — jsdom behaviour (jsdom does no layout, so metrics are
faked the way `tests/views/toolbar.test.ts` fakes `innerWidth`):

```ts
function setScroll(el: HTMLElement, scrollWidth: number, clientWidth: number, scrollLeft: number): void {
  Object.defineProperty(el, 'scrollWidth', { value: scrollWidth, configurable: true });
  Object.defineProperty(el, 'clientWidth', { value: clientWidth, configurable: true });
  el.scrollLeft = scrollLeft;
}
```

1. Construction with overflow (`scrollWidth` 900 / `clientWidth` 330, `scrollLeft` 0): wrapper has
   `is-fade-end`, not `is-fade-start`.
2. After `setScroll(…, 285)` + dispatching `scroll` on the scroller: `is-fade-start` present,
   `is-fade-end` absent (at the end).
3. Mid-scroll (`scrollLeft` 100): both classes present.
4. No overflow (`scrollWidth` = `clientWidth`): neither class.
5. A window `resize` between `update()` calls re-evaluates the classes (change metrics, dispatch
   `resize`, assert) — the same pattern as the SAD-306 placeholder test.
6. Structure: `.tablify__toolbar-actions-wrap > .tablify__toolbar-actions > button[data-action]`
   holds all 7 buttons (the wrap must not break the existing child selector).
7. `destroy()` then dispatching `scroll` on the detached scroller does not throw.

### 4.4 Docs (delivery steps, same as every ticket in this repo)

- `docs/evidence/SAD-375.md` — per `spec/guidelines.md` §0.1: commit hash, date, environment, commands
  run, test counts (before 2232 → after 2232 + N), screenshots (§6), deviations.
- `CHANGELOG.md` → `[Unreleased] → Added` entry naming SAD-375, the cue, its mobile-only scope and
  "toolbar behaviour and desktop layout unchanged".
- Update this plan's `Status:` line to `delivered; In Review` when shipped.

---

## 5. Non-regression guarantees (explicit)

| Guarantee | How it is enforced |
|---|---|
| All 2232 existing tests pass **without modification** | `npm test`; §2 lists the toolbar-specific pins and §7 walks the substring-match caveat |
| SAD-308 "3 tools at a time" sizing and order unchanged | `tests/ui/toolbarMobile.test.ts` unmodified + new belt-and-braces assertions |
| Desktop toolbar byte-identical | fade rules live only inside `@media (max-width: 639px)`; new test asserts none outside; visual harness desktop captures unchanged |
| No new colour literals | `tests/ui/theme.test.ts` (hex scan) — gradients use `var(--tablify-bg-card)` |
| No prototype-annotation strings | `tests/ui/noPrototypeAnnotations.test.ts` — new `src/` strings are class names only |
| Options popover, search debounce, placeholder swap, meta row, callbacks, `ToolbarState` API | untouched code paths; existing tests |
| Tap targets unaffected | fades are `pointer-events: none`; covered by the mobile runbook (§6) |
| No `formatVersion` / model / sync / export changes | no files outside `toolbar.ts`, `styles.css`, tests, docs |

---

## 6. Verification & evidence plan

1. **Automated gate:** `npm run check` (lint + full suite + tabula guard + docs link check + icon/flag
   checks + build). Baseline recorded above; the run must show 2232 + the new tests, 0 failures.
2. **Visual evidence:** `npx tsx tests/visual/capture-states.ts --viewport mobile --theme all` before
   and after. Attach `light-mobile` / `dark-mobile` toolbar-row crops to `docs/evidence/SAD-375.md`:
   at rest (right fade only), mid-scroll (both fades), at end (left fade only).
   **Known intentional deviation:** the `toolbar-row` region (`tests/visual/lib/regions.ts:25`) is
   pixel-compared against the prototype, which has no fade (the prototype is desktop-oriented; the
   phone scroll row itself is already a documented plugin deviation from SAD-308). Record this as an
   owner-sanctioned deviation in the evidence doc; if the parity report must be kept silent, paint the
   24 px edge bands out of both crops with the existing `maskRect` pattern
   (`tests/visual/lib/mask.ts`, precedent COD-76).
3. **Manual runbook (T-M-DEV, real device — iOS and Android):**
   1. Open a table on a phone (≤ 639 px). Expect: a subtle card-coloured fade over the right edge of
      the tool row; three full tools visible; no layout shift vs today.
   2. Swipe the tool row left. Expect: the row follows the finger (native inertia), the right fade
      disappears when the last tool (Options) is reached, a left fade appears while mid-row and
      disappears at the very start.
   3. Tap a tool under the fade (e.g. the right half of the 3rd tool at rest, then a sliver at the
      edge mid-scroll). Expect: the tap activates the tool — the fade never eats touches.
   4. Focus a tool with a keyboard/screen reader. Expect: focus rings still visible; auto-scroll into
      view updates the fades.
   5. Desktop (wide window and 640–1024 px): expect pixel-identical toolbar to before the change.
   6. Enable *Reduce motion*: fades appear/disappear without the 150 ms transition.
4. **Evidence doc + changelog** as in §4.4.

---

## 7. Risk review

| Risk | Verdict |
|---|---|
| `tests/ui/toolbarMobile.test.ts` substring matching picks up wrapper rules | Checked every assertion: all positive `toContain` on declarations that remain on the scroller rule (`overflow-x: auto`, `flex: 0 1 auto`, `flex: 1 1 100%`, `width: 100%`, `scroll-behavior: smooth`, the 1/3 calc). The desktop test strips the first 639 px block only; the wrap base rule outside it does not add the calc or contradict `flex: 0 1 auto`. Green without edits. New tests use exact selectors. |
| Wrapper changes flex layout of the row | Wrapper copies the scroller's old flex role in `topRow` (`flex: 0 1 auto` desktop / `flex: 1 1 100%` + `width: 100%` mobile) and is `display: flex` around the unchanged scroller rule; the scroller keeps `flex: 0 1 auto` / `flex: 1 1 100%` **and** its `padding/margin` trick. Confirmed by the desktop-preservation test + visual capture at 1568 px and 390 px. |
| Fade hides a focused button's outline near the edge | Outline is 2 px around the pill; fade alpha at the outline's x-position is < 1 and only on phones; `focus-visible` state is unchanged. Covered by runbook §6.3.4. If a screenshot review finds it unacceptable, narrow the band to 16 px (one constant). |
| `scrollLeft` RTL quirks (negative values in WebKit) | Out of scope: the plugin has zero `dir`/RTL handling today (repo-wide grep); LTR math matches the shipped surface. Recorded as a known limitation, consistent with the codebase. |
| jsdom cannot layout | Behaviour tests fake `scrollWidth`/`clientWidth`/`scrollLeft` (pattern proven in `tests/views/toolbar.test.ts` `innerWidth` faking); CSS truth is asserted textually in `tests/ui/toolbarSwipeCue.test.ts` + proven by the visual harness. |
| Options popover / outside-click regressions | `outsideClose` tests `this.root.contains(target)`; the wrapper is inside `root`; the popover is `position: fixed` relative to `root`, anchored to `optionsButton` — untouched paths, existing tests green. |
| Listener leaks | `destroy()` gains exactly the two symmetric removals; the scroll listener is `passive`. |

---

## 8. Delivery sequence (commit-sized steps)

1. `SAD-375 step 1 — wrap the tool row and sync scroll fades (toolbar.ts)` — §4.1.
2. `SAD-375 step 2 — phone edge fades + reduce motion (styles.css)` — §4.2.
3. `SAD-375 step 3 — swipe-cue regression tests` — §4.3 (both files).
4. `SAD-375 step 4 — evidence, screenshots, changelog` — §4.4, §6.

Estimated size: ~40 lines of TS (including comments), ~45 lines of CSS, ~180 lines of tests,
plus docs. No dependencies, no settings, no model/format changes.

## 9. Out of scope

- Any change to button widths, order, labels, or the 3-tools-at-a-time layout (SAD-308).
- Desktop cues, tablet-width cues (640 px+), RTL mirroring.
- Scroll-snap, drag affordances, coach marks, settings toggles.
- `Prototype/` (the design reference stays as-is; the fade is a documented plugin-only improvement
  beyond the prototype, like SAD-308's phone layout before it).
- The grid's own scroll areas (frozen-column edge cue already covers that language, COD-72).
