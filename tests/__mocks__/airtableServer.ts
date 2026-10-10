/**
 * In-memory fake of the Airtable Web API, served through the requestUrl test handler.
 *
 * Used by P7-02 (and later P7-06..P7-09) tests. It never touches the network.
 *
 * - Checks the bearer token. A wrong token gets 401.
 * - `writeAllowed: false` simulates a token without write scope (403 on POST/PATCH).
 * - `failures` is a queue of scripted responses, consumed before normal routing.
 * - `pageSize` (default 100) controls offset pagination, so tests can produce many pages.
 * - Every request is logged with the injected clock time, for rate-limit assertions.
 */

import type { RequestUrlParam, RequestUrlResponse } from 'obsidian';

export interface FakeRecord {
  id: string;
  createdTime: string;
  fields: Record<string, unknown>;
}

export interface FakeTable {
  id: string;
  name: string;
  primaryFieldId: string;
  fields: { id: string; name: string; type: string }[];
  records: FakeRecord[];
}

export interface FakeBase {
  id: string;
  name: string;
  tables: FakeTable[];
}

export interface ScriptedFailure {
  status?: number;
  headers?: Record<string, string>;
  /** Throw a network error instead of answering. */
  networkError?: boolean;
  /** Return a non-JSON body with status 200. */
  badBody?: boolean;
  /** Return this offset in the next list page (for the repeated-offset test). */
  repeatOffset?: string;
}

export interface LoggedRequest {
  method: string;
  path: string;
  query: Record<string, string>;
  at: number;
  body: unknown;
}

export interface FakeAirtableOptions {
  token: string;
  bases: FakeBase[];
  pageSize?: number;
  writeAllowed?: boolean;
  now?: () => number;
}

export interface FakeAirtable {
  handler: (param: RequestUrlParam) => Promise<RequestUrlResponse>;
  requests: LoggedRequest[];
  failures: ScriptedFailure[];
  bases: FakeBase[];
}

function jsonResponse(status: number, body: unknown, headers: Record<string, string> = {}): RequestUrlResponse {
  const text = JSON.stringify(body);
  return {
    status,
    headers: { 'content-type': 'application/json', ...headers },
    arrayBuffer: new ArrayBuffer(0),
    json: body,
    text,
  };
}

function rawResponse(status: number, text: string): RequestUrlResponse {
  return {
    status,
    headers: {},
    arrayBuffer: new ArrayBuffer(0),
    get json(): unknown {
      throw new SyntaxError('Unexpected token in JSON');
    },
    text,
  };
}

