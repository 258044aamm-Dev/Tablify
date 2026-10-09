// Markdown table writer (P4-05). Escapes | and newlines in cells (T-U cases in tests).
import type { ExportTable } from './view.js';
import { cellText } from './view.js';

/**
 * Make one cell safe for a GFM table row:
 *  - backslash becomes \\ (so a literal "\|" in data is not read as an escaped pipe)
 *  - | becomes \|
 *  - CR, LF, or CRLF become <br>
 */
export function escapeMarkdownCell(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/\|/g, '\\|').replace(/\r\n|\r|\n/g, '<br>');
}

export function toMarkdown(table: ExportTable): string {
  const header = `| ${table.fields.map((f) => escapeMarkdownCell(f.name)).join(' | ')} |`;
  const sep = `| ${table.fields.map(() => '---').join(' | ')} |`;
  const body = table.rows.map(
    (row) => `| ${table.fields.map((f) => escapeMarkdownCell(cellText(row.values[f.id] ?? null, f))).join(' | ')} |`,
  );
  return [header, sep, ...body].join('\n') + '\n';
}
