/**
 * Add-field modal (SAD-70 / SAD-69 Step 5; prototype layout SAD-86).
 *
 * The prototype's `#addFieldModal` card (Prototype/index.html): Field name, Field type (grouped
 * as the prototype groups them), Options (one per line) for select fields, Validation rules,
 * Formula with "Preview (row 1)", Linked table, then Cancel / Save Field. The type list is shared
 * with the header menu's "Change field type…" via CHANGE_TARGET_TYPES, so both pickers offer
 * exactly the same set.
 *
 * Behaviour kept from the Setting-row dialog: Enter in a one-line box (and in the formula box)
 * submits; an empty name, a formula syntax error and a link field without a target table each
 * show a notice and keep the dialog open with the user's input; onConfirm receives the same
 * arguments as before. Options and validation rules are new and optional: they are passed as a
 * fifth argument only when something was set, and only ever apply to the new field.
 *
 * See tests/views/addFieldModal.test.ts.
 */

import { App, Modal, Notice } from 'obsidian';
import { dressProtoModal } from '../../ui/protoModal.js';
import { CHANGE_TARGET_TYPES, TYPE_LABELS } from '../../menus/tableMenuModel.js';
import type { FieldDefinition, FieldTypeName } from '../../model/types.js';
import type { NewFieldExtras } from '../../model/tableSession.js';
import { compileFormula } from '../../formula/index.js';
import { EMPTY_PREVIEW } from '../../model/formulaPreview.js';
import { parseInput } from './editors/index.js';

/** Type preselected when the modal opens. */
export const DEFAULT_NEW_FIELD_TYPE: FieldTypeName = 'text';

/** A table a link field can point to (P8-04). */
export interface LinkTargetChoice {
  tableId: string;
  name: string;
}

/**
 * COD-67: the window has two modes. 'create' is the original Add Field dialog; 'edit' is the same
 * window opened from a column header or from Field Details, showing that field's name and type.
 * Only name and type are edited here — options and validation rules belong to field settings,
 * a formula to its own editor — so those rows are not shown in edit mode.
 */
export type FieldEditorMode = 'create' | 'edit';

export interface AddFieldOptions {
  /** Tables offered for a Link field. The current table should be first. */
  linkTargets?: LinkTargetChoice[];
  /** Preselected link target. Defaults to the first entry of linkTargets. */
  defaultLinkTableId?: string;
  /** SAD-86: evaluates an unsaved expression against row 1 for the formula preview. */
  formulaPreview?: (expression: string) => string;
  /** COD-67: 'edit' shows an existing field's name and type. Defaults to 'create'. */
  mode?: FieldEditorMode;
  /** Initial values shown in edit mode. Ignored in create mode. */
  initial?: { name: string; type: FieldTypeName };
  /** Edit mode: called with the edited name and type instead of the create callbacks. */
  onEdit?: (name: string, type: FieldTypeName) => void;
  /**
   * Edit mode: whether a type may be offered. Callers pass planTypeChange's verdict so a type
   * that would drop values is never selectable — the same rule the Change field type menu uses.
   */
  canPickType?: (type: FieldTypeName) => boolean;
}

/**
 * The prototype's type groups (`FT_GROUPS`), limited to the types a new field can take. System
 * types are not offered (as in Change field type), and the prototype's "(v2)" note is dropped.
 */
export const TYPE_GROUPS: ReadonlyArray<readonly [string, readonly FieldTypeName[]]> = [
  ['Basic', ['text', 'long_text', 'number', 'currency', 'percent', 'duration', 'rating', 'checkbox']],
  ['Date', ['date', 'date_time']],
  ['Links & contact', ['url', 'email', 'phone']],
  ['Select & attachment', ['single_select', 'multi_select', 'attachment']],
  ['Computed', ['formula', 'link']],
];

/** Types with Min / Max and with a Regex rule (prototype `onFieldTypeChange`). */
const MIN_MAX_TYPES: readonly FieldTypeName[] = ['number', 'currency', 'percent', 'duration', 'rating', 'date', 'date_time'];
const REGEX_TYPES: readonly FieldTypeName[] = ['text', 'long_text', 'url', 'email', 'phone'];
const SELECT_TYPES: readonly FieldTypeName[] = ['single_select', 'multi_select'];

export class AddFieldModal extends Modal {
  private name = '';
  private type: FieldTypeName = DEFAULT_NEW_FIELD_TYPE;
  private expression = '';
  private linkTableId: string;
  private optionsText = '';
  private required = false;
  private unique = false;
  private minText = '';
  private maxText = '';
  private regexText = '';

