// P7-02 — Airtable API client (v1.1).
//
// Rules (spec/steps/P7-02.md):
//  - Every call goes through Obsidian's requestUrl, never fetch.
//  - Pagination follows offsets until the API stops returning one.
//  - Requests are queued per base and spaced below the documented limit.
//  - 429 and 5xx responses retry a capped number of times. Other errors do not retry.
//  - HTTP errors become AirtableError with a fixed, user-facing message. The message never
//    includes the token, the URL, or the response body.

import { requestUrl, type RequestUrlParam, type RequestUrlResponse } from 'obsidian';
import { KeyedRateLimiter, defaultClock, defaultSleep, type Clock, type Sleep } from './rateLimiter.js';

/**
 * Documented limit (checked 2026-10-10, airtable.com/developers/web/api/rate-limits):
 * 5 requests per second per base; 50 requests per second per personal access token.
 */
export const AIRTABLE_DOCUMENTED_LIMIT_PER_BASE_PER_SEC = 5;
/** Our spacing: 4 requests per second per base, below the documented 5. */
export const AIRTABLE_MIN_INTERVAL_MS = 250;
/** Airtable asks for a 30 s wait after a 429. Used when Retry-After is absent. */
export const AIRTABLE_DEFAULT_429_WAIT_MS = 30_000;
/** Upper bound for any single wait, so a bad header cannot stall the queue. */
export const AIRTABLE_MAX_WAIT_MS = 60_000;
/** Total attempts per request (1 try + 3 retries). */
export const AIRTABLE_MAX_ATTEMPTS = 4;
export const AIRTABLE_PAGE_SIZE = 100;
/** Documented write batch limit for create and update records. */
export const AIRTABLE_WRITE_BATCH = 10;
/** Safety cap on pages for one listing. 10,000 pages means 1,000,000 records. */
export const AIRTABLE_MAX_PAGES = 10_000;

const API_ORIGIN = 'https://api.airtable.com';
const ACCOUNT_KEY = '__account__';

export type AirtableErrorKind =
  | 'unauthorized'
  | 'forbidden'
  | 'not_found'
  | 'rate_limited'
  | 'server'
  | 'network'
  | 'bad_request'
  | 'bad_response';

/** Error with a fixed, user-facing message. It never carries the token or response body. */
export class AirtableError extends Error {
  readonly kind: AirtableErrorKind;
  readonly status: number | null;
  readonly attempts: number;

  constructor(kind: AirtableErrorKind, status: number | null, attempts: number, message: string) {
    super(message);
    this.name = 'AirtableError';
    this.kind = kind;
    this.status = status;
    this.attempts = attempts;
  }
}

export type Transport = (param: RequestUrlParam) => Promise<RequestUrlResponse>;

export interface AirtableClientOptions {
  token: string;
  transport?: Transport;
  clock?: Clock;
  sleep?: Sleep;
  minIntervalMs?: number;
}

export interface AirtableBase {
  id: string;
  name: string;
  permissionLevel: string;
}

export interface AirtableFieldSchema {
  id: string;
  name: string;
  type: string;
  options?: unknown;
}

export interface AirtableTableSchema {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: AirtableFieldSchema[];
}

export interface AirtableRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface AirtableRecordWrite {
  /** Required for update, absent for create. */
  id?: string;
  fields: Record<string, unknown>;
}

const BASE_ID = /^app[A-Za-z0-9]+$/;
const TABLE_ID = /^tbl[A-Za-z0-9]+$/;
const RECORD_ID = /^rec[A-Za-z0-9]+$/;

function transportDefault(param: RequestUrlParam): Promise<RequestUrlResponse> {
  return requestUrl(param);
}

function headerValue(headers: Record<string, string> | undefined, name: string): string | null {
  if (!headers) return null;
  const wanted = name.toLowerCase();
  for (const [key, value] of Object.entries(headers)) {
    if (key.toLowerCase() === wanted) return value;
  }
  return null;
}

