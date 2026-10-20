/**
 * @vitest-environment jsdom
 *
 * Step 11 — the three cell panels: select, attachment and the option manager.
 *
 * The panels are the prototype's `#floatPanel` screens (`Prototype/script.js` `renderSelectPanel`
 * ~895, `openAttachmentPanel` ~987) and `#optMgrModal` (~1040). `select.test.ts` keeps the model
 * contract (create-on-type dedup, rename/recolor persistence, R-D12 cell clearing, IME, the
 * 200-option open budget); this file covers the presentation and the host wiring: the markup the
 * screens are built from, the keyboard path, and that every change is exactly one undo step.
 */

import { describe, it, expect, afterEach, beforeEach, vi } from 'vitest';
import { SelectDropdown } from '../../../src/views/grid/select/Dropdown.js';
import { OptionManagerDialog } from '../../../src/views/grid/select/OptionManager.js';
import { AttachmentPanel } from '../../../src/views/grid/AttachmentPanel.js';
import { pickFileFromDevice } from '../../../src/views/grid/attachmentImport.js';
import { createTableStore } from '../../../src/model/tableStore.js';
import { optionChipHue } from '../../../src/ui/theme/tokens.js';
import { newTableText } from '../../../src/menus/fileMenuModel.js';
import { TableView } from '../../../src/views/tableView.js';
import { WorkspaceLeaf, Notice } from 'obsidian';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { CellValue, FieldDefinition } from '../../../src/model/types.js';

function makeField(overrides: Partial<FieldDefinition> = {}): FieldDefinition {
  return {
    id: 'fld_sel',
    name: 'Status',
    type: 'single_select',
    options: [
      { id: 'opt_todo', name: 'Todo', color: 'gray' },
      { id: 'opt_done', name: 'Done', color: 'green' },
    ],
    ...overrides,
  } as FieldDefinition;
}

function need<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw new Error(`missing: ${what}`);
  return value;
}

/**
 * SAD-356: the host asks the device for a file. The picker itself is unit-tested in
 * `attachmentMenu.test.ts`; here it is replaced so the grid's copy-and-write path can be driven
 * without a real file dialog. The default answer is "the user cancelled", so a test that forgets
 * to arrange the picker can never hang or write by accident.
 */
vi.mock('../../../src/views/grid/attachmentImport.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../../../src/views/grid/attachmentImport.js')>();
  return { ...actual, pickFileFromDevice: vi.fn() };
});

const pickMock = vi.mocked(pickFileFromDevice);

beforeEach(() => {
  pickMock.mockReset();
  pickMock.mockResolvedValue({ kind: 'cancelled' });
});

afterEach(() => {
  document.body.innerHTML = '';
  Notice.reset();
});

