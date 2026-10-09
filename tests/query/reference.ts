// Reference (naive) evaluator for differential test — test-only, not shipped.
// Direct loop over rows, no closure compilation, straightforward if/else per type.
// Must match src/query/evaluate.ts semantics exactly.

import type { QueryAST, QueryTerm, QueryError } from '../../src/query/parse.js';
import type { FieldDefinition, Row, CellValue } from '../../src/model/types.js';

function isEmptyCell(cell: CellValue | undefined): boolean {
  if (cell === undefined || cell === null) return true;
  if (typeof cell === 'string') return cell === '';
  if (Array.isArray(cell)) return cell.length === 0;
  return false;
}

function resolveOptionId(value: string, field: FieldDefinition): string | null {
  if (!field.options) return null;
  const lower = value.trim().toLowerCase();
  const byName = field.options.find((o) => o.name.trim().toLowerCase() === lower);
  if (byName) return byName.id;
  const byId = field.options.find((o) => o.id.toLowerCase() === lower);
  if (byId) return byId.id;
  return null;
}

function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const lim = Math.min(offset, text.length);
  for (let i = 0; i < lim; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else column++;
  }
  return { line, column };
}

function makeError(msg: string, pos: number, rawInput: string): QueryError {
  const { line, column } = offsetToLineCol(rawInput, pos);
  return { message: msg, position: pos, line, column };
}

