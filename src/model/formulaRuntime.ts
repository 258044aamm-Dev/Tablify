/**
 * Bridge between the table model and the formula engine (P8-03, SAD-62).
 *
 * - Only tables with a formula field get an engine. Plain tables never build one, so they
 *   cannot be affected by this code.
 * - The engine is rebuilt when the field set, a formula, or the row set changes. Otherwise
 *   only cells whose stored value changed are pushed in (setInput), so undo and redo also update
 *   dependents.
 * - Results are display-only. They are never written to row.values or the file.
 * - No Obsidian imports. Pure, so it is unit-tested directly.
 */
import { FormulaEngine, formatDate, formatMinute, parseDateText, type ErrorCode, type FieldSpec, type RowSpec, type Value } from '../formula/index.js';
import { BLANK } from '../formula/value.js';
import type { CellValue, FieldDefinition } from './types.js';
import type { TableStore } from './tableStore.js';

/** One-line reason for each error code, shown in the cell tooltip (spec §12). */
export const ERROR_MESSAGES: Readonly<Record<ErrorCode, string>> = {
  '#PARSE!': 'The formula has a syntax error.',
  '#NAME?': 'The formula uses an unknown field or function.',
  '#ARGS!': 'A function got the wrong number of arguments.',
  '#TYPE!': 'A value has the wrong type.',
  '#VALUE!': 'A value cannot be used here.',
  '#DIV/0!': 'Division by zero.',
  '#NUM!': 'A number is out of range.',
  '#OVERFLOW!': 'The result is too large.',
  '#CYCLE!': 'This formula depends on itself.',
};

export interface FormulaError {
  code: ErrorCode;
  message: string;
}

export interface FormulaRuntime {
  /** Bring the engine in line with the store. Cheap when nothing has changed. */
  sync(): void;
  hasFormulaFields(): boolean;
  /** Display value of a formula cell (null for other fields or unknown cells). */
  displayValue(rowId: string, fieldId: string): CellValue;
  /** Error state of a formula cell, or null. */
  error(rowId: string, fieldId: string): FormulaError | null;
  cycleFieldIds(): string[];
}

/** Map a stored cell to an engine input value. Dates and times use the local zone. */
export function cellToValue(field: FieldDefinition, cell: CellValue | undefined): Value {
  const v = cell ?? null;
  if (v === null) return BLANK;
  switch (field.type) {
    case 'number':
    case 'currency':
    case 'percent':
    case 'duration':
    case 'rating':
    case 'auto_number':
      return typeof v === 'number' ? { t: 'num', v } : BLANK;
    case 'checkbox':
      return typeof v === 'boolean' ? { t: 'bool', v } : BLANK;
    case 'date': {
      if (typeof v !== 'string') return BLANK;
      const p = parseDateText(v);
      return p ? { t: 'date', y: p.y, m: p.m, d: p.d } : BLANK;
    }
    case 'date_time':
    case 'created_time':
    case 'modified_time': {
      if (typeof v !== 'string') return BLANK;
      const ms = Date.parse(v);
      return Number.isNaN(ms) ? BLANK : { t: 'dt', ms };
    }
    case 'single_select': {
      if (typeof v !== 'string') return BLANK;
      const opt = field.options?.find((o) => o.id === v);
      return opt ? { t: 'text', v: opt.name } : BLANK;
    }
    case 'multi_select': {
      if (!Array.isArray(v)) return BLANK;
      const names = (v as string[]).map((id) => field.options?.find((o) => o.id === id)?.name ?? '');
      return { t: 'text', v: names.filter((n) => n !== '').join(', ') };
    }
    case 'link':
      // FORMAT_SPEC §12 / formula-spec §12: a link reference is #VALUE! in v2.
      return { t: 'err', code: '#VALUE!' };
    case 'attachment':
      return Array.isArray(v) ? { t: 'text', v: (v as string[]).join(', ') } : BLANK;
    default:
      return typeof v === 'string' ? { t: 'text', v } : BLANK;
  }
}

