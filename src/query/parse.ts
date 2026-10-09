// Pure query parser for Tablify — no Obsidian imports.
// Implements grammar in docs/query-grammar.md.
// spec: FEATURES.md §2.6, guidelines.md P2-01.

export type QueryOp = 'eq' | 'contains' | 'not' | 'gt' | 'lt' | 'empty';

export interface QueryError {
  message: string;
  position: number; // 0-based offset
  line: number; // 1-based
  column: number; // 1-based
}

export interface QueryTerm {
  fieldName: string; // normalized lowercased trimmed
  rawFieldName: string; // as typed (unquoted inner content)
  op: QueryOp;
  values: string[]; // raw value strings (unquoted inner); [] for empty op
  raw: string; // slice of input for this term
  position: number; // offset of term start (field name)
}

export interface QueryAST {
  terms: QueryTerm[];
  rawInput: string;
}

export type QueryParseResult = { ok: true; ast: QueryAST } | { ok: false; error: QueryError };

function isWS(c: string): boolean {
  return c === ' ' || c === '\t' || c === '\n' || c === '\r';
}

function offsetToLineCol(text: string, offset: number): { line: number; column: number } {
  let line = 1;
  let column = 1;
  const lim = Math.min(offset, text.length);
  for (let i = 0; i < lim; i++) {
    if (text[i] === '\n') {
      line++;
      column = 1;
    } else {
      column++;
    }
  }
  return { line, column };
}

function makeError(text: string, message: string, position: number): QueryError {
  const { line, column } = offsetToLineCol(text, position);
  return { message, position, line, column };
}

