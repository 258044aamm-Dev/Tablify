import { Plugin } from 'obsidian';
import { registerImportCommand } from './commands/import.js';
import { registerExportCommand } from './commands/export.js';
import { TableView, TABLIFY_VIEW_TYPE } from './views/tableView.js';

export default class TablifyPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: 'tablify-hello',
			name: 'Hello from Tablify',
			callback: () => {
				console.log('Tablify plugin loaded successfully');
			},
		});
		registerImportCommand(this);
		registerExportCommand(this);
		// P5-00: open .tablify files in the table view (undoable grid, save through TextFileView).
		this.registerView(TABLIFY_VIEW_TYPE, (leaf) => new TableView(leaf));
		this.registerExtensions(['tablify'], TABLIFY_VIEW_TYPE);
	}
}
