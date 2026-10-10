/**
 * Edit-formula modal (P8-03, SAD-62). Opened from a formula field's header menu.
 * Validates the expression's syntax before closing, so a syntax error keeps the dialog open
 * with the text intact. Name errors and cycles are not blocked: they show on the cell.
 */

import { App, Modal, Notice, Setting } from 'obsidian';
import { applyTheme } from '../../ui/theme/tokens.js';
import { compileFormula } from '../../formula/index.js';

export class FormulaEditModal extends Modal {
  private expression: string;

  constructor(
    app: App,
    initial: string,
    private readonly onSave: (expression: string) => void,
  ) {
    super(app);
    this.expression = initial;
  }

  onOpen(): void {
    this.setTitle('Edit formula');
    this.modalEl.addClass('tablify__modal');
    applyTheme(this.modalEl, document.body.classList.contains('theme-dark') ? 'dark' : 'light');

    new Setting(this.contentEl)
      .setName('Formula')
      .setDesc('Refer to fields as {Field name}. Example: {Price} * {Quantity}')
      .addText((text) =>
        text.setValue(this.expression).setPlaceholder('{Price} * 2').onChange((value) => {
          this.expression = value;
        }),
      );

    new Setting(this.contentEl).addButton((button) =>
      button
        .setButtonText('Save formula')
        .setCta()
        .onClick(() => this.submit()),
    );

    this.contentEl.addEventListener('keydown', (event) => {
      const evt = event as KeyboardEvent;
      if (evt.key === 'Enter' && (evt.target as HTMLElement | null)?.tagName === 'INPUT') {
        evt.preventDefault();
        this.submit();
      }
    });
  }

  private submit(): void {
    const compiled = compileFormula(this.expression);
    if (!compiled.ok) {
      new Notice('The formula has a syntax error.');
      return;
    }
    this.close();
    this.onSave(this.expression);
  }
}
