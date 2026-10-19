/**
 * @vitest-environment jsdom
 *
 * SAD-304 — the rating panel: the stars, half-star zones, the numeric field, the keyboard and
 * the one promise every panel here makes: an untouched panel writes nothing.
 *
 * The card is the same `#floatPanel` the select / attachment / date / phone panels use, so these
 * tests look inside it — what the draft is, what it paints, and what the host is told.
 */

import { describe, it, expect, afterEach, vi } from 'vitest';
import { RatingPanel, type RatingPanelOptions } from '../../../src/views/grid/rating/RatingPanel.js';
import type { CellValue, FieldDefinition } from '../../../src/model/types.js';

function field(max?: number): FieldDefinition {
  return { id: 'fld_r', name: 'Quality', type: 'rating', ...(max === undefined ? {} : { max }) } as FieldDefinition;
}

interface Harness {
  panel: RatingPanel;
  card: HTMLElement;
  slider: HTMLElement;
  input: HTMLInputElement;
  caption: HTMLElement;
  hint: HTMLElement;
  done: HTMLButtonElement;
  clear: HTMLButtonElement;
  commits: CellValue[];
  cancels: ReturnType<typeof vi.fn>;
}

function mount(overrides: Partial<RatingPanelOptions> = {}): Harness {
  const commits: CellValue[] = [];
  const cancels = vi.fn();
  const panel = new RatingPanel({
    field: field(),
    value: null,
    onCommit: (v) => commits.push(v),
    onCancel: cancels,
    ...overrides,
  });
  const anchor = document.createElement('div');
  document.body.appendChild(anchor);
  panel.open(anchor);
  const card = panel.element;
  return {
    panel,
    card,
    slider: card.querySelector('.tablify__rating-stars') as HTMLElement,
    input: card.querySelector('input.tablify__rating-input') as HTMLInputElement,
    caption: card.querySelector('.tablify__rating-caption') as HTMLElement,
    hint: card.querySelector('.tablify__rating-hint') as HTMLElement,
    done: card.querySelector('button.tablify__rating-done') as HTMLButtonElement,
    clear: card.querySelector('button.tablify__rating-clear') as HTMLButtonElement,
    commits,
    cancels,
  };
}

/** jsdom lays nothing out; give the star row the 100 px geometry the pointer maths expects. */
function layout(harness: Harness, width = 100): void {
  harness.slider.getBoundingClientRect = () =>
    ({ x: 0, y: 0, top: 0, left: 0, right: width, bottom: 20, width, height: 20, toJSON: () => ({}) }) as DOMRect;
}

function press(harness: Harness, clientX: number): void {
  harness.slider.dispatchEvent(new MouseEvent('pointerdown', { clientX, bubbles: true, button: 0 }));
}

function type(harness: Harness, text: string): void {
  harness.input.value = text;
  harness.input.dispatchEvent(new Event('input', { bubbles: true }));
}

function key(harness: Harness, name: string): void {
  harness.slider.dispatchEvent(new KeyboardEvent('keydown', { key: name, bubbles: true }));
}

const fills = (harness: Harness): number[] =>
  Array.from(harness.card.querySelectorAll('.tablify__star')).map((star) => {
    if (star.classList.contains('tablify__star--on')) return 1;
    const width = (star.querySelector('.tablify__star-fill') as HTMLElement | null)?.style.width ?? '0%';
    return Number(width.replace('%', '')) / 100;
  });

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SAD-304 — the panel shows the stored value', () => {
  it('shows the number, the caption and the ARIA value', () => {
    const h = mount({ value: 4.5 });
    expect(h.input.value).toBe('4.5');
    expect(h.caption.textContent).toBe('4.5 out of 5 stars');
    expect(h.slider.getAttribute('aria-valuenow')).toBe('4.5');
    expect(h.slider.getAttribute('aria-valuetext')).toBe('4.5 out of 5 stars');
    expect(h.slider.getAttribute('aria-valuemin')).toBe('0');
    expect(h.slider.getAttribute('aria-valuemax')).toBe('5');
  });

  it('draws one star per point of the scale, filled by the fraction', () => {
    const h = mount({ value: 4.5 });
    expect(h.card.querySelectorAll('.tablify__star')).toHaveLength(5);
    expect(h.card.querySelectorAll('.tablify__star--on')).toHaveLength(4);
    expect(h.card.querySelectorAll('.tablify__star--partial')).toHaveLength(1);
    expect(fills(h)).toEqual([1, 1, 1, 1, 0.5]);
  });

  it('an empty rating says so and fills nothing', () => {
    const h = mount();
    expect(h.input.value).toBe('');
    expect(h.caption.textContent).toBe('No rating');
    expect(h.slider.getAttribute('aria-valuenow')).toBe('0');
    expect(fills(h)).toEqual([0, 0, 0, 0, 0]);
    expect(h.clear.disabled).toBe(true);
  });

  it('a ten-star field draws ten stars', () => {
    const h = mount({ field: field(10), value: 7.5 });
    expect(h.card.querySelectorAll('.tablify__star')).toHaveLength(10);
    expect(h.caption.textContent).toBe('7.5 out of 10 stars');
    expect(h.slider.getAttribute('aria-valuemax')).toBe('10');
  });
});

