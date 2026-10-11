/**
 * Select panel — the view for `single_select` / `multi_select` cells, built to the prototype's
 * `#floatPanel` select screen (`Prototype/script.js` `renderSelectPanel`, ~line 895): search box,
 * colour-chip option rows with the pick check, `Create "…"`, and the footer's Clear / Manage
 * options. Geometry and type sizes follow the prototype's classes (`p-2` body, `max-h-52` list,
 * `text-xs`, chip `px-2.5 py-0.5 text-[11px]`); paint lives in the `.tablify__dropdown*` and
 * `.tablify__chip*` rules in styles.css.
 *
 * Model work stays in `src/model/selectOptions.ts` (trimmed, case-insensitive dedup). The cell
 * write belongs to the caller, so this class never touches the store.
 *
 * Prototype behaviour kept: the search box filters, `Create "…"` appears only when the typed name
 * has no exact match, Enter picks an exact match or creates, Escape dismisses, IME composition
 * never commits. Added: ArrowUp / ArrowDown move a highlighted row (Enter then picks it),
 * `open(anchor)` anchors the panel under the cell exactly like the prototype's `openPanel()`, and
 * a host-supplied `createOption` lets a new option land in the same undo step as the cell write.
 */

import { createSelectOptionManager } from '../../../model/selectOptions.js';
import { optionChipColors, optionChipHue } from '../../../ui/theme/tokens.js';
import { faIcon } from '../../../ui/faIcons.js';
import { anchorPanel, createPanelCard, wirePanelDismiss } from './panel.js';
import type { CellValue, FieldDefinition, SelectOption } from '../../../model/types.js';

export interface DropdownOptions {
  field: FieldDefinition;
  /** Current cell value — the picked rows carry the prototype's check glyph. */
  value?: CellValue;
  onSelect: (option: SelectOption) => void;
  onCreate: (option: SelectOption) => void;
  /**
   * Optional: create an option (case-insensitive dedup is the model's job) and return it, the
   * existing one included. Defaults to `selectOptions.findOrCreate` on the field, which the unit
   * tests rely on; the host passes this to route the new option through the undo stack.
   */
  createOption?: (name: string) => SelectOption;
  /** Prototype footer: Clear. Omitted = the button is not rendered. */
  onClear?: () => void;
  /** Prototype footer: Manage options. Omitted = the link is not rendered. */
  onManageOptions?: () => void;
  /** Escape (and the outside press this panel wires up) land here. */
  onDismiss?: () => void;
  /** Theme of the host surface; picks the chip ink. */
  theme?: 'light' | 'dark';
}

const SEARCH_PLACEHOLDER = 'Search or create…';
/** Prototype empty text when the field has no options at all. */
const EMPTY_HINT = 'No options yet — type to create.';

/**
 * Chip colours are a class plus one scoped stylesheet per panel, not inline styles on every row:
 * a long option list has to open inside the P3-03 budget, and a per-row CSSOM write costs more
 * than the whole rest of the row in the test environment (and buys nothing in a browser). The
 * rules are generated from the palette (`optionChipColors`), so no colour literal leaves tokens.ts.
 */
function chipRule(hue: string, theme: 'light' | 'dark'): string {
  const c = optionChipColors(hue, theme);
  return (
    `.tablify__panel .tablify__chip--${hue}{background:${c.background};` +
    `border-color:${c.border};color:${c.text}}` +
    `.tablify__panel .tablify__chip--${hue} .tablify__chip-dot{background:${c.dot}}`
  );
}

export class SelectDropdown {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private list: HTMLElement;
  private foot: HTMLElement;
  private manager = createSelectOptionManager();
  private isComposing = false;
  private items: HTMLButtonElement[] = [];
  private activeIndex = -1;
  private style: HTMLStyleElement;
  private unwireDismiss: (() => void) | null = null;
  private theme: 'light' | 'dark';

