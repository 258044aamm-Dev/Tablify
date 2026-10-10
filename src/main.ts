import { Notice, Plugin } from 'obsidian';
import { registerImportCommand } from './commands/import.js';
import { registerExportCommand } from './commands/export.js';
import { registerLinkIntegrityCommand } from './commands/linkIntegrity.js';
import { installLinkLabelResolver, linkIndexFor } from './links/vaultLinkIndex.js';
import { TableView, TABLIFY_VIEW_TYPE } from './views/tableView.js';
import { registerFileMenu } from './menus/fileMenu.js';
import { DEFAULT_SETTINGS, TablifySettingTab, loadSettings, type TablifySettings } from './settings.js';
import { registerEmbedProcessor } from './embed/register.js';
import { SyncModal } from './views/sync/SyncModal.js';

export default class TablifyPlugin extends Plugin {
	// P7-03: plugin settings. The Airtable token lives only here (plugin data).
	settings: TablifySettings = { ...DEFAULT_SETTINGS };

	async onload() {
		this.settings = await loadSettings(this);
		this.addSettingTab(new TablifySettingTab(this.app, this));
		registerImportCommand(this);
		registerExportCommand(this);
		// P8-04: vault-wide link index (renames keep links; broken links are reported).
		linkIndexFor(this.app).start(this);
		installLinkLabelResolver(this.app); // P8-04 follow-up (R-2): sort, filter, export read row names
		registerLinkIntegrityCommand(this);
		// P5-00: open .tablify files in the table view (undoable grid, save through TextFileView).
		this.registerView(TABLIFY_VIEW_TYPE, (leaf) => new TableView(leaf));
		this.registerExtensions(['tablify'], TABLIFY_VIEW_TYPE);
		// P5-01: file explorer right-click items for .tablify files and folders.
		registerFileMenu(this);
		// P7-01: ```tablify code blocks in notes render a live, editable table (embed).
		registerEmbedProcessor(this);
		// P7-10: the sync modal for the open .tablify table. Optional: the plugin works offline without it.
		this.addCommand({
			id: 'tablify-airtable-sync',
			name: 'Airtable sync for this table',
			callback: () => this.openSync(),
		});
	}

	private openSync(): void {
		const view = this.app.workspace.getActiveViewOfType(TableView);
		const session = view?.syncSession();
		if (!view || !session) {
			new Notice('Open a .tablify table first.');
			return;
		}
		const token = this.settings.airtableToken.trim() || null;
		new SyncModal(this.app, { session, token, changed: () => view.afterSyncChange() }).open();
	}
}
