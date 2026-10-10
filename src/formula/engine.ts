/**
 * Formula engine (P8-02, SAD-61). Pure: no Obsidian or DOM dependencies.
 *
 * - Formulas reference fields by name within the same row only.
 * - The dependency graph is built once. Cycles among formula fields are found
 *   with Tarjan's SCC algorithm. Every formula on a loop returns #CYCLE!.
 * - Results are computed on demand and memoised per row. setInput recalculates
 *   only the dependent formulas (each once).
 * - Formula results are never stored in the table file (owner decision).
 */
import { compileFormula, type Compiled } from './parser';
import { evaluate, type EvalContext } from './evaluate';
import { BLANK, err, type Value } from './value';

export interface FieldSpec {
  readonly id: string;
  readonly name: string;
  /** Present for formula fields; absent for input fields. */
  readonly formula?: string;
}

export interface RowSpec {
  readonly id: string;
  readonly createdMs: number;
  readonly modifiedMs: number;
  /** Input field values keyed by field id. Missing keys are blank. */
  readonly inputs: Readonly<Record<string, Value>>;
}

export interface EngineOptions {
  readonly fields: readonly FieldSpec[];
  readonly rows: readonly RowSpec[];
  /** Epoch ms for TODAY/NOW. Captured at each full recalculation. */
  readonly now?: () => number;
}

export interface EngineStats {
  /** Formula evaluations performed (cycle fields are never evaluated). */
  evaluations: number;
  /** Unexpected internal exceptions. Must stay 0. */
  internalErrors: number;
}

interface RowState {
  readonly id: string;
  readonly createdMs: number;
  readonly modifiedMs: number;
  readonly inputs: Map<string, Value>;
  readonly computed: Map<string, Value>;
}

export class FormulaEngine {
  readonly stats: EngineStats = { evaluations: 0, internalErrors: 0 };
  private readonly fields = new Map<string, FieldSpec>();
  private readonly nameToIds = new Map<string, string[]>();
  private readonly compiled = new Map<string, Compiled>();
  /** formula id -> resolved field ids it references directly */
  private readonly deps = new Map<string, Set<string>>();
  /** field id -> formula ids that reference it directly */
  private readonly dependents = new Map<string, Set<string>>();
  private readonly cyclic = new Set<string>();
  /** acyclic formula id -> position in dependency order */
  private readonly rank = new Map<string, number>();
  private readonly evalOrder: string[] = [];
  private readonly rows = new Map<string, RowState>();
  private readonly nowFn: () => number;
  private nowMs = 0;

  constructor(opts: EngineOptions) {
    this.nowFn = opts.now ?? ((): number => Date.now());
    for (const f of opts.fields) {
      if (this.fields.has(f.id)) throw new Error(`duplicate field id ${f.id}`);
      this.fields.set(f.id, f);
      const list = this.nameToIds.get(f.name) ?? [];
      list.push(f.id);
      this.nameToIds.set(f.name, list);
    }
    for (const f of opts.fields) {
      if (f.formula === undefined) continue;
      const c = compileFormula(f.formula);
      this.compiled.set(f.id, c);
      const ds = new Set<string>();
      if (c.ok) {
        for (const ref of c.refs) {
          const ids = this.nameToIds.get(ref);
          if (ids && ids.length === 1) ds.add(ids[0]!);
        }
      }
      this.deps.set(f.id, ds);
    }
    for (const [f, ds] of this.deps) {
      for (const d of ds) {
        const set = this.dependents.get(d) ?? new Set<string>();
        set.add(f);
        this.dependents.set(d, set);
      }
    }
    this.findCycles();
    this.orderAcyclic();
    for (const r of opts.rows) {
      if (this.rows.has(r.id)) throw new Error(`duplicate row id ${r.id}`);
      this.rows.set(r.id, {
        id: r.id,
        createdMs: r.createdMs,
        modifiedMs: r.modifiedMs,
        inputs: new Map(Object.entries(r.inputs)),
        computed: new Map(),
      });
    }
    this.recalculateAll();
  }

  /** Formula ids that sit on a reference cycle (value is #CYCLE!). */
  cycleFieldIds(): string[] {
    return [...this.cyclic];
  }

  /** Current value of a cell. Unknown row or field gives blank. */
  value(rowId: string, fieldId: string): Value {
    const row = this.rows.get(rowId);
    if (!row || !this.fields.has(fieldId)) return BLANK;
    return this.valueOf(row, fieldId);
  }

