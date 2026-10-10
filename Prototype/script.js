'use strict';
/* =====================================================================
   Tablify Prototype — feature reference for spec/features.md
   Document model per tablify.schema.json (formatVersion 1).
   ===================================================================== */

// ===== utilities =====
function uid(p) { return p + '_' + Math.random().toString(36).slice(2, 10); }
function nowIso() { return new Date().toISOString(); }
function esc(str) { return String(str == null ? '' : str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;'); }
function escAttr(str) { return esc(str).replace(/'/g, '&#39;'); }
function deepCopy(o) { return JSON.parse(JSON.stringify(o)); }
function pad2(n) { return String(n).padStart(2, '0'); }

// ===== select option colors =====
const OPT_COLOR_NAMES = ['gray', 'blue', 'green', 'red', 'amber', 'purple', 'teal', 'pink'];
const OPT_COLORS = {
  gray:   { cls: 'bg-gray-500/15 text-gray-600 dark:text-gray-300 border-gray-500/30', dot: 'bg-gray-400', swatch: '#9ca3af' },
  blue:   { cls: 'bg-sky-500/15 text-sky-700 dark:text-sky-300 border-sky-500/30', dot: 'bg-sky-500', swatch: '#0ea5e9' },
  green:  { cls: 'bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30', dot: 'bg-emerald-500', swatch: '#10b981' },
  red:    { cls: 'bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30', dot: 'bg-rose-500', swatch: '#f43f5e' },
  amber:  { cls: 'bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30', dot: 'bg-amber-500', swatch: '#f59e0b' },
  purple: { cls: 'bg-purple-500/15 text-purple-700 dark:text-purple-300 border-purple-500/30', dot: 'bg-purple-500', swatch: '#a855f7' },
  teal:   { cls: 'bg-teal-500/15 text-teal-700 dark:text-teal-300 border-teal-500/30', dot: 'bg-teal-500', swatch: '#14b8a6' },
  pink:   { cls: 'bg-pink-500/15 text-pink-700 dark:text-pink-300 border-pink-500/30', dot: 'bg-pink-500', swatch: '#ec4899' }
};
function optColor(name) { return OPT_COLORS[name] || OPT_COLORS.gray; }

// ===== duration / date helpers =====
function fmtDuration(mins) {
  if (mins == null || mins === '' || isNaN(mins)) return '';
  mins = Math.round(Number(mins));
  const h = Math.floor(mins / 60), m = mins % 60;
  return h > 0 ? (h + 'h ' + m + 'm') : (m + 'm');
}
function parseDuration(s) {
  s = String(s).trim().toLowerCase();
  if (!s) return null;
  let m;
  if ((m = s.match(/^(\d+):(\d{1,2})$/))) return Number(m[1]) * 60 + Number(m[2]);
  let total = 0, found = false;
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*h/))) { total += Number(m[1]) * 60; found = true; }
  if ((m = s.match(/(\d+(?:\.\d+)?)\s*m(?!o)/))) { total += Number(m[1]); found = true; }
  if (!found) { const n = Number(s); if (isNaN(n)) return null; total = n; }
  return Math.round(total);
}
function fmtDate(iso) {
  if (!iso) return '';
  const d = new Date(iso.length === 10 ? iso + 'T00:00:00' : iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}
function fmtDateTime(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return String(iso);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' }) + ' ' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}
function toLocalDTValue(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d)) return '';
  return d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()) + 'T' + pad2(d.getHours()) + ':' + pad2(d.getMinutes());
}

// ===== field type registry (19 types — spec §2.2–§2.4, P1-01) =====
const FT = {
  text:          { label: 'Text', icon: 'fa-font', editor: 'text',
                   fmt: v => esc(v), toText: v => v == null ? '' : String(v), parse: s => s },
  long_text:     { label: 'Long text', icon: 'fa-align-left', editor: 'textarea',
                   fmt: v => '<span class="line-clamp-2 whitespace-pre-wrap">' + esc(v) + '</span>', toText: v => v == null ? '' : String(v), parse: s => s },
  number:        { label: 'Number', icon: 'fa-hashtag', editor: 'text', numeric: true, align: 'right',
                   fmt: v => (v == null || v === '') ? '' : '<span class="font-mono">' + esc(Number(v).toLocaleString()) + '</span>',
                   toText: v => (v == null || v === '') ? '' : String(v),
                   parse: s => { const n = Number(String(s).replace(/,/g, '')); return isNaN(n) ? null : n; } },
  currency:      { label: 'Currency', icon: 'fa-dollar-sign', editor: 'text', numeric: true, align: 'right',
                   fmt: v => (v == null || v === '') ? '' : '<span class="font-mono">$' + esc(Number(v).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })) + '</span>',
                   toText: v => (v == null || v === '') ? '' : '$' + Number(v).toFixed(2),
                   parse: s => { const n = Number(String(s).replace(/[$,\s]/g, '')); return isNaN(n) ? null : n; } },
  percent:       { label: 'Percent', icon: 'fa-percent', editor: 'text', numeric: true, align: 'right',
                   fmt: v => (v == null || v === '') ? '' : '<span class="font-mono">' + esc(Number(v)) + '%</span>',
                   toText: v => (v == null || v === '') ? '' : Number(v) + '%',
                   parse: s => { const n = Number(String(s).replace(/[%\s]/g, '')); return isNaN(n) ? null : n; } },
  duration:      { label: 'Duration', icon: 'fa-stopwatch', editor: 'text', numeric: true, align: 'right',
                   fmt: v => '<span class="font-mono">' + esc(fmtDuration(v)) + '</span>', toText: v => fmtDuration(v), parse: parseDuration },
  rating:        { label: 'Rating', icon: 'fa-star', editor: 'rating', numeric: true,
                   fmt: () => '', toText: v => (v == null ? '' : v + '/5'),
                   parse: s => { const n = Math.max(0, Math.min(5, Math.round(Number(s)))); return isNaN(n) ? null : n; } },
  checkbox:      { label: 'Checkbox', icon: 'fa-square-check', editor: 'checkbox', numeric: true,
                   fmt: () => '', toText: v => v ? 'true' : 'false',
                   parse: s => /^(true|yes|1|x|✓)$/i.test(String(s).trim()) },
  date:          { label: 'Date', icon: 'fa-calendar', editor: 'date',
                   fmt: v => '<span class="font-mono">' + esc(fmtDate(v)) + '</span>', toText: v => v || '',
                   parse: s => { s = String(s).trim(); if (!s) return null; if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s; const d = new Date(s); return isNaN(d) ? null : d.getFullYear() + '-' + pad2(d.getMonth() + 1) + '-' + pad2(d.getDate()); } },
  date_time:     { label: 'Date & time', icon: 'fa-clock', editor: 'datetime',
                   fmt: v => '<span class="font-mono">' + esc(fmtDateTime(v)) + '</span>', toText: v => v || '',
                   parse: s => { s = String(s).trim(); if (!s) return null; const d = new Date(s); return isNaN(d) ? null : d.toISOString(); } },
  url:           { label: 'URL', icon: 'fa-link', editor: 'text',
                   fmt: v => v ? '<a href="' + escAttr(v) + '" target="_blank" rel="noopener" class="text-sky-600 dark:text-sky-400 hover:underline truncate inline-block max-w-[180px] align-bottom" onclick="event.stopPropagation()">' + esc(v) + '</a>' : '',
                   toText: v => v || '', parse: s => s },
  email:         { label: 'Email', icon: 'fa-envelope', editor: 'text',
                   fmt: v => v ? '<a href="mailto:' + escAttr(v) + '" class="text-sky-600 dark:text-sky-400 hover:underline" onclick="event.stopPropagation()">' + esc(v) + '</a>' : '',
                   toText: v => v || '', parse: s => s },
  phone:         { label: 'Phone', icon: 'fa-phone', editor: 'text',
                   fmt: v => v ? '<a href="tel:' + escAttr(v) + '" class="font-mono text-sky-600 dark:text-sky-400 hover:underline" onclick="event.stopPropagation()">' + esc(v) + '</a>' : '',
                   toText: v => v || '', parse: s => s },
  single_select: { label: 'Single select', icon: 'fa-circle-dot', editor: 'select',
                   fmt: (v, f) => { const o = (f.options || []).find(o => o.id === v); if (!o) return ''; const c = optColor(o.color); return '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ' + c.cls + '"><span class="w-1.5 h-1.5 rounded-full ' + c.dot + ' mr-1.5"></span>' + esc(o.name) + '</span>'; },
                   toText: (v, f) => { const o = (f.options || []).find(o => o.id === v); return o ? o.name : ''; },
                   parse: (s, f) => { const o = (f.options || []).find(o => o.name.toLowerCase() === String(s).trim().toLowerCase()); return o ? o.id : null; } },
  multi_select:  { label: 'Multi select', icon: 'fa-list-check', editor: 'select',
                   fmt: (v, f) => (Array.isArray(v) ? v : []).map(id => { const o = (f.options || []).find(o => o.id === id); if (!o) return ''; const c = optColor(o.color); return '<span class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border mr-1 mb-0.5 ' + c.cls + '">' + esc(o.name) + '</span>'; }).join(''),
                   toText: (v, f) => (Array.isArray(v) ? v : []).map(id => { const o = (f.options || []).find(o => o.id === id); return o ? o.name : ''; }).filter(Boolean).join(', '),
                   parse: (s, f) => String(s).split(',').map(x => x.trim()).filter(Boolean).map(name => { const o = (f.options || []).find(o => o.name.toLowerCase() === name.toLowerCase()); return o ? o.id : null; }).filter(Boolean) },
  attachment:    { label: 'Attachment', icon: 'fa-paperclip', editor: 'attachment',
                   fmt: v => (Array.isArray(v) ? v : []).map(p => '<span class="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono border border-tablify-paper-border dark:border-tablify-dark-border bg-tablify-paper-inner dark:bg-tablify-dark-inner mr-1 mb-0.5"><i class="fa-solid fa-paperclip mr-1 text-[8px] text-tablify-terracotta"></i>' + esc(p) + '</span>').join(''),
                   toText: v => (Array.isArray(v) ? v : []).join(', '),
                   parse: s => String(s).split(',').map(x => x.trim()).filter(Boolean) },
  formula:       { label: 'Formula', icon: 'fa-square-root-variable', editor: 'none', readOnly: true,
                   fmt: v => { if (v == null || v === '') return ''; const sv = String(v); if (sv.indexOf('#ERR') === 0) return '<span class="text-rose-500 font-mono text-[10px]" title="' + escAttr(sv) + '">' + esc(sv.length > 24 ? sv.slice(0, 24) + '…' : sv) + '</span>'; return typeof v === 'number' ? '<span class="font-mono">' + esc(v.toLocaleString()) + '</span>' : esc(sv); },
                   toText: v => v == null ? '' : String(v), parse: () => null },
  link:          { label: 'Linked records', icon: 'fa-diagram-project', editor: 'link',
                   fmt: (v, f) => (Array.isArray(v) ? v : []).map(rid => {
                     const t = state.docs.find(d => d.tableId === f.linkTableId);
                     const row = t && t.rows.find(r => r.id === rid);
                     const label = row ? (cellText(t, row, primaryField(t)) || '(untitled)') : 'missing row';
                     return '<button onclick="event.stopPropagation();openPeek(\'' + f.linkTableId + '\',\'' + rid + '\')" class="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-medium border mr-1 mb-0.5 ' + (row ? 'bg-tablify-terracotta/10 text-tablify-terracotta border-tablify-terracotta/30 hover:bg-tablify-terracotta/20' : 'bg-gray-500/10 text-gray-400 border-gray-500/30') + '"><i class="fa-solid fa-diagram-project mr-1 text-[8px]"></i>' + esc(label) + '</button>';
                   }).join(''),
                   toText: (v, f) => (Array.isArray(v) ? v : []).map(rid => {
                     const t = state.docs.find(d => d.tableId === f.linkTableId);
                     const row = t && t.rows.find(r => r.id === rid);
                     return row ? cellText(t, row, primaryField(t)) : '';
                   }).filter(Boolean).join(', '),
                   parse: () => null },
  auto_number:   { label: 'Auto number', icon: 'fa-arrow-down-1-9', editor: 'none', readOnly: true, system: true, numeric: true, align: 'right',
                   fmt: (v) => '<span class="font-mono text-tablify-clay dark:text-gray-400">' + esc(v) + '</span>', toText: v => v == null ? '' : String(v), parse: () => null },
  created_time:  { label: 'Created time', icon: 'fa-calendar-plus', editor: 'none', readOnly: true, system: true,
                   fmt: v => '<span class="font-mono text-tablify-clay dark:text-gray-400">' + esc(fmtDateTime(v)) + '</span>', toText: v => v || '', parse: () => null },
  modified_time: { label: 'Last modified', icon: 'fa-calendar-check', editor: 'none', readOnly: true, system: true,
                   fmt: v => '<span class="font-mono text-tablify-clay dark:text-gray-400">' + esc(fmtDateTime(v)) + '</span>', toText: v => v || '', parse: () => null }
};
const FT_GROUPS = [
  ['Basic', ['text', 'long_text', 'number', 'currency', 'percent', 'duration', 'rating', 'checkbox']],
  ['Date', ['date', 'date_time']],
  ['Links & contact', ['url', 'email', 'phone']],
  ['Select & attachment', ['single_select', 'multi_select', 'attachment']],
  ['System (read-only)', ['auto_number', 'created_time', 'modified_time']],
  ['Computed (v2)', ['formula', 'link']]
];

// ===== document model (tablify.schema.json, formatVersion 1) =====
function makeView() {
  return { id: uid('viw'), name: 'Grid', type: 'grid', query: '', sorts: [], groupBy: null,
           hidden: [], order: [], widths: {}, freezePrimary: 'auto', rowHeight: 'm', collapsed: [] };
}
function makeField(name, type, extra) {
  return Object.assign({ id: uid('fld'), name: name, type: type, primary: false,
    required: false, unique: false, min: null, max: null, regex: null }, extra || {});
}
function makeRow(doc, cells) {
  return { id: uid('row'), cells: cells || {}, createdTime: nowIso(), modifiedTime: nowIso(), autoNumber: doc.nextAutoNumber++ };
}
function makeDoc(name) {
  const f = makeField('Name', 'text', { primary: true });
  const doc = { formatVersion: 1, tableId: uid('tbl'), name: name, fields: [f], rows: [], views: [makeView()], syncLink: null, nextAutoNumber: 1 };
  doc.views[0].order = [f.id];
  doc.rows.push(makeRow(doc, {}));
  return doc;
}
function docView(doc) { return doc.views[0]; }
// Feature 7: 'auto' freeze = disabled on mobile (<768px), enabled on desktop.
// An explicit user toggle stores true/false and always wins over the viewport default.
const FREEZE_BREAKPOINT = 768;
function freezeEnabled(view) {
  if (view.freezePrimary === 'auto' || view.freezePrimary == null) return window.innerWidth >= FREEZE_BREAKPOINT;
  return !!view.freezePrimary;
}
// Frozen columns: measure real rendered widths and set each sticky cell's
// left offset, instead of trusting the hardcoded 0/38/76 assumptions —
// table-layout is auto, so content (3-digit row numbers, zoom, fonts) can
// widen the first columns and desync fixed offsets.
function syncFrozenOffsets() {
  const table = document.getElementById('mainTable');
  if (!table || !table.querySelector) return;
  const headRow = table.querySelector('thead tr');
  if (!headRow) return;
  const stickyThs = Array.prototype.filter.call(headRow.children, el => el.classList && el.classList.contains('sticky-col'));
  if (!stickyThs.length) return;
  const spacingX = parseFloat((window.getComputedStyle(table).borderSpacing || '6px').split(' ')[0]) || 6;
  let left = 0;
  const lefts = stickyThs.map(th => { const l = left; left += th.getBoundingClientRect().width + spacingX; return l; });
  stickyThs.forEach((th, i) => { th.style.left = lefts[i] + 'px'; });
  table.querySelectorAll('tbody tr').forEach(tr => {
    let i = 0;
    Array.prototype.forEach.call(tr.children, td => {
      if (td.classList && td.classList.contains('sticky-col') && i < lefts.length) td.style.left = lefts[i++] + 'px';
    });
  });
}
// Insert Row button: a plain block inside the overflow-x scroll container only
// spans the visible width — size it to the table's full scrollable width so it
// stays aligned with the grid during horizontal scrolling.
function syncInsertRowWidth() {
  const table = document.getElementById('mainTable');
  const wrap = document.getElementById('insertRowWrap');
  if (!table || !wrap) return;
  const w = table.offsetWidth;
  wrap.style.width = w ? w + 'px' : '';
}
let _freezeRsT = null;
window.addEventListener('resize', () => {
  clearTimeout(_freezeRsT);
  _freezeRsT = setTimeout(() => { if (state.docs.length) renderGrid(); }, 150);
});
function getField(doc, fid) { return doc.fields.find(f => f.id === fid); }
function primaryField(doc) { return doc.fields.find(f => f.primary) || doc.fields[0]; }
function getCell(doc, row, field) {
  switch (field.type) {
    case 'auto_number': return row.autoNumber;
    case 'created_time': return row.createdTime;
    case 'modified_time': return row.modifiedTime;
    case 'formula': return evalFormulaSafe(doc, row, field);
    default: return row.cells[field.id];
  }
}
function setCell(doc, row, field, val) {
  if (FT[field.type].readOnly) return;
  row.cells[field.id] = val;
  row.modifiedTime = nowIso();
}
function cellText(doc, row, field) { return FT[field.type].toText(getCell(doc, row, field), field, doc); }