  constructor(
    app: App,
    private readonly onConfirm: (
      name: string,
      type: FieldTypeName,
      formula?: string,
      linkTableId?: string,
      extras?: NewFieldExtras,
    ) => void,
    private readonly options: AddFieldOptions = {},
  ) {
    super(app);
    this.linkTableId = options.defaultLinkTableId ?? options.linkTargets?.[0]?.tableId ?? '';
    this.name = options.initial?.name ?? '';
    this.type = options.initial?.type ?? DEFAULT_NEW_FIELD_TYPE;
  }

  private get isEdit(): boolean {
    return this.options.mode === 'edit';
  }

  onOpen(): void {
    this.setTitle(this.isEdit ? 'Edit Field' : 'Add New Field');
    dressProtoModal(this, { icon: 'table-columns', size: 'sm' });
    this.modalEl.addClass('tablify__af-modal');
    if (this.isEdit) this.modalEl.addClass('tablify__af-modal--edit');

    const body = this.contentEl.createDiv({ cls: 'tablify__af-body' });

    // Field name
    const nameWrap = body.createDiv();
    this.label(nameWrap, 'Field name', 'tablify__af-name');
    const nameInput = nameWrap.createEl('input', { type: 'text', cls: 'tablify__pmodal-input' }) as HTMLInputElement;
    nameInput.id = 'tablify__af-name';
    nameInput.placeholder = 'e.g. Status, Budget, Due date…';
    nameInput.value = this.name;
    nameInput.addEventListener('input', () => {
      this.name = nameInput.value;
    });

    // Field type, grouped as in the prototype
    const typeWrap = body.createDiv();
    this.label(typeWrap, 'Field type', 'tablify__af-type');
    const typeSelect = typeWrap.createEl('select', { cls: 'tablify__pmodal-input' }) as HTMLSelectElement;
    typeSelect.id = 'tablify__af-type';
    const grouped = new Set<FieldTypeName>();
    for (const [group, types] of TYPE_GROUPS) {
      const offered = types.filter((t) => CHANGE_TARGET_TYPES.includes(t));
      if (offered.length === 0) continue;
      const optgroup = typeSelect.createEl('optgroup') as HTMLOptGroupElement;
      optgroup.label = group;
      for (const t of offered) {
        if (!this.offersType(t)) continue;
        grouped.add(t);
        const option = optgroup.createEl('option', { value: t }) as HTMLOptionElement;
        option.textContent = TYPE_LABELS[t] ?? t;
      }
    }
    // Any offered type the groups do not name still appears (never silently dropped).
    for (const t of CHANGE_TARGET_TYPES) {
      if (grouped.has(t) || !this.offersType(t)) continue;
      const option = typeSelect.createEl('option', { value: t }) as HTMLOptionElement;
      option.textContent = TYPE_LABELS[t] ?? t;
    }
    typeSelect.value = this.type;
    typeSelect.addEventListener('change', () => {
      this.type = typeSelect.value as FieldTypeName;
      showTypeRows();
    });

    // Options (one per line) — single / multi select
    const optionsWrap = body.createDiv();
    this.label(optionsWrap, 'Options (one per line)', 'tablify__af-options');
    const optionsInput = optionsWrap.createEl('textarea', { cls: 'tablify__pmodal-input' }) as HTMLTextAreaElement;
    optionsInput.id = 'tablify__af-options';
    optionsInput.rows = 4;
    optionsInput.placeholder = 'Backlog\nIn Progress\nDone';
    optionsInput.addEventListener('input', () => {
      this.optionsText = optionsInput.value;
    });

    // Validation rules
    const rulesWrap = body.createDiv({ cls: 'tablify__af-rules' });
    rulesWrap.createDiv({ text: 'Validation rules', cls: 'tablify__pmodal-label tablify__af-rules-label' });
    const checks = rulesWrap.createDiv({ cls: 'tablify__af-grid' });
    const requiredBox = this.checkbox(checks, 'Required');
    requiredBox.addEventListener('change', () => {
      this.required = requiredBox.checked;
    });
    const uniqueBox = this.checkbox(checks, 'Unique');
    uniqueBox.addEventListener('change', () => {
      this.unique = uniqueBox.checked;
    });
    const minMaxWrap = rulesWrap.createDiv({ cls: 'tablify__af-grid' });
    const minInput = minMaxWrap.createEl('input', { type: 'text', cls: 'tablify__pmodal-input tablify__af-rule-input' }) as HTMLInputElement;
    minInput.id = 'tablify__af-min';
    minInput.placeholder = 'Min (number / date)';
    minInput.setAttribute('aria-label', 'Minimum');
    minInput.addEventListener('input', () => {
      this.minText = minInput.value;
    });
    const maxInput = minMaxWrap.createEl('input', { type: 'text', cls: 'tablify__pmodal-input tablify__af-rule-input' }) as HTMLInputElement;
    maxInput.id = 'tablify__af-max';
    maxInput.placeholder = 'Max';
    maxInput.setAttribute('aria-label', 'Maximum');
    maxInput.addEventListener('input', () => {
      this.maxText = maxInput.value;
    });
    const regexWrap = rulesWrap.createDiv({ cls: 'tablify__af-regex' });
    const regexInput = regexWrap.createEl('input', {
      type: 'text',
      cls: 'tablify__pmodal-input tablify__af-rule-input tablify__af-mono',
    }) as HTMLInputElement;
    regexInput.id = 'tablify__af-regex-input';
    regexInput.placeholder = 'Regex, e.g. ^[A-Z].*';
    regexInput.setAttribute('aria-label', 'Regex');
    regexInput.addEventListener('input', () => {
      this.regexText = regexInput.value;
    });

    // P8-03: Formula, with the prototype's live "Preview (row 1)"
    const formulaWrap = body.createDiv();
    this.label(formulaWrap, 'Formula', 'tablify__af-formula');
    const formulaInput = formulaWrap.createEl('textarea', {
      cls: 'tablify__pmodal-input tablify__af-mono tablify__af-formula',
    }) as HTMLTextAreaElement;
    formulaInput.id = 'tablify__af-formula';
    formulaInput.rows = 2;
    formulaInput.placeholder = 'IF({Budget} > 10000, "big", "small")';
    formulaInput.value = this.expression;
    const preview = formulaWrap.createDiv({ cls: 'tablify__af-preview' });
    preview.append('Preview (row 1): ');
    const previewOut = preview.createSpan({ text: EMPTY_PREVIEW, cls: 'tablify__af-mono' });
    const updatePreview = (): void => {
      previewOut.textContent = this.options.formulaPreview ? this.options.formulaPreview(this.expression) : EMPTY_PREVIEW;
    };
    formulaInput.addEventListener('input', () => {
      this.expression = formulaInput.value;
      updatePreview();
    });

    // P8-04: a link field needs a target table.
    const linkWrap = body.createDiv();
    this.label(linkWrap, 'Linked table', 'tablify__af-link');
    const linkSelect = linkWrap.createEl('select', { cls: 'tablify__pmodal-input' }) as HTMLSelectElement;
    linkSelect.id = 'tablify__af-link';
    for (const t of this.options.linkTargets ?? []) {
      const option = linkSelect.createEl('option', { value: t.tableId }) as HTMLOptionElement;
      option.textContent = t.name;
    }
    if (this.linkTableId) linkSelect.value = this.linkTableId;
    linkSelect.addEventListener('change', () => {
      this.linkTableId = linkSelect.value;
    });

    const showTypeRows = (): void => {
      if (this.isEdit) return;
      optionsWrap.style.display = SELECT_TYPES.includes(this.type) ? '' : 'none';
      minMaxWrap.style.display = MIN_MAX_TYPES.includes(this.type) ? '' : 'none';
      regexWrap.style.display = REGEX_TYPES.includes(this.type) ? '' : 'none';
      formulaWrap.style.display = this.type === 'formula' ? '' : 'none';
      linkWrap.style.display = this.type === 'link' ? '' : 'none';
    };
    showTypeRows();
    if (this.isEdit) {
      // Edit mode edits the name and its type only. The other rows are dropped rather than
      // hidden so nothing focusable is left behind; showTypeRows() above is a no-op in this mode.
      for (const wrap of [optionsWrap, rulesWrap, formulaWrap, linkWrap]) wrap.remove();
    }

    // Footer: `mt-5 flex justify-end space-x-2` — Cancel, Save Field.
    const footer = this.contentEl.createDiv({ cls: 'tablify__af-footer' });
    const cancel = footer.createEl('button', { text: 'Cancel', cls: 'tablify__pmodal-btn' }) as HTMLButtonElement;
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    const save = footer.createEl('button', {
      text: this.isEdit ? 'Save' : 'Save Field',
      cls: 'tablify__pmodal-btn tablify__pmodal-btn--primary mod-cta',
    }) as HTMLButtonElement;
    save.type = 'button';
    save.addEventListener('click', () => this.submit());

    // Enter in a one-line box submits, as it does in Obsidian's own dialogs. The formula box was
    // one line before and keeps that; the options box takes Enter as a new line.
    this.contentEl.addEventListener('keydown', (event) => {
      const evt = event as KeyboardEvent;
      if (evt.key !== 'Enter') return;
      const target = evt.target as HTMLElement | null;
      const isFormula = target?.tagName === 'TEXTAREA' && target.classList.contains('tablify__af-formula');
      if (target?.tagName === 'INPUT' || isFormula) {
        evt.preventDefault();
        this.submit();
      }
    });

    nameInput.focus();
  }

