/**
 * Link model (P8-04, SAD-63). Pure: no Obsidian imports, so it is unit-tested.
 *
 * A link cell stores `{ tableId, rowId }` (FORMAT_SPEC §8). Links resolve by ID, never by file
 * path or name, so renaming a file keeps every link. A target that cannot be found is a broken
 * link: it is reported and marked, and the source value is never removed.
 */

import type { CellValue, FieldDefinition, LinkRef, Row, TablifyFile } from '../model/types.js';
import { getFieldType } from '../model/fieldTypes/registry.js';

/** Label shown for a row with an empty primary field. */
export const UNTITLED_ROW = 'Untitled row';

export interface LinkableRow {
  id: string;
  label: string;
}

/** One non-empty link cell of a table, for the integrity check. */
export interface LinkCell {
  rowId: string;
  rowLabel: string;
  fieldId: string;
  fieldName: string;
  refs: LinkRef[];
}

/** What the index knows about one table: enough to resolve links into it and to check links out of it. */
export interface TableSnapshot {
  tableId: string;
  /** File name without the .tablify extension. Changes on rename; the ID does not. */
  name: string;
  /** Vault-relative path. */
  path: string;
  rows: LinkableRow[];
  linkCells: LinkCell[];
}

export type LinkResolution =
  | { ok: true; tableName: string; rowLabel: string }
  | { ok: false; reason: 'missing-table' }
  | { ok: false; reason: 'missing-row'; tableName: string };

export interface BrokenLink {
  sourcePath: string;
  sourceTable: string;
  rowId: string;
  rowLabel: string;
  fieldName: string;
  targetTableId: string;
  targetRowId: string;
  reason: 'missing-table' | 'missing-row';
  message: string;
}

export interface IntegrityReport {
  /** Number of link references checked across the vault. */
  checked: number;
  broken: BrokenLink[];
  /** Table IDs that more than one file carries. Only the first file (by path) is indexed. */
  duplicates: Array<{ tableId: string; paths: string[] }>;
}

export const BROKEN_MESSAGES: Record<BrokenLink['reason'], string> = {
  'missing-table': 'The linked table is not in this vault.',
  'missing-row': 'The linked row was deleted.',
};

function baseName(path: string): string {
  const last = path.split('/').pop() ?? path;
  return last.replace(/\.tablify$/i, '');
}

function primaryFieldOf(fields: FieldDefinition[]): FieldDefinition | undefined {
  return fields.find((f) => f.primary) ?? fields[0];
}

function isNonEmptyLinkArray(v: CellValue | undefined): v is LinkRef[] {
  return Array.isArray(v) && v.length > 0;
}

/** Build the snapshot the index keeps for one parsed file. */
export function snapshotTable(file: TablifyFile, path: string): TableSnapshot {
  const primary = primaryFieldOf(file.fields);
  const linkFields = file.fields.filter((f) => f.type === 'link');
  const rows: LinkableRow[] = [];
  const linkCells: LinkCell[] = [];
  for (const row of file.rows as Row[]) {
    const label = primary ? getFieldType(primary.type).format(row.values[primary.id] ?? null, primary) : '';
    rows.push({ id: row.id, label });
    for (const field of linkFields) {
      const v = row.values[field.id];
      if (isNonEmptyLinkArray(v)) {
        linkCells.push({ rowId: row.id, rowLabel: label, fieldId: field.id, fieldName: field.name, refs: v });
      }
    }
  }
  return { tableId: file.tableId, name: baseName(path), path, rows, linkCells };
}

/** Lookup structure over the snapshots of every table in the vault. */
export class LinkIndex {
  private readonly byPath = new Map<string, TableSnapshot>();
  private derived: { byId: Map<string, TableSnapshot>; duplicates: IntegrityReport['duplicates'] } | null = null;
  private readonly rowMaps = new WeakMap<TableSnapshot, Map<string, LinkableRow>>();

  /** Add or replace the snapshot for a path. */
  put(snapshot: TableSnapshot): void {
    this.byPath.set(snapshot.path, snapshot);
    this.derived = null;
  }

  remove(path: string): void {
    if (this.byPath.delete(path)) this.derived = null;
  }

  has(path: string): boolean {
    return this.byPath.has(path);
  }

  paths(): string[] {
    return [...this.byPath.keys()];
  }

  /** The snapshot for a path, or undefined. Used to compare before a write. */
  get(path: string): TableSnapshot | undefined {
    return this.byPath.get(path);
  }

