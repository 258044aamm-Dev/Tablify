/**
 * @vitest-environment jsdom
 */
// P7-03 — settings, masked token input, token storage and redaction (T-S checks).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { App } from 'obsidian';
import {
  CELL_OVERFLOW_MAX_CHARS,
  CELL_OVERFLOW_MIN_CHARS,
  DEFAULT_CELL_OVERFLOW,
  DEFAULT_SETTINGS,
  MAX_TOKEN_LENGTH,
  TablifySettingTab,
  cellOverflowConfig,
  clampCellOverflowChars,
  loadSettings,
  normalizeCellOverflowSettings,
  normalizeSettings,
  saveSettings,
  type SettingsHost,
  type TablifySettings,
} from '../../src/settings.js';
import { REDACTED, containsSecret, redactSecrets } from '../../src/sync/redact.js';
import { parse } from '../../src/format/parse.js';
import { serialize } from '../../src/format/serialize.js';
import { createSession } from '../../src/model/tableSession.js';
import { readFileSync } from 'fs';
import { join } from 'path';

const TOKEN = 'patSECRETtoken9999999.0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';

/** SAD-376: the four overflow keys at their defaults, so an exact-equality assertion below only
 *  has to name the keys it is actually about. */
const OVERFLOW_DEFAULTS = {
  cellOverflowEnabled: true,
  cellOverflowMaxChars: 80,
  cellOverflowHoverCard: true,
  cellOverflowTouchReveal: true,
} as const;

/** A complete settings object for the tests that pass one into `saveSettings` / a host. */
function settingsWith(patch: Partial<TablifySettings> = {}): TablifySettings {
  return { airtableToken: '', exportVaultFallback: false, ...OVERFLOW_DEFAULTS, ...patch };
}

function makeStore(initial: unknown = {}) {
  const store = {
    data: initial as unknown,
    loadData: vi.fn(async () => store.data),
    saveData: vi.fn(async (d: unknown) => {
      store.data = d;
    }),
  };
  return store;
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('normalizeSettings', () => {
  it('returns defaults for null, arrays, and non-objects', () => {
    expect(normalizeSettings(null)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings(undefined)).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings('pat')).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings([TOKEN])).toEqual(DEFAULT_SETTINGS);
  });

  it('returns defaults when the token is not a string', () => {
    expect(normalizeSettings({ airtableToken: 42 })).toEqual(DEFAULT_SETTINGS);
    expect(normalizeSettings({ airtableToken: { x: 1 } })).toEqual(DEFAULT_SETTINGS);
  });

  it('trims whitespace from the token', () => {
    expect(normalizeSettings({ airtableToken: `  ${TOKEN}\n` })).toEqual({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: false,
    });
  });

  it('treats an over-long token as empty', () => {
    expect(normalizeSettings({ airtableToken: 'x'.repeat(MAX_TOKEN_LENGTH + 1) })).toEqual(DEFAULT_SETTINGS);
  });

  it('keeps the opt-in export fallback only when it is explicitly true (SAD-350 round 2)', () => {
    expect(normalizeSettings({}).exportVaultFallback).toBe(false);
    expect(normalizeSettings({ airtableToken: TOKEN }).exportVaultFallback).toBe(false);
    expect(normalizeSettings({ airtableToken: TOKEN, exportVaultFallback: 'yes' }).exportVaultFallback).toBe(false);
    expect(normalizeSettings({ airtableToken: TOKEN, exportVaultFallback: 1 }).exportVaultFallback).toBe(false);
    expect(normalizeSettings({ airtableToken: TOKEN, exportVaultFallback: true }).exportVaultFallback).toBe(true);
  });

  it('round-trips the export fallback through plugin data', async () => {
    const store = makeStore({ airtableToken: TOKEN, exportVaultFallback: true });
    expect(await loadSettings(store)).toEqual({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: true,
    });
    await saveSettings(store, settingsWith({ airtableToken: TOKEN, exportVaultFallback: true }));
    expect(store.saveData).toHaveBeenCalledWith({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: true,
    });
  });

  it('drops unknown keys', () => {
    expect(normalizeSettings({ airtableToken: TOKEN, other: 1 })).toEqual({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: false,
    });
  });
});

