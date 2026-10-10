// P7-05 — Airtable ↔ Tablify field type mapping (T-U: one test per type, plus unsupported types).
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { join } from 'path';
import {
  FIELD_TYPE_MAP,
  UNSUPPORTED_AIRTABLE_TYPES,
  mapField,
  mapTable,
  optionColorFor,
  tablifyFieldIdFor,
} from '../../src/sync/fieldMap.js';
import type { AirtableFieldSchema, AirtableTableSchema } from '../../src/sync/airtableClient.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { isReadOnly } from '../../src/views/grid/editors/index.js';
import type { FieldDefinition } from '../../src/model/types.js';

function af(id: string, name: string, type: string, options?: unknown): AirtableFieldSchema {
  return { id, name, type, options };
}

function table(fields: AirtableFieldSchema[], primaryFieldId = fields[0]?.id ?? 'fldNONE'): AirtableTableSchema {
  return { id: 'tblTEST000000001', name: 'T', primaryFieldId, fields };
}

describe('supported types: one test each (T-U)', () => {
  for (const [airtableType, rule] of Object.entries(FIELD_TYPE_MAP)) {
    it(`${airtableType} → ${rule.tablify}${rule.readOnly ? ' (read-only)' : ''}`, () => {
      const { def, info } = mapField(af('fldX1', 'Col', airtableType), null);
      expect(def.type).toBe(rule.tablify);
      expect(info.supported).toBe(true);
      expect(info.readOnly).toBe(rule.readOnly);
      expect(def.airtable).toEqual({ id: 'fldX1', type: airtableType, readOnly: rule.readOnly });
    });
  }

  it('covers the 19 Tablify types between them (no Tablify type left without an Airtable source)', () => {
    const used = new Set(Object.values(FIELD_TYPE_MAP).map((r) => r.tablify));
    for (const t of ['text', 'long_text', 'number', 'currency', 'percent', 'duration', 'rating', 'checkbox', 'date', 'date_time', 'url', 'email', 'phone', 'single_select', 'multi_select', 'auto_number', 'created_time', 'modified_time']) {
      expect(used.has(t as never), `missing ${t}`).toBe(true);
    }
  });

  it('single select keeps option names and maps colours', () => {
    const { def } = mapField(
      af('fldS', 'Status', 'singleSelect', {
        choices: [
          { id: 'selA', name: 'Todo', color: 'blueLight2' },
          { id: 'selB', name: 'Done', color: 'greenBright' },
          { id: 'selC', name: 'Odd', color: 'mauve' },
        ],
      }),
      null,
    );
    expect(def.options).toEqual([
      { id: 'opt_selA', name: 'Todo', color: 'blue' },
      { id: 'opt_selB', name: 'Done', color: 'green' },
      { id: 'opt_selC', name: 'Odd', color: 'gray' },
    ]);
  });

  it('multiple selects get options too', () => {
    const { def } = mapField(af('fldM', 'Tags', 'multipleSelects', { choices: [{ id: 'selX', name: 'x' }] }), null);
    expect(def.type).toBe('multi_select');
    expect(def.options?.[0]).toEqual({ id: 'opt_selX', name: 'x', color: 'gray' });
  });

  it('rating above 10 is read-only, rating up to 10 is writable', () => {
    expect(mapField(af('fldR', 'R', 'rating', { max: 5 }), null).info.readOnly).toBe(false);
    const big = mapField(af('fldR', 'R', 'rating', { max: 11 }), null).info;
    expect(big.readOnly).toBe(true);
    expect(big.reason).toContain('above 10');
  });

  it('option colour families', () => {
    expect(optionColorFor('cyanBright')).toBe('blue');
    expect(optionColorFor('tealLight1')).toBe('blue');
    expect(optionColorFor('redDark1')).toBe('red');
    expect(optionColorFor(undefined)).toBe('gray');
    expect(optionColorFor(42)).toBe('gray');
  });
});