  /** One snapshot per table ID, sorted by path. A duplicate ID keeps the first path only. */
  tables(): TableSnapshot[] {
    return [...this.derive().byId.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
  }

  byTableId(tableId: string): TableSnapshot | undefined {
    return this.derive().byId.get(tableId);
  }

  duplicates(): IntegrityReport['duplicates'] {
    return this.derive().duplicates.map((d) => ({ tableId: d.tableId, paths: [...d.paths] }));
  }

  resolve(ref: LinkRef): LinkResolution {
    const table = this.byTableId(ref.tableId);
    if (!table) return { ok: false, reason: 'missing-table' };
    const row = this.rowMap(table).get(ref.rowId);
    if (!row) return { ok: false, reason: 'missing-row', tableName: table.name };
    return { ok: true, tableName: table.name, rowLabel: row.label.trim() || UNTITLED_ROW };
  }

  private rowMap(table: TableSnapshot): Map<string, LinkableRow> {
    let map = this.rowMaps.get(table);
    if (!map) {
      map = new Map(table.rows.map((r) => [r.id, r]));
      this.rowMaps.set(table, map);
    }
    return map;
  }

  private derive(): { byId: Map<string, TableSnapshot>; duplicates: IntegrityReport['duplicates'] } {
    if (this.derived) return this.derived;
    const sorted = [...this.byPath.values()].sort((a, b) => (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    const byId = new Map<string, TableSnapshot>();
    const dupPaths = new Map<string, string[]>();
    for (const snap of sorted) {
      const first = byId.get(snap.tableId);
      if (!first) {
        byId.set(snap.tableId, snap);
      } else {
        const list = dupPaths.get(snap.tableId) ?? [first.path];
        list.push(snap.path);
        dupPaths.set(snap.tableId, list);
      }
    }
    const duplicates = [...dupPaths.entries()].map(([tableId, paths]) => ({ tableId, paths }));
    this.derived = { byId, duplicates };
    return this.derived;
  }
}

export function createLinkIndex(): LinkIndex {
  return new LinkIndex();
}

/** Text for a link cell: resolved row labels, with broken links counted separately. */
export function summarizeLinks(value: CellValue | undefined, index: LinkIndex): { text: string; broken: number } {
  if (!isNonEmptyLinkArray(value)) return { text: '', broken: 0 };
  const parts: string[] = [];
  let broken = 0;
  for (const ref of value) {
    const res = index.resolve(ref);
    if (res.ok) {
      parts.push(res.rowLabel);
    } else {
      broken++;
      parts.push(res.reason === 'missing-table' ? 'Missing table' : 'Missing row');
    }
  }
  return { text: parts.join(', '), broken };
}

/** Full vault check: every link reference, resolved against the index. Deterministic order. */
export function checkIntegrity(index: LinkIndex): IntegrityReport {
  const broken: BrokenLink[] = [];
  let checked = 0;
  for (const table of index.tables()) {
    for (const cell of table.linkCells) {
      for (const ref of cell.refs) {
        checked++;
        const res = index.resolve(ref);
        if (res.ok) continue;
        broken.push({
          sourcePath: table.path,
          sourceTable: table.name,
          rowId: cell.rowId,
          rowLabel: cell.rowLabel.trim() || UNTITLED_ROW,
          fieldName: cell.fieldName,
          targetTableId: ref.tableId,
          targetRowId: ref.rowId,
          reason: res.reason,
          message: BROKEN_MESSAGES[res.reason],
        });
      }
    }
  }
  return { checked, broken, duplicates: index.duplicates() };
}

/**
 * New value for a link cell after the picker closes. Keeps references into other tables as they
 * are, keeps the existing order of the target references that stay selected, then appends new
 * picks in display order. Returns null when nothing is left, so an empty cell is stored as null.
 */
export function buildSelection(
  current: readonly LinkRef[],
  targetTableId: string,
  selectedRowIds: readonly string[],
): LinkRef[] | null {
  const selected = new Set(selectedRowIds);
  const kept: LinkRef[] = [];
  const seen = new Set<string>();
  for (const ref of current) {
    if (ref.tableId !== targetTableId) {
      kept.push(ref);
    } else if (selected.has(ref.rowId) && !seen.has(ref.rowId)) {
      kept.push(ref);
      seen.add(ref.rowId);
    }
  }
  for (const rowId of selectedRowIds) {
    if (!seen.has(rowId)) {
      kept.push({ tableId: targetTableId, rowId });
      seen.add(rowId);
    }
  }
  return kept.length > 0 ? kept : null;
}

/** Case-insensitive substring filter for the picker. An empty query keeps every row. */
export function filterRows(rows: readonly LinkableRow[], query: string): LinkableRow[] {
  const q = query.trim().toLowerCase();
  if (q === '') return rows.slice();
  return rows.filter((r) => r.label.toLowerCase().includes(q));
}
