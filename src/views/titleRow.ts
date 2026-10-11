/**
 * Title row (SAD-77, owner decisions S-1 / S-7): the prototype's `#titleRow` — an editable table
 * title, a file chip with the vault path, and the four title links Import… / Export… / Export CSV /
 * Copy Markdown. Prototype-only items (brand header, vault sidebar, tabs, "Saved locally",
 * "New Table") are deliberately absent.
 *
 * Pure DOM, no Obsidian imports (like Toolbar and GridView), so it is unit-tested in jsdom. TableView
 * supplies the callbacks, which reuse the existing command paths (startImport, the Export modal, the
 * exporter, the Markdown writer).
 *
 * The title is the file's basename. Committing an edit (Enter or blur) calls `onRename`; Escape
 * reverts. An empty, unchanged or invalid name never reaches `onRename`.
 */

export type TitleAction = 'import' | 'export' | 'export-csv' | 'copy-markdown';

export interface TitleRowCallbacks {
  /** Rename the table file to `name` (no extension). Resolve false to revert the title. */
  onRename(name: string): Promise<boolean>;
  onImport(): void;
  onExport(): void;
  onExportCsv(): void;
  onCopyMarkdown(): void;
  /** Shown when the typed name is rejected before any rename is attempted. */
  onInvalidName(message: string): void;
}

export interface TitleRowState {
  /** File basename shown as the title. */
  title: string;
  /** Vault path shown in the file chip ("" hides the chip). */
  path: string;
}