describe('SAD-304 — clicking and dragging the stars', () => {
  it('the left half of a star is x.5 and the right half is x', () => {
    const h = mount();
    layout(h);
    press(h, 41); // star three spans 40–60 px; its halves meet at 50
    expect(h.input.value).toBe('2.5');
    expect(h.caption.textContent).toBe('2.5 out of 5 stars');
    press(h, 51);
    expect(h.input.value).toBe('3');
  });

  it('a drag repaints as the pointer moves', () => {
    const h = mount();
    layout(h);
    press(h, 10);
    h.slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 90, bubbles: true }));
    expect(h.input.value).toBe('4.5');
    expect(fills(h)).toEqual([1, 1, 1, 1, 0.5]);
  });

  it('hovering previews the value without touching the draft', () => {
    const h = mount({ value: 2 });
    layout(h);
    // A pointer at 41 px is the left half of star three → 2.5, so three stars light up.
    h.slider.dispatchEvent(new MouseEvent('pointermove', { clientX: 41, bubbles: true }));
    expect(
      Array.from(h.card.querySelectorAll('.tablify__star--preview')).map((el) =>
        (el as HTMLElement).dataset.ratingStar ?? null,
      ),
    ).toHaveLength(3);
    expect(h.input.value).toBe('2');
    expect(h.caption.textContent).toBe('2 out of 5 stars');
    h.slider.dispatchEvent(new MouseEvent('pointerleave', { bubbles: true }));
    expect(h.card.querySelectorAll('.tablify__star--preview')).toHaveLength(0);
  });

  it('the pointer never selects past the ends', () => {
    const h = mount();
    layout(h);
    press(h, -20);
    expect(h.input.value).toBe('0.5');
    press(h, 500);
    expect(h.input.value).toBe('5');
  });
});

describe('SAD-304 — the keyboard', () => {
  it('arrows walk halves', () => {
    const h = mount({ value: 3 });
    key(h, 'ArrowRight');
    expect(h.input.value).toBe('3.5');
    key(h, 'ArrowLeft');
    key(h, 'ArrowLeft');
    expect(h.input.value).toBe('2.5');
  });

  it('PageUp/PageDown walk whole stars, Home/End jump', () => {
    const h = mount({ value: 3 });
    key(h, 'PageUp');
    expect(h.input.value).toBe('4');
    key(h, 'PageDown');
    expect(h.input.value).toBe('3');
    key(h, 'End');
    expect(h.input.value).toBe('5');
    key(h, 'Home');
    expect(h.input.value).toBe('0');
  });

  it('a digit sets that value, Delete clears', () => {
    const h = mount();
    key(h, '3');
    expect(h.input.value).toBe('3');
    key(h, 'Delete');
    expect(h.input.value).toBe('');
    expect(h.caption.textContent).toBe('No rating');
  });

  it('Enter commits', () => {
    const h = mount({ value: 2 });
    key(h, 'ArrowRight');
    key(h, 'Enter');
    expect(h.commits).toEqual([2.5]);
    expect(document.body.contains(h.card)).toBe(false);
  });
});

describe('SAD-304 — the numeric field', () => {
  it('takes a decimal the stars cannot point at', () => {
    const h = mount();
    type(h, '3.7');
    expect(h.caption.textContent).toBe('3.7 out of 5 stars');
    expect(fills(h)[3]).toBeCloseTo(0.7, 6);
  });

  it('accepts a comma and rounds to two decimals', () => {
    const h = mount();
    type(h, '3,666');
    expect(h.caption.textContent).toBe('3.67 out of 5 stars');
  });

  it('refuses a value outside the field’s scale and disables Done', () => {
    const h = mount();
    type(h, '6');
    expect(h.done.disabled).toBe(true);
    expect(h.input.getAttribute('aria-invalid')).toBe('true');
    expect(h.hint.hidden).toBe(false);
    expect(h.hint.textContent).toBe('Enter a number from 0 to 5, or leave it empty.');
  });

  it('refuses text', () => {
    const h = mount();
    type(h, 'abc');
    expect(h.done.disabled).toBe(true);
    expect(h.input.getAttribute('aria-invalid')).toBe('true');
  });

  it('an invalid entry cannot be committed by Enter or by Done', () => {
    const h = mount();
    type(h, '9');
    h.input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    h.done.click();
    expect(h.commits).toEqual([]);
    expect(document.body.contains(h.card)).toBe(true);
  });

  it('emptying the field means no rating, and Done stays enabled', () => {
    const h = mount({ value: 4 });
    type(h, '');
    expect(h.done.disabled).toBe(false);
    h.done.click();
    expect(h.commits).toEqual([null]);
  });
});

describe('SAD-304 — committing', () => {
  it('Done commits once and closes', () => {
    const h = mount({ value: 2 });
    key(h, 'ArrowRight');
    h.done.click();
    expect(h.commits).toEqual([2.5]);
    expect(document.body.contains(h.card)).toBe(false);
  });

  it('an untouched panel hands the stored value back', () => {
    const h = mount({ value: 4 });
    h.done.click();
    expect(h.commits).toEqual([4]);
  });

  it('Clear then Done removes the rating', () => {
    const h = mount({ value: 4 });
    h.clear.click();
    expect(h.input.value).toBe('');
    expect(h.clear.disabled).toBe(true);
    h.done.click();
    expect(h.commits).toEqual([null]);
  });

  it('Escape cancels and writes nothing', () => {
    const h = mount({ value: 4 });
    key(h, 'ArrowRight');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(h.cancels).toHaveBeenCalledTimes(1);
    expect(h.commits).toEqual([]);
    expect(document.body.contains(h.card)).toBe(false);
  });

  it('a press outside keeps a valid change', () => {
    const h = mount({ value: 4 });
    key(h, 'ArrowLeft');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(h.commits).toEqual([3.5]);
  });

  it('a press outside discards an invalid draft', () => {
    const h = mount({ value: 4 });
    type(h, 'oops');
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(h.commits).toEqual([]);
    expect(h.cancels).toHaveBeenCalledTimes(1);
  });

  it('a press inside the card does not dismiss it', () => {
    const h = mount({ value: 4 });
    h.caption.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(h.commits).toEqual([]);
    expect(document.body.contains(h.card)).toBe(true);
  });
});
