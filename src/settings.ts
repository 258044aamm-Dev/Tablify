// P7-03 — plugin settings and the Airtable token (v1.1).
//
// Rules (spec/steps/P7-03.md, roadmap §7 contracts):
//  - The token lives only in the plugin's own data (Obsidian's plugin data.json).
//  - It is never written to a .tablify file, an export, a log, or an error message.
//  - The settings input is masked (type="password").

import { PluginSettingTab, Setting, type App, type Plugin } from 'obsidian';
// SAD-376: the overflow config and its defaults live in the leaf grid module, so the grid itself
// never has to import this file (which pulls in Obsidian). This is the one direction of the edge.
import { DEFAULT_OVERFLOW_CONFIG, type CellOverflowConfig } from './views/grid/cellOverflow.js';

export type { CellOverflowConfig };

export interface TablifySettings {
  /** Airtable personal access token. Plugin data only. */
  airtableToken: string;
  /**
   * SAD-350 round 2 (opt-in, default off): when no native save destination works, write the
   * export into the vault next to the table instead of ending with nothing. Off by default so
   * the documented rule — exports never write into the vault — holds unless asked for.
   */
  exportVaultFallback: boolean;
  /**
   * SAD-376: offer the expand affordance on a cell whose text is longer than the limit. One
   * plugin-wide rule, stored beside the token — never in a `.tablify` file, so no `formatVersion`
   * change and nothing to migrate.
   */
  cellOverflowEnabled: boolean;
  /** SAD-376: character limit above which a cell offers Expand. Clamped to the range below. */
  cellOverflowMaxChars: number;
  /** SAD-376: the hover preview card. Off = the in-cell control opens the panel directly. */
  cellOverflowHoverCard: boolean;
  /** SAD-376: coarse pointers have no hover, so keep the control visible and add the menu entry. */
  cellOverflowTouchReveal: boolean;
}

/** SAD-376: narrowest and widest accepted limit. Below 20 the control would cover real values;
 *  above 2000 the panel is unreadable and the limit stops being a limit. */
export const CELL_OVERFLOW_MIN_CHARS = 20;
export const CELL_OVERFLOW_MAX_CHARS = 2000;

export const DEFAULT_SETTINGS: Readonly<TablifySettings> = Object.freeze({
  airtableToken: '',
  exportVaultFallback: false,
  cellOverflowEnabled: DEFAULT_OVERFLOW_CONFIG.enabled,
  cellOverflowMaxChars: DEFAULT_OVERFLOW_CONFIG.maxChars,
  cellOverflowHoverCard: DEFAULT_OVERFLOW_CONFIG.hoverCard,
  cellOverflowTouchReveal: DEFAULT_OVERFLOW_CONFIG.touchReveal,
});

/** The four SAD-376 keys, as the settings object stores them. */
export type CellOverflowSettings = Pick<
  TablifySettings,
  'cellOverflowEnabled' | 'cellOverflowMaxChars' | 'cellOverflowHoverCard' | 'cellOverflowTouchReveal'
>;

/** SAD-376: the defaults, as the grid wants them (the same numbers `DEFAULT_SETTINGS` holds). */
export const DEFAULT_CELL_OVERFLOW: Readonly<CellOverflowConfig> = DEFAULT_OVERFLOW_CONFIG;

/**
 * SAD-376: plugin settings → the config a `GridView` takes. A fresh object every call, so a
 * caller can never mutate the frozen default by accident.
 */
export function cellOverflowConfig(settings: TablifySettings): CellOverflowConfig {
  return {
    enabled: settings.cellOverflowEnabled,
    maxChars: settings.cellOverflowMaxChars,
    hoverCard: settings.cellOverflowHoverCard,
    touchReveal: settings.cellOverflowTouchReveal,
  };
}

/** SAD-376: a limit from anywhere (plugin data, the settings field) → one we can use. Never throws. */
export function clampCellOverflowChars(raw: unknown): number {
  if (typeof raw !== 'number' || !Number.isFinite(raw)) return DEFAULT_CELL_OVERFLOW.maxChars;
  return Math.min(CELL_OVERFLOW_MAX_CHARS, Math.max(CELL_OVERFLOW_MIN_CHARS, Math.round(raw)));
}

/** SAD-376: the four keys out of whatever plugin data holds. Unknown or wrong-typed values fall
 *  back to the defaults, so a corrupt data.json can never disable or over-widen the limit by
 *  accident. */
