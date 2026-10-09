/**
 * Select dropdown — searchable, offers Create for unknown names.
 * Uses src/model/selectOptions.ts findOrCreate (case-insensitive dedup).
 */

import { createSelectOptionManager } from '../../../model/selectOptions.js';
import type { FieldDefinition, SelectOption } from '../../../model/types.js';

export interface DropdownOptions {
  field: FieldDefinition;
  onSelect: (option: SelectOption) => void;
  onCreate: (option: SelectOption) => void;
}

export class SelectDropdown {
  private container: HTMLElement;
  private input: HTMLInputElement;
  private list: HTMLElement;
  private manager = createSelectOptionManager();
  private isComposing = false;

  constructor(private opts: DropdownOptions) {
    this.container = document.createElement('div');
    this.container.className = 'tablify__dropdown';

    this.input = document.createElement('input');
    this.input.className = 'tablify__dropdown-input';
    this.input.placeholder = 'Search or create…';
    this.input.addEventListener('compositionstart', () => (this.isComposing = true));
    this.input.addEventListener('compositionend', () => {
      this.isComposing = false;
      this.render();
    });
    this.input.addEventListener('input', () => {
      if (!this.isComposing) this.render();
    });
    this.input.addEventListener('keydown', (e) => {
      if (this.isComposing) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        this.commit();
      } else if (e.key === 'Escape') {
        this.close();
      }
    });

    this.list = document.createElement('div');
    this.list.className = 'tablify__dropdown-list';

    this.container.appendChild(this.input);
    this.container.appendChild(this.list);
    this.render();
  }

  get element(): HTMLElement {
    return this.container;
  }

  private render(): void {
    const q = this.input.value.trim().toLowerCase();
    this.list.innerHTML = '';
    const opts = this.opts.field.options ?? [];
    const filtered = q ? opts.filter((o) => o.name.toLowerCase().includes(q)) : opts;
    for (const opt of filtered) {
      const item = document.createElement('div');
      item.className = 'tablify__dropdown-item';
      item.textContent = opt.name;
      item.addEventListener('click', () => this.opts.onSelect(opt));
      this.list.appendChild(item);
    }
    if (filtered.length === 0 && q) {
      const create = document.createElement('div');
      create.className = 'tablify__dropdown-create';
      create.textContent = `Create "${this.input.value.trim()}"`;
      create.addEventListener('click', () => this.commit());
      this.list.appendChild(create);
    }
  }

  private commit(): void {
    const raw = this.input.value.trim();
    if (!raw) return;
    const lower = raw.toLowerCase();
    const existing = (this.opts.field.options ?? []).find((o) => o.name.trim().toLowerCase() === lower);
    if (existing) {
      this.opts.onSelect(existing);
    } else {
      const created = this.manager.findOrCreate(raw, this.opts.field);
      this.opts.onCreate(created);
    }
  }

  close(): void {
    this.container.remove();
  }

  // For tests: get visible items
  getVisibleOptionNames(): string[] {
    return Array.from(this.list.querySelectorAll('.tablify__dropdown-item')).map((el) => (el as HTMLElement).textContent ?? '');
  }

  hasCreateOption(): boolean {
    return !!this.list.querySelector('.tablify__dropdown-create');
  }
}
