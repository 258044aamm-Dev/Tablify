import { Plugin } from 'obsidian';
import { registerImportCommand } from './commands/import.js';
import { registerExportCommand } from './commands/export.js';
import { TableView, TABLIFY_VIEW_TYPE } from './views/tableView.js';
import { registerFileMenu } from './menus/fileMenu.js';

export default class TablifyPlugin extends Plugin {
	async onload() {
		registerImportCommand(this);
		registerExportCommand(this);
		// P5-00: open .tablify files in the table view (undoable grid, save through TextFileView).
		this.registerView(TABLIFY_VIEW_TYPE, (leaf) => new TableView(leaf));
		this.registerExtensions(['tablify'], TABLIFY_VIEW_TYPE);
		// P5-01: file explorer right-click items for .tablify files and folders.
		registerFileMenu(this);
	}
}