describe('load and save (T-S: plugin data only)', () => {
  it('loads a saved token', async () => {
    const store = makeStore({ airtableToken: TOKEN });
    expect(await loadSettings(store)).toEqual({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: false,
    });
  });

  it('falls back to defaults when reading plugin data fails', async () => {
    const store = {
      loadData: vi.fn(async () => {
        throw new Error('disk read failed');
      }),
      saveData: vi.fn(async () => undefined),
    };
    expect(await loadSettings(store)).toEqual(DEFAULT_SETTINGS);
  });

  it('saves only the known key, even when the object carries extra data', async () => {
    const store = makeStore();
    const dirty = { airtableToken: TOKEN, leak: 'do not save' } as unknown as TablifySettings;
    await saveSettings(store, dirty);
    expect(store.saveData).toHaveBeenCalledTimes(1);
    expect(store.saveData).toHaveBeenCalledWith({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: false,
    });
  });
});

describe('settings tab (masked input)', () => {
  function makeTab(token = '') {
    const app = new App();
    const store = makeStore({ airtableToken: token });
    const host = {
      settings: settingsWith({ airtableToken: token }),
      loadData: store.loadData,
      saveData: store.saveData,
    } as unknown as SettingsHost;
    const tab = new TablifySettingTab(app, host);
    tab.display();
    return { tab, host, store };
  }

  it('renders the token as a password input with autocomplete off', () => {
    const { tab } = makeTab(TOKEN);
    const input = tab.containerEl.querySelector('input');
    expect(input).not.toBeNull();
    expect(input?.type).toBe('password');
    expect(input?.autocomplete).toBe('off');
    expect(input?.value).toBe(TOKEN);
  });

  it('never puts the token in visible text (headings, descriptions, labels)', () => {
    const { tab } = makeTab(TOKEN);
    expect(tab.containerEl.textContent ?? '').not.toContain(TOKEN);
    expect(tab.containerEl.textContent ?? '').not.toContain('patSECRET');
  });

  it('saves to plugin data when the user types a token, and nowhere else', async () => {
    const { tab, host, store } = makeTab('');
    const input = tab.containerEl.querySelector('input') as HTMLInputElement;
    input.value = `  ${TOKEN}  `;
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    expect(host.settings.airtableToken).toBe(TOKEN);
    expect(store.saveData).toHaveBeenCalledWith({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: false,
    });
  });

  it('keeps the export fallback enabled when the token is edited (SAD-350 round 2)', async () => {
    const app = new App();
    const store = makeStore({ airtableToken: '', exportVaultFallback: true });
    const host = {
      settings: settingsWith({ airtableToken: '', exportVaultFallback: true }),
      loadData: store.loadData,
      saveData: store.saveData,
    } as unknown as SettingsHost;
    const tab = new TablifySettingTab(app, host);
    tab.display();

    const input = tab.containerEl.querySelector('input') as HTMLInputElement;
    input.value = TOKEN;
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));

    expect(host.settings.exportVaultFallback).toBe(true);
    expect(store.saveData).toHaveBeenCalledWith({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: true,
    });
  });

  it('renders the opt-in export fallback as a toggle that reflects the setting (SAD-350 round 2)', () => {
    const app = new App();
    const store = makeStore({ airtableToken: '', exportVaultFallback: true });
    const host = {
      settings: settingsWith({ airtableToken: '', exportVaultFallback: true }),
      loadData: store.loadData,
      saveData: store.saveData,
    } as unknown as SettingsHost;
    const tab = new TablifySettingTab(app, host);
    tab.display();

    const toggle = tab.containerEl.querySelector('input[type="checkbox"]') as HTMLInputElement | null;
    expect(toggle).not.toBeNull();
    expect(toggle?.checked).toBe(true);
    expect(tab.containerEl.textContent).toContain('Export');
  });

  it('does not log the token while saving', async () => {
    const spies = ['log', 'warn', 'error', 'info', 'debug'].map((m) =>
      vi.spyOn(console, m as 'log').mockImplementation(() => undefined),
    );
    const { tab } = makeTab('');
    const input = tab.containerEl.querySelector('input') as HTMLInputElement;
    input.value = TOKEN;
    input.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(TOKEN);
    }
  });
});

