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
