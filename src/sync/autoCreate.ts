// Create missing Airtable fields (P7-09). Two steps: planAutoCreate lists the exact fields and
// createMissingFields runs only after the user has confirmed that list. The default in the UI is Cancel.
import type { FieldDefinition, FieldTypeName } from '../model/types.js';
import type { AirtableFieldSchema } from './airtableClient.js';
import { remoteHashFor } from './rules.js';
import { refreshRecordSnapshot, requireLink, safeReason, type SyncContext } from './engineTypes.js';
import { hashValues, remoteValues } from './values.js';

/** Airtable create-field spec for each Tablify type that can be created with no extra choices. */
const CREATE_SPEC: Partial<Record<FieldTypeName, { airtableType: string; options?: Record<string, unknown> }>> = {
  text: { airtableType: 'singleLineText' },
  long_text: { airtableType: 'multilineText' },
  url: { airtableType: 'url' },
  email: { airtableType: 'email' },
  phone: { airtableType: 'phoneNumber' },
  number: { airtableType: 'number', options: { precision: 0 } },
  percent: { airtableType: 'percent', options: { precision: 0 } },
  rating: { airtableType: 'rating', options: { max: 5, icon: 'star', color: 'yellowBright' } },
  checkbox: { airtableType: 'checkbox', options: { icon: 'check', color: 'greenBright' } },
  date: { airtableType: 'date', options: { dateFormat: { name: 'iso' } } },
};

/** Types that are not created, with the reason shown to the user. */
const NOT_CREATED: Partial<Record<FieldTypeName, string>> = {
  currency: 'needs a currency symbol choice',
  duration: 'needs a duration unit choice',
  date_time: 'needs a time zone choice',
  single_select: 'select options are not created yet; add the field in Airtable first',
  multi_select: 'select options are not created yet; add the field in Airtable first',
  attachment: 'attachments are not created from Tablify',
  auto_number: 'system field',
  created_time: 'system field',
  modified_time: 'system field',
};

export interface AutoCreateItem {
  fieldId: string;
  name: string;
  tablifyType: FieldTypeName;
  airtableType: string;
  options?: Record<string, unknown>;
}

export interface AutoCreateSkip {
  fieldId: string;
  name: string;
  reason: string;
}

export interface AutoCreatePlan {
  items: AutoCreateItem[];
  skipped: AutoCreateSkip[];
}

/** Local fields with no Airtable link that can be created. Shown to the user before anything is sent. */
export function planAutoCreate(
  fields: readonly FieldDefinition[],
  remoteFields: readonly AirtableFieldSchema[],
): AutoCreatePlan {
  const items: AutoCreateItem[] = [];
  const skipped: AutoCreateSkip[] = [];
  const remoteNames = new Set(remoteFields.map((f) => f.name.trim().toLowerCase()));
  for (const f of fields) {
    if (f.airtable) {
      if (!remoteFields.some((r) => r.id === f.airtable!.id)) {
        skipped.push({ fieldId: f.id, name: f.name, reason: 'linked field no longer exists in Airtable' });
      }
      continue;
    }
    const spec = CREATE_SPEC[f.type];
    if (!spec) {
      skipped.push({ fieldId: f.id, name: f.name, reason: NOT_CREATED[f.type] ?? 'not supported' });
      continue;
    }
    if (remoteNames.has(f.name.trim().toLowerCase())) {
      skipped.push({ fieldId: f.id, name: f.name, reason: 'a field with this name already exists in Airtable' });
      continue;
    }
    items.push({ fieldId: f.id, name: f.name, tablifyType: f.type, airtableType: spec.airtableType, options: spec.options });
  }
  return { items, skipped };
}

export interface AutoCreateResult {
  created: Array<{ fieldId: string; airtableId: string; name: string; airtableType: string }>;
  failed: { name: string; reason: string } | null;
}

/**
 * Creates the planned fields, one at a time, and stops at the first error. The first request is the
 * scope check: a token without schema.bases:write fails there, so nothing is created.
 * Refuses to run if remote records changed since the last sync (see the precondition below).
 */
export async function createMissingFields(
  ctx: SyncContext,
  plan: AutoCreatePlan,
  confirmed: boolean,
): Promise<AutoCreateResult> {
  if (!confirmed) throw new Error('Creating fields needs explicit confirmation. Nothing was created.');
  const link = requireLink(ctx.session);
  const result: AutoCreateResult = { created: [], failed: null };
  if (plan.items.length === 0) return result;

  // Precondition. Rebasing the remote hash below assumes the remote side matches the last sync. If it
  // does not, rebasing would hide that change for good, so refuse and ask for a pull first.
  const fieldsBefore = ctx.session.getFields() as FieldDefinition[];
  const remote = await ctx.client.listRecords(link.baseId, link.tableId);
  const byId = new Map(remote.map((r) => [r.id, r]));
  for (const row of ctx.session.store.getAllRows()) {
    if (!row.sync) continue;
    const rec = byId.get(row.sync.airtableId);
    if (rec && remoteHashFor(fieldsBefore, rec) !== row.sync.remoteHash) {
      throw new Error('Airtable records changed since the last sync. Pull first, then create the fields.');
    }
  }

  for (const item of plan.items) {
    try {
      const created = await ctx.client.createField(link.baseId, link.tableId, {
        name: item.name,
        type: item.airtableType,
        options: item.options,
      });
      ctx.session.store.setFieldAirtable(item.fieldId, { id: created.id, type: created.type, readOnly: false });
      result.created.push({ fieldId: item.fieldId, airtableId: created.id, name: item.name, airtableType: created.type });
    } catch (err) {
      result.failed = { name: item.name, reason: safeReason(err) };
      break;
    }
  }

  if (result.created.length > 0) {
    // The new fields are empty in Airtable. Rebase every linked row's remote hash to include them.
    // A row with a local value in a new field is marked changed, so the next push sends that value.
    const fieldsAfter = ctx.session.getFields() as FieldDefinition[];
    const newIds = new Set(result.created.map((c) => c.fieldId));
    for (const row of ctx.session.store.getAllRows()) {
      if (!row.sync) continue;
      const rec = byId.get(row.sync.airtableId);
      if (!rec) continue;
      const hashAfter = hashValues(remoteValues(fieldsAfter, rec.fields));
      const hasLocalNew = fieldsAfter.some((f) => newIds.has(f.id) && row.values[f.id] !== undefined && row.values[f.id] !== null && row.values[f.id] !== '');
      if (hasLocalNew) ctx.session.store.updateRow(row.id, {});
      const current = ctx.session.store.getRow(row.id)!;
      ctx.session.store.setRowSync(row.id, { ...current.sync!, remoteHash: hashAfter });
    }
  }

  ctx.session.stack.clear();
  refreshRecordSnapshot(ctx.session);
  return result;
}
