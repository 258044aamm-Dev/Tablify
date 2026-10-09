// Obsidian wiring for "Import CSV / Excel as table" (P4-04). Thin layer: the logic is in src/io/import/.
// Flow: file picker → folder picker → importTable() → open the new file on success.
// Failure shows a notice and writes nothing.

import { App, FuzzySuggestModal, Notice, Plugin, TFile, TFolder } from 'obsidian';
import { importTable, type ImportKind } from '../io/import/importer.js';

export const IMPORT_COMMAND_ID = 'import-table';
export const IMPORT_COMMAND_NAME = 'Import CSV / Excel as table';

export function registerImportCommand(plugin: Plugin): void {
  plugin.addCommand({
    id: IMPORT_COMMAND_ID,
    name: IMPORT_COMMAND_NAME,
    callback: () => startImport(plugin.app),
  });
}

/**
 * Start the import flow. With `presetFolder` (from the folder menu, P5-01) the folder picker is skipped.
 * '' means the vault root.
 */
export function startImport(app: App, presetFolder?: string): void {
  pickFile(app, presetFolder);
}

function kindOf(name: string): ImportKind | null {
  const lower = name.toLowerCase();
  if (lower.endsWith('.csv')) return 'csv';
  if (lower.endsWith('.xlsx')) return 'xlsx';
  return null;
}

function pickFile(app: App, presetFolder?: string): void {
  const input = document.createElement('input');
  input.type = 'file';
  input.accept = '.csv,.xlsx';
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) void readThenChooseFolder(app, file, presetFolder);
  };
  input.click();
}

async function readThenChooseFolder(app: App, file: File, presetFolder?: string): Promise<void> {
  const kind = kindOf(file.name);
  if (kind === null) {
    new Notice('Choose a .csv or .xlsx file.');
    return;
  }
  const data = kind === 'csv' ? await file.text() : await file.arrayBuffer();
  if (presetFolder !== undefined) {
    void runImport(app, kind, file.name, data, presetFolder);
    return;
  }
  new FolderPicker(app, (folder) => void runImport(app, kind, file.name, data, folder)).open();
}

async function runImport(
  app: App,
  kind: ImportKind,
  fileName: string,
  data: string | ArrayBuffer,
  folder: string,
): Promise<void> {
  const outcome = await importTable({
    kind,
    fileName,
    data,
    folder,
    adapter: {
      exists: (path) => app.vault.getAbstractFileByPath(path) !== null,
      create: async (path, content) => {
        await app.vault.create(path, content);
      },
    },
  });

  if (!outcome.ok) {
    new Notice(`Import failed. No file was written. ${outcome.error}`);
    return;
  }

  const notes = outcome.ignoredSheets > 0 ? ` Only the first sheet was imported (${outcome.ignoredSheets} other sheet(s) ignored).` : '';
  new Notice(`Imported ${outcome.report.rowCount} rows to ${outcome.path}.${notes}`);

  const created = app.vault.getAbstractFileByPath(outcome.path);
  if (created instanceof TFile) {
    await app.workspace.getLeaf(true).openFile(created);
  }
}

/** Folder chooser. '' means the vault root. */
class FolderPicker extends FuzzySuggestModal<string> {
  constructor(app: App, private readonly onPick: (folder: string) => void) {
    super(app);
    this.setPlaceholder('Choose the folder for the new table');
  }

  getItems(): string[] {
    const folders = this.app.vault
      .getAllLoadedFiles()
      .filter((f): f is TFolder => f instanceof TFolder && !f.isRoot())
      .map((f) => f.path)
      .sort();
    return ['', ...folders];
  }

  getItemText(item: string): string {
    return item === '' ? '/ (vault root)' : item;
  }

  onChooseItem(item: string): void {
    this.onPick(item);
  }
}
