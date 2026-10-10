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
import { CHANGE_TARGET_TYPES, TYPE_LABELS } from '../../menus/tableMenuModel.js';
import type { FieldTypeName } from '../../model/types.js';

/** Type preselected when the modal opens. */
export const DEFAULT_NEW_FIELD_TYPE: FieldTypeName = 'text';

export class AddFieldModal extends Modal {
  private name = '';
  private type: FieldTypeName = DEFAULT_NEW_FIELD_TYPE;

  constructor(
    app: App,
    private readonly onConfirm: (name: string, type: FieldTypeName) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Add field');

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
        });
      });

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
    this.close();
    this.onConfirm(name, this.type);
  }
}