describe('Step 11 — select panel markup', () => {
  it('renders the prototype screen: search, chips by hue, empty hint, wired footer', () => {
    const field = makeField();
    const dropdown = new SelectDropdown({
      field,
      value: 'opt_done',
      onSelect: () => undefined,
      onCreate: () => undefined,
      onClear: () => undefined,
      onManageOptions: () => undefined,
    });
    document.body.appendChild(dropdown.element);

    expect(
      dropdown.element.querySelector<HTMLInputElement>('.tablify__dropdown-input')?.placeholder,
    ).toBe('Search or create…');

    const chips = Array.from(dropdown.element.querySelectorAll('.tablify__chip'));
    expect(chips.map((c) => c.textContent)).toEqual(['Todo', 'Done']);
    // The chip carries its hue family, which is what the panel's generated stylesheet paints.
    expect(chips[0].className).toContain(`tablify__chip--${optionChipHue('gray')}`);
    expect(chips[1].className).toContain(`tablify__chip--${optionChipHue('green')}`);
    expect(chips[0].querySelector('.tablify__chip-dot')).not.toBeNull();

    // Only the picked row carries the check glyph.
    const rows = Array.from(dropdown.element.querySelectorAll('.tablify__dropdown-item'));
    expect(rows[1].querySelector('.tablify__dropdown-check')).not.toBeNull();
    expect(rows[0].querySelector('.tablify__dropdown-check')).toBeNull();

    const foot = need(dropdown.element.querySelector('.tablify__dropdown-foot'), 'footer');
    expect(foot.textContent).toBe('ClearManage options');
    expect(foot.querySelector('.tablify__dropdown-manage-icon')).not.toBeNull();

    // The empty hint only shows for a field with no options at all.
    const bare = new SelectDropdown({ field: makeField({ options: [] }), onSelect: () => undefined, onCreate: () => undefined });
    expect(bare.element.querySelector('.tablify__dropdown-empty')?.textContent).toBe(
      'No options yet — type to create.',
    );
    expect(bare.element.querySelector('.tablify__dropdown-foot')?.hasAttribute('hidden')).toBe(true);
    bare.close();
    dropdown.close();
  });

  it('ArrowDown / ArrowUp move the highlight and Enter picks it', () => {
    const picked: string[] = [];
    const dropdown = new SelectDropdown({
      field: makeField(),
      onSelect: (opt) => picked.push(opt.id),
      onCreate: () => undefined,
    });
    document.body.appendChild(dropdown.element);
    const input = need(dropdown.element.querySelector('input'), 'search');
    expect(dropdown.hasCreateOption()).toBe(false);

    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown', bubbles: true }));
    const active = need(dropdown.element.querySelector('.tablify__dropdown-item--active'), 'active row');
    expect(active.textContent).toBe('Todo');
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(picked).toEqual(['opt_todo']);

    input.value = 'Done';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    expect(dropdown.getVisibleOptionNames()).toEqual(['Done']);
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp', bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(picked).toEqual(['opt_todo', 'opt_done']);
    dropdown.close();
  });
});

describe('Step 11 — option manager card', () => {
  it('builds one row per option and routes every change through the undo path once', () => {
    const field = makeField();
    const store = createTableStore({ fields: [field], initialRows: [] });
    const applied: Array<{ names: string[]; values: Record<string, CellValue> }> = [];
    const dialog = new OptionManagerDialog(field, store, {
      apply: (options, values) => {
        applied.push({ names: options.map((o) => o.name), values });
        field.options = options;
      },
    });
    document.body.appendChild(dialog.element);

    expect(dialog.element.querySelectorAll('.tablify__optmgr-row')).toHaveLength(2);
    expect(dialog.element.querySelector('.tablify__optmgr-hint')?.textContent).toContain(
      'Changes are undoable',
    );
    expect(
      dialog.element.querySelector<HTMLInputElement>('.tablify__optmgr-input')?.placeholder,
    ).toBe('New option…');

    // Rename commits on change — one apply call, one undo step.
    const nameInput = need(
      dialog.element.querySelector<HTMLInputElement>('.tablify__optmgr-row .tablify__optmgr-name'),
      'name field',
    );
    nameInput.value = 'Pending';
    nameInput.dispatchEvent(new Event('change', { bubbles: true }));
    expect(applied).toHaveLength(1);
    expect(applied[0].names).toEqual(['Pending', 'Done']);
    expect(dialog.getOptions()[0].name).toBe('Pending');

    // Recolor cycles the swatch through the plugin palette.
    const swatch = need(dialog.element.querySelector<HTMLElement>('.tablify__optmgr-swatch'), 'swatch');
    swatch.click();
    expect(applied).toHaveLength(2);
    expect(dialog.getOptions()[0].color).not.toBe('gray');

    // Reorder: the down arrow on the first row swaps it with the second.
    const moveDown = need(dialog.element.querySelectorAll<HTMLElement>('.tablify__optmgr-move')[1], 'down');
    moveDown.click();
    expect(applied).toHaveLength(3);
    expect(applied[2].names).toEqual(['Done', 'Pending']);

    // Add appends the typed name.
    const addInput = need(
      dialog.element.querySelector<HTMLInputElement>('.tablify__optmgr-input'),
      'new option field',
    );
    addInput.value = 'Blocked';
    need(dialog.element.querySelector<HTMLElement>('.tablify__optmgr-addbtn'), 'Add').click();
    expect(applied).toHaveLength(4);
    expect(applied[3].names).toEqual(['Done', 'Pending', 'Blocked']);
    expect(addInput.value).toBe('');
    dialog.close();
  });

  it('delete carries the cells that referenced the option (R-D12) in the same change', () => {
    const field = makeField({ type: 'multi_select' });
    const store = createTableStore({
      fields: [field],
      initialRows: [
        { id: 'row_1', rev: 1, values: { fld_sel: ['opt_todo'] } },
        { id: 'row_2', rev: 1, values: { fld_sel: ['opt_todo', 'opt_done'] } },
      ],
    });
    let seen: { names: string[]; values: Record<string, CellValue> } | null = null;
    const dialog = new OptionManagerDialog(field, store, {
      apply: (options, values) => {
        seen = { names: options.map((o) => o.name), values };
        field.options = options;
      },
    });
    document.body.appendChild(dialog.element);
    expect(dialog.getDeleteAffectedCount('opt_todo')).toBe(2);

    need(dialog.element.querySelector<HTMLElement>('.tablify__optmgr-delete'), 'bin').click();
    expect(seen).not.toBeNull();
    const applied = need(seen, 'apply call') as { names: string[]; values: Record<string, CellValue> };
    expect(applied.names).toEqual(['Done']);
    // A cell that still has another option keeps it; one that had only this option clears.
    expect(applied.values).toEqual({ row_1: null, row_2: ['opt_done'] });
    dialog.close();
  });
});