export function normalizeCellOverflowSettings(raw: unknown): CellOverflowSettings {
  const record = raw !== null && typeof raw === 'object' && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
  const bool = (value: unknown, fallback: boolean): boolean => (typeof value === 'boolean' ? value : fallback);
  return {
    cellOverflowEnabled: bool(record.cellOverflowEnabled, DEFAULT_SETTINGS.cellOverflowEnabled),
    cellOverflowMaxChars: clampCellOverflowChars(record.cellOverflowMaxChars),
    cellOverflowHoverCard: bool(record.cellOverflowHoverCard, DEFAULT_SETTINGS.cellOverflowHoverCard),
    cellOverflowTouchReveal: bool(record.cellOverflowTouchReveal, DEFAULT_SETTINGS.cellOverflowTouchReveal),
  };
}

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
  // SAD-376: the four overflow keys are read first and carried through every branch below, so a
  // damaged token can never reset them and they are always freshly built (never the frozen
  // DEFAULT_SETTINGS values by reference).
  const overflow = normalizeCellOverflowSettings(raw);
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ...DEFAULT_SETTINGS, ...overflow };
  }
  const record = raw as Record<string, unknown>;
  const token = record.airtableToken;
  // Only an explicit `true` enables it; anything else is the safe default.
  const exportVaultFallback = record.exportVaultFallback === true;
  if (typeof token !== 'string') return { ...DEFAULT_SETTINGS, ...overflow };
  const trimmed = token.trim();
  if (trimmed.length > MAX_TOKEN_LENGTH) return { ...DEFAULT_SETTINGS, ...overflow };
  return { airtableToken: trimmed, exportVaultFallback, ...overflow };
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
  await store.saveData({
    airtableToken: clean.airtableToken,
    exportVaultFallback: clean.exportVaultFallback,
    cellOverflowEnabled: clean.cellOverflowEnabled,
    cellOverflowMaxChars: clean.cellOverflowMaxChars,
    cellOverflowHoverCard: clean.cellOverflowHoverCard,
    cellOverflowTouchReveal: clean.cellOverflowTouchReveal,
  });
}

/** A plugin that keeps its settings in memory, plus the store methods. */
export interface SettingsHost extends Plugin {
  settings: TablifySettings;
  /** SAD-376: ask open tables to repaint with the new overflow settings. Optional, so a host that
   *  does not implement it (a test double) still works — the change lands on the next render. */
  refreshOpenTables?(): void;
}

export class TablifySettingTab extends PluginSettingTab {
  private readonly host: SettingsHost;

  constructor(app: App, host: SettingsHost) {
    super(app, host);
    this.host = host;
  }

  /**
   * SAD-376: one commit path for the overflow controls — normalise, store in memory, save, and ask
   * open tables to repaint. A failed save leaves the value the UI shows alone, the same rule the
   * token uses.
   */
  private async persistOverflow(patch: Partial<CellOverflowSettings>): Promise<void> {
    this.host.settings = normalizeSettings({ ...this.host.settings, ...patch });
    try {
      await saveSettings(this.host, this.host.settings);
      this.host.refreshOpenTables?.();
    } catch {
      // Same rule as the token: a failed save does not change what the settings UI shows.
    }
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
            this.host.settings = normalizeSettings({ ...this.host.settings, airtableToken: value });
            try {
              await saveSettings(this.host, this.host.settings);
            } catch {
              // Save errors are not shown with the value, so the token cannot leak through a message.
            }
          });
      });

    new Setting(containerEl).setName('Export').setHeading();

    new Setting(containerEl)
      .setName('Save into the vault when no save destination works')
      .setDesc(
        'Last resort only: if the system save dialog, the share sheet and the shared folder are all unavailable, write the export next to the table (never overwriting). Off by default — exports otherwise never write into the vault.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.exportVaultFallback).onChange(async (value) => {
          this.host.settings = normalizeSettings({ ...this.host.settings, exportVaultFallback: value });
          try {
            await saveSettings(this.host, this.host.settings);
          } catch {
            // Same rule as the token: a failed save does not change what the UI shows.
          }
        }),
      );

    // SAD-376: reading a long cell in full. Every control writes through `persistOverflow`, and
    // nothing here touches a `.tablify` file, the store or the undo stack.
    new Setting(containerEl).setName('Cells').setHeading();

    new Setting(containerEl)
      .setName('Expand long cells')
      .setDesc(
        'Show an expand control on a cell whose text is longer than the limit below. It opens the full text; the cell itself never changes and the table keeps its ellipsis.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.cellOverflowEnabled).onChange(async (value) => {
          await this.persistOverflow({ cellOverflowEnabled: value });
        }),
      );

    new Setting(containerEl)
      .setName('Expand above this many characters')
      .setDesc(`Between ${CELL_OVERFLOW_MIN_CHARS} and ${CELL_OVERFLOW_MAX_CHARS}.`)
      .addText((text) => {
        text.inputEl.type = 'number';
        text.inputEl.min = String(CELL_OVERFLOW_MIN_CHARS);
        text.inputEl.max = String(CELL_OVERFLOW_MAX_CHARS);
        text.inputEl.step = '10';
        text.setValue(String(this.host.settings.cellOverflowMaxChars));
        text.onChange((value) => {
          const typed = Number.parseInt(value, 10);
          // Mid-edit (an empty field, a stray letter) commits nothing.
          if (!Number.isFinite(typed)) return;
          void this.persistOverflow({ cellOverflowMaxChars: clampCellOverflowChars(typed) });
        });
        // Show the value that was actually stored once the field is left (5 becomes 20).
        text.inputEl.addEventListener('blur', () => {
          text.setValue(String(this.host.settings.cellOverflowMaxChars));
        });
      });

    new Setting(containerEl)
      .setName('Preview the full text on hover')
      .setDesc(
        'Resting on the expand control shows the whole value in a small card. Off: the control opens the panel straight away.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.cellOverflowHoverCard).onChange(async (value) => {
          await this.persistOverflow({ cellOverflowHoverCard: value });
        }),
      );

    new Setting(containerEl)
      .setName('Show the expand control on touch screens')
      .setDesc(
        'A touch screen has no hover, so the control stays visible on a long cell and the cell menu gains Expand cell.',
      )
      .addToggle((toggle) =>
        toggle.setValue(this.host.settings.cellOverflowTouchReveal).onChange(async (value) => {
          await this.persistOverflow({ cellOverflowTouchReveal: value });
        }),
      );
  }
}