describe('SAD-376 — the cell overflow settings', () => {
  it('defaults to on, 80 characters, card on, touch reveal on', () => {
    expect(DEFAULT_CELL_OVERFLOW).toEqual({
      enabled: true,
      maxChars: 80,
      hoverCard: true,
      touchReveal: true,
    });
    expect(normalizeSettings({})).toMatchObject(OVERFLOW_DEFAULTS);
  });

  it('clamps and rounds the limit, and falls back for anything unusable', () => {
    expect(clampCellOverflowChars(5)).toBe(CELL_OVERFLOW_MIN_CHARS);
    expect(clampCellOverflowChars(-40)).toBe(CELL_OVERFLOW_MIN_CHARS);
    expect(clampCellOverflowChars(99_999)).toBe(CELL_OVERFLOW_MAX_CHARS);
    expect(clampCellOverflowChars(80.6)).toBe(81);
    expect(clampCellOverflowChars(120)).toBe(120);
    expect(clampCellOverflowChars('120')).toBe(80);
    expect(clampCellOverflowChars(Number.NaN)).toBe(80);
    expect(clampCellOverflowChars(null)).toBe(80);
    expect(clampCellOverflowChars(undefined)).toBe(80);
  });

  it('keeps only real booleans and falls back otherwise', () => {
    expect(normalizeCellOverflowSettings({ cellOverflowEnabled: 'yes' }).cellOverflowEnabled).toBe(true);
    expect(normalizeCellOverflowSettings({ cellOverflowEnabled: false }).cellOverflowEnabled).toBe(false);
    expect(normalizeCellOverflowSettings({ cellOverflowHoverCard: 0 }).cellOverflowHoverCard).toBe(true);
    expect(normalizeCellOverflowSettings({ cellOverflowHoverCard: false }).cellOverflowHoverCard).toBe(false);
    expect(normalizeCellOverflowSettings({ cellOverflowTouchReveal: null }).cellOverflowTouchReveal).toBe(true);
    expect(normalizeCellOverflowSettings(null)).toEqual(OVERFLOW_DEFAULTS);
  });

  it('reads plugin data written before this feature existed', async () => {
    const store = makeStore({ airtableToken: TOKEN, exportVaultFallback: true });
    expect(await loadSettings(store)).toEqual({
      ...OVERFLOW_DEFAULTS,
      airtableToken: TOKEN,
      exportVaultFallback: true,
    });
  });

  it('keeps the overflow settings when the stored token is damaged', () => {
    // A corrupt token falls back, but the reading preferences are not the token's business.
    expect(normalizeSettings({ airtableToken: 42, cellOverflowMaxChars: 120, cellOverflowEnabled: false })).toMatchObject({
      cellOverflowMaxChars: 120,
      cellOverflowEnabled: false,
    });
  });

  it('round-trips every overflow key through plugin data', async () => {
    const store = makeStore();
    await saveSettings(
      store,
      settingsWith({
        airtableToken: TOKEN,
        cellOverflowEnabled: false,
        cellOverflowMaxChars: 150,
        cellOverflowHoverCard: false,
        cellOverflowTouchReveal: false,
      }),
    );
    expect(store.saveData).toHaveBeenCalledWith({
      airtableToken: TOKEN,
      exportVaultFallback: false,
      cellOverflowEnabled: false,
      cellOverflowMaxChars: 150,
      cellOverflowHoverCard: false,
      cellOverflowTouchReveal: false,
    });
  });

  it('builds a fresh grid config, never the frozen default by reference', () => {
    const settings = settingsWith({ cellOverflowMaxChars: 120 });
    const config = cellOverflowConfig(settings);
    expect(config).toEqual({ enabled: true, maxChars: 120, hoverCard: true, touchReveal: true });
    expect(config).not.toBe(DEFAULT_CELL_OVERFLOW);
    expect(cellOverflowConfig(settings)).not.toBe(config);
    expect(normalizeSettings(null).cellOverflowMaxChars).toBe(80);
  });
});