describe('Step 11 — attachment panel', () => {
  it('lists the path, removes it, and asks before saving a path the vault does not have', () => {
    const added: string[] = [];
    const removed: number[] = [];
    const panel = new AttachmentPanel({
      field: makeField({ name: 'Attachments', type: 'attachment', options: [] }),
      value: 'Assets/brief.pdf',
      onAdd: (p) => added.push(p),
      onRemove: (i) => removed.push(i),
      checkPath: (raw) =>
        raw === 'Assets/brief.pdf'
          ? { ok: true, path: raw }
          : { ok: false, needsConfirm: true, path: raw, message: `File not found in vault: "${raw}". Save anyway?` },
    });
    document.body.appendChild(panel.element);

    expect(panel.element.querySelector('.tablify__attach-head')?.textContent).toBe('Attachments');
    expect(panel.element.querySelector('.tablify__attach-path')?.textContent).toBe('Assets/brief.pdf');
    need(panel.element.querySelector<HTMLElement>('.tablify__attach-remove'), 'remove').click();
    expect(removed).toEqual([0]);

    // The known path goes straight through.
    const input = need(panel.element.querySelector<HTMLInputElement>('.tablify__attach-input'), 'path field');
    expect(input.placeholder).toBe('Vault-relative path, e.g. Assets/photo.png');
    input.value = 'Assets/brief.pdf';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(added).toEqual(['Assets/brief.pdf']);

    // A path the vault does not have waits for "Save anyway".
    input.value = 'Missing/file.png';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
    expect(added).toEqual(['Assets/brief.pdf']);
    const warn = need(panel.element.querySelector('.tablify__attach-warn'), 'warning');
    expect(warn.textContent).toContain('File not found');
    need(panel.element.querySelector<HTMLElement>('.tablify__attach-warn-btn'), 'save anyway').click();
    expect(added).toEqual(['Assets/brief.pdf', 'Missing/file.png']);
    panel.close();
  });

  it('shows the prototype empty line when the cell holds nothing', () => {
    const panel = new AttachmentPanel({
      field: makeField({ name: 'Attachments', type: 'attachment', options: [] }),
      value: null,
      onAdd: () => undefined,
      onRemove: () => undefined,
    });
    expect(panel.element.querySelector('.tablify__attach-empty')?.textContent).toBe('No attachments.');
    panel.close();
  });
});

// ---- host wiring: the grid opens these panels instead of a text editor --------------------

async function openView(data: string): Promise<TableView> {
  const view = new TableView(new WorkspaceLeaf() as never);
  await view.onOpen();
  document.body.appendChild(view.contentEl);
  view.setViewData(data, false);
  return view;
}

function enterAt(view: TableView, col: number): HTMLElement {
  const root = need(view.contentEl.querySelector<HTMLElement>('.tablify--grid'), 'grid root');
  root.focus();
  for (let i = 0; i < col; i += 1) {
    root.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight', bubbles: true }));
  }
  root.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));
  return root;
}

