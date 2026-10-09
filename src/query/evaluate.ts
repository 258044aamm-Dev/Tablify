// Pure filter engine — compiles AST into predicates using field registry.
// No Obsidian imports. Implements P2-02.
// Spec: FEATURES.md §2.6, guidelines P2-02, docs/query-grammar.md

import type { QueryAST, QueryTerm, QueryError } from './parse.js';
import type { FieldDefinition, Row, CellValue, FieldTypeName } from '../model/types.js';
import { getFieldType } from '../model/fieldTypes/registry.js';

export type Predicate = (row: Row) => boolean;

export type EvaluationResult = { ok: true; rows: Row[]; matchedIds: string[] } | { ok: false; error: QueryError };

export type EvaluateOptions = {
  strictFieldNames?: boolean;
};

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

function makeQueryError(message: string, position: number, rawInput: string): QueryError {
  const { line, column } = offsetToLineCol(rawInput, position);
  return { message, position, line, column };
}

function isEmptyCell(cell: CellValue | undefined): boolean {
  if (cell === undefined || cell === null) return true;
  if (typeof cell === 'string') return cell === '';
  if (Array.isArray(cell)) return cell.length === 0;
  return false;
}

function getFieldMap(fields: FieldDefinition[]): Map<string, FieldDefinition> {
  const m = new Map<string, FieldDefinition>();
  for (const f of fields) m.set(f.name.trim().toLowerCase(), f);
  return m;
}

function resolveOptionId(value: string, field: FieldDefinition): string | null {
  if (!field.options) return null;
  const lower = value.trim().toLowerCase();
  // exact name match case-insensitive
  const byName = field.options.find((o) => o.name.trim().toLowerCase() === lower);
  if (byName) return byName.id;
  // direct ID match (allow user to type option ID)
  const byId = field.options.find((o) => o.id.toLowerCase() === lower);
  if (byId) return byId.id;
  return null;
}

