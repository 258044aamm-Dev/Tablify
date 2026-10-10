/**
 * Add-field modal (SAD-70 / SAD-69 Step 5).
 *
 * Follows the ExportModal pattern in src/commands/export.ts: an Obsidian Modal built from
 * Setting rows. The type list is shared with the header menu's "Change field type…" via
 * CHANGE_TARGET_TYPES, so both pickers offer exactly the same set.
 *
 * Built here rather than in Step 4 so it lands together with the obsidian test mock and can
 * actually be tested — see tests/views/addFieldModal.test.ts.
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import { applyTheme } from '../../ui/theme/tokens.js';
import { CHANGE_TARGET_TYPES, TYPE_LABELS } from '../../menus/tableMenuModel.js';
import type { FieldTypeName } from '../../model/types.js';
import { compileFormula } from '../../formula/index.js';

/** Type preselected when the modal opens. */
export const DEFAULT_NEW_FIELD_TYPE: FieldTypeName = 'text';

/** A table a link field can point to (P8-04). */
export interface LinkTargetChoice {
  tableId: string;
  name: string;
}

export interface AddFieldOptions {
  /** Tables offered for a Link field. The current table should be first. */
  linkTargets?: LinkTargetChoice[];
  /** Preselected link target. Defaults to the first entry of linkTargets. */
  defaultLinkTableId?: string;
}

export class AddFieldModal extends Modal {
  private name = '';
  private type: FieldTypeName = DEFAULT_NEW_FIELD_TYPE;
  private expression = '';
  private linkTableId: string;

  constructor(
    app: App,
    private readonly onConfirm: (name: string, type: FieldTypeName, formula?: string, linkTableId?: string) => void,
    private readonly options: AddFieldOptions = {},
  ) {
    super(app);
    this.linkTableId = options.defaultLinkTableId ?? options.linkTargets?.[0]?.tableId ?? '';
  }

  onOpen(): void {
    this.setTitle('Add field');

    // SAD-71 Step 3: the dialog wears the plugin ladder (card surface, subtle border,
    // rounded corners) instead of the host Obsidian modal chrome — branding.md §3.
    this.modalEl.addClass('tablify__modal');
    applyTheme(this.modalEl, document.body.classList.contains('theme-dark') ? 'dark' : 'light');

    new Setting(this.contentEl)
      .setName('Field name')
      .setDesc('Shown as the column heading.')
      .addText((text) =>
        text.setValue(this.name).onChange((value) => {
          this.name = value;
        }),
      );

    new Setting(this.contentEl)
      .setName('Field type')
      .addDropdown((dropdown) => {
        for (const type of CHANGE_TARGET_TYPES) {
          dropdown.addOption(type, TYPE_LABELS[type] ?? type);
        }
        dropdown.setValue(this.type).onChange((value) => {
          this.type = value as FieldTypeName;
          showTypeRows();
        });
      });

    // P8-03: the expression is asked for only when the type is Formula.
    const formulaRow = this.contentEl.createDiv();
    new Setting(formulaRow)
      .setName('Formula')
      .setDesc('Refer to fields as {Field name}. Example: {Price} * {Quantity}')
      .addText((text) =>
        text.setValue(this.expression).setPlaceholder('{Price} * 2').onChange((value) => {
          this.expression = value;
        }),
      );

    // P8-04: a link field needs a target table.
    const linkRow = this.contentEl.createDiv();
    const targets = this.options.linkTargets ?? [];
    new Setting(linkRow)
      .setName('Link to table')
      .setDesc(targets.length === 0 ? 'No tables are available to link to.' : 'Rows are picked from this table.')
      .addDropdown((dropdown) => {
        for (const t of targets) dropdown.addOption(t.tableId, t.name);
        if (this.linkTableId) dropdown.setValue(this.linkTableId);
        dropdown.onChange((value) => {
          this.linkTableId = value;
        });
      });

    const showTypeRows = (): void => {
      formulaRow.style.display = this.type === 'formula' ? '' : 'none';
      linkRow.style.display = this.type === 'link' ? '' : 'none';
    };
    showTypeRows();

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText('Add field')
        .setCta()
        .onClick(() => this.submit()),
    );

    // Enter in the name field submits, as it does in Obsidian's own dialogs.
    this.contentEl.addEventListener('keydown', (event) => {
      const evt = event as KeyboardEvent;
      if (evt.key === 'Enter' && (evt.target as HTMLElement | null)?.tagName === 'INPUT') {
        evt.preventDefault();
        this.submit();
      }
    });
  }

  private submit(): void {
    const name = this.name.trim();
    if (!name) {
      new Notice('Field name cannot be empty.');
      return;
    }
    // Validate before closing, so the modal stays open with the user's text intact.
    if (this.type === 'link') {
      if (!this.linkTableId) {
        new Notice('Choose a table to link to.');
        return;
      }
      this.close();
      this.onConfirm(name, this.type, undefined, this.linkTableId);
      return;
    }
    if (this.type === 'formula') {
      const compiled = compileFormula(this.expression);
      if (!compiled.ok) {
        new Notice('The formula has a syntax error.');
        return;
      }
      this.close();
      this.onConfirm(name, this.type, this.expression);
      return;
    }
    this.close();
    this.onConfirm(name, this.type);
  }
}
