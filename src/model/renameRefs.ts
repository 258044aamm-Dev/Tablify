/**
 * COD-67: rewrite field references when a field is renamed.
 *
 * Formulas (`{Price}`) and saved queries (`Price:>10`) name their fields instead of pointing at
 * ids, so a rename has to carry them along or every reference silently turns into #NAME? / a
 * term that matches nothing. Both helpers are text-preserving: they touch only the reference
 * token, never the surrounding expression, so spacing, quoting and operator style survive.
 */
import { needsFieldQuote, parseQuery } from '../query/parse.js';

/** Escape a field name for use inside a formula's `{...}` reference. Mirrors formula/lexer. */
export function escapeRefName(name: string): string {
  return name.replace(/\\/g, '\\\\').replace(/}/g, '\\}');
}

/**
 * Rename every `{from}` reference in a formula source to `{to}`.
 *
 * A hand-written scanner rather than a regex: `}` and `\` may be escaped inside a reference, and
 * text inside a string literal (`"{Price}"`) is data, not a reference, so it must be left alone.
 * Invalid formulas are rewritten too — the references in them are still references, and the user
 * should not have to fix a name twice.
 */
export function renameInFormula(src: string, from: string, to: string): string {
  if (from === to) return src;
  const replacement = `{${escapeRefName(to)}}`;
  let out = '';
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src.charAt(i);
    if (c === '"') {
      // String literal: copy verbatim, honouring \" and \\ escapes.
      out += c;
      i++;
      while (i < n) {
        const ch = src.charAt(i);
        out += ch;
        i++;
        if (ch === '\\') {
          if (i < n) {
            out += src.charAt(i);
            i++;
          }
          continue;
        }
        if (ch === '"') break;
      }
      continue;
    }
    if (c === '{') {
      let j = i + 1;
      let name = '';
      let closed = false;
      while (j < n) {
        const ch = src.charAt(j);
        if (ch === '\n' || ch === '\r') break;
        if (ch === '\\') {
          const nx = src.charAt(j + 1);
          if (nx !== '}' && nx !== '\\') break;
          name += nx;
          j += 2;
          continue;
        }
        if (ch === '}') {
          closed = true;
          j++;
          break;
        }
        name += ch;
        j++;
      }
      if (closed && name.length > 0) {
        out += name === from ? replacement : src.slice(i, j);
        i = j;
        continue;
      }
      // Not a well-formed reference: emit literally so the original text survives.
      out += c;
      i++;
      continue;
    }
    out += c;
    i++;
  }
  return out;
}

/**
 * Rename every field-name reference in a saved query.
 *
 * Terms are matched the way the query engine matches them (trimmed, case-insensitive), and only
 * the field-name span is replaced — the rest of the query string is copied byte for byte. A query
 * that no longer parses is returned unchanged: there are no trustworthy term positions in it.
 */
export function renameInQuery(query: string, from: string, to: string): string {
  const parsed = parseQuery(query);
  if (!parsed.ok) return query;
  const target = from.trim().toLowerCase();
  let out = query;
  // Right to left so earlier offsets stay valid.
  for (let k = parsed.ast.terms.length - 1; k >= 0; k--) {
    const term = parsed.ast.terms[k];
    if (term.fieldName !== target) continue;
    const start = term.position;
    const quoted = out.charAt(start) === '"';
    const length = quoted ? quotedSpanLength(out, start) : term.rawFieldName.length;
    // Quote when the original was quoted or the new name needs it ("Unit Price"): an unquoted
    // name with a space would split the term and stop the query parsing.
    const replacement =
      quoted || needsFieldQuote(to) ? `"${to.replace(/"/g, '""')}"` : to;
    out = out.slice(0, start) + replacement + out.slice(start + length);
  }
  return out;
}

/** Length of a quoted token starting at `start`, including both quotes and `""` escapes. */
function quotedSpanLength(src: string, start: number): number {
  let i = start + 1;
  while (i < src.length) {
    if (src.charAt(i) === '"') {
      if (src.charAt(i + 1) === '"') {
        i += 2;
        continue;
      }
      return i - start + 1;
    }
    i++;
  }
  return src.length - start;
}