  private label(parent: HTMLElement, text: string, forId: string): void {
    const label = parent.createEl('label', { text, cls: 'tablify__pmodal-label' }) as HTMLLabelElement;
    label.htmlFor = forId;
  }

  private checkbox(parent: HTMLElement, text: string): HTMLInputElement {
    const label = parent.createEl('label', { cls: 'tablify__af-check' });
    const box = label.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
    label.append(` ${text}`);
    return box;
  }

  /** Min / Max in the field type's stored form; `false` (after a notice) when it does not parse. */
  private ruleBound(text: string, which: 'Min' | 'Max'): number | string | null | false {
    const raw = text.trim();
    if (!raw || !MIN_MAX_TYPES.includes(this.type)) return null;
    const parsed = parseInput({ id: 'fld_rule', name: which, type: this.type } as FieldDefinition, raw);
    if (!parsed.ok || (typeof parsed.value !== 'number' && typeof parsed.value !== 'string')) {
      new Notice(`${which} is not a valid ${TYPE_LABELS[this.type]?.toLowerCase() ?? this.type} value.`);
      return false;
    }
    return parsed.value;
  }

  /** The optional extras, or undefined when nothing was set (onConfirm then gets the old arguments). */
  private collectExtras(): NewFieldExtras | undefined | false {
    const extras: NewFieldExtras = {};
    if (SELECT_TYPES.includes(this.type)) {
      const options = this.optionsText.split('\n').map((s) => s.trim()).filter(Boolean);
      if (options.length > 0) extras.options = options;
    }
    if (this.required) extras.required = true;
    if (this.unique) extras.unique = true;
    const min = this.ruleBound(this.minText, 'Min');
    if (min === false) return false;
    const max = this.ruleBound(this.maxText, 'Max');
    if (max === false) return false;
    if (min !== null) extras.min = min;
    if (max !== null) extras.max = max;
    const regex = this.regexText.trim();
    if (regex && REGEX_TYPES.includes(this.type)) {
      try {
        new RegExp(regex);
      } catch {
        new Notice('The regex is not valid.');
        return false;
      }
      extras.regex = regex;
    }
    return Object.keys(extras).length > 0 ? extras : undefined;
  }

