// Obsidian wiring for "Export table" (P4-05). Thin layer: logic is in src/io/export/.
// Flow: active .tablify file → modal (format, "Full table" checkbox; default is current view) → write
// one new file next to the table. Never overwrites. Failure shows a notice and writes nothing.

import { App, Modal, Notice, Plugin, Setting, TFile } from 'obsidian';
import { parse } from '../format/parse.js';
import { exportTable, type ExportFormat } from '../io/export/exporter.js';

export const EXPORT_COMMAND_ID = 'export-table';
export const EXPORT_COMMAND_NAME = 'Export table (CSV, Excel, Markdown)';

export function registerExportCommand(plugin: Plugin): void {
  plugin.addCommand({
    id: EXPORT_COMMAND_ID,
    name: EXPORT_COMMAND_NAME,
    callback: () => {
      const file = plugin.app.workspace.getActiveFile();
      if (!file || file.extension !== 'tablify') {
        new Notice('Open a .tablify table first.');
        return;
      }
      new ExportModal(plugin.app, file).open();
    },
  });
}

/** Open the export modal for a given table file (used by the file explorer menu, P5-01). */
export function openExportModal(app: App, file: TFile): void {
  new ExportModal(app, file).open();
}

class ExportModal extends Modal {
  private format: ExportFormat = 'csv';
  private fullTable = false;

  constructor(app: App, private readonly source: TFile) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(`Export ${this.source.basename}`);
    new Setting(this.contentEl)
      .setName('Format')
      .addDropdown((d) =>
        d
          .addOption('csv', 'CSV')
          .addOption('xlsx', 'Excel (.xlsx)')
          .addOption('md', 'Markdown table')
          .setValue(this.format)
          .onChange((v) => {
            this.format = v as ExportFormat;
          }),
      );
    new Setting(this.contentEl)
      .setName('Full table')
      .setDesc('Off: current view (saved sort, visible fields, column order). On: every field and row.')
      .addToggle((t) =>
        t.setValue(this.fullTable).onChange((v) => {
          this.fullTable = v;
        }),
      );
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText('Export')
        .setCta()
        .onClick(() => void this.run()),
    );
  }

  private async run(): Promise<void> {
    const app = this.app;
    const text = await app.vault.read(this.source);
    const parsed = parse(text);
    if (!parsed.ok) {
      new Notice(`Export failed. The table file could not be read: ${parsed.error}`);
      return;
    }
    const folder = this.source.parent && !this.source.parent.isRoot() ? this.source.parent.path : '';
    const outcome = await exportTable({
      file: parsed.data,
      format: this.format,
      scope: { fullTable: this.fullTable },
      folder,
      baseName: this.source.basename,
      adapter: {
        exists: (path) => app.vault.getAbstractFileByPath(path) !== null,
        create: async (path, data) => {
          await app.vault.create(path, data);
        },
        createBinary: async (path, data) => {
          await app.vault.createBinary(path, data);
        },
      },
    });
    if (!outcome.ok) {
      new Notice(`Export failed. No file was written. ${outcome.error}`);
      return;
    }
    new Notice(`Exported ${outcome.rowCount} rows and ${outcome.columnCount} columns to ${outcome.path}.`);
    this.close();
  }
}
