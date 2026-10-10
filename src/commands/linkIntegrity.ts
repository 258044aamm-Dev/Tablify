// Obsidian wiring for "Check link integrity" (P8-04). Logic is in src/links/linkModel.ts.
// Flow: refresh the vault index, check every link cell in every table, show the broken ones.
// Read-only: the check never changes a file.

import { App, Modal, Plugin } from 'obsidian';
import { linkIndexFor } from '../links/vaultLinkIndex.js';
import { checkIntegrity, type IntegrityReport } from '../links/linkModel.js';

export const LINK_INTEGRITY_COMMAND_ID = 'tablify-link-integrity';
export const LINK_INTEGRITY_COMMAND_NAME = 'Check link integrity (all tables)';

export function registerLinkIntegrityCommand(plugin: Plugin): void {
  plugin.addCommand({
    id: LINK_INTEGRITY_COMMAND_ID,
    name: LINK_INTEGRITY_COMMAND_NAME,
    callback: () => void runLinkIntegrityCheck(plugin.app),
  });
}

async function runLinkIntegrityCheck(app: App): Promise<void> {
  const idx = linkIndexFor(app);
  await idx.refresh();
  new LinkIntegrityModal(app, checkIntegrity(idx.index)).open();
}

export class LinkIntegrityModal extends Modal {
  constructor(app: App, private readonly report: IntegrityReport) {
    super(app);
  }

  onOpen(): void {
    const r = this.report;
    this.setTitle('Link integrity');
    this.modalEl.addClass('tablify__modal');
    const summary =
      r.broken.length === 0
        ? `No broken links. ${r.checked} ${r.checked === 1 ? 'link' : 'links'} checked.`
        : `${r.broken.length} broken of ${r.checked} ${r.checked === 1 ? 'link' : 'links'} checked.`;
    this.contentEl.createEl('p', { text: summary, cls: 'tablify-link-integrity__summary' });

    if (r.broken.length > 0) {
      const list = this.contentEl.createEl('ul', { cls: 'tablify-link-integrity__list' });
      for (const b of r.broken) {
        const item = list.createEl('li');
        item.createSpan({ text: `${b.sourceTable} (${b.sourcePath})`, cls: 'tablify-link-integrity__where' });
        item.createSpan({ text: ` · ${b.fieldName} · ${b.rowLabel}: ${b.message}` });
        item.createDiv({ text: `Target: table ${b.targetTableId}, row ${b.targetRowId}`, cls: 'tablify-link-integrity__target' });
      }
    }

    if (r.duplicates.length > 0) {
      this.contentEl.createEl('p', {
        text: 'Some files share a table ID. Only the first file is used for links (copy a table to get a new ID).',
        cls: 'tablify-link-integrity__summary',
      });
      const list = this.contentEl.createEl('ul', { cls: 'tablify-link-integrity__list' });
      for (const d of r.duplicates) {
        list.createEl('li', { text: `${d.tableId}: ${d.paths.join(', ')}` });
      }
    }
  }
}