// ===== demo data =====
function seedDocs() {
  // Table 1: Product Tasks — demonstrates all 19 field types
  const t = { formatVersion: 1, tableId: 'tbl_tasks', name: 'Product Tasks', fields: [], rows: [], views: [makeView()], syncLink: null, nextAutoNumber: 1 };
  const F = {};
  [['name', 'Task', 'text', { primary: true, required: true }],
   ['notes', 'Notes', 'long_text', {}],
   ['status', 'Status', 'single_select', { options: [
      { id: 'opt_backlog', name: 'Backlog', color: 'gray' },
      { id: 'opt_progress', name: 'In Progress', color: 'blue' },
      { id: 'opt_done', name: 'Done', color: 'green' },
      { id: 'opt_blocked', name: 'Blocked', color: 'red' }] }],
   ['tags', 'Tags', 'multi_select', { options: [
      { id: 'opt_ui', name: 'UI', color: 'purple' },
      { id: 'opt_data', name: 'Data', color: 'teal' },
      { id: 'opt_docs', name: 'Docs', color: 'amber' },
      { id: 'opt_perf', name: 'Perf', color: 'pink' }] }],
   ['estimate', 'Estimate (h)', 'number', {}],
   ['budget', 'Budget', 'currency', {}],
   ['progress', 'Progress', 'percent', { min: 0, max: 100 }],
   ['spent', 'Time Spent', 'duration', {}],
   ['priority', 'Priority', 'rating', {}],
   ['shipped', 'Shipped', 'checkbox', {}],
   ['due', 'Due', 'date', {}],
   ['review', 'Review At', 'date_time', {}],
   ['spec', 'Spec URL', 'url', {}],
   ['owner', 'Owner Email', 'email', { unique: true }],
   ['phone', 'Phone', 'phone', {}],
   ['files', 'Attachments', 'attachment', {}],
   ['auto', 'ID', 'auto_number', {}],
   ['created', 'Created', 'created_time', {}],
   ['modified', 'Modified', 'modified_time', {}]
  ].forEach(([key, name, type, extra]) => {
    const f = makeField(name, type, extra); F[key] = f.id; t.fields.push(f);
  });
  docView(t).order = t.fields.map(f => f.id);
  docView(t).hidden = [F.review, F.phone, F.created, F.modified];
  const demo = [
    ['Design capsule grid shell', 'Match the card + capsule language in light and dark.', 'opt_done', ['opt_ui'], 8, 1200, 100, 540, 5, true, '2026-09-28', '2026-09-28T15:30:00Z', 'https://github.com/258044aamm-Dev/Tablify', 'mila@tablify.dev', '+880 1711-000001', ['Assets/grid-mock.png']],
    ['Implement query parser', 'field:value grammar per spec §2.6 with quoted names.', 'opt_progress', ['opt_data'], 13, 2400, 60, 310, 4, false, '2026-10-14', '2026-10-15T10:00:00Z', 'https://github.com/258044aamm-Dev/Tablify/blob/main/docs/query-grammar.md', 'rahim@tablify.dev', '+880 1711-000002', []],
    ['Write user guide', 'Covers import, export, views and shortcuts.', 'opt_backlog', ['opt_docs'], 5, 400, 0, 0, 2, false, '2026-10-30', null, '', 'sara@tablify.dev', '', []],
    ['Virtual rows benchmark', '10k rows at 60fps on mobile.', 'opt_blocked', ['opt_perf', 'opt_data'], 21, 3600, 35, 720, 4, false, '2026-10-20', '2026-10-21T09:00:00Z', '', 'tom@tablify.dev', '+880 1711-000004', ['Assets/bench.csv', 'Assets/notes.md']],
    ['CSV import inference', 'Headers from first row; infer number/date/checkbox/select.', 'opt_progress', ['opt_data', 'opt_docs'], 8, 1500, 80, 260, 3, false, '2026-10-12', null, 'https://github.com/258044aamm-Dev/Tablify/blob/main/spec/steps/P4-03.md', 'mila@tablify.dev', '', []]
  ];
  demo.forEach(d => {
    const r = makeRow(t, {});
    [F.name, F.notes, F.status, F.tags, F.estimate, F.budget, F.progress, F.spent, F.priority, F.shipped, F.due, F.review, F.spec, F.owner, F.phone, F.files]
      .forEach((fid, i) => { if (d[i] !== null && d[i] !== '' && !(Array.isArray(d[i]) && !d[i].length)) r.cells[fid] = d[i]; });
    t.rows.push(r);
  });

  // Table 2: Projects — small sibling table (linked records target in v2 step)
  const p = { formatVersion: 1, tableId: 'tbl_projects', name: 'Projects', fields: [], rows: [], views: [makeView()], syncLink: null, nextAutoNumber: 1 };
  const PF = {};
  [['name', 'Project', 'text', { primary: true, required: true }],
   ['phase', 'Phase', 'single_select', { options: [
      { id: 'opt_plan', name: 'Planning', color: 'amber' },
      { id: 'opt_build', name: 'Building', color: 'blue' },
      { id: 'opt_ship', name: 'Shipped', color: 'green' }] }],
   ['budget', 'Budget', 'currency', {}],
   ['due', 'Target', 'date', {}],
   ['notes', 'Notes', 'long_text', {}]
  ].forEach(([key, name, type, extra]) => { const f = makeField(name, type, extra); PF[key] = f.id; p.fields.push(f); });
  docView(p).order = p.fields.map(f => f.id);
  [['Tablify 1.0 (MVP)', 'opt_build', 18000, '2026-11-15', 'Phases P0–P6: typed fields, grid, query, views, import/export.'],
   ['Tablify 1.1 (Sync)', 'opt_plan', 9000, '2026-12-20', 'Embeds + optional Airtable sync with conflict detection.'],
   ['Tablify 2.0 (Formulas)', 'opt_plan', 12000, '2027-02-01', 'Formula fields and linked records.']
  ].forEach(d => {
    const r = makeRow(p, {});
    [PF.name, PF.phase, PF.budget, PF.due, PF.notes].forEach((fid, i) => { if (d[i] != null) r.cells[fid] = d[i]; });
    p.rows.push(r);
  });
  // v2 demo: linked records (Feature 12) + formula fields (Feature 11)
  const linkF = makeField('Project', 'link', { linkTableId: 'tbl_projects' });
  t.fields.push(linkF);
  docView(t).order.push(linkF.id);
  t.rows.forEach((r, i) => { r.cells[linkF.id] = [p.rows[i < 2 ? 0 : (i < 4 ? 1 : 2)].id]; });
  const daysF = makeField('Days Left', 'formula', { formula: 'DATEDIFF({Target}, "2026-10-10")' });
  p.fields.push(daysF);
  docView(p).order.push(daysF.id);
  const sumF = makeField('Summary', 'formula', { formula: 'CONCAT({Project}, " — $", {Budget})' });
  p.fields.push(sumF);
  docView(p).order.push(sumF.id);
  return [t, p];
}

// ===== state, persistence, undo =====
const LS_KEY = 'tablifyPrototypeV1';
let state = { docs: [], active: null, editing: null, selected: {}, uiView: 'grid', focus: null, anchor: null };
const UNDO = [], REDO = [];
const UNDO_CAP = 80;

function activeDoc() { return state.docs.find(d => d.tableId === state.active); }

function save() {
  try { localStorage.setItem(LS_KEY, JSON.stringify({ docs: state.docs, active: state.active })); } catch (e) {}
  triggerSavedPulse();
}
function load() {
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (raw) {
      const data = JSON.parse(raw);
      if (data && Array.isArray(data.docs) && data.docs.length && data.docs[0].formatVersion === 1) {
        state.docs = data.docs;
        state.active = data.active && data.docs.some(d => d.tableId === data.active) ? data.active : data.docs[0].tableId;
        return;
      }
    }
  } catch (e) {}
  state.docs = seedDocs();
  state.active = state.docs[0].tableId;
  save();
}
function resetDemo() {
  if (!confirm('Reset all demo data? This clears local changes.')) return;
  localStorage.removeItem(LS_KEY);
  UNDO.length = 0; REDO.length = 0;
  state = { docs: [], active: null, editing: null, selected: {}, uiView: 'grid' };
  load();
  renderAll();
  showToast('Demo data reset');
}

// Undo/redo infrastructure (snapshots; UI lands in PR-06).
function pushUndo(label) {
  UNDO.push({ label: label, snap: JSON.stringify({ docs: state.docs, active: state.active }) });
  if (UNDO.length > UNDO_CAP) UNDO.shift();
  REDO.length = 0;
}
function mutate(label, fn) {
  pushUndo(label);
  fn();
  save();
  renderAll();
}

// ===== theme =====
function initTheme() {
  const dark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches;
  document.documentElement.classList.toggle('dark', dark);
  document.documentElement.classList.toggle('light', !dark);
  document.getElementById('themeIcon').className = dark ? 'fa-solid fa-sun' : 'fa-solid fa-moon';
}
function toggleTheme() {
  const isDark = document.documentElement.classList.contains('dark');
  document.documentElement.classList.toggle('dark', !isDark);
  document.documentElement.classList.toggle('light', isDark);
  document.getElementById('themeIcon').className = isDark ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
}

// ===== row pipeline (search filter; query grammar + sort/group land in PR-04/05) =====
// @@PIPELINE-START
function visibleFields(doc) {
  const v = docView(doc);
  const order = v.order.filter(fid => getField(doc, fid));
  doc.fields.forEach(f => { if (!order.includes(f.id)) order.push(f.id); });
  return order.filter(fid => !v.hidden.includes(fid)).map(fid => getField(doc, fid));
}
function pipelineRows(doc) {
  const q = (document.getElementById('searchInput').value || '').trim();
  let rows = doc.rows.slice();
  if (q) {
    const parsed = parseQuery(q);
    if (parsed.global) {
      const g = parsed.global.toLowerCase();
      const fields = visibleFields(doc);
      rows = rows.filter(r => fields.some(f => cellText(doc, r, f).toLowerCase().includes(g)));
    }
    parsed.terms.forEach(term => {
      const field = findFieldByName(doc, term.field);
      rows = rows.filter(r => field ? evalTerm(doc, r, field, term) : false);
    });
  }
  const sorts = docView(doc).sorts.filter(st => getField(doc, st.fieldId));
  if (sorts.length) {
    rows.sort((a, b) => {
      for (const st of sorts) {
        const c = cmpRows(doc, a, b, getField(doc, st.fieldId));
        if (c) return c * st.dir;
      }
      return 0;
    });
  }
  return rows;
}
// @@PIPELINE-END

// ===== rendering =====
const ROWPAD = { s: 'py-1', m: 'py-2', l: 'py-3' };
// Fixed capsule heights per row-height setting — identical to what a
// single-line cell rendered at before (min-h 34px / l: 16px line + 24px pad),
// so normal content looks unchanged while long content now clips instead of
// growing the row.
const CAPH = { s: 'h-[34px]', m: 'h-[34px]', l: 'h-[40px]' };

function renderAll() {
  renderTabs();
  renderTitle();
  renderGrid();
  renderSidebar();
  applyUiView();
  /* @@RENDERHOOKS */
}

function renderTabs() {
  const host = document.getElementById('tableTabs');
  let html = '<span class="text-xs font-medium text-tablify-clay dark:text-gray-400 whitespace-nowrap mr-1"><i class="fa-solid fa-folder-tree mr-1 text-tablify-terracotta"></i> Tables:</span>';
  state.docs.forEach(d => {
    const on = d.tableId === state.active && state.uiView === 'grid';
    html += '<button onclick="switchTable(\'' + d.tableId + '\')" class="px-3 py-1.5 text-xs font-medium rounded-full transition whitespace-nowrap ' +
      (on ? 'bg-tablify-terracotta text-white shadow-sm' : 'text-tablify-clay dark:text-gray-400 hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner') + '">' +
      esc(d.name) + '</button>';
  });
  const noteOn = state.uiView === 'note';
  html += '<button onclick="noteClick()" class="px-3 py-1.5 text-xs font-medium rounded-full transition whitespace-nowrap ' +
    (noteOn ? 'bg-tablify-terracotta text-white shadow-sm' : 'text-tablify-clay dark:text-gray-400 hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner') + '" title="Live embedded table in a note (Feature 18)">' +
    '<i class="fa-regular fa-file-lines mr-1"></i>Note embed</button>';
  host.innerHTML = html;
}

