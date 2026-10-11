/**
 * One "Search or query" box (SAD-78, owner decision S-3).
 *
 * The prototype has a single toolbar input: words without a colon are a global search, and
 * `field:value` tokens are query terms, ANDed together (`Prototype/script.js › parseQuery`,
 * `pipelineRows`). The plugin already persists the two halves separately — `view.search`
 * (contains-match over every cell) and `view.query` (the strict grammar in
 * docs/query-grammar.md). This module is the bridge: it splits the box's text into exactly
 * those two values and joins them back, so the session, the file format and filtering are
 * unchanged — only the toolbar binding is new.
 *
 * Tokenizing follows the prototype: a token is a field name (bare, or `"quoted"` with `""`
 * escapes) and, if a `:` follows, a term that runs to the next whitespace (quoted values and
 * `a, b` value lists included). Each term's exact source slice goes to the strict parser,
 * which stays the single authority on validity; `map` translates its error positions back
 * onto the box text. Pure: no Obsidian or DOM imports.
 */

export interface SplitSearchQuery {
  /** Free words, joined by single spaces (quotes around a phrase removed). */
  search: string;
  /** The term slices, as typed, joined by single spaces. Fed to the strict parser. */
  query: string;
  /** For each index of `query`, the index in the original input (length query.length + 1). */
  map: number[];
}

const isWS = (c: string | undefined): boolean => c === ' ' || c === '\t' || c === '\n' || c === '\r';
const isBlank = (c: string | undefined): boolean => c === ' ' || c === '\t';

/** Split the box text into the persisted search and query halves. */
export function splitSearchQuery(input: string): SplitSearchQuery {
  const text = input ?? '';
  const n = text.length;
  const words: string[] = [];
  const slices: Array<{ start: number; end: number }> = [];
  let i = 0;

  /** Read a `"…"` run starting at text[i] === '"'. Returns its content and whether it closed. */
  const readQuoted = (): { value: string; closed: boolean } => {
    i++;
    let out = '';
    while (i < n) {
      if (text[i] === '"') {
        if (text[i + 1] === '"') {
          out += '"';
          i += 2;
          continue;
        }
        i++;
        return { value: out, closed: true };
      }
      out += text[i++];
    }
    return { value: out, closed: false };
  };

  while (i < n) {
    while (i < n && isWS(text[i])) i++;
    if (i >= n) break;
    const start = i;

    let name: string;
    if (text[i] === '"') {
      const q = readQuoted();
      // An unclosed quote is someone mid-typing a phrase: search for it, no error (prototype).
      if (!q.closed) {
        if (q.value.trim()) words.push(q.value.trim());
        break;
      }
      name = q.value;
    } else {
      let raw = '';
      while (i < n && !isWS(text[i]) && text[i] !== ':') raw += text[i++];
      name = raw;
    }

    let j = i;
    while (j < n && isBlank(text[j])) j++;
    if (text[j] !== ':') {
      if (name) words.push(name);
      continue;
    }

    // A term: `name : [op] value[,value…]` up to the next whitespace (after the value starts).
    i = j + 1;
    while (i < n && isBlank(text[i])) i++;
    if (i < n && '~!><'.includes(text[i])) i++;
    while (i < n && !isWS(text[i])) {
      if (text[i] === '"') {
        readQuoted();
        continue;
      }
      if (text[i] === ',') {
        i++;
        while (i < n && isBlank(text[i])) i++;
        continue;
      }
      i++;
    }
    slices.push({ start, end: i });
  }

  let query = '';
  const map: number[] = [];
  for (const s of slices) {
    if (query) {
      map.push(s.start - 1 >= 0 ? s.start - 1 : s.start); // the joining space
      query += ' ';
    }
    for (let k = s.start; k < s.end; k++) map.push(k);
    query += text.slice(s.start, s.end);
  }
  map.push(slices.length ? slices[slices.length - 1].end : n);

  return { search: words.join(' '), query, map };
}

/** The box text for persisted search and query values (search first, as typed in the prototype). */
export function joinSearchQuery(search: string | null | undefined, query: string | null | undefined): string {
  return [(search ?? '').trim(), (query ?? '').trim()].filter(Boolean).join(' ');
}

/** Map a 0-based position inside `split.query` back to the box text. */
export function toInputPosition(split: SplitSearchQuery, queryPosition: number): number {
  const p = Math.max(0, Math.min(queryPosition, split.map.length - 1));
  return split.map[p] ?? 0;
}
