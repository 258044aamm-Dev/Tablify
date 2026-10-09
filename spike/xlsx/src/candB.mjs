// Candidate B: SheetJS (xlsx 0.18.5) for both reading and writing.
import * as XLSX from 'xlsx';

export function readAll(ab) {
  const wb = XLSX.read(ab, { type: 'array', cellDates: true });
  const sheets = {};
  for (const name of wb.SheetNames) {
    sheets[name] = XLSX.utils.sheet_to_json(wb.Sheets[name], { header: 1, raw: true, defval: null, blankrows: true });
  }
  return { sheetNames: wb.SheetNames, sheets };
}

export function writeRows(rows) {
  const ws = XLSX.utils.aoa_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Data');
  return XLSX.write(wb, { type: 'array', bookType: 'xlsx' });
}
