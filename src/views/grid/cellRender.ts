/**
 * COD-71: how a typed cell turns its stored value into what a person reads.
 *
 * The grid used to print the stored value for every cell it did not special-case
 * (`String(value)`), which is right for text-like types and wrong for the six whose stored
 * form is not their display form: single / multi select (option ids), currency (minor units),
 * percent (0…1), duration (milliseconds) and checkbox (`true` / `false`).
 *
 * `format()` on the field type is the app's existing answer — copy, search and export already
 * go through it — so it is the answer here too. Selects get the prototype's chip (the option's
 * own colour, from the same `optionChipColors` the group header uses) and the checkbox gets a
 * real, clickable box instead of a string.
 *
 * Everything is pure DOM building: no store, no commands. The caller owns the write.
 */

import { optionChipColors } from '../../ui/theme/tokens.js';
import { faIcon } from '../../ui/faIcons.js';
import { getFieldType } from '../../model/fieldTypes/registry.js';
import type { CellValue, FieldDefinition } from '../../model/types.js';
import { ratingNumber, starFills } from './rating/scale.js';
import { formatPhoneDisplay, telHref } from '../../model/phone/phoneValue.js';

export type CellTheme = 'light' | 'dark';

/** True for the types whose stored value is not their display text (COD-71). */
export function isFormattedCellType(field: FieldDefinition): boolean {
  switch (field.type) {
    case 'single_select':
    case 'multi_select':
    case 'currency':
    case 'percent':
    case 'duration':
      return true;
    default:
      return false;
  }
}

/**
 * Display text for a value the field type can format. Empty for null/undefined, like every
 * `format()` — the cell's em dash is CSS (`:empty::before`).
 */
export function formattedCellText(field: FieldDefinition, value: CellValue | undefined): string {
  if (value === undefined || value === null) return '';
  return getFieldType(field.type).format(value, field);
}

/**
 * The option ids a select cell holds, in stored order. A value of the wrong shape (a corrupt
 * file) yields nothing rather than a guess.
 */
export function selectOptionIds(field: FieldDefinition, value: CellValue | undefined): string[] {
  if (field.type === 'single_select') return typeof value === 'string' && value !== '' ? [value] : [];
  if (field.type === 'multi_select') {
    return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : [];
  }
  return [];
}

/**
 * Append select chips to `host`: one per option id, in stored order.
 *
 * An id with no matching option renders nothing — the same thing `format()`, copy, search and
 * export do with it. The id stays in the file; rendering never rewrites a value.
 */
export function renderSelectChips(
  host: HTMLElement,
  field: FieldDefinition,
  value: CellValue | undefined,
  theme: CellTheme,
): void {
  const options = field.options ?? [];
  const multi = field.type === 'multi_select';
  let first = true;
  for (const id of selectOptionIds(field, value)) {
    const option = options.find((o) => o.id === id);
    if (!option) continue;
    // Multi-select chips sit side by side; the prototype separates them with `mr-1`.
    if (!first) host.appendChild(document.createTextNode(' '));
    first = false;
    const colors = optionChipColors(option.color, theme);
    const chip = document.createElement('span');
    chip.className = multi ? 'tablify__chip tablify__chip--cell tablify__chip--multi' : 'tablify__chip tablify__chip--cell';
    chip.style.background = colors.background;
    chip.style.borderColor = colors.border;
    chip.style.color = colors.text;
    if (!multi) {
      // The prototype's single-select chip carries a colour dot; the smaller multi chip does not.
      const dot = document.createElement('span');
      dot.className = 'tablify__chip-dot';
      dot.setAttribute('aria-hidden', 'true');
      dot.style.background = colors.dot;
      chip.appendChild(dot);
    }
    chip.appendChild(document.createTextNode(option.name));
    host.appendChild(chip);
  }
}

/**
 * A checkbox cell.
 *
 * With `onToggle` the control is a real `<button role="checkbox">`: clicking it stops there (no
 * cell selection, no editor) and the caller performs the write. Without one — a grid nobody wired
 * the callback into — it is a read-only `<span role="img">`, so older callers keep a working cell.
 */
