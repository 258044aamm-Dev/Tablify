// Obsidian wiring for the table context menu (P5-02). Turns MenuEntry lists into an Obsidian Menu,
// and provides the Change field type picker. Disabled items keep their label and show the reason.

import { App, FuzzySuggestModal, Menu, Notice } from 'obsidian';
import { displayTitle, TYPE_LABELS, type MenuEntry, type TypeTarget } from './tableMenuModel.js';

export function buildTableMenu(entries: MenuEntry[], run: (id: string) => void): Menu {
  const menu = new Menu();
  for (const entry of entries) {
    if (entry.separator) {
      menu.addSeparator();
      continue;
    }
    menu.addItem((item) => {
      item.setTitle(displayTitle(entry));
      if (!entry.enabled) item.setDisabled(true);
      item.onClick(() => {
        if (entry.enabled) run(entry.id);
      });
    });
  }
  return menu;
}

/** Type picker for "Change field type…". Blocked types are shown with the reason and cannot be chosen. */
export class TypePickerModal extends FuzzySuggestModal<TypeTarget> {
  constructor(
    app: App,
    private readonly targets: TypeTarget[],
    private readonly onPick: (target: TypeTarget) => void,
  ) {
    super(app);
    this.setPlaceholder('Change field type to…');
  }

  getItems(): TypeTarget[] {
    return this.targets;
  }

  getItemText(t: TypeTarget): string {
    const label = TYPE_LABELS[t.type] ?? t.type;
    return t.ok ? label : `${label} (${t.reason ?? 'not available'})`;
  }

  onChooseItem(t: TypeTarget): void {
    if (t.ok) {
      this.onPick(t);
      return;
    }
    new Notice(`Cannot change to ${TYPE_LABELS[t.type] ?? t.type}: ${t.reason ?? 'not available'}`);
  }
}
