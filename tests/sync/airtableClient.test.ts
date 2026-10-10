/**
 * @vitest-environment jsdom
 */
// P7-02 — Airtable client (T-U with mock server; T-S token checks). No network. Fake clock.
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { setRequestUrlHandler } from 'obsidian';
import {
  AirtableClient,
  AirtableError,
  AIRTABLE_DEFAULT_429_WAIT_MS,
  AIRTABLE_MAX_ATTEMPTS,
  AIRTABLE_MIN_INTERVAL_MS,
  AIRTABLE_DOCUMENTED_LIMIT_PER_BASE_PER_SEC,
  retryAfterMs,
  serverBackoffMs,
} from '../../src/sync/airtableClient.js';
import { KeyedRateLimiter } from '../../src/sync/rateLimiter.js';
import { createFakeAirtable, makeTable, type FakeBase, type FakeAirtable } from '../__mocks__/airtableServer.js';

const TOKEN = 'patTESTtoken0123456789.abcdefabcdefabcdefabcdefabcdefabcdefabcdef';
const BASE = 'appTEST000000001';
const TABLE = 'tblTEST000000001';

let t = 0;
const clock = () => t;
const sleep = async (ms: number) => {
  t += ms;
};

function makeBases(count = 5): FakeBase[] {
  const bases: FakeBase[] = [];
  for (let i = 1; i <= count; i++) {
    bases.push({ id: `app${String(i).padStart(14, '0')}`, name: `Base ${i}`, tables: [] });
  }
  bases[0].id = BASE;
  bases[0].tables.push(makeTable(TABLE, 'Tasks', 3));
  return bases;
}

function setup(opts: { pageSize?: number; writeAllowed?: boolean; bases?: FakeBase[] } = {}) {
  const fake: FakeAirtable = createFakeAirtable({
    token: TOKEN,
    bases: opts.bases ?? makeBases(),
    pageSize: opts.pageSize ?? 100,
    writeAllowed: opts.writeAllowed,
    now: clock,
  });
  const client = new AirtableClient({
    token: TOKEN,
    transport: fake.handler,
    clock,
    sleep,
  });
  return { fake, client };
}

beforeEach(() => {
  t = 0;
});

afterEach(() => {
  setRequestUrlHandler(null);
  vi.restoreAllMocks();
});

describe('pagination (T-U)', () => {
  it('lists bases across 3 pages (5 bases at page size 2)', async () => {
    const { fake, client } = setup({ pageSize: 2 });
    const bases = await client.listBases();
    expect(bases.map((b) => b.name)).toEqual(['Base 1', 'Base 2', 'Base 3', 'Base 4', 'Base 5']);
    const pages = fake.requests.filter((r) => r.path === '/v0/meta/bases');
    expect(pages).toHaveLength(3);
    expect(pages[1].query.offset).toBe('2');
    expect(pages[2].query.offset).toBe('4');
  });

  it('lists tables with their fields', async () => {
    const { client } = setup();
    const tables = await client.listTables(BASE);
    expect(tables).toHaveLength(1);
    expect(tables[0].name).toBe('Tasks');
    expect(tables[0].primaryFieldId).toBe('fldName');
    expect(tables[0].fields.map((f) => f.id)).toEqual(['fldName', 'fldNum']);
  });

  it('reads 2,500 records across 25 pages with the right count and sample values', async () => {
    const bases = makeBases();
    bases[0].tables = [makeTable(TABLE, 'Big', 2500)];
    const { fake, client } = setup({ bases });
    const records = await client.listRecords(BASE, TABLE);
    expect(records).toHaveLength(2500);
    expect(records[0].id).toBe('rec000001');
    expect(records[1249].fields.fldNum).toBe(1250 * 3);
    expect(records[2499].id).toBe('rec002500');
    expect(records[2499].fields.fldName).toBe('Row 2500');
    expect(fake.requests.filter((r) => r.path === `/v0/${BASE}/${TABLE}`)).toHaveLength(25);
    // Fields are requested by field ID, so renames do not break mapping.
    expect(fake.requests[0].query.returnFieldsByFieldId).toBe('true');
  });

  it('stops when the server repeats an offset instead of looping forever', async () => {
    const { fake, client } = setup();
    fake.failures.push({ repeatOffset: 'same' }, { repeatOffset: 'same' });
    await expect(client.listBases()).rejects.toMatchObject({ kind: 'bad_response' });
  });
});

