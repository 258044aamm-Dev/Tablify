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

import { faIcon } from '../ui/faIcons.js';

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

/** The prototype's title-link glyphs (Font Awesome Free 6.4.0 solid, see src/ui/faIcons.ts). */
const ICONS: Record<TitleAction, string> = {
  import: faIcon('file-import'),
  export: faIcon('file-export'),
  'export-csv': faIcon('file-csv'),
  'copy-markdown': faIcon('copy'),
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