describe('SAD-376 — the settings tab controls', () => {
  function makeOverflowTab(patch: Partial<TablifySettings> = {}, onRefresh?: () => void) {
    const app = new App();
    const store = makeStore();
    const host = {
      settings: settingsWith(patch),
      loadData: store.loadData,
      saveData: store.saveData,
      refreshOpenTables: onRefresh,
    } as unknown as SettingsHost;
    const tab = new TablifySettingTab(app, host);
    tab.display();
    return { tab, host, store };
  }

  it('renders a Cells section with the four controls at their stored values', () => {
    const { tab } = makeOverflowTab({ cellOverflowMaxChars: 120 });
    const text = tab.containerEl.textContent ?? '';
    expect(text).toContain('Cells');
    expect(text).toContain('Expand long cells');
    expect(text).toContain('Expand above this many characters');

    const toggles = Array.from(tab.containerEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    // The opt-in export toggle comes first; the three overflow switches follow it.
    expect(toggles.length).toBe(4);
    expect(toggles.slice(1).map((t) => t.checked)).toEqual([true, true, true]);

    const number = tab.containerEl.querySelector<HTMLInputElement>('input[type="number"]');
    expect(number?.value).toBe('120');
    expect(number?.min).toBe(String(CELL_OVERFLOW_MIN_CHARS));
    expect(number?.max).toBe(String(CELL_OVERFLOW_MAX_CHARS));
  });

  it('saves a toggle and asks open tables to repaint', async () => {
    const refresh = vi.fn();
    const { tab, host, store } = makeOverflowTab({}, refresh);
    const toggles = Array.from(tab.containerEl.querySelectorAll<HTMLInputElement>('input[type="checkbox"]'));
    const hoverCard = toggles[2];
    hoverCard.checked = false;
    hoverCard.dispatchEvent(new Event('change'));
    await new Promise((r) => setTimeout(r, 0));

    expect(host.settings.cellOverflowHoverCard).toBe(false);
    expect(store.saveData).toHaveBeenCalledTimes(1);
    expect(refresh).toHaveBeenCalledTimes(1);
  });

  it('stores a clamped limit and shows the stored value when the field is left', async () => {
    const { tab, host } = makeOverflowTab();
    const number = tab.containerEl.querySelector<HTMLInputElement>('input[type="number"]') as HTMLInputElement;

    number.value = '5';
    number.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    expect(host.settings.cellOverflowMaxChars).toBe(CELL_OVERFLOW_MIN_CHARS);

    number.dispatchEvent(new Event('blur'));
    expect(number.value).toBe(String(CELL_OVERFLOW_MIN_CHARS));
  });

  it('does not save while the limit field is empty', async () => {
    const { tab, store } = makeOverflowTab();
    const number = tab.containerEl.querySelector<HTMLInputElement>('input[type="number"]') as HTMLInputElement;
    number.value = '';
    number.dispatchEvent(new Event('input'));
    await new Promise((r) => setTimeout(r, 0));
    expect(store.saveData).not.toHaveBeenCalled();
  });
});

describe('token never reaches a .tablify file or export (T-S)', () => {
  it('a session with the token in settings serializes without the token', () => {
    const text = readFileSync(join(process.cwd(), 'samples', 'v1', 'synced.tablify'), 'utf-8');
    const parsed = parse(text);
    if (!parsed.ok) throw new Error('fixture must parse');
    const session = createSession(parsed.data);
    session.setValue('row_CCC333', 'fld_name', 'Edited');
    // The token exists only in settings. Nothing here reads it, so it cannot reach the file.
    const out = serialize(session.toFile());
    expect(out).not.toContain(TOKEN);
    expect(out).not.toContain('patSECRET');
  });
});

describe('redaction helper', () => {
  it('removes the exact secret', () => {
    expect(redactSecrets(`failed for ${TOKEN} today`, TOKEN)).toBe(`failed for ${REDACTED} today`);
  });

  it('removes Bearer values even when the secret is not given', () => {
    expect(redactSecrets('Authorization: Bearer patXYZ123.abc')).toBe(`Authorization: Bearer ${REDACTED}`);
  });

  it('removes token-shaped values', () => {
    const shaped = 'pat' + 'A'.repeat(14) + '.' + 'f'.repeat(64);
    expect(redactSecrets(`value ${shaped}`)).toBe(`value ${REDACTED}`);
  });

  it('does not treat very short secrets as literals', () => {
    expect(redactSecrets('the cat sat', 'cat')).toBe('the cat sat');
  });

  it('containsSecret detects the literal, a Bearer value, and a PAT shape, and ignores redacted text', () => {
    expect(containsSecret(`x ${TOKEN}`, TOKEN)).toBe(true);
    expect(containsSecret('Bearer abc')).toBe(true);
    expect(containsSecret(redactSecrets(`x ${TOKEN}`, TOKEN), TOKEN)).toBe(false);
    expect(containsSecret('no secret here')).toBe(false);
  });
});
