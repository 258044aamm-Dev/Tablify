// Obsidian wiring for "Export table" (P4-05). Thin layer: logic is in src/io/export/.
// Flow: active .tablify file → modal (format, "Full table" checkbox; default is current view) → write
// one new file next to the table. Never overwrites. Failure shows a notice and writes nothing.

import { App, Modal, Notice, Plugin, Setting, TFile } from 'obsidian';
import { parse } from '../format/parse.js';
import { exportTable, type ExportAdapter, type ExportFormat } from '../io/export/exporter.js';

export const EXPORT_COMMAND_ID = 'export-table';
export const EXPORT_COMMAND_NAME = 'Export table (CSV, Excel, Markdown)';

/** SAD-98: the one-click current-view actions kept as commands after leaving the title row. */
export const EXPORT_VIEW_CSV_COMMAND_ID = 'export-current-view-csv';
export const EXPORT_VIEW_CSV_COMMAND_NAME = 'Export current view as CSV';
export const COPY_MARKDOWN_COMMAND_ID = 'copy-current-view-markdown';
export const COPY_MARKDOWN_COMMAND_NAME = 'Copy current view as Markdown';

/**
 * What the SAD-98 current-view commands need from the open TableView. A structural type so this
 * module never imports views/tableView.js (tableView already imports this module).
 */
export interface CurrentViewExportTarget {
  exportCurrentViewCsv(): Promise<void>;
  copyCurrentViewMarkdown(): Promise<void>;
}

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

/**
 * SAD-98: command-palette entries for "Export current view as CSV" and "Copy current view as
 * Markdown" — the two quick actions removed from the title row. `getTable` resolves the active
 * TableView (wired in main.ts so this module stays free of view imports).
 */
export function registerCurrentViewExportCommands(
  plugin: Plugin,
  getTable: () => CurrentViewExportTarget | null,
): void {
  const run = (action: (table: CurrentViewExportTarget) => Promise<void>) => () => {
    const table = getTable();
    if (!table) {
      new Notice('Open a .tablify table first.');
      return;
    }
    void action(table);
  };
  plugin.addCommand({
    id: EXPORT_VIEW_CSV_COMMAND_ID,
    name: EXPORT_VIEW_CSV_COMMAND_NAME,
    callback: run((table) => table.exportCurrentViewCsv()),
  });
  plugin.addCommand({
    id: COPY_MARKDOWN_COMMAND_ID,
    name: COPY_MARKDOWN_COMMAND_NAME,
    callback: run((table) => table.copyCurrentViewMarkdown()),
  });
}

/** Open the export modal for a given table file (used by the file explorer menu, P5-01). */
export function openExportModal(app: App, file: TFile): void {
  new ExportModal(app, file).open();
}

/** Folder an export of `source` is written to: next to the table ("" = vault root). */
export function exportFolderOf(source: TFile): string {
  return source.parent && !source.parent.isRoot() ? source.parent.path : '';
}

/** Vault-backed writer for exports. `create`/`createBinary` fail if the path exists (never overwrite). */
export function vaultExportAdapter(app: App): ExportAdapter {
  return {
    exists: (path) => app.vault.getAbstractFileByPath(path) !== null,
    create: async (path, data) => {
      await app.vault.create(path, data);
    },
    createBinary: async (path, data) => {
      await app.vault.createBinary(path, data);
    },
  };
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
    const outcome = await exportTable({
      file: parsed.data,
      format: this.format,
      scope: { fullTable: this.fullTable },
      folder: exportFolderOf(this.source),
      baseName: this.source.basename,
      adapter: vaultExportAdapter(app),
    });
    if (!outcome.ok) {
      new Notice(`Export failed. No file was written. ${outcome.error}`);
      return;
    }
    new Notice(`Exported ${outcome.rowCount} rows and ${outcome.columnCount} columns to ${outcome.path}.`);
    this.close();
  }
}
