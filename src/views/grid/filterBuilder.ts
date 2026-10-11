/**
 * Filter builder (SAD-78, owner decision S-3): the prototype's `#filterModal`
 * (`Prototype/index.html` lines 325-345, `script.js › openFilterBuilder … fbApply`).
 *
 * Rows of field / operator / value that build the *same* query string the user could type —
 * Apply writes it into the "Search or query" box, so the box and the builder always agree.
 * Free search words in the box are carried through untouched (prototype `FBglobal`).
 *
 * Differences from the prototype, all so that Apply can never produce a query the plugin
 * rejects or silently changes:
 * - Operators are the prototype's `fbOpsFor` list **intersected with what the plugin's
 *   evaluator accepts** (src/query/evaluate.ts): text-family fields have no "is not",
 *   multi-select no "does not contain", numbers no "≠". A term already in the box with an
 *   operator outside the list keeps it (shown as an extra choice) instead of being rewritten.
 * - Formula and link fields are not offered: the query grammar does not support them.
 * - Terms on a field name that does not exist are kept verbatim, not remapped to field 1.
 * - The query is printed with the real printer (src/query/parse.ts › printQuery), so quoting
 *   always matches the grammar.
 *
 * Pure DOM, no Obsidian imports: unit-tested in jsdom. FilterBuilderModal hosts it.
 */

import { parseQuery, printQuery, type QueryOp, type QueryTerm } from '../../query/parse.js';
import { joinSearchQuery, splitSearchQuery } from '../../query/combined.js';
import type { FieldDefinition, FieldTypeName } from '../../model/types.js';
import { faIcon } from '../../ui/faIcons.js';

/** Prototype operator codes: '' is "equals / any of", 'empty' is "is empty". */
export type BuilderOp = '' | '~' | '!' | '>' | '<' | 'empty';

export interface Condition {
  fieldId: string;
  op: BuilderOp;
  value: string;
}

export interface BuilderState {
  /** Free search words from the box, preserved as-is. */
  search: string;
  conditions: Condition[];
  /** Terms on unknown fields, printed, appended unchanged on Apply. */
  kept: string[];
  /** True when the box's query part did not parse; Apply replaces it. */
  unreadable: boolean;
}

const NUMBER_TYPES: readonly FieldTypeName[] = ['number', 'currency', 'percent', 'duration', 'rating', 'auto_number'];
const DATE_TYPES: readonly FieldTypeName[] = ['date', 'date_time', 'created_time', 'modified_time'];

/** Fields the query grammar can filter on. */
export function isQueryable(field: FieldDefinition): boolean {
  return field.type !== 'formula' && field.type !== 'link';
}

/** Operators offered for a field type: prototype labels, limited to what evaluate.ts accepts. */
export function opsFor(type: FieldTypeName): Array<[BuilderOp, string]> {
  if (type === 'multi_select') return [['', 'contains any of'], ['empty', 'is empty']];
  if (type === 'single_select') return [['', 'is'], ['!', 'is not'], ['empty', 'is empty']];
  if (type === 'checkbox') return [['', 'is'], ['empty', 'is empty']];
  if (NUMBER_TYPES.includes(type)) return [['', '='], ['>', '>'], ['<', '<'], ['empty', 'is empty']];
  if (DATE_TYPES.includes(type)) return [['', 'is'], ['>', 'is after'], ['<', 'is before'], ['empty', 'is empty']];
  return [['', 'is'], ['~', 'contains'], ['empty', 'is empty']];
}

/** Label for an operator kept from the box that the type's list does not offer. */
const GENERIC_OP_LABEL: Record<BuilderOp, string> = {
  '': 'is',
  '~': 'contains',
  '!': 'is not',
  '>': '>',
  '<': '<',
  empty: 'is empty',
};

const OP_FROM_AST: Record<QueryOp, BuilderOp> = { eq: '', contains: '~', not: '!', gt: '>', lt: '<', empty: 'empty' };
const OP_TO_AST: Record<BuilderOp, QueryOp> = { '': 'eq', '~': 'contains', '!': 'not', '>': 'gt', '<': 'lt', empty: 'empty' };

const norm = (name: string): string => name.trim().toLowerCase();

/*
 * Value text in a row. Rows must carry values *exactly* so Apply never changes the meaning of
 * a query that came from the box. The convention matches the grammar: a value that is empty,
 * has a comma or a quote, or has surrounding spaces is shown quoted with "" escapes.
 * For "is / any of" the text is a comma list (grammar §4); other operators take one value.
 */