export function createCheckboxControl(
  field: FieldDefinition,
  value: CellValue | undefined,
  onToggle?: () => void,
): HTMLElement {
  const checked = value === true;
  const icon = faIcon(checked ? 'square-check' : 'square');
  const el = document.createElement(onToggle ? 'button' : 'span');
  el.className = checked ? 'tablify__check tablify__check--on' : 'tablify__check';
  // The icon is generated markup (src/ui/faIcons.ts), never user text.
  el.innerHTML = icon;
  if (onToggle) {
    (el as HTMLButtonElement).type = 'button';
    el.setAttribute('role', 'checkbox');
    el.setAttribute('aria-checked', checked ? 'true' : 'false');
    el.setAttribute('aria-label', field.name);
    el.addEventListener('click', (e) => {
      // The box owns its click: no cell selection, no inline editor.
      e.stopPropagation();
      e.preventDefault();
      onToggle();
    });
    // A double click on the box is two toggles, never "open the editor".
    el.addEventListener('dblclick', (e) => e.stopPropagation());
  } else {
    el.setAttribute('role', 'img');
    el.setAttribute('aria-label', `${field.name}: ${checked ? 'checked' : 'not checked'}`);
  }
  return el;
}

// ---- COD-73: the remaining types the grid used to print raw ----

/**
 * Numeric types sit right, like the prototype's `align: 'right'` on its field types. The cell
 * gets `tablify__cell--numeric`; CSS does the alignment.
 */
export function isNumericCellType(field: FieldDefinition): boolean {
  switch (field.type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'duration':
    case 'auto_number':
      return true;
    default:
      return false;
  }
}

/** Timestamp types stored as UTC ISO: the cell shows the same local wall clock the editor uses. */
export function isTimestampCellType(field: FieldDefinition): boolean {
  return field.type === 'date_time' || field.type === 'created_time' || field.type === 'modified_time';
}

const pad2 = (n: number): string => String(n).padStart(2, '0');

/**
 * `2026-10-17T14:30`, in the reader's own time zone — the form the `date_time` editor shows, so a
 * value does not change shape when it is opened. A value that is not a parseable instant is shown
 * as stored rather than as "Invalid Date".
 */
export function localDateTimeText(value: CellValue | undefined): string {
  if (typeof value !== 'string' || value === '') return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

/**
 * `1,234,567` — grouping separators, the prototype's `Number(v).toLocaleString()`. Fixed to
 * en-US so the grid reads the same on every machine (and in every test). A non-numeric value
 * (a corrupt file) keeps its stored text.
 */
export function groupedNumberText(value: CellValue | undefined): string {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return value === undefined || value === null ? '' : String(value);
  }
  return value.toLocaleString('en-US');
}

/**
 * A rating's scale: the field's Max (the same rule the group headings use), 5 when unset, and
 * within the type's own 1–10 range. A rating out of 10 draws ten stars.
 */
export function ratingScale(field: FieldDefinition): number {
  const max = typeof field.max === 'number' && Number.isFinite(field.max) ? Math.round(field.max) : 5;
  return Math.max(1, Math.min(10, max));
}

/** Options for {@link renderRatingStars}. */
export interface RatingStarsOptions {
  /**
   * SAD-304: ask for clickable stars. The caller handles the click (the grid owns selection and
   * the write); the renderer only marks each star with the value it stands for.
   */
  interactive?: boolean;
}

/**
 * SAD-304: hovering a clickable star marks that star and every star before it, so the value a
 * click will write is visible before the click. A pointer listener rather than a CSS sibling
 * rule: the stars are painted left to right, and a `~` selector would light up the wrong side.
 *
 * The class is decoration only — `--on` and `--partial` still say what the stored value is.
 */
function wireStarPreview(stars: HTMLElement): void {
  const paint = (upTo: number): void => {
    for (const star of Array.from(stars.children) as HTMLElement[]) {
      const n = Number(star.dataset.ratingStar);
      star.classList.toggle('tablify__star--preview', Number.isFinite(n) && n <= upTo);
    }
  };
  stars.addEventListener('pointerover', (event) => {
    const target = (event.target as HTMLElement | null)?.closest?.('[data-rating-star]') as HTMLElement | null;
    if (!target || !stars.contains(target)) return;
    const n = Number(target.dataset.ratingStar);
    if (Number.isFinite(n)) paint(n);
  });
  stars.addEventListener('pointerleave', () => paint(0));
}

/**
 * A rating cell: one star per point of the scale, each filled by the fraction the value gives it
 * (`4.5` fills four stars and half of the fifth), then the number (`4.5`).
 *
 * The stars are decoration (`aria-hidden`) — the text is the label, so a screen reader reads the
 * value and not five glyphs. An empty rating still draws its stars: they say what the column is,
 * the way an empty checkbox draws its box.
 *
 * A star is two stacked copies of the same glyph: the base in the placeholder ink, and the fill in
 * the accent ink clipped to its fraction. One glyph, every fraction, and no half-star asset.
 */
