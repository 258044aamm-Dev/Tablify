/**
 * Hosts the filter builder (SAD-78) in an Obsidian Modal, like AddFieldModal. The prototype's
 * builder is a centred modal card (`#filterModal`); the shell is themed with the plugin ladder
 * (`tablify__modal`), the content is the pure-DOM FilterBuilder.
 */

import { App, Modal } from 'obsidian';
import { applyTheme } from '../../ui/theme/tokens.js';
import { faIcon } from '../../ui/faIcons.js';
import type { FieldDefinition } from '../../model/types.js';
import { FilterBuilder } from './filterBuilder.js';

export class FilterBuilderModal extends Modal {
  builder: FilterBuilder | null = null;

  constructor(
    app: App,
    private readonly fields: FieldDefinition[],
    private readonly input: string,
    private readonly onApply: (input: string) => void,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Filter builder');
    this.modalEl.addClass('tablify__modal');
    this.modalEl.addClass('tablify__fb-modal');
    applyTheme(this.modalEl, document.body.classList.contains('theme-dark') ? 'dark' : 'light');
    // Prototype heading: terracotta filter glyph before the title.
    const icon = document.createElement('span');
    icon.className = 'tablify__fb-title-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = faIcon('filter');
    this.titleEl.prepend(icon);

    this.builder = new FilterBuilder(this.fields, this.input, {
      onApply: (input) => {
        this.onApply(input);
        this.close();
      },
      onCancel: () => this.close(),
    });
    this.contentEl.appendChild(this.builder.root);
  }

  onClose(): void {
    this.contentEl.textContent = '';
    this.builder = null;
  }
}
