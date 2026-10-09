// File explorer menu model (P5-01). Pure logic, no Obsidian imports, so it is unit-tested in Node.
// Spec: spec/steps/P5-01.md, FEATURES §2.16. Items: .tablify file → Open, Duplicate, Export;
// folder → New table, Import CSV / Excel as table; other files and the vault root → nothing.

import { parse } from '../format/parse.js';
import { serialize } from '../format/serialize.js';
import type { FieldDefinition, TablifyFile } from '../model/types.js';
import { createDefaultView } from '../model/view.js';
import { generateFieldId, generateTableId } from '../utils/idGen.js';

export type MenuTarget = { kind: 'file'; extension: string } | { kind: 'folder'; path: string } | { kind: 'other' };

export type FileMenuAction = 'open' | 'duplicate' | 'export' | 'newTable' | 'importTable';

export interface FileMenuItem {
  id: FileMenuAction;
  label: string;
}

/** Suffix added to a duplicated table's name (decision from the P5 questions). */
export const COPY_SUFFIX = ' copy';

/** Default name for a new table (proposed in P5-01; disclosed in the gate note). */
export const NEW_TABLE_NAME = 'Untitled table';

const OPEN: FileMenuItem = { id: 'open', label: 'Open' };
const DUPLICATE: FileMenuItem = { id: 'duplicate', label: 'Duplicate' };
const EXPORT: FileMenuItem = { id: 'export', label: 'Export' };
const NEW_TABLE: FileMenuItem = { id: 'newTable', label: 'New table' };
const IMPORT: FileMenuItem = { id: 'importTable', label: 'Import CSV / Excel as table' };

/** Items for a right-clicked file-explorer target. Empty list means no Tablify items. */
export function menuItemsFor(target: MenuTarget): FileMenuItem[] {
  if (target.kind === 'file') return target.extension === 'tablify' ? [OPEN, DUPLICATE, EXPORT] : [];
  if (target.kind === 'folder') return target.path === '' || target.path === '/' ? [] : [NEW_TABLE, IMPORT];
  return [];
}

/** Join a folder path and a file base name. The vault root is ''. */
export function joinPath(folder: string, name: string): string {
  return folder === '' || folder === '/' ? name : `${folder}/${name}`;
}

/** First free name: base, then "base 2", "base 3", ... `exists` is given the candidate base name. */
export function uniqueName(base: string, exists: (candidate: string) => boolean): string {
  if (!exists(base)) return base;
  for (let n = 2; ; n++) {
    const candidate = `${base} ${n}`;
    if (!exists(candidate)) return candidate;
  }
}

export type TransformResult = { ok: true; text: string } | { ok: false; error: string };

/**
 * Duplicate a table file's text. Only `tableId` and `name` change. Row IDs, revisions, fields,
 * views, and unknown keys are kept (R-D11, P5-01 step 3).
 */
export function duplicateTableText(text: string, newName: string): TransformResult {
  const parsed = parse(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  const copy: TablifyFile = { ...parsed.data, tableId: generateTableId(), name: newName };
  return { ok: true, text: serialize(copy) };
}

/** Text for a new, empty table: one primary text field "Name", no rows, default view. */
export function newTableText(name: string): string {
  const primary: FieldDefinition = { id: generateFieldId(), name: 'Name', type: 'text', primary: true };
  const file: TablifyFile = {
    formatVersion: 1,
    tableId: generateTableId(),
    name,
    fields: [primary],
    rows: [],
    views: [createDefaultView([primary])],
    syncLink: null,
  };
  return serialize(file);
}