// Parse query value string into typed value for numeric/date/checkbox families
function parseNumericQueryValue(raw: string, fieldType: FieldTypeName): number | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  switch (fieldType) {
    case 'number': {
      const n = Number(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    case 'currency': {
      const cleaned = trimmed.replace(/[^0-9.-]/g, '');
      const n = parseFloat(cleaned);
      if (!Number.isFinite(n)) return null;
      return Math.round(n * 100);
    }
    case 'percent': {
      if (trimmed.endsWith('%')) {
        const n = parseFloat(trimmed.slice(0, -1));
        if (!Number.isFinite(n)) return null;
        return n / 100;
      }
      const n = parseFloat(trimmed);
      return Number.isFinite(n) ? n : null;
    }
    case 'duration': {
      // reuse durationType parse via registry for human forms
      try {
        const ft = getFieldType('duration');
        const parsed = ft.parse(trimmed);
        if (typeof parsed === 'number' && Number.isFinite(parsed)) return parsed as number;
      } catch {
        // fallback
      }
      const n = parseInt(trimmed, 10);
      return Number.isFinite(n) && n >= 0 ? n : null;
    }
    case 'rating': {
      const n = parseInt(trimmed, 10);
      if (!Number.isFinite(n)) return null;
      return n;
    }
    case 'auto_number': {
      const n = Number(trimmed);
      return Number.isFinite(n) && Number.isInteger(n) ? n : null;
    }
    default:
      return null;
  }
}

function parseCheckboxQueryValue(raw: string): boolean | null {
  const t = raw.trim().toLowerCase();
  if (['true', '1', 'yes', 'y', '✓', 'checked'].includes(t)) return true;
  if (['false', '0', 'no', 'n', 'unchecked'].includes(t)) return false;
  // also allow empty? but query value "false" already handled
  return null;
}

function parseDateValue(raw: string, isDateOnly: boolean): string | null {
  const trimmed = raw.trim();
  if (trimmed === '') return null;
  if (isDateOnly) {
    const ft = getFieldType('date');
    const parsed = ft.parse(trimmed);
    return typeof parsed === 'string' ? (parsed as string) : null;
  } else {
    const ft = getFieldType('date_time');
    const parsed = ft.parse(trimmed);
    return typeof parsed === 'string' ? (parsed as string) : null;
  }
}

// Main compile per term
function compileTerm(
  term: QueryTerm,
  field: FieldDefinition,
  rawInput: string,
): { ok: true; predicate: Predicate } | { ok: false; error: QueryError } {
  const fieldType = field.type;
  const op = term.op;
  const values = term.values;

  // Empty op or eq with single empty string → isEmpty check regardless of type
  const isEmptyRequest = op === 'empty' || (op === 'eq' && values.length === 1 && values[0] === '');
  if (isEmptyRequest) {
    const pred: Predicate = (row) => isEmptyCell(row.values[field.id]);
    return { ok: true, predicate: pred };
  }

  // Dispatch by field family
  const textFamily = new Set<FieldTypeName>(['text', 'long_text', 'url', 'email', 'phone', 'attachment']);
  const numberFamily = new Set<FieldTypeName>(['number', 'currency', 'percent', 'duration', 'rating', 'auto_number']);
  const dateFamily = new Set<FieldTypeName>(['date', 'date_time', 'created_time', 'modified_time']);

  // --- text family ---
  if (textFamily.has(fieldType)) {
    if (op === 'not' || op === 'gt' || op === 'lt') {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput),
      };
    }
    if (op === 'contains') {
      // single value substring
      const want = values[0] ?? '';
      const lowerWant = want.toLowerCase();
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (isEmptyCell(cell)) return false;
        const cellStr = String(cell).toLowerCase();
        return cellStr.includes(lowerWant);
      };
      return { ok: true, predicate: pred };
    }
    // op === 'eq'
    if (values.length === 1) {
      const want = values[0] ?? '';
      const lowerWant = want.toLowerCase();
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (isEmptyCell(cell)) return false;
        return String(cell).toLowerCase() === lowerWant;
      };
      return { ok: true, predicate: pred };
    } else {
      // comma list → containsAny (substring OR)
      const lowerVals = values.map((v) => v.toLowerCase()).filter((v) => v !== '');
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (isEmptyCell(cell)) return false;
        const cellStr = String(cell).toLowerCase();
        return lowerVals.some((v) => cellStr.includes(v));
      };
      return { ok: true, predicate: pred };
    }
  }

  // --- single_select ---
  if (fieldType === 'single_select') {
    if (op === 'contains' || op === 'gt' || op === 'lt') {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for single_select field "${field.name}"`, term.position, rawInput),
      };
    }
    if (op === 'not') {
      const raw = values[0] ?? '';
      const resolved = resolveOptionId(raw, field);
      // if unresolved, treat as match-all (since no row has unknown ID) → true for all rows
      // To be consistent with De Morgan, we treat unknown not as true.
      if (resolved === null) {
        // unknown option name: no row has it, so "not unknown" is true for all
        const pred: Predicate = () => true;
        return { ok: true, predicate: pred };
      }
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        // null/empty considered not equal to resolved, so matches
        if (isEmptyCell(cell)) return true;
        return String(cell) !== resolved;
      };
      return { ok: true, predicate: pred };
    }
    // op eq
    if (values.length === 1) {
      const resolved = resolveOptionId(values[0] ?? '', field);
      if (resolved === null) {
        // unknown option → matches none
        const pred: Predicate = () => false;
        return { ok: true, predicate: pred };
      }
      const pred: Predicate = (row) => String(row.values[field.id] ?? '') === resolved;
      return { ok: true, predicate: pred };
    } else {
      // isAnyOf
      const resolvedIds = values.map((v) => resolveOptionId(v, field)).filter((id): id is string => id !== null);
      if (resolvedIds.length === 0) {
        const pred: Predicate = () => false;
        return { ok: true, predicate: pred };
      }
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (isEmptyCell(cell)) return false;
        return resolvedIds.includes(String(cell));
      };
      return { ok: true, predicate: pred };
    }
  }

  // --- multi_select ---
  if (fieldType === 'multi_select') {
    if (op === 'contains' || op === 'not' || op === 'gt' || op === 'lt') {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for multi_select field "${field.name}"`, term.position, rawInput),
      };
    }
    // op eq
    if (values.length === 1) {
      const resolved = resolveOptionId(values[0] ?? '', field);
      if (resolved === null) {
        const pred: Predicate = () => false;
        return { ok: true, predicate: pred };
      }
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (!Array.isArray(cell)) return false;
        return (cell as string[]).includes(resolved);
      };
      return { ok: true, predicate: pred };
    } else {
      // containsAny across options
      const resolvedIds = values.map((v) => resolveOptionId(v, field)).filter((id): id is string => id !== null);
      if (resolvedIds.length === 0) {
        const pred: Predicate = () => false;
        return { ok: true, predicate: pred };
      }
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (!Array.isArray(cell)) return false;
        return (cell as string[]).some((id) => resolvedIds.includes(id));
      };
      return { ok: true, predicate: pred };
    }
  }

  // --- checkbox ---
  if (fieldType === 'checkbox') {
    if (op === 'contains' || op === 'not' || op === 'gt' || op === 'lt') {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for checkbox field "${field.name}"`, term.position, rawInput),
      };
    }
    // op eq (single or multi)
    // For checkbox, values like "true"/"false" case-insensitive
    const bools: boolean[] = [];
    for (const raw of values) {
      const b = parseCheckboxQueryValue(raw);
      if (b === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid boolean value "${raw}" for checkbox field "${field.name}"`, term.position, rawInput),
        };
      }
      bools.push(b);
    }
    if (bools.length === 1) {
      const want = bools[0];
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (cell === null || cell === undefined) return false;
        return cell === want;
      };
      return { ok: true, predicate: pred };
    } else {
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (cell === null || cell === undefined) return false;
        return bools.includes(cell as boolean);
      };
      return { ok: true, predicate: pred };
    }
  }

  // --- number family ---
  if (numberFamily.has(fieldType)) {
    if (op === 'contains' || op === 'not') {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput),
      };
    }
    if (op === 'gt' || op === 'lt') {
      const raw = values[0] ?? '';
      const parsed = parseNumericQueryValue(raw, fieldType);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid number "${raw}" for field "${field.name}"`, term.position, rawInput),
        };
      }
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (typeof cell !== 'number' || !Number.isFinite(cell)) return false;
        return op === 'gt' ? (cell as number) > parsed : (cell as number) < parsed;
      };
      return { ok: true, predicate: pred };
    }
    // op eq
    const parsedVals: number[] = [];
    for (const raw of values) {
      if (raw === '') {
        // empty string inside eq list should be treated as empty? but we already handled single empty case
        // For multi list containing empty string, treat as empty check? We'll consider not valid — but for now skip
        continue;
      }
      const parsed = parseNumericQueryValue(raw, fieldType);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid number "${raw}" for field "${field.name}"`, term.position, rawInput),
        };
      }
      parsedVals.push(parsed);
    }
    if (parsedVals.length === 0) {
      // all values were empty? treat as empty check
      const pred: Predicate = (row) => isEmptyCell(row.values[field.id]);
      return { ok: true, predicate: pred };
    }
    if (parsedVals.length === 1) {
      const want = parsedVals[0];
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (typeof cell !== 'number') return false;
        return cell === want;
      };
      return { ok: true, predicate: pred };
    } else {
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (typeof cell !== 'number') return false;
        return parsedVals.includes(cell as number);
      };
      return { ok: true, predicate: pred };
    }
  }

  // --- date family ---
  if (dateFamily.has(fieldType)) {
    if (op === 'contains' || op === 'not') {
      return {
        ok: false,
        error: makeQueryError(`"${op}" operator not valid for ${fieldType} field "${field.name}"`, term.position, rawInput),
      };
    }
    const isDateOnly = fieldType === 'date';
    if (op === 'gt' || op === 'lt') {
      const raw = values[0] ?? '';
      const parsed = parseDateValue(raw, isDateOnly);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput),
        };
      }
      const parsedTime = new Date(parsed).getTime();
      const pred: Predicate = (row) => {
        const cell = row.values[field.id];
        if (typeof cell !== 'string') return false;
        const cellTime = new Date(cell as string).getTime();
        if (isNaN(cellTime) || isNaN(parsedTime)) return false;
        return op === 'gt' ? cellTime > parsedTime : cellTime < parsedTime;
      };
      return { ok: true, predicate: pred };
    }
    // op eq
    // For date eq we do exact string equality after normalizing via parseDateValue? But we need to handle both exact and OR.
    // We'll normalize query values via parseDateValue and compare normalized strings.
    const parsedVals: string[] = [];
    for (const raw of values) {
      if (raw === '') continue;
      const parsed = parseDateValue(raw, isDateOnly);
      if (parsed === null) {
        return {
          ok: false,
          error: makeQueryError(`Invalid date "${raw}" for field "${field.name}"`, term.position, rawInput),
        };
      }
      parsedVals.push(parsed);
    }
    if (parsedVals.length === 0) {
      const pred: Predicate = (row) => isEmptyCell(row.values[field.id]);
      return { ok: true, predicate: pred };
    }
    if (parsedVals.length === 1) {
      const want = parsedVals[0];
      // For date_only, compare normalized string; for date_time, compare via time equality?
      // We'll compare via time equality for both to be robust against ISO variations.
      const wantTime = new Date(want).getTime();
      if (isDateOnly) {
        const pred: Predicate = (row) => {
          const cell = row.values[field.id];
          if (typeof cell !== 'string') return false;
          return cell === want;
        };
        return { ok: true, predicate: pred };
      } else {
        const pred: Predicate = (row) => {
          const cell = row.values[field.id];
          if (typeof cell !== 'string') return false;
          const cellTime = new Date(cell as string).getTime();
          return cellTime === wantTime;
        };
        return { ok: true, predicate: pred };
      }
    } else {
      if (isDateOnly) {
        const set = new Set(parsedVals);
        const pred: Predicate = (row) => {
          const cell = row.values[field.id];
          if (typeof cell !== 'string') return false;
          return set.has(cell as string);
        };
        return { ok: true, predicate: pred };
      } else {
        const wantTimes = new Set(parsedVals.map((s) => new Date(s).getTime()));
        const pred: Predicate = (row) => {
          const cell = row.values[field.id];
          if (typeof cell !== 'string') return false;
          const ct = new Date(cell as string).getTime();
          return wantTimes.has(ct);
        };
        return { ok: true, predicate: pred };
      }
    }
  }

  // Fallback: unknown type → error
  return {
    ok: false,
    error: makeQueryError(`Unsupported field type "${fieldType}" for field "${field.name}"`, term.position, rawInput),
  };
}

