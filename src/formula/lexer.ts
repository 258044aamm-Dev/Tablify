/**
 * Lexer for the P8 formula language (docs/formula-spec.md §2-3).
 * Any lexical problem is a #PARSE! (thrown as FormulaFault, converted by compileFormula).
 */
import { fault } from './value';

export type Token =
  | { readonly k: 'num'; readonly v: number }
  | { readonly k: 'str'; readonly v: string }
  | { readonly k: 'ident'; readonly v: string }
  | { readonly k: 'ref'; readonly v: string }
  | { readonly k: 'op'; readonly v: string }
  | { readonly k: '('}
  | { readonly k: ')'}
  | { readonly k: ','}
  | { readonly k: 'eof' };

const NUM_RE = /\d+(\.\d+)?/y;
const IDENT_RE = /[A-Za-z_][A-Za-z0-9_]*/y;

export function tokenize(src: string): Token[] {
  const out: Token[] = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const c = src.charAt(i);
    if (c === ' ' || c === '\t' || c === '\n' || c === '\r') {
      i++;
      continue;
    }
    if (c >= '0' && c <= '9') {
      NUM_RE.lastIndex = i;
      const m = NUM_RE.exec(src);
      if (!m) fault('#PARSE!');
      out.push({ k: 'num', v: Number(m[0]) });
      i += m[0].length;
      continue;
    }
    if (c === '"') {
      let j = i + 1;
      let text = '';
      let closed = false;
      while (j < n) {
        const ch = src.charAt(j);
        if (ch === '\n' || ch === '\r') fault('#PARSE!');
        if (ch === '\\') {
          const nx = src.charAt(j + 1);
          if (nx !== '"' && nx !== '\\') fault('#PARSE!');
          text += nx;
          j += 2;
          continue;
        }
        if (ch === '"') {
          closed = true;
          j++;
          break;
        }
        text += ch;
        j++;
      }
      if (!closed) fault('#PARSE!');
      out.push({ k: 'str', v: text });
      i = j;
      continue;
    }
    if (c === '{') {
      let j = i + 1;
      let name = '';
      let closed = false;
      while (j < n) {
        const ch = src.charAt(j);
        if (ch === '\n' || ch === '\r') fault('#PARSE!');
        if (ch === '\\') {
          const nx = src.charAt(j + 1);
          if (nx !== '}' && nx !== '\\') fault('#PARSE!');
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
      if (!closed || name.length === 0) fault('#PARSE!');
      out.push({ k: 'ref', v: name });
      i = j;
      continue;
    }
    if (/[A-Za-z_]/.test(c)) {
      IDENT_RE.lastIndex = i;
      const m = IDENT_RE.exec(src);
      if (!m) fault('#PARSE!');
      out.push({ k: 'ident', v: m[0] });
      i += m[0].length;
      continue;
    }
    const two = src.slice(i, i + 2);
    if (two === '!=' || two === '<=' || two === '>=') {
      out.push({ k: 'op', v: two });
      i += 2;
      continue;
    }
    if ('+-*/^&=<>'.includes(c)) {
      out.push({ k: 'op', v: c });
      i++;
      continue;
    }
    if (c === '(') {
      out.push({ k: '(' });
      i++;
      continue;
    }
    if (c === ')') {
      out.push({ k: ')' });
      i++;
      continue;
    }
    if (c === ',') {
      out.push({ k: ',' });
      i++;
      continue;
    }
    fault('#PARSE!');
  }
  out.push({ k: 'eof' });
  return out;
}
