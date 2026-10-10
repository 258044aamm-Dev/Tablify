/**
 * Airtable sync modal (P7-10, features 19–21). Follows the prototype's sync modal layout: token
 * status, link state, pull and push, a progress line, conflicts, and missing fields. Differences
 * from the prototype, on purpose:
 *  - The token is never shown. The modal reports whether one is stored in settings (P7-03).
 *  - The modal is not marked SIMULATED. Its actions call the real engine.
 * Every action runs inside try/catch. A failure shows a short message and changes nothing.
 */
import { App, Modal } from 'obsidian';
import type { TableSession } from '../../model/tableSession.js';
import type { FieldDefinition, SyncConflictDecision } from '../../model/types.js';
import { AirtableClient, AirtableError, type AirtableBase, type AirtableTableSchema } from '../../sync/airtableClient.js';
import { pullFromAirtable } from '../../sync/pull.js';
import { pushToAirtable } from '../../sync/push.js';
import { resolveConflict } from '../../sync/conflicts.js';
import { planAutoCreate, createMissingFields, type AutoCreatePlan } from '../../sync/autoCreate.js';
import type { ConflictItem, SyncContext, SyncReport } from '../../sync/engineTypes.js';
import { redactSecrets } from '../../sync/redact.js';
import { linkTable, unlinkTable, typeLabel } from './syncController.js';

/** Creates an element under `parent`. Typed by tag name, so inputs keep their own properties. */
function el<K extends keyof HTMLElementTagNameMap>(
  parent: HTMLElement,
  tag: K,
  opts: { cls?: string; text?: string } = {},
): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (opts.cls) node.className = opts.cls;
  if (opts.text !== undefined) node.textContent = opts.text;
  // The repo's DOM typings do not accept HTMLElement where Element is expected (see docs/evidence/P7-06-P7-09.md).
  parent.insertAdjacentElement('beforeend', node as unknown as Element);
  return node;
}

export const SCOPES_TEXT = 'data.records:read · data.records:write · schema.bases:read';
export const CREATE_SCOPE_TEXT = 'schema.bases:write is needed only to create fields.';

export interface SyncModalDeps {
  session: TableSession;
  /** The token from settings, or null when none is stored. Read once, when the modal opens. */
  token: string | null;
  /** Builds a client for one action. Tests inject a client over the fake server. */
  makeClient?: (token: string) => AirtableClient;
  now?: () => string;
  /** Called after the session changed. The view re-renders and saves. */
  changed: () => void;
}

interface ModalState {
  bases: AirtableBase[];
  tables: AirtableTableSchema[];
  baseId: string | null;
  tableIndex: number;
  replaceColumns: boolean;
  busy: string | null;
  status: { text: string; error: boolean } | null;
  conflicts: ConflictItem[];
  plan: AutoCreatePlan | null;
  planFields: AirtableTableSchema['fields'];
}

export class SyncModal extends Modal {
  private readonly state: ModalState = {
    bases: [],
    tables: [],
    baseId: null,
    tableIndex: 0,
    replaceColumns: false,
    busy: null,
    status: null,
    conflicts: [],
    plan: null,
    planFields: [],
  };
  private cancelButton: HTMLButtonElement | null = null;

  constructor(
    app: App,
    private readonly deps: SyncModalDeps,
  ) {
    super(app);
  }

  onOpen(): void {
    this.setTitle('Airtable sync');
    this.modalEl.addClass('tablify__modal');
    this.render();
    if (this.deps.token) void this.loadBases();
  }

  onClose(): void {
    while (this.contentEl.firstChild) this.contentEl.removeChild(this.contentEl.firstChild);
  }

  // ---- clients and context ----

  private client(): AirtableClient {
    if (!this.deps.token) throw new Error('No Airtable token is stored. Add one in Tablify settings first.');
    return this.deps.makeClient ? this.deps.makeClient(this.deps.token) : new AirtableClient({ token: this.deps.token });
  }

