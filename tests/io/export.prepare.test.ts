import { describe, it, expect } from 'vitest';
import { serialize } from '../../src/format/serialize.js';
import { prepareExportFile } from '../../src/io/export/prepare.js';
import { makeFile } from './export.fixtures.js';

describe('prepareExportFile', () => {
  it('returns an in-memory artifact with the requested filename and counts', async () => {
    const text = serialize(makeFile(3));
    const result = await prepareExportFile(async () => text, 'Budget', 'csv', { fullTable: false });
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.artifact.fileName).toBe('Budget.csv');
    expect(result.artifact.mimeType).toBe('text/csv');
    expect(typeof result.artifact.data).toBe('string');
    expect(result.rowCount).toBe(3);
    expect(result.columnCount).toBeGreaterThan(0);
  });

  it('returns a clear failure when reading the source table rejects', async () => {
    const result = await prepareExportFile(
      async () => {
        throw new Error('source unavailable');
      },
      'Budget',
      'csv',
      { fullTable: false },
    );
    expect(result).toEqual({ ok: false, error: 'Could not read the table file: source unavailable' });
  });

  it('returns a clear failure when the source text is not a valid table file', async () => {
    const result = await prepareExportFile(async () => '{not json', 'Budget', 'csv', { fullTable: false });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/table file could not be read/i);
  });

  it('does not silently export all rows when the requested query is invalid', async () => {
    const text = serialize(makeFile(3));
    const result = await prepareExportFile(async () => text, 'Budget', 'csv', {
      fullTable: false,
      query: 'NoSuchField:1',
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error).toMatch(/Filter error/);
  });
});
