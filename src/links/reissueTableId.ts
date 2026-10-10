// Give a copied table file its own table ID (P8-04 follow-up, R-3 / R-D11).
// Pure logic, no Obsidian imports, so it is unit-tested in Node.
//
// Why: Obsidian's own "Duplicate" copies the file text, so the copy keeps the
// original tableId. Links resolve by ID, and the index uses the first file by
// path. The copy is therefore never the target of a link. This module lets the
// user give the copy a new ID, on purpose, from the file explorer menu.
//
// Rules (fixed, no silent writes):
// - Only `tableId` changes. Rows, fields, views, sync data and unknown keys are kept.
// - The file that owns the ID (first path in the index) is never changed.
// - A file open in a table view is not changed, because the open view could save
//   the old ID back. The user closes the tab first.

import { parse } from '../format/parse.js';
import { serialize } from '../format/serialize.js';
import { generateTableId } from '../utils/idGen.js';

export type ReissueTransform = { ok: true; text: string } | { ok: false; error: string };

/** The file text with a new `tableId`. Every other key is kept as parsed. */
export function reissueTableIdText(text: string): ReissueTransform {
  const parsed = parse(text);
  if (!parsed.ok) return { ok: false, error: parsed.error };
  return { ok: true, text: serialize({ ...parsed.data, tableId: generateTableId() }) };
}

export type ReissueDecision =
  | { kind: 'reissue' }
  | { kind: 'keeps-id' }
  | { kind: 'not-duplicated' }
  | { kind: 'open' };

/**
 * What to do with `path`, given the vault's duplicate groups (`LinkIndex.duplicates()`)
 * and the paths of files open in a table view. `paths[0]` is the owner (sorted by path).
 */
export function decideReissue(
  duplicates: ReadonlyArray<{ tableId: string; paths: readonly string[] }>,
  path: string,
  openPaths: readonly string[],
): ReissueDecision {
  const group = duplicates.find((d) => d.paths.includes(path));
  if (!group) return { kind: 'not-duplicated' };
  if (group.paths[0] === path) return { kind: 'keeps-id' };
  if (openPaths.includes(path)) return { kind: 'open' };
  return { kind: 'reissue' };
}
