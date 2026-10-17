// Obsidian wiring for the table context menu (P5-02). Turns MenuEntry lists into an Obsidian Menu.
// Disabled items keep their label and show the reason.

import { Menu } from 'obsidian';
import { displayTitle, type MenuEntry } from './tableMenuModel.js';

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
