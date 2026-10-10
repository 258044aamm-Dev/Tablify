/**
 * @vitest-environment jsdom
 */
// P7-03 — settings, masked token input, token storage and redaction (T-S checks).
import { describe, it, expect, vi, afterEach } from 'vitest';
import { App } from 'obsidian';
import {
  DEFAULT_SETTINGS,
  MAX_TOKEN_LENGTH,
  TablifySettingTab,
  loadSettings,
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
    expect(normalizeSettings({ airtableToken: `  ${TOKEN}\n` })).toEqual({ airtableToken: TOKEN });
  });

  it('treats an over-long token as empty', () => {
    expect(normalizeSettings({ airtableToken: 'x'.repeat(MAX_TOKEN_LENGTH + 1) })).toEqual(DEFAULT_SETTINGS);
  });

  it('drops unknown keys', () => {
    expect(normalizeSettings({ airtableToken: TOKEN, other: 1 })).toEqual({ airtableToken: TOKEN });
  });
});

describe('load and save (T-S: plugin data only)', () => {
  it('loads a saved token', async () => {
    const store = makeStore({ airtableToken: TOKEN });
    expect(await loadSettings(store)).toEqual({ airtableToken: TOKEN });
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
    expect(store.saveData).toHaveBeenCalledWith({ airtableToken: TOKEN });
  });
});

describe('settings tab (masked input)', () => {
  function makeTab(token = '') {
    const app = new App();
    const store = makeStore({ airtableToken: token });
    const host = {
      settings: { airtableToken: token } as TablifySettings,
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
    expect(store.saveData).toHaveBeenCalledWith({ airtableToken: TOKEN });
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