function parseNumeric(raw: string, type: string): number | null {
  const t = raw.trim();
  if (t === '') return null;
  if (type === 'number') {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'currency') {
    const cleaned = t.replace(/[^0-9.-]/g, '');
    const n = parseFloat(cleaned);
    return Number.isFinite(n) ? Math.round(n * 100) : null;
  }
  if (type === 'percent') {
    if (t.endsWith('%')) {
      const n = parseFloat(t.slice(0, -1));
      return Number.isFinite(n) ? n / 100 : null;
    }
    const n = parseFloat(t);
    return Number.isFinite(n) ? n : null;
  }
  if (type === 'duration') {
    // simple fallback: parse int ms
    const n = parseInt(t, 10);
    return Number.isFinite(n) && n >= 0 ? n : null;
  }
  if (type === 'rating' || type === 'auto_number') {
    const n = Number(t);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function parseCheckbox(raw: string): boolean | null {
  const t = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', '✓', 'checked'].includes(t)) return true;
  if (['false', '0', 'no', 'n', 'unchecked'].includes(t)) return false;
  return null;
}

function matchesTerm(term: QueryTerm, row: Row, field: FieldDefinition, rawInput: string): boolean | QueryError {
  const op = term.op;
  const values = term.values;
  const fieldType = field.type;
  const cell = row.values[field.id];

  const isEmptyReq = op === 'empty' || (op === 'eq' && values.length === 1 && values[0] === '');
  if (isEmptyReq) return isEmptyCell(cell);

  const textFamily = new Set(['text', 'long_text', 'url', 'email', 'phone', 'attachment']);
  const numberFamily = new Set(['number', 'currency', 'percent', 'duration', 'rating', 'auto_number']);
  const dateFamily = new Set(['date', 'date_time', 'created_time', 'modified_time']);

  if (textFamily.has(fieldType)) {
    if (op === 'not' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput);
    if (op === 'contains') {
      const want = (values[0] ?? '').toLowerCase();
      if (isEmptyCell(cell)) return false;
      return String(cell).toLowerCase().includes(want);
    }
    // eq
    if (values.length === 1) {
      const want = (values[0] ?? '').toLowerCase();
      if (isEmptyCell(cell)) return false;
      return String(cell).toLowerCase() === want;
    } else {
      const lowers = values.map((v) => v.toLowerCase()).filter((v) => v !== '');
      if (isEmptyCell(cell)) return false;
      const cs = String(cell).toLowerCase();
      return lowers.some((v) => cs.includes(v));
    }
  }

  if (fieldType === 'single_select') {
    if (op === 'contains' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for single_select field "${field.name}"`, term.position, rawInput);
    if (op === 'not') {
      const resolved = resolveOptionId(values[0] ?? '', field);
      if (resolved === null) return true;
      if (isEmptyCell(cell)) return true;
      return String(cell) !== resolved;
    }
    // eq
    if (values.length === 1) {
      const resolved = resolveOptionId(values[0] ?? '', field);
      if (resolved === null) return false;
      return String(cell ?? '') === resolved;
    } else {
      const ids = values.map((v) => resolveOptionId(v, field)).filter((id): id is string => id !== null);
      if (ids.length === 0) return false;
      if (isEmptyCell(cell)) return false;
      return ids.includes(String(cell));
    }
  }

  if (fieldType === 'multi_select') {
    if (op === 'contains' || op === 'not' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for multi_select field "${field.name}"`, term.position, rawInput);
    if (values.length === 1) {
      const resolved = resolveOptionId(values[0] ?? '', field);
      if (resolved === null) return false;
      if (!Array.isArray(cell)) return false;
      return (cell as string[]).includes(resolved);
    } else {
      const ids = values.map((v) => resolveOptionId(v, field)).filter((id): id is string => id !== null);
      if (ids.length === 0) return false;
      if (!Array.isArray(cell)) return false;
      return (cell as string[]).some((id) => ids.includes(id));
    }
  }

  if (fieldType === 'checkbox') {
    if (op === 'contains' || op === 'not' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for checkbox field "${field.name}"`, term.position, rawInput);
    const bools: boolean[] = [];
    for (const raw of values) {
      const b = parseCheckbox(raw);
      if (b === null) return makeError(`Invalid boolean value "${raw}" for checkbox field "${field.name}"`, term.position, rawInput);
      bools.push(b);
    }
    if (bools.length === 1) {
      const want = bools[0];
      if (cell === null || cell === undefined) return false;
      return cell === want;
    } else {
      if (cell === null || cell === undefined) return false;
      return bools.includes(cell as boolean);
    }
  }

  if (numberFamily.has(fieldType)) {
    if (op === 'contains' || op === 'not') return makeError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput);
    if (op === 'gt' || op === 'lt') {
      const parsed = parseNumeric(values[0] ?? '', fieldType);
      if (parsed === null) return makeError(`Invalid number "${values[0] ?? ''}" for field "${field.name}"`, term.position, rawInput);
      if (typeof cell !== 'number' || !Number.isFinite(cell)) return false;
      return op === 'gt' ? (cell as number) > parsed : (cell as number) < parsed;
    }
    // eq
    const parsedVals: number[] = [];
    for (const raw of values) {
      if (raw === '') continue;
      const parsed = parseNumeric(raw, fieldType);
      if (parsed === null) return makeError(`Invalid number "${raw}" for field "${field.name}"`, term.position, rawInput);
      parsedVals.push(parsed);
    }
    if (parsedVals.length === 0) return isEmptyCell(cell);
    if (parsedVals.length === 1) {
      if (typeof cell !== 'number') return false;
      return cell === parsedVals[0];
    } else {
      if (typeof cell !== 'number') return false;
      return parsedVals.includes(cell as number);
    }
  }

  if (dateFamily.has(fieldType)) {
    if (op === 'contains' || op === 'not') return makeError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput);
    const isDateOnly = fieldType === 'date';
    if (op === 'gt' || op === 'lt') {
      const raw = values[0] ?? '';
      const d = new Date(raw);
      if (raw.trim() === '' || isNaN(d.getTime())) return makeError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput);
      const parsedStr = d.toISOString();
      if (typeof cell !== 'string') return false;
      const cellTime = new Date(cell as string).getTime();
      const wantTime = new Date(parsedStr).getTime();
      if (isNaN(cellTime)) return false;
      return op === 'gt' ? cellTime > wantTime : cellTime < wantTime;
    }
    // eq
    const parsedVals: string[] = [];
    for (const raw of values) {
      if (raw === '') continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return makeError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput);
      // For date_only normalize to YYYY-MM-DD
      if (isDateOnly) {
        const iso = d.toISOString().slice(0, 10);
        // Also validate raw is date-like; but we already did
        parsedVals.push(iso);
      } else {
        parsedVals.push(d.toISOString());
      }
    }
    if (parsedVals.length === 0) return isEmptyCell(cell);
    if (parsedVals.length === 1) {
      if (typeof cell !== 'string') return false;
      if (isDateOnly) return cell === parsedVals[0];
      return new Date(cell as string).getTime() === new Date(parsedVals[0]).getTime();
    } else {
      if (typeof cell !== 'string') return false;
      if (isDateOnly) return parsedVals.includes(cell as string);
      const ct = new Date(cell as string).getTime();
      return parsedVals.some((s) => new Date(s).getTime() === ct);
    }
  }

  return makeError(`Unsupported field type "${fieldType}"`, term.position, rawInput);
}

function validateTermType(term: QueryTerm, field: FieldDefinition, rawInput: string): QueryError | null {
  const op = term.op;
  const values = term.values;
  const fieldType = field.type;
  const isEmptyReq = op === 'empty' || (op === 'eq' && values.length === 1 && values[0] === '');
  if (isEmptyReq) return null;

  const textFamily = new Set(['text', 'long_text', 'url', 'email', 'phone', 'attachment']);
  const numberFamily = new Set(['number', 'currency', 'percent', 'duration', 'rating', 'auto_number']);
  const dateFamily = new Set(['date', 'date_time', 'created_time', 'modified_time']);

  if (textFamily.has(fieldType)) {
    if (op === 'not' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput);
    return null;
  }
  if (fieldType === 'single_select') {
    if (op === 'contains' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for single_select field "${field.name}"`, term.position, rawInput);
    return null;
  }
  if (fieldType === 'multi_select') {
    if (op === 'contains' || op === 'not' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for multi_select field "${field.name}"`, term.position, rawInput);
    return null;
  }
  if (fieldType === 'checkbox') {
    if (op === 'contains' || op === 'not' || op === 'gt' || op === 'lt') return makeError(`"${op}" operator not valid for checkbox field "${field.name}"`, term.position, rawInput);
    for (const raw of values) {
      if (parseCheckbox(raw) === null) return makeError(`Invalid boolean value "${raw}" for checkbox field "${field.name}"`, term.position, rawInput);
    }
    return null;
  }
  if (numberFamily.has(fieldType)) {
    if (op === 'contains' || op === 'not') return makeError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput);
    if (op === 'gt' || op === 'lt') {
      const parsed = parseNumeric(values[0] ?? '', fieldType);
      if (parsed === null) return makeError(`Invalid number "${values[0] ?? ''}" for field "${field.name}"`, term.position, rawInput);
      return null;
    }
    // eq
    for (const raw of values) {
      if (raw === '') continue;
      if (parseNumeric(raw, fieldType) === null) return makeError(`Invalid number "${raw}" for field "${field.name}"`, term.position, rawInput);
    }
    return null;
  }
  if (dateFamily.has(fieldType)) {
    if (op === 'contains' || op === 'not') return makeError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput);
    if (op === 'gt' || op === 'lt') {
      const raw = values[0] ?? '';
      const d = new Date(raw);
      if (raw.trim() === '' || isNaN(d.getTime())) return makeError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput);
      return null;
    }
    for (const raw of values) {
      if (raw === '') continue;
      const d = new Date(raw);
      if (isNaN(d.getTime())) return makeError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput);
    }
    return null;
  }
  return makeError(`Unsupported field type "${fieldType}"`, term.position, rawInput);
}

export type ReferenceResult = { ok: true; rows: Row[]; matchedIds: string[] } | { ok: false; error: QueryError };

export function referenceEvaluate(ast: QueryAST, rows: Row[], fields: FieldDefinition[]): ReferenceResult {
  const fieldMap = new Map<string, FieldDefinition>();
  for (const f of fields) fieldMap.set(f.name.trim().toLowerCase(), f);

  for (const term of ast.terms) {
    if (!fieldMap.has(term.fieldName)) {
      const { line, column } = (() => {
        let line = 1, column = 1;
        const lim = Math.min(term.position, ast.rawInput.length);
        for (let i = 0; i < lim; i++) {
          if (ast.rawInput[i] === '\n') { line++; column = 1; } else column++;
        }
        return { line, column };
      })();
      return { ok: false, error: { message: `Unknown field: "${term.rawFieldName}"`, position: term.position, line, column } };
    }
  }

  // Pre-validate type mismatches and invalid values (so errors are not masked by earlier terms filtering)
  for (const term of ast.terms) {
    const field = fieldMap.get(term.fieldName)!;
    const err = validateTermType(term, field, ast.rawInput);
    if (err) return { ok: false, error: err };
  }

  const matched: Row[] = [];
  const matchedIds: string[] = [];

  for (const row of rows) {
    let ok = true;
    for (const term of ast.terms) {
      const field = fieldMap.get(term.fieldName)!;
      const res = matchesTerm(term, row, field, ast.rawInput);
      if (typeof res !== 'boolean') {
        // error
        return { ok: false, error: res as QueryError };
      }
      if (!res) {
        ok = false;
        break;
      }
    }
    if (ok) {
      matched.push(row);
      matchedIds.push(row.id);
    }
  }
  return { ok: true, rows: matched, matchedIds };
}