  /** Edit mode: only types planTypeChange accepts, plus the field's current type. */
  private offersType(type: FieldTypeName): boolean {
    if (!this.isEdit || type === this.type) return true;
    return this.options.canPickType ? this.options.canPickType(type) : true;
  }

  private submit(): void {
    const name = this.name.trim();
    if (!name) {
      new Notice('Field name cannot be empty.');
      return;
    }
    if (this.isEdit) {
      this.close();
      this.options.onEdit?.(name, this.type);
      return;
    }
    // Validate before closing, so the modal stays open with the user's text intact.
    if (this.type === 'link' && !this.linkTableId) {
      new Notice('Choose a table to link to.');
      return;
    }
    if (this.type === 'formula' && !compileFormula(this.expression).ok) {
      new Notice('The formula has a syntax error.');
      return;
    }
    const extras = this.collectExtras();
    if (extras === false) return;
    this.close();
    const formula = this.type === 'formula' ? this.expression : undefined;
    const linkTableId = this.type === 'link' ? this.linkTableId : undefined;
    if (extras) this.onConfirm(name, this.type, formula, linkTableId, extras);
    else if (this.type === 'link') this.onConfirm(name, this.type, undefined, linkTableId);
    else if (this.type === 'formula') this.onConfirm(name, this.type, formula);
    else this.onConfirm(name, this.type);
  }
}

/**
 * COD-67: the field editor IS the Add Field window. The ticket asks for creating and editing to
 * be one dialog, so this is an alias, not a subclass or a copy — there is exactly one layout.
 */
export { AddFieldModal as FieldEditorModal };