/** Characters Obsidian rejects in file names, or that break [[links]] to the table. */
const FORBIDDEN = /[\\/:*?"<>|#^[\]]/;

/** Validate a typed table name. Returns an error message, or null when the name is usable. */
export function validateTableName(name: string): string | null {
  if (name.length === 0) return 'A table name cannot be empty.';
  if (FORBIDDEN.test(name)) return 'A table name cannot contain any of these characters: \\ / : * ? " < > | # ^ [ ]';
  if (name.startsWith('.')) return 'A table name cannot start with a dot.';
  return null;
}

/**
 * The prototype's title-link glyphs, inlined because the plugin ships offline: Font Awesome
 * Free 6.4.0 solid `file-import`, `file-export`, `file-csv` and `copy` — the exact version the
 * prototype loads. Icons © Fonticons, Inc., licensed CC BY 4.0
 * (https://fontawesome.com/license/free). Sized like FA's own inline SVGs (1em tall, width
 * from the viewBox, vertical-align -0.125em) so they sit where the prototype's webfont glyph does.
 */
const ICONS: Record<TitleAction, string> = {
  import:
    '<svg class="tablify__fa" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M128 64c0-35.3 28.7-64 64-64H352V128c0 17.7 14.3 32 32 32H512V448c0 35.3-28.7 64-64 64H192c-35.3 0-64-28.7-64-64V336H302.1l-39 39c-9.4 9.4-9.4 24.6 0 33.9s24.6 9.4 33.9 0l80-80c9.4-9.4 9.4-24.6 0-33.9l-80-80c-9.4-9.4-24.6-9.4-33.9 0s-9.4 24.6 0 33.9l39 39H128V64zm0 224v48H24c-13.3 0-24-10.7-24-24s10.7-24 24-24H128zM512 128H384V0L512 128z"></path></svg>',
  export:
    '<svg class="tablify__fa" viewBox="0 0 576 512" width="1.125em" height="1em" fill="currentColor" aria-hidden="true"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V288H216c-13.3 0-24 10.7-24 24s10.7 24 24 24H384V448c0 35.3-28.7 64-64 64H64c-35.3 0-64-28.7-64-64V64zM384 336V288H494.1l-39-39c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l80 80c9.4 9.4 9.4 24.6 0 33.9l-80 80c-9.4 9.4-24.6 9.4-33.9 0s-9.4-24.6 0-33.9l39-39H384zm0-208H256V0L384 128z"></path></svg>',
  'export-csv':
    '<svg class="tablify__fa" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M0 64C0 28.7 28.7 0 64 0H224V128c0 17.7 14.3 32 32 32H384V304H176c-35.3 0-64 28.7-64 64V512H64c-35.3 0-64-28.7-64-64V64zm384 64H256V0L384 128zM200 352h16c22.1 0 40 17.9 40 40v8c0 8.8-7.2 16-16 16s-16-7.2-16-16v-8c0-4.4-3.6-8-8-8H200c-4.4 0-8 3.6-8 8v80c0 4.4 3.6 8 8 8h16c4.4 0 8-3.6 8-8v-8c0-8.8 7.2-16 16-16s16 7.2 16 16v8c0 22.1-17.9 40-40 40H200c-22.1 0-40-17.9-40-40V392c0-22.1 17.9-40 40-40zm133.1 0H368c8.8 0 16 7.2 16 16s-7.2 16-16 16H333.1c-7.2 0-13.1 5.9-13.1 13.1c0 5.2 3 9.9 7.8 12l37.4 16.6c16.3 7.2 26.8 23.4 26.8 41.2c0 24.9-20.2 45.1-45.1 45.1H304c-8.8 0-16-7.2-16-16s7.2-16 16-16h42.9c7.2 0 13.1-5.9 13.1-13.1c0-5.2-3-9.9-7.8-12l-37.4-16.6c-16.3-7.2-26.8-23.4-26.8-41.2c0-24.9 20.2-45.1 45.1-45.1zm98.9 0c8.8 0 16 7.2 16 16v31.6c0 23 5.5 45.6 16 66c10.5-20.3 16-42.9 16-66V368c0-8.8 7.2-16 16-16s16 7.2 16 16v31.6c0 34.7-10.3 68.7-29.6 97.6l-5.1 7.7c-3 4.5-8 7.1-13.3 7.1s-10.3-2.7-13.3-7.1l-5.1-7.7c-19.3-28.9-29.6-62.9-29.6-97.6V368c0-8.8 7.2-16 16-16z"></path></svg>',
  'copy-markdown':
    '<svg class="tablify__fa" viewBox="0 0 512 512" width="1em" height="1em" fill="currentColor" aria-hidden="true"><path d="M272 0H396.1c12.7 0 24.9 5.1 33.9 14.1l67.9 67.9c9 9 14.1 21.2 14.1 33.9V336c0 26.5-21.5 48-48 48H272c-26.5 0-48-21.5-48-48V48c0-26.5 21.5-48 48-48zM48 128H192v64H64V448H256V416h64v48c0 26.5-21.5 48-48 48H48c-26.5 0-48-21.5-48-48V176c0-26.5 21.5-48 48-48z"></path></svg>',
};

const LINKS: Array<{ action: TitleAction; label: string; title: string }> = [
  { action: 'import', label: 'Import…', title: 'Import CSV / Excel as table' },
  { action: 'export', label: 'Export…', title: 'Export CSV / Excel / Markdown' },
  { action: 'export-csv', label: 'Export CSV', title: 'Export the current view as CSV next to this table' },
  { action: 'copy-markdown', label: 'Copy Markdown', title: 'Copy the current view as a Markdown table' },
];

export class TitleRow {
  readonly root: HTMLElement;
  private readonly titleEl: HTMLElement;
  private readonly chip: HTMLElement;
  private readonly callbacks: TitleRowCallbacks;
  private state: TitleRowState;
  /** True while a rename is in flight, so a second blur cannot start another. */
  private renaming = false;

  constructor(state: TitleRowState, callbacks: TitleRowCallbacks) {
    this.state = state;
    this.callbacks = callbacks;

    this.root = document.createElement('div');
    this.root.className = 'tablify__title-row';

    const left = document.createElement('div');
    left.className = 'tablify__title-group';

    this.titleEl = document.createElement('h2');
    this.titleEl.className = 'tablify__title';
    this.titleEl.contentEditable = 'true';
    // Explicit tab stop: contenteditable is focusable in browsers, this keeps it so everywhere.
    this.titleEl.tabIndex = 0;
    this.titleEl.spellcheck = false;
    this.titleEl.setAttribute('role', 'textbox');
    this.titleEl.setAttribute('aria-label', 'Table name');
    this.titleEl.dataset.testid = 'tablify-title';
    left.appendChild(this.titleEl);

    this.chip = document.createElement('span');
    this.chip.className = 'tablify__file-chip';
    this.chip.dataset.testid = 'tablify-file-chip';
    left.appendChild(this.chip);

    const right = document.createElement('div');
    right.className = 'tablify__title-actions';
    for (const link of LINKS) right.appendChild(this.makeLink(link.action, link.label, link.title));

    this.root.appendChild(left);
    this.root.appendChild(right);
    this.wire();
    this.render();
  }

  /** Refresh title and chip (file opened or renamed). Never clobbers an edit in progress. */
  update(state: TitleRowState): void {
    this.state = state;
    if (document.activeElement === this.titleEl) {
      this.renderChip();
      return;
    }
    this.render();
  }

  private makeLink(action: TitleAction, label: string, title: string): HTMLElement {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'tablify__title-link';
    btn.dataset.action = action;
    btn.title = title;
    const icon = document.createElement('span');
    icon.className = 'tablify__title-link-icon';
    icon.setAttribute('aria-hidden', 'true');
    icon.innerHTML = ICONS[action];
    btn.appendChild(icon);
    // The prototype's markup is `<i …></i> Label`: that space is part of the gap.
    btn.appendChild(document.createTextNode(` ${label}`));
    return btn;
  }

  private wire(): void {
    this.titleEl.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.titleEl.blur();
      } else if (e.key === 'Escape') {
        e.preventDefault();
        this.renderTitle();
        this.titleEl.blur();
      }
    });
    this.titleEl.addEventListener('blur', () => void this.commit());
    // Plain text only: a pasted rich fragment must not put markup in the title.
    this.titleEl.addEventListener('paste', (e) => {
      const text = e.clipboardData?.getData('text/plain');
      if (text === undefined) return;
      e.preventDefault();
      document.execCommand?.('insertText', false, text.replace(/\s+/g, ' '));
    });
    this.root.addEventListener('click', (e) => {
      const btn = (e.target as HTMLElement).closest<HTMLElement>('.tablify__title-link');
      if (!btn) return;
      const action = btn.dataset.action as TitleAction;
      if (action === 'import') this.callbacks.onImport();
      else if (action === 'export') this.callbacks.onExport();
      else if (action === 'export-csv') this.callbacks.onExportCsv();
      else if (action === 'copy-markdown') this.callbacks.onCopyMarkdown();
    });
  }

  private async commit(): Promise<void> {
    if (this.renaming) return;
    const name = (this.titleEl.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (name === this.state.title) {
      this.renderTitle();
      return;
    }
    const problem = validateTableName(name);
    if (problem !== null) {
      if (name.length > 0) this.callbacks.onInvalidName(problem);
      this.renderTitle();
      return;
    }
    this.renaming = true;
    try {
      const ok = await this.callbacks.onRename(name);
      if (ok) this.state = { ...this.state, title: name };
    } catch {
      // onRename reports its own failures; a throw just means "not renamed".
    } finally {
      this.renaming = false;
      this.renderTitle();
    }
  }

  private render(): void {
    this.renderTitle();
    this.renderChip();
  }

  private renderTitle(): void {
    this.titleEl.textContent = this.state.title;
  }

  private renderChip(): void {
    this.chip.textContent = this.state.path;
    this.chip.hidden = this.state.path.length === 0;
  }
}