describe('unsupported types are shown, not dropped', () => {
  for (const t of UNSUPPORTED_AIRTABLE_TYPES) {
    it(`${t} → read-only text with its original type name`, () => {
      const { def, info } = mapField(af('fldU', 'Col', t), null);
      expect(info.supported).toBe(false);
      expect(def.type).toBe('text');
      expect(def.airtable).toEqual({ id: 'fldU', type: t, readOnly: true });
      expect(info.reason).toContain(t);
    });
  }

  it('a future Airtable type that Tablify has never seen is kept read-only', () => {
    const { def, info } = mapField(af('fldF', 'New', 'someNewThing'), null);
    expect(info.supported).toBe(false);
    expect(def.airtable?.type).toBe('someNewThing');
    expect(def.airtable?.readOnly).toBe(true);
  });

  it('prototype names are not mistaken for supported types', () => {
    for (const t of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
      const { info } = mapField(af('fldP', 'P', t), null);
      expect(info.supported, t).toBe(false);
    }
  });

  it('the documented unsupported list does not overlap the mapping table', () => {
    for (const t of UNSUPPORTED_AIRTABLE_TYPES) {
      expect(Object.prototype.hasOwnProperty.call(FIELD_TYPE_MAP, t), t).toBe(false);
    }
  });
});

describe('table-level report (check counts)', () => {
  const all: AirtableFieldSchema[] = [
    ...Object.keys(FIELD_TYPE_MAP).map((t, i) => af(`fld${String(i).padStart(4, '0')}`, `F ${t}`, t)),
    ...[...UNSUPPORTED_AIRTABLE_TYPES].map((t, i) => af(`fldU${String(i).padStart(3, '0')}`, `U ${t}`, t)),
    af('fldFUT01', 'Future', 'futureType'),
  ];

  it('no field is dropped: fields = input, mapped + unmapped = total, IDs unique', () => {
    const res = mapTable(table(all));
    expect(res.fields).toHaveLength(all.length);
    expect(res.mapped.length + res.unmapped.length).toBe(all.length);
    expect(res.unmapped.length).toBe(UNSUPPORTED_AIRTABLE_TYPES.size + 1);
    const ids = res.fields.map((f) => f.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(id).toMatch(/^fld_[A-Za-z0-9_]+$/);
  });

  it('exactly one primary field; it is Airtable\u2019s primary field', () => {
    const res = mapTable(table(all, 'fld0003'));
    const primaries = res.fields.filter((f) => f.primary);
    expect(primaries).toHaveLength(1);
    expect(primaries[0].airtable?.id).toBe('fld0003');
  });

  it('a missing Airtable primary falls back to the first field, so the table stays valid', () => {
    const res = mapTable(table(all.slice(0, 3), 'fldGONE'));
    expect(res.primaryAirtableId).toBeNull();
    expect(res.fields.filter((f) => f.primary)).toHaveLength(1);
    expect(res.fields[0].primary).toBe(true);
  });

  it('colliding derived IDs get a numeric suffix instead of overwriting each other', () => {
    // Airtable IDs are unique, but two different IDs can derive the same Tablify ID.
    const res = mapTable(table([af('fld-A', 'One', 'singleLineText'), af('fld_A', 'Two', 'singleLineText')]));
    expect(res.fields.map((f) => f.id)).toEqual(['fld__A', 'fld__A_2']);
  });

  it('ID derivation is stable', () => {
    expect(tablifyFieldIdFor('fldABC123')).toBe('fld_ABC123');
    expect(tablifyFieldIdFor('fldABC123')).toBe(tablifyFieldIdFor('fldABC123'));
  });

  it('the mapped fields pass the format parser (round trip through .tablify)', () => {
    const res = mapTable(table(all));
    const base = parse(readFileSync(join(process.cwd(), 'samples', 'v1', 'empty.tablify'), 'utf-8'));
    if (!base.ok) throw new Error('fixture');
    const file = { ...base.data, fields: res.fields, rows: [], views: [{ ...base.data.views[0], hidden: [], order: res.fields.map((f) => f.id) }] };
    const text = serialize(file as typeof base.data);
    const again = parse(text);
    expect(again.ok, again.ok ? '' : again.error).toBe(true);
  });
});

describe('editing rules follow the mapping', () => {
  it('an Airtable read-only field is read-only in the grid, even as a plain text column', () => {
    const { def } = mapField(af('fldRO', 'Formula', 'formula'), null);
    expect(isReadOnly(def as FieldDefinition)).toBe(true);
  });

  it('a writable Airtable field stays editable', () => {
    const { def } = mapField(af('fldRW', 'Name', 'singleLineText'), null);
    expect(isReadOnly(def as FieldDefinition)).toBe(false);
  });
});
