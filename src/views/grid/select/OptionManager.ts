/**
 * Option manager — the prototype's `#optMgrModal` (`Prototype/index.html:291`, `Prototype/script.js`
 * `renderOptMgr`, ~line 1050): a `max-w-md` card over a blurred backdrop, a palette glyph and
 * `Options — <field>` in the header, one row per option (↑ ↓, colour swatch, editable name, bin),
 * a `New option…` field with an Add button, and the hint line.
 *
 * The model work stays in `src/model/selectOptions.ts`: `planOptionRemoval` is the one place that
 * knows what deleting an option does to the cells that referenced it (R-D12).
 *
 * Every mutation goes through `hooks.apply` when the host supplies it, so the change is one undo
 * step in the caller's command stack; without hooks the dialog edits the field in place, which is
 * what the unit tests exercise. The public API (`rename`, `recolor`, `reorder`,
 * `getDeleteAffectedCount`, `confirmDelete`, `getOptions`) is unchanged.
 */

import { dressProtoModal } from '../../../ui/protoModal.js';
import { faIcon } from '../../../ui/faIcons.js';
import { planOptionRemoval } from '../../../model/selectOptions.js';
import { OPTION_COLORS } from '../../../model/types.js';
import { generateOptionId } from '../../../utils/idGen.js';
import { optionChipColors } from '../../../ui/theme/tokens.js';
import type { CellValue, FieldDefinition, OptionColor, SelectOption } from '../../../model/types.js';
import type { TableStore } from '../../../model/tableStore.js';

export interface OptionManagerHooks {
  /**
   * Write the new option list, plus the cells this change rewrites (option delete), through the
   * caller's undo path.
   */
  apply?: (options: SelectOption[], values: Record<string, CellValue>) => void;
  /** After every applied change: re-render the grid and save. */
  onChanged?: () => void;
  /** After the dialog closed (COD-69: refresh the field window's options summary). */
  onClose?: () => void;
}

export interface OptionManagerOptions {
  /**
   * COD-69: opened from the field window, which is an Obsidian modal above this backdrop's
   * normal z-index. Raises the backdrop over it.
   */
  stacked?: boolean;
}

export class OptionManagerDialog {
  private card: HTMLElement;
  private backdrop: HTMLElement;
  private title: HTMLElement;
  /** The title's label. `dressProtoModal` prepends the glyph; only this span is rewritten. */
  private label: HTMLElement;
  private body: HTMLElement;
  private unwire: (() => void) | null = null;

  private closed = false;

  constructor(
    private field: FieldDefinition,
    private store: TableStore,
    private hooks: OptionManagerHooks = {},
    private readonly opts: OptionManagerOptions = {},
  ) {
    this.backdrop = document.createElement('div');
    this.backdrop.className = opts.stacked
      ? 'tablify__optmgr-backdrop tablify__optmgr-backdrop--stacked'
      : 'tablify__optmgr-backdrop';

    this.card = document.createElement('div');
    const header = document.createElement('div');
    header.className = 'tablify__optmgr-head';
    this.title = document.createElement('h3');
    this.title.className = 'modal-title';
    this.label = document.createElement('span');
    this.label.className = 'tablify__optmgr-title';
    this.title.appendChild(this.label);
    header.appendChild(this.title);
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'tablify__optmgr-close';
    close.setAttribute('aria-label', 'Close');
    close.innerHTML = faIcon('xmark', 16);
    close.addEventListener('click', () => this.close());
    header.appendChild(close);

    this.body = document.createElement('div');
    this.body.className = 'modal-content';

    this.card.appendChild(header);
    this.card.appendChild(this.body);
    this.backdrop.appendChild(this.card);
    dressProtoModal({ modalEl: this.card, titleEl: this.title }, { icon: 'palette', size: 'md' });
    this.render();
  }

  get element(): HTMLElement {
    return this.backdrop;
  }

  open(): void {
    if (!this.backdrop.isConnected) document.body.appendChild(this.backdrop);
    if (!this.unwire) {
      const onPress = (ev: MouseEvent): void => {
        if (ev.target === this.backdrop) this.close();
      };
      const onKey = (ev: KeyboardEvent): void => {
        if (ev.key === 'Escape') this.close();
      };
      document.addEventListener('mousedown', onPress);
      document.addEventListener('keydown', onKey);
      this.unwire = () => {
        document.removeEventListener('mousedown', onPress);
        document.removeEventListener('keydown', onKey);
      };
    }
    this.render();
  }