function needsFieldQuote(name: string): boolean {
  if (name.length === 0) return true;
  if (/^\s|\s$/.test(name)) return true;
  if (/[:,"]/.test(name)) return true;
  if (/\s/.test(name)) return true;
  if (/[~!><]/.test(name)) return true;
  if (/^\d/.test(name)) return true;
  return false;
}

function needsValueQuote(value: string): boolean {
  if (value.length === 0) return true;
  if (/[,\s":]/.test(value)) return true;
  return false;
}

function escapeQuoted(s: string): string {
  return s.replace(/"/g, '""');
}

// --- Printer ---------------------------------------------------------------

export function printQuery(ast: QueryAST): string {
  const parts: string[] = [];
  for (const term of ast.terms) {
    const field = needsFieldQuote(term.rawFieldName)
      ? `"${escapeQuoted(term.rawFieldName)}"`
      : term.rawFieldName;
    if (term.op === 'empty') {
      parts.push(`${field}:empty`);
      continue;
    }
    if (term.op === 'eq' && term.values.length === 1 && term.values[0] === '') {
      parts.push(`${field}:`);
      continue;
    }
    let prefix = '';
    if (term.op === 'contains') prefix = '~';
    else if (term.op === 'not') prefix = '!';
    else if (term.op === 'gt') prefix = '>';
    else if (term.op === 'lt') prefix = '<';

    if (term.op === 'eq') {
      const vals = term.values.map((v) => (needsValueQuote(v) ? `"${escapeQuoted(v)}"` : v));
      parts.push(`${field}:${vals.join(',')}`);
    } else {
      const v = term.values[0] ?? '';
      const vs = needsValueQuote(v) ? `"${escapeQuoted(v)}"` : v;
      parts.push(`${field}:${prefix}${vs}`);
    }
  }
  return parts.join(' ');
}

// --- Parser ---------------------------------------------------------------

export function parseQuery(input: string): QueryParseResult {
  const len = input.length;
  let i = 0;
  const terms: QueryTerm[] = [];

  function skipWS(): void {
    while (i < len && isWS(input[i])) i++;
  }

  function peekIsNextField(start: number): boolean {
    const j = start;
    if (j >= len) return false;
    if (input[j] === '"') {
      // quoted field
      let k = j + 1;
      let closed = false;
      while (k < len) {
        if (input[k] === '"') {
          if (k + 1 < len && input[k + 1] === '"') k += 2;
          else {
            k++;
            closed = true;
            break;
          }
        } else k++;
      }
      if (!closed) return false;
      while (k < len && isWS(input[k])) k++;
      return k < len && input[k] === ':';
    } else {
      // unquoted field
      let k = j;
      let hasContent = false;
      while (k < len && input[k] !== ':' && !isWS(input[k]) && input[k] !== ',' && input[k] !== '"') {
        // operators not allowed in field name; if we see them before colon, it's not a field
        if (input[k] === '~' || input[k] === '!' || input[k] === '>' || input[k] === '<') return false;
        hasContent = true;
        k++;
      }
      if (!hasContent) return false;
      while (k < len && isWS(input[k])) k++;
      return k < len && input[k] === ':';
    }
  }

  function parseSingleValueImmediate(): { value: string } | { error: QueryError } {
    if (i >= len) {
      return { error: makeError(input, 'Unexpected end of input in value', i) };
    }
    if (input[i] === '"') {
      const qStart = i;
      i++;
      let inner = '';
      let closed = false;
      while (i < len) {
        if (input[i] === '"') {
          if (i + 1 < len && input[i + 1] === '"') {
            inner += '"';
            i += 2;
          } else {
            i++;
            closed = true;
            break;
          }
        } else {
          inner += input[i];
          i++;
        }
      }
      if (!closed) {
        return { error: makeError(input, 'Unclosed quote in value', qStart) };
      }
      return { value: inner };
    } else {
      let v = '';
      const start = i;
      while (i < len && !isWS(input[i]) && input[i] !== ',' && input[i] !== '"') {
        if (input[i] === ':') {
          return {
            error: makeError(input, `Unexpected ':' in value — quote the value if it contains ':'`, i),
          };
        }
        v += input[i];
        i++;
      }
      if (v.length === 0) {
        return { error: makeError(input, 'Empty value in list', start) };
      }
      return { value: v };
    }
  }

  function parseValueList(): { values: string[] } | { error: QueryError } {
    const vals: string[] = [];
    if (i >= len) {
      return { values: [''] };
    }
    if (isWS(input[i])) {
      return { values: [''] };
    }
    const first = parseSingleValueImmediate();
    if ('error' in first) return first;
    vals.push(first.value);
    while (true) {
      let j = i;
      while (j < len && isWS(input[j])) j++;
      if (j < len && input[j] === ',') {
        const commaPos = j;
        j++;
        while (j < len && isWS(input[j])) j++;
        if (j >= len) {
          return { error: makeError(input, 'Trailing comma in value list', commaPos) };
        }
        if (input[j] === ',') {
          return { error: makeError(input, `Unexpected ',' in value list`, j) };
        }
        if (isWS(input[j])) {
          return { error: makeError(input, 'Trailing comma in value list', commaPos) };
        }
        i = j;
        const nxt = parseSingleValueImmediate();
        if ('error' in nxt) return nxt;
        vals.push(nxt.value);
      } else {
        break;
      }
    }
    return { values: vals };
  }

  skipWS();
  if (i >= len) {
    return { ok: true, ast: { terms: [], rawInput: input } };
  }

  while (i < len) {
    skipWS();
    if (i >= len) break;
    const termStart = i;

    // ---- FieldRef ----
    let rawFieldName!: string;
    let fieldName!: string;

    if (input[i] === '"') {
      const quoteStart = i;
      i++;
      let inner = '';
      let closed = false;
      while (i < len) {
        if (input[i] === '"') {
          if (i + 1 < len && input[i + 1] === '"') {
            inner += '"';
            i += 2;
          } else {
            i++;
            closed = true;
            break;
          }
        } else {
          inner += input[i];
          i++;
        }
      }
      if (!closed) {
        return { ok: false, error: makeError(input, 'Unclosed quote in field name', quoteStart) };
      }
      rawFieldName = inner;
      fieldName = inner.trim().toLowerCase();
      if (fieldName.length === 0) {
        return { ok: false, error: makeError(input, 'Empty field name', quoteStart) };
      }
      while (i < len && isWS(input[i])) i++;
      if (i >= len || input[i] !== ':') {
        const at = i < len ? i : len;
        const preview = rawFieldName.length > 20 ? rawFieldName.slice(0, 20) + '…' : rawFieldName;
        return { ok: false, error: makeError(input, `Expected ':' after field name "${preview}"`, at) };
      }
    } else {
      const fieldStart = i;
      let raw = '';
      while (i < len && input[i] !== ':' && !isWS(input[i])) {
        const ch = input[i];
        if (ch === '"' || ch === ',') {
          return { ok: false, error: makeError(input, `Invalid character '${ch}' in field name`, i) };
        }
        if (ch === '~' || ch === '!' || ch === '>' || ch === '<') {
          return { ok: false, error: makeError(input, `Invalid character '${ch}' in field name`, i) };
        }
        raw += ch;
        i++;
      }
      if (raw.length === 0) {
        if (i < len && input[i] === ':') {
          return { ok: false, error: makeError(input, 'Empty field name', fieldStart) };
        }
        return { ok: false, error: makeError(input, 'Empty field name', fieldStart) };
      }
      while (i < len && isWS(input[i])) i++;
      if (i >= len || input[i] !== ':') {
        return {
          ok: false,
          error: makeError(input, `Expected ':' after field name "${raw}"`, i < len ? i : len),
        };
      }
      rawFieldName = raw;
      fieldName = raw.trim().toLowerCase();
    }

    // consume ':'
    i++;
    let hadWS = false;
    while (i < len && isWS(input[i])) {
      hadWS = true;
      i++;
    }

    let op!: QueryOp;
    let values!: string[];

    if (i >= len) {
      op = 'eq';
      values = [''];
    } else {
      // check for empty keyword (unquoted, case-insensitive, followed by WS/EOF, not comma)
      const slice5 = input.slice(i, i + 5);
      const lower5 = slice5.toLowerCase();
      const afterEmpty = i + 5;
      const nextIsCommaAfterEmpty = afterEmpty < len && input[afterEmpty] === ',';

      // Only treat as keyword if not quoted and not followed by comma (so "empty,foo" is ValueList)
      if (input[i] !== '"' && lower5 === 'empty' && (afterEmpty === len || isWS(input[afterEmpty]))) {
        // Ensure the word "empty" is a full token: if more letters follow (e.g., "emptyX"), not keyword
        // Our check already ensures next is WS/EOF, so "emptyX" would be longer word not keyword; it would fall through to ValueList
        // Need to also ensure the 5 chars are exactly "empty" isolated
        // If next char is letter/digit, it's part of longer word -> not keyword
        // Since we check WS/EOF after, "emptyExtra" not 5 chars "empty" plus next not WS/EOF but letter, so not keyword
        op = 'empty';
        values = [];
        i += 5;
      } else if (
        input[i] !== '"' &&
        lower5 === 'empty' &&
        nextIsCommaAfterEmpty
      ) {
        // Treat "empty,foo" as ValueList with first value "empty" — not keyword
        const parsed = parseValueList();
        if ('error' in parsed) return { ok: false, error: parsed.error };
        op = 'eq';
        values = parsed.values;
      } else if (input[i] === '~' || input[i] === '!' || input[i] === '>' || input[i] === '<') {
        const opChar = input[i];
        if (opChar === '~') op = 'contains';
        else if (opChar === '!') op = 'not';
        else if (opChar === '>') op = 'gt';
        else op = 'lt';
        i++;
        while (i < len && isWS(input[i])) i++;
        if (i >= len) {
          return { ok: false, error: makeError(input, `Expected value after '${opChar}'`, i) };
        }
        if (input[i] === ',') {
          return { ok: false, error: makeError(input, `Unexpected ',' after '${opChar}'`, i) };
        }
        if (input[i] === '"') {
          const qStart = i;
          i++;
          let inner = '';
          let closed = false;
          while (i < len) {
            if (input[i] === '"') {
              if (i + 1 < len && input[i + 1] === '"') {
                inner += '"';
                i += 2;
              } else {
                i++;
                closed = true;
                break;
              }
            } else {
              inner += input[i];
              i++;
            }
          }
          if (!closed) {
            return { ok: false, error: makeError(input, 'Unclosed quote in value', qStart) };
          }
          values = [inner];
        } else {
          let v = '';
          while (i < len && !isWS(input[i]) && input[i] !== ',' && input[i] !== '"') {
            if (input[i] === ':') {
              return {
                error: makeError(input, `Unexpected ':' in value — quote the value if it contains ':'`, i),
              } as unknown as { error: QueryError };
            }
            v += input[i];
            i++;
          }
          if (v.length === 0) {
            return { ok: false, error: makeError(input, `Expected value after '${opChar}'`, i) };
          }
          values = [v];
        }
        if (i < len && input[i] === ',') {
          return {
            ok: false,
            error: makeError(input, `Comma not allowed after '${opChar}' operator`, i),
          };
        }
      } else {
        // ValueList or empty value with next field
        // Detect empty value where next token looks like a new field (peek)
        // Only treat as empty if there was WS after colon (so "field: next:val" not "field:next:val" without WS)
        const lookahead = hadWS && peekIsNextField(i);
        if (lookahead) {
          op = 'eq';
          values = [''];
          // do not advance i; let next loop handle next field
        } else {
          // Single-char check for isEmptyWord with comma handled above; now ValueList
          // But also handle case where i points at ',' -> trailing comma error
          if (i < len && input[i] === ',') {
            return { ok: false, error: makeError(input, "Unexpected ',' in value list", i) };
          }
          const parsed = parseValueList();
          if ('error' in parsed) return { ok: false, error: parsed.error };
          op = 'eq';
          values = parsed.values;
        }
      }
    }

    const termEnd = i;
    const rawSlice = input.slice(termStart, termEnd);

    terms.push({
      fieldName,
      rawFieldName,
      op,
      values,
      raw: rawSlice.trim(),
      position: termStart,
    });

    if (i === termStart) {
      return { ok: false, error: makeError(input, 'Failed to parse term', termStart) };
    }
  }

  return { ok: true, ast: { terms, rawInput: input } };
}
