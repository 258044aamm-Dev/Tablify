/**
 * @vitest-environment jsdom
 *
 * Filter builder (SAD-78): operators the plugin accepts, exact value round-trips, and the
 * builder ⇄ query-string property on the differential query fixtures (FX-M).
 */

import { describe, it, expect, vi } from 'vitest';
import {
  FilterBuilder,
  builderFromInput,
  decodeListValue,
  decodeSingleValue,
  encodeListValue,
  encodeSingleValue,
  inputFromBuilder,
  isQueryable,
  opsFor,
  queryFromConditions,
  type BuilderOp,
} from '../../src/views/grid/filterBuilder.js';
import { parseQuery, printQuery, type QueryAST, type QueryTerm } from '../../src/query/parse.js';
import { evaluateQuery } from '../../src/query/evaluate.js';
import { splitSearchQuery } from '../../src/query/combined.js';
import { generateFXM, mulberry32, randomChoice, randomInt } from '../query/fixtures.js';
import type { FieldDefinition, FieldTypeName } from '../../src/model/types.js';

const { fields: FXM, rows: FXM_ROWS } = generateFXM();
const ALL_TYPES: FieldTypeName[] = [
  'text', 'long_text', 'number', 'currency', 'percent', 'duration', 'rating', 'checkbox', 'date', 'date_time',
  'url', 'email', 'phone', 'single_select', 'multi_select', 'attachment', 'auto_number', 'created_time', 'modified_time',
];

/** A value the evaluator accepts for a field type. */
function sampleValue(f: FieldDefinition): string {
  if (['number', 'currency', 'percent', 'duration', 'rating', 'auto_number'].includes(f.type)) return '5';
  if (['date', 'created_time', 'modified_time'].includes(f.type)) return '2026-01-02';
  if (f.type === 'date_time') return '2026-01-02T03:04:05Z';
  if (f.type === 'checkbox') return 'true';
  if (f.type === 'single_select' || f.type === 'multi_select') return f.options?.[0]?.name ?? 'x';
  return 'x';
}

const OP_AST: Record<BuilderOp, QueryTerm['op']> = { '': 'eq', '~': 'contains', '!': 'not', '>': 'gt', '<': 'lt', empty: 'empty' };

describe('opsFor: the prototype lists, limited to what the evaluator accepts', () => {
  it.each(ALL_TYPES)('every operator offered for %s compiles', (type) => {
    const field: FieldDefinition = {
      id: 'fld_x',
      name: 'X',
      type,
      ...(type.endsWith('select') ? { options: [{ id: 'opt_a', name: 'A', color: 'gray' as const }] } : {}),
    };
    for (const [op] of opsFor(type)) {
      const q = queryFromConditions([{ fieldId: 'fld_x', op, value: op === 'empty' ? '' : sampleValue(field) }], [field]);
      const parsed = parseQuery(q);
      expect(parsed.ok, `${type} ${op}: ${q}`).toBe(true);
      if (parsed.ok) expect(evaluateQuery(parsed.ast, [], [field]).ok, `${type} ${op}: ${q}`).toBe(true);
    }
  });

  it('uses the prototype labels', () => {
    expect(opsFor('single_select')).toEqual([['', 'is'], ['!', 'is not'], ['empty', 'is empty']]);
    expect(opsFor('date')).toEqual([['', 'is'], ['>', 'is after'], ['<', 'is before'], ['empty', 'is empty']]);
    expect(opsFor('multi_select')[0]).toEqual(['', 'contains any of']);
    expect(opsFor('number').map(([, l]) => l)).toEqual(['=', '>', '<', 'is empty']);
    expect(opsFor('text').map(([, l]) => l)).toEqual(['is', 'contains', 'is empty']);
  });

  it('drops the prototype operators the plugin rejects (text "is not", multi "does not contain", number "≠")', () => {
    expect(opsFor('text').some(([op]) => op === '!')).toBe(false);
    expect(opsFor('multi_select').some(([op]) => op === '!')).toBe(false);
    expect(opsFor('number').some(([op]) => op === '!')).toBe(false);
  });

  it('formula and link fields are not queryable', () => {
    expect(isQueryable({ id: 'a', name: 'F', type: 'formula' })).toBe(false);
    expect(isQueryable({ id: 'b', name: 'L', type: 'link' })).toBe(false);
    expect(isQueryable({ id: 'c', name: 'T', type: 'text' })).toBe(true);
  });
});

