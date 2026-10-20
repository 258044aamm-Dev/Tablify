// Obsidian wiring for "Export table" (P4-05). Thin layer: logic is in src/io/export/.
// Flow: active .tablify file → modal (format, "Full table" checkbox; default is current view) →
// explicit system save/share/download destination outside the vault. Failures are reported to the user.

import { App, Modal, Notice, Platform, Plugin, Setting, TFile } from 'obsidian';
import {
  beginExportSave,
  browserExportSaveRuntime,
  exportDeliveryMethod,
  saveExportArtifact,
  shareExportArtifact,
  type ExportSaveRuntime,
} from '../io/export/destination.js';
import { prepareExportFile, type PreparedExportResult } from '../io/export/prepare.js';
import { exportFileName, exportMimeType, type ExportArtifact, type ExportFormat } from '../io/export/exporter.js';

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
  method: 'picker' | 'share' | 'download' | 'folder',
  fileName: string,
  rowCount: number,
  columnCount: number,
  displayPath?: string,
): string {
  if (method === 'picker') return `Exported ${rowCount} rows and ${columnCount} columns to ${fileName} in the selected location.`;
  if (method === 'share') return `Shared ${rowCount} rows and ${columnCount} columns as ${fileName}.`;
  if (method === 'folder') return `Saved ${fileName} (${rowCount} rows, ${columnCount} columns) to ${displayPath ?? 'a shared folder'}.`;
  return `Download started: ${fileName} (${rowCount} rows, ${columnCount} columns).`;
}

/** The numbers a share notice reports, carried next to the artifact they describe. */
interface SharePayload {
  artifact: ExportArtifact;
  rowCount: number;
  columnCount: number;
}

/**
 * SAD-350: hand `payload.artifact` to the system sheet and report the outcome. Must be called
 * while the user's tap is still on the stack — shareExportArtifact reaches the share call
 * synchronously. On a lost-activation refusal (WebKit NotAllowedError) a retry modal is opened
 * so the next tap shares the already-built file; `stale` is that modal to close on success.
 */
function shareWithFeedback(app: App, payload: SharePayload, runtime: ExportSaveRuntime, stale: Modal | null): void {
  const attempt = shareExportArtifact(payload.artifact, runtime);
  void attempt.then((shared) => {
    if (shared.ok) {
      new Notice(exportSuccessMessage('share', shared.fileName, payload.rowCount, payload.columnCount));
      stale?.close();
      return;
    }
    if (shared.kind === 'cancelled') {
      new Notice('Export cancelled. No file was saved.');
      return;
    }
    if (shared.kind === 'activation') {
      new ExportShareRetryModal(app, payload, runtime).open();
      stale?.close();
      return;
    }
    new Notice(`Export failed. No file was saved. ${shared.error}`);
  });
}

/**
 * SAD-350: shown only when the system refused a share because the triggering tap was spent
 * (slow preparation, e.g. a huge XLSX). The file is already built; a fresh tap shares it.
 */
export class ExportShareRetryModal extends Modal {
  constructor(
    app: App,
    private readonly payload: SharePayload,
    private readonly runtime: ExportSaveRuntime,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle(`Export ${this.payload.artifact.fileName}`);
    new Setting(this.contentEl)
      .setName('Your file is ready')
      .setDesc('The system needs a fresh tap to open the save dialog.')
      .addButton((b) =>
        b
          .setButtonText('Save file')
          .setCta()
          .onClick(() => shareWithFeedback(this.app, this.payload, this.runtime, this)),
      );
  }
}

/** One pre-built export per (format, fullTable) choice, so a tap can share without waiting. */
interface PreparedEntry {
  key: string;
  settled: PreparedExportResult | null;
  promise: Promise<PreparedExportResult>;
}

class ExportModal extends Modal {
  private format: ExportFormat = 'csv';
  private fullTable = false;
  private readonly runtime: ExportSaveRuntime;
  private prepared: PreparedEntry | null = null;
  private flushed: Promise<void> | null = null;

  constructor(app: App, private readonly source: TFile) {
    super(app);
    this.runtime = browserExportSaveRuntime(typeof Platform === 'undefined' ? false : Platform.isMobile);
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
            this.startPreparation();
          }),
      );
    new Setting(this.contentEl)
      .setName('Full table')
      .setDesc('Off: current view (saved filters, sort, visible fields and order). On: every field and row.')
      .addToggle((t) =>
        t.setValue(this.fullTable).onChange((v) => {
          this.fullTable = v;
          this.startPreparation();
        }),
      );
    new Setting(this.contentEl).addButton((b) =>
      b
        .setButtonText('Export')
        .setCta()
        .onClick(() => {
          // SAD-350: the share destination (iOS Files dialog) needs the user's tap intact, so
          // it takes the pre-built artifact path; every other destination keeps the P4-05 flow.
          if (exportDeliveryMethod(this.runtime) === 'share') {
            this.runShare();
            return;
          }
          void this.run();
        }),
    );
    // SAD-350: on a share-destination device, build the export while the user looks at the
    // options — the Export tap must reach the system share call without awaiting anything.
    this.startPreparation();
  }

  /**
   * Prepare the export for the current (format, fullTable) choice. Share destinations only;
   * a no-op elsewhere. The table cannot be edited while this modal is open, so the snapshot
   * cannot go stale; pending edits are flushed once before the first read.
   */
  private startPreparation(): void {
    if (exportDeliveryMethod(this.runtime) !== 'share') return;
    const key = `${this.format}|${this.fullTable}`;
    if (this.prepared?.key === key) return;
    this.flushed ??= flushPendingExportEdits(this.app, this.source);
    const format = this.format;
    const fullTable = this.fullTable;
    const entry: PreparedEntry = {
      key,
      settled: null,
      promise: (async (): Promise<PreparedExportResult> => {
        try {
          await this.flushed;
        } catch (error) {
          return {
            ok: false,
            error: `Pending table edits could not be saved: ${error instanceof Error ? error.message : String(error)}`,
          };
        }
        return prepareExportFile(() => this.app.vault.read(this.source), this.source.basename, format, { fullTable });
      })(),
    };
    void entry.promise.then((result) => {
      entry.settled = result;
    });
    this.prepared = entry;
  }

  /** Share path (iOS). When preparation has settled, the share starts inside this very tap. */
  private runShare(): void {
    this.startPreparation();
    const entry = this.prepared;
    if (!entry) return;
    if (entry.settled) {
      this.shareResult(entry.settled);
      return;
    }
    // Still preparing (large table): finish first, then attempt. If the tap expired meanwhile,
    // shareWithFeedback opens the retry modal so the next tap shares the finished file.
    void entry.promise.then((result) => this.shareResult(result));
  }

  private shareResult(result: PreparedExportResult): void {
    if (!result.ok) {
      new Notice(`Export failed. No file was saved. ${result.error}`);
      return;
    }
    shareWithFeedback(
      this.app,
      { artifact: result.artifact, rowCount: result.rowCount, columnCount: result.columnCount },
      this.runtime,
      this,
    );
  }

  private async run(): Promise<void> {
    const format = this.format;
    const baseName = this.source.basename;
    const runtime = this.runtime;
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

    new Notice(exportSuccessMessage(saved.method, saved.fileName, prepared.rowCount, prepared.columnCount, saved.displayPath));
    this.close();
  }
}