  private ctx(): SyncContext {
    return { client: this.client(), session: this.deps.session, now: this.deps.now ?? (() => new Date().toISOString()) };
  }

  private fail(err: unknown, prefix: string): void {
    const raw = err instanceof Error ? err.message : 'Unknown error.';
    const safe = redactSecrets(raw, this.deps.token ?? undefined);
    const hint = err instanceof AirtableError && (err.kind === 'network' || err.kind === 'server' || err.kind === 'rate_limited')
      ? ' Nothing in the table changed.'
      : '';
    this.state.status = { text: `${prefix}: ${safe}${hint}`, error: true };
  }

  /** Runs one action: sets busy, catches errors, and re-renders. */
  private async run(label: string, work: () => Promise<void>): Promise<void> {
    this.state.busy = label;
    this.state.status = null;
    this.render();
    try {
      await work();
    } catch (err) {
      this.fail(err, `${label} failed`);
    } finally {
      this.state.busy = null;
      this.render();
    }
  }

  // ---- actions ----

  private async loadBases(): Promise<void> {
    await this.run('Loading bases', async () => {
      this.state.bases = await this.client().listBases();
      if (this.state.bases.length > 0 && !this.state.baseId) this.state.baseId = this.state.bases[0].id;
      await this.loadTables();
    });
  }

  private async loadTables(): Promise<void> {
    if (!this.state.baseId) return;
    this.state.tables = await this.client().listTables(this.state.baseId);
    this.state.tableIndex = 0;
  }

  private async link(): Promise<void> {
    const table = this.state.tables[this.state.tableIndex];
    if (!table || !this.state.baseId) return;
    await this.run('Linking', async () => {
      const res = linkTable(
        this.deps.session,
        { baseId: this.state.baseId!, table, replaceColumns: this.state.replaceColumns },
        (this.deps.now ?? (() => new Date().toISOString()))(),
      );
      this.state.status = {
        text: res.replaced
          ? `Linked to ${table.name} and replaced the columns. Pull to fill the rows.`
          : `Linked to ${table.name}. ${res.matched} column(s) matched by name and type.`,
        error: false,
      };
      this.deps.changed();
    });
  }

  private unlink(): void {
    unlinkTable(this.deps.session);
    this.state.conflicts = [];
    this.state.plan = null;
    this.state.status = { text: 'Unlinked. Local values are kept.', error: false };
    this.deps.changed();
    this.render();
  }

  private pull(): Promise<void> {
    return this.run('Pulling', async () => {
      const report = await pullFromAirtable(this.ctx());
      this.afterReport(report);
    });
  }

  private push(): Promise<void> {
    return this.run('Pushing', async () => {
      const report = await pushToAirtable(this.ctx());
      this.afterReport(report);
    });
  }

  private afterReport(report: SyncReport): void {
    this.state.conflicts = report.conflicts;
    const problems: string[] = [];
    if (report.failures.length) {
      problems.push(`${report.failures.length} row(s) not sent: ${report.failures.map((f) => f.reason).filter((v, i, a) => a.indexOf(v) === i).join('; ')}`);
    }
    if (report.conflicts.length) problems.push(`${report.conflicts.length} conflict(s) need a choice`);
    this.state.status = {
      text: `${report.direction === 'pull' ? 'Pulled' : 'Pushed'}: ${report.summary || 'no changes'}.${problems.length ? ' ' + problems.join('. ') + '.' : ''}`,
      error: !report.ok,
    };
    this.deps.changed();
  }

  private async resolve(item: ConflictItem, decision: SyncConflictDecision): Promise<void> {
    await this.run('Resolving', async () => {
      const res = await resolveConflict(this.ctx(), item.rowId, decision);
      this.state.conflicts = this.state.conflicts.filter((c) => c.rowId !== item.rowId);
      this.state.status = {
        text: res.createdRowId
          ? 'Kept both. The remote copy is a new row. Push to create it in Airtable.'
          : `Resolved: ${decision.replace('_', ' ')}.`,
        error: false,
      };
      this.deps.changed();
    });
  }