  close(): void {
    this.unwire?.();
    this.unwire = null;
    this.backdrop.remove();
    if (this.closed) return;
    this.closed = true;
    this.hooks.onClose?.();
  }

  // ---- public API (unchanged) ------------------------------------------------------------

  rename(optionId: string, newName: string): SelectOption {
    const trimmed = newName.trim();
    if (!trimmed) throw new Error('Option name cannot be empty');
    if (!this.field.options) throw new Error('Field has no options');
    const option = this.field.options.find((o) => o.id === optionId);
    if (!option) throw new Error(`Option not found: ${optionId}`);
    this.commit(this.field.options.map((o) => (o.id === optionId ? { ...o, name: trimmed } : o)), {});
    return this.liveField().options?.find((o) => o.id === optionId) ?? { ...option, name: trimmed };
  }

  recolor(optionId: string, newColor: string): SelectOption {
    const option = this.field.options?.find((o) => o.id === optionId);
    if (!option) throw new Error('Option not found');
    this.commit(
      (this.field.options ?? []).map((o) =>
        o.id === optionId ? { ...o, color: newColor as OptionColor } : o,
      ),
      {},
    );
    return this.liveField().options?.find((o) => o.id === optionId) ?? option;
  }

  reorder(optionIds: string[]): void {
    const current = this.field.options ?? [];
    const byId = new Map(current.map((o) => [o.id, o]));
    const next: SelectOption[] = [];
    for (const id of optionIds) {
      const opt = byId.get(id);
      if (!opt) throw new Error(`Option not found: ${id}`);
      next.push(opt);
    }
    for (const opt of current) if (!optionIds.includes(opt.id)) next.push(opt);
    this.commit(next, {});
  }

  /** Add an option (prototype `optMgrAdd`). The colour cycles like the model's `findOrCreate`. */
  add(name: string): SelectOption | null {
    const trimmed = name.trim();
    if (!trimmed) return null;
    const current = this.field.options ?? [];
    const option: SelectOption = {
      id: generateOptionId(),
      name: trimmed,
      color: OPTION_COLORS[current.length % OPTION_COLORS.length],
    };
    this.commit([...current, option], {});
    return option;
  }

  /**
   * Delete with confirmation — returns affected cell count for UI.
   * Caller should show confirm dialog with this count before calling `confirmDelete`.
   */
  getDeleteAffectedCount(optionId: string): number {
    return Object.keys(planOptionRemoval(optionId, this.field, this.store).values).length;
  }

  confirmDelete(optionId: string): { option: SelectOption; affected: number } {
    const before = this.getDeleteAffectedCount(optionId);
    const option = this.field.options?.find((o) => o.id === optionId);
    if (!option) throw new Error(`Option not found: ${optionId}`);
    const plan = planOptionRemoval(optionId, this.field, this.store);
    this.commit(plan.options, plan.values);
    return { option, affected: before };
  }

  // For tests: get options in order
  getOptions(): SelectOption[] {
    return [...(this.field.options ?? [])];
  }

  // ---- card ------------------------------------------------------------------------------

  /** The live definition: the store swaps the object out when a change is applied through it. */
  private liveField(): FieldDefinition {
    return this.store.getFields().find((f) => f.id === this.field.id) ?? this.field;
  }

  /**
   * Write one option-list change. With hooks the host owns the write (undo stack, save,
   * re-render) and hands back the live field on the next read; without them the field is edited
   * in place, exactly as this dialog always did.
   */
  private commit(options: SelectOption[], values: Record<string, CellValue>): void {
    if (this.hooks.apply) {
      this.hooks.apply(options, values);
      this.field = this.liveField();
      this.hooks.onChanged?.();
      this.render();
      return;
    }
    this.field.options = options;
    for (const [rowId, value] of Object.entries(values)) {
      this.store.updateRow(rowId, { [this.field.id]: value });
    }
    this.render();
  }

