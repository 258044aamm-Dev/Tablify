// Candidate A: read-excel-file (browser build) for reading + write-excel-file (browser build) for writing.
// Findings (see docs/decisions/xlsx.md):
//  - read-excel-file v8 returns ALL sheets as [{ sheet, data }]; the `sheet` option did not filter in the browser build.
//  - There is no public sheet-name listing API; names come from the returned array.
//  - write-excel-file v1 silently writes an EMPTY sheet when cells are plain values; each cell must be { value }.
import readXlsxFile from 'read-excel-file/browser';
import writeXlsxFile from 'write-excel-file';

export async function readSheets(blob) {
  const all = await readXlsxFile(blob, { trim: false });
  const sheets = {};
  for (const s of all) sheets[s.sheet] = s.data;
  return { sheetNames: all.map((s) => s.sheet), sheets };
}

export async function writeRows(rows) {
  const data = rows.map((r) => r.map((v) => ({ value: v === undefined ? null : v })));
  return await writeXlsxFile(data, { sheet: 'Data' });
}