describe('value encoding is exact', () => {
  it.each([['a'], ['a b'], ['a,b'], ['say "hi"'], [' padded '], [''], ['ü,ö']])('list value %j', (v) => {
    expect(decodeListValue(encodeListValue(v))).toEqual([v]);
  });

  it('lists split on commas outside quotes and trim unquoted items', () => {
    expect(decodeListValue('a, b ,c')).toEqual(['a', 'b', 'c']);
    expect(decodeListValue('"a,b", c')).toEqual(['a,b', 'c']);
    expect(decodeListValue('a,,b')).toEqual(['a', 'b']);
    expect(decodeListValue('  ')).toEqual([]);
  });

  it.each([['ship'], ['a,b'], [' padded '], ['"quoted"'], ['x"y']])('single value %j', (v) => {
    expect(decodeSingleValue(encodeSingleValue(v))).toBe(v);
  });

  it('a typed single value is trimmed; only a fully quoted one is taken literally', () => {
    expect(decodeSingleValue('  ship ')).toBe('ship');
    expect(decodeSingleValue('" ship "')).toBe(' ship ');
    expect(decodeSingleValue('"a" "b"')).toBe('"a" "b"');
  });
});

describe('builderFromInput / inputFromBuilder', () => {
  it('reads terms into rows and keeps the free search words', () => {
    const st = builderFromInput('ship Status:Done Count:>5 boat', FXM);
    expect(st.search).toBe('ship boat');
    expect(st.conditions).toEqual([
      { fieldId: 'fld_status', op: '', value: 'Done' },
      { fieldId: 'fld_count', op: '>', value: '5' },
    ]);
    expect(inputFromBuilder(st, FXM)).toBe('ship boat Status:Done Count:>5');
  });

  it('starts with one blank row when there are no terms (prototype)', () => {
    const st = builderFromInput('', FXM);
    expect(st.conditions).toEqual([{ fieldId: 'fld_name', op: '', value: '' }]);
    expect(inputFromBuilder(st, FXM)).toBe('');
  });

  it('"field:" (empty value) reads as "is empty"', () => {
    expect(builderFromInput('Due:', FXM).conditions).toEqual([{ fieldId: 'fld_due', op: 'empty', value: '' }]);
  });

  it('keeps terms on unknown fields verbatim instead of remapping them', () => {
    const st = builderFromInput('Nope:1 Status:Done', FXM);
    expect(st.kept).toEqual(['Nope:1']);
    expect(st.conditions).toHaveLength(1);
    expect(inputFromBuilder(st, FXM)).toBe('Status:Done Nope:1');
  });

  it('flags an unreadable query (Apply replaces it) but keeps the search words', () => {
    const st = builderFromInput('ship Count:>', FXM);
    expect(st.unreadable).toBe(true);
    expect(st.search).toBe('ship');
  });

  it('keeps an operator the type list does not offer, rather than rewriting the query', () => {
    const st = builderFromInput('Name:!x', FXM); // invalid for text, but it is the user's query
    expect(st.conditions[0].op).toBe('!');
    expect(inputFromBuilder(st, FXM)).toBe('Name:!x');
  });

  it('quotes field names and values like the grammar requires', () => {
    const fields: FieldDefinition[] = [{ id: 'f1', name: 'Estimate (h)', type: 'number' }, { id: 'f2', name: 'Task', type: 'text' }];
    const q = queryFromConditions(
      [
        { fieldId: 'f1', op: '>', value: '5' },
        { fieldId: 'f2', op: '', value: 'Write docs, "a,b"' },
        { fieldId: 'f2', op: '~', value: 'grid view' },
      ],
      fields,
    );
    expect(q).toBe('"Estimate (h)":>5 Task:"Write docs","a,b" Task:~"grid view"');
    const parsed = parseQuery(q);
    expect(parsed.ok).toBe(true);
    if (parsed.ok) expect(parsed.ast.terms[1].values).toEqual(['Write docs', 'a,b']);
  });

  it('skips unfinished rows (no value) and rows on missing fields', () => {
    expect(
      queryFromConditions(
        [
          { fieldId: 'fld_name', op: '~', value: '  ' },
          { fieldId: 'fld_gone', op: '', value: 'x' },
          { fieldId: 'fld_due', op: 'empty', value: '' },
        ],
        FXM,
      ),
    ).toBe('Due:empty');
  });
});