export function renderRatingStars(
  host: HTMLElement,
  field: FieldDefinition,
  value: CellValue | undefined,
  options: RatingStarsOptions = {},
): void {
  const scale = ratingScale(field);
  const fills = starFills(value, scale);
  const stars = document.createElement('span');
  stars.className = options.interactive ? 'tablify__stars tablify__stars--interactive' : 'tablify__stars';
  stars.setAttribute('aria-hidden', 'true');
  for (let i = 0; i < scale; i += 1) {
    const fill = fills[i] ?? 0;
    const star = document.createElement('span');
    // `--on` keeps its old meaning (a full star) for every reader of the class; `--partial` is new.
    star.className = fill >= 1
      ? 'tablify__star tablify__star--on'
      : fill > 0
        ? 'tablify__star tablify__star--partial'
        : 'tablify__star';
    if (options.interactive) star.dataset.ratingStar = String(i + 1);
    const box = document.createElement('span');
    box.className = 'tablify__star-box';
    const base = document.createElement('span');
    base.className = 'tablify__star-base';
    base.innerHTML = faIcon('star', 11);
    const painted = document.createElement('span');
    painted.className = 'tablify__star-fill';
    // Three decimals kill the float dust (3.7 - 3 = 0.7000000000000002) without losing a pixel.
    painted.style.width = `${Math.round(fill * 1000) / 10}%`;
    painted.innerHTML = faIcon('star', 11);
    box.appendChild(base);
    box.appendChild(painted);
    star.appendChild(box);
    stars.appendChild(star);
  }
  if (options.interactive) wireStarPreview(stars);
  host.appendChild(stars);
  const rating = ratingNumber(value);
  if (rating !== null) {
    const label = document.createElement('span');
    label.className = 'tablify__rating-text';
    // The number as the type stores it, so copy, export and this label never disagree.
    label.textContent = formattedCellText(field, rating);
    host.appendChild(label);
  }
}

/** `mailto:` / `tel:` / bare `http(s)://`, or null when the value cannot be one. */
function contactHref(field: FieldDefinition, value: string): string | null {
  if (field.type === 'email') return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? `mailto:${value}` : null;
  // SAD-303: E.164 for a number we can parse; the old loose rule for a legacy value, so a link
  // that worked before the change still works.
  if (field.type === 'phone') return telHref(value);
  if (field.type === 'url') return /^https?:\/\//i.test(value) ? value : null;
  return null;
}

/**
 * A URL, email or phone cell: a real link, so it can be opened the way the reader expects.
 *
 * The link owns its click (`stopPropagation`), exactly like the checkbox — clicking the text
 * opens it instead of selecting the cell. A value that is not a usable address is not turned into
 * a link (a corrupt `example` in a URL column must not navigate the window), and stays plain text.
 */
export function renderContactLink(host: HTMLElement, field: FieldDefinition, value: CellValue | undefined): void {
  if (typeof value !== 'string' || value === '') return;
  const href = contactHref(field, value);
  if (!href) {
    host.textContent = value;
    return;
  }
  const link = document.createElement('a');
  link.className = 'tablify__cell-link';
  link.href = href;
  // SAD-303: a phone cell shows the number in its international shape, while the file, copy,
  // search, sort, grouping and export keep the raw E.164 (title shows what is stored).
  link.textContent = field.type === 'phone' ? formatPhoneDisplay(value) : value;
  link.title = value;
  link.rel = 'noopener';
  link.target = '_blank';
  link.addEventListener('click', (e) => e.stopPropagation());
  host.appendChild(link);
}

/**
 * The paths an attachment cell holds: its single path, or every entry of a legacy list value.
 * The same rule the attachment panel uses (`AttachmentPanel.paths`).
 */
export function attachmentPaths(value: CellValue | undefined): string[] {
  if (Array.isArray(value)) return value.map((entry) => String(entry)).filter((p) => p !== '');
  return typeof value === 'string' && value !== '' ? [value] : [];
}

/** One paperclip chip per file, the prototype's `FT.attachment.fmt`. */
export function renderAttachmentChips(host: HTMLElement, value: CellValue | undefined): void {
  let first = true;
  for (const path of attachmentPaths(value)) {
    if (!first) host.appendChild(document.createTextNode(' '));
    first = false;
    const chip = document.createElement('span');
    chip.className = 'tablify__chip tablify__chip--file';
    chip.title = path;
    const icon = document.createElement('span');
    icon.className = 'tablify__chip-icon';
    // Generated glyph markup (src/ui/faIcons.ts), never user text.
    icon.innerHTML = faIcon('paperclip', 9);
    chip.appendChild(icon);
    chip.appendChild(document.createTextNode(path));
    host.appendChild(chip);
  }
}
