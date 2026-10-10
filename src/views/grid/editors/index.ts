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

// P8-03: formula results are computed, and link cells are not edited in P8-03 (P8-04 adds link editing).
const READONLY_TYPES = new Set(['auto_number', 'created_time', 'modified_time', 'formula', 'link']);

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
  const initial = ft.format(row.values[field.id] ?? null, field);

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
    // number/date use text input with validation via parse
    inp.type = field.type === 'date' || field.type === 'date_time' ? 'date' : 'text';
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
    if (String(oldValue) === String(res.value)) {
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
      doCommit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
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