const quote = (v: string): string => `"${v.replace(/"/g, '""')}"`;

/** Show one value of an "any of" list. */
export function encodeListValue(v: string): string {
  return v === '' || /[",]/.test(v) || v !== v.trim() ? quote(v) : v;
}

/** Show the single value of a contains / not / > / < condition. */
export function encodeSingleValue(v: string): string {
  return v === '' || v.startsWith('"') || v !== v.trim() ? quote(v) : v;
}

/** Read an "any of" list: commas outside quotes separate; unquoted items are trimmed. */
export function decodeListValue(text: string): string[] {
  const out: string[] = [];
  let i = 0;
  const n = text.length;
  while (i <= n) {
    while (i < n && (text[i] === ' ' || text[i] === '\t')) i++;
    let item = '';
    let quoted = false;
    if (text[i] === '"') {
      quoted = true;
      i++;
      while (i < n) {
        if (text[i] === '"') {
          if (text[i + 1] === '"') {
            item += '"';
            i += 2;
            continue;
          }
          i++;
          break;
        }
        item += text[i++];
      }
      while (i < n && text[i] !== ',') i++; // ignore anything after the closing quote
    } else {
      while (i < n && text[i] !== ',') item += text[i++];
      item = item.trim();
    }
    if (quoted || item !== '') out.push(item);
    i++; // skip the comma (or step past the end)
  }
  return out;
}

/** Read a single value: a fully quoted text is unescaped exactly, anything else is trimmed. */
export function decodeSingleValue(text: string): string {
  const t = text.trim();
  if (t.length >= 2 && t.startsWith('"') && t.endsWith('"')) {
    const inner = t.slice(1, -1);
    // Only when the quotes wrap the whole text (no lone quote inside after "" escapes).
    if (!inner.replace(/""/g, '').includes('"')) return inner.replace(/""/g, '"');
  }
  return t;
}

function blankCondition(fields: FieldDefinition[]): Condition | null {
  const first = fields.find(isQueryable);
  return first ? { fieldId: first.id, op: '', value: '' } : null;
}

/** Read the box text into builder rows (prototype `openFilterBuilder`). */
export function builderFromInput(input: string, fields: FieldDefinition[]): BuilderState {
  const split = splitSearchQuery(input);
  const state: BuilderState = { search: split.search, conditions: [], kept: [], unreadable: false };
  if (split.query.trim()) {
    const parsed = parseQuery(split.query);
    if (!parsed.ok) {
      state.unreadable = true;
    } else {
      for (const term of parsed.ast.terms) {
        const field = fields.find((f) => isQueryable(f) && norm(f.name) === term.fieldName);
        if (!field) {
          state.kept.push(printQuery({ terms: [term], rawInput: '' }));
          continue;
        }
        // `field:` (empty value) evaluates exactly like `field:empty`.
        const isEmpty = term.op === 'empty' || (term.op === 'eq' && term.values.length === 1 && term.values[0] === '');
        state.conditions.push({
          fieldId: field.id,
          op: isEmpty ? 'empty' : OP_FROM_AST[term.op],
          value: isEmpty
            ? ''
            : term.op === 'eq'
              ? term.values.map(encodeListValue).join(', ')
              : encodeSingleValue(term.values[0] ?? ''),
        });
      }
    }
  }
  if (state.conditions.length === 0) {
    const blank = blankCondition(fields);
    if (blank) state.conditions.push(blank);
  }
  return state;
}

/** Build the query string for the rows (prototype `fbBuildQuery`), printed by the real printer. */
export function queryFromConditions(conditions: Condition[], fields: FieldDefinition[]): string {
  const terms: QueryTerm[] = [];
  for (const c of conditions) {
    const field = fields.find((f) => f.id === c.fieldId && isQueryable(f));
    if (!field) continue;
    const base = { fieldName: norm(field.name), rawFieldName: field.name, raw: '', position: 0 };
    if (c.op === 'empty') {
      terms.push({ ...base, op: 'empty', values: [] });
      continue;
    }
    if (!c.value.trim()) continue; // an unfinished row adds nothing (prototype)
    if (c.op === '') {
      // "a, b" = any of (grammar §4). Only equality takes a list.
      const values = decodeListValue(c.value);
      if (values.length === 0) continue;
      // A lone empty value is the `field:` form, which means "is empty".
      if (values.length === 1 && values[0] === '') terms.push({ ...base, op: 'empty', values: [] });
      else terms.push({ ...base, op: 'eq', values });
    } else {
      terms.push({ ...base, op: OP_TO_AST[c.op], values: [decodeSingleValue(c.value)] });
    }
  }
  return printQuery({ terms, rawInput: '' });
}

/** The box text Apply writes: free words first, then the built and kept terms. */
export function inputFromBuilder(state: BuilderState, fields: FieldDefinition[]): string {
  const query = [queryFromConditions(state.conditions, fields), ...state.kept].filter(Boolean).join(' ');
  return joinSearchQuery(state.search, query);
}

export interface FilterBuilderCallbacks {
  onApply(input: string): void;
  onCancel(): void;
}

/** The builder body: rows, Add condition, query preview, Clear all / Cancel / Apply filter. */
export class FilterBuilder {
  readonly root: HTMLElement;
  private readonly body: HTMLElement;
  private readonly preview: HTMLElement;
  private readonly state: BuilderState;

  constructor(
    private readonly fields: FieldDefinition[],
    input: string,
    private readonly callbacks: FilterBuilderCallbacks,
  ) {
    this.state = builderFromInput(input, fields);

    this.root = document.createElement('div');
    this.root.className = 'tablify__fb';
    this.root.dataset.testid = 'tablify-filter-builder';

    if (this.state.unreadable || this.state.kept.length > 0) {
      const note = document.createElement('div');
      note.className = 'tablify__fb-note';
      note.dataset.testid = 'tablify-fb-note';
      note.textContent = this.state.unreadable
        ? 'The query in the search box has an error, so it is not shown here. Applying replaces it.'
        : `${this.state.kept.length === 1 ? 'A condition' : `${this.state.kept.length} conditions`} on a field this table does not have ${this.state.kept.length === 1 ? 'is' : 'are'} kept as typed: ${this.state.kept.join(' ')}`;
      this.root.appendChild(note);
    }

    this.body = document.createElement('div');
    this.body.className = 'tablify__fb-body';
    this.root.appendChild(this.body);

    const add = document.createElement('button');
    add.type = 'button';
    add.className = 'tablify__fb-add';
    add.dataset.action = 'fb-add';
    add.innerHTML = `<span class="tablify__fb-add-icon" aria-hidden="true">${faIcon('plus')}</span>Add condition`;
    add.addEventListener('click', () => {
      const blank = blankCondition(this.fields);
      if (blank) this.state.conditions.push(blank);
      this.render();
    });
    this.root.appendChild(add);

    const previewBox = document.createElement('div');
    previewBox.className = 'tablify__fb-preview';
    const previewLabel = document.createElement('div');
    previewLabel.className = 'tablify__fb-preview-label';
    previewLabel.textContent = 'Equivalent query string';
    this.preview = document.createElement('div');
    this.preview.className = 'tablify__fb-preview-text';
    this.preview.dataset.testid = 'tablify-fb-preview';
    previewBox.appendChild(previewLabel);
    previewBox.appendChild(this.preview);
    this.root.appendChild(previewBox);

    const footer = document.createElement('div');
    footer.className = 'tablify__fb-footer';
    const clear = this.footerButton('fb-clear', 'Clear all', 'tablify__fb-clear');
    clear.addEventListener('click', () => {
      this.state.conditions = [];
      this.state.kept = [];
      this.state.search = '';
      this.state.unreadable = false;
      this.root.querySelector('.tablify__fb-note')?.remove();
      this.render();
    });
    const right = document.createElement('div');
    right.className = 'tablify__fb-footer-right';
    const cancel = this.footerButton('fb-cancel', 'Cancel', 'tablify__fb-cancel');
    cancel.addEventListener('click', () => this.callbacks.onCancel());
    const apply = this.footerButton('fb-apply', 'Apply filter', 'tablify__fb-apply');
    apply.addEventListener('click', () => this.callbacks.onApply(this.currentInput()));
    right.appendChild(cancel);
    right.appendChild(apply);
    footer.appendChild(clear);
    footer.appendChild(right);
    this.root.appendChild(footer);

    this.render();
  }

  /** The box text the current rows produce. */
  currentInput(): string {
    return inputFromBuilder(this.state, this.fields);
  }

  private footerButton(action: string, label: string, cls: string): HTMLButtonElement {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `tablify__fb-button ${cls}`;
    b.dataset.action = action;
    b.textContent = label;
    return b;
  }

  private queryableFields(): FieldDefinition[] {
    return this.fields.filter(isQueryable);
  }

  private render(): void {
    this.body.textContent = '';
    if (this.state.conditions.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'tablify__fb-empty';
      empty.textContent = 'No conditions — click “Add condition”.';
      this.body.appendChild(empty);
    }
    this.state.conditions.forEach((c, i) => this.body.appendChild(this.renderRow(c, i)));
    this.renderPreview();
  }

  private renderPreview(): void {
    this.preview.textContent = this.currentInput() || '(no filter)';
  }

  private select(cls: string, label: string, options: Array<[string, string]>, value: string): HTMLSelectElement {
    const s = document.createElement('select');
    s.className = `tablify__fb-input ${cls}`;
    s.setAttribute('aria-label', label);
    for (const [v, text] of options) {
      const o = document.createElement('option');
      o.value = v;
      o.textContent = text;
      if (v === value) o.selected = true;
      s.appendChild(o);
    }
    s.value = value;
    return s;
  }

  private renderRow(c: Condition, i: number): HTMLElement {
    const field = this.fields.find((f) => f.id === c.fieldId) ?? this.queryableFields()[0];
    const row = document.createElement('div');
    row.className = 'tablify__fb-row';
    row.dataset.testid = 'tablify-fb-row';

    const join = document.createElement('span');
    join.className = 'tablify__fb-join';
    join.textContent = i === 0 ? 'Where' : 'and';
    row.appendChild(join);

    const fieldSel = this.select(
      'tablify__fb-field',
      'Field',
      this.queryableFields().map((f) => [f.id, f.name]),
      c.fieldId,
    );
    fieldSel.addEventListener('change', () => {
      // A new field resets operator and value (prototype `fbField`).
      this.state.conditions[i] = { fieldId: fieldSel.value, op: '', value: '' };
      this.render();
    });
    row.appendChild(fieldSel);

    const ops = opsFor(field.type);
    if (!ops.some(([op]) => op === c.op)) ops.push([c.op, GENERIC_OP_LABEL[c.op]]);
    const opSel = this.select('tablify__fb-op', 'Operator', ops, c.op);
    opSel.addEventListener('change', () => {
      this.state.conditions[i] = { ...this.state.conditions[i], op: opSel.value as BuilderOp };
      this.render();
    });
    row.appendChild(opSel);

    if (c.op !== 'empty') row.appendChild(this.valueControl(field, c, i));

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tablify__fb-remove';
    remove.dataset.action = 'fb-remove';
    remove.title = 'Remove condition';
    remove.setAttribute('aria-label', 'Remove condition');
    remove.innerHTML = faIcon('trash-can');
    remove.addEventListener('click', () => {
      this.state.conditions.splice(i, 1);
      this.render();
    });
    row.appendChild(remove);
    return row;
  }

  private valueControl(field: FieldDefinition, c: Condition, i: number): HTMLElement {
    const set = (value: string): void => {
      this.state.conditions[i] = { ...this.state.conditions[i], value };
      this.renderPreview();
    };
    const encode = c.op === '' ? encodeListValue : encodeSingleValue;
    const choices = (field.options ?? []).map((o): [string, string] => [encode(o.name), o.name]);
    const isSelect = field.type === 'single_select' || field.type === 'multi_select';
    // A dropdown only when it can show the value exactly; a list like "a, b" stays editable text.
    if (isSelect && (c.value === '' || choices.some(([v]) => v === c.value))) {
      const s = this.select('tablify__fb-value', 'Value', [['', '—'], ...choices], c.value);
      s.addEventListener('change', () => set(s.value));
      return s;
    }
    if (field.type === 'checkbox' && (c.value === '' || c.value === 'true' || c.value === 'false')) {
      const value = c.value === 'false' ? 'false' : 'true';
      if (c.value === '') this.state.conditions[i] = { ...c, value };
      const s = this.select('tablify__fb-value tablify__fb-value--narrow', 'Value', [['true', 'true'], ['false', 'false']], value);
      s.addEventListener('change', () => set(s.value));
      return s;
    }
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tablify__fb-input tablify__fb-value';
    input.value = c.value;
    input.placeholder = c.op === '' ? 'value (a,b = any of)' : 'value';
    input.setAttribute('aria-label', 'Value');
    // Live preview without a re-render, so typing keeps focus and caret.
    input.addEventListener('input', () => set(input.value));
    return input;
  }
}
