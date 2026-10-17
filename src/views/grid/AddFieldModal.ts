/**
 * Field window (SAD-70 / SAD-69 Step 5; prototype layout SAD-86; one window since COD-67/COD-69).
 *
 * Create mode is the prototype's `#addFieldModal`. Edit mode — opened from a column header or
 * from ⋮ → Modify field… — draws the SAME rows and pre-fills them from the field, so a field is
 * created and modified in one window rather than two.
 *
 * Rows, in order: Field name, Field type (grouped as the prototype groups them), Options for
 * select fields, Validation rules, Formula with "Preview (row 1)", Linked table, then
 * Cancel / Save Field. The type list comes from CHANGE_TARGET_TYPES, so create and edit offer
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
import type { FieldEdit, NewFieldExtras } from '../../model/tableSession.js';
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
 * COD-67/COD-69: the window has two modes. 'create' adds a field; 'edit' opens on an existing one
 * from a column header or from ⋮ → Modify field… and shows the same rows, pre-filled.
 */
export type FieldEditorMode = 'create' | 'edit';

export interface AddFieldOptions {
  /** Tables offered for a Link field. The current table should be first. */
  linkTargets?: LinkTargetChoice[];
  /** Preselected link target. Defaults to the first entry of linkTargets. */
  defaultLinkTableId?: string;
  /** SAD-86: evaluates an unsaved expression against row 1 for the formula preview. */
  formulaPreview?: (expression: string) => string;
  /** COD-67: 'edit' opens on an existing field. Defaults to 'create'. */
  mode?: FieldEditorMode;
  /** Edit mode: the field being edited; every row is pre-filled from it. */
  initial?: { field: FieldDefinition };
  /** Edit mode: called with the patch the window collected, built from the visible rows only. */
  onEdit?: (edit: FieldEdit) => void;
  /**
   * Edit mode: whether a type may be offered. Callers pass planTypeChange's verdict so a type
   * that would drop values is never selectable — the same rule the header menu's editor uses.
   */
  canPickType?: (type: FieldTypeName) => boolean;
  /**
   * Edit mode, select fields: open the option manager. Options are not edited in this window
   * because cells store option ids — a free-text list cannot tell a rename from a delete + add,
   * and the delete would clear the cells that used the option (see COD-69 plan §3b).
   */
  onManageOptions?: () => void;
  /** Edit mode, select fields: the current field, so the options summary stays truthful. */
  getField?: () => FieldDefinition | undefined;
}