  private render(): void {
    const options = this.field.options ?? [];
    this.label.textContent = `Options — ${this.field.name}`;
    this.body.textContent = '';

    const rows = document.createElement('div');
    rows.className = 'tablify__optmgr-rows';
    options.forEach((option, index) => rows.appendChild(this.optionRow(option, index)));
    if (!options.length) {
      const empty = document.createElement('div');
      empty.className = 'tablify__optmgr-empty';
      empty.textContent = 'No options yet.';
      rows.appendChild(empty);
    }
    this.body.appendChild(rows);

    const add = document.createElement('div');
    add.className = 'tablify__optmgr-add';
    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'tablify__optmgr-input';
    input.placeholder = 'New option…';
    input.setAttribute('aria-label', 'New option');
    const submit = (): void => {
      if (this.add(input.value)) input.value = '';
    };
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        submit();
      }
      ev.stopPropagation();
    });
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tablify__optmgr-addbtn';
    button.textContent = 'Add';
    button.addEventListener('click', submit);
    add.appendChild(input);
    add.appendChild(button);
    this.body.appendChild(add);

    const hint = document.createElement('p');
    hint.className = 'tablify__optmgr-hint';
    hint.textContent = 'Rename, recolor (click swatch), reorder (arrows), delete. Changes are undoable.';
    this.body.appendChild(hint);
  }

  private optionRow(option: SelectOption, index: number): HTMLElement {
    const row = document.createElement('div');
    row.className = 'tablify__optmgr-row';
    row.dataset.optionId = option.id;

    row.appendChild(this.glyphButton('arrow-up', 'Move up', () => this.moveBy(index, -1)));
    row.appendChild(this.glyphButton('arrow-down', 'Move down', () => this.moveBy(index, 1)));

    // Swatch — click cycles the colour, prototype `optMgrColor`.
    const swatch = document.createElement('button');
    swatch.type = 'button';
    swatch.className = 'tablify__optmgr-swatch';
    swatch.title = `Cycle color (${option.color})`;
    swatch.style.background = optionChipColors(option.color, 'light').dot;
    swatch.addEventListener('click', () => this.cycleColor(index));
    row.appendChild(swatch);

    const name = document.createElement('input');
    name.type = 'text';
    name.className = 'tablify__optmgr-name';
    name.value = option.name;
    name.setAttribute('aria-label', `Name of ${option.name}`);
    const commitName = (): void => {
      const next = name.value.trim();
      if (!next || next === option.name) {
        name.value = option.name;
        return;
      }
      this.rename(option.id, next);
    };
    name.addEventListener('change', commitName);
    name.addEventListener('keydown', (ev) => {
      if (ev.key === 'Enter') {
        ev.preventDefault();
        commitName();
        name.blur();
      }
      ev.stopPropagation();
    });
    row.appendChild(name);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'tablify__optmgr-delete';
    // SAD-109: aria-label only (one tooltip).
    remove.setAttribute('aria-label', `Delete ${option.name}`);
    remove.innerHTML = faIcon('trash-can', 11);
    remove.addEventListener('click', () => {
      const plan = planOptionRemoval(option.id, this.field, this.store);
      this.commit(plan.options, plan.values);
    });
    row.appendChild(remove);
    return row;
  }

  private glyphButton(
    glyph: 'arrow-up' | 'arrow-down',
    label: string,
    onClick: () => void,
  ): HTMLElement {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tablify__optmgr-move';
    // SAD-109: aria-label only (one tooltip).
    button.setAttribute('aria-label', label);
    button.innerHTML = faIcon(glyph, 10);
    button.addEventListener('click', onClick);
    return button;
  }

  private moveBy(index: number, delta: number): void {
    const ids = (this.field.options ?? []).map((o) => o.id);
    const target = index + delta;
    if (target < 0 || target >= ids.length) return;
    [ids[index], ids[target]] = [ids[target], ids[index]];
    this.reorder(ids);
  }

  private cycleColor(index: number): void {
    const option = (this.field.options ?? [])[index];
    if (!option) return;
    const current = OPTION_COLORS.indexOf(option.color);
    const next = OPTION_COLORS[(current + 1) % OPTION_COLORS.length];
    this.recolor(option.id, next);
  }
}
