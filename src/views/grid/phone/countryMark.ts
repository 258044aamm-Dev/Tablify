// SAD-355: the leading mark of a country — its flag, or the two-letter monogram when no asset
// exists for that code. One function so the list row, the field-window trigger and the cell-panel
// trigger cannot drift apart.
//
// The flag is an inlined SVG (`src/ui/flags.ts`, generated from country-flag-icons) rather than an
// emoji: an emoji flag renders as two regional-indicator letters on Windows and as tofu on a Linux
// without Noto Color Emoji, and this plugin runs on all three desktops. See
// docs/decisions/country-flags.md.
//
// `aria-hidden` is the caller's job (the element is decorative — the country's name is the label).

import { flagIcon } from '../../../ui/flags.js';

/**
 * Paint `mark` in place: flag when `iso` has one, monogram otherwise. An empty `iso` keeps the em
 * dash the field window shows for "no default".
 */
export function paintCountryMark(mark: HTMLElement, iso: string | null): void {
  // The ISO travels as data, not as visible text: a flag has no text, and both triggers are read
  // by tests (and by anyone inspecting the DOM) through this attribute.
  if (iso) mark.dataset.iso = iso;
  else delete mark.dataset.iso;

  const svg = iso ? flagIcon(iso) : '';
  if (svg) {
    mark.className = 'tablify__country-flag';
    mark.innerHTML = svg;
    return;
  }
  mark.className = 'tablify__country-badge';
  mark.textContent = iso ?? '—';
}