  /**
   * Set an input cell and recalculate its dependents within that row.
   * Returns false (and changes nothing) for an unknown row, an unknown field,
   * or a formula field.
   */
  setInput(rowId: string, fieldId: string, v: Value): boolean {
    const row = this.rows.get(rowId);
    const f = this.fields.get(fieldId);
    if (!row || !f || f.formula !== undefined) return false;
    row.inputs.set(fieldId, v);
    const dirty = this.dirtyFrom(fieldId);
    for (const id of dirty) row.computed.delete(id);
    for (const id of dirty) this.valueOf(row, id);
    return true;
  }

  /** Full recalculation of every row. Captures the current time for TODAY and NOW. */
  recalculateAll(): void {
    this.nowMs = this.nowFn();
    for (const row of this.rows.values()) {
      row.computed.clear();
      for (const id of this.evalOrder) this.valueOf(row, id);
    }
  }

  private valueOf(row: RowState, id: string): Value {
    const f = this.fields.get(id);
    if (!f) return BLANK;
    if (f.formula === undefined) return row.inputs.get(id) ?? BLANK;
    if (this.cyclic.has(id)) return err('#CYCLE!');
    const hit = row.computed.get(id);
    if (hit !== undefined) return hit;
    const v = this.compute(row, id);
    row.computed.set(id, v);
    return v;
  }

  private compute(row: RowState, id: string): Value {
    const c = this.compiled.get(id);
    this.stats.evaluations++;
    if (!c) return err('#PARSE!');
    if (!c.ok) return err(c.code);
    const ctx: EvalContext = {
      rowId: row.id,
      createdMs: row.createdMs,
      modifiedMs: row.modifiedMs,
      now: this.nowMs,
      field: (name: string): Value | undefined => {
        const ids = this.nameToIds.get(name);
        if (!ids || ids.length !== 1) return undefined;
        return this.valueOf(row, ids[0]!);
      },
    };
    try {
      return evaluate(c.root, ctx);
    } catch {
      this.stats.internalErrors++;
      return err('#VALUE!');
    }
  }

  private dirtyFrom(fieldId: string): string[] {
    const seen = new Set<string>();
    const stack = [fieldId];
    while (stack.length > 0) {
      const x = stack.pop()!;
      for (const f of this.dependents.get(x) ?? []) {
        if (!seen.has(f)) {
          seen.add(f);
          stack.push(f);
        }
      }
    }
    return [...seen]
      .filter((f) => this.rank.has(f))
      .sort((a, b) => this.rank.get(a)! - this.rank.get(b)!);
  }

  private formulaDeps(id: string): string[] {
    const out: string[] = [];
    for (const d of this.deps.get(id) ?? []) if (this.compiled.has(d)) out.push(d);
    return out;
  }

  /** Tarjan's strongly connected components over formula fields. */
  private findCycles(): void {
    const index = new Map<string, number>();
    const low = new Map<string, number>();
    const onStack = new Set<string>();
    const stack: string[] = [];
    let counter = 0;
    const strong = (v: string): void => {
      index.set(v, counter);
      low.set(v, counter);
      counter++;
      stack.push(v);
      onStack.add(v);
      for (const w of this.formulaDeps(v)) {
        if (!index.has(w)) {
          strong(w);
          low.set(v, Math.min(low.get(v)!, low.get(w)!));
        } else if (onStack.has(w)) {
          low.set(v, Math.min(low.get(v)!, index.get(w)!));
        }
      }
      if (low.get(v) === index.get(v)) {
        const comp: string[] = [];
        let w: string;
        do {
          w = stack.pop()!;
          onStack.delete(w);
          comp.push(w);
        } while (w !== v);
        const selfLoop = this.deps.get(v)?.has(v) ?? false;
        if (comp.length > 1 || selfLoop) for (const c of comp) this.cyclic.add(c);
      }
    };
    for (const id of this.compiled.keys()) if (!index.has(id)) strong(id);
  }

  /** Dependency order (post-order DFS) of acyclic formula fields. */
  private orderAcyclic(): void {
    const visited = new Set<string>();
    const visit = (v: string): void => {
      if (visited.has(v)) return;
      visited.add(v);
      for (const w of this.formulaDeps(v)) if (!this.cyclic.has(w)) visit(w);
      this.rank.set(v, this.evalOrder.length);
      this.evalOrder.push(v);
    };
    for (const id of this.compiled.keys()) if (!this.cyclic.has(id)) visit(id);
  }
}