  constructor(private opts: DropdownOptions) {
    this.theme = opts.theme ?? 'light';
    const { card, body } = createPanelCard('tablify-select-panel', this.theme);
    this.container = card;
    this.container.setAttribute('aria-label', `Options for ${opts.field.name}`);

    this.input = document.createElement('input');
    this.input.className = 'tablify__dropdown-input';
    this.input.type = 'text';
    this.input.placeholder = SEARCH_PLACEHOLDER;
    this.input.setAttribute('aria-label', SEARCH_PLACEHOLDER);
    this.input.addEventListener('compositionstart', () => (this.isComposing = true));
    this.input.addEventListener('compositionend', () => {
      this.isComposing = false;
      this.render();
    });
    this.input.addEventListener('input', () => {
      if (!this.isComposing) this.render();
    });
    this.input.addEventListener('keydown', (e) => this.onKey(e));

    this.list = document.createElement('div');
    this.list.className = 'tablify__dropdown-list';

    this.foot = document.createElement('div');
    this.foot.className = 'tablify__dropdown-foot';

    this.style = document.createElement('style');
    this.style.dataset.testid = 'tablify-select-panel-styles';

    body.appendChild(this.input);
    body.appendChild(this.list);
    body.appendChild(this.foot);
    this.container.insertBefore(this.style, body);
    this.render();
  }

  get element(): HTMLElement {
    return this.container;
  }

  /** Anchor the panel under a cell and take over dismissal, like `openPanel()` does. */
  open(anchor: HTMLElement): void {
    // The panel lives in the document, not in the grid: re-rendering the grid must not take it
    // down with it (the prototype keeps one `#floatPanel` beside the app, `index.html:472`).
    if (!this.container.isConnected) document.body.appendChild(this.container);
    anchorPanel(this.container, anchor);
    this.input.focus();
    this.input.setSelectionRange(this.input.value.length, this.input.value.length);
    this.unwireDismiss ??= wirePanelDismiss(this.container, () => this.dismiss());
  }

  /**
   * Point the panel at the live definition. The store swaps the field object out whenever an
   * option-list change goes through the command stack, so the host calls this after `createOption`.
   */
  setField(field: FieldDefinition): void {
    this.opts.field = field;
    this.render();
  }

  /** Update the picked set without rebuilding the panel (multi-select toggles stay open). */
  setValue(value: CellValue): void {
    this.opts.value = value;
    this.render();
  }

  close(): void {
    this.unwireDismiss?.();
    this.unwireDismiss = null;
    this.container.remove();
  }

  private dismiss(): void {
    this.close();
    this.opts.onDismiss?.();
  }

  // ---- behaviour -------------------------------------------------------------------------

