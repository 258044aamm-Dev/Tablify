/**
 * @vitest-environment jsdom
 *
 * COD-74 — the file-explorer menu wiring.
 *
 * The bug was not in the item model, it was in the wiring: the model's `icon` was optional, the
 * three `.tablify` items omitted it, and `registerFileMenu` turned the omission into
 * `setIcon('')` — an empty icon id, which Obsidian renders as no glyph at all. A model-only test
 * (the one that existed) cannot see that, so these tests fire the real `file-menu` event through
 * the mock's event bus and assert on the `Menu` the plugin actually hands to Obsidian.
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { App, Menu, TFile, TFolder, Plugin } from 'obsidian';
import { registerFileMenu, REISSUE_ICON, REISSUE_LABEL } from '../../src/menus/fileMenu.js';
import { linkIndexFor } from '../../src/links/vaultLinkIndex.js';

function fileAt(path: string): TFile {
  const file = new TFile();
  const f = file as unknown as { path: string; name: string; basename: string; extension: string };
  f.path = path;
  f.name = path.split('/').pop() ?? path;
  const dot = f.name.lastIndexOf('.');
  f.basename = dot > 0 ? f.name.slice(0, dot) : f.name;
  f.extension = dot > 0 ? f.name.slice(dot + 1) : '';
  return file;
}

/** A `.tablify` file — the target this issue is about. */
const tablifyFile = (path: string): TFile => fileAt(path.endsWith('.tablify') ? path : `${path}.tablify`);

function folder(path: string): TFolder {
  const f = new TFolder();
  (f as unknown as { path: string }).path = path;
  return f;
}

/** Register the real handler on a fresh app and open the menu for `target`. */
function menuFor(target: TFile | TFolder, app: App = new App()): Menu {
  registerFileMenu(new Plugin(app, {}) as never);
  const menu = new Menu();
  app.workspace.trigger('file-menu', menu, target);
  return menu;
}

const titles = (menu: Menu) => menu.items.flatMap((i) => (i.type === 'item' ? [i.api.title] : []));
const icons = (menu: Menu) => menu.items.flatMap((i) => (i.type === 'item' ? [i.api.icon] : []));

describe('COD-74 — .tablify file menu items are branded and carry icons', () => {
  it('adds the three items in order, with a title and an icon each', () => {
    const menu = menuFor(tablifyFile('Tables/Tasks.tablify'));
    expect(titles(menu)).toEqual(['Open Tablify Table', 'Duplicate Tablify Table', 'Export Tablify Table']);
    expect(icons(menu)).toEqual(['table', 'copy', 'download']);
  });

  it('never passes an empty icon id to setIcon for any item', () => {
    // The exact regression: setIcon('') is what drew nothing.
    for (const target of [tablifyFile('A.tablify'), folder('Projects')]) {
      for (const icon of icons(menuFor(target))) expect(icon).not.toBe('');
    }
  });

  it('leaves non-Tablify files and the vault root alone', () => {
    expect(titles(menuFor(fileAt('Notes.md')))).toEqual([]);
    expect(titles(menuFor(folder('')))).toEqual([]);
    expect(titles(menuFor(folder('/')))).toEqual([]);
  });

  it('keeps the two folder items branded, with their icons and at the top', () => {
    const app = new App();
    registerFileMenu(new Plugin(app, {}) as never);
    const menu = new Menu();
    // Something Obsidian itself would have added before the handler ran.
    menu.addItem((mi) => mi.setTitle('New note'));
    app.workspace.trigger('file-menu', menu, folder('Projects'));
    expect(titles(menu)).toEqual(['New Tablify Table', 'Import CSV or Excel to Tablify', 'New note']);
    expect(icons(menu).slice(0, 2)).toEqual(['file-plus', 'upload']);
  });

  it('wires each item to its action (Open opens the file in a leaf)', async () => {
    const app = new App();
    const openFile = vi.fn(async () => undefined);
    (app.workspace as unknown as { getLeaf: () => unknown }).getLeaf = () => ({ openFile });
    const file = tablifyFile('Tables/Tasks.tablify');
    const menu = menuFor(file, app);
    const open = menu.items[0];
    if (open.type !== 'item') throw new Error('expected an item');
    open.api.callback?.({} as MouseEvent);
    await Promise.resolve();
    expect(openFile).toHaveBeenCalledWith(file);
  });

  it('gives the reissue item an icon too', () => {
    const app = new App();
    // A duplicate group: two paths share one table ID, this file is not the owner.
    linkIndexFor(app).index.put({ tableId: 'tbl_shared', name: 'Tasks', path: 'Tables/A tasks.tablify', rows: [], linkCells: [] });
    linkIndexFor(app).index.put({ tableId: 'tbl_shared', name: 'Tasks', path: 'Tables/B tasks.tablify', rows: [], linkCells: [] });
    // `paths[0]` is the owner; the other copy is the one that can be reissued.
    const menu = menuFor(tablifyFile('Tables/B tasks.tablify'), app);
    expect(titles(menu)).toContain(REISSUE_LABEL);
    const at = titles(menu).indexOf(REISSUE_LABEL);
    expect(icons(menu)[at]).toBe(REISSUE_ICON);
    expect(REISSUE_ICON).not.toBe('');
  });
});

describe('COD-74 — the view has its own glyph', () => {
  beforeEach(() => {
    document.body.innerHTML = '';
  });

  it('TableView declares the table icon for its tab', async () => {
    const { TableView } = await import('../../src/views/tableView.js');
    const view = new TableView({ app: new App(), view: null } as never);
    expect(view.icon).toBe('table');
    expect(view.getIcon()).toBe('table');
  });
});
