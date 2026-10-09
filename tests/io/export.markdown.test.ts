// T-U for P4-05: Markdown escaping cases.
import { describe, it, expect } from 'vitest';
import { escapeMarkdownCell, toMarkdown } from '../../src/io/export/markdown.js';

/** Reader for the escaping rules: split on unescaped |, unescape \\\\, \\|, and <br>. */
function readMarkdownRow(line: string): string[] {
  const inner = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  const cells: string[] = [];
  let cur = '';
  for (let i = 0; i < inner.length; i++) {
    const c = inner[i];
    if (c === '\\' && i + 1 < inner.length) {
      cur += inner[i + 1] === '|' ? '|' : inner[i + 1] === '\\' ? '\\' : c + inner[i + 1];
      i++;
    } else if (c === '|') {
      cells.push(cur.replace(/<br>/g, '\n'));
      cur = '';
    } else cur += c;
  }
  cells.push(cur.replace(/<br>/g, '\n'));
  return cells.map((x) => x.trim());
}

describe('escapeMarkdownCell', () => {
  it.each([
    ['plain', 'plain'],
    ['a|b', 'a\\|b'],
    ['a\\|b', 'a\\\\\\|b'],
    ['a\\b', 'a\\\\b'],
    ['line1\nline2', 'line1<br>line2'],
    ['line1\r\nline2', 'line1<br>line2'],
    ['line1\rline2', 'line1<br>line2'],
    ['||', '\\|\\|'],
    ['', ''],
  ])('escapes %j to %j', (input, want) => {
    expect(escapeMarkdownCell(input)).toBe(want);
  });
});

describe('toMarkdown', () => {
  it('writes header, separator, and escaped rows', () => {
    const md = toMarkdown({
      name: 'T',
      fields: [
        { id: 'a', name: 'A|x', type: 'text' },
        { id: 'b', name: 'B', type: 'text' },
      ],
      rows: [{ id: 'r1', rev: 1, updatedAt: 'x', sync: null, values: { a: 'p|q', b: 'two\nlines' } }],
    });
    expect(md).toBe('| A\\|x | B |\n| --- | --- |\n| p\\|q | two<br>lines |\n');
  });
  it('zero rows gives header and separator only', () => {
    const md = toMarkdown({ name: 'T', fields: [{ id: 'a', name: 'A', type: 'text' }], rows: [] });
    expect(md).toBe('| A |\n| --- |\n');
  });
});

describe('Markdown round trip with a reader that applies the escape rules', () => {
  it('every cell comes back exactly (pipes, backslashes, newlines, backslash-pipe sequences)', () => {
    const values = ['a|b', 'c\\d', 'x\\|y', 'two\nlines', 'plain', '||'];
    const md = toMarkdown({
      name: 'T',
      fields: values.map((_, i) => ({ id: `f${i}`, name: `H${i}`, type: 'text' as const })),
      rows: [{ id: 'r', rev: 1, updatedAt: '', sync: null, values: Object.fromEntries(values.map((v, i) => [`f${i}`, v])) }],
    });
    const lines = md.trimEnd().split('\n');
    expect(readMarkdownRow(lines[2])).toEqual(values.map((v) => v.replace(/\n/g, '\n')));
  });
});