export function compilePredicate(
  ast: QueryAST,
  fields: FieldDefinition[],
): { ok: true; predicate: Predicate } | { ok: false; error: QueryError } {
  const fieldMap = getFieldMap(fields);
  const preds: Predicate[] = [];
  for (const term of ast.terms) {
    const field = fieldMap.get(term.fieldName);
    if (!field) {
      return {
        ok: false,
        error: makeQueryError(`Unknown field: "${term.rawFieldName}"`, term.position, ast.rawInput),
      };
    }
    const compiled = compileTerm(term, field, ast.rawInput);
    if (!compiled.ok) return compiled;
    preds.push(compiled.predicate);
  }
  const combined: Predicate = (row) => preds.every((p) => p(row));
  return { ok: true, predicate: combined };
}

export function evaluateQuery(
  ast: QueryAST,
  rows: Row[],
  fields: FieldDefinition[],
  _options?: EvaluateOptions,
): EvaluationResult {
  const compiled = compilePredicate(ast, fields);
  if (!compiled.ok) return { ok: false, error: compiled.error };
  const matched: Row[] = [];
  const matchedIds: string[] = [];
  for (const row of rows) {
    if (compiled.predicate(row)) {
      matched.push(row);
      matchedIds.push(row.id);
    }
  }
  return { ok: true, rows: matched, matchedIds };
}