function renderTitle() {
  const doc = activeDoc();
  const t = document.getElementById('editableTableTitle');
  if (document.activeElement !== t) t.textContent = doc.name;
  document.getElementById('fileChip').textContent = 'Tables/' + doc.name.replace(/[\\/:*?"<>|]/g, '_') + '.tablify';
}

function headCellHtml(doc, field) {
  // @@HEADCELL-START
  const ft = FT[field.type];
  const view = docView(doc);
  const sortIdx = view.sorts.findIndex(st => st.fieldId === field.id);
  const sort = sortIdx >= 0 ? view.sorts[sortIdx] : null;
  const w = view.widths[field.id];
  const frozen = freezeEnabled(view) && field.primary;
  return '<th class="pb-1 min-w-[160px]' + (frozen ? ' sticky-col bg-tablify-paper-inner dark:bg-tablify-dark-inner' : '') + '" data-fld="' + field.id + '"' +
    ' style="width:' + (w || 160) + 'px;' + (frozen ? 'left:76px;z-index:7;' : '') + '"' +
    ' ondragover="colDragOver(event)" ondrop="colDrop(event,\'' + field.id + '\')">' +
    '<div class="header-capsule relative flex items-center justify-between px-3.5 py-2 rounded-2xl shadow-sm">' +
      '<div class="flex items-center space-x-2 min-w-0">' +
        '<i class="fa-solid fa-grip-vertical text-tablify-clay/50 dark:text-gray-500 text-[11px] cursor-grab" draggable="true" ondragstart="colDragStart(event,\'' + field.id + '\')" title="Drag to reorder"></i>' +
        (field.primary ? '<i class="fa-solid fa-key text-[9px] text-tablify-terracotta" title="Primary field"></i>' : '') +
        '<button class="text-xs font-semibold tracking-wide font-serif truncate hover:text-tablify-terracotta transition" onclick="headerSortClick(event,\'' + field.id + '\')" title="Click: sort · Shift-click: add sort">' + esc(field.name) + '</button>' +
        (sort ? '<span class="text-[9px] text-tablify-terracotta font-mono shrink-0">' + (sort.dir === 1 ? '&#9650;' : '&#9660;') + (view.sorts.length > 1 ? (sortIdx + 1) : '') + '</span>' : '') +
        '<span class="text-[9px] text-tablify-clay dark:text-gray-400 font-mono px-1.5 py-0.5 bg-tablify-paper-inner dark:bg-tablify-dark-inner rounded border border-tablify-paper-border dark:border-tablify-dark-border whitespace-nowrap" title="' + escAttr(ft.label) + '"><i class="fa-solid ' + ft.icon + ' mr-1"></i>' + field.type + '</span>' +
      '</div>' +
      '<button onclick="openColumnMenu(event,\'' + field.id + '\')" class="w-5 h-5 rounded hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner flex items-center justify-center text-tablify-clay dark:text-gray-400 transition shrink-0">' +
        '<i class="fa-solid fa-ellipsis-vertical text-[10px]"></i>' +
      '</button>' +
      '<div class="col-resize-handle" onmousedown="colResizeStart(event,\'' + field.id + '\')" title="Drag to resize"></div>' +
    '</div></th>';
  // @@HEADCELL-END
}

function cellInnerHtml(doc, row, field) {
  const ft = FT[field.type];
  const v = getCell(doc, row, field);
  if (field.type === 'checkbox') {
    return '<button onclick="toggleCheckbox(event,\'' + row.id + '\',\'' + field.id + '\')" class="text-base ' + (v ? 'text-tablify-terracotta' : 'text-gray-300 dark:text-gray-600') + '"><i class="fa-' + (v ? 'solid fa-square-check' : 'regular fa-square') + '"></i></button>';
  }
  if (field.type === 'rating') {
    let stars = '';
    const rating = Number(v) || 0;
    for (let i = 1; i <= 5; i++) {
      stars += '<i class="fa-solid fa-star ' + (i <= rating ? 'text-tablify-terracotta' : 'text-gray-300 dark:text-gray-600') + ' cursor-pointer hover:scale-110 transition" onclick="setRating(event,\'' + row.id + '\',\'' + field.id + '\',' + i + ')"></i>';
    }
    return '<div class="flex items-center space-x-1 text-xs">' + stars + '<span class="text-[10px] font-mono text-tablify-clay dark:text-gray-400 ml-2">' + rating + '/5</span></div>';
  }
  const html = ft.fmt(v, field, doc);
  if (html === '' || html == null) return '<span class="text-tablify-clay/40 dark:text-gray-600 select-none">—</span>';
  return html;
}

function cellHtml(doc, row, field, pad, frozen) {
  const ft = FT[field.type];
  const editing = state.editing && state.editing.rowId === row.id && state.editing.fieldId === field.id;
  let inner;
  let cls = 'cell-capsule px-3.5 ' + pad + ' shadow-sm rounded-2xl text-xs ' + (CAPH[docView(doc).rowHeight] || CAPH.m) + ' flex items-center';
  if (ft.align === 'right') cls += ' justify-end';
  const invMsg = _invalid[row.id] && _invalid[row.id][field.id];
  if (invMsg) cls += ' cell-invalid';
  if (state.focus && state.focus.rowId === row.id && state.focus.fieldId === field.id && !editing) cls += ' cell-focus';
  else if (_rangeSet.has(row.id + '|' + field.id)) cls += ' cell-range';
  if (editing) {
    inner = editorHtml(doc, row, field);
    cls += ' cell-editing';
  } else {
    inner = '<div class="w-full min-w-0 cell-clip">' + cellInnerHtml(doc, row, field) + '</div>';
  }
  const fullTxt = editing ? '' : cellText(doc, row, field);
  const handlers = (editing ? '' : ' onclick="cellClick(event,\'' + row.id + '\',\'' + field.id + '\')"') + (invMsg ? ' title="' + escAttr(invMsg) + '"' : (fullTxt ? ' title="' + escAttr(fullTxt) + '"' : ''));
  return '<td class="py-1 px-1 align-top' + (frozen ? ' sticky-col bg-tablify-paper-inner dark:bg-tablify-dark-inner' : '') + '" data-row="' + row.id + '" data-fld="' + field.id + '"' + (frozen ? ' style="left:76px"' : '') + '>' +
    '<div class="' + cls + (ft.readOnly ? ' opacity-80' : '') + '"' + handlers + '>' + inner + '</div></td>';
}

function editorHtml(doc, row, field) {
  const v = getCell(doc, row, field);
  const ft = FT[field.type];
  const common = ' id="cellEditor" class="w-full bg-transparent text-xs focus:outline-none" onkeydown="editorKey(event)" onblur="editorBlur(event)"';
  if (ft.editor === 'textarea') {
    return '<textarea rows="3"' + common + '>' + esc(v) + '</textarea>';
  }
  if (ft.editor === 'date') {
    return '<input type="date" value="' + escAttr(v || '') + '"' + common + '>';
  }
  if (ft.editor === 'datetime') {
    return '<input type="datetime-local" value="' + escAttr(toLocalDTValue(v)) + '"' + common + '>';
  }
  let init = '';
  switch (field.type) {
    case 'number': init = v == null ? '' : String(v); break;
    case 'currency': init = v == null ? '' : String(v); break;
    case 'percent': init = v == null ? '' : String(v); break;
    case 'duration': init = v == null ? '' : fmtDuration(v); break;
    default: init = v == null ? '' : String(v);
  }
  return '<input type="text" value="' + escAttr(init) + '"' + common + '>';
}

function renderGrid() {
  const doc = activeDoc();
  const view = docView(doc);
  const fields = visibleFields(doc);
  const rows = pipelineRows(doc);
  const pad = ROWPAD[view.rowHeight] || ROWPAD.m;

  // header
  let headerHtml = '<tr class="text-tablify-clay dark:text-gray-400 text-[11px] font-semibold uppercase tracking-wider select-none">';
  const frzOn = freezeEnabled(view);
  const hdrFrozen = frzOn ? ' sticky-col bg-tablify-paper-inner dark:bg-tablify-dark-inner' : '';
  headerHtml += '<th class="w-8 text-center pb-1' + hdrFrozen + '"' + (frzOn ? ' style="left:0;z-index:7"' : '') + '><input type="checkbox" onchange="toggleSelectAll(this)" class="rounded border-tablify-paper-border accent-tablify-terracotta cursor-pointer"></th>';
  headerHtml += '<th class="w-10 text-center pb-1 font-mono' + hdrFrozen + '"' + (frzOn ? ' style="left:38px;z-index:7"' : '') + '>#</th>';
  fields.forEach(f => { headerHtml += headCellHtml(doc, f); });
  headerHtml += '</tr>';
  document.getElementById('tableHeaderHead').innerHTML = headerHtml;

  // body
  // @@GRIDBODY-START
  _invalid = computeInvalid(doc);
  _rangeSet = computeRangeSet(doc);
  const frozenOn = frzOn;
  const stickyTd = ' sticky-col bg-tablify-paper-inner dark:bg-tablify-dark-inner';
  const renderRowTr = (row, index) => {
    let h = '<tr data-row="' + row.id + '">';
    h += '<td class="text-center py-1' + (frozenOn ? stickyTd : '') + '"' + (frozenOn ? ' style="left:0"' : '') + '><input type="checkbox" ' + (state.selected[row.id] ? 'checked' : '') + ' onchange="toggleSelectRow(\'' + row.id + '\')" class="rounded border-tablify-paper-border accent-tablify-terracotta cursor-pointer"></td>';
    h += '<td class="text-center py-1 text-tablify-clay dark:text-gray-400 font-mono text-xs select-none row-drag-handle' + (frozenOn ? stickyTd : '') + '"' + (frozenOn ? ' style="left:38px"' : '') + ' onpointerdown="rowDragStart(event,\'' + row.id + '\')" title="Drag to reorder row"><i class="fa-solid fa-grip-vertical text-[8px] text-tablify-clay/40 dark:text-gray-600 mr-1"></i>' + (index + 1) + '</td>';
    fields.forEach(f => { h += cellHtml(doc, row, f, pad, frozenOn && f.primary); });
    return h + '</tr>';
  };
  let bodyHtml = '';
  const gf = view.groupBy ? getField(doc, view.groupBy) : null;
  if (gf) {
    const groups = [];
    const gmap = {};
    rows.forEach(r => {
      const key = cellText(doc, r, gf) || '(empty)';
      if (!gmap[key]) { gmap[key] = { key: key, rows: [] }; groups.push(gmap[key]); }
      gmap[key].rows.push(r);
    });
    _groupKeys = groups.map(g => g.key);
    let gi = 0;
    groups.forEach((g, idx) => {
      const collapsed = view.collapsed.includes(g.key);
      let label = esc(g.key);
      if (gf.type === 'single_select') {
        const o = (gf.options || []).find(o => o.name === g.key);
        if (o) label = FT.single_select.fmt(o.id, gf, doc);
      }
      bodyHtml += '<tr><td colspan="' + (fields.length + 2) + '" class="pt-2 pb-0.5 px-2">' +
        '<button onclick="toggleGroup(' + idx + ')" class="flex items-center gap-2 text-[11px] font-semibold text-tablify-clay dark:text-gray-400 uppercase tracking-wider font-serif">' +
        '<i class="fa-solid fa-chevron-' + (collapsed ? 'right' : 'down') + ' text-[9px]"></i>' + label +
        '<span class="font-mono text-[10px] normal-case tracking-normal">' + g.rows.length + '</span></button></td></tr>';
      if (!collapsed) g.rows.forEach(r => { bodyHtml += renderRowTr(r, gi++); });
      else gi += g.rows.length;
    });
  } else {
    rows.forEach((row, index) => { bodyHtml += renderRowTr(row, index); });
  }
  document.getElementById('tableBody').innerHTML = bodyHtml;
  syncFrozenOffsets();
  syncInsertRowWidth();
  // @@GRIDBODY-END

  // counts + selection
  document.getElementById('rowCountBadge').textContent = rows.length + ' row' + (rows.length === 1 ? '' : 's') + (rows.length !== doc.rows.length ? ' (of ' + doc.rows.length + ')' : '');
  const invCount = Object.keys(_invalid).reduce((a, k) => a + Object.keys(_invalid[k]).length, 0);
  const invB = document.getElementById('invalidBadge');
  if (invB) {
    invB.classList.toggle('hidden', !invCount);
    invB.textContent = invCount + ' invalid';
    invB.title = 'Invalid cells are outlined red — hover a cell for the reason (Feature 10)';
  }
  const selCount = Object.keys(state.selected).filter(id => state.selected[id] && doc.rows.some(r => r.id === id)).length;
  const selSummary = document.getElementById('selectionSummary');
  if (selCount > 0) {
    selSummary.classList.remove('hidden'); selSummary.classList.add('flex');
    document.getElementById('selectedCount').textContent = selCount + ' selected';
  } else {
    selSummary.classList.add('hidden'); selSummary.classList.remove('flex');
  }

  // focus the open editor
  const ed = document.getElementById('cellEditor');
  if (ed) { ed.focus(); if (ed.select && ed.type === 'text') ed.select(); }
}

// ===== editing (Feature 5: commit on Enter/blur, cancel on Escape) =====
function cellClick(ev, rowId, fieldId) {
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const ft = FT[field.type];
  if (ev.shiftKey && state.focus) {
    if (!state.anchor) state.anchor = { rowId: state.focus.rowId, fieldId: state.focus.fieldId };
    state.focus = { rowId: rowId, fieldId: fieldId };
    renderGrid();
    return;
  }
  state.anchor = { rowId: rowId, fieldId: fieldId };
  state.focus = { rowId: rowId, fieldId: fieldId };
  if (ft.readOnly) { renderGrid(); showToast(ft.label + ' is read-only (system field)'); return; }
  if (ft.editor === 'select') { openSelectPanel(ev.currentTarget, rowId, fieldId); return; }
  if (ft.editor === 'attachment') { openAttachmentPanel(ev.currentTarget, rowId, fieldId); return; }
  if (ft.editor === 'link') { openLinkPanel(ev.currentTarget, rowId, fieldId); return; }
  if (ft.editor === 'checkbox' || ft.editor === 'rating' || ft.editor === 'none') { renderGrid(); return; }
  startEdit(rowId, fieldId);
}
function startEdit(rowId, fieldId) {
  if (state.editing && (state.editing.rowId !== rowId || state.editing.fieldId !== fieldId)) commitEditor(false);
  state.editing = { rowId: rowId, fieldId: fieldId, cancelled: false };
  renderGrid();
}
function editorKey(ev) {
  if (ev.key === 'Tab') {
    ev.preventDefault();
    commitEditor(true);
    moveFocus(0, ev.shiftKey ? -1 : 1, false);
  } else if (ev.key === 'Enter' && !(ev.target.tagName === 'TEXTAREA' && ev.shiftKey)) {
    ev.preventDefault();
    commitEditor(true);
    moveFocus(1, 0, false);
  } else if (ev.key === 'Escape') {
    ev.preventDefault();
    state.editing = null;
    renderGrid();
    showToast('Edit cancelled');
  }
  ev.stopPropagation();
}
function editorBlur() {
  // slight delay so Escape / panel clicks can win
  setTimeout(() => { if (state.editing) commitEditor(false); }, 80);
}
function commitEditor() {
  const edEl = document.getElementById('cellEditor');
  if (!edEl || !state.editing) { state.editing = null; return; }
  const { rowId, fieldId } = state.editing;
  const doc = activeDoc();
  const row = doc.rows.find(r => r.id === rowId);
  const field = getField(doc, fieldId);
  state.editing = null;
  if (!row || !field) { renderGrid(); return; }
  const raw = edEl.value;
  const prev = getCell(doc, row, field);
  let val;
  if (raw === '' || raw == null) val = undefined;
  else {
    val = FT[field.type].parse(raw, field, doc);
    if (val === null) { renderGrid(); showToast('Could not parse "' + raw + '" as ' + FT[field.type].label); return; }
  }
  const prevJson = JSON.stringify(prev === undefined ? null : prev);
  const valJson = JSON.stringify(val === undefined ? null : val);
  if (prevJson === valJson) { renderGrid(); return; }
  mutate('Edit cell', () => {
    if (val === undefined) { delete row.cells[field.id]; row.modifiedTime = nowIso(); }
    else setCell(doc, row, field, val);
  });
  const msg = validateCell(doc, field, row);
  if (msg) showToast('Saved, but invalid — ' + msg);
}
function toggleCheckbox(ev, rowId, fieldId) {
  ev.stopPropagation();
  const doc = activeDoc();
  const row = doc.rows.find(r => r.id === rowId);
  const field = getField(doc, fieldId);
  mutate('Toggle checkbox', () => setCell(doc, row, field, !getCell(doc, row, field)));
}
function setRating(ev, rowId, fieldId, n) {
  ev.stopPropagation();
  const doc = activeDoc();
  const row = doc.rows.find(r => r.id === rowId);
  const field = getField(doc, fieldId);
  const cur = Number(getCell(doc, row, field)) || 0;
  mutate('Set rating', () => setCell(doc, row, field, cur === n ? 0 : n));
}

// ===== floating panel host =====
let panelCtx = null;
function openPanel(anchorEl, html, ctx) {
  const p = document.getElementById('floatPanel');
  p.innerHTML = html;
  p.classList.remove('hidden');
  panelCtx = ctx || {};
  const r = anchorEl.getBoundingClientRect();
  const pw = Math.min(320, window.innerWidth - 24);
  let x = Math.min(r.left, window.innerWidth - pw - 12);
  let y = r.bottom + 6;
  p.style.left = Math.max(8, x) + 'px';
  p.style.top = y + 'px';
  const ph = p.getBoundingClientRect().height;
  if (y + ph > window.innerHeight - 8) p.style.top = Math.max(8, r.top - ph - 6) + 'px';
  const inp = p.querySelector('input[type=text]');
  if (inp) inp.focus();
}
function closePanel() {
  document.getElementById('floatPanel').classList.add('hidden');
  document.getElementById('floatPanel').innerHTML = '';
  panelCtx = null;
}
document.addEventListener('mousedown', ev => {
  const p = document.getElementById('floatPanel');
  if (!p.classList.contains('hidden') && !p.contains(ev.target)) closePanel();
});
document.addEventListener('keydown', ev => {
  if (ev.key === 'Escape' && panelCtx) closePanel();
});

// ===== Row drag-and-drop reordering (Pointer Events: works for mouse AND touch) =====
let _rowDrag = null;
// Core reorder: move rowId so it sits immediately before beforeRowId
// (beforeRowId null = end of table). Pure data move — ids, cells and
// modifiedTime untouched; callers wrap it in mutate() for undo/redo + save.
function moveRowBefore(doc, rowId, beforeRowId) {
  const i = doc.rows.findIndex(r => r.id === rowId);
  if (i < 0) return false;
  const [r] = doc.rows.splice(i, 1);
  let j = beforeRowId ? doc.rows.findIndex(x => x.id === beforeRowId) : doc.rows.length;
  if (j < 0) j = doc.rows.length;
  doc.rows.splice(j, 0, r);
  return true;
}
function rowDragStart(ev, rowId) {
  if (ev.button !== undefined && ev.button !== 0) return; // primary button / touch only
  _rowDrag = { rowId: rowId, startX: ev.clientX, startY: ev.clientY, active: false, before: undefined };
  document.addEventListener('pointermove', rowDragMove);
  document.addEventListener('pointerup', rowDragEnd);
  document.addEventListener('pointercancel', rowDragCancel);
}
function rowDragMove(ev) {
  if (!_rowDrag) return;
  if (!_rowDrag.active) {
    if (Math.abs(ev.clientX - _rowDrag.startX) + Math.abs(ev.clientY - _rowDrag.startY) < 5) return; // drag threshold
    const view = docView(activeDoc());
    if (view.sorts.length) { showToast('Clear sorting to reorder rows manually'); rowDragCancel(); return; }
    if (view.groupBy) { showToast('Disable grouping to reorder rows manually'); rowDragCancel(); return; }
    if (state.editing) commitEditor(false); // don't lose a pending edit to the drop re-render
    _rowDrag.active = true;
    document.body.classList.add('row-dragging-active');
    const tr = document.querySelector('#tableBody tr[data-row="' + _rowDrag.rowId + '"]');
    if (tr) tr.classList.add('row-dragging');
  }
  if (ev.cancelable) ev.preventDefault();
  // find the insertion boundary: first visible row whose midpoint is below the pointer
  const trs = Array.prototype.slice.call(document.querySelectorAll('#tableBody tr[data-row]'));
  let before = null;
  let beforeTr = null;
  for (const tr of trs) {
    const rect = tr.getBoundingClientRect();
    if (ev.clientY < rect.top + rect.height / 2) { before = tr.getAttribute('data-row'); beforeTr = tr; break; }
  }
  _rowDrag.before = before;
  // position the indicator line inside the (position:relative) container
  const cont = document.getElementById('tableInnerContainer');
  const ind = document.getElementById('rowDropIndicator');
  if (cont && ind && cont.getBoundingClientRect) {
    const crect = cont.getBoundingClientRect();
    let y;
    if (beforeTr) y = beforeTr.getBoundingClientRect().top - 5;
    else if (trs.length) y = trs[trs.length - 1].getBoundingClientRect().bottom + 2;
    else y = crect.top;
    ind.style.top = (y - crect.top) + 'px';
    ind.style.display = 'block';
  }
  // edge auto-scroll so long tables can be traversed mid-drag
  if (ev.clientY < 70) window.scrollBy(0, -14);
  else if (ev.clientY > window.innerHeight - 70) window.scrollBy(0, 14);
}
function rowDragEnd() {
  const d = _rowDrag;
  rowDragCancel();
  if (!d || !d.active || d.before === undefined) return;
  const doc = activeDoc();
  const before = d.before;
  const i = doc.rows.findIndex(r => r.id === d.rowId);
  if (i < 0) return;
  const noop = before === d.rowId ||
    (before === null && i === doc.rows.length - 1) ||
    (before !== null && doc.rows[i + 1] && doc.rows[i + 1].id === before);
  if (!noop) {
    mutate('Reorder rows', () => { moveRowBefore(doc, d.rowId, before); });
    showToast('Row moved');
  }
  renderGrid();
}
function rowDragCancel() {
  document.removeEventListener('pointermove', rowDragMove);
  document.removeEventListener('pointerup', rowDragEnd);
  document.removeEventListener('pointercancel', rowDragCancel);
  document.body.classList.remove('row-dragging-active');
  const ind = document.getElementById('rowDropIndicator');
  if (ind) ind.style.display = 'none';
  const tr = document.querySelector('#tableBody tr.row-dragging');
  if (tr) tr.classList.remove('row-dragging');
  _rowDrag = null;
}
// touch long-press on the handle must not pop the row context menu mid-drag
window.addEventListener('contextmenu', ev => {
  if (_rowDrag) { ev.preventDefault(); ev.stopPropagation(); }
}, true);

// Tapping/clicking anywhere outside the grid clears the focused-cell highlight
// (mousedown, not click: by click-time a re-render may have detached ev.target,
// which would make closest() checks unreliable).
function outsideTapClear(ev) {
  if (!state.focus && !state.anchor && !state.editing) return;
  const t = ev.target;
  if (t && t.closest && (t.closest('#mainTable') || t.closest('#floatPanel'))) return;
  // NOTE: deliberately NOT anyModalOpen() here — that helper also reports
  // "open" while a cell editor is active or any input has focus, which is
  // exactly the state this handler must clear. Only true modal overlays
  // (full-screen backdrops) keep the selection.
  const modalIds = ['addFieldModal', 'optMgrModal', 'sourceModal', 'filterModal', 'importModal', 'exportModal', 'syncModal', 'conflictModal', 'peekModal', 'checklistModal'];
  for (const id of modalIds) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) return;
  }
  if (state.editing) commitEditor(false); // commit the pending edit before re-rendering, never lose input
  state.focus = null;
  state.anchor = null;
  renderGrid();
}
document.addEventListener('mousedown', outsideTapClear);
document.addEventListener('touchstart', outsideTapClear, { passive: true }); // taps on touch devices, even where mouse events aren't synthesized

