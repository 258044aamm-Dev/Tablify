/**
 * Shared helpers for formula tests (P8-02). Golden cases are authored with
 * local-time expectations for Asia/Dhaka (UTC+6, no DST).
 */
import { FormulaEngine, type FieldSpec, type RowSpec } from '../../src/formula/engine';
import { BLANK, parseDateTimeText, partsToMs, type Value } from '../../src/formula/value';
import type { FieldValue } from './golden.cases';

export function parseDateTimeEncoded(s: string): number {
  const p = parseDateTimeText(s.replace(/^datetime:/, ''));
  if (!p) throw new Error(`bad datetime ${s}`);
  return partsToMs(p);
}

export function decodeField(v: FieldValue | undefined): Value {
  if (v === undefined || v === null) return BLANK;
  if (typeof v === 'number') return { t: 'num', v };
  if (typeof v === 'boolean') return { t: 'bool', v };
  if (v.startsWith('date:')) {
    const [y, m, d] = v.slice(5).split('-').map(Number) as [number, number, number];
    return { t: 'date', y, m, d };
  }
  if (v.startsWith('datetime:')) return { t: 'dt', ms: parseDateTimeEncoded(v) };
  return { t: 'text', v };
}

/** Build an engine: one formula field F plus one input field per name, and one row. */
export function singleFormulaEngine(
  formula: string,
  inputs: Record<string, FieldValue> | undefined,
  nowMs: number,
  row: { id: string; createdMs: number; modifiedMs: number },
): { engine: FormulaEngine; rowId: string; fieldId: string } {
  const names = Object.keys(inputs ?? {});
  const fields: FieldSpec[] = names.map((n, i) => ({ id: `in${i}`, name: n }));
  fields.push({ id: 'F', name: 'F', formula });
  const values: Record<string, Value> = {};
  names.forEach((n, i) => {
    values[`in${i}`] = decodeField(inputs![n]);
  });
  const rows: RowSpec[] = [{ id: row.id, createdMs: row.createdMs, modifiedMs: row.modifiedMs, inputs: values }];
  const engine = new FormulaEngine({ fields, rows, now: () => nowMs });
  return { engine, rowId: row.id, fieldId: 'F' };
}

/** Deep value equality (dates compared by components, numbers exactly). */
export function sameValue(a: Value, b: Value): boolean {
  if (a.t !== b.t) return false;
  switch (a.t) {
    case 'blank':
      return true;
    case 'num':
      return a.v === (b as { v: number }).v;
    case 'text':
      return a.v === (b as { v: string }).v;
    case 'bool':
      return a.v === (b as { v: boolean }).v;
    case 'date': {
      const x = b as { y: number; m: number; d: number };
      return a.y === x.y && a.m === x.m && a.d === x.d;
    }
    case 'dt':
      return a.ms === (b as { ms: number }).ms;
    case 'err':
      return a.code === (b as { code: string }).code;
  }
}

export function showValue(v: Value): string {
  switch (v.t) {
    case 'blank':
      return 'blank';
    case 'num':
      return `num:${v.v}`;
    case 'text':
      return `text:${v.v}`;
    case 'bool':
      return `bool:${v.v}`;
    case 'date':
      return `date:${v.y}-${v.m}-${v.d}`;
    case 'dt':
      return `dt:${v.ms}`;
    case 'err':
      return `err:${v.code}`;
  }
}