  private onKey(e: KeyboardEvent): void {
    if (this.isComposing) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      this.move(1);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      this.move(-1);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      this.commit();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      this.dismiss();
    }
    e.stopPropagation();
  }

  private move(delta: number): void {
    if (!this.items.length) return;
    const next = this.activeIndex + delta;
    this.activeIndex = next < 0 ? this.items.length - 1 : next >= this.items.length ? 0 : next;
    this.items.forEach((row, i) =>
      row.classList.toggle('tablify__dropdown-item--active', i === this.activeIndex),
    );
  }

  private commit(): void {
    const raw = this.input.value.trim();
    const active = this.items[this.activeIndex];
    if (active) {
      const opt = this.optionById(active.dataset.optionId ?? '');
      if (opt) {
        this.pick(opt);
        return;
      }
    }
    if (!raw) return;
    const lower = raw.toLowerCase();
    const exact = (this.opts.field.options ?? []).find((o) => o.name.trim().toLowerCase() === lower);
    if (exact) this.pick(exact);
    else this.createOption();
  }

  /** A new name: one option per spelling (dedup), then the caller writes the cell. */
  private createOption(): void {
    const raw = this.input.value.trim();
    if (!raw) return;
    const option = this.opts.createOption
      ? this.opts.createOption(raw)
      : this.manager.findOrCreate(raw, this.opts.field);
    this.input.value = '';
    this.render();
    this.opts.onCreate(option);
  }

  private pick(option: SelectOption): void {
    this.opts.onSelect(option);
  }

  private optionById(id: string): SelectOption | undefined {
    return (this.opts.field.options ?? []).find((o) => o.id === id);
  }

  /** The picked ids (prototype `curIds`) — string cells or arrays, never mixed. */
  private pickedIds(): string[] {
    const v = this.opts.value;
    if (this.opts.field.type === 'multi_select') {
      return Array.isArray(v) ? v.map((x) => String(x)) : [];
    }
    return typeof v === 'string' && v ? [v] : [];
  }

  private render(): void {
    const raw = this.input.value.trim();
    const lower = raw.toLowerCase();
    const options = this.opts.field.options ?? [];
    const filtered = lower ? options.filter((o) => o.name.toLowerCase().includes(lower)) : options;
    const picked = this.pickedIds();
    const usedHues = new Set<string>();

    this.list.textContent = '';
    this.items = [];
    for (const opt of filtered) {
      const row = document.createElement('button');
      row.type = 'button';
      row.className = 'tablify__dropdown-item';
      row.dataset.optionId = opt.id;
      const hue = optionChipHue(opt.color);
      usedHues.add(hue);
      const chip = document.createElement('span');
      chip.className = `tablify__chip tablify__chip--${hue}`;
      const dot = document.createElement('span');
      dot.className = 'tablify__chip-dot';
      const label = document.createElement('span');
      label.className = 'tablify__chip-label';
      label.textContent = opt.name;
      chip.appendChild(dot);
      chip.appendChild(label);
      row.appendChild(chip);
      if (picked.includes(opt.id)) {
        const check = document.createElement('span');
        check.className = 'tablify__dropdown-check';
        check.innerHTML = faIcon('check', 12);
        row.appendChild(check);
      }
      row.addEventListener('click', () => this.pick(opt));
      this.list.appendChild(row);
      this.items.push(row);
    }
    if (!options.length && !raw) {
      const hint = document.createElement('div');
      hint.className = 'tablify__dropdown-empty';
      hint.textContent = EMPTY_HINT;
      this.list.appendChild(hint);
    }
    const exact = options.some((o) => o.name.trim().toLowerCase() === lower);
    if (raw && !exact) {
      const create = document.createElement('button');
      create.type = 'button';
      create.className = 'tablify__dropdown-create';
      const icon = document.createElement('span');
      icon.className = 'tablify__dropdown-create-icon';
      icon.innerHTML = faIcon('plus', 10);
      const name = document.createElement('b');
      name.textContent = raw;
      create.appendChild(icon);
      create.appendChild(document.createTextNode('Create "'));
      create.appendChild(name);
      create.appendChild(document.createTextNode('"'));
      create.addEventListener('click', () => this.createOption());
      this.list.appendChild(create);
    }
    this.activeIndex = -1;
    this.style.textContent = [...usedHues].sort().map((h) => chipRule(h, this.theme)).join('');
    this.renderFoot();
    // The prototype rebuilds the panel through `openPanel()`, which re-focuses the search box
    // (`script.js:744`); keep the same resting state after a pick, create or clear.
    const active = document.activeElement as unknown as HTMLElement | null;
    if (this.container.isConnected && active !== this.input) this.input.focus();
  }

  /** Prototype footer: Clear on the left, Manage options on the right (only when wired). */
  private renderFoot(): void {
    const { onClear, onManageOptions } = this.opts;
    this.foot.textContent = '';
    if (!onClear && !onManageOptions) {
      this.foot.hidden = true;
      return;
    }
    this.foot.hidden = false;
    if (onClear) {
      const clear = document.createElement('button');
      clear.type = 'button';
      clear.className = 'tablify__dropdown-clear';
      clear.textContent = 'Clear';
      clear.addEventListener('click', () => {
        onClear();
        this.close();
      });
      this.foot.appendChild(clear);
    }
    if (onManageOptions) {
      const manage = document.createElement('button');
      manage.type = 'button';
      manage.className = 'tablify__dropdown-manage';
      const icon = document.createElement('span');
      icon.className = 'tablify__dropdown-manage-icon';
      icon.innerHTML = faIcon('palette', 11);
      manage.appendChild(icon);
      manage.appendChild(document.createTextNode('Manage options'));
      manage.addEventListener('click', () => {
        onManageOptions();
        this.close();
      });
      this.foot.appendChild(manage);
    }
  }

  // For tests: get visible items
  getVisibleOptionNames(): string[] {
    return Array.from(this.list.querySelectorAll('.tablify__dropdown-item')).map(
      (el) => (el as HTMLElement).textContent ?? '',
    );
  }

  hasCreateOption(): boolean {
    return !!this.list.querySelector('.tablify__dropdown-create');
  }
}