/** Retry-After in seconds (the form Airtable sends), converted to ms and capped. */
export function retryAfterMs(headers: Record<string, string> | undefined): number {
  const raw = headerValue(headers, 'retry-after');
  if (raw === null) return AIRTABLE_DEFAULT_429_WAIT_MS;
  const seconds = Number(raw);
  if (!Number.isFinite(seconds) || seconds < 0) return AIRTABLE_DEFAULT_429_WAIT_MS;
  return Math.min(Math.round(seconds * 1000), AIRTABLE_MAX_WAIT_MS);
}

/** Backoff for 5xx and network errors: 1 s, 2 s, 4 s, capped at 8 s. */
export function serverBackoffMs(attempt: number): number {
  return Math.min(1000 * 2 ** (attempt - 1), 8000);
}

function requireId(value: string, pattern: RegExp, label: string): string {
  if (!pattern.test(value)) {
    throw new AirtableError('bad_request', null, 0, `Invalid ${label} ID. Check the ID in the sync settings.`);
  }
  return value;
}

function messageFor(status: number, attempts: number): { kind: AirtableErrorKind; message: string } {
  if (status === 401) {
    return {
      kind: 'unauthorized',
      message: 'Airtable did not accept the token (HTTP 401). Check the token in Tablify settings.',
    };
  }
  if (status === 403) {
    return {
      kind: 'forbidden',
      message:
        'Airtable denied access (HTTP 403). The token may lack a required scope or access to this base. Check the token scopes and base access.',
    };
  }
  if (status === 404) {
    return {
      kind: 'not_found',
      message:
        'Airtable could not find that base or table (HTTP 404). Check the base and table, and that the token can access them.',
    };
  }
  if (status === 429) {
    return {
      kind: 'rate_limited',
      message: `Airtable rate limit still exceeded after ${attempts} attempts (HTTP 429). Try again in a minute.`,
    };
  }
  if (status >= 500) {
    return {
      kind: 'server',
      message: `Airtable had a server error (HTTP ${status}) after ${attempts} attempts. Try again later.`,
    };
  }
  return {
    kind: 'bad_request',
    message: `Airtable rejected the request (HTTP ${status}).`,
  };
}

export class AirtableClient {
  private readonly token: string;
  private readonly transport: Transport;
  private readonly limiter: KeyedRateLimiter;

  constructor(options: AirtableClientOptions) {
    if (!options.token || typeof options.token !== 'string') {
      throw new AirtableError('unauthorized', null, 0, 'No Airtable token is set. Add the token in Tablify settings.');
    }
    this.token = options.token;
    this.transport = options.transport ?? transportDefault;
    this.limiter = new KeyedRateLimiter(
      options.minIntervalMs ?? AIRTABLE_MIN_INTERVAL_MS,
      options.clock ?? defaultClock,
      options.sleep ?? defaultSleep,
    );
  }

  /** Lists every base the token can see (all pages). */
  async listBases(): Promise<AirtableBase[]> {
    const bases: AirtableBase[] = [];
    await this.paginate(
      ACCOUNT_KEY,
      '/v0/meta/bases',
      {},
      (body) => {
        for (const item of asArray(body, 'bases')) bases.push(toBase(item));
      },
    );
    return bases;
  }

  /** Lists tables and their fields for one base. */
  async listTables(baseId: string): Promise<AirtableTableSchema[]> {
    const base = requireId(baseId, BASE_ID, 'base');
    const body = await this.send(base, 'GET', `/v0/meta/bases/${base}/tables`);
    return asArray(body, 'tables').map(toTable);
  }

  /** Reads every record of a table. Fields are keyed by field ID, which survives renames. */
  async listRecords(baseId: string, tableId: string): Promise<AirtableRecord[]> {
    const base = requireId(baseId, BASE_ID, 'base');
    const table = requireId(tableId, TABLE_ID, 'table');
    const records: AirtableRecord[] = [];
    await this.paginate(
      base,
      `/v0/${base}/${table}`,
      { pageSize: String(AIRTABLE_PAGE_SIZE), returnFieldsByFieldId: 'true' },
      (body) => {
        for (const item of asArray(body, 'records')) records.push(toRecord(item));
      },
    );
    return records;
  }

