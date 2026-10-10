/**
 * Evaluator for compiled formula trees (docs/formula-spec.md §5-7, §10).
 * Errors are returned as values. Only IF, AND, OR, and SWITCH evaluate arguments lazily.
 */
import type { Node } from './parser';
import { FUNCTIONS, asBool, asNumber, asText, type FnContext } from './functions';
import {
  BLANK,
  equalValues,
  err,
  faultValue,
  numValue,
  orderValues,
  textValue,
  fault,
  type Value,
} from './value';

export interface EvalContext extends FnContext {
  /** Value of a field by name; undefined when the name is unknown or ambiguous (#NAME?). */
  field(name: string): Value | undefined;
}

const TRUE: Value = { t: 'bool', v: true };
const FALSE: Value = { t: 'bool', v: false };

export function evaluate(node: Node, ctx: EvalContext): Value {
  switch (node.k) {
    case 'lit':
      return node.v;
    case 'ref':
      return ctx.field(node.name) ?? err('#NAME?');
    case 'name':
      return err('#NAME?');
    case 'neg': {
      const v = evaluate(node.e, ctx);
      if (v.t === 'err') return v;
      try {
        return numValue(-asNumber(v));
      } catch (e) {
        return faultValue(e);
      }
    }
    case 'bin': {
      const l = evaluate(node.l, ctx);
      const r = evaluate(node.r, ctx);
      if (l.t === 'err') return l;
      if (r.t === 'err') return r;
      try {
        return binary(node.op, l, r);
      } catch (e) {
        return faultValue(e);
      }
    }
    case 'call':
      return call(node.name, node.args, ctx);
  }
}

function binary(op: string, l: Value, r: Value): Value {
  switch (op) {
    case '&':
      return textValue(asText(l) + asText(r));
    case '+':
      return numValue(asNumber(l) + asNumber(r));
    case '-':
      return numValue(asNumber(l) - asNumber(r));
    case '*':
      return numValue(asNumber(l) * asNumber(r));
    case '/': {
      const x = asNumber(l);
      const y = asNumber(r);
      if (y === 0) return err('#DIV/0!');
      return numValue(x / y);
    }
    case '^': {
      const x = asNumber(l);
      const y = asNumber(r);
      if (x === 0 && y < 0) return err('#DIV/0!');
      const p = x ** y;
      if (Number.isNaN(p)) return err('#NUM!');
      return numValue(p);
    }
    case '=':
      return equalValues(l, r) ? TRUE : FALSE;
    case '!=':
      return equalValues(l, r) ? FALSE : TRUE;
    case '<':
      return orderValues(l, r) < 0 ? TRUE : FALSE;
    case '<=':
      return orderValues(l, r) <= 0 ? TRUE : FALSE;
    case '>':
      return orderValues(l, r) > 0 ? TRUE : FALSE;
    case '>=':
      return orderValues(l, r) >= 0 ? TRUE : FALSE;
    default:
      return fault('#PARSE!');
  }
}

function call(name: string, args: readonly Node[], ctx: EvalContext): Value {
  const def = Object.prototype.hasOwnProperty.call(FUNCTIONS, name) ? FUNCTIONS[name] : undefined;
  if (!def) return err('#NAME?');
  if (args.length < def.min || args.length > def.max) return err('#ARGS!');
  if (def.lazy) return lazyCall(name, args, ctx);
  const vals: Value[] = [];
  for (const a of args) {
    const v = evaluate(a, ctx);
    if (v.t === 'err') return v;
    vals.push(v);
  }
  try {
    return def.run!(vals, ctx);
  } catch (e) {
    return faultValue(e);
  }
}

function lazyCall(name: string, args: readonly Node[], ctx: EvalContext): Value {
  switch (name) {
    case 'IF': {
      const c = evaluate(args[0]!, ctx);
      if (c.t === 'err') return c;
      let b: boolean;
      try {
        b = asBool(c);
      } catch (e) {
        return faultValue(e);
      }
      if (b) return evaluate(args[1]!, ctx);
      return args[2] ? evaluate(args[2], ctx) : BLANK;
    }
    case 'AND':
    case 'OR': {
      const isAnd = name === 'AND';
      for (const a of args) {
        const v = evaluate(a, ctx);
        if (v.t === 'err') return v;
        let b: boolean;
        try {
          b = asBool(v);
        } catch (e) {
          return faultValue(e);
        }
        if (isAnd && !b) return FALSE;
        if (!isAnd && b) return TRUE;
      }
      return isAnd ? TRUE : FALSE;
    }
    case 'SWITCH': {
      const x = evaluate(args[0]!, ctx);
      if (x.t === 'err') return x;
      const pairs = Math.floor((args.length - 1) / 2);
      for (let i = 0; i < pairs; i++) {
        const v = evaluate(args[1 + 2 * i]!, ctx);
        if (v.t === 'err') return v;
        let eq: boolean;
        try {
          eq = equalValues(x, v);
        } catch (e) {
          return faultValue(e);
        }
        if (eq) return evaluate(args[2 + 2 * i]!, ctx);
      }
      if ((args.length - 1) % 2 === 1) return evaluate(args[args.length - 1]!, ctx);
      return BLANK;
    }
    default:
      return err('#NAME?');
  }
}
