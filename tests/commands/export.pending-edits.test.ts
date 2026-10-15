/**
 * @vitest-environment jsdom
 */

import { describe, it, expect, vi } from 'vitest';
import { flushPendingExportEdits } from '../../src/commands/export.js';
import type { App, TFile } from 'obsidian';

function appWithViews(activeView: unknown, views: unknown[]): App {
  return {
    workspace: {
      activeLeaf: activeView ? { view: activeView } : null,
      getLeavesOfType: vi.fn(() => views.map((view) => ({ view }))),
    },
  } as unknown as App;
}

const source = { path: 'Tables/Budget.tablify' } as TFile;

describe('flushPendingExportEdits', () => {
  it('saves the active matching table view before the export reads from the vault', async () => {
    const events: string[] = [];
    const active = {
      file: { path: source.path },
      save: vi.fn(async () => {
        await Promise.resolve();
        events.push('saved');
      }),
    };
    await flushPendingExportEdits(appWithViews(active, [active]), source);
    events.push('read');
    expect(active.save).toHaveBeenCalledOnce();
    expect(events).toEqual(['saved', 'read']);
  });

  it('finds a matching open table when another view is active', async () => {
    const active = { file: { path: 'Notes/Other.md' }, save: vi.fn() };
    const matching = { file: { path: source.path }, save: vi.fn(async () => undefined) };
    await flushPendingExportEdits(appWithViews(active, [matching]), source);
    expect(active.save).not.toHaveBeenCalled();
    expect(matching.save).toHaveBeenCalledOnce();
  });

  it('does nothing when the source table is closed', async () => {
    const active = { file: { path: 'Notes/Other.md' }, save: vi.fn() };
    await flushPendingExportEdits(appWithViews(active, []), source);
    expect(active.save).not.toHaveBeenCalled();
  });
});
