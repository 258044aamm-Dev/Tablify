// P7-03 — plugin settings and the Airtable token (v1.1).
//
// Rules (spec/steps/P7-03.md, roadmap §7 contracts):
//  - The token lives only in the plugin's own data (Obsidian's plugin data.json).
//  - It is never written to a .tablify file, an export, a log, or an error message.
//  - The settings input is masked (type="password").

import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';

export interface TablifySettings {
  /** Airtable personal access token. Plugin data only. */
  airtableToken: string;
}

export const DEFAULT_SETTINGS: Readonly<TablifySettings> = Object.freeze({ airtableToken: '' });

/** Longest token accepted. Real Airtable tokens are far shorter. Longer input is treated as empty. */
export const MAX_TOKEN_LENGTH = 512;

/** Plugin data as the store sees it. Matches Obsidian's Plugin.loadData/saveData. */
export interface SettingsStore {
  loadData(): Promise<unknown>;
  saveData(data: unknown): Promise<void>;
}

/**
 * Turns whatever is in plugin data into valid settings. Unknown keys are dropped, so only
 * known settings are ever written back. Never throws.
 */
export function normalizeSettings(raw: unknown): TablifySettings {
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS };
  }
  const token = (raw as Record<string, unknown>).airtableToken;
  if (typeof token !== 'string') return { ...DEFAULT_SETTINGS };
  const trimmed = token.trim();
  if (trimmed.length > MAX_TOKEN_LENGTH) return { ...DEFAULT_SETTINGS };
  return { airtableToken: trimmed };
}

/** Loads settings. A read error falls back to defaults rather than failing plugin load. */
export async function loadSettings(store: SettingsStore): Promise<TablifySettings> {
  try {
    return normalizeSettings(await store.loadData());
  } catch {
    return { ...DEFAULT_SETTINGS };
  }
}

/** Saves only known keys. The token is saved to plugin data and nowhere else. */
export async function saveSettings(store: SettingsStore, settings: TablifySettings): Promise<void> {
  const clean = normalizeSettings(settings);
  await store.saveData({ airtableToken: clean.airtableToken });
}

/** A plugin that keeps its settings in memory, plus the store methods. */
export interface SettingsHost extends Plugin {
  settings: TablifySettings;
}

export class TablifySettingTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(app: App, host: SettingsHost) {
    super(app, host);
    this.host = host;
  }

  display(): void {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName('Airtable').setHeading();

    new Setting(containerEl)
      .setName('Personal access token')
      .setDesc(
        'Used only for Airtable sync. Stored in this plugin\u2019s settings. It is never written to .tablify files or exports.',
      )
      .addText((text) => {
        text.inputEl.type = 'password';
        text.inputEl.autocomplete = 'off';
        text.inputEl.spellcheck = false;
        text
          .setPlaceholder('Paste your Airtable token')
          .setValue(this.host.settings.airtableToken)
          .onChange(async (value) => {
            this.host.settings = normalizeSettings({ airtableToken: value });
            try {
              await saveSettings(this.host, this.host.settings);
            } catch {
              // Save errors are not shown with the value, so the token cannot leak through a message.
            }
          });
      });
  }
}
