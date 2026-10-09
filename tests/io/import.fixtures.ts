// Shared fixture for P4-04 import tests. Produces the same logical table as CSV text and as XLSX bytes.
import { mulberry32 } from './rng.js';

export const HEADER = ['Task', 'Estimate', 'Due', 'Done', 'Status', 'Notes'];
export const STATUSES = ['Todo', 'Doing', 'Done'];

export interface Expected {
  Task: string;
  Estimate: number | null;
  Due: string;
  Done: boolean;
  Status: string;
  Notes: string | null;
}

/** Deterministic typed model. Expected values are what the import must produce for each cell. */
export function makeModel(n: number, seed = 4242): { expected: Expected[]; csv: string; xlsxRows: (string | number | boolean | null)[][] } {
  const rand = mulberry32(seed);
  const expected: Expected[] = [];
  const xlsxRows: (string | number | boolean | null)[][] = [HEADER.slice()];
  const csvLines: string[] = [HEADER.join(',')];
  for (let i = 1; i <= n; i++) {
    const task = `Fix, "urgent" item ${i}`; // comma and quotes exercise CSV quoting
    const estimate = i % 10 === 0 ? null : Math.round(rand() * 10000) / 100;
    const mm = String(1 + Math.floor(rand() * 12)).padStart(2, '0');
    const dd = String(1 + Math.floor(rand() * 28)).padStart(2, '0');
    const due = `2026-${mm}-${dd}`;
    const done = rand() < 0.5;
    const status = STATUSES[Math.floor(rand() * STATUSES.length)];
    const notes = i % 7 === 0 ? null : `note ${i}`;
    expected.push({ Task: task, Estimate: estimate, Due: due, Done: done, Status: status, Notes: notes });
    xlsxRows.push([task, estimate, due, done, status, notes]);
    const csvCell = (s: string) => (/[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
    csvLines.push([
      csvCell(task),
      estimate === null ? '' : String(estimate),
      due,
      done ? 'yes' : 'no',
      status,
      notes === null ? '' : csvCell(notes),
    ].join(','));
  }
  return { expected, csv: csvLines.join('\n') + '\n', xlsxRows };
}

/** Build XLSX bytes from rows using SheetJS (test-only writer). */
export async function makeXlsx(rows: (string | number | boolean | null)[][]): Promise<ArrayBuffer> {
  const XLSX = await import('xlsx');
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Tasks');
  const out = XLSX.write(wb, { type: 'array', bookType: 'xlsx' }) as ArrayBuffer;
  return out;
}
