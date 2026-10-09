// T-I for P4-04: import orchestration — collision naming, no overwrite, atomic failure, XLSX path.
import { describe, it, expect, beforeAll } from 'vitest';
import { importTable, candidatePath, pickFreePath, baseNameFrom, type ImportAdapter } from '../../src/io/import/importer.js';

import { makeModel, makeXlsx } from './import.fixtures.js';

/** In-memory adapter that mirrors vault.create semantics: fails if the path exists. */
function memoryAdapter(existing: string[] = []) {
  const files = new Map<string, string>(existing.map((p) => [p, 'OLD']));
  const createCalls: string[] = [];
  const adapter: ImportAdapter = {
    exists: (p) => files.has(p),
    create: async (p, data) => {
      createCalls.push(p);
      if (files.has(p)) throw new Error('File already exists.');
      files.set(p, data);
    },
  };
  return { adapter, files, createCalls };
}

beforeAll(async () => {
  // read-excel-file's browser build needs DOMParser (P4-02 finding F6). Node has none, so provide jsdom's.
  if (!(globalThis as { DOMParser?: unknown }).DOMParser) {
    const { JSDOM } = await import('jsdom');
    (globalThis as { DOMParser?: unknown }).DOMParser = new JSDOM('').window.DOMParser;
  }
});

describe('naming', () => {
  it('baseNameFrom strips the extension and makes names Obsidian-safe', () => {
    expect(baseNameFrom('Tasks.csv')).toBe('Tasks');
    expect(baseNameFrom('My:Data#1.XLSX')).toBe('My-Data-1');
    expect(baseNameFrom('.csv')).toBe('Imported table');
  });
  it('candidatePath numbers collisions from 2 and uses folder', () => {
    expect(candidatePath('', 'Tasks', 1)).toBe('Tasks.tablify');
    expect(candidatePath('Work', 'Tasks', 2)).toBe('Work/Tasks 2.tablify');
  });
  it('pickFreePath skips existing names', () => {
    const existing = new Set(['Tasks.tablify', 'Tasks 2.tablify']);
    expect(pickFreePath('', 'Tasks', (p) => existing.has(p))).toBe('Tasks 3.tablify');
  });
});

describe('importTable — CSV', () => {
  it('writes once to the free name and reports the row count', async () => {
    const { adapter, files, createCalls } = memoryAdapter(['Tasks.tablify']);
    const out = await importTable({ kind: 'csv', fileName: 'Tasks.csv', data: 'A,B\n1,x\n2,y\n', folder: '', adapter });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.path).toBe('Tasks 2.tablify');
    expect(createCalls).toEqual(['Tasks 2.tablify']);
    expect(files.get('Tasks.tablify')).toBe('OLD'); // never overwritten
    expect(out.report.rowCount).toBe(2);
  });

  it('serialization failure: no file is written (failure test)', async () => {
    const { adapter, files, createCalls } = memoryAdapter();
    const out = await importTable({
      kind: 'csv',
      fileName: 'Tasks.csv',
      data: 'A\n1\n',
      folder: '',
      adapter,
      build: { serialize: () => { throw new Error('simulated serializer failure'); } },
    });
    expect(out.ok).toBe(false);
    expect(createCalls).toEqual([]);
    expect(files.size).toBe(0);
  });

  it('CSV parse error: no file is written', async () => {
    const { adapter, createCalls } = memoryAdapter();
    const out = await importTable({ kind: 'csv', fileName: 'Bad.csv', data: 'A,B\n"unterminated', folder: '', adapter });
    expect(out.ok).toBe(false);
    expect(createCalls).toEqual([]);
  });

  it('a create that races with another writer moves on to the next name', async () => {
    const files = new Map<string, string>();
    let raced = false;
    const adapter: ImportAdapter = {
      exists: (p) => files.has(p),
      create: async (p, d) => {
        if (!raced) {
          raced = true;
          files.set(p, 'someone else');
          throw new Error('race');
        }
        files.set(p, d);
      },
    };
    const out = await importTable({ kind: 'csv', fileName: 'R.csv', data: 'A\n1\n', folder: 'Work', adapter });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.path).toBe('Work/R 2.tablify');
  });

  it('writes into the chosen folder', async () => {
    const { adapter } = memoryAdapter();
    const out = await importTable({ kind: 'csv', fileName: 'T.csv', data: 'A\n1\n', folder: 'Projects/Q4', adapter });
    expect(out.ok && out.path).toBe('Projects/Q4/T.tablify');
  });
});

describe('importTable — XLSX', () => {
  it('imports the first sheet and reports ignored sheets', async () => {
    const XLSX = await import('xlsx');
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['A', 'B'], ['x', 1], ['y', 2]]), 'First');
    XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet([['Z'], ['q']]), 'Second');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const { adapter, createCalls } = memoryAdapter();
    const out = await importTable({ kind: 'xlsx', fileName: 'Book.xlsx', data: bytes, folder: '', adapter });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    expect(out.sheetName).toBe('First');
    expect(out.ignoredSheets).toBe(1);
    expect(out.report.rowCount).toBe(2);
    expect(createCalls).toEqual(['Book.tablify']);
  });

  it('a corrupt XLSX file produces an error and no write', async () => {
    const { adapter, createCalls } = memoryAdapter();
    const out = await importTable({ kind: 'xlsx', fileName: 'Bad.xlsx', data: new TextEncoder().encode('not a zip').buffer, folder: '', adapter });
    expect(out.ok).toBe(false);
    expect(createCalls).toEqual([]);
  });

  it('kind and data type mismatch is rejected', async () => {
    const { adapter } = memoryAdapter();
    const out = await importTable({ kind: 'csv', fileName: 'x.csv', data: new ArrayBuffer(4), folder: '', adapter });
    expect(out.ok).toBe(false);
  });

  it('XLSX fixture is parsed the same as a direct SheetJS write', async () => {
    const model = makeModel(5);
    const bytes = await makeXlsx(model.xlsxRows);
    const { adapter } = memoryAdapter();
    const out = await importTable({ kind: 'xlsx', fileName: 'M.xlsx', data: bytes, folder: '', adapter });
    expect(out.ok).toBe(true);
    if (out.ok) expect(out.report.rowCount).toBe(5);
  });
});

describe('XLSX native date cells (P4-02 F2: timezone safety)', () => {
  it('Excel date cells import as the same calendar day in any timezone', async () => {
    const XLSX = await import('xlsx');
    // Real Excel storage: integer day serials with a date number format (not SheetJS cellDates,
    // which writes local-time fractional serials that real files do not contain).
    const isoDays = ['2026-01-05', '2025-02-28', '2024-02-29'];
    const serial = (iso: string) => (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) - Date.UTC(1899, 11, 30)) / 86_400_000;
    const ws: Record<string, unknown> = { '!ref': 'A1:A4', A1: { t: 's', v: 'Day' } };
    isoDays.forEach((iso, i) => {
      ws[`A${i + 2}`] = { t: 'n', v: serial(iso), z: 'yyyy-mm-dd' };
    });
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws as never, 'D');
    const bytes = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
    const { adapter, files: written } = memoryAdapter();
    const out = await importTable({ kind: 'xlsx', fileName: 'Dates.xlsx', data: bytes, folder: '', adapter });
    expect(out.ok).toBe(true);
    if (!out.ok) return;
    const parsed = JSON.parse(written.get(out.path)!);
    expect(parsed.fields[0].type).toBe('date');
    expect(parsed.rows.map((r: { values: Record<string, string> }) => r.values[parsed.fields[0].id])).toEqual(isoDays);
  });
});

