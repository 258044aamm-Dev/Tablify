/**
 * Cell editors — one per field type.
 * Every commit goes through a P1-05 command (createEditCellCommand).
 * Enter commits, Escape cancels, blur commits, IME composition is respected.
 * Read-only types (auto_number, created_time, modified_time) show no editor.
 */

import { getFieldType } from '../../../model/fieldTypes/registry.js';
import { createEditCellCommand } from '../../../model/commands.js';
import type { FieldDefinition, Row, CellValue } from '../../../model/types.js';
import type { TableStore } from '../../../model/tableStore.js';
import type { CommandStack } from '../../../model/commands.js';

export type EditorCommitResult = { ok: true; value: CellValue } | { ok: false; error: string };

// P8-03: formula results are computed. P8-04: link cells are edited in the row picker, not inline.
const READONLY_TYPES = new Set(['auto_number', 'created_time', 'modified_time', 'formula']);

export function isReadOnly(field: FieldDefinition): boolean {
  // P7-05: an Airtable field Tablify cannot write back is read-only, whatever its Tablify type.
  if (field.airtable?.readOnly) return true;
  return READONLY_TYPES.has(field.type) || getFieldType(field.type).readOnly;
}

export function parseInput(field: FieldDefinition, input: string): EditorCommitResult {
  try {
    const ft = getFieldType(field.type);
    const parsed = ft.parse(input, field);
    // Distinguish invalid (non-empty input → null) from empty
    if (input.trim() !== '' && parsed === null) {
      return { ok: false, error: `Invalid value for ${field.type}` };
    }
    const valid = ft.validate(parsed, field);
    if (!valid) return { ok: false, error: `Invalid value for ${field.type}` };
    return { ok: true, value: parsed };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}

/**
 * COD-68: a `date_time` value is stored as ISO 8601 UTC, but `<input type="datetime-local">`
 * only accepts a local "YYYY-MM-DDTHH:mm:ss" wall-clock string. Converting here (and only here)
 * keeps the stored format — and therefore the file format and Airtable sync — untouched.
 */
function toLocalDateTimeInput(value: CellValue): string {
  if (value === null || value === undefined || value === '') return '';
  const d = new Date(String(value));
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number): string => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/**
 * Whether the value leaving the editor is the value that entered it — in which case no command
 * runs at all. Opening a cell and dismissing it must never write (COD-68): the `date_time` input
 * is a lossy representation (browsers may drop seconds or milliseconds), and an unset `checkbox`
 * (`null`) must not become an explicit `false`.
 */
function isUnchanged(field: FieldDefinition, oldValue: CellValue | undefined, newValue: CellValue, initial: string): boolean {
  if (field.type === 'checkbox') return Boolean(oldValue) === Boolean(newValue);
  if (field.type === 'date_time') return toLocalDateTimeInput(newValue) === initial;
  return String(oldValue ?? null) === String(newValue);
}

/**
 * Create a DOM editor for a cell. Returns null for read-only types.
 * The editor handles Enter/Escape/blur and IME composition.
 */
export function createEditor(
  field: FieldDefinition,
  row: Row,
  store: TableStore,
  stack: CommandStack,
  onDone: (committed: boolean) => void,
): HTMLElement | null {
  if (isReadOnly(field)) return null;

  const ft = getFieldType(field.type);
  // COD-68: date_time needs the local wall-clock form for its input; every other type uses format().
  const initial =
    field.type === 'date_time'
      ? toLocalDateTimeInput(row.values[field.id] ?? null)
      : ft.format(row.values[field.id] ?? null, field);

  // Choose element per type
  let input: HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement;
  const isLong = field.type === 'long_text';
  const isCheckbox = field.type === 'checkbox';
  const isSingle = field.type === 'single_select';
  const isMulti = field.type === 'multi_select';

  if (isCheckbox) {
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.checked = Boolean(row.values[field.id]);
    input = cb as unknown as HTMLInputElement;
  } else if (isSingle || isMulti) {
    // For P3-02 we use a simple text input; full dropdown is P3-03
    const inp = document.createElement('input');
    inp.type = 'text';
    inp.value = initial;
    input = inp;
  } else if (isLong) {
    const ta = document.createElement('textarea');
    ta.value = initial;
    input = ta;
  } else {
    const inp = document.createElement('input');
    // COD-68: date keeps date-only; date_time needs a time component (with seconds, so the
    // local string in the field round-trips). Everything else is text and validates on parse.
    inp.type = field.type === 'date' ? 'date' : field.type === 'date_time' ? 'datetime-local' : 'text';
    if (field.type === 'date_time') inp.step = '1';
    inp.value = initial;
    input = inp;
  }

  input.className = 'tablify__editor';
  let isComposing = false;
  input.addEventListener('compositionstart', () => (isComposing = true));
  input.addEventListener('compositionend', () => (isComposing = false));

  let committed = false;
  const doCommit = () => {
    if (committed) return;
    committed = true;
    const raw = isCheckbox ? ((input as HTMLInputElement).checked ? 'true' : 'false') : (input as HTMLInputElement).value;
    const res = parseInput(field, raw);
    if (!res.ok) {
      // keep editor open, show error
      input.setAttribute('aria-invalid', 'true');
      input.title = res.error;
      committed = false;
      return;
    }
    const oldValue = row.values[field.id] ?? null;
    if (isUnchanged(field, oldValue as CellValue | undefined, res.value, initial)) {
      onDone(false);
      return;
    }
    const cmd = createEditCellCommand({ rowId: row.id, fieldId: field.id, oldValue: oldValue as CellValue, newValue: res.value });
    stack.execute(cmd);
    onDone(true);
  };
  const doCancel = () => {
    if (committed) return;
    committed = true;
    onDone(false);
  };

  input.addEventListener('keydown', (e) => {
    if (isComposing) return;
    if (e.key === 'Enter') {
      e.preventDefault();
      // SAD-96: the commit keystroke must not bubble to the grid, where Enter means
      // "edit this cell" and would immediately re-open the editor just closed.
      e.stopPropagation();
      doCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      // SAD-96: same for cancel — Escape belongs to the editor while it is open.
      e.stopPropagation();
      doCancel();
    }
  });
  input.addEventListener('blur', () => {
    if (!isComposing) doCommit();
  });

  // autofocus
  setTimeout(() => input.focus(), 0);
  return input as HTMLElement;
}

/**
 * Helper for tests and non-DOM commits: directly commit a string value through the command stack.
 * Returns the parse result; if ok, the command is executed.
 */
export function commitValue(
  field: FieldDefinition,
  row: Row,
  input: string,
  store: TableStore,
  stack: CommandStack,
): EditorCommitResult {
  if (isReadOnly(field)) return { ok: false, error: 'read-only' };
  const res = parseInput(field, input);
  if (!res.ok) return res;
  const oldValue = row.values[field.id] ?? null;
  const cmd = createEditCellCommand({ rowId: row.id, fieldId: field.id, oldValue: oldValue as CellValue, newValue: res.value });
  stack.execute(cmd);
  return res;
}