  /** Creates records in batches of AIRTABLE_WRITE_BATCH. Returns the created records in order. */
  async createRecords(baseId: string, tableId: string, records: AirtableRecordWrite[]): Promise<AirtableRecord[]> {
    return this.writeBatches(baseId, tableId, records, 'POST');
  }

  /** Updates records in batches of AIRTABLE_WRITE_BATCH. Every write needs an `id`. */
  async updateRecords(baseId: string, tableId: string, records: AirtableRecordWrite[]): Promise<AirtableRecord[]> {
    for (const r of records) {
      if (!r.id || !RECORD_ID.test(r.id)) {
        throw new AirtableError('bad_request', null, 0, 'A record update needs a valid record ID.');
      }
    }
    return this.writeBatches(baseId, tableId, records, 'PATCH');
  }

  /**
   * Creates one field (P7-09). Needs schema.bases:write. The caller must have shown the user the
   * exact field list and got explicit confirmation first.
   */
  async createField(baseId: string, tableId: string, spec: { name: string; type: string; options?: unknown }): Promise<AirtableFieldSchema> {
    const base = requireId(baseId, BASE_ID, 'base');
    const table = requireId(tableId, TABLE_ID, 'table');
    const body = await this.send(base, 'POST', `/v0/meta/bases/${base}/tables/${table}/fields`, undefined, {
      name: spec.name,
      type: spec.type,
      ...(spec.options === undefined ? {} : { options: spec.options }),
    });
    const created = body as { id?: unknown; name?: unknown; type?: unknown } | null;
    if (!created || typeof created.id !== 'string' || typeof created.type !== 'string') {
      throw new AirtableError('bad_response', null, 1, 'Airtable returned an unexpected field response.');
    }
    return { id: created.id, name: typeof created.name === 'string' ? created.name : spec.name, type: created.type };
  }

  private async writeBatches(
    baseId: string,
    tableId: string,
    records: AirtableRecordWrite[],
    method: 'POST' | 'PATCH',
  ): Promise<AirtableRecord[]> {
    const base = requireId(baseId, BASE_ID, 'base');
    const table = requireId(tableId, TABLE_ID, 'table');
    const out: AirtableRecord[] = [];
    for (let i = 0; i < records.length; i += AIRTABLE_WRITE_BATCH) {
      const batch = records.slice(i, i + AIRTABLE_WRITE_BATCH);
      const body = await this.send(base, method, `/v0/${base}/${table}`, undefined, {
        records: batch,
        typecast: false,
        returnFieldsByFieldId: true,
      });
      for (const item of asArray(body, 'records')) out.push(toRecord(item));
    }
    return out;
  }

  /** Follows offsets until none is returned. Stops on a repeated offset so a bad server cannot loop forever. */
  private async paginate(
    key: string,
    path: string,
    query: Record<string, string>,
    onPage: (body: unknown) => void,
  ): Promise<void> {
    const seen = new Set<string>();
    let offset: string | null = null;
    for (let page = 0; page < AIRTABLE_MAX_PAGES; page++) {
      const params: Record<string, string> = { ...query };
      if (offset !== null) params.offset = offset;
      const body = await this.send(key, 'GET', path, params);
      onPage(body);
      const next = (body as { offset?: unknown } | null)?.offset;
      if (next === undefined || next === null || next === '') return;
      if (typeof next !== 'string' || seen.has(next)) {
        throw new AirtableError('bad_response', null, 1, 'Airtable returned an unexpected page offset.');
      }
      seen.add(next);
      offset = next;
    }
    throw new AirtableError('bad_response', null, 1, 'Airtable returned more pages than Tablify can read.');
  }

