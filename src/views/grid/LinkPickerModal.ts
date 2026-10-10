/**
 * Row picker for a link cell (P8-04, SAD-63). Lists the rows of the field's default target table,
 * searchable by name, with checkboxes. Works on touch screens: each row is a full-width tap target.
 *
 * Rules:
 * - A link to a row that no longer exists stays listed under "Missing" and stays checked, so
 *   nothing is removed until the user unchecks it.
 * - Links into other tables are not editable here. They are kept as they are on save.
 * - Save writes through the caller (the command path). Clear sets the cell to empty.
 */

import { App, Modal, Setting } from 'obsidian';
import type { FieldDefinition, LinkRef } from '../../model/types.js';
import { applyTheme } from '../../ui/theme/tokens.js';
import { buildSelection, filterRows, type LinkableRow, type LinkIndex } from '../../model/link.js';

export interface LinkPickerOptions {
  app: App;
  field: FieldDefinition;
  current: LinkRef[];
  index: LinkIndex;
  /** Called once on Save or Clear. `null` means the cell is empty. */
  onSave: (refs: LinkRef[] | null) => void;
}

export class LinkPickerModal extends Modal {
  private readonly targetId: string;
  private readonly selected = new Set<string>();
  private order: string[] = [];
  private query = '';

  constructor(private readonly opts: LinkPickerOptions) {
    super(opts.app);
    this.targetId = opts.field.linkTableId ?? '';
    for (const ref of opts.current) {
      if (ref.tableId === this.targetId) {
        this.selected.add(ref.rowId);
        this.order.push(ref.rowId);
      }
    }
  }

  onOpen(): void {
    this.setTitle(`Link: ${this.opts.field.name}`);
    this.modalEl.addClass('tablify__modal');
    applyTheme(this.modalEl, document.body.classList.contains('theme-dark') ? 'dark' : 'light');
    this.render();
  }

  private render(): void {
    const root = this.contentEl;
    root.empty();
    const table = this.opts.index.byTableId(this.targetId);

    if (!table) {
      root.createEl('p', {
        text: 'The table this field links to is not in this vault. Existing links are kept until you clear them.',
        cls: 'tablify-link-picker__note',
      });
      new Setting(root)
        .addButton((b) => b.setButtonText('Clear links').setWarning().onClick(() => this.save(null)))
        .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()));
      return;
    }

    root.createEl('p', { text: `Rows in ${table.name}`, cls: 'tablify-link-picker__note' });
    const list = root.createDiv({ cls: 'tablify-link-picker__list' });
    const search = root.createEl('input', { type: 'text', cls: 'tablify-link-picker__search' }) as HTMLInputElement;
    search.placeholder = 'Search rows';
    search.value = this.query;
    search.addEventListener('input', () => {
      this.query = search.value;
      this.renderList(list, table.rows);
    });
    this.renderList(list, table.rows);

    new Setting(root)
      .addButton((b) => b.setButtonText('Clear').onClick(() => this.save(null)))
      .addButton((b) => b.setButtonText('Cancel').onClick(() => this.close()))
      .addButton((b) => b.setButtonText('Save').setCta().onClick(() => this.save(this.result(table.rows))));
  }

  private renderList(list: HTMLElement, rows: readonly LinkableRow[]): void {
    list.empty();
    const known = new Set(rows.map((r) => r.id));
    const missing = this.order.filter((id) => !known.has(id));
    if (missing.length > 0) {
      list.createDiv({ text: 'Missing (the row was deleted)', cls: 'tablify-link-picker__heading' });
      for (const id of missing) this.itemRow(list, id, 'Missing row', true);
    }
    const visible = filterRows(rows, this.query);
    if (visible.length === 0) {
      list.createDiv({ text: rows.length === 0 ? 'This table has no rows yet.' : 'No rows match.', cls: 'tablify-link-picker__note' });
    }
    for (const row of visible) this.itemRow(list, row.id, row.label.trim() || 'Untitled row', false);
    const others = this.opts.current.filter((r) => r.tableId !== this.targetId).length;
    if (others > 0) {
      list.createDiv({
        text: others === 1 ? '1 link to another table is kept.' : `${others} links to other tables are kept.`,
        cls: 'tablify-link-picker__note',
      });
    }
  }

  private itemRow(list: HTMLElement, rowId: string, label: string, missing: boolean): void {
    const row = list.createEl('label', { cls: 'tablify-link-picker__row' });
    const box = row.createEl('input', { type: 'checkbox' }) as HTMLInputElement;
    box.checked = this.selected.has(rowId);
    box.addEventListener('change', () => {
      if (box.checked) {
        this.selected.add(rowId);
        if (!this.order.includes(rowId)) this.order.push(rowId);
      } else {
        this.selected.delete(rowId);
      }
    });
    row.createSpan({ text: label, cls: missing ? 'tablify-link-picker__missing' : '' });
  }

  /** Selected rows in display order, then combined with the kept links to other tables. */
  private result(rows: readonly LinkableRow[]): LinkRef[] | null {
    const displayed = rows.map((r) => r.id).filter((id) => this.selected.has(id));
    const missing = this.order.filter((id) => this.selected.has(id) && !rows.some((r) => r.id === id));
    return buildSelection(this.opts.current, this.targetId, [...missing, ...displayed]);
  }

  private save(refs: LinkRef[] | null): void {
    this.close();
    this.opts.onSave(refs);
  }
}
