/**
 * Recursive-descent parser for the P8 formula language (docs/formula-spec.md §4-5).
 * Precedence, lowest first: comparison, &, + -, * /, unary -, ^ (left-assoc).
 * Unary minus binds looser than ^, so -2^2 = -4.
 */
import { FormulaFault, err, fault, type ErrorCode, type Value } from './value';
import { tokenize, type Token } from './lexer';

export type Node =
  | { readonly k: 'lit'; readonly v: Value }
  | { readonly k: 'ref'; readonly name: string }
  | { readonly k: 'name'; readonly name: string }
  | { readonly k: 'neg'; readonly e: Node }
  | { readonly k: 'bin'; readonly op: string; readonly l: Node; readonly r: Node }
  | { readonly k: 'call'; readonly name: string; readonly args: readonly Node[] };

export type Compiled =
  | { readonly ok: true; readonly root: Node; readonly refs: readonly string[] }
  | { readonly ok: false; readonly code: ErrorCode };

export const MAX_FORMULA_LENGTH = 2000;
export const MAX_NESTING = 50;
export const MAX_ARGS = 30;

const CMP_OPS = new Set(['=', '!=', '<', '<=', '>', '>=']);

class Parser {
  private pos = 0;
  private depth = 0;
  constructor(private readonly toks: Token[]) {}

  private peek(): Token {
    return this.toks[this.pos]!;
  }
  private next(): Token {
    return this.toks[this.pos++]!;
  }
  private isOp(v: string): boolean {
    const t = this.peek();
    return t.k === 'op' && t.v === v;
  }
  private enter(): void {
    this.depth++;
    if (this.depth > MAX_NESTING) fault('#PARSE!');
  }
  private leave(): void {
    this.depth--;
  }

  parseAll(): Node {
    const e = this.parseComparison();
    if (this.peek().k !== 'eof') fault('#PARSE!');
    return e;
  }

  private parseComparison(): Node {
    const l = this.parseConcat();
    const t = this.peek();
    if (t.k === 'op' && CMP_OPS.has(t.v)) {
      this.next();
      const r = this.parseConcat();
      const after = this.peek();
      if (after.k === 'op' && CMP_OPS.has(after.v)) fault('#PARSE!'); // no chained comparison
      return { k: 'bin', op: t.v, l, r };
    }
    return l;
  }

  private parseConcat(): Node {
    let l = this.parseAdditive();
    while (this.isOp('&')) {
      this.next();
      l = { k: 'bin', op: '&', l, r: this.parseAdditive() };
    }
    return l;
  }

  private parseAdditive(): Node {
    let l = this.parseMultiplicative();
    while (this.isOp('+') || this.isOp('-')) {
      const op = (this.next() as { v: string }).v;
      l = { k: 'bin', op, l, r: this.parseMultiplicative() };
    }
    return l;
  }

  private parseMultiplicative(): Node {
    let l = this.parseUnary();
    while (this.isOp('*') || this.isOp('/')) {
      const op = (this.next() as { v: string }).v;
      l = { k: 'bin', op, l, r: this.parseUnary() };
    }
    return l;
  }

  private parseUnary(): Node {
    if (this.isOp('-')) {
      this.next();
      this.enter();
      const e = this.parseUnary();
      this.leave();
      return { k: 'neg', e };
    }
    return this.parsePower();
  }

  private parsePower(): Node {
    let l = this.parsePrimary();
    while (this.isOp('^')) {
      this.next();
      l = { k: 'bin', op: '^', l, r: this.parsePowerOperand() };
    }
    return l;
  }

  private parsePowerOperand(): Node {
    if (this.isOp('-')) {
      this.next();
      this.enter();
      const e = this.parsePowerOperand();
      this.leave();
      return { k: 'neg', e };
    }
    return this.parsePrimary();
  }

  private parsePrimary(): Node {
    const t = this.next();
    switch (t.k) {
      case 'num':
        return Number.isFinite(t.v)
          ? { k: 'lit', v: { t: 'num', v: t.v } }
          : { k: 'lit', v: err('#OVERFLOW!') };
      case 'str':
        return { k: 'lit', v: { t: 'text', v: t.v } };
      case 'ref':
        return { k: 'ref', name: t.v };
      case 'ident': {
        if (this.peek().k === '(') return this.parseCall(t.v);
        const up = t.v.toUpperCase();
        if (up === 'TRUE') return { k: 'lit', v: { t: 'bool', v: true } };
        if (up === 'FALSE') return { k: 'lit', v: { t: 'bool', v: false } };
        return { k: 'name', name: t.v };
      }
      case '(': {
        this.enter();
        const e = this.parseComparison();
        if (this.next().k !== ')') fault('#PARSE!');
        this.leave();
        return e;
      }
      default:
        fault('#PARSE!');
    }
  }

  private parseCall(rawName: string): Node {
    this.next(); // '('
    this.enter();
    const args: Node[] = [];
    if (this.peek().k === ')') {
      this.next();
    } else {
      for (;;) {
        args.push(this.parseComparison());
        if (args.length > MAX_ARGS) fault('#PARSE!');
        const t = this.next();
        if (t.k === ')') break;
        if (t.k !== ',') fault('#PARSE!');
      }
    }
    this.leave();
    return { k: 'call', name: rawName.toUpperCase(), args };
  }
}

export function collectRefs(node: Node, out: string[] = []): string[] {
  switch (node.k) {
    case 'ref':
      out.push(node.name);
      break;
    case 'neg':
      collectRefs(node.e, out);
      break;
    case 'bin':
      collectRefs(node.l, out);
      collectRefs(node.r, out);
      break;
    case 'call':
      for (const a of node.args) collectRefs(a, out);
      break;
    default:
      break;
  }
  return out;
}

/** Parse a formula. Never throws; a bad formula yields `{ ok: false, code: '#PARSE!' }`. */
export function compileFormula(src: string): Compiled {
  if (src.length > MAX_FORMULA_LENGTH) return { ok: false, code: '#PARSE!' };
  try {
    const root = new Parser(tokenize(src)).parseAll();
    return { ok: true, root, refs: Array.from(new Set(collectRefs(root))) };
  } catch (e) {
    if (e instanceof FormulaFault) return { ok: false, code: '#PARSE!' };
    throw e;
  }
}
