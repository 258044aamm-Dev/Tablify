import { Notice, Plugin } from 'obsidian';
import { registerImportCommand } from './commands/import.js';
import { registerExportCommand, registerCurrentViewExportCommands, registerExportDiagnosticsCommand, setExportPreferences } from './commands/export.js';
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
		// SAD-350 round 2: the opt-in vault last resort, off unless the Export setting is on.
		setExportPreferences(() => ({ vaultFallback: this.settings.exportVaultFallback }));
		// SAD-350 §3.0: read-only device probe for the export delivery capabilities.
		registerExportDiagnosticsCommand(this);
		// SAD-98: the one-click current-view actions, kept as commands after leaving the title row.
		registerCurrentViewExportCommands(this, () => this.app.workspace.getActiveViewOfType(TableView));
		// P8-04: vault-wide link index (renames keep links; broken links are reported).
		linkIndexFor(this.app).start(this);
		installLinkLabelResolver(this.app); // P8-04 follow-up (R-2): sort, filter, export read row names
		registerLinkIntegrityCommand(this);
		// P5-00: open .tablify files in the table view (undoable grid, save through TextFileView).
		// SAD-78: the toolbar's Sync button reuses the command's entry point (openSyncFor).
		this.registerView(
			TABLIFY_VIEW_TYPE,
			(leaf) =>
				new TableView(leaf, {
					openSync: (view) => this.openSyncFor(view),
					// SAD-376: the cell overflow settings live in plugin data; the view reads them here.
					readSettings: () => this.settings,
				}),
		);
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
		this.openSyncFor(this.app.workspace.getActiveViewOfType(TableView));
	}

	/**
	 * SAD-376: repaint every open table after a settings change, so a switch takes effect without
	 * closing and reopening the file. Embeds pick the change up on their next render — they can sit
	 * in another pane mid-edit, and re-rendering one from a settings save is not this feature's job.
	 */
	refreshOpenTables(): void {
		for (const leaf of this.app.workspace.getLeavesOfType(TABLIFY_VIEW_TYPE)) {
			const view = leaf.view;
			if (view instanceof TableView) view.refreshGrid();
		}
	}

	/** Shared by the command (active view) and the table toolbar's Sync button (its own view). */
	private openSyncFor(view: TableView | null): void {
		const session = view?.syncSession();
		if (!view || !session) {
			new Notice('Open a .tablify table first.');
			return;
		}
		const token = this.settings.airtableToken.trim() || null;
		new SyncModal(this.app, { session, token, changed: () => view.afterSyncChange() }).open();
	}
}