function fileData(view: TableView): {
  fields: Array<{ id: string; name: string; options?: Array<{ id: string; name: string }> }>;
  rows: Array<{ id: string; values: Record<string, CellValue> }>;
} {
  return JSON.parse(view.getViewData());
}

/** The Attachments field and the first row in the file the view would save. */
function attachmentTarget(view: TableView): { fieldId: string; rowId: string } {
  const data = fileData(view);
  const field = need(data.fields.find((f) => f.name === 'Attachments'), 'Attachments field');
  return { fieldId: field.id, rowId: need(data.rows[0], 'first row').id };
}

/**
 * SAD-356: click "Enter a URL or file path…" in an open empty-cell menu and hand back the panel it
 * opens. Used by every test that reaches the attachment panel through the empty-cell flow.
 */
function enterPathEntry(): HTMLElement {
  const menu = need(
    document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-menu"]'),
    'attachment menu',
  );
  const entries = Array.from(menu.querySelectorAll<HTMLButtonElement>('.tablify__attach-menu-item'));
  need(entries[1], 'Enter a URL or file path entry').click();
  return need(
    document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-panel"]'),
    'attachment panel',
  );
}

/** Click an entry of the open empty-cell menu by its index. */
function clickMenuEntry(index: number): void {
  const menu = need(
    document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-menu"]'),
    'attachment menu',
  );
  const entries = Array.from(menu.querySelectorAll<HTMLButtonElement>('.tablify__attach-menu-item'));
  need(entries[index], `menu entry ${index}`).click();
}

/** Let the picker → copy → write promise chain finish. */
async function settle(): Promise<void> {
  await new Promise((resolve) => setTimeout(resolve, 0));
}

describe('Step 11 — the grid opens the panels', () => {
  it('edits a select cell in the panel, not in a text editor', async () => {
    const view = await openView(newTableText('Untitled table'));
    enterAt(view, 2); // Name, Notes, Status
    expect(view.contentEl.querySelector('input.tablify__editor')).toBeNull();

    const panel = need(
      document.body.querySelector<HTMLElement>('[data-testid="tablify-select-panel"]'),
      'select panel',
    );
    expect(Array.from(panel.querySelectorAll('.tablify__chip')).map((c) => c.textContent)).toEqual([
      'Todo',
      'In progress',
      'Done',
    ]);

    const done = Array.from(panel.querySelectorAll<HTMLElement>('.tablify__dropdown-item')).find(
      (row) => row.textContent === 'Done',
    );
    need(done, 'Done row').click();

    const data = fileData(view);
    const status = need(
      data.fields.find((f) => f.name === 'Status'),
      'Status field',
    );
    const doneId = need(status.options?.find((o) => o.name === 'Done'), 'Done option').id;
    // SAD-115: a row set to Done moves to the bottom of the table, so find the edited row by its
    // value rather than by position.
    const edited = data.rows.findIndex((r) => r.values[status.id] === doneId);
    expect(edited).toBeGreaterThanOrEqual(0);
    expect(edited).toBe(data.rows.length - 1);
    // single_select sets and closes.
    expect(document.body.querySelector('[data-testid="tablify-select-panel"]')).toBeNull();
  });

  it('Escape closes the panel and returns focus to the grid', async () => {
    const view = await openView(newTableText('Untitled table'));
    const root = enterAt(view, 2);
    expect(document.body.querySelector('[data-testid="tablify-select-panel"]')).not.toBeNull();

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    expect(document.body.querySelector('[data-testid="tablify-select-panel"]')).toBeNull();
    // The grid owns focus (its active cell is internal), exactly where the cell click left it.
    expect(document.activeElement).toBe(root);
  });

  it('creates an option and writes the cell as one undo step', async () => {
    const view = await openView(newTableText('Untitled table'));
    enterAt(view, 2);
    const input = need(
      document.body.querySelector<HTMLInputElement>('.tablify__dropdown-input'),
      'panel search',
    );
    input.value = 'Blocked';
    input.dispatchEvent(new Event('input', { bubbles: true }));
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const afterCreate = fileData(view);
    const status = need(
      afterCreate.fields.find((f) => f.name === 'Status'),
      'Status field',
    );
    expect(status.options?.map((o) => o.name)).toContain('Blocked');
    const blockedId = need(status.options?.find((o) => o.name === 'Blocked'), 'Blocked option').id;
    expect(afterCreate.rows[0].values[status.id]).toBe(blockedId);
    expect(Notice.messages.some((m) => m.includes('Created option'))).toBe(true);

    // One undo takes back both the option and the cell write.
    view.syncSession()?.undo();
    const afterUndo = fileData(view);
    const statusAfter = need(
      afterUndo.fields.find((f) => f.name === 'Status'),
      'Status field after undo',
    );
    expect(statusAfter.options?.map((o) => o.name)).toEqual(['Todo', 'In progress', 'Done']);
    expect(afterUndo.rows[0].values[statusAfter.id] ?? null).toBeNull();
  });

  it('opens the attachment panel and saves a missing path through the vault check', async () => {
    const view = await openView(newTableText('Untitled table'));
    const vault = view.app.vault as unknown as { getAbstractFileByPath: (p: string) => unknown };
    const original = vault.getAbstractFileByPath;
    vault.getAbstractFileByPath = (p: string) => (p === 'Assets/photo.png' ? {} : null);

    enterAt(view, 4); // Name, Notes, Status, Due date, Attachments
    // SAD-356: an empty cell asks how to fill it first; "Enter a URL or file path…" is the route
    // to the panel this test has always exercised (every assertion below is unchanged).
    enterPathEntry();
    const panel = need(
      document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-panel"]'),
      'attachment panel',
    );
    expect(panel.querySelector('.tablify__attach-empty')?.textContent).toBe('No attachments.');

    const input = need(panel.querySelector<HTMLInputElement>('.tablify__attach-input'), 'path field');
    input.value = 'Assets/photo.png';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    const data = fileData(view);
    const attachments = need(
      data.fields.find((f) => f.name === 'Attachments'),
      'Attachments field',
    );
    expect(data.rows[0].values[attachments.id]).toBe('Assets/photo.png');
    vault.getAbstractFileByPath = original;
  });
});