/** Map an engine result to a display cell value. Errors become their code text. */
export function valueToCell(v: Value): CellValue {
  switch (v.t) {
    case 'blank':
      return null;
    case 'num':
      return v.v;
    case 'text':
      return v.v;
    case 'bool':
      return v.v;
    case 'date':
      return formatDate(v.y, v.m, v.d);
    case 'dt':
      return formatMinute(v.ms);
    case 'err':
      return v.code;
  }
}

export function createFormulaRuntime(store: TableStore): FormulaRuntime {
  let engine: FormulaEngine | null = null;
  let signature = '';
  /** rowId -> fieldId -> JSON of the cell last pushed into the engine */
  let shadow = new Map<string, Map<string, string>>();

  const formulaFieldsOf = (): FieldDefinition[] =>
    (store.getFields() as FieldDefinition[]).filter((f) => f.type === 'formula');

  function computeSignature(): string {
    const fields = (store.getFields() as FieldDefinition[]).map((f) => [f.id, f.name, f.type, f.formula ?? null]);
    const rowIds = store.getAllRows().map((r) => r.id);
    return JSON.stringify([fields, rowIds]);
  }

  function build(): void {
    const fields = store.getFields() as FieldDefinition[];
    const specs: FieldSpec[] = fields.map((f) =>
      f.type === 'formula' ? { id: f.id, name: f.name, formula: f.formula ?? '' } : { id: f.id, name: f.name },
    );
    const inputs = fields.filter((f) => f.type !== 'formula');
    const nextShadow = new Map<string, Map<string, string>>();
    const rows: RowSpec[] = store.getAllRows().map((r) => {
      const values: Record<string, Value> = {};
      const seen = new Map<string, string>();
      for (const f of inputs) {
        const cell = r.values[f.id] ?? null;
        values[f.id] = cellToValue(f, cell);
        seen.set(f.id, JSON.stringify(cell));
      }
      nextShadow.set(r.id, seen);
      const modifiedMs = Date.parse(r.updatedAt);
      const createdMs = Date.parse(r.createdAt ?? r.updatedAt);
      return {
        id: r.id,
        createdMs: Number.isNaN(createdMs) ? 0 : createdMs,
        modifiedMs: Number.isNaN(modifiedMs) ? 0 : modifiedMs,
        inputs: values,
      };
    });
    shadow = nextShadow;
    engine = new FormulaEngine({ fields: specs, rows, now: () => Date.now() });
    signature = computeSignature();
  }

  return {
    sync(): void {
      if (formulaFieldsOf().length === 0) {
        engine = null;
        shadow = new Map();
        signature = '';
        return;
      }
      if (!engine || computeSignature() !== signature) {
        build();
        return;
      }
      const fields = store.getFields() as FieldDefinition[];
      const inputs = fields.filter((f) => f.type !== 'formula');
      for (const r of store.getAllRows()) {
        let seen = shadow.get(r.id);
        if (!seen) {
          seen = new Map();
          shadow.set(r.id, seen);
        }
        for (const f of inputs) {
          const cell = r.values[f.id] ?? null;
          const key = JSON.stringify(cell);
          if (seen.get(f.id) === key) continue;
          seen.set(f.id, key);
          engine.setInput(r.id, f.id, cellToValue(f, cell));
        }
      }
    },

    hasFormulaFields(): boolean {
      return engine !== null;
    },

    displayValue(rowId: string, fieldId: string): CellValue {
      if (!engine) return null;
      const field = (store.getFields() as FieldDefinition[]).find((f) => f.id === fieldId);
      if (!field || field.type !== 'formula') return null;
      return valueToCell(engine.value(rowId, fieldId));
    },

    error(rowId: string, fieldId: string): FormulaError | null {
      if (!engine) return null;
      const field = (store.getFields() as FieldDefinition[]).find((f) => f.id === fieldId);
      if (!field || field.type !== 'formula') return null;
      const v = engine.value(rowId, fieldId);
      if (v.t !== 'err') return null;
      return { code: v.code, message: ERROR_MESSAGES[v.code] };
    },

    cycleFieldIds(): string[] {
      return engine ? engine.cycleFieldIds() : [];
    },
  };
}
