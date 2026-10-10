// Obsidian wiring for the file explorer menu (P5-01). Thin layer over fileMenuModel.ts.
// Listens to the `file-menu` workspace event. Other targets get no items.

import { App, Menu, Notice, Plugin, TAbstractFile, TFile, TFolder } from 'obsidian';
import { startImport } from '../commands/import.js';
import { openExportModal } from '../commands/export.js';
import { COPY_SUFFIX, NEW_TABLE_NAME, duplicateTableText, joinPath, menuItemsFor, newTableText, uniqueName, type FileMenuAction, type MenuTarget } from './fileMenuModel.js';
import { linkIndexFor } from '../links/vaultLinkIndex.js';
import { decideReissue, reissueTableIdText } from '../links/reissueTableId.js';
import { TABLIFY_VIEW_TYPE } from '../views/tableView.js';

/** P8-04 follow-up: shown only on a copy whose table ID is shared with another file. */
export const REISSUE_LABEL = 'Give this copy a new table ID';

export function registerFileMenu(plugin: Plugin): void {
  const app = plugin.app;
  plugin.registerEvent(
    app.workspace.on('file-menu', (menu: Menu, file: TAbstractFile) => {
      for (const item of menuItemsFor(targetOf(file))) {
        menu.addItem((mi) =>
          mi
            .setTitle(item.label)
            .onClick(() => void run(app, file, item.id)),
        );
      }
      if (file instanceof TFile && file.extension === 'tablify') {
        const cached = decideReissue(linkIndexFor(app).index.duplicates(), file.path, []);
        if (cached.kind === 'reissue') {
          menu.addItem((mi) => mi.setTitle(REISSUE_LABEL).onClick(() => void reissueFile(app, file)));
        }
      }
    }),
  );
}

/** Re-check the index and the open tabs, then write the new ID. Refuses rather than guess. */
async function reissueFile(app: App, file: TFile): Promise<void> {
  const idx = linkIndexFor(app);
  await idx.refresh();
  const openPaths = app.workspace
    .getLeavesOfType(TABLIFY_VIEW_TYPE)
    .map((leaf) => (leaf.view as { file?: TFile | null }).file?.path)
    .filter((p): p is string => typeof p === 'string');
  const decision = decideReissue(idx.index.duplicates(), file.path, openPaths);
  switch (decision.kind) {
    case 'not-duplicated':
      new Notice('This table ID is not shared. Nothing to change.');
      return;
    case 'keeps-id':
      new Notice('This file keeps the table ID. Give the other copy a new ID instead.');
      return;
    case 'open':
      new Notice('Close this table tab first, then try again.');
      return;
    case 'reissue':
      break;
  }
  const result = reissueTableIdText(await app.vault.read(file));
  if (!result.ok) {
    new Notice(`Could not give a new ID: ${result.error}`);
    return;
  }
  await app.vault.modify(file, result.text);
  new Notice(`${file.basename}: new table ID. Links to the original are unchanged.`);
}

function targetOf(file: TAbstractFile): MenuTarget {
  if (file instanceof TFile) return { kind: 'file', extension: file.extension };
  if (file instanceof TFolder) return { kind: 'folder', path: file.isRoot() ? '' : file.path };
  return { kind: 'other' };
}

async function run(app: App, file: TAbstractFile, action: FileMenuAction): Promise<void> {
  switch (action) {
    case 'open':
      if (file instanceof TFile) await app.workspace.getLeaf(false).openFile(file);
      return;
    case 'export':
      if (file instanceof TFile) openExportModal(app, file);
      return;
    case 'duplicate':
      if (file instanceof TFile) await duplicateFile(app, file);
      return;
    case 'newTable':
      if (file instanceof TFolder) await createNewTable(app, file.path);
      return;
    case 'importTable':
      if (file instanceof TFolder) startImport(app, file.path);
      return;
  }
}

/** Copy the table to a new file: new tableId, name + " copy" (numbered on collision), same rows. */
async function duplicateFile(app: App, source: TFile): Promise<void> {
  const folder = source.parent?.path ?? '';
  const exists = (name: string) => app.vault.getAbstractFileByPath(joinPath(folder, `${name}.tablify`)) !== null;
  const name = uniqueName(`${source.basename}${COPY_SUFFIX}`, exists);
  const text = await app.vault.read(source);
  const result = duplicateTableText(text, name);
  if (!result.ok) {
    new Notice(`Duplicate failed. The table file could not be read: ${result.error}`);
    return;
  }
  const path = joinPath(folder, `${name}.tablify`);
  await app.vault.create(path, result.text);
  new Notice(`Created ${path}.`);
}

/** New empty table in a folder. Name "Untitled table", numbered on collision. */
async function createNewTable(app: App, folder: string): Promise<void> {
  const exists = (name: string) => app.vault.getAbstractFileByPath(joinPath(folder, `${name}.tablify`)) !== null;
  const name = uniqueName(NEW_TABLE_NAME, exists);
  const path = joinPath(folder, `${name}.tablify`);
  const created = await app.vault.create(path, newTableText(name));
  await app.workspace.getLeaf(true).openFile(created);
}