  private async preparePlan(): Promise<void> {
    await this.run('Checking fields', async () => {
      const link = this.deps.session.getSyncLink();
      if (!link) throw new Error('Link the table first.');
      const tables = await this.client().listTables(link.baseId);
      const table = tables.find((t) => t.id === link.tableId);
      if (!table) throw new Error('The linked table no longer exists in Airtable.');
      this.state.planFields = table.fields;
      this.state.plan = planAutoCreate(this.deps.session.getFields() as FieldDefinition[], table.fields);
      this.state.status = this.state.plan.items.length
        ? { text: `${this.state.plan.items.length} field(s) can be created. Nothing is created until you confirm.`, error: false }
        : { text: 'No local fields need creating in Airtable.', error: false };
    });
  }

  private async createFields(): Promise<void> {
    if (!this.state.plan) return;
    const plan = this.state.plan;
    await this.run('Creating fields', async () => {
      const res = await createMissingFields(this.ctx(), plan, true);
      this.state.plan = null;
      this.state.status = res.failed
        ? { text: `Created ${res.created.length} of ${plan.items.length}. ${res.failed.name}: ${res.failed.reason}. Nothing else was created.`, error: true }
        : { text: `Created ${res.created.length} field(s) in Airtable.`, error: false };
      this.deps.changed();
    });
  }

  // ---- rendering ----

  private render(): void {
    const root = this.contentEl;
    while (root.firstChild) root.removeChild(root.firstChild);
    const link = this.deps.session.getSyncLink();
    const busy = this.state.busy !== null;

    // Token status: never the value.
    el(root, 'div', {
      cls: 'tablify-sync__token',
      text: this.deps.token
        ? 'Token: stored in Tablify settings (never written to .tablify files).'
        : 'No token. Add one in Tablify settings, under Airtable sync.',
    });
    el(root, 'div', { cls: 'tablify-sync__scopes', text: `Scopes: ${SCOPES_TEXT}. ${CREATE_SCOPE_TEXT}` });

    // Link state.
    const linkBox = el(root, 'div', { cls: 'tablify-sync__link' });
    if (link) {
      el(linkBox, 'span', { text: `Linked to ${link.tableName} (${link.baseId}).` });
      const unlinkBtn = el(linkBox, 'button', { text: 'Unlink' });
      unlinkBtn.addEventListener('click', () => this.unlink());
    } else {
      this.renderLinkForm(linkBox, busy);
    }

    // Pull and push.
    const actions = el(root, 'div', { cls: 'tablify-sync__actions' });
    const pullBtn = el(actions, 'button', { text: 'Pull from Airtable' });
    const pushBtn = el(actions, 'button', { text: 'Push to Airtable' });
    const canRun = !!link && !!this.deps.token && !busy;
    pullBtn.disabled = !canRun;
    pushBtn.disabled = !canRun;
    pullBtn.addEventListener('click', () => void this.pull());
    pushBtn.addEventListener('click', () => void this.push());

    if (this.state.busy) el(root, 'div', { cls: 'tablify-sync__progress', text: `${this.state.busy}…` });

    if (this.state.status) {
      el(root, 'div', {
        cls: this.state.status.error ? 'tablify-sync__status tablify-sync__status--error' : 'tablify-sync__status',
        text: this.state.status.text,
      });
    }
    if (link?.lastSync) {
      el(root, 'div', {
        cls: 'tablify-sync__last',
        text: `Last ${link.lastSync.direction} ${link.lastSync.at}: ${link.lastSync.ok ? 'ok' : 'with problems'}. ${link.lastSync.summary}`,
      });
    }

    this.renderConflicts(root, busy);
    if (link) this.renderFields(root, busy);
  }

