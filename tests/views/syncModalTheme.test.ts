/**
 * @vitest-environment jsdom
 *
 * SAD-107 — the Airtable sync dialog is readable and themed like the other plugin dialogs.
 *
 * Cause: every other plugin dialog calls `dressProtoModal` / `applyTheme`, which set the
 * `--tablify-*` tokens on the dialog. SyncModal did neither, so its card, status colour and
 * borders read tokens that were never defined. Its error text also used the accent colour
 * (terracotta, 3.28:1 on white in the light theme), and its secondary lines were dimmed with
 * `opacity: 0.8`.
 *
 * These tests pin the fix: the dialog is dressed like the others; error text uses a readable text
 * token with an accent bar; secondary text is not dimmed; and every text token meets WCAG AA on the
 * card in both themes. The behaviour tests in syncModal.test.ts are unchanged and must stay green.
 *
 * Fails on 77706ce (before the fix): the dialog has no `tablify__pmodal` class or theme tokens, and
 * the error and secondary rules use the accent colour and opacity.
 */

import { describe, it, expect, vi } from 'vitest';
import * as fs from 'fs';
import * as path from 'path';
import { App } from 'obsidian';
import { SyncModal } from '../../src/views/sync/SyncModal.js';
import { makeFixture } from '../sync/engineHarness.js';
import { lightTheme, darkTheme } from '../../src/ui/theme/tokens.js';
import { contrastRatio, meetsAA } from '../../src/ui/theme/contrast.js';

interface CssRule {
  selectors: string[];
  body: string;
}

function readRules(css: string): CssRule[] {
  const src = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out: CssRule[] = [];
  let i = 0;
  while (i < src.length) {
    const open = src.indexOf('{', i);
    if (open < 0) break;
    const prelude = src.slice(i, open).trim();
    let depth = 1;
    let j = open + 1;
    while (j < src.length && depth > 0) {
      if (src[j] === '{') depth++;
      else if (src[j] === '}') depth--;
      j++;
    }
    const body = src.slice(open + 1, j - 1);
    // Top-level rules only; `@media` blocks are not used by the sync rules.
    if (!prelude.startsWith('@')) {
      out.push({ selectors: prelude.split(',').map((s) => s.trim()), body });
    }
    i = j;
  }
  return out;
}

const css = fs.readFileSync(path.resolve(process.cwd(), 'styles.css'), 'utf8');
const rules = readRules(css);
const rule = (selector: string): CssRule | undefined => rules.find((r) => r.selectors.includes(selector));

describe('SAD-107 — the sync dialog wears the plugin theme', () => {
  it('is dressed like the other plugin dialogs, with its theme tokens set on the card', () => {
    const f = makeFixture({ linked: false });
    const modal = new SyncModal(new App(), {
      session: f.session,
      token: 'pat-test-0123456789abcdef',
      makeClient: () => f.ctx.client as never,
      changed: vi.fn(),
    });
    modal.onOpen();
    expect(modal.modalEl.classList.contains('tablify__pmodal')).toBe(true);
    expect(modal.modalEl.classList.contains('tablify__modal')).toBe(true);
    // applyTheme writes the --tablify-* variables inline on the card.
    expect(modal.modalEl.style.getPropertyValue('--tablify-bg-card')).not.toBe('');
    expect(modal.modalEl.style.getPropertyValue('--tablify-accent-primary')).not.toBe('');
  });
});

describe('SAD-107 — text roles are readable', () => {
  it('error status uses a readable text colour, with the accent as a bar, not as the text colour', () => {
    const err = rule('.tablify-sync__status--error');
    expect(err, 'error rule exists').toBeDefined();
    expect(err?.body).not.toMatch(/color:\s*var\(--tablify-accent-primary\)/);
    expect(err?.body).toMatch(/color:\s*var\(--tablify-text\)/);
    expect(err?.body).toMatch(/border-left:\s*3px solid var\(--tablify-accent-primary\)/);
  });

  it('secondary lines (token, scopes, last sync) are not dimmed with opacity', () => {
    const secondary = rule('.tablify-sync__token');
    expect(secondary, 'secondary rule exists').toBeDefined();
    expect(secondary?.body).not.toMatch(/opacity:/);
    expect(secondary?.body).toMatch(/color:\s*var\(--tablify-text-muted\)/);
  });

  it('every text token used by the dialog meets WCAG AA on the card, in both themes', () => {
    const roles: Array<[string, string, string]> = [
      ['light primary text', lightTheme.text, lightTheme.bgCard],
      ['light muted text', lightTheme.textMuted, lightTheme.bgCard],
      ['dark primary text', darkTheme.text, darkTheme.bgCard],
      ['dark muted text', darkTheme.textMuted, darkTheme.bgCard],
    ];
    for (const [name, fg, bg] of roles) {
      expect(meetsAA(contrastRatio(fg, bg)), `${name}: ${fg} on ${bg}`).toBe(true);
    }
  });
});