  /**
   * One logical request, queued under `key`. Retries 429 and 5xx responses and network
   * errors, up to AIRTABLE_MAX_ATTEMPTS. Other errors are thrown at once.
   */
  private async send(
    key: string,
    method: 'GET' | 'POST' | 'PATCH',
    path: string,
    query?: Record<string, string>,
    jsonBody?: unknown,
  ): Promise<unknown> {
    let url = API_ORIGIN + path;
    if (query && Object.keys(query).length > 0) {
      const search = new URLSearchParams(query).toString();
      url += '?' + search;
    }
    const headers: Record<string, string> = {
      Authorization: 'Bearer ' + this.token,
      Accept: 'application/json',
    };
    const param: RequestUrlParam = { url, method, headers, throw: false };
    if (jsonBody !== undefined) {
      param.contentType = 'application/json';
      param.body = JSON.stringify(jsonBody);
    }

    for (let attempt = 1; ; attempt++) {
      let res: RequestUrlResponse;
      try {
        res = await this.limiter.schedule(key, () => this.transport(param));
      } catch {
        // The thrown error is dropped on purpose: it may contain the URL or headers.
        if (attempt < AIRTABLE_MAX_ATTEMPTS) {
          const wait = serverBackoffMs(attempt);
          this.limiter.penalize(key, wait);
          continue;
        }
        throw new AirtableError('network', null, attempt, 'Could not reach Airtable. Check the network connection and try again.');
      }

      const status = res.status;
      if (status >= 200 && status < 300) {
        return parseBody(res);
      }

      if (status === 429 && attempt < AIRTABLE_MAX_ATTEMPTS) {
        this.limiter.penalize(key, retryAfterMs(res.headers));
        continue;
      }
      if (status >= 500 && attempt < AIRTABLE_MAX_ATTEMPTS) {
        this.limiter.penalize(key, serverBackoffMs(attempt));
        continue;
      }

      const mapped = messageFor(status, attempt);
      throw new AirtableError(mapped.kind, status, attempt, mapped.message);
    }
  }
}

function parseBody(res: RequestUrlResponse): unknown {
  try {
    const body: unknown = res.json;
    if (body === undefined || body === null || typeof body !== 'object') {
      throw new Error('not an object');
    }
    return body;
  } catch {
    throw new AirtableError('bad_response', res.status, 1, 'Airtable returned an unexpected response.');
  }
}

function asArray(body: unknown, key: string): Record<string, unknown>[] {
  const value = (body as Record<string, unknown> | null)?.[key];
  if (!Array.isArray(value)) {
    throw new AirtableError('bad_response', null, 1, 'Airtable returned an unexpected response.');
  }
  for (const item of value) {
    if (item === null || typeof item !== 'object') {
      throw new AirtableError('bad_response', null, 1, 'Airtable returned an unexpected response.');
    }
  }
  return value as Record<string, unknown>[];
}

function str(item: Record<string, unknown>, key: string): string {
  const v = item[key];
  if (typeof v !== 'string') {
    throw new AirtableError('bad_response', null, 1, 'Airtable returned an unexpected response.');
  }
  return v;
}

function toBase(item: Record<string, unknown>): AirtableBase {
  return {
    id: str(item, 'id'),
    name: str(item, 'name'),
    permissionLevel: typeof item.permissionLevel === 'string' ? item.permissionLevel : '',
  };
}

function toTable(item: Record<string, unknown>): AirtableTableSchema {
  const fields = Array.isArray(item.fields) ? item.fields : [];
  return {
    id: str(item, 'id'),
    name: str(item, 'name'),
    primaryFieldId: str(item, 'primaryFieldId'),
    fields: fields.map((f) => {
      const field = f as Record<string, unknown>;
      return { id: str(field, 'id'), name: str(field, 'name'), type: str(field, 'type'), options: field.options };
    }),
  };
}

function toRecord(item: Record<string, unknown>): AirtableRecord {
  const fields = item.fields;
  return {
    id: str(item, 'id'),
    createdTime: typeof item.createdTime === 'string' ? item.createdTime : '',
    fields: fields && typeof fields === 'object' ? (fields as Record<string, unknown>) : {},
  };
}
