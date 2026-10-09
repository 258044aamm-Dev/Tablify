// CSV writer (P4-05): RFC 4180 quoting, CRLF line ends, UTF-8 BOM. Readable by the P4-01 parser.
import type { ExportTable } from './view.js';
import { cellText } from './view.js';

const BOM = '\uFEFF';

/** RFC 4180: quote a field when it contains comma, double quote, CR, or LF. Double the quotes. */
export function csvField(text: string): string {
  if (/[",\r\n]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

export function toCsv(table: ExportTable): string {
  const lines: string[] = [];
  lines.push(table.fields.map((f) => csvField(f.name)).join(','));
  for (const row of table.rows) {
    lines.push(table.fields.map((f) => csvField(cellText(row.values[f.id] ?? null, f))).join(','));
  }
  return BOM + lines.join('\r\n') + '\r\n';
}
