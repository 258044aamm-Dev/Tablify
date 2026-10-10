// Link and unlink for the sync modal (P7-10). Pure model code: no DOM, no Obsidian imports.
import type { TableSession } from '../../model/tableSession.js';
import type { FieldDefinition, FieldTypeName } from '../../model/types.js';
import type { AirtableTableSchema } from '../../sync/airtableClient.js';
import { mapField, mapTable } from '../../sync/fieldMap.js';

export interface LinkChoice {
  baseId: string;
  table: AirtableTableSchema;
  /** Replace the local columns with the Airtable schema. Local values in those columns are removed. */
  replaceColumns: boolean;
}

/**
 * Links the session to one Airtable table.
 * - Default: local columns are matched to Airtable fields by name and type. Matched columns get the link.
 *   Unmatched local columns stay local-only. Airtable fields with no local column are not pulled.
 * - replaceColumns: local columns are replaced by the Airtable schema (values in those columns are removed).
 *   Any existing link is cleared first.
 * Nothing is fetched or written to Airtable here. The user pulls afterwards.
 */
export function linkTable(session: TableSession, choice: LinkChoice, now: string): { matched: number; replaced: boolean } {
  const { table, baseId } = choice;
  let matched = 0;
  if (choice.replaceColumns) {
    unlinkTable(session);
    const mapping = mapTable(table);
    for (const f of session.getFields()) session.store.removeField(f.id);
    for (const f of mapping.fields) session.store.addField(f);
    session.patchView({ columnOrder: mapping.fields.map((f) => f.id), hidden: [], sort: [], groupBy: null });
    matched = mapping.fields.length;
  } else {
    const used = new Set<string>();
    for (const local of session.getFields()) {
      if (local.airtable) continue;
      const remote = table.fields.find((r) => !used.has(r.id) && r.name.trim().toLowerCase() === local.name.trim().toLowerCase());
      if (!remote) continue;
      const { def, info } = mapField(remote, null);
      if (def.type !== local.type) continue;
      used.add(remote.id);
      session.store.setFieldAirtable(local.id, { id: remote.id, type: remote.type, readOnly: info.readOnly });
      matched++;
    }
  }
  session.setSyncLink({
    baseId,
    tableId: table.id,
    tableName: table.name,
    linkedAt: now,
    lastSync: null,
    records: [],
  });
  session.stack.clear();
  return { matched, replaced: choice.replaceColumns };
}

/** Removes the link from the table and from every row and column. Local values are kept. */
export function unlinkTable(session: TableSession): void {
  for (const row of session.store.getAllRows()) {
    if (row.sync) session.store.setRowSync(row.id, null);
  }
  for (const f of session.getFields()) {
    if (f.airtable) session.store.setFieldAirtable(f.id, null);
  }
  session.setSyncLink(null);
  session.stack.clear();
}

/** Human label for a Tablify type, used in the field list. */
export function typeLabel(type: FieldTypeName): string {
  return type.replace(/_/g, ' ');
}

export function linkedFieldCount(fields: readonly FieldDefinition[]): number {
  return fields.filter((f) => !!f.airtable).length;
}