// ===== select dropdown (Feature 3: searchable, create-on-type, colored) =====
function openSelectPanel(anchorEl, rowId, fieldId) {
  panelCtx = { kind: 'select', rowId, fieldId, search: '' };
  renderSelectPanel(anchorEl);
}
function renderSelectPanel(anchorEl) {
  const { rowId, fieldId, search } = panelCtx;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const row = doc.rows.find(r => r.id === rowId);
  const multi = field.type === 'multi_select';
  const cur = getCell(doc, row, field);
  const curIds = multi ? (Array.isArray(cur) ? cur : []) : (cur ? [cur] : []);
  const opts = (field.options || []).filter(o => !search || o.name.toLowerCase().includes(search.toLowerCase()));
  let html = '<div class="p-2">' +
    '<input type="text" value="' + escAttr(search) + '" placeholder="Search or create…" oninput="selectPanelSearch(this)" onkeydown="selectPanelKey(event)" class="pill-input w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none mb-1.5">' +
    '<div class="max-h-52 overflow-y-auto space-y-0.5">';
  opts.forEach(o => {
    const c = optColor(o.color);
    const on = curIds.includes(o.id);
    html += '<button onclick="selectPanelPick(\'' + o.id + '\')" class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner text-left">' +
      '<span class="inline-flex items-center px-2.5 py-0.5 rounded-full text-[11px] font-medium border ' + c.cls + '"><span class="w-1.5 h-1.5 rounded-full ' + c.dot + ' mr-1.5"></span>' + esc(o.name) + '</span>' +
      (on ? '<i class="fa-solid fa-check text-tablify-terracotta text-xs"></i>' : '') + '</button>';
  });
  if (!opts.length && !search) html += '<div class="px-2 py-1.5 text-[11px] text-tablify-clay dark:text-gray-400">No options yet — type to create.</div>';
  const exact = (field.options || []).some(o => o.name.toLowerCase() === (search || '').toLowerCase());
  if (search && !exact) {
    html += '<button onclick="selectPanelCreate()" class="w-full flex items-center px-2 py-1.5 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner text-left text-xs"><i class="fa-solid fa-plus text-tablify-terracotta mr-2 text-[10px]"></i>Create "<b>' + esc(search) + '</b>"</button>';
  }
  html += '</div>' +
    '<div class="border-t border-tablify-paper-border dark:border-tablify-dark-border mt-1.5 pt-1.5 flex justify-between items-center">' +
    '<button onclick="panelClear()" class="text-[11px] text-tablify-clay dark:text-gray-400 hover:text-rose-500 px-2 py-1">Clear</button>' +
    '<button onclick="openOptMgrFromPanel()" class="text-[11px] text-tablify-terracotta hover:underline px-2 py-1"><i class="fa-solid fa-palette mr-1"></i>Manage options</button>' +
    '</div></div>';
  openPanel(anchorEl, html, panelCtx);
  const inp = document.querySelector('#floatPanel input');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function selectPanelSearch(inp) {
  panelCtx.search = inp.value;
  const anchor = document.querySelector('td[data-row="' + panelCtx.rowId + '"][data-fld="' + panelCtx.fieldId + '"] > div') || document.body;
  renderSelectPanel(anchor);
}
function selectPanelKey(ev) {
  if (ev.key === 'Enter') {
    ev.preventDefault();
    const { fieldId, search } = panelCtx;
    const doc = activeDoc();
    const field = getField(doc, fieldId);
    const exact = (field.options || []).find(o => o.name.toLowerCase() === (search || '').toLowerCase());
    if (exact) selectPanelPick(exact.id);
    else if (search) selectPanelCreate();
  }
  ev.stopPropagation();
}
function selectPanelPick(optId) {
  const { rowId, fieldId } = panelCtx;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const row = doc.rows.find(r => r.id === rowId);
  const multi = field.type === 'multi_select';
  mutate('Set select', () => {
    if (multi) {
      const cur = Array.isArray(getCell(doc, row, field)) ? getCell(doc, row, field).slice() : [];
      const i = cur.indexOf(optId);
      if (i >= 0) cur.splice(i, 1); else cur.push(optId);
      setCell(doc, row, field, cur);
    } else {
      setCell(doc, row, field, optId);
    }
  });
  if (multi) {
    const anchor = document.querySelector('td[data-row="' + rowId + '"][data-fld="' + fieldId + '"] > div') || document.body;
    renderSelectPanel(anchor);
  } else closePanel();
}
function selectPanelCreate() {
  const { fieldId, search } = panelCtx;
  if (!search) return;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const opt = { id: uid('opt'), name: search, color: OPT_COLOR_NAMES[(field.options || []).length % OPT_COLOR_NAMES.length] };
  mutate('Create option', () => { field.options = field.options || []; field.options.push(opt); });
  panelCtx.search = '';
  selectPanelPick(opt.id);
  showToast('Created option "' + opt.name + '"');
}
function panelClear() {
  const { rowId, fieldId } = panelCtx;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const row = doc.rows.find(r => r.id === rowId);
  mutate('Clear cell', () => { delete row.cells[field.id]; row.modifiedTime = nowIso(); });
  closePanel();
}

// ===== attachment panel (Feature 3: vault-relative paths) =====
function openAttachmentPanel(anchorEl, rowId, fieldId) {
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const row = doc.rows.find(r => r.id === rowId);
  const list = Array.isArray(getCell(doc, row, field)) ? getCell(doc, row, field) : [];
  let html = '<div class="p-2.5 text-xs">' +
    '<div class="text-[11px] font-semibold mb-1.5 font-serif"><i class="fa-solid fa-paperclip text-tablify-terracotta mr-1"></i>Attachments</div>';
  if (list.length) {
    html += '<div class="space-y-1 mb-2">';
    list.forEach((p, i) => {
      html += '<div class="flex items-center justify-between gap-2 px-2 py-1 rounded-lg bg-tablify-paper-inner dark:bg-tablify-dark-inner border border-tablify-paper-border dark:border-tablify-dark-border">' +
        '<span class="font-mono text-[10px] truncate">' + esc(p) + '</span>' +
        '<button onclick="attachRemove(' + i + ')" class="text-tablify-clay dark:text-gray-400 hover:text-rose-500"><i class="fa-solid fa-xmark text-[10px]"></i></button></div>';
    });
    html += '</div>';
  } else {
    html += '<div class="text-[11px] text-tablify-clay dark:text-gray-400 mb-2">No attachments.</div>';
  }
  html += '<input type="text" placeholder="Vault-relative path, e.g. Assets/photo.png" onkeydown="attachKey(event)" class="pill-input w-full rounded-lg px-3 py-1.5 text-[11px] font-mono focus:outline-none">' +
    '<div class="text-[10px] text-tablify-clay dark:text-gray-400 mt-1.5">Type the path and press Enter (spec §2.3). File picking is Obsidian-side — simulated here.</div></div>';
  openPanel(anchorEl, html, { kind: 'attach', rowId, fieldId });
}
function attachKey(ev) {
  ev.stopPropagation();
  if (ev.key !== 'Enter') return;
  const path = ev.target.value.trim();
  if (!path) return;
  const { rowId, fieldId } = panelCtx;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const row = doc.rows.find(r => r.id === rowId);
  mutate('Add attachment', () => {
    const cur = Array.isArray(getCell(doc, row, field)) ? getCell(doc, row, field).slice() : [];
    cur.push(path);
    setCell(doc, row, field, cur);
  });
  openAttachmentPanel(document.querySelector('td[data-row="' + rowId + '"][data-fld="' + fieldId + '"] > div') || document.body, rowId, fieldId);
}
function attachRemove(i) {
  const { rowId, fieldId } = panelCtx;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const row = doc.rows.find(r => r.id === rowId);
  mutate('Remove attachment', () => {
    const cur = Array.isArray(getCell(doc, row, field)) ? getCell(doc, row, field).slice() : [];
    cur.splice(i, 1);
    setCell(doc, row, field, cur);
  });
  openAttachmentPanel(document.querySelector('td[data-row="' + rowId + '"][data-fld="' + fieldId + '"] > div') || document.body, rowId, fieldId);
}

// ===== option manager (Feature 3) =====
let optMgrFieldId = null;
function openOptMgrFromPanel() {
  const fid = panelCtx.fieldId;
  closePanel();
  openOptMgr(fid);
}
function openOptMgr(fieldId) {
  optMgrFieldId = fieldId;
  renderOptMgr();
  document.getElementById('optMgrModal').classList.remove('hidden');
}
function closeOptMgr() { document.getElementById('optMgrModal').classList.add('hidden'); optMgrFieldId = null; }
function renderOptMgr() {
  const doc = activeDoc();
  const field = getField(doc, optMgrFieldId);
  if (!field) return;
  document.getElementById('optMgrTitle').textContent = 'Options — ' + field.name;
  const host = document.getElementById('optMgrBody');
  let html = '';
  (field.options || []).forEach((o, i) => {
    const c = optColor(o.color);
    html += '<div class="flex items-center gap-2">' +
      '<button onclick="optMgrMove(' + i + ',-1)" class="pill-btn w-6 h-6 rounded-lg text-[10px]" title="Move up"><i class="fa-solid fa-arrow-up"></i></button>' +
      '<button onclick="optMgrMove(' + i + ',1)" class="pill-btn w-6 h-6 rounded-lg text-[10px]" title="Move down"><i class="fa-solid fa-arrow-down"></i></button>' +
      '<button onclick="optMgrColor(' + i + ')" class="w-6 h-6 rounded-lg border border-tablify-paper-border dark:border-tablify-dark-border shrink-0" style="background:' + c.swatch + '" title="Cycle color (' + o.color + ')"></button>' +
      '<input type="text" value="' + escAttr(o.name) + '" onchange="optMgrRename(' + i + ',this.value)" class="pill-input flex-1 rounded-lg px-2.5 py-1.5 text-xs focus:outline-none">' +
      '<button onclick="optMgrDelete(' + i + ')" class="text-tablify-clay dark:text-gray-400 hover:text-rose-500 w-6 h-6" title="Delete option"><i class="fa-solid fa-trash-can text-[11px]"></i></button>' +
      '</div>';
  });
  host.innerHTML = html || '<div class="text-[11px] text-tablify-clay dark:text-gray-400">No options yet.</div>';
}
function optMgrMove(i, dir) {
  const doc = activeDoc();
  const field = getField(doc, optMgrFieldId);
  const j = i + dir;
  if (j < 0 || j >= field.options.length) return;
  mutate('Reorder option', () => { const t = field.options[i]; field.options[i] = field.options[j]; field.options[j] = t; });
  renderOptMgr();
}
function optMgrColor(i) {
  const doc = activeDoc();
  const field = getField(doc, optMgrFieldId);
  mutate('Recolor option', () => {
    const cur = OPT_COLOR_NAMES.indexOf(field.options[i].color);
    field.options[i].color = OPT_COLOR_NAMES[(cur + 1) % OPT_COLOR_NAMES.length];
  });
  renderOptMgr();
}
function optMgrRename(i, name) {
  name = name.trim();
  if (!name) { renderOptMgr(); return; }
  const doc = activeDoc();
  const field = getField(doc, optMgrFieldId);
  mutate('Rename option', () => { field.options[i].name = name; });
  renderOptMgr();
}
function optMgrDelete(i) {
  const doc = activeDoc();
  const field = getField(doc, optMgrFieldId);
  const opt = field.options[i];
  mutate('Delete option', () => {
    field.options.splice(i, 1);
    doc.rows.forEach(r => {
      const v = r.cells[field.id];
      if (field.type === 'single_select' && v === opt.id) delete r.cells[field.id];
      if (field.type === 'multi_select' && Array.isArray(v)) r.cells[field.id] = v.filter(id => id !== opt.id);
    });
  });
  renderOptMgr();
}
function optMgrAdd() {
  const inp = document.getElementById('optMgrNew');
  const name = inp.value.trim();
  if (!name) return;
  const doc = activeDoc();
  const field = getField(doc, optMgrFieldId);
  mutate('Add option', () => {
    field.options = field.options || [];
    field.options.push({ id: uid('opt'), name: name, color: OPT_COLOR_NAMES[field.options.length % OPT_COLOR_NAMES.length] });
  });
  inp.value = '';
  renderOptMgr();
}

// ===== rows / tables =====
function addRow() {
  const doc = activeDoc();
  mutate('Add row', () => { doc.rows.push(makeRow(doc, {})); });
  showToast('Inserted row');
}
function toggleSelectRow(rowId) {
  state.selected[rowId] = !state.selected[rowId];
  renderGrid();
}
function toggleSelectAll(cb) {
  const doc = activeDoc();
  pipelineRows(doc).forEach(r => { state.selected[r.id] = cb.checked; });
  renderGrid();
}
function deleteSelectedRows() {
  const doc = activeDoc();
  const ids = Object.keys(state.selected).filter(id => state.selected[id]);
  if (!ids.length) return;
  mutate('Delete rows', () => { doc.rows = doc.rows.filter(r => !ids.includes(r.id)); });
  state.selected = {};
  showToast('Deleted ' + ids.length + ' row' + (ids.length === 1 ? '' : 's'));
}
function switchTable(tableId) {
  state.active = tableId;
  state.uiView = 'grid';
  state.editing = null;
  state.selected = {};
  save();
  renderAll();
}
function addNewTable() {
  const doc = makeDoc('Untitled table');
  mutate('New table', () => { state.docs.push(doc); state.active = doc.tableId; });
  showToast('Created new table');
}
function commitTitle(el) {
  const name = el.textContent.trim();
  const doc = activeDoc();
  if (!name || name === doc.name) { renderTitle(); return; }
  mutate('Rename table', () => { doc.name = name; });
}
function filterRows() { renderGrid(); }

// ===== add field modal =====
let editFieldId = null;
function showAddFieldModal(fieldId) {
  editFieldId = fieldId || null;
  const sel = document.getElementById('newFieldType');
  let html = '';
  FT_GROUPS.forEach(([group, types]) => {
    html += '<optgroup label="' + group + '">';
    types.forEach(t => { html += '<option value="' + t + '">' + FT[t].label + '</option>'; });
    html += '</optgroup>';
  });
  sel.innerHTML = html;
  const doc = activeDoc();
  const f = editFieldId ? getField(doc, editFieldId) : null;
  document.getElementById('addFieldTitle').textContent = f ? 'Field settings — ' + f.name : 'Add New Field';
  document.getElementById('newFieldName').value = f ? f.name : '';
  sel.value = f ? f.type : 'text';
  document.getElementById('vRequired').checked = !!(f && f.required);
  document.getElementById('vUnique').checked = !!(f && f.unique);
  document.getElementById('vMin').value = f && f.min != null ? f.min : '';
  document.getElementById('vMax').value = f && f.max != null ? f.max : '';
  document.getElementById('vRegex').value = f && f.regex ? f.regex : '';
  document.getElementById('newFieldFormula').value = f && f.formula ? f.formula : '';
  const linkSel = document.getElementById('newFieldLinkTable');
  linkSel.innerHTML = state.docs.map(d => '<option value="' + d.tableId + '"' + (f && f.linkTableId === d.tableId ? ' selected' : '') + '>' + esc(d.name) + '</option>').join('');
  formulaPreview();
  onFieldTypeChange();
  if (f && (f.type === 'single_select' || f.type === 'multi_select')) document.getElementById('fieldOptionsWrap').classList.add('hidden');
  document.getElementById('addFieldModal').classList.remove('hidden');
  document.getElementById('newFieldName').focus();
}
function hideAddFieldModal() {
  document.getElementById('addFieldModal').classList.add('hidden');
  document.getElementById('newFieldName').value = '';
  document.getElementById('newFieldOptions').value = '';
  document.getElementById('fieldOptionsWrap').classList.remove('hidden');
  editFieldId = null;
  onFieldTypeChange();
}
function onFieldTypeChange() {
  const t = document.getElementById('newFieldType').value;
  document.getElementById('fieldOptionsWrap').classList.toggle('hidden', t !== 'single_select' && t !== 'multi_select');
  const minmax = ['number', 'currency', 'percent', 'duration', 'rating', 'date', 'date_time'].includes(t);
  const rx = ['text', 'long_text', 'url', 'email', 'phone'].includes(t);
  document.getElementById('vMinMaxWrap').classList.toggle('hidden', !minmax);
  document.getElementById('vRegexWrap').classList.toggle('hidden', !rx);
  document.getElementById('fieldFormulaWrap').classList.toggle('hidden', t !== 'formula');
  document.getElementById('fieldLinkWrap').classList.toggle('hidden', t !== 'link');
  /* @@FIELDTYPECHANGE */
}
function readValidationInputs(field, type) {
  field.required = document.getElementById('vRequired').checked;
  field.unique = document.getElementById('vUnique').checked;
  const minS = document.getElementById('vMin').value.trim();
  const maxS = document.getElementById('vMax').value.trim();
  const numish = ['number', 'currency', 'percent', 'duration', 'rating'].includes(type);
  field.min = minS === '' ? null : (numish ? Number(minS) : minS);
  field.max = maxS === '' ? null : (numish ? Number(maxS) : maxS);
  if (field.min !== null && numish && isNaN(field.min)) field.min = null;
  if (field.max !== null && numish && isNaN(field.max)) field.max = null;
  field.regex = document.getElementById('vRegex').value.trim() || null;
  if (type === 'formula') field.formula = document.getElementById('newFieldFormula').value.trim();
  if (type === 'link') field.linkTableId = document.getElementById('newFieldLinkTable').value;
}
function confirmAddField() {
  const name = document.getElementById('newFieldName').value.trim();
  const type = document.getElementById('newFieldType').value;
  if (!name) { showToast('Field name cannot be empty'); return; }
  const doc = activeDoc();
  if (editFieldId) {
    const field = getField(doc, editFieldId);
    if (!field) { hideAddFieldModal(); return; }
    const oldType = field.type;
    mutate('Edit field', () => {
      field.name = name;
      readValidationInputs(field, type);
      if (type !== oldType) {
        changeFieldType(doc, field, type);
      }
    });
    hideAddFieldModal();
    showToast('Updated field "' + name + '"');
    return;
  }
  const extra = {};
  if (type === 'single_select' || type === 'multi_select') {
    extra.options = document.getElementById('newFieldOptions').value.split('\n').map(s => s.trim()).filter(Boolean)
      .map((n, i) => ({ id: uid('opt'), name: n, color: OPT_COLOR_NAMES[i % OPT_COLOR_NAMES.length] }));
  }
  /* @@FIELDCONFIRM */
  const field = makeField(name, type, extra);
  readValidationInputs(field, type);
  mutate('Add field', () => {
    doc.fields.push(field);
    docView(doc).order.push(field.id);
  });
  hideAddFieldModal();
  showToast('Added field "' + name + '"');
}
function changeFieldType(doc, field, newType) {
  // convert values via text round-trip; unparseable cells are dropped (Feature 17: change field type)
  const texts = {};
  doc.rows.forEach(r => { texts[r.id] = cellText(doc, r, field); });
  field.type = newType;
  if ((newType === 'single_select' || newType === 'multi_select') && !field.options) field.options = [];
  doc.rows.forEach(r => {
    const t = texts[r.id];
    delete r.cells[field.id];
    if (!t) return;
    if (newType === 'single_select' || newType === 'multi_select') {
      // create-on-convert: make options from existing values
      t.split(',').map(x => x.trim()).filter(Boolean).forEach(nameVal => {
        if (!field.options.some(o => o.name.toLowerCase() === nameVal.toLowerCase())) {
          field.options.push({ id: uid('opt'), name: nameVal, color: OPT_COLOR_NAMES[field.options.length % OPT_COLOR_NAMES.length] });
        }
      });
    }
    const parsed = FT[newType].parse(t, field, doc);
    if (parsed !== null && parsed !== undefined && !(Array.isArray(parsed) && !parsed.length)) {
      r.cells[field.id] = parsed;
      r.modifiedTime = nowIso();
    }
  });
}

// ===== column menu (full context menus land in PR-09) =====
function openColumnMenu(ev, fieldId) {
  ev.stopPropagation();
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  let html = '<div class="p-1.5 text-xs">';
  html += '<button onclick="closePanel();showAddFieldModal(\'' + fieldId + '\')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner"><i class="fa-solid fa-gear mr-2 text-tablify-terracotta"></i>Field settings &amp; validation</button>';
  if (field.type === 'single_select' || field.type === 'multi_select') {
    html += '<button onclick="closePanel();openOptMgr(\'' + fieldId + '\')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner"><i class="fa-solid fa-palette mr-2 text-tablify-terracotta"></i>Manage options</button>';
  }
  html += '<button onclick="hideFieldFromMenu(\'' + fieldId + '\')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner"><i class="fa-solid fa-eye-slash mr-2 text-tablify-clay"></i>Hide field</button>';
  html += '<button onclick="deleteFieldFromMenu(\'' + fieldId + '\')" class="w-full text-left px-3 py-1.5 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner text-rose-500"><i class="fa-solid fa-trash-can mr-2"></i>Delete field</button>';
  html += '</div>';
  openPanel(ev.currentTarget, html, { kind: 'colmenu', fieldId });
}
function hideFieldFromMenu(fieldId) {
  closePanel();
  const doc = activeDoc();
  mutate('Hide field', () => { const v = docView(doc); if (!v.hidden.includes(fieldId)) v.hidden.push(fieldId); });
  showToast('Field hidden — unhide via Options');
}
function deleteFieldFromMenu(fieldId) {
  closePanel();
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  if (field.primary) { showToast('Cannot delete the primary field'); return; }
  if (!confirm('Delete field "' + field.name + '" and its data?')) return;
  mutate('Delete field', () => {
    doc.fields = doc.fields.filter(f => f.id !== fieldId);
    const v = docView(doc);
    v.order = v.order.filter(id => id !== fieldId);
    v.hidden = v.hidden.filter(id => id !== fieldId);
    doc.rows.forEach(r => { delete r.cells[fieldId]; });
  });
  showToast('Field deleted');
}

// ===== file source (Feature 1) =====
function serializeDoc(doc) {
  const clean = deepCopy(doc);
  // schema: views[].freezePrimary is boolean — resolve the 'auto' viewport default
  (clean.views || []).forEach(v => { v.freezePrimary = freezeEnabled(v); });
  return JSON.stringify(clean, null, 2) + '\n';
}
function openSourceModal() {
  const doc = activeDoc();
  document.getElementById('sourceFileName').textContent = 'Tables/' + doc.name.replace(/[\\/:*?"<>|]/g, '_') + '.tablify';
  document.getElementById('sourceBody').textContent = serializeDoc(doc);
  document.getElementById('sourceModal').classList.remove('hidden');
}
function closeSourceModal() { document.getElementById('sourceModal').classList.add('hidden'); }
function copySource() {
  navigator.clipboard.writeText(serializeDoc(activeDoc())).then(() => showToast('Copied .tablify source')).catch(() => showToast('Copy failed'));
}
function downloadSource() {
  const doc = activeDoc();
  downloadFile(doc.name.replace(/[\\/:*?"<>|]/g, '_') + '.tablify', serializeDoc(doc), 'application/json');
  showToast('Downloaded .tablify file');
}
function downloadFile(name, content, mime) {
  const blob = new Blob([content], { type: mime || 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

// ===== export (CSV real; full export dialog lands in PR-08) =====
function csvEscape(s) {
  s = String(s == null ? '' : s);
  return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}
function buildCSV(doc, fields, rows) {
  let out = fields.map(f => csvEscape(f.name)).join(',') + '\r\n';
  rows.forEach(r => { out += fields.map(f => csvEscape(cellText(doc, r, f))).join(',') + '\r\n'; });
  return out;
}
function exportData() {
  const doc = activeDoc();
  const fields = visibleFields(doc);
  const rows = pipelineRows(doc);
  downloadFile(doc.name.replace(/\s+/g, '_').toLowerCase() + '.csv', buildCSV(doc, fields, rows), 'text/csv');
  showToast('Exported CSV (current view)');
}
function copyMarkdownTable() {
  const doc = activeDoc();
  const fields = visibleFields(doc);
  const rows = pipelineRows(doc);
  let md = '| ' + fields.map(f => f.name.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
  md += '| ' + fields.map(() => '---').join(' | ') + ' |\n';
  rows.forEach(r => {
    md += '| ' + fields.map(f => cellText(doc, r, f).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |\n';
  });
  navigator.clipboard.writeText(md).then(() => showToast('Copied Markdown table')).catch(() => showToast('Markdown generated'));
}

// ===== misc UI =====
function triggerSavedPulse() {
  const el = document.getElementById('savedIndicator');
  if (!el) return;
  el.style.opacity = '1';
  el.classList.add('text-emerald-600');
}
function showToast(msg) {
  const toast = document.getElementById('toast');
  document.getElementById('toastMsg').textContent = msg;
  toast.classList.remove('opacity-0', 'pointer-events-none');
  toast.classList.add('opacity-100');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => {
    toast.classList.remove('opacity-100');
    toast.classList.add('opacity-0', 'pointer-events-none');
  }, 2200);
}


// ===== Feature 6: query grammar (spec §2.6, docs/query-grammar.md) =====
function parseQuery(q) {
  q = String(q || '');
  const res = { terms: [], global: '' };
  const globals = [];
  let i = 0;
  const n = q.length;
  function readQuoted() { // caller ensures q[i] === '"'
    i++; let out = '';
    while (i < n) {
      if (q[i] === '"') {
        if (q[i + 1] === '"') { out += '"'; i += 2; continue; }
        i++; return out;
      }
      out += q[i++];
    }
    return out; // tolerate unclosed quote in the prototype
  }
  while (i < n) {
    while (i < n && /\s/.test(q[i])) i++;
    if (i >= n) break;
    let name = '';
    let nameQuoted = false;
    if (q[i] === '"') { name = readQuoted(); nameQuoted = true; }
    else { while (i < n && !/[\s:]/.test(q[i])) name += q[i++]; }
    while (i < n && (q[i] === ' ' || q[i] === '\t')) i++;
    if (q[i] === ':') {
      i++;
      while (i < n && (q[i] === ' ' || q[i] === '\t')) i++;
      let op = '';
      if (i < n && '~!><'.indexOf(q[i]) >= 0) { op = q[i]; i++; }
      const values = [];
      let cur = '', curQuoted = false, started = false;
      while (i < n && !/\s/.test(q[i])) {
        if (q[i] === '"') { cur += readQuoted(); curQuoted = true; started = true; continue; }
        if (q[i] === ',') {
          values.push({ v: cur.trim(), q: curQuoted });
          cur = ''; curQuoted = false; i++;
          while (i < n && (q[i] === ' ' || q[i] === '\t')) i++;
          continue;
        }
        cur += q[i++]; started = true;
      }
      if (started || curQuoted || values.length) values.push({ v: cur.trim(), q: curQuoted });
      const vals = values.map(x => x.v);
      if (!op && vals.length === 1 && !values[0].q && vals[0].toLowerCase() === 'empty') {
        res.terms.push({ field: name, op: 'empty', values: [] });
      } else if (!op && vals.length === 1 && vals[0] === '' && !values[0].q) {
        res.terms.push({ field: name, op: 'empty', values: [] }); // "field:" empty-value syntax (§3.6)
      } else {
        res.terms.push({ field: name, op: op, values: vals });
      }
    } else {
      globals.push(nameQuoted ? name : name);
    }
  }
  res.global = globals.join(' ').trim();
  return res;
}
function findFieldByName(doc, name) {
  const low = String(name).toLowerCase();
  return doc.fields.find(f => f.name.toLowerCase() === low) || null;
}
function cellIsEmpty(v) { return v == null || v === '' || (Array.isArray(v) && v.length === 0); }
function compareKey(field, v) {
  switch (field.type) {
    case 'number': case 'currency': case 'percent': case 'rating': case 'auto_number': case 'duration':
      return Number(v);
    case 'checkbox': return v ? 1 : 0;
    case 'date': return v ? new Date(String(v).length === 10 ? v + 'T00:00:00' : v).getTime() : null;
    case 'date_time': case 'created_time': case 'modified_time':
      return v ? new Date(v).getTime() : null;
    default: return null;
  }
}
function parseCompareValue(field, s) {
  switch (field.type) {
    case 'duration': return parseDuration(s);
    case 'date': case 'date_time': case 'created_time': case 'modified_time': {
      const d = new Date(/^\d{4}-\d{2}-\d{2}$/.test(s) ? s + 'T00:00:00' : s);
      return isNaN(d) ? null : d.getTime();
    }
    default: {
      const n = Number(String(s).replace(/[$,%\s]/g, ''));
      return isNaN(n) ? null : n;
    }
  }
}
function equalsAnyValue(doc, row, field, values) {
  const v = getCell(doc, row, field);
  switch (field.type) {
    case 'multi_select': {
      const names = (Array.isArray(v) ? v : []).map(id => { const o = (field.options || []).find(o => o.id === id); return o ? o.name.toLowerCase() : ''; });
      return values.some(val => names.includes(val.toLowerCase()));
    }
    case 'single_select': {
      const o = (field.options || []).find(o => o.id === v);
      return values.some(val => o && o.name.toLowerCase() === val.toLowerCase());
    }
    case 'checkbox':
      return values.some(val => FT.checkbox.parse(val) === !!v);
    case 'number': case 'currency': case 'percent': case 'rating': case 'auto_number': case 'duration':
      return values.some(val => { const q = parseCompareValue(field, val); return q != null && Number(v) === q; });
    default: {
      const t = cellText(doc, row, field).toLowerCase();
      return values.some(val => t === val.toLowerCase());
    }
  }
}
function evalTerm(doc, row, field, term) {
  const v = getCell(doc, row, field);
  const empty = cellIsEmpty(v);
  if (term.op === 'empty') return empty;
  if (empty) return term.op === '!';
  switch (term.op) {
    case '~': {
      const t = cellText(doc, row, field).toLowerCase();
      return term.values.some(val => t.indexOf(val.toLowerCase()) >= 0);
    }
    case '>': case '<': {
      const k = compareKey(field, v);
      const q = parseCompareValue(field, term.values[0] || '');
      if (k == null || q == null || isNaN(k)) return false;
      return term.op === '>' ? k > q : k < q;
    }
    case '!': return !equalsAnyValue(doc, row, field, term.values);
    default: return equalsAnyValue(doc, row, field, term.values);
  }
}

// ===== Feature 7: sorting =====
function sortKeyFor(doc, row, field) {
  const v = getCell(doc, row, field);
  if (cellIsEmpty(v)) return null;
  const k = compareKey(field, v);
  if (k != null && !isNaN(k)) return k;
  if (field.type === 'single_select') {
    const idx = (field.options || []).findIndex(o => o.id === v);
    return idx >= 0 ? idx : null;
  }
  return cellText(doc, row, field).toLowerCase();
}
function cmpRows(doc, a, b, field) {
  const ka = sortKeyFor(doc, a, field), kb = sortKeyFor(doc, b, field);
  if (ka == null && kb == null) return 0;
  if (ka == null) return 1;   // empties last
  if (kb == null) return -1;
  if (typeof ka === 'string' || typeof kb === 'string') return String(ka) < String(kb) ? -1 : String(ka) > String(kb) ? 1 : 0;
  return ka - kb;
}
function headerSortClick(ev, fieldId) {
  ev.stopPropagation();
  const view = docView(activeDoc());
  const i = view.sorts.findIndex(s => s.fieldId === fieldId);
  if (ev.shiftKey) {
    if (i < 0) view.sorts.push({ fieldId: fieldId, dir: 1 });
    else if (view.sorts[i].dir === 1) view.sorts[i].dir = -1;
    else view.sorts.splice(i, 1);
  } else {
    if (i < 0 || view.sorts.length > 1) view.sorts = [{ fieldId: fieldId, dir: 1 }];
    else if (view.sorts[i].dir === 1) view.sorts[i].dir = -1;
    else view.sorts = [];
  }
  save(); renderGrid();
}

// ===== Feature 7: column resize & reorder, freeze, group =====
let _drag = null;
function colResizeStart(ev, fieldId) {
  ev.preventDefault(); ev.stopPropagation();
  const th = document.querySelector('th[data-fld="' + fieldId + '"]');
  _drag = { fieldId: fieldId, x: ev.clientX, w: th ? th.getBoundingClientRect().width : 160 };
  document.body.style.cursor = 'col-resize';
  const move = e => {
    const w = Math.max(120, Math.min(520, _drag.w + (e.clientX - _drag.x)));
    const t = document.querySelector('th[data-fld="' + _drag.fieldId + '"]');
    if (t) { t.style.width = w + 'px'; t.style.minWidth = w + 'px'; }
    _drag.cur = w;
    syncInsertRowWidth();
  };
  const up = () => {
    document.removeEventListener('mousemove', move);
    document.removeEventListener('mouseup', up);
    document.body.style.cursor = '';
    if (_drag && _drag.cur) {
      const view = docView(activeDoc());
      view.widths[_drag.fieldId] = Math.round(_drag.cur);
      save(); renderGrid();
    }
    _drag = null;
  };
  document.addEventListener('mousemove', move);
  document.addEventListener('mouseup', up);
}
let _dragFld = null;
function colDragStart(ev, fieldId) { _dragFld = fieldId; if (ev.dataTransfer) ev.dataTransfer.effectAllowed = 'move'; }
function colDragOver(ev) { if (_dragFld) ev.preventDefault(); }
function colDrop(ev, targetId) {
  ev.preventDefault();
  if (!_dragFld || _dragFld === targetId) { _dragFld = null; return; }
  const view = docView(activeDoc());
  const order = view.order.slice();
  const from = order.indexOf(_dragFld), to = order.indexOf(targetId);
  if (from < 0 || to < 0) { _dragFld = null; return; }
  order.splice(from, 1);
  order.splice(order.indexOf(targetId) + (from < to ? 1 : 0), 0, _dragFld);
  view.order = order;
  _dragFld = null;
  save(); renderGrid();
  showToast('Column reordered');
}
let _groupKeys = [];
function toggleGroup(i) {
  const key = _groupKeys[i];
  const view = docView(activeDoc());
  const j = view.collapsed.indexOf(key);
  if (j >= 0) view.collapsed.splice(j, 1); else view.collapsed.push(key);
  save(); renderGrid();
}

// ===== Feature 7: Options popover (view settings) =====
function toggleMoreMenu() { renderOptionsPanel(); }
function renderOptionsPanel() {
  const doc = activeDoc();
  const view = docView(doc);
  const groupable = doc.fields.filter(f => ['single_select', 'checkbox', 'rating', 'text', 'date'].includes(f.type));
  let html = '<div class="p-3 text-xs w-[300px] max-h-[70vh] overflow-y-auto">' +
    '<div class="text-[11px] font-semibold font-serif uppercase tracking-wider text-tablify-clay dark:text-gray-400 mb-2">View settings</div>';
  // row height
  html += '<div class="mb-3"><div class="mb-1 font-medium">Row height</div><div class="flex gap-1.5">';
  [['s', 'Short'], ['m', 'Medium'], ['l', 'Tall']].forEach(([h, label]) => {
    const on = view.rowHeight === h;
    html += '<button onclick="optRowHeight(\'' + h + '\')" class="px-3 py-1.5 rounded-full text-[11px] font-medium ' + (on ? 'bg-tablify-terracotta text-white' : 'pill-btn') + '">' + label + '</button>';
  });
  html += '</div></div>';
  // freeze
  html += '<div class="mb-3 flex items-center justify-between"><span class="font-medium">Freeze primary column</span>' +
    '<button onclick="optFreeze()" class="w-9 h-5 rounded-full relative transition ' + (freezeEnabled(view) ? 'bg-tablify-terracotta' : 'bg-gray-300 dark:bg-gray-600') + '"><span class="absolute top-0.5 ' + (freezeEnabled(view) ? 'right-0.5' : 'left-0.5') + ' w-4 h-4 bg-white rounded-full shadow"></span></button></div>';
  // group by
  html += '<div class="mb-3"><div class="mb-1 font-medium">Group by</div><select onchange="optGroupBy(this.value)" class="pill-input w-full rounded-lg px-2.5 py-1.5 focus:outline-none"><option value="">None</option>';
  groupable.forEach(f => { html += '<option value="' + f.id + '"' + (view.groupBy === f.id ? ' selected' : '') + '>' + esc(f.name) + '</option>'; });
  html += '</select></div>';
  // sorts
  html += '<div class="mb-3"><div class="mb-1 font-medium">Sort <span class="text-[10px] text-tablify-clay dark:text-gray-400">(multi — top first)</span></div>';
  view.sorts.forEach((s, i) => {
    const f = getField(doc, s.fieldId);
    if (!f) return;
    html += '<div class="flex items-center gap-1.5 mb-1">' +
      '<span class="flex-1 truncate px-2 py-1 rounded-lg bg-tablify-paper-inner dark:bg-tablify-dark-inner border border-tablify-paper-border dark:border-tablify-dark-border">' + esc(f.name) + '</span>' +
      '<button onclick="optSortDir(' + i + ')" class="pill-btn px-2 py-1 rounded-lg font-mono text-[10px]">' + (s.dir === 1 ? 'A→Z' : 'Z→A') + '</button>' +
      '<button onclick="optSortRemove(' + i + ')" class="text-tablify-clay dark:text-gray-400 hover:text-rose-500 px-1"><i class="fa-solid fa-xmark text-[10px]"></i></button></div>';
  });
  html += '<select onchange="optSortAdd(this.value);this.value=\'\'" class="pill-input w-full rounded-lg px-2.5 py-1.5 focus:outline-none"><option value="">+ Add sort…</option>';
  doc.fields.filter(f => !view.sorts.some(s => s.fieldId === f.id)).forEach(f => { html += '<option value="' + f.id + '">' + esc(f.name) + '</option>'; });
  html += '</select></div>';
  // hide/show fields
  html += '<div class="mb-3"><div class="mb-1 font-medium">Fields <span class="text-[10px] text-tablify-clay dark:text-gray-400">(' + view.hidden.length + ' hidden)</span></div><div class="max-h-36 overflow-y-auto space-y-0.5 pr-1">';
  const order = view.order.filter(fid => getField(doc, fid));
  doc.fields.forEach(f => { if (!order.includes(f.id)) order.push(f.id); });
  order.forEach(fid => {
    const f = getField(doc, fid);
    const hidden = view.hidden.includes(fid);
    html += '<div class="flex items-center justify-between gap-2 px-1.5 py-0.5 rounded hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner">' +
      '<span class="truncate ' + (hidden ? 'text-tablify-clay/60 dark:text-gray-500 line-through' : '') + '">' + esc(f.name) + '</span>' +
      '<button onclick="optFieldVis(\'' + fid + '\')" class="text-[10px] font-medium px-2 py-0.5 rounded-full ' + (hidden ? 'bg-tablify-terracotta text-white' : 'pill-btn') + '">' + (hidden ? 'Show' : 'Hide') + '</button></div>';
  });
  html += '</div></div>';
  html += '<button onclick="optClearFilters()" class="w-full pill-btn rounded-xl py-1.5 text-[11px]"><i class="fa-solid fa-filter-circle-xmark mr-1 text-tablify-terracotta"></i>Clear search & filters</button>';
  html += '</div>';
  openPanel(document.getElementById('optionsBtn'), html, { kind: 'options' });
}
function optRowHeight(h) { docView(activeDoc()).rowHeight = h; save(); renderGrid(); renderOptionsPanel(); }
function optFreeze() { const v = docView(activeDoc()); v.freezePrimary = !freezeEnabled(v); save(); renderGrid(); renderOptionsPanel(); }
function optGroupBy(fid) { const v = docView(activeDoc()); v.groupBy = fid || null; v.collapsed = []; save(); renderGrid(); renderOptionsPanel(); }
function optSortAdd(fid) { if (!fid) return; docView(activeDoc()).sorts.push({ fieldId: fid, dir: 1 }); save(); renderGrid(); renderOptionsPanel(); }
function optSortDir(i) { const s = docView(activeDoc()).sorts[i]; s.dir = -s.dir; save(); renderGrid(); renderOptionsPanel(); }
function optSortRemove(i) { docView(activeDoc()).sorts.splice(i, 1); save(); renderGrid(); renderOptionsPanel(); }
function optFieldVis(fid) {
  const v = docView(activeDoc());
  const i = v.hidden.indexOf(fid);
  if (i >= 0) v.hidden.splice(i, 1); else v.hidden.push(fid);
  save(); renderGrid(); renderOptionsPanel();
}
function optClearFilters() {
  document.getElementById('searchInput').value = '';
  save(); renderGrid(); renderOptionsPanel();
  showToast('Search & filters cleared');
}

// ===== Feature 6: filter builder (round-trips with the query string) =====
let FB = [];
let FBglobal = '';
function fbOpsFor(type) {
  if (type === 'multi_select') return [['', 'contains any of'], ['!', 'does not contain'], ['empty', 'is empty']];
  if (type === 'single_select') return [['', 'is'], ['!', 'is not'], ['empty', 'is empty']];
  if (type === 'checkbox') return [['', 'is'], ['empty', 'is empty']];
  if (['number', 'currency', 'percent', 'duration', 'rating', 'auto_number'].includes(type)) return [['', '='], ['>', '>'], ['<', '<'], ['!', '≠'], ['empty', 'is empty']];
  if (['date', 'date_time', 'created_time', 'modified_time'].includes(type)) return [['', 'is'], ['>', 'is after'], ['<', 'is before'], ['empty', 'is empty']];
  return [['', 'is'], ['~', 'contains'], ['!', 'is not'], ['empty', 'is empty']];
}
function openFilterBuilder() {
  const doc = activeDoc();
  const parsed = parseQuery(document.getElementById('searchInput').value);
  FBglobal = parsed.global;
  FB = parsed.terms.map(t => {
    const f = findFieldByName(doc, t.field);
    return { fieldId: f ? f.id : doc.fields[0].id, op: t.op, value: t.values.join(', ') };
  });
  if (!FB.length) FB.push({ fieldId: doc.fields[0].id, op: '', value: '' });
  renderFilterBuilder();
  document.getElementById('filterModal').classList.remove('hidden');
}
function closeFilterBuilder() { document.getElementById('filterModal').classList.add('hidden'); }
function renderFilterBuilder() {
  const doc = activeDoc();
  const host = document.getElementById('filterBody');
  let html = '';
  FB.forEach((c, i) => {
    const field = getField(doc, c.fieldId) || doc.fields[0];
    const ops = fbOpsFor(field.type);
    html += '<div class="flex items-center gap-1.5 flex-wrap sm:flex-nowrap">' +
      '<span class="text-[10px] text-tablify-clay dark:text-gray-400 w-10 shrink-0 font-mono">' + (i === 0 ? 'Where' : 'and') + '</span>' +
      '<select onchange="fbField(' + i + ',this.value)" class="pill-input rounded-lg px-2 py-1.5 text-xs focus:outline-none flex-1 min-w-[110px]">';
    doc.fields.forEach(f => { html += '<option value="' + f.id + '"' + (f.id === c.fieldId ? ' selected' : '') + '>' + esc(f.name) + '</option>'; });
    html += '</select><select onchange="fbOp(' + i + ',this.value)" class="pill-input rounded-lg px-2 py-1.5 text-xs focus:outline-none w-[120px]">';
    ops.forEach(([op, label]) => { html += '<option value="' + op + '"' + (op === c.op ? ' selected' : '') + '>' + label + '</option>'; });
    html += '</select>';
    if (c.op !== 'empty') {
      if (field.type === 'single_select' || field.type === 'multi_select') {
        html += '<select onchange="fbValue(' + i + ',this.value)" class="pill-input rounded-lg px-2 py-1.5 text-xs focus:outline-none flex-1 min-w-[100px]"><option value="">—</option>';
        (field.options || []).forEach(o => { html += '<option value="' + escAttr(o.name) + '"' + (o.name === c.value ? ' selected' : '') + '>' + esc(o.name) + '</option>'; });
        html += '</select>';
      } else if (field.type === 'checkbox') {
        html += '<select onchange="fbValue(' + i + ',this.value)" class="pill-input rounded-lg px-2 py-1.5 text-xs focus:outline-none w-[90px]"><option value="true"' + (c.value !== 'false' ? ' selected' : '') + '>true</option><option value="false"' + (c.value === 'false' ? ' selected' : '') + '>false</option></select>';
      } else {
        html += '<input type="text" value="' + escAttr(c.value) + '" onchange="fbValue(' + i + ',this.value)" placeholder="value (a,b = any of)" class="pill-input rounded-lg px-2 py-1.5 text-xs focus:outline-none flex-1 min-w-[100px]">';
      }
    }
    html += '<button onclick="fbRemove(' + i + ')" class="text-tablify-clay dark:text-gray-400 hover:text-rose-500 px-1 shrink-0"><i class="fa-solid fa-trash-can text-[11px]"></i></button></div>';
  });
  host.innerHTML = html || '<div class="text-[11px] text-tablify-clay dark:text-gray-400">No conditions — click “Add condition”.</div>';
  document.getElementById('filterPreview').textContent = fbBuildQuery() || '(no filter)';
}
function fbField(i, v) { FB[i].fieldId = v; FB[i].op = ''; FB[i].value = ''; renderFilterBuilder(); }
function fbOp(i, v) { FB[i].op = v; renderFilterBuilder(); }
function fbValue(i, v) { FB[i].value = v; renderFilterBuilder(); }
function fbRemove(i) { FB.splice(i, 1); renderFilterBuilder(); }
function fbAdd() { FB.push({ fieldId: activeDoc().fields[0].id, op: '', value: '' }); renderFilterBuilder(); }
function fbQuoteName(name) { return /[\s:,"~!<>]/.test(name) ? '"' + name.replace(/"/g, '""') + '"' : name; }
function fbQuoteValue(v) { return /[\s:"]/.test(v) ? '"' + v.replace(/"/g, '""') + '"' : v; }
function fbBuildQuery() {
  const doc = activeDoc();
  const parts = [];
  if (FBglobal) parts.push(FBglobal);
  FB.forEach(c => {
    const f = getField(doc, c.fieldId);
    if (!f) return;
    if (c.op === 'empty') { parts.push(fbQuoteName(f.name) + ':empty'); return; }
    const val = String(c.value || '').trim();
    if (!val) return;
    const vals = val.split(',').map(s => s.trim()).filter(Boolean).map(fbQuoteValue).join(',');
    parts.push(fbQuoteName(f.name) + ':' + c.op + vals);
  });
  return parts.join(' ');
}
function fbApply() {
  document.getElementById('searchInput').value = fbBuildQuery();
  closeFilterBuilder();
  renderGrid();
  showToast('Filter applied — same result as the query string');
}
function fbClearAll() { FB = []; FBglobal = ''; renderFilterBuilder(); }


// ===== Feature 8: undo / redo (snapshot CommandStack) =====
function undo() {
  if (!UNDO.length) { showToast('Nothing to undo'); return; }
  const snap = UNDO.pop();
  REDO.push({ label: snap.label, snap: JSON.stringify({ docs: state.docs, active: state.active }) });
  const data = JSON.parse(snap.snap);
  state.docs = data.docs;
  if (!state.docs.some(d => d.tableId === state.active)) state.active = data.active;
  state.editing = null;
  save(); renderAll();
  showToast('Undid: ' + snap.label);
}
function redo() {
  if (!REDO.length) { showToast('Nothing to redo'); return; }
  const snap = REDO.pop();
  UNDO.push({ label: snap.label, snap: JSON.stringify({ docs: state.docs, active: state.active }) });
  const data = JSON.parse(snap.snap);
  state.docs = data.docs;
  if (!state.docs.some(d => d.tableId === state.active)) state.active = data.active;
  state.editing = null;
  save(); renderAll();
  showToast('Redid: ' + snap.label);
}

// ===== Feature 9: keyboard navigation + range copy/paste =====
let _invalid = {};
let _rangeSet = new Set();
let _clip = '';
function visibleRowList(doc) {
  const view = docView(doc);
  let rows = pipelineRows(doc);
  const gf = view.groupBy ? getField(doc, view.groupBy) : null;
  if (gf) rows = rows.filter(r => !view.collapsed.includes(cellText(doc, r, gf) || '(empty)'));
  return rows;
}
function computeRangeSet(doc) {
  const s = new Set();
  if (!state.anchor || !state.focus) return s;
  const rows = visibleRowList(doc), fields = visibleFields(doc);
  const r1 = rows.findIndex(r => r.id === state.anchor.rowId), r2 = rows.findIndex(r => r.id === state.focus.rowId);
  const c1 = fields.findIndex(f => f.id === state.anchor.fieldId), c2 = fields.findIndex(f => f.id === state.focus.fieldId);
  if (r1 < 0 || r2 < 0 || c1 < 0 || c2 < 0) return s;
  for (let r = Math.min(r1, r2); r <= Math.max(r1, r2); r++)
    for (let c = Math.min(c1, c2); c <= Math.max(c1, c2); c++)
      s.add(rows[r].id + '|' + fields[c].id);
  if (s.size <= 1) s.clear();
  return s;
}
function anyModalOpen() {
  const ids = ['addFieldModal', 'optMgrModal', 'sourceModal', 'filterModal', 'importModal', 'exportModal', 'syncModal', 'conflictModal', 'peekModal', 'checklistModal'];
  for (const id of ids) {
    const el = document.getElementById(id);
    if (el && !el.classList.contains('hidden')) return true;
  }
  const fp = document.getElementById('floatPanel');
  if (fp && !fp.classList.contains('hidden')) return true;
  if (state.editing) return true;
  const ae = document.activeElement;
  if (ae && (ae.tagName === 'INPUT' || ae.tagName === 'TEXTAREA' || ae.isContentEditable)) return true;
  return false;
}
function moveFocus(dr, dc, extend) {
  const doc = activeDoc();
  const rows = visibleRowList(doc), fields = visibleFields(doc);
  if (!rows.length || !fields.length) return;
  let r = state.focus ? rows.findIndex(x => x.id === state.focus.rowId) : 0;
  let c = state.focus ? fields.findIndex(f => f.id === state.focus.fieldId) : 0;
  if (r < 0) r = 0;
  if (c < 0) c = 0;
  c += dc; r += dr;
  if (c >= fields.length) { c = 0; r++; }
  if (c < 0) { c = fields.length - 1; r--; }
  r = Math.max(0, Math.min(rows.length - 1, r));
  c = Math.max(0, Math.min(fields.length - 1, c));
  const next = { rowId: rows[r].id, fieldId: fields[c].id };
  if (extend) { if (!state.anchor) state.anchor = state.focus ? { rowId: state.focus.rowId, fieldId: state.focus.fieldId } : next; }
  else state.anchor = next;
  state.focus = next;
  renderGrid();
  const td = document.querySelector('td[data-row="' + next.rowId + '"][data-fld="' + next.fieldId + '"]');
  if (td && td.scrollIntoView) td.scrollIntoView({ block: 'nearest', inline: 'nearest' });
}
function focusedCellRange(doc) {
  const rows = visibleRowList(doc), fields = visibleFields(doc);
  if (_rangeSet.size) {
    const rr = rows.filter(r => fields.some(f => _rangeSet.has(r.id + '|' + f.id)));
    const ff = fields.filter(f => rr.some(r => _rangeSet.has(r.id + '|' + f.id)));
    return { rows: rr, fields: ff };
  }
  if (state.focus) {
    const r = rows.find(x => x.id === state.focus.rowId), f = fields.find(x => x.id === state.focus.fieldId);
    if (r && f) return { rows: [r], fields: [f] };
  }
  return null;
}
function copyRange() {
  const doc = activeDoc();
  const sel = focusedCellRange(doc);
  if (!sel) { showToast('Select a cell first'); return; }
  const tsv = sel.rows.map(r => sel.fields.map(f => cellText(doc, r, f).replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t')).join('\n');
  _clip = tsv;
  navigator.clipboard.writeText(tsv).then(() => {}).catch(() => {});
  showToast('Copied ' + sel.rows.length + '×' + sel.fields.length + ' cell' + (sel.rows.length * sel.fields.length === 1 ? '' : 's') + ' (tab-separated)');
}
function pasteRange() {
  const doc = activeDoc();
  if (!state.focus) { showToast('Select a target cell first'); return; }
  const apply = text => {
    if (!text) { showToast('Clipboard is empty'); return; }
    const lines = text.replace(/\r/g, '').split('\n');
    while (lines.length && lines[lines.length - 1] === '') lines.pop();
    const rows = visibleRowList(doc), fields = visibleFields(doc);
    const r0 = rows.findIndex(r => r.id === state.focus.rowId), c0 = fields.findIndex(f => f.id === state.focus.fieldId);
    if (r0 < 0 || c0 < 0) return;
    let applied = 0, skipped = 0;
    mutate('Paste', () => {
      lines.forEach((line, i) => {
        const cols = line.split('\t');
        cols.forEach((val, j) => {
          const row = rows[r0 + i], field = fields[c0 + j];
          if (!row || !field) { skipped++; return; }
          if (FT[field.type].readOnly) { skipped++; return; }
          if (val === '') { delete row.cells[field.id]; row.modifiedTime = nowIso(); applied++; return; }
          const parsed = FT[field.type].parse(val, field, doc);
          if (parsed === null || parsed === undefined) { skipped++; return; }
          setCell(doc, row, field, parsed);
          applied++;
        });
      });
    });
    showToast('Pasted ' + applied + ' cell' + (applied === 1 ? '' : 's') + (skipped ? ' (' + skipped + ' skipped)' : ''));
  };
  if (navigator.clipboard && navigator.clipboard.readText) {
    navigator.clipboard.readText().then(apply).catch(() => apply(_clip));
  } else apply(_clip);
}
function gridKeyHandler(e) {
  const mod = e.ctrlKey || e.metaKey;
  const modalOpen = anyModalOpen();
  if (mod && (e.key === 'z' || e.key === 'Z')) {
    if (modalOpen) return;
    e.preventDefault();
    if (e.shiftKey) redo(); else undo();
    return;
  }
  if (mod && (e.key === 'y' || e.key === 'Y')) {
    if (modalOpen) return;
    e.preventDefault(); redo(); return;
  }
  if (modalOpen) return;
  if (mod && (e.key === 'c' || e.key === 'C')) { e.preventDefault(); copyRange(); return; }
  if (mod && (e.key === 'v' || e.key === 'V')) { e.preventDefault(); pasteRange(); return; }
  if (e.key === 'ArrowUp') { e.preventDefault(); moveFocus(-1, 0, e.shiftKey); return; }
  if (e.key === 'ArrowDown') { e.preventDefault(); moveFocus(1, 0, e.shiftKey); return; }
  if (e.key === 'ArrowLeft') { e.preventDefault(); moveFocus(0, -1, e.shiftKey); return; }
  if (e.key === 'ArrowRight') { e.preventDefault(); moveFocus(0, 1, e.shiftKey); return; }
  if (e.key === 'Tab') { e.preventDefault(); moveFocus(0, e.shiftKey ? -1 : 1, false); return; }
  if (e.key === 'Enter') {
    if (!state.focus) return;
    e.preventDefault();
    const doc = activeDoc();
    const field = getField(doc, state.focus.fieldId);
    if (!field) return;
    const ft = FT[field.type];
    const td = document.querySelector('td[data-row="' + state.focus.rowId + '"][data-fld="' + state.focus.fieldId + '"] > div');
    if (ft.readOnly) { showToast(ft.label + ' is read-only'); return; }
    if (ft.editor === 'select') { if (td) openSelectPanel(td, state.focus.rowId, state.focus.fieldId); return; }
    if (ft.editor === 'attachment') { if (td) openAttachmentPanel(td, state.focus.rowId, state.focus.fieldId); return; }
    if (ft.editor === 'link') { if (td) openLinkPanel(td, state.focus.rowId, state.focus.fieldId); return; }
    if (ft.editor === 'checkbox') { const row = doc.rows.find(r => r.id === state.focus.rowId); mutate('Toggle checkbox', () => setCell(doc, row, field, !getCell(doc, row, field))); return; }
    if (ft.editor === 'rating') { showToast('Click a star to rate'); return; }
    startEdit(state.focus.rowId, state.focus.fieldId);
    return;
  }
  if (e.key === 'Escape') { state.anchor = null; state.focus = null; renderGrid(); return; }
}
document.addEventListener('keydown', gridKeyHandler);

// ===== Feature 9: shortcuts help =====
function openShortcuts() {
  const rows = [
    ['Arrow keys', 'Move selection'],
    ['Shift + arrows / Shift-click', 'Extend range'],
    ['Tab / Shift+Tab', 'Next / previous cell'],
    ['Enter', 'Edit cell / commit'],
    ['Escape', 'Cancel edit / clear selection'],
    ['Ctrl/Cmd+Z', 'Undo'],
    ['Ctrl/Cmd+Shift+Z · Ctrl/Cmd+Y', 'Redo'],
    ['Ctrl/Cmd+C', 'Copy range (tab-separated)'],
    ['Ctrl/Cmd+V', 'Paste range']
  ];
  let html = '<div class="p-3 text-xs w-[280px]"><div class="text-[11px] font-semibold font-serif uppercase tracking-wider text-tablify-clay dark:text-gray-400 mb-2">Keyboard shortcuts (docs/shortcuts.md)</div><table class="w-full">';
  rows.forEach(([k, v]) => {
    html += '<tr><td class="py-1 pr-2 font-mono text-[10px] whitespace-nowrap align-top">' + esc(k) + '</td><td class="py-1 text-tablify-clay dark:text-gray-400">' + esc(v) + '</td></tr>';
  });
  html += '</table></div>';
  openPanel(document.getElementById('shortcutsBtn'), html, { kind: 'shortcuts' });
}

// ===== Feature 10: validation =====
function validateCell(doc, field, row) {
  const v = getCell(doc, row, field);
  const empty = cellIsEmpty(v);
  if (field.required && empty) return 'Required';
  if (empty) return null;
  if (field.unique) {
    const t = cellText(doc, row, field);
    for (const r of doc.rows) {
      if (r.id !== row.id && cellText(doc, r, field) === t) return 'Must be unique';
    }
  }
  if (field.min != null && field.min !== '') {
    const k = compareKey(field, v);
    const q = typeof field.min === 'number' ? field.min : parseCompareValue(field, String(field.min));
    if (k != null && q != null && !isNaN(k) && k < q) return 'Below min (' + field.min + ')';
  }
  if (field.max != null && field.max !== '') {
    const k = compareKey(field, v);
    const q = typeof field.max === 'number' ? field.max : parseCompareValue(field, String(field.max));
    if (k != null && q != null && !isNaN(k) && k > q) return 'Above max (' + field.max + ')';
  }
  if (field.regex) {
    try {
      const re = new RegExp(field.regex);
      if (!re.test(FT[field.type].toText(v, field, doc))) return 'Does not match pattern ' + field.regex;
    } catch (e) {}
  }
  return null;
}
function computeInvalid(doc) {
  const out = {};
  doc.rows.forEach(r => {
    doc.fields.forEach(f => {
      const msg = validateCell(doc, f, r);
      if (msg) { (out[r.id] = out[r.id] || {})[f.id] = f.name + ': ' + msg; }
    });
  });
  return out;
}


// ===== generic context menu =====
let _menuItems = [];
function openPanelAt(x, y, html) {
  const p = document.getElementById('floatPanel');
  p.innerHTML = html;
  p.classList.remove('hidden');
  panelCtx = { kind: 'menu' };
  p.style.left = Math.max(8, Math.min(x, window.innerWidth - 220)) + 'px';
  p.style.top = y + 'px';
  const h = p.getBoundingClientRect().height;
  if (y + h > window.innerHeight - 8) p.style.top = Math.max(8, y - h) + 'px';
}
function menuShow(x, y, items) {
  _menuItems = items;
  let html = '<div class="py-1.5 text-xs min-w-[195px]">';
  items.forEach((it, i) => {
    if (it === '-') { html += '<div class="my-1 border-t border-tablify-paper-border dark:border-tablify-dark-border"></div>'; return; }
    html += '<button onclick="menuAct(' + i + ')" class="w-full text-left px-3.5 py-1.5 hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner flex items-center gap-2 ' + (it.danger ? 'text-rose-500' : '') + '">' +
      '<i class="fa-solid ' + it.icon + ' text-[10px] w-3.5 ' + (it.danger ? '' : 'text-tablify-terracotta') + '"></i>' + esc(it.label) + '</button>';
  });
  html += '</div>';
  openPanelAt(x, y, html);
}
function menuAct(i) {
  const it = _menuItems[i];
  closePanel();
  if (it && it.fn) it.fn();
}

// ===== Feature 17: table context menus (cell / row / column header) =====
document.addEventListener('contextmenu', ev => {
  const table = document.getElementById('mainTable');
  if (!table || !table.contains(ev.target)) return;
  const th = ev.target.closest('th[data-fld]');
  const tdCell = ev.target.closest('td[data-fld]');
  const tr = ev.target.closest('tr[data-row]');
  ev.preventDefault();
  if (th) { headerCtxMenu(ev, th.getAttribute('data-fld')); return; }
  if (tdCell) { cellCtxMenu(ev, tdCell.getAttribute('data-row'), tdCell.getAttribute('data-fld')); return; }
  if (tr) { rowCtxMenu(ev, tr.getAttribute('data-row')); return; }
});
function cellCtxMenu(ev, rowId, fieldId) {
  state.focus = { rowId: rowId, fieldId: fieldId };
  state.anchor = { rowId: rowId, fieldId: fieldId };
  renderGrid();
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  menuShow(ev.clientX, ev.clientY, [
    { icon: 'fa-copy', label: 'Copy', fn: copyRange },
    { icon: 'fa-paste', label: 'Paste', fn: pasteRange },
    { icon: 'fa-eraser', label: 'Clear', fn: () => {
        const row = doc.rows.find(r => r.id === rowId);
        if (FT[field.type].readOnly) { showToast('Read-only cell'); return; }
        mutate('Clear cell', () => { delete row.cells[fieldId]; row.modifiedTime = nowIso(); });
      } }
  ]);
}
function rowCtxMenu(ev, rowId) {
  const doc = activeDoc();
  menuShow(ev.clientX, ev.clientY, [
    { icon: 'fa-arrow-up', label: 'Insert row above', fn: () => insertRowAt(rowId, 0) },
    { icon: 'fa-arrow-down', label: 'Insert row below', fn: () => insertRowAt(rowId, 1) },
    { icon: 'fa-clone', label: 'Duplicate row', fn: () => duplicateRow(rowId) },
    { icon: 'fa-copy', label: 'Copy row', fn: () => copyRow(rowId) },
    '-',
    { icon: 'fa-trash-can', label: 'Delete row', danger: true, fn: () => {
        mutate('Delete row', () => { doc.rows = doc.rows.filter(r => r.id !== rowId); });
        showToast('Row deleted');
      } }
  ]);
}
function headerCtxMenu(ev, fieldId) {
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const view = docView(doc);
  const items = [
    { icon: 'fa-gear', label: 'Change field type / settings', fn: () => showAddFieldModal(fieldId) }
  ];
  if (field.type === 'single_select' || field.type === 'multi_select') {
    items.push({ icon: 'fa-palette', label: 'Manage options', fn: () => openOptMgr(fieldId) });
  }
  items.push('-',
    { icon: 'fa-eye-slash', label: 'Hide field', fn: () => { if (!view.hidden.includes(fieldId)) view.hidden.push(fieldId); save(); renderGrid(); } },
    { icon: 'fa-arrow-down-a-z', label: 'Sort ascending', fn: () => { view.sorts = [{ fieldId: fieldId, dir: 1 }]; save(); renderGrid(); } },
    { icon: 'fa-arrow-up-z-a', label: 'Sort descending', fn: () => { view.sorts = [{ fieldId: fieldId, dir: -1 }]; save(); renderGrid(); } },
    { icon: 'fa-snowflake', label: freezeEnabled(view) ? 'Unfreeze primary column' : 'Freeze primary column', fn: () => { view.freezePrimary = !freezeEnabled(view); save(); renderGrid(); } });
  if (!field.primary) {
    items.push('-', { icon: 'fa-trash-can', label: 'Delete field', danger: true, fn: () => deleteFieldFromMenu(fieldId) });
  }
  menuShow(ev.clientX, ev.clientY, items);
}
function insertRowAt(rowId, offset) {
  const doc = activeDoc();
  const i = doc.rows.findIndex(r => r.id === rowId);
  if (i < 0) return;
  mutate('Insert row', () => { doc.rows.splice(i + offset, 0, makeRow(doc, {})); });
  showToast('Row inserted');
}
function duplicateRow(rowId) {
  const doc = activeDoc();
  const i = doc.rows.findIndex(r => r.id === rowId);
  if (i < 0) return;
  mutate('Duplicate row', () => {
    const src = doc.rows[i];
    const copy = makeRow(doc, deepCopy(src.cells));
    doc.rows.splice(i + 1, 0, copy);
  });
  showToast('Row duplicated');
}
function copyRow(rowId) {
  const doc = activeDoc();
  const row = doc.rows.find(r => r.id === rowId);
  if (!row) return;
  const tsv = visibleFields(doc).map(f => cellText(doc, row, f).replace(/\t/g, ' ').replace(/\n/g, ' ')).join('\t');
  _clip = tsv;
  navigator.clipboard.writeText(tsv).then(() => {}).catch(() => {});
  showToast('Row copied (tab-separated)');
}

// ===== Feature 16: mock vault sidebar (Obsidian file-menu simulation) =====
function renderSidebar() {
  const host = document.getElementById('vaultTree');
  if (!host) return;
  let html = '<div class="flex items-center justify-between px-1.5 py-1 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner cursor-default" oncontextmenu="folderCtxMenu(event)">' +
    '<span class="font-medium"><i class="fa-solid fa-folder-open text-tablify-terracotta mr-1.5"></i>Tables</span>' +
    '<button onclick="folderCtxMenu(event)" class="text-tablify-clay dark:text-gray-400 hover:text-tablify-charcoal dark:hover:text-white w-5"><i class="fa-solid fa-ellipsis text-[10px]"></i></button></div>';
  state.docs.forEach(d => {
    const on = d.tableId === state.active && state.uiView === 'grid';
    html += '<div class="flex items-center justify-between pl-5 pr-1.5 py-1 rounded-lg cursor-pointer ' + (on ? 'bg-tablify-terracotta/10 text-tablify-terracotta' : 'hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner') + '" onclick="switchTable(\'' + d.tableId + '\')" oncontextmenu="fileCtxMenu(event,\'' + d.tableId + '\')">' +
      '<span class="truncate font-mono text-[10px]"><i class="fa-solid fa-table-cells mr-1.5 ' + (on ? '' : 'text-tablify-terracotta') + '"></i>' + esc(d.name.replace(/[\\\\/:*?"<>|]/g, '_')) + '.tablify</span>' +
      '<button onclick="event.stopPropagation();fileCtxMenu(event,\'' + d.tableId + '\')" class="text-tablify-clay dark:text-gray-400 hover:text-tablify-charcoal dark:hover:text-white w-5 shrink-0"><i class="fa-solid fa-ellipsis text-[10px]"></i></button></div>';
  });
  html += '<div class="px-1.5 py-1 mt-1"><span class="font-medium"><i class="fa-solid fa-folder text-tablify-clay/70 dark:text-gray-500 mr-1.5"></i>Assets</span></div>';
  ['photo.png', 'bench.csv', 'grid-mock.png'].forEach(f => {
    html += '<div class="pl-5 pr-1.5 py-0.5 text-tablify-clay/70 dark:text-gray-500 font-mono text-[10px] cursor-default"><i class="fa-regular fa-file mr-1.5"></i>' + f + '</div>';
  });
  html += '<div class="px-1.5 py-1 mt-1 rounded-lg cursor-pointer ' + (state.uiView === 'note' ? 'bg-tablify-terracotta/10 text-tablify-terracotta' : 'hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner') + '" onclick="noteClick()">' +
    '<span class="font-mono text-[10px]"><i class="fa-regular fa-file-lines mr-1.5 text-tablify-terracotta"></i>Project Notes.md</span></div>';
  host.innerHTML = html;
}
function fileCtxMenu(ev, tableId) {
  ev.preventDefault(); ev.stopPropagation();
  menuShow(ev.clientX, ev.clientY, [
    { icon: 'fa-folder-open', label: 'Open', fn: () => switchTable(tableId) },
    { icon: 'fa-clone', label: 'Duplicate', fn: () => duplicateTable(tableId) },
    { icon: 'fa-file-export', label: 'Export', fn: () => { switchTable(tableId); openExportModal(); } }
  ]);
}
function folderCtxMenu(ev) {
  ev.preventDefault(); ev.stopPropagation();
  menuShow(ev.clientX, ev.clientY, [
    { icon: 'fa-plus', label: 'New table', fn: addNewTable },
    { icon: 'fa-file-import', label: 'Import CSV / Excel as table', fn: openImportModal }
  ]);
}
function duplicateTable(tableId) {
  const src = state.docs.find(d => d.tableId === tableId);
  if (!src) return;
  const copy = deepCopy(src);
  copy.tableId = uid('tbl');
  copy.name = src.name + ' copy';
  copy.views.forEach(v => { v.id = uid('viw'); });
  mutate('Duplicate table', () => { state.docs.push(copy); state.active = copy.tableId; });
  showToast('Duplicated table');
}

// ===== Feature 14: CSV / Excel import with type inference =====
function parseCSV(text) {
  const rows = [];
  let row = [], cur = '', inQ = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQ) {
      if (ch === '"') { if (text[i + 1] === '"') { cur += '"'; i++; } else inQ = false; }
      else cur += ch;
    } else if (ch === '"') inQ = true;
    else if (ch === ',') { row.push(cur); cur = ''; }
    else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i++;
      row.push(cur); cur = ''; rows.push(row); row = [];
    } else cur += ch;
  }
  if (cur !== '' || row.length) { row.push(cur); rows.push(row); }
  return rows.filter(r => r.length > 1 || (r[0] || '').trim() !== '');
}
function inferColumnType(vals) {
  const ne = vals.map(v => String(v).trim()).filter(v => v !== '');
  if (!ne.length) return 'text';
  if (ne.every(v => /^(true|false|yes|no|x|✓|0|1)$/i.test(v)) && ne.some(v => /^(true|false|yes|no|x|✓)$/i.test(v))) return 'checkbox';
  if (ne.every(v => !isNaN(Number(v.replace(/,/g, ''))))) return 'number';
  if (ne.every(v => /^\d{4}-\d{2}-\d{2}$/.test(v) || /^\d{1,2}\/\d{1,2}\/\d{2,4}$/.test(v))) return 'date';
  const distinct = Array.from(new Set(ne));
  if (ne.length >= 5 && distinct.length <= 8 && distinct.length <= ne.length / 2) return 'single_select';
  return 'text';
}
let IMP = null;
function openImportModal() {
  IMP = null;
  document.getElementById('importStep1').classList.remove('hidden');
  document.getElementById('importStep2').classList.add('hidden');
  document.getElementById('importText').value = '';
  document.getElementById('importXlsxNote').classList.add('hidden');
  document.getElementById('importModal').classList.remove('hidden');
}
function closeImportModal() { document.getElementById('importModal').classList.add('hidden'); IMP = null; }
function importFilePicked(input) {
  const file = input.files && input.files[0];
  if (!file) return;
  if (/\.xlsx?$/i.test(file.name)) {
    // XLSX is UI-only in the prototype (D-O2 / P4-02 spike decides the real library)
    document.getElementById('importXlsxNote').classList.remove('hidden');
    document.getElementById('importText').value =
      'Task,Owner,Points,Done,Start\nDesign tokens,mila,5,yes,2026-10-01\nQuery parser,rahim,8,no,2026-10-05\nCSV import,sara,3,no,2026-10-07\nDocs pass,tom,2,yes,2026-10-02\nBench run,mila,5,no,2026-10-03\nRelease prep,rahim,8,no,2026-10-09';
    document.getElementById('importName').value = file.name.replace(/\.xlsx?$/i, '');
    showToast('XLSX parsing simulated — converted sample loaded (UI-only)');
    return;
  }
  const reader = new FileReader();
  reader.onload = () => {
    document.getElementById('importText').value = String(reader.result || '');
    document.getElementById('importName').value = file.name.replace(/\.csv$/i, '');
  };
  reader.readAsText(file);
}
function importLoad() {
  const text = document.getElementById('importText').value;
  const grid = parseCSV(text);
  if (grid.length < 2) { showToast('Need a header row plus at least one data row'); return; }
  const headers = grid[0].map((h, i) => String(h).trim() || 'Column ' + (i + 1));
  const dataRows = grid.slice(1);
  const types = headers.map((h, c) => inferColumnType(dataRows.map(r => r[c] == null ? '' : String(r[c]))));
  IMP = { headers: headers, types: types, rows: dataRows, name: document.getElementById('importName').value.trim() || 'Imported table' };
  renderImportPreview();
  document.getElementById('importStep1').classList.add('hidden');
  document.getElementById('importStep2').classList.remove('hidden');
}
function renderImportPreview() {
  const host = document.getElementById('importPreview');
  let html = '<table class="w-full text-[10px] border-separate border-spacing-1"><tr>';
  IMP.headers.forEach((h, c) => {
    html += '<th class="text-left align-bottom"><div class="mb-1 font-semibold font-serif">' + esc(h) + (c === 0 ? ' <i class="fa-solid fa-key text-[8px] text-tablify-terracotta" title="Primary"></i>' : '') + '</div>' +
      '<select onchange="IMP.types[' + c + ']=this.value" class="pill-input rounded-lg px-1.5 py-1 text-[10px] focus:outline-none w-full">';
    ['text', 'long_text', 'number', 'currency', 'percent', 'date', 'checkbox', 'single_select', 'url', 'email', 'phone'].forEach(t => {
      html += '<option value="' + t + '"' + (IMP.types[c] === t ? ' selected' : '') + '>' + FT[t].label + (IMP.types[c] === t ? ' (inferred)' : '') + '</option>';
    });
    html += '</select></th>';
  });
  html += '</tr>';
  IMP.rows.slice(0, 4).forEach(r => {
    html += '<tr>' + IMP.headers.map((h, c) => '<td class="px-1.5 py-1 rounded bg-tablify-paper-inner dark:bg-tablify-dark-inner border border-tablify-paper-border dark:border-tablify-dark-border font-mono truncate max-w-[120px]">' + esc(r[c] == null ? '' : r[c]) + '</td>').join('') + '</tr>';
  });
  html += '</table>' + (IMP.rows.length > 4 ? '<div class="text-[10px] text-tablify-clay dark:text-gray-400 mt-1">… and ' + (IMP.rows.length - 4) + ' more rows</div>' : '');
  host.innerHTML = html;
}
function importCreate() {
  if (!IMP) return;
  const doc = { formatVersion: 1, tableId: uid('tbl'), name: IMP.name, fields: [], rows: [], views: [makeView()], syncLink: null, nextAutoNumber: 1 };
  IMP.headers.forEach((h, c) => {
    const type = IMP.types[c];
    const extra = c === 0 ? { primary: true } : {};
    if (type === 'single_select') {
      const distinct = Array.from(new Set(IMP.rows.map(r => String(r[c] == null ? '' : r[c]).trim()).filter(Boolean)));
      extra.options = distinct.map((n, i) => ({ id: uid('opt'), name: n, color: OPT_COLOR_NAMES[i % OPT_COLOR_NAMES.length] }));
    }
    doc.fields.push(makeField(h, type, extra));
  });
  docView(doc).order = doc.fields.map(f => f.id);
  IMP.rows.forEach(r => {
    const row = makeRow(doc, {});
    doc.fields.forEach((f, c) => {
      const raw = String(r[c] == null ? '' : r[c]).trim();
      if (!raw) return;
      const v = FT[f.type].parse(raw, f, doc);
      if (v !== null && v !== undefined) row.cells[f.id] = v;
    });
    doc.rows.push(row);
  });
  mutate('Import table', () => { state.docs.push(doc); state.active = doc.tableId; });
  closeImportModal();
  showToast('Imported "' + doc.name + '" — ' + doc.rows.length + ' rows, types inferred');
}

// ===== Feature 15: export dialog (CSV / XLSX / Markdown, scope chooser) =====
function openExportModal() {
  document.getElementById('exportModal').classList.remove('hidden');
  document.getElementById('xlsxProgress').classList.add('hidden');
}
function closeExportModal() { document.getElementById('exportModal').classList.add('hidden'); }
function exportScope() {
  const el = document.querySelector('input[name="expScope"]:checked');
  return el ? el.value : 'view';
}
function exportRun(format) {
  const doc = activeDoc();
  const scope = exportScope();
  const fields = scope === 'view' ? visibleFields(doc) : doc.fields;
  const rows = scope === 'view' ? pipelineRows(doc) : doc.rows;
  const base = doc.name.replace(/\s+/g, '_').toLowerCase();
  if (format === 'csv') {
    downloadFile(base + '.csv', buildCSV(doc, fields, rows), 'text/csv');
    closeExportModal();
    showToast('Exported CSV (' + (scope === 'view' ? 'current view' : 'full table') + ')');
  } else if (format === 'md') {
    let md = '| ' + fields.map(f => f.name.replace(/\|/g, '\\|')).join(' | ') + ' |\n';
    md += '| ' + fields.map(() => '---').join(' | ') + ' |\n';
    rows.forEach(r => { md += '| ' + fields.map(f => cellText(doc, r, f).replace(/\|/g, '\\|').replace(/\n/g, ' ')).join(' | ') + ' |\n'; });
    downloadFile(base + '.md', md, 'text/markdown');
    closeExportModal();
    showToast('Exported Markdown table (' + (scope === 'view' ? 'current view' : 'full table') + ')');
  } else if (format === 'xlsx') {
    const wrap = document.getElementById('xlsxProgress');
    const bar = document.getElementById('xlsxProgressBar');
    wrap.classList.remove('hidden');
    bar.style.width = '0%';
    let p = 0;
    const t = setInterval(() => {
      p += 20;
      bar.style.width = Math.min(100, p) + '%';
      if (p >= 100) {
        clearInterval(t);
        setTimeout(() => {
          wrap.classList.add('hidden');
          closeExportModal();
          showToast('XLSX export simulated — UI-only until the P4-02 library decision (D-O2)');
        }, 250);
      }
    }, 120);
  }
}


// ===== Feature 18: embedded table in a note (live, two-way) =====
function applyUiView() {
  const noteOn = state.uiView === 'note';
  ['titleRow', 'toolbarRow', 'metaRow'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.classList.toggle('hidden', noteOn);
  });
  const nv = document.getElementById('noteView');
  if (nv) nv.classList.toggle('hidden', !noteOn);
  const cont = document.getElementById('tableInnerContainer');
  const host = document.getElementById('embedHost');
  const anchor = document.getElementById('gridAnchor');
  if (noteOn && host && cont.parentElement !== host) host.appendChild(cont);
  if (!noteOn && anchor && cont.previousElementSibling !== anchor) anchor.after(cont);
  const ef = document.getElementById('embedFile');
  if (ef) ef.textContent = 'file: Tables/' + activeDoc().name.replace(/[\\/:*?"<>|]/g, '_') + '.tablify';
}
function noteClick() {
  state.uiView = 'note';
  state.editing = null;
  renderAll();
  showToast('Live embedded table — edits save to the source .tablify file (Feature 18)');
}
function exitNote() {
  state.uiView = 'grid';
  renderAll();
}

// ===== Feature 11 (v2): formula fields =====
let _fdepth = 0;
function round10(x) { return Math.round(x * 1e6) / 1e6; }
function evalFormulaSafe(doc, row, field) {
  try {
    _fdepth++;
    if (_fdepth > 6) throw new Error('circular reference');
    return evalFormula(doc, row, String(field.formula || ''));
  } catch (e) {
    return '#ERR: ' + e.message;
  } finally {
    _fdepth--;
  }
}
function ftok(src) {
  const toks = [];
  let i = 0;
  const n = src.length;
  while (i < n) {
    const ch = src[i];
    if (/\s/.test(ch)) { i++; continue; }
    if (/[0-9]/.test(ch) || (ch === '.' && /[0-9]/.test(src[i + 1]))) {
      let num = '';
      while (i < n && /[0-9.]/.test(src[i])) num += src[i++];
      toks.push({ t: 'num', v: Number(num) });
      continue;
    }
    if (ch === '"' || ch === "'") {
      const q = ch; i++;
      let out = '';
      while (i < n && src[i] !== q) out += src[i++];
      if (i >= n) throw new Error('unclosed string');
      i++;
      toks.push({ t: 'str', v: out });
      continue;
    }
    if (ch === '{') {
      i++;
      let out = '';
      while (i < n && src[i] !== '}') out += src[i++];
      if (i >= n) throw new Error('unclosed field reference');
      i++;
      toks.push({ t: 'ref', v: out.trim() });
      continue;
    }
    if (/[A-Za-z_]/.test(ch)) {
      let id = '';
      while (i < n && /[A-Za-z_0-9]/.test(src[i])) id += src[i++];
      toks.push({ t: 'id', v: id });
      continue;
    }
    const two = src.substr(i, 2);
    if (two === '>=' || two === '<=' || two === '!=') { toks.push({ t: two }); i += 2; continue; }
    if ('+-*/%(),&><='.indexOf(ch) >= 0) { toks.push({ t: ch }); i++; continue; }
    throw new Error('unexpected "' + ch + '"');
  }
  return toks;
}
function evalFormula(doc, row, src) {
  if (!src.trim()) return '';
  const toks = ftok(src);
  let pos = 0;
  const peek = () => toks[pos];
  const next = () => toks[pos++];
  function expect(t) { const k = next(); if (!k || k.t !== t) throw new Error('expected ' + t); return k; }
  function num(v) {
    if (typeof v === 'boolean') return v ? 1 : 0;
    if (v === '' || v == null) return 0;
    const n = Number(v);
    if (isNaN(n)) throw new Error('"' + v + '" is not a number');
    return n;
  }
  function cmpVals(l, op, r) {
    const bothNum = !isNaN(Number(l)) && !isNaN(Number(r)) && l !== '' && r !== '';
    const a = bothNum ? Number(l) : String(l).toLowerCase();
    const b = bothNum ? Number(r) : String(r).toLowerCase();
    switch (op) {
      case '>': return a > b; case '<': return a < b;
      case '>=': return a >= b; case '<=': return a <= b;
      case '=': return a === b; case '!=': return a !== b;
    }
  }
  function refVal(name) {
    const f = findFieldByName(doc, name);
    if (!f) throw new Error('unknown field {' + name + '}');
    if (f.type === 'formula') {
      const fv = evalFormulaSafe(doc, row, f);
      if (typeof fv === 'string' && fv.indexOf('#ERR') === 0) throw new Error('{' + name + '} has an error');
      return fv;
    }
    const v = getCell(doc, row, f);
    if (['number', 'currency', 'percent', 'duration', 'rating', 'auto_number'].includes(f.type)) return v == null || v === '' ? 0 : Number(v);
    if (f.type === 'checkbox') return !!v;
    return cellText(doc, row, f);
  }
  function callFn(name, args) {
    switch (name) {
      case 'SUM': return args.reduce((a, v) => a + num(v), 0);
      case 'IF': {
        if (args.length < 2) throw new Error('IF needs 2-3 arguments');
        let c = args[0];
        if (typeof c === 'string') c = c !== '' && c.toLowerCase() !== 'false';
        return c ? args[1] : (args.length > 2 ? args[2] : '');
      }
      case 'CONCAT': return args.map(v => v == null ? '' : String(v)).join('');
      case 'DATEDIFF': {
        if (args.length !== 2) throw new Error('DATEDIFF needs 2 dates');
        const a = new Date(String(args[0]).length === 10 ? args[0] + 'T00:00:00' : args[0]);
        const b = new Date(String(args[1]).length === 10 ? args[1] + 'T00:00:00' : args[1]);
        if (isNaN(a) || isNaN(b)) throw new Error('invalid date in DATEDIFF');
        return Math.round((a - b) / 86400000);
      }
      case 'ROUND': return args.length > 1 ? Math.round(num(args[0]) * Math.pow(10, num(args[1]))) / Math.pow(10, num(args[1])) : Math.round(num(args[0]));
      case 'MIN': return Math.min.apply(null, args.map(num));
      case 'MAX': return Math.max.apply(null, args.map(num));
      case 'ABS': return Math.abs(num(args[0]));
      default: throw new Error('unknown function ' + name);
    }
  }
  function parsePrim() {
    const k = next();
    if (!k) throw new Error('unexpected end');
    if (k.t === 'num') return k.v;
    if (k.t === 'str') return k.v;
    if (k.t === 'ref') return refVal(k.v);
    if (k.t === '(') { const v = parseExpr(); expect(')'); return v; }
    if (k.t === 'id') {
      expect('(');
      const args = [];
      if (peek() && peek().t !== ')') {
        args.push(parseExpr());
        while (peek() && peek().t === ',') { next(); args.push(parseExpr()); }
      }
      expect(')');
      return callFn(k.v.toUpperCase(), args);
    }
    throw new Error('unexpected ' + k.t);
  }
  function parseUn() { if (peek() && peek().t === '-') { next(); return -num(parseUn()); } return parsePrim(); }
  function parseMul() {
    let l = parseUn();
    while (peek() && ['*', '/', '%'].includes(peek().t)) {
      const op = next().t;
      const r = parseUn();
      l = op === '*' ? num(l) * num(r) : op === '/' ? num(l) / num(r) : num(l) % num(r);
    }
    return l;
  }
  function parseAdd() {
    let l = parseMul();
    while (peek() && ['+', '-', '&'].includes(peek().t)) {
      const op = next().t;
      const r = parseMul();
      l = op === '&' ? String(l) + String(r) : op === '+' ? num(l) + num(r) : num(l) - num(r);
    }
    return l;
  }
  function parseExpr() {
    let l = parseAdd();
    while (peek() && ['>', '<', '>=', '<=', '=', '!='].includes(peek().t)) {
      const op = next().t;
      l = cmpVals(l, op, parseAdd());
    }
    return l;
  }
  const out = parseExpr();
  if (pos < toks.length) throw new Error('trailing input');
  return typeof out === 'number' ? round10(out) : out;
}
function formulaPreview() {
  const out = document.getElementById('formulaPreviewOut');
  if (!out) return;
  const doc = activeDoc();
  const src = document.getElementById('newFieldFormula').value;
  if (!src.trim()) { out.textContent = '—'; return; }
  const tmp = { id: 'fld_preview', name: '(preview)', type: 'formula', formula: src };
  const row = doc.rows[0];
  out.textContent = row ? String(evalFormulaSafe(doc, row, tmp)) : '(no rows)';
}

// ===== Feature 12 (v2): linked records =====
function openLinkPanel(anchorEl, rowId, fieldId) {
  panelCtx = { kind: 'link', rowId: rowId, fieldId: fieldId, search: '' };
  renderLinkPanel(anchorEl);
}
function renderLinkPanel(anchorEl) {
  const { rowId, fieldId, search } = panelCtx;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const target = state.docs.find(d => d.tableId === field.linkTableId);
  const row = doc.rows.find(r => r.id === rowId);
  const cur = Array.isArray(getCell(doc, row, field)) ? getCell(doc, row, field) : [];
  let html = '<div class="p-2">' +
    '<div class="text-[10px] text-tablify-clay dark:text-gray-400 mb-1.5 px-1">Link rows from <b>' + (target ? esc(target.name) : '?') + '</b> (stable row IDs — renames never break links)</div>' +
    '<input type="text" value="' + escAttr(search) + '" placeholder="Search rows…" oninput="linkPanelSearch(this)" class="pill-input w-full rounded-lg px-3 py-1.5 text-xs focus:outline-none mb-1.5">' +
    '<div class="max-h-52 overflow-y-auto space-y-0.5">';
  if (target) {
    const pf = primaryField(target);
    target.rows.forEach(r => {
      const label = cellText(target, r, pf) || '(untitled)';
      if (search && !label.toLowerCase().includes(search.toLowerCase())) return;
      const on = cur.includes(r.id);
      html += '<button onclick="linkPanelPick(\'' + r.id + '\')" class="w-full flex items-center justify-between px-2 py-1.5 rounded-lg hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner text-left text-xs">' +
        '<span class="truncate"><i class="fa-solid fa-diagram-project text-[9px] text-tablify-terracotta mr-1.5"></i>' + esc(label) + '</span>' +
        (on ? '<i class="fa-solid fa-check text-tablify-terracotta text-xs"></i>' : '') + '</button>';
    });
  } else {
    html += '<div class="px-2 py-1.5 text-[11px] text-rose-500">Linked table not found.</div>';
  }
  html += '</div><div class="border-t border-tablify-paper-border dark:border-tablify-dark-border mt-1.5 pt-1.5 flex justify-between">' +
    '<button onclick="panelClear()" class="text-[11px] text-tablify-clay dark:text-gray-400 hover:text-rose-500 px-2 py-1">Clear</button>' +
    '<span class="text-[10px] text-tablify-clay dark:text-gray-400 px-2 py-1">' + cur.length + ' linked</span></div></div>';
  openPanel(anchorEl, html, panelCtx);
  const inp = document.querySelector('#floatPanel input');
  if (inp) { inp.focus(); inp.setSelectionRange(inp.value.length, inp.value.length); }
}
function linkPanelSearch(inp) {
  panelCtx.search = inp.value;
  const anchor = document.querySelector('td[data-row="' + panelCtx.rowId + '"][data-fld="' + panelCtx.fieldId + '"] > div') || document.body;
  renderLinkPanel(anchor);
}
function linkPanelPick(targetRowId) {
  const { rowId, fieldId } = panelCtx;
  const doc = activeDoc();
  const field = getField(doc, fieldId);
  const row = doc.rows.find(r => r.id === rowId);
  mutate('Edit linked records', () => {
    const cur = Array.isArray(getCell(doc, row, field)) ? getCell(doc, row, field).slice() : [];
    const i = cur.indexOf(targetRowId);
    if (i >= 0) cur.splice(i, 1); else cur.push(targetRowId);
    setCell(doc, row, field, cur);
  });
  const anchor = document.querySelector('td[data-row="' + rowId + '"][data-fld="' + fieldId + '"] > div') || document.body;
  renderLinkPanel(anchor);
}
function openPeek(tableId, rowId) {
  const t = state.docs.find(d => d.tableId === tableId);
  const row = t && t.rows.find(r => r.id === rowId);
  const body = document.getElementById('peekBody');
  if (!t || !row) {
    body.innerHTML = '<div class="text-rose-500 text-xs">Row not found (dangling link — the target row was deleted).</div>';
  } else {
    document.getElementById('peekTitle').textContent = t.name + ' — ' + (cellText(t, row, primaryField(t)) || '(untitled)');
    let html = '<table class="w-full text-xs">';
    t.fields.forEach(f => {
      html += '<tr><td class="py-1.5 pr-3 text-tablify-clay dark:text-gray-400 align-top whitespace-nowrap">' + esc(f.name) + '</td><td class="py-1.5">' + (cellInnerHtml(t, row, f) || '—') + '</td></tr>';
    });
    html += '</table>';
    body.innerHTML = html;
  }
  document.getElementById('peekModal').classList.remove('hidden');
}
function closePeek() { document.getElementById('peekModal').classList.add('hidden'); }

// ===== Features 19-21: optional Airtable sync (UI-only simulation) =====
const AIR_TYPE_MAP = {
  text: 'singleLineText', long_text: 'multilineText', number: 'number', currency: 'currency',
  percent: 'percent', duration: 'duration', rating: 'rating', checkbox: 'checkbox',
  date: 'date', date_time: 'dateTime', url: 'url', email: 'email', phone: 'phoneNumber',
  single_select: 'singleSelect', multi_select: 'multipleSelects', attachment: 'multipleAttachments',
  link: 'multipleRecordLinks'
};
const AIR_REMOTE_FIELDS = ['Task', 'Notes', 'Status', 'Tags', 'Due', 'Budget', 'Project', 'Phase', 'Target', 'Name'];
let CONFLICTS = [];
function openSyncModal() {
  renderSyncModal();
  document.getElementById('syncModal').classList.remove('hidden');
}
function closeSyncModal() { document.getElementById('syncModal').classList.add('hidden'); }
function renderSyncModal() {
  const doc = activeDoc();
  const linked = !!doc.syncLink;
  const host = document.getElementById('syncLinkState');
  if (linked) {
    host.innerHTML = '<div class="flex items-center justify-between gap-2 p-2.5 rounded-xl bg-emerald-500/10 border border-emerald-500/30">' +
      '<span class="text-[11px] text-emerald-700 dark:text-emerald-300"><i class="fa-solid fa-link mr-1.5"></i>Linked to <b>' + esc(doc.syncLink.baseName) + '</b> / <b>' + esc(doc.syncLink.tableName) + '</b></span>' +
      '<button onclick="syncUnlink()" class="text-[10px] text-tablify-clay dark:text-gray-400 hover:text-rose-500 underline">Unlink</button></div>';
  } else {
    host.innerHTML = '<div class="grid grid-cols-2 gap-2">' +
      '<select id="syncBase" class="pill-input rounded-xl px-3 py-2 text-xs focus:outline-none"><option>Product Hub</option><option>Marketing CRM</option></select>' +
      '<select id="syncTable" class="pill-input rounded-xl px-3 py-2 text-xs focus:outline-none"><option>Tasks</option><option>Roadmap</option></select></div>' +
      '<button onclick="syncLinkNow()" class="mt-2 w-full px-4 py-2 bg-tablify-terracotta hover:bg-tablify-terracotta-hover text-white text-xs font-semibold rounded-xl shadow"><i class="fa-solid fa-link mr-1"></i>Link table to Airtable</button>';
  }
  document.getElementById('syncPullBtn').disabled = !linked;
  document.getElementById('syncPushBtn').disabled = !linked;
  document.getElementById('syncPullBtn').classList.toggle('opacity-40', !linked);
  document.getElementById('syncPushBtn').classList.toggle('opacity-40', !linked);
}
function syncLog(msg) {
  const log = document.getElementById('syncLog');
  const d = new Date();
  log.innerHTML += '<div><span class="text-tablify-clay dark:text-gray-500">' + pad2(d.getHours()) + ':' + pad2(d.getMinutes()) + ':' + pad2(d.getSeconds()) + '</span> ' + msg + '</div>';
  log.scrollTop = log.scrollHeight;
  log.classList.remove('hidden');
}
function syncProgress(ms, cb) {
  const wrap = document.getElementById('syncProgressWrap');
  const bar = document.getElementById('syncProgressBar');
  wrap.classList.remove('hidden');
  bar.style.width = '0%';
  const steps = 8;
  let i = 0;
  const t = setInterval(() => {
    i++;
    bar.style.width = Math.min(100, Math.round(i * 100 / steps)) + '%';
    if (i >= steps) {
      clearInterval(t);
      setTimeout(() => { wrap.classList.add('hidden'); cb(); }, 150);
    }
  }, ms / steps);
}
function syncLinkNow() {
  const doc = activeDoc();
  const base = document.getElementById('syncBase').value;
  const table = document.getElementById('syncTable').value;
  mutate('Link to Airtable', () => {
    doc.syncLink = { provider: 'airtable', baseName: base, tableName: table, linkedAt: nowIso(), lastPullAt: null, lastPushAt: null };
  });
  syncLog('Linked to ' + esc(base) + ' / ' + esc(table) + ' <span class="text-tablify-clay dark:text-gray-500">(simulated — v1.1 syncLink metadata)</span>');
  renderSyncModal();
}
function syncUnlink() {
  const doc = activeDoc();
  mutate('Unlink Airtable', () => { doc.syncLink = null; });
  syncLog('Unlinked. The plugin keeps working fully offline.');
  renderSyncModal();
}
function syncPull() {
  const doc = activeDoc();
  if (!doc.syncLink) return;
  syncLog('Pulling from Airtable… <span class="text-tablify-clay dark:text-gray-500">(simulated request)</span>');
  syncProgress(900, () => {
    mutate('Pull from Airtable', () => {
      const pf = primaryField(doc);
      const row = makeRow(doc, {});
      row.cells[pf.id] = 'Pulled from Airtable — docs sweep';
      const statusF = doc.fields.find(f => f.type === 'single_select');
      if (statusF && statusF.options && statusF.options.length) row.cells[statusF.id] = statusF.options[0].id;
      doc.rows.push(row);
      doc.rows.forEach(r => { r._syncRev = r.modifiedTime; });
      doc.syncLink.lastPullAt = nowIso();
    });
    syncLog('Pulled <b>1 new record</b>, 0 updates, 0 deletions. Row revisions stored for conflict detection (Feature 20).');
    showToast('Pulled from Airtable (simulated)');
  });
}
function syncPush() {
  const doc = activeDoc();
  if (!doc.syncLink) return;
  syncLog('Comparing local and remote revisions before push… (Feature 20)');
  syncProgress(700, () => {
    const changedLocal = doc.rows.filter(r => !r._syncRev || r.modifiedTime > r._syncRev);
    const remoteDirty = [doc.rows[1], doc.rows[3]].filter(Boolean);
    const conflicts = remoteDirty.filter(r => changedLocal.includes(r));
    if (conflicts.length) {
      syncLog('<span class="text-amber-600 dark:text-amber-400"><b>' + conflicts.length + ' conflict' + (conflicts.length > 1 ? 's' : '') + '</b> — both sides changed. Nothing is overwritten silently.</span>');
      openConflictDialog(conflicts);
    } else {
      autoCreateStep();
    }
  });
}
function openConflictDialog(rows) {
  const doc = activeDoc();
  const pf = primaryField(doc);
  CONFLICTS = rows.map(r => ({ rowId: r.id, choice: 'local' }));
  document.getElementById('conflictTitle').innerHTML = '<i class="fa-solid fa-code-merge text-amber-500"></i> Sync conflicts (' + rows.length + ')';
  let html = '<p class="text-[11px] text-tablify-clay dark:text-gray-400 mb-3">Both the local table and Airtable changed these rows since the last sync. Choose per row — nothing is overwritten silently (spec §2.20).</p>';
  rows.forEach((r, i) => {
    const name = cellText(doc, r, pf) || '(untitled)';
    html += '<div class="p-2.5 rounded-xl border border-tablify-paper-border dark:border-tablify-dark-border mb-2">' +
      '<div class="font-semibold font-serif text-xs mb-0.5">' + esc(name) + '</div>' +
      '<div class="text-[10px] text-tablify-clay dark:text-gray-400 mb-1.5 font-mono">local: ' + esc(fmtDateTime(r.modifiedTime)) + ' · remote: ' + esc(fmtDateTime(nowIso())) + ' (simulated)</div>' +
      '<div class="flex gap-3 text-[11px]">' +
      ['local|Keep local', 'remote|Keep remote', 'both|Keep both'].map(opt => {
        const [v, label] = opt.split('|');
        return '<label class="flex items-center gap-1.5 cursor-pointer"><input type="radio" name="cf' + i + '" value="' + v + '"' + (v === 'local' ? ' checked' : '') + ' onchange="CONFLICTS[' + i + '].choice=this.value" class="accent-tablify-terracotta">' + label + '</label>';
      }).join('') + '</div></div>';
  });
  document.getElementById('conflictBody').innerHTML = html;
  document.getElementById('conflictFoot').innerHTML =
    '<button onclick="document.getElementById(\'conflictModal\').classList.add(\'hidden\')" class="px-3.5 py-2 text-xs text-tablify-clay dark:text-gray-400 hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner rounded-xl">Cancel push</button>' +
    '<button onclick="conflictResolve()" class="px-4 py-2 bg-tablify-terracotta hover:bg-tablify-terracotta-hover text-white text-xs font-semibold rounded-xl shadow">Resolve &amp; continue</button>';
  document.getElementById('conflictModal').classList.remove('hidden');
}
function conflictResolve() {
  const doc = activeDoc();
  const pf = primaryField(doc);
  mutate('Resolve sync conflicts', () => {
    CONFLICTS.forEach(c => {
      const row = doc.rows.find(r => r.id === c.rowId);
      if (!row) return;
      if (c.choice === 'remote') {
        setCell(doc, row, pf, (cellText(doc, row, pf) || '') + ' (remote version)');
      } else if (c.choice === 'both') {
        const i = doc.rows.indexOf(row);
        const copy = makeRow(doc, deepCopy(row.cells));
        copy.cells[pf.id] = (cellText(doc, row, pf) || '') + ' (remote copy)';
        doc.rows.splice(i + 1, 0, copy);
      }
    });
  });
  document.getElementById('conflictModal').classList.add('hidden');
  syncLog('Conflicts resolved (' + CONFLICTS.map(c => c.choice).join(', ') + ').');
  autoCreateStep();
}
function autoCreateStep() {
  const doc = activeDoc();
  const missing = doc.fields.filter(f => !AIR_REMOTE_FIELDS.includes(f.name) && !FT[f.type].system && f.type !== 'formula');
  if (!missing.length) { finishPush(0); return; }
  document.getElementById('conflictTitle').innerHTML = '<i class="fa-solid fa-wand-magic-sparkles text-tablify-terracotta"></i> Create missing Airtable fields?';
  let html = '<p class="text-[11px] text-tablify-clay dark:text-gray-400 mb-3">These local fields do not exist in the linked Airtable table. They will be created with the matching Airtable type <b>only after you confirm</b> (spec §2.21).</p>';
  missing.forEach(f => {
    html += '<div class="flex items-center justify-between px-2.5 py-1.5 rounded-lg bg-tablify-paper-inner dark:bg-tablify-dark-inner border border-tablify-paper-border dark:border-tablify-dark-border mb-1 text-[11px]">' +
      '<span><i class="fa-solid ' + FT[f.type].icon + ' text-[9px] text-tablify-terracotta mr-1.5"></i>' + esc(f.name) + '</span>' +
      '<span class="font-mono text-[10px] text-tablify-clay dark:text-gray-400">' + (AIR_TYPE_MAP[f.type] || f.type) + '</span></div>';
  });
  document.getElementById('conflictBody').innerHTML = html;
  document.getElementById('conflictFoot').innerHTML =
    '<button onclick="autoCreateConfirm(false)" class="px-3.5 py-2 text-xs text-tablify-clay dark:text-gray-400 hover:bg-tablify-paper-inner dark:hover:bg-tablify-dark-inner rounded-xl">Skip these fields</button>' +
    '<button onclick="autoCreateConfirm(true)" class="px-4 py-2 bg-tablify-terracotta hover:bg-tablify-terracotta-hover text-white text-xs font-semibold rounded-xl shadow">Create ' + missing.length + ' field' + (missing.length > 1 ? 's' : '') + ' &amp; push</button>';
  document.getElementById('conflictModal').classList.remove('hidden');
}
function autoCreateConfirm(ok) {
  document.getElementById('conflictModal').classList.add('hidden');
  const doc = activeDoc();
  const missing = doc.fields.filter(f => !AIR_REMOTE_FIELDS.includes(f.name) && !FT[f.type].system && f.type !== 'formula');
  if (ok) syncLog('Created <b>' + missing.length + ' Airtable field' + (missing.length > 1 ? 's' : '') + '</b> (simulated): ' + missing.map(f => esc(f.name)).join(', '));
  else syncLog('Skipped creating ' + missing.length + ' missing fields — their values were not pushed.');
  finishPush(missing.length);
}
function finishPush() {
  const doc = activeDoc();
  syncProgress(700, () => {
    doc.rows.forEach(r => { r._syncRev = r.modifiedTime; });
    if (doc.syncLink) doc.syncLink.lastPushAt = nowIso();
    save();
    syncLog('Push complete — <b>' + doc.rows.length + ' records</b> up to date (simulated; scopes: data.records:read/write, schema.bases:read).');
    showToast('Pushed to Airtable (simulated)');
  });
}


// ===== PR-12: feature traceability checklist =====
const CHECKLIST = [
  [1,  '.tablify file format (§2.1)', 'live', 'Title row → “Source” shows the serialized document: formatVersion 1, tbl_/fld_/row_/opt_ ids, views, syncLink.'],
  [2,  'Typed fields (§2.2)', 'live', '“+ Field” modal — 21-type registry grouped Basic / Numbers / Dates / People & links / System / Computed.'],
  [3,  'Selects & attachments (§2.3)', 'live', 'Status/Tags chips with colored options + “Manage options…”; Attachments cell opens the fake-upload panel.'],
  [4,  'System fields (§2.4)', 'live', 'Auto number, Created time, Modified time — read-only, auto-maintained on every edit.'],
  [5,  'Grid view (§2.5)', 'live', 'Sticky header, frozen primary column, column resize & drag-reorder, row-height switcher, group-by with collapse.'],
  [6,  'Search & filtering (§2.6)', 'live', 'Search box speaks the full grammar: field:value, ~ contains, ! not, &gt; &lt;, comma-OR, quoted phrases, empty keyword.'],
  [7,  'View settings (§2.7)', 'live', 'Hidden fields, sorts, group-by and widths persist in the view object (see Source modal → views[0]).'],
  [8,  'Undo / redo (§2.8)', 'live', 'Ctrl/Cmd+Z, Shift+Z or Y — every named mutation (edits, imports, sync, deletes) is history-tracked.'],
  [9,  'Keyboard navigation (§2.9)', 'live', 'Arrows / Tab / Enter / Escape, Shift-select ranges, Ctrl+C/V copies & pastes TSV ranges. “?” panel lists all.'],
  [10, 'Validation rules (§2.10)', 'live', 'Required / unique / min / max / regex per field; failing cells get the rose outline (see duplicate email demo).'],
  [11, 'Formula fields (§2.11)', 'live', 'Projects → “Days Left” &amp; “Summary”. Engine: + − × ÷ % &amp;, comparisons, {Field} refs, SUM IF CONCAT DATEDIFF ROUND MIN MAX ABS, #ERR + circular guard, live preview in the field modal.'],
  [12, 'Linked records (§2.12)', 'live', 'Tasks → “Project” chips; stored by stable row ID, picker with search, chip click opens read-only peek.'],
  [13, 'Kanban / Calendar / Gallery (§2.13)', 'excluded', 'Excluded by spec — intentionally absent everywhere in this prototype.'],
  [14, 'Import CSV / Excel (§2.14)', 'live', '“Import…” — real CSV parser (quotes, embedded commas/newlines) + per-column type inference &amp; override. XLSX path is simulated (D-O3).'],
  [15, 'Export (§2.15)', 'live', '“Export…” — CSV and Markdown download for current view or all fields; XLSX shows a simulated progress run (D-O2).'],
  [16, 'File explorer right-click (§2.16)', 'live', 'Right-click files/folders in the vault sidebar: New table here, Open, Rename, Duplicate, Delete, Copy path, Export CSV.'],
  [17, 'Table right-click (§2.17)', 'live', 'Right-click a cell, row handle, or column header — every §2.17 item present; mocked ones toast “simulated”.'],
  [18, 'Embedded table in a note (§2.18)', 'live', '“Note embed” tab — the live grid rendered inside a simulated Obsidian note; edits persist across both views.'],
  [19, 'Optional Airtable sync (§2.19)', 'sim', 'Toolbar “Sync” — masked token (settings-only, never in the file), scopes note, link/unlink, pull &amp; push with progress + log. Fully offline.'],
  [20, 'Sync conflict detection (§2.20)', 'sim', 'Pull, edit a pulled row, push → per-row conflict dialog (keep local / remote / both). Nothing is overwritten silently.'],
  [21, 'Auto-create Airtable fields (§2.21)', 'sim', 'During push: missing remote fields listed with mapped Airtable types; created only after explicit confirm.']
];
function openChecklist() {
  const badge = st =>
    st === 'live' ? '<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-700 dark:text-emerald-300">LIVE</span>' :
    st === 'sim'  ? '<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-amber-500/10 border border-amber-500/30 text-amber-700 dark:text-amber-300">SIMULATED</span>' :
                    '<span class="text-[9px] font-mono px-1.5 py-0.5 rounded bg-gray-500/10 border border-gray-500/30 text-gray-500 dark:text-gray-400">EXCLUDED</span>';
  document.getElementById('checklistBody').innerHTML = CHECKLIST.map(c =>
    '<div class="flex items-start gap-3 px-2.5 py-2 rounded-xl ' + (c[0] % 2 ? '' : 'bg-tablify-paper-inner/60 dark:bg-tablify-dark-inner/60') + '">' +
    '<span class="font-mono text-[10px] text-tablify-clay dark:text-gray-400 mt-0.5 w-7 shrink-0">F' + String(c[0]).padStart(2, '0') + '</span>' +
    '<div class="flex-1 min-w-0"><div class="flex items-center gap-2 flex-wrap mb-0.5"><span class="font-semibold font-serif">' + c[1] + '</span>' + badge(c[2]) + '</div>' +
    '<div class="text-[11px] text-tablify-clay dark:text-gray-400 leading-relaxed">' + c[3] + '</div></div></div>'
  ).join('');
  document.getElementById('checklistModal').classList.remove('hidden');
}
function closeChecklist() { document.getElementById('checklistModal').classList.add('hidden'); }

/* @@EXT */

// ===== boot =====
window.onload = function () {
  initTheme();
  load();
  renderAll();
};
