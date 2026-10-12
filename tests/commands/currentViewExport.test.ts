/**
 * @vitest-environment jsdom
 *
 * Command-palette entry points for the two one-click actions SAD-98 removed from the title row
 * (Export current view as CSV / Copy current view as Markdown). The commands are thin glue over
 * the open TableView; the export behaviour itself is covered in tests/views/tableViewTitleRow.test.ts.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { Plugin, Notice, App } from 'obsidian';
import {
  registerCurrentViewExportCommands,
  EXPORT_VIEW_CSV_COMMAND_ID,
  EXPORT_VIEW_CSV_COMMAND_NAME,
  COPY_MARKDOWN_COMMAND_ID,
  COPY_MARKDOWN_COMMAND_NAME,
  type CurrentViewExportTarget,
} from '../../src/commands/export.js';

function fakeTarget(): CurrentViewExportTarget & {
  exportCurrentViewCsv: ReturnType<typeof vi.fn>;
  copyCurrentViewMarkdown: ReturnType<typeof vi.fn>;
} {
  return {
    exportCurrentViewCsv: vi.fn(async () => undefined),
    copyCurrentViewMarkdown: vi.fn(async () => undefined),
  };
}

function register(getTable: () => CurrentViewExportTarget | null) {
  const plugin = new Plugin(new App(), {});
  registerCurrentViewExportCommands(plugin, getTable);
  return plugin;
}

beforeEach(() => {
  Notice.messages = [];
});

describe('current-view export commands (SAD-98)', () => {
  it('registers the two commands with stable ids and names', () => {
    const plugin = register(() => null);
    const ids = plugin.commands.map((c) => c.id);
    expect(ids).toContain(EXPORT_VIEW_CSV_COMMAND_ID);
    expect(ids).toContain(COPY_MARKDOWN_COMMAND_ID);
    const byId = (id: string) => plugin.commands.find((c) => c.id === id);
    expect(byId(EXPORT_VIEW_CSV_COMMAND_ID)?.name).toBe(EXPORT_VIEW_CSV_COMMAND_NAME);
    expect(byId(COPY_MARKDOWN_COMMAND_ID)?.name).toBe(COPY_MARKDOWN_COMMAND_NAME);
  });

  it('Export current view as CSV calls the open table’s exporter', () => {
    const target = fakeTarget();
    const plugin = register(() => target);
    plugin.commands.find((c) => c.id === EXPORT_VIEW_CSV_COMMAND_ID)?.callback?.();
    expect(target.exportCurrentViewCsv).toHaveBeenCalledTimes(1);
    expect(target.copyCurrentViewMarkdown).not.toHaveBeenCalled();
  });

  it('Copy current view as Markdown calls the open table’s copier', () => {
    const target = fakeTarget();
    const plugin = register(() => target);
    plugin.commands.find((c) => c.id === COPY_MARKDOWN_COMMAND_ID)?.callback?.();
    expect(target.copyCurrentViewMarkdown).toHaveBeenCalledTimes(1);
    expect(target.exportCurrentViewCsv).not.toHaveBeenCalled();
  });

  it('without an open table both commands report and do nothing', () => {
    const target = fakeTarget();
    const plugin = register(() => null);
    plugin.commands.find((c) => c.id === EXPORT_VIEW_CSV_COMMAND_ID)?.callback?.();
    plugin.commands.find((c) => c.id === COPY_MARKDOWN_COMMAND_ID)?.callback?.();
    expect(target.exportCurrentViewCsv).not.toHaveBeenCalled();
    expect(target.copyCurrentViewMarkdown).not.toHaveBeenCalled();
    expect(Notice.messages).toEqual([
      'Open a .tablify table first.',
      'Open a .tablify table first.',
    ]);
  });
});