describe('round trip on the differential fixtures (property, seeded)', () => {
  const POOL = ['ship', 'Name1 ship', 'a,b', ' padded ', 'say "hi"', 'Done', 'Todo', 'urgent', '5', '10.5', '2026-03-04', 'true', 'false', 'ü'];

  function randomTerm(rand: () => number): QueryTerm {
    const field = randomChoice(rand, FXM.filter(isQueryable));
    // Mostly operators the builder offers, sometimes any operator (kept as-is).
    const offered = opsFor(field.type).map(([op]) => op);
    const bop: BuilderOp = rand() < 0.85 ? randomChoice(rand, offered) : randomChoice(rand, ['', '~', '!', '>', '<', 'empty'] as const);
    const op = OP_AST[bop];
    let values: string[] = [];
    if (op === 'eq') values = Array.from({ length: randomInt(rand, 1, 3) }, () => randomChoice(rand, POOL));
    else if (op !== 'empty') values = [randomChoice(rand, POOL)];
    return { fieldName: field.name.toLowerCase(), rawFieldName: field.name, op, values, raw: '', position: 0 };
  }

  const shape = (ast: QueryAST) =>
    ast.terms.map((t) => {
      const empty = t.op === 'empty' || (t.op === 'eq' && t.values.length === 1 && t.values[0] === '');
      return [t.fieldName, empty ? 'empty' : t.op, empty ? [] : t.values];
    });

  it('box → builder → Apply yields the same terms and selects the same rows', () => {
    const rand = mulberry32(7802);
    let compared = 0;
    for (let iter = 0; iter < 400; iter++) {
      const ast: QueryAST = { terms: Array.from({ length: randomInt(rand, 1, 3) }, () => randomTerm(rand)), rawInput: '' };
      const words = rand() < 0.5 ? randomChoice(rand, ['ship', 'boat car', '']) : '';
      const input = [words, printQuery(ast)].filter(Boolean).join(' ');

      const out = inputFromBuilder(builderFromInput(input, FXM), FXM);
      const a = splitSearchQuery(input);
      const b = splitSearchQuery(out);
      expect(b.search, input).toBe(a.search);

      const pa = parseQuery(a.query);
      const pb = parseQuery(b.query);
      expect(pa.ok, input).toBe(true);
      expect(pb.ok, `${input} → ${out}`).toBe(true);
      if (!pa.ok || !pb.ok) continue;
      expect(shape(pb.ast), `${input} → ${out}`).toEqual(shape(pa.ast));

      const ea = evaluateQuery(pa.ast, FXM_ROWS, FXM);
      const eb = evaluateQuery(pb.ast, FXM_ROWS, FXM);
      expect(eb.ok, out).toBe(ea.ok);
      if (ea.ok && eb.ok) {
        expect(eb.matchedIds, out).toEqual(ea.matchedIds);
        compared++;
      }
    }
    expect(compared, 'enough valid queries were compared row-for-row').toBeGreaterThan(100);
  });

  it('builder → query → builder is stable for every operator offered on every FX-M field', () => {
    for (const field of FXM.filter(isQueryable)) {
      for (const [op] of opsFor(field.type)) {
        const value = op === 'empty' ? '' : field.type.endsWith('select') ? (field.options?.[0]?.name ?? '') : sampleValue(field);
        const q = queryFromConditions([{ fieldId: field.id, op, value }], FXM);
        const back = builderFromInput(q, FXM).conditions;
        expect(back, `${field.name} ${op}`).toEqual([{ fieldId: field.id, op, value }]);
      }
    }
  });
});