export function createFakeAirtable(options: FakeAirtableOptions): FakeAirtable {
  const pageSize = options.pageSize ?? 100;
  const writeAllowed = options.writeAllowed ?? true;
  const now = options.now ?? (() => 0);
  const state: FakeAirtable = {
    handler: async () => jsonResponse(500, {}),
    requests: [],
    failures: [],
    bases: options.bases,
  };

  state.handler = async (param: RequestUrlParam): Promise<RequestUrlResponse> => {
    const url = new URL(param.url);
    const method = (param.method ?? 'GET').toUpperCase();
    const query: Record<string, string> = {};
    url.searchParams.forEach((v, k) => {
      query[k] = v;
    });
    let body: unknown = undefined;
    if (typeof param.body === 'string') {
      try {
        body = JSON.parse(param.body);
      } catch {
        body = param.body;
      }
    }
    state.requests.push({ method, path: url.pathname, query, at: now(), body });

    const scripted = state.failures.shift();
    if (scripted) {
      if (scripted.networkError) throw new Error('socket hang up (fake network error)');
      if (scripted.badBody) return rawResponse(200, '<html>not json</html>');
      if (scripted.status !== undefined && scripted.status !== 200) {
        return jsonResponse(scripted.status, { error: { type: 'SCRIPTED', message: 'scripted' } }, scripted.headers ?? {});
      }
      if (scripted.repeatOffset !== undefined) {
        // An empty page that always points at the same next offset.
        return jsonResponse(200, { bases: [], offset: scripted.repeatOffset });
      }
    }

    if (param.headers?.Authorization !== 'Bearer ' + options.token) {
      return jsonResponse(401, { error: { type: 'AUTHENTICATION_REQUIRED', message: 'Invalid token' } });
    }

    if (method === 'GET' && url.pathname === '/v0/meta/bases') {
      return paginate(
        state.bases.map((b) => ({ id: b.id, name: b.name, permissionLevel: 'create' })),
        'bases',
        query,
        pageSize,
      );
    }

    const tablesMatch = /^\/v0\/meta\/bases\/(app[A-Za-z0-9]+)\/tables$/.exec(url.pathname);
    if (method === 'GET' && tablesMatch) {
      const base = state.bases.find((b) => b.id === tablesMatch[1]);
      if (!base) return jsonResponse(404, { error: { type: 'NOT_FOUND' } });
      return jsonResponse(200, {
        tables: base.tables.map((t) => ({
          id: t.id,
          name: t.name,
          primaryFieldId: t.primaryFieldId,
          fields: t.fields,
        })),
      });
    }

    const recordsMatch = /^\/v0\/(app[A-Za-z0-9]+)\/(tbl[A-Za-z0-9]+)$/.exec(url.pathname);
    if (recordsMatch) {
      const base = state.bases.find((b) => b.id === recordsMatch[1]);
      const table = base?.tables.find((t) => t.id === recordsMatch[2]);
      if (!base || !table) return jsonResponse(404, { error: { type: 'NOT_FOUND' } });

      if (method === 'GET') {
        return paginate(
          table.records.map((r) => ({ id: r.id, createdTime: r.createdTime, fields: r.fields })),
          'records',
          query,
          Math.min(Number(query.pageSize ?? pageSize), pageSize),
        );
      }

      if (method === 'POST' || method === 'PATCH') {
        if (!writeAllowed) {
          return jsonResponse(403, { error: { type: 'INVALID_PERMISSIONS', message: 'missing scope' } });
        }
        const incoming = (body as { records?: { id?: string; fields: Record<string, unknown> }[] } | undefined)?.records ?? [];
        if (incoming.length > 10) {
          return jsonResponse(422, { error: { type: 'TOO_MANY_RECORDS' } });
        }
        const out: FakeRecord[] = [];
        for (const r of incoming) {
          if (method === 'POST') {
            const created: FakeRecord = {
              id: 'rec' + String(table.records.length + 1).padStart(6, '0'),
              createdTime: '2026-10-10T00:00:00.000Z',
              fields: { ...r.fields },
            };
            table.records.push(created);
            out.push(created);
          } else {
            const existing = table.records.find((x) => x.id === r.id);
            if (!existing) return jsonResponse(404, { error: { type: 'NOT_FOUND' } });
            existing.fields = { ...existing.fields, ...r.fields };
            out.push(existing);
          }
        }
        return jsonResponse(200, { records: out });
      }
    }

    return jsonResponse(404, { error: { type: 'NOT_FOUND' } });
  };

  function paginate(
    items: unknown[],
    key: string,
    query: Record<string, string>,
    size: number,
  ): RequestUrlResponse {
    const start = query.offset ? Number(query.offset) : 0;
    const page = items.slice(start, start + size);
    const next = start + size < items.length ? String(start + size) : undefined;
    const body: Record<string, unknown> = { [key]: page };
    if (next !== undefined) body.offset = next;
    return jsonResponse(200, body);
  }

  return state;
}

/** Builds a table with `count` records named rec000001.. and fields keyed by field ID. */
export function makeTable(id: string, name: string, count: number): FakeTable {
  const records: FakeRecord[] = [];
  for (let i = 1; i <= count; i++) {
    records.push({
      id: 'rec' + String(i).padStart(6, '0'),
      createdTime: '2026-10-09T00:00:00.000Z',
      fields: { fldName: `Row ${i}`, fldNum: i * 3 },
    });
  }
  return {
    id,
    name,
    primaryFieldId: 'fldName',
    fields: [
      { id: 'fldName', name: 'Name', type: 'singleLineText' },
      { id: 'fldNum', name: 'Score', type: 'number' },
    ],
    records,
  };
}
