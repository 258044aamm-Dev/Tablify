import { Plugin } from 'obsidian';
import { registerImportCommand } from './commands/import.js';

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
	}
}
