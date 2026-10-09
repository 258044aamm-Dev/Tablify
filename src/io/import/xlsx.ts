// XLSX reading for import. Uses read-excel-file (browser build, candidate A from P4-02).
// trim:false keeps cell text exact. Dates come back as Date objects (see docs/decisions/xlsx.md F2).
import readXlsxFile from 'read-excel-file/browser';
import type { InputCell } from '../infer.js';

export interface XlsxSheet {
  name: string;
  rows: InputCell[][];
}

/** Read every sheet. read-excel-file v8 returns all sheets; the caller picks one. */
export async function readXlsxSheets(data: ArrayBuffer): Promise<XlsxSheet[]> {
  const all = await readXlsxFile(new Blob([data]), { trim: false });
  return all.map((s) => ({
    name: s.sheet,
    rows: s.data.map((row) => row.map((cell) => (cell === undefined ? null : (cell as InputCell)))),
  }));
}