/**
 * The prototype's type groups (`FT_GROUPS`), limited to the types a new field can take. System
 * types are not offered (as when changing a type), and the prototype's "(v2)" note is dropped.
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
  /** The field being edited, kept so the window can compare against what it opened with. */
  private readonly edited: FieldDefinition | undefined;
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
  /** Edit mode: the "N options: …" line, refreshed after the option manager closes. */
  private optionsSummary: HTMLElement | null = null;

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
    const initial = options.initial?.field;
    this.edited = initial;
    this.name = initial?.name ?? '';
    this.type = initial?.type ?? DEFAULT_NEW_FIELD_TYPE;
    this.expression = initial?.formula ?? '';
    this.required = initial?.required === true;
    this.unique = initial?.unique === true;
    this.minText = initial?.min === null || initial?.min === undefined ? '' : String(initial.min);
    this.maxText = initial?.max === null || initial?.max === undefined ? '' : String(initial.max);
    this.regexText = initial?.regex ?? '';
    this.linkTableId =
      initial?.linkTableId ?? options.defaultLinkTableId ?? options.linkTargets?.[0]?.tableId ?? '';
  }

  private get isEdit(): boolean {
    return this.options.mode === 'edit';
  }

  onOpen(): void {
    this.setTitle(this.isEdit ? 'Modify Field' : 'Add New Field');
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
    // A field whose type is not a change target (auto number, created time…) still has to show
    // its own type in edit mode rather than silently falling back to Text.
    if (this.isEdit && !grouped.has(this.type) && !CHANGE_TARGET_TYPES.includes(this.type)) {
      const own = typeSelect.createEl('option', { value: this.type }) as HTMLOptionElement;
      own.textContent = TYPE_LABELS[this.type] ?? this.type;
    }
    typeSelect.value = this.type;
    typeSelect.addEventListener('change', () => {
      this.type = typeSelect.value as FieldTypeName;
      showTypeRows();
    });

    // Options — single / multi select. Create mode takes one per line; edit mode shows what the
    // field has and hands the real editing to the option manager, which keeps option ids.
    const optionsWrap = body.createDiv();
    this.label(optionsWrap, this.isEdit ? 'Options' : 'Options (one per line)', 'tablify__af-options');
    if (this.isEdit) {
      this.optionsSummary = optionsWrap.createDiv({ cls: 'tablify__af-options-summary' });
      const manage = optionsWrap.createEl('button', {
        text: 'Manage options…',
        cls: 'tablify__pmodal-btn tablify__af-manage',
      }) as HTMLButtonElement;
      manage.type = 'button';
      manage.addEventListener('click', () => {
        this.options.onManageOptions?.();
        this.refreshOptionSummary();
      });
      this.renderOptionSummary();
    } else {
      const box = optionsWrap.createEl('textarea', { cls: 'tablify__pmodal-input' }) as HTMLTextAreaElement;
      box.id = 'tablify__af-options';
      box.rows = 4;
      box.placeholder = 'Backlog\nIn Progress\nDone';
      box.addEventListener('input', () => {
        this.optionsText = box.value;
      });
    }

    // Validation rules
    const rulesWrap = body.createDiv({ cls: 'tablify__af-rules' });
    rulesWrap.createDiv({ text: 'Validation rules', cls: 'tablify__pmodal-label tablify__af-rules-label' });
    const checks = rulesWrap.createDiv({ cls: 'tablify__af-grid' });
    const requiredBox = this.checkbox(checks, 'Required');
    requiredBox.checked = this.required;
    requiredBox.addEventListener('change', () => {
      this.required = requiredBox.checked;
    });
    const uniqueBox = this.checkbox(checks, 'Unique');
    uniqueBox.checked = this.unique;
    uniqueBox.addEventListener('change', () => {
      this.unique = uniqueBox.checked;
    });
    const minMaxWrap = rulesWrap.createDiv({ cls: 'tablify__af-grid' });
    const minInput = minMaxWrap.createEl('input', { type: 'text', cls: 'tablify__pmodal-input tablify__af-rule-input' }) as HTMLInputElement;
    minInput.id = 'tablify__af-min';
    minInput.placeholder = 'Min (number / date)';
    minInput.setAttribute('aria-label', 'Minimum');
    minInput.value = this.minText;
    minInput.addEventListener('input', () => {
      this.minText = minInput.value;
    });
    const maxInput = minMaxWrap.createEl('input', { type: 'text', cls: 'tablify__pmodal-input tablify__af-rule-input' }) as HTMLInputElement;
    maxInput.id = 'tablify__af-max';
    maxInput.placeholder = 'Max';
    maxInput.setAttribute('aria-label', 'Maximum');
    maxInput.value = this.maxText;
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
    regexInput.value = this.regexText;
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
    // A pre-filled expression shows its preview straight away, as typing it does.
    updatePreview();

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
      optionsWrap.style.display = SELECT_TYPES.includes(this.type) ? '' : 'none';
      minMaxWrap.style.display = MIN_MAX_TYPES.includes(this.type) ? '' : 'none';
      regexWrap.style.display = REGEX_TYPES.includes(this.type) ? '' : 'none';
      formulaWrap.style.display = this.type === 'formula' ? '' : 'none';
      linkWrap.style.display = this.type === 'link' ? '' : 'none';
    };
    showTypeRows();

    // Footer: `mt-5 flex justify-end space-x-2` — Cancel, Save Field.
    const footer = this.contentEl.createDiv({ cls: 'tablify__af-footer' });
    const cancel = footer.createEl('button', { text: 'Cancel', cls: 'tablify__pmodal-btn' }) as HTMLButtonElement;
    cancel.type = 'button';
    cancel.addEventListener('click', () => this.close());
    const save = footer.createEl('button', {
      text: 'Save Field',
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

  /** The line under "Options" in edit mode: what the field has right now. */
  private renderOptionSummary(): void {
    if (!this.optionsSummary) return;
    const live = this.options.getField?.() ?? this.edited;
    const options = live?.options ?? [];
    const names = options.map((o) => o.name);
    this.optionsSummary.textContent =
      names.length === 0 ? 'No options yet' : `${names.length} option${names.length === 1 ? '' : 's'}: ${names.join(', ')}`;
  }

  /** Called after the option manager closes, so the summary matches the saved field. */
  refreshOptionSummary(): void {
    this.renderOptionSummary();
  }

  /**
   * Edit mode: collect only the rows this window actually showed and hand them over as a patch.
   * A row hidden for the chosen type is omitted, so saving can never clear a key the window
   * never displayed.
   */
  private submitEdit(name: string): void {
    if (this.type === 'link' && !this.linkTableId) {
      new Notice('Choose a table to link to.');
      return;
    }
    if (this.type === 'formula' && !compileFormula(this.expression).ok) {
      new Notice('The formula has a syntax error.');
      return;
    }
    const edit: FieldEdit = { name, type: this.type, required: this.required, unique: this.unique };
    if (MIN_MAX_TYPES.includes(this.type)) {
      const min = this.ruleBound(this.minText, 'Min');
      if (min === false) return;
      const max = this.ruleBound(this.maxText, 'Max');
      if (max === false) return;
      edit.min = min;
      edit.max = max;
    }
    if (REGEX_TYPES.includes(this.type)) {
      const regex = this.regexText.trim();
      if (regex) {
        try {
          new RegExp(regex);
        } catch {
          new Notice('The regex is not valid.');
          return;
        }
      }
      edit.regex = regex || null;
    }
    if (this.type === 'formula') edit.formula = this.expression;
    if (this.type === 'link') edit.linkTableId = this.linkTableId;
    this.close();
    this.options.onEdit?.(edit);
  }

  private submit(): void {
    const name = this.name.trim();
    if (!name) {
      new Notice('Field name cannot be empty.');
      return;
    }
    if (this.isEdit) {
      this.submitEdit(name);
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
