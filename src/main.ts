import { Plugin } from 'obsidian';

export default class TablifyPlugin extends Plugin {
	async onload() {
		this.addCommand({
			id: 'tablify-hello',
			name: 'Hello from Tablify',
			callback: () => {
				console.log('Tablify plugin loaded successfully');
			},
		});
	}
}