describe('FilterBuilder DOM', () => {
  const mount = (input = '', fields = FXM) => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    const fb = new FilterBuilder(fields, input, { onApply, onCancel });
    document.body.appendChild(fb.root);
    return { fb, onApply, onCancel };
  };
  const rows = (fb: FilterBuilder) => [...fb.root.querySelectorAll<HTMLElement>('[data-testid="tablify-fb-row"]')];
  const preview = (fb: FilterBuilder) => fb.root.querySelector('[data-testid="tablify-fb-preview"]')?.textContent;
  const click = (fb: FilterBuilder, action: string) => fb.root.querySelector<HTMLElement>(`[data-action="${action}"]`)?.click();

  it('renders Where / and rows, the preview and the prototype buttons', () => {
    const { fb } = mount('Status:Done Count:>5');
    expect(rows(fb).map((r) => r.querySelector('.tablify__fb-join')?.textContent)).toEqual(['Where', 'and']);
    expect(preview(fb)).toBe('Status:Done Count:>5');
    expect([...fb.root.querySelectorAll('.tablify__fb-footer button')].map((b) => b.textContent)).toEqual([
      'Clear all',
      'Cancel',
      'Apply filter',
    ]);
    expect(fb.root.textContent).not.toMatch(/spec|§|Feature|simulated/i);
  });

  it('lists only queryable fields', () => {
    const fields: FieldDefinition[] = [...FXM, { id: 'fld_f', name: 'Calc', type: 'formula', formula: '1' }];
    const { fb } = mount('', fields);
    const names = [...rows(fb)[0].querySelectorAll('.tablify__fb-field option')].map((o) => o.textContent);
    expect(names).not.toContain('Calc');
    expect(names).toContain('Status');
  });

  it('a select field gets an option dropdown; checkbox gets true/false', () => {
    const { fb } = mount('Status:Done Active:false');
    const [r1, r2] = rows(fb);
    expect([...r1.querySelectorAll('select.tablify__fb-value option')].map((o) => o.textContent)).toEqual(['—', 'Todo', 'Done', 'Progress']);
    expect((r1.querySelector('select.tablify__fb-value') as HTMLSelectElement).value).toBe('Done');
    expect((r2.querySelector('select.tablify__fb-value') as HTMLSelectElement).value).toBe('false');
  });

  it('changing the field resets operator and value', () => {
    const { fb } = mount('Status:Done');
    const sel = rows(fb)[0].querySelector('.tablify__fb-field') as HTMLSelectElement;
    sel.value = 'fld_count';
    sel.dispatchEvent(new Event('change'));
    expect([...rows(fb)[0].querySelectorAll('.tablify__fb-op option')].map((o) => o.textContent)).toEqual(['=', '>', '<', 'is empty']);
    expect(preview(fb)).toBe('(no filter)');
  });

  it('"is empty" hides the value control', () => {
    const { fb } = mount('Due:empty');
    expect(rows(fb)[0].querySelector('.tablify__fb-value')).toBeNull();
  });

  it('typing a value updates the preview live without re-rendering (focus stays)', () => {
    const { fb } = mount('Name:~x');
    const input = rows(fb)[0].querySelector('input.tablify__fb-value') as HTMLInputElement;
    input.focus();
    input.value = 'grid view';
    input.dispatchEvent(new Event('input'));
    expect(preview(fb)).toBe('Name:~"grid view"');
    expect(document.activeElement).toBe(input);
  });

  it('Add condition, remove, Clear all', () => {
    const { fb } = mount('ship Status:Done');
    click(fb, 'fb-add');
    expect(rows(fb)).toHaveLength(2);
    rows(fb)[0].querySelector<HTMLElement>('[data-action="fb-remove"]')?.click();
    expect(rows(fb)).toHaveLength(1);
    click(fb, 'fb-clear');
    expect(rows(fb)).toHaveLength(0);
    expect(fb.root.querySelector('.tablify__fb-empty')?.textContent).toContain('Add condition');
    expect(preview(fb)).toBe('(no filter)');
  });

  it('Apply hands back the box text; Cancel does not', () => {
    const { fb, onApply, onCancel } = mount('ship Status:Done');
    click(fb, 'fb-cancel');
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onApply).not.toHaveBeenCalled();
    click(fb, 'fb-apply');
    expect(onApply).toHaveBeenCalledWith('ship Status:Done');
  });

  it('explains kept and unreadable terms', () => {
    expect(mount('Nope:1').fb.root.querySelector('[data-testid="tablify-fb-note"]')?.textContent).toContain('Nope:1');
    expect(mount('Count:>').fb.root.querySelector('[data-testid="tablify-fb-note"]')?.textContent).toContain('has an error');
    expect(mount('Status:Done').fb.root.querySelector('[data-testid="tablify-fb-note"]')).toBeNull();
  });
});