describe('writes (batching)', () => {
  it('creates 23 records as batches of 10, 10, 3, and returns them in order', async () => {
    const { fake, client } = setup();
    const writes = Array.from({ length: 23 }, (_, i) => ({ fields: { fldName: `New ${i}` } }));
    const created = await client.createRecords(BASE, TABLE, writes);
    const posts = fake.requests.filter((r) => r.method === 'POST');
    expect(posts.map((p) => (p.body as { records: unknown[] }).records.length)).toEqual([10, 10, 3]);
    expect(created).toHaveLength(23);
    expect(created[0].fields.fldName).toBe('New 0');
    expect(created[22].fields.fldName).toBe('New 22');
  });

  it('updates records by ID', async () => {
    const { fake, client } = setup();
    await client.updateRecords(BASE, TABLE, [{ id: 'rec000001', fields: { fldName: 'Changed' } }]);
    expect(fake.bases[0].tables[0].records[0].fields.fldName).toBe('Changed');
    expect(fake.requests.at(-1)?.method).toBe('PATCH');
  });

  it('rejects an update without a record ID before any request is sent', async () => {
    const { fake, client } = setup();
    await expect(client.updateRecords(BASE, TABLE, [{ fields: {} }])).rejects.toMatchObject({ kind: 'bad_request' });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('rate limiting', () => {
  it('spaces requests for one base at least the minimum interval apart', async () => {
    const { fake, client } = setup({ pageSize: 1 });
    await client.listRecords(BASE, TABLE); // 3 records, page size 1 → 3 requests
    const times = fake.requests.filter((r) => r.path === `/v0/${BASE}/${TABLE}`).map((r) => r.at);
    expect(times.length).toBeGreaterThan(1);
    for (let i = 1; i < times.length; i++) {
      expect(times[i] - times[i - 1]).toBeGreaterThanOrEqual(AIRTABLE_MIN_INTERVAL_MS);
    }
  });

  it('never exceeds the documented limit of 5 requests per second in any 1 s window', async () => {
    const bases = makeBases();
    bases[0].tables = [makeTable(TABLE, 'Big', 2500)];
    const { fake, client } = setup({ bases });
    await client.listRecords(BASE, TABLE); // 25 pages back to back
    const times = fake.requests.map((r) => r.at).sort((a, b) => a - b);
    let worst = 0;
    for (let i = 0; i < times.length; i++) {
      let count = 0;
      for (let j = i; j < times.length && times[j] - times[i] < 1000; j++) count++;
      worst = Math.max(worst, count);
    }
    expect(worst).toBeLessThanOrEqual(AIRTABLE_DOCUMENTED_LIMIT_PER_BASE_PER_SEC);
    expect(AIRTABLE_MIN_INTERVAL_MS).toBeGreaterThan(0);
    // Test log for the evidence file.
    console.info(`[P7-02] 25 pages: worst requests in any 1 s window = ${worst} (limit ${AIRTABLE_DOCUMENTED_LIMIT_PER_BASE_PER_SEC})`);
  });
});

describe('429 and 5xx retry (T-U)', () => {
  it('retries a 429 that carries Retry-After and then succeeds', async () => {
    const { fake, client } = setup();
    fake.failures.push({ status: 429, headers: { 'retry-after': '2' } });
    const bases = await client.listBases();
    expect(bases).toHaveLength(5);
    const hits = fake.requests.filter((r) => r.path === '/v0/meta/bases');
    expect(hits).toHaveLength(2);
    expect(hits[1].at - hits[0].at).toBeGreaterThanOrEqual(2000);
  });

  it('waits the default 30 s after a 429 with no Retry-After', async () => {
    const { fake, client } = setup();
    fake.failures.push({ status: 429 });
    await client.listBases();
    const hits = fake.requests.filter((r) => r.path === '/v0/meta/bases');
    expect(hits[1].at - hits[0].at).toBeGreaterThanOrEqual(AIRTABLE_DEFAULT_429_WAIT_MS);
  });

  it('gives up after the capped number of attempts with a rate-limit error', async () => {
    const { fake, client } = setup();
    for (let i = 0; i < AIRTABLE_MAX_ATTEMPTS; i++) fake.failures.push({ status: 429, headers: { 'retry-after': '1' } });
    const err = await client.listBases().catch((e: unknown) => e);
    expect(err).toBeInstanceOf(AirtableError);
    expect(err).toMatchObject({ kind: 'rate_limited', status: 429, attempts: AIRTABLE_MAX_ATTEMPTS });
    expect(fake.requests.filter((r) => r.path === '/v0/meta/bases')).toHaveLength(AIRTABLE_MAX_ATTEMPTS);
  });

  it('retries a 503 with backoff and then succeeds', async () => {
    const { fake, client } = setup();
    fake.failures.push({ status: 503 }, { status: 502 });
    const bases = await client.listBases();
    expect(bases).toHaveLength(5);
    const hits = fake.requests.filter((r) => r.path === '/v0/meta/bases');
    expect(hits).toHaveLength(3);
    expect(hits[1].at - hits[0].at).toBeGreaterThanOrEqual(serverBackoffMs(1));
    expect(hits[2].at - hits[1].at).toBeGreaterThanOrEqual(serverBackoffMs(2));
  });

  it('reports a server error after the capped attempts', async () => {
    const { fake, client } = setup();
    for (let i = 0; i < AIRTABLE_MAX_ATTEMPTS; i++) fake.failures.push({ status: 500 });
    await expect(client.listBases()).rejects.toMatchObject({ kind: 'server', status: 500, attempts: AIRTABLE_MAX_ATTEMPTS });
  });

  it('retries a network error and then succeeds', async () => {
    const { fake, client } = setup();
    fake.failures.push({ networkError: true });
    const bases = await client.listBases();
    expect(bases).toHaveLength(5);
  });

  it('reports a network error after the capped attempts', async () => {
    const { fake, client } = setup();
    for (let i = 0; i < AIRTABLE_MAX_ATTEMPTS; i++) fake.failures.push({ networkError: true });
    await expect(client.listBases()).rejects.toMatchObject({ kind: 'network', status: null });
  });
});

describe('HTTP error mapping (T-U)', () => {
  it('401 bad token: unauthorized, no retry', async () => {
    const fake = createFakeAirtable({ token: 'other', bases: makeBases(), now: clock });
    const client = new AirtableClient({ token: TOKEN, transport: fake.handler, clock, sleep });
    const err = await client.listBases().catch((e: unknown) => e as AirtableError);
    expect(err).toMatchObject({ kind: 'unauthorized', status: 401, attempts: 1 });
    expect(fake.requests).toHaveLength(1);
    expect(err.message).toMatch(/token/i);
  });

  it('403 on write (missing scope): forbidden with a scope hint, no retry', async () => {
    const { fake, client } = setup({ writeAllowed: false });
    const err = await client
      .createRecords(BASE, TABLE, [{ fields: { fldName: 'x' } }])
      .catch((e: unknown) => e as AirtableError);
    expect(err).toMatchObject({ kind: 'forbidden', status: 403, attempts: 1 });
    expect(err.message).toMatch(/scope/i);
    expect(fake.requests.filter((r) => r.method === 'POST')).toHaveLength(1);
  });

  it('404 unknown table: not_found', async () => {
    const { client } = setup();
    await expect(client.listRecords(BASE, 'tblMISSING0001')).rejects.toMatchObject({ kind: 'not_found', status: 404 });
  });

  it('a 200 with a non-JSON body: bad_response', async () => {
    const { fake, client } = setup();
    fake.failures.push({ badBody: true });
    await expect(client.listBases()).rejects.toMatchObject({ kind: 'bad_response' });
  });

  it('a malformed base ID is rejected before any request is sent', async () => {
    const { fake, client } = setup();
    await expect(client.listTables('base-not-valid')).rejects.toMatchObject({ kind: 'bad_request' });
    expect(fake.requests).toHaveLength(0);
  });
});

describe('token safety (T-S)', () => {
  it('never puts the token in an error message, for any error kind', async () => {
    const messages: string[] = [];
    const scenarios: Array<() => Promise<unknown>> = [];
    const kinds: Array<{ failures: Parameters<FakeAirtable['failures']['push']>[0][] }> = [
      { failures: [{ status: 401 }] },
      { failures: [{ status: 403 }] },
      { failures: [{ status: 404 }] },
      { failures: [{ status: 429 }, { status: 429 }, { status: 429 }, { status: 429 }] },
      { failures: [{ status: 500 }, { status: 500 }, { status: 500 }, { status: 500 }] },
      { failures: [{ networkError: true }, { networkError: true }, { networkError: true }, { networkError: true }] },
      { failures: [{ badBody: true }] },
    ];
    for (const k of kinds) {
      scenarios.push(async () => {
        const { fake, client } = setup();
        fake.failures.push(...k.failures);
        return client.listBases();
      });
    }
    for (const run of scenarios) {
      const err = await run().catch((e: unknown) => e);
      expect(err).toBeInstanceOf(Error);
      messages.push((err as Error).message, String((err as Error).stack ?? ''), String(err));
    }
    expect(messages.length).toBeGreaterThan(0);
    for (const m of messages) {
      expect(m).not.toContain(TOKEN);
      expect(m).not.toContain('patTEST');
      expect(m).not.toContain('Bearer');
    }
  });

  it('never writes the token to console output during a failing sync', async () => {
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(console, 'debug').mockImplementation(() => undefined),
    ];
    const { fake, client } = setup();
    fake.failures.push({ status: 429, headers: { 'retry-after': '1' } }, { status: 503 });
    await client.listBases();
    for (const spy of spies) {
      for (const call of spy.mock.calls) expect(JSON.stringify(call)).not.toContain(TOKEN);
    }
  });

  it('refuses to construct a client without a token', () => {
    expect(() => new AirtableClient({ token: '' })).toThrow(AirtableError);
  });
});

describe('production transport uses requestUrl (T-U)', () => {
  it('routes calls through obsidian requestUrl when no transport is injected', async () => {
    const fake = createFakeAirtable({ token: TOKEN, bases: makeBases(), now: clock });
    setRequestUrlHandler(fake.handler);
    const client = new AirtableClient({ token: TOKEN, clock, sleep });
    const bases = await client.listBases();
    expect(bases).toHaveLength(5);
    expect(fake.requests).toHaveLength(1);
  });
});

describe('helpers', () => {
  it('retryAfterMs reads seconds, falls back to 30 s, and caps at 60 s', () => {
    expect(retryAfterMs({ 'retry-after': '3' })).toBe(3000);
    expect(retryAfterMs({ 'Retry-After': '5' })).toBe(5000);
    expect(retryAfterMs({})).toBe(AIRTABLE_DEFAULT_429_WAIT_MS);
    expect(retryAfterMs({ 'retry-after': 'soon' })).toBe(AIRTABLE_DEFAULT_429_WAIT_MS);
    expect(retryAfterMs({ 'retry-after': '3600' })).toBe(60_000);
  });

  it('serverBackoffMs doubles and caps at 8 s', () => {
    expect([1, 2, 3, 4, 5].map(serverBackoffMs)).toEqual([1000, 2000, 4000, 8000, 8000]);
  });
});

describe('KeyedRateLimiter', () => {
  it('runs tasks for one key in order, with spacing', async () => {
    const order: number[] = [];
    const rl = new KeyedRateLimiter(100, clock, sleep);
    const runs = [1, 2, 3].map((n) =>
      rl.schedule('k', async () => {
        order.push(n);
        return n;
      }),
    );
    await expect(Promise.all(runs)).resolves.toEqual([1, 2, 3]);
    expect(order).toEqual([1, 2, 3]);
  });

  it('a failing task does not block the queue', async () => {
    const rl = new KeyedRateLimiter(0, clock, sleep);
    const bad = rl.schedule('k', async () => {
      throw new Error('boom');
    });
    const good = rl.schedule('k', async () => 'ok');
    await expect(bad).rejects.toThrow('boom');
    await expect(good).resolves.toBe('ok');
  });

  it('penalize holds later requests for the given time', async () => {
    const starts: number[] = [];
    const rl = new KeyedRateLimiter(0, clock, sleep);
    rl.penalize('k', 5000);
    await rl.schedule('k', async () => {
      starts.push(t);
    });
    expect(starts[0]).toBeGreaterThanOrEqual(5000);
  });

  it('rejects an invalid interval', () => {
    expect(() => new KeyedRateLimiter(-1)).toThrow(RangeError);
  });
});
