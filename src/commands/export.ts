// Obsidian wiring for "Export table" (P4-05). Thin layer: logic is in src/io/export/.
// Flow: active .tablify file → modal (format, "Full table" checkbox; default is current view) →
// explicit system save/share/download destination outside the vault. Failures are reported to the user.

import { App, Modal, Notice, Platform, Plugin, Setting, TFile } from 'obsidian';
import { beginExportSave, browserExportSaveRuntime, saveExportArtifact } from '../io/export/destination.js';
import { prepareExportFile } from '../io/export/prepare.js';
import { exportFileName, exportMimeType, type ExportFormat } from '../io/export/exporter.js';

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

/** Flush the matching open TableView before an export reads the file from the vault. */
export async function flushPendingExportEdits(app: App, source: TFile): Promise<void> {
  const active = app.workspace.activeLeaf?.view as { file?: TFile | null; save?: () => Promise<void> } | undefined;
  const candidates = [
    ...(active ? [active] : []),
    ...app.workspace.getLeavesOfType('tablify').map((leaf) => leaf.view as { file?: TFile | null; save?: () => Promise<void> }),
  ];
  const view = candidates.find((candidate) => candidate.file?.path === source.path && typeof candidate.save === 'function');
  if (view?.save) await view.save();
}

function exportSuccessMessage(
  method: 'picker' | 'share' | 'download',
  fileName: string,
  rowCount: number,
  columnCount: number,
): string {
  if (method === 'picker') return `Exported ${rowCount} rows and ${columnCount} columns to ${fileName} in the selected location.`;
  if (method === 'share') return `Shared ${rowCount} rows and ${columnCount} columns as ${fileName}.`;
  return `Download started: ${fileName} (${rowCount} rows, ${columnCount} columns).`;
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
      .setDesc('Off: current view (saved filters, sort, visible fields and order). On: every field and row.')
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
    const format = this.format;
    const baseName = this.source.basename;
    const runtime = browserExportSaveRuntime(typeof Platform === 'undefined' ? false : Platform.isMobile);
    // Start a native picker directly from the button click so it retains user activation.
    const pickerStart = beginExportSave(exportFileName(baseName, format), exportMimeType(format), runtime);
    const picker = await pickerStart;
    if (picker.kind === 'cancelled') {
      new Notice('Export cancelled. No file was saved.');
      return;
    }

    try {
      await flushPendingExportEdits(this.app, this.source);
    } catch (error) {
      new Notice(`Export failed. Pending table edits could not be saved, so no file was saved. ${error instanceof Error ? error.message : String(error)}`);
      return;
    }

    const prepared = await prepareExportFile(
      () => this.app.vault.read(this.source),
      baseName,
      format,
      { fullTable: this.fullTable },
    );
    if (!prepared.ok) {
      new Notice(`Export failed. No file was saved. ${prepared.error}`);
      return;
    }

    const saved = await saveExportArtifact(prepared.artifact, runtime, Promise.resolve(picker));
    if (!saved.ok) {
      if (!saved.cancelled) new Notice(`Export failed. No file was saved. ${saved.error}`);
      else new Notice('Export cancelled. No file was saved.');
      return;
    }

    new Notice(exportSuccessMessage(saved.method, saved.fileName, prepared.rowCount, prepared.columnCount));
    this.close();
  }
}