describe('SAD-356 — an empty attachment cell asks how to add one', () => {
  it('opens the menu, not the path panel, on an empty cell', async () => {
    const view = await openView(newTableText('Untitled table'));
    enterAt(view, 4);

    expect(document.body.querySelector('[data-testid="tablify-attachment-menu"]')).not.toBeNull();
    expect(document.body.querySelector('[data-testid="tablify-attachment-panel"]')).toBeNull();
  });

  it('opens the path panel with the new device picker on a cell that already has an attachment', async () => {
    const view = await openView(newTableText('Untitled table'));
    const { fieldId, rowId } = attachmentTarget(view);
    view.syncSession()?.setValue(rowId, fieldId, 'Files/brief.pdf');

    enterAt(view, 4);

    const panel = need(
      document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-panel"]'),
      'attachment panel',
    );
    expect(document.body.querySelector('[data-testid="tablify-attachment-menu"]')).toBeNull();
    expect(panel.querySelector('.tablify__attach-path')?.textContent).toBe('Files/brief.pdf');
    expect(panel.querySelector('[data-testid="tablify-attachment-pick"]')).not.toBeNull();
  });

  it('the menu hands over to the path panel with its field focused', async () => {
    const view = await openView(newTableText('Untitled table'));
    enterAt(view, 4);
    const panel = enterPathEntry();

    expect(document.body.querySelector('[data-testid="tablify-attachment-menu"]')).toBeNull();
    const input = need(panel.querySelector<HTMLInputElement>('.tablify__attach-input'), 'path field');
    expect(document.activeElement).toBe(input);
  });

  it('stores a URL as typed — no vault check, no "Save anyway"', async () => {
    const view = await openView(newTableText('Untitled table'));
    // The mock vault has nothing, so a vault path would warn; a URL must not.
    enterAt(view, 4);
    const panel = enterPathEntry();
    const input = need(panel.querySelector<HTMLInputElement>('.tablify__attach-input'), 'path field');
    input.value = 'https://example.com/a.png';
    input.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true }));

    expect(panel.querySelector('.tablify__attach-warn')).toBeNull();
    const { fieldId } = attachmentTarget(view);
    expect(fileData(view).rows[0].values[fieldId]).toBe('https://example.com/a.png');
  });

  it('says so when the device opens no picker, and writes nothing', async () => {
    const view = await openView(newTableText('Untitled table'));
    pickMock.mockResolvedValue({ kind: 'unavailable' });

    enterAt(view, 4);
    clickMenuEntry(0);
    await settle();

    const menu = need(
      document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-menu"]'),
      'menu stays open',
    );
    expect(menu.querySelector('.tablify__attach-msg')?.textContent).toMatch(/did not open a file picker/);
    expect(menu.getAttribute('aria-busy')).toBe('false');
    const { fieldId } = attachmentTarget(view);
    expect(fileData(view).rows[0].values[fieldId] ?? null).toBeNull();
  });

  it('writes nothing when the user cancels the picker', async () => {
    const view = await openView(newTableText('Untitled table'));
    pickMock.mockResolvedValue({ kind: 'cancelled' });

    enterAt(view, 4);
    clickMenuEntry(0);
    await settle();

    const menu = need(
      document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-menu"]'),
      'menu stays open',
    );
    expect(menu.querySelector<HTMLElement>('.tablify__attach-msg')?.hidden).toBe(true);
    const { fieldId } = attachmentTarget(view);
    expect(fileData(view).rows[0].values[fieldId] ?? null).toBeNull();
  });

  it('copies the picked file into the vault, stores its path, and undoes as one step', async () => {
    const view = await openView(newTableText('Untitled table'));
    const write = vi.spyOn(view.app.vault, 'createBinary');
    pickMock.mockResolvedValue({ kind: 'file', file: new File(['hello'], 'photo.png') });

    enterAt(view, 4);
    clickMenuEntry(0);
    await settle();

    const { fieldId } = attachmentTarget(view);
    expect(write).toHaveBeenCalledTimes(1);
    expect(write.mock.calls[0][0]).toBe('Attachments/photo.png');
    expect(fileData(view).rows[0].values[fieldId]).toBe('Attachments/photo.png');
    expect(Notice.messages.some((m) => m.includes('Saved to Attachments/photo.png'))).toBe(true);
    // The menu is done with once the cell holds a value.
    expect(document.body.querySelector('[data-testid="tablify-attachment-menu"]')).toBeNull();

    view.syncSession()?.undo();
    expect(fileData(view).rows[0].values[fieldId] ?? null).toBeNull();
  });

  it('picks a device file from a filled cell too, replacing the path', async () => {
    const view = await openView(newTableText('Untitled table'));
    const { fieldId, rowId } = attachmentTarget(view);
    view.syncSession()?.setValue(rowId, fieldId, 'Files/brief.pdf');
    pickMock.mockResolvedValue({ kind: 'file', file: new File(['img'], 'diagram.png') });

    enterAt(view, 4);
    const pick = need(
      document.body.querySelector<HTMLButtonElement>('[data-testid="tablify-attachment-pick"]'),
      'choose-a-file button',
    );
    pick.click();
    await settle();

    expect(fileData(view).rows[0].values[fieldId]).toBe('Attachments/diagram.png');
  });

  it('styles.css carries the menu, the pick button and the message line', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');
    for (const selector of [
      '.tablify__attach-menu',
      '.tablify__attach-menu-item',
      '.tablify__attach-pick',
      '.tablify__attach-msg',
    ]) {
      expect(css.includes(selector), `styles.css is missing ${selector}`).toBe(true);
    }
  });
});

describe('Step 11 — the new surfaces are painted', () => {
  // A light drift guard: the panels are built from these classes, and styles.css is the only
  // place their geometry lives (the per-hue chip colours are generated from the palette).
  it('styles.css carries the card, the select rows and the option-manager rows', () => {
    const css = fs.readFileSync(path.join(process.cwd(), 'styles.css'), 'utf8');
    for (const selector of [
      '.tablify__panel',
      '.tablify__dropdown-input',
      '.tablify__dropdown-list',
      '.tablify__dropdown-item',
      '.tablify__chip',
      '.tablify__dropdown-foot',
      '.tablify__attach-row',
      '.tablify__attach-input',
      '.tablify__optmgr-row',
      '.tablify__optmgr-addbtn',
      '.tablify__optmgr-backdrop .tablify__pmodal',
    ]) {
      expect(css.includes(selector), `styles.css is missing ${selector}`).toBe(true);
    }
  });
});
