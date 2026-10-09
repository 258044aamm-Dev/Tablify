import type { FieldDefinition, Row } from '../../src/model/types.js';

// Seeded PRNG mulberry32
export function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return function () {
    t += 0x6d2b79f5;
    let r = Math.imul(t ^ (t >>> 15), t | 1);
    r ^= r + Math.imul(r ^ (r >>> 7), r | 61);
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

export function randomInt(rand: () => number, min: number, max: number): number {
  return Math.floor(rand() * (max - min + 1)) + min;
}

export function randomChoice<T>(rand: () => number, arr: readonly T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}

// Fixed small table for hand-written tests (5 rows)
export const HAND_FIELDS: FieldDefinition[] = [
  { id: 'fld_name', name: 'Name', type: 'text', primary: true },
  { id: 'fld_status', name: 'Status', type: 'single_select', options: [{ id: 'opt_todo', name: 'Todo', color: 'gray' }, { id: 'opt_done', name: 'Done', color: 'green' }] },
  { id: 'fld_score', name: 'Score', type: 'number' },
  { id: 'fld_due', name: 'Due', type: 'date' },
  { id: 'fld_tags', name: 'Tags', type: 'multi_select', options: [{ id: 'opt_urgent', name: 'urgent', color: 'red' }, { id: 'opt_backlog', name: 'backlog', color: 'blue' }] },
  { id: 'fld_active', name: 'Active', type: 'checkbox' },
  { id: 'fld_notes', name: 'Notes', type: 'long_text' },
];

export const HAND_ROWS: Row[] = [
  { id: 'row_1', rev: 1, updatedAt: '2026-10-09T10:00:00Z', values: { fld_name: 'Alice ship', fld_status: 'opt_done', fld_score: 5, fld_due: '2026-01-10', fld_tags: ['opt_urgent'], fld_active: true, fld_notes: 'hello world' }, sync: null },
  { id: 'row_2', rev: 1, updatedAt: '2026-10-09T10:00:00Z', values: { fld_name: 'Bob', fld_status: 'opt_todo', fld_score: 10, fld_due: '2026-02-10', fld_tags: ['opt_backlog'], fld_active: false, fld_notes: '' }, sync: null },
  { id: 'row_3', rev: 1, updatedAt: '2026-10-09T10:00:00Z', values: { fld_name: 'Charlie boat', fld_status: 'opt_todo', fld_score: 3, fld_due: '2026-01-20', fld_tags: ['opt_urgent', 'opt_backlog'], fld_active: true, fld_notes: 'ship' }, sync: null },
  { id: 'row_4', rev: 1, updatedAt: '2026-10-09T10:00:00Z', values: { fld_name: 'Dana ship', fld_status: 'opt_done', fld_score: 8, fld_due: '2026-03-01', fld_tags: [], fld_active: true, fld_notes: 'world' }, sync: null },
  { id: 'row_5', rev: 1, updatedAt: '2026-10-09T10:00:00Z', values: { fld_name: 'Eve', fld_status: 'opt_todo', fld_score: 7, fld_due: '2026-01-05', fld_tags: [], fld_active: null as unknown as boolean, fld_notes: null as unknown as string }, sync: null },
];

// FX-M generator (12 columns, 1k rows) — deterministic
export function generateFXM(seed = 42): { fields: FieldDefinition[]; rows: Row[] } {
  const rand = mulberry32(seed);
  const fields: FieldDefinition[] = [
    { id: 'fld_name', name: 'Name', type: 'text', primary: true },
    { id: 'fld_notes', name: 'Notes', type: 'long_text' },
    { id: 'fld_count', name: 'Count', type: 'number' },
    { id: 'fld_price', name: 'Price', type: 'currency' },
    { id: 'fld_pct', name: 'Pct', type: 'percent' },
    { id: 'fld_active', name: 'Active', type: 'checkbox' },
    { id: 'fld_due', name: 'Due', type: 'date' },
    { id: 'fld_created', name: 'Created', type: 'date_time' },
    { id: 'fld_status', name: 'Status', type: 'single_select', options: [{ id: 'opt_todo', name: 'Todo', color: 'gray' }, { id: 'opt_done', name: 'Done', color: 'green' }, { id: 'opt_progress', name: 'Progress', color: 'blue' }] },
    { id: 'fld_tags', name: 'Tags', type: 'multi_select', options: [{ id: 'opt_urgent', name: 'urgent', color: 'red' }, { id: 'opt_backlog', name: 'backlog', color: 'blue' }, { id: 'opt_frontend', name: 'frontend', color: 'purple' }] },
    { id: 'fld_doc', name: 'Doc', type: 'attachment' },
    { id: 'fld_email', name: 'Email', type: 'email' },
  ];

  const rows: Row[] = [];
  for (let i = 0; i < 1000; i++) {
    const id = `row_${String(i).padStart(4, '0')}`;
    const count = rand() < 0.1 ? null : randomInt(rand, 0, 20);
    const price = rand() < 0.1 ? null : randomInt(rand, 0, 5000); // cents
    const pct = rand() < 0.1 ? null : Math.round(rand() * 100) / 100;
    const active = rand() < 0.1 ? null : rand() < 0.5;
    const dueDate = rand() < 0.1 ? null : `2026-0${1 + randomInt(rand, 0, 5)}-${String(1 + randomInt(rand, 0, 27)).padStart(2, '0')}`;
    const created = rand() < 0.1 ? null : new Date(Date.UTC(2026, randomInt(rand, 0, 5), randomInt(rand, 1, 28), randomInt(rand, 0, 23))).toISOString();
    const statusOpt = rand() < 0.1 ? null : randomChoice(rand, ['opt_todo', 'opt_done', 'opt_progress']);
    const tagsCount = randomInt(rand, 0, 3);
    const tags: string[] | null = tagsCount === 0 ? (rand() < 0.3 ? null : []) : Array.from({ length: tagsCount }, () => randomChoice(rand, ['opt_urgent', 'opt_backlog', 'opt_frontend']));
    const doc = rand() < 0.2 ? null : `Assets/file${i}.png`;
    const email = rand() < 0.1 ? null : `user${i}@example.com`;
    const name = `Name${i} ${randomChoice(rand, ['ship', 'boat', 'car', 'plane'])}`;
    const notes = rand() < 0.2 ? null : `Note ${i} ${randomChoice(rand, ['hello', 'world', 'test'])}`;

    rows.push({
      id,
      rev: 1,
      updatedAt: new Date(Date.UTC(2026, 0, 1)).toISOString(),
      values: {
        fld_name: name,
        fld_notes: notes,
        fld_count: count,
        fld_price: price,
        fld_pct: pct,
        fld_active: active,
        fld_due: dueDate,
        fld_created: created,
        fld_status: statusOpt,
        fld_tags: tags,
        fld_doc: doc,
        fld_email: email,
      },
      sync: null,
    });
  }
  return { fields, rows };
}

export function generateFXS(seed = 123): { fields: FieldDefinition[]; rows: Row[] } {
  const fxm = generateFXM(seed);
  return { fields: fxm.fields, rows: fxm.rows.slice(0, 100) };
}

export function generateFXL(seed = 99): { fields: FieldDefinition[]; rows: Row[] } {
  const rand = mulberry32(seed);
  const base = generateFXM(seed);
  const rows: Row[] = [...base.rows];
  for (let i = 1000; i < 10000; i++) {
    const id = `row_${String(i).padStart(5, '0')}`;
    const copy = { ...base.rows[i % 1000], id };
    // slight randomization for new row
    copy.values = { ...copy.values, fld_name: `Name${i} ${randomChoice(rand, ['ship', 'boat'])}` };
    rows.push(copy as Row);
  }
  return { fields: base.fields, rows };
}