  private renderLinkForm(box: HTMLElement, busy: boolean): void {
    const baseSel = el(box, 'select', { cls: 'tablify-sync__base' });
    for (const b of this.state.bases) {
      const opt = el(baseSel, 'option', { text: b.name });
      opt.value = b.id;
      if (b.id === this.state.baseId) opt.selected = true;
    }
    baseSel.addEventListener('change', () => {
      this.state.baseId = baseSel.value;
      void this.run('Loading tables', () => this.loadTables());
    });

    const tableSel = el(box, 'select', { cls: 'tablify-sync__table' });
    this.state.tables.forEach((t, i) => {
      const opt = el(tableSel, 'option', { text: t.name });
      opt.value = String(i);
      if (i === this.state.tableIndex) opt.selected = true;
    });
    tableSel.addEventListener('change', () => {
      this.state.tableIndex = Number(tableSel.value);
    });

    const replaceLabel = el(box, 'label');
    const replace = el(replaceLabel, 'input');
    replace.type = 'checkbox';
    replace.checked = this.state.replaceColumns;
    replaceLabel.appendChild(document.createTextNode(' Replace local columns with the Airtable schema (local values in those columns are removed)'));
    replace.addEventListener('change', () => {
      this.state.replaceColumns = replace.checked;
      this.render();
    });

    const linkBtn = el(box, 'button', { text: this.state.replaceColumns ? 'Replace columns and link' : 'Link table' });
    linkBtn.disabled = busy || !this.deps.token || this.state.tables.length === 0;
    linkBtn.addEventListener('click', () => void this.link());
  }

  private renderConflicts(root: HTMLElement, busy: boolean): void {
    if (this.state.conflicts.length === 0) return;
    const box = el(root, 'div', { cls: 'tablify-sync__conflicts' });
    el(box, 'div', { text: `Conflicts (${this.state.conflicts.length})` });
    for (const item of this.state.conflicts) {
      const row = el(box, 'div', { cls: 'tablify-sync__conflict' });
      const title = item.kind === 'remote_deleted' ? 'Deleted in Airtable, edited here' : 'Changed here and in Airtable';
      el(row, 'div', { text: title });
      const choices: Array<[SyncConflictDecision, string]> = item.kind === 'remote_deleted'
        ? [['keep_local', 'Keep local'], ['keep_remote', 'Remove row']]
        : [['keep_local', 'Keep local'], ['keep_remote', 'Keep remote'], ['keep_both', 'Keep both']];
      for (const [decision, label] of choices) {
        const btn = el(row, 'button', { text: label });
        btn.disabled = busy;
        btn.addEventListener('click', () => void this.resolve(item, decision));
      }
    }
  }

  private renderFields(root: HTMLElement, busy: boolean): void {
    const box = el(root, 'div', { cls: 'tablify-sync__fields' });
    const check = el(box, 'button', { text: 'Check fields to create' });
    check.disabled = busy || !this.deps.token;
    check.addEventListener('click', () => void this.preparePlan());

    const plan = this.state.plan;
    if (!plan) return;
    const list = el(box, 'ul', { cls: 'tablify-sync__plan' });
    for (const item of plan.items) {
      el(list, 'li', { text: `${item.name} (${typeLabel(item.tablifyType)} → ${item.airtableType})` });
    }
    for (const skip of plan.skipped) {
      el(list, 'li', { cls: 'tablify-sync__skipped', text: `${skip.name}: not created (${skip.reason})` });
    }
    const buttons = el(box, 'div', { cls: 'tablify-sync__confirm' });
    // Cancel is the default: it is focused when the list appears, and it is the only action that
    // needs no further step. Creating needs the explicit button below.
    this.cancelButton = el(buttons, 'button', { text: 'Cancel' });
    this.cancelButton.addEventListener('click', () => {
      this.state.plan = null;
      this.render();
    });
    const create = el(buttons, 'button', { text: `Create ${plan.items.length} field(s) in Airtable` });
    create.disabled = busy || plan.items.length === 0;
    create.addEventListener('click', () => void this.createFields());
    this.cancelButton.focus();
  }
}
