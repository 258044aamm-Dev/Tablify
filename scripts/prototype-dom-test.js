// Real-DOM regression test for the prototype (Prototype/index.html + script.js).
// Usage:  npm i jsdom && node scripts/prototype-dom-test.js
// Scenarios:
//   S1-S7  outside-tap selection clearing (focus, editing, modals, touch, dropdown, range)
//   S8     row drag-and-drop reordering (move, drop-at-end, no-op, undo, sort-blocked)
const fs = require('fs');
const { JSDOM } = require('jsdom');

const html = fs.readFileSync('/home/user/Tablify/Prototype/index.html', 'utf8')
  .replace(/<script src="https:[^"]*"><\/script>/g, '')
  .replace(/<link[^>]*href="https:[^"]*"[^>]*>/g, '')
  .replace('<script src="script.js"></script>', '');

const dom = new JSDOM(html, { runScripts: 'dangerously', pretendToBeVisual: true, url: 'http://localhost/' });
const { window } = dom;
window.innerWidth = 1400;
window.confirm = () => true;
window.navigator.clipboard = { writeText: () => Promise.resolve(), readText: () => Promise.reject(new Error('no')) };
window.matchMedia = window.matchMedia || (() => ({ matches: false, addEventListener(){} }));
window.HTMLElement.prototype.scrollIntoView = function(){};
window.__A = (name, cond) => { if (!cond) { console.log('FAIL: ' + name); process.exitCode = 1; } else console.log('ok: ' + name); };
window.__log = (...a) => console.log(...a);

const app = fs.readFileSync('/home/user/Tablify/Prototype/script.js', 'utf8').replace("'use strict';", '');

const tests = `
;window.onload();
(function(){
  const A = window.__A;
  const md = el => el.dispatchEvent(new MouseEvent('mousedown', { bubbles: true, cancelable: true }));
  const clk = el => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
  const doc0 = activeDoc();
  const row0 = doc0.rows[0];

  // S1: focus-only cell (checkbox), tap outside
  const cbField = doc0.fields.find(f => f.type === 'checkbox');
  let td = document.querySelector('td[data-row="' + row0.id + '"][data-fld="' + cbField.id + '"] > div');
  A('S1 cell found', !!td);
  clk(td);
  A('S1 focus set after cell click', !!state.focus && state.focus.fieldId === cbField.id);
  A('S1 .cell-focus rendered', !!document.querySelector('.cell-focus'));
  md(document.body);
  A('S1 focus cleared on outside mousedown', state.focus === null && state.anchor === null);
  A('S1 no .cell-focus left in DOM', !document.querySelector('.cell-focus'));

  // S2 (the reported bug): text cell -> editor -> tap outside
  const txtField = doc0.fields.find(f => f.type === 'text' && !f.primary) || doc0.fields.find(f => f.type === 'text');
  td = document.querySelector('td[data-row="' + row0.id + '"][data-fld="' + txtField.id + '"] > div');
  clk(td);
  A('S2 editing started on text cell click', !!state.editing);
  const ed = document.getElementById('cellEditor');
  A('S2 editor input present', !!ed);
  ed.value = 'typed before tapping away';
  md(document.body);
  A('S2 editing committed on outside tap', state.editing === null);
  A('S2 typed value saved', cellText(activeDoc(), activeDoc().rows[0], getField(activeDoc(), txtField.id)) === 'typed before tapping away');
  A('S2 focus cleared', state.focus === null);
  A('S2 no .cell-focus/.cell-editing left', !document.querySelector('.cell-focus') && !document.querySelector('.cell-editing'));

  // S3: tapping another cell moves focus normally
  td = document.querySelector('td[data-row="' + row0.id + '"][data-fld="' + cbField.id + '"] > div');
  clk(td);
  A('S3 focus set again', !!state.focus);
  const td2 = document.querySelector('td[data-row="' + doc0.rows[1].id + '"][data-fld="' + cbField.id + '"] > div');
  md(td2);
  A('S3 mousedown on another cell does not clear', !!state.focus);
  clk(td2);
  A('S3 focus moved to tapped cell', state.focus.rowId === doc0.rows[1].id);

  // S4: open modal keeps selection
  openChecklist();
  md(document.body);
  A('S4 selection kept while modal open', !!state.focus);
  closeChecklist();

  // S5: touchstart clears too (touch devices)
  A('S5 focus present before touch', !!state.focus);
  document.body.dispatchEvent(new Event('touchstart', { bubbles: true }));
  A('S5 focus cleared on touchstart outside', state.focus === null);

  // S6: select cell with dropdown open — one outside tap closes panel AND clears
  const selField = doc0.fields.find(f => f.type === 'single_select');
  td = document.querySelector('td[data-row="' + row0.id + '"][data-fld="' + selField.id + '"] > div');
  clk(td);
  A('S6 float panel open', !document.getElementById('floatPanel').classList.contains('hidden'));
  A('S6 focus set', !!state.focus);
  md(document.body);
  A('S6 one tap: panel closed AND highlight cleared', document.getElementById('floatPanel').classList.contains('hidden') && state.focus === null);

  // S7: range selection (shift-click) also clears
  clk(td);
  md(document.body); // clear again
  const pf = doc0.fields.find(f => f.primary);
  const c1 = document.querySelector('td[data-row="' + doc0.rows[0].id + '"][data-fld="' + pf.id + '"] > div');
  c1.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  const c2 = document.querySelector('td[data-row="' + doc0.rows[2].id + '"][data-fld="' + pf.id + '"] > div');
  c2.dispatchEvent(new MouseEvent('click', { bubbles: true, shiftKey: true }));
  A('S7 range rendered', document.querySelectorAll('.cell-range').length > 0);
  md(document.body);
  A('S7 range cleared on outside tap', state.focus === null && state.anchor === null && !document.querySelector('.cell-range'));

  // ---- S8: row drag-and-drop reordering ----
  window.scrollBy = window.scrollBy || function(){};
  renderGrid();
  const ids0 = activeDoc().rows.map(r => r.id);
  // stub layout: row i at top=40*i, height 36; container at 0
  const stubRects = () => {
    document.querySelectorAll('#tableBody tr[data-row]').forEach((tr, i) => {
      tr.getBoundingClientRect = () => ({ top: 40 * i, bottom: 40 * i + 36, height: 36, left: 0, right: 600, width: 600 });
    });
    document.getElementById('tableInnerContainer').getBoundingClientRect = () => ({ top: 0, left: 0, right: 600, bottom: 400, width: 600, height: 400 });
  };
  const pev = (type, el, y) => el.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, clientX: 10, clientY: y }));
  const handleOf = rid => document.querySelector('tr[data-row="' + rid + '"] td.row-drag-handle');
  A('S8 drag handles rendered', !!handleOf(ids0[0]));

  // drag row0 to before row3
  stubRects();
  pev('pointerdown', handleOf(ids0[0]), 18);
  pev('pointermove', document, 30);   // crosses threshold -> drag activates
  A('S8 drag active + row dimmed', document.body.classList.contains('row-dragging-active') && !!document.querySelector('tr.row-dragging'));
  pev('pointermove', document, 130);  // between row2 mid(98) and row3 mid(138) -> before row3
  A('S8 indicator visible', document.getElementById('rowDropIndicator').style.display === 'block');
  pev('pointerup', document, 130);
  const ids1 = activeDoc().rows.map(r => r.id);
  A('S8 row0 moved before row3', JSON.stringify(ids1) === JSON.stringify([ids0[1], ids0[2], ids0[0], ids0[3], ids0[4]].concat(ids0.slice(5))));
  A('S8 drag state cleaned up', !document.body.classList.contains('row-dragging-active') && document.getElementById('rowDropIndicator').style.display === 'none' && !document.querySelector('tr.row-dragging'));

  // undo restores original order (data integrity)
  undo();
  A('S8 undo restores order', JSON.stringify(activeDoc().rows.map(r => r.id)) === JSON.stringify(ids0));

  // drag row1 to the end (below last row)
  renderGrid(); stubRects();
  pev('pointerdown', handleOf(ids0[1]), 58);
  pev('pointermove', document, 70);
  pev('pointermove', document, 3000); // far below every midpoint -> end
  pev('pointerup', document, 3000);
  const idsEnd = activeDoc().rows.map(r => r.id);
  A('S8 drop at end', idsEnd[idsEnd.length - 1] === ids0[1]);
  undo();

  // no-op drop (back onto its own position) creates no undo entry
  renderGrid(); stubRects();
  const undoDepth = UNDO.length;
  pev('pointerdown', handleOf(ids0[0]), 18);
  pev('pointermove', document, 30);
  pev('pointermove', document, 10);   // before row0 mid -> before itself -> noop
  pev('pointerup', document, 10);
  A('S8 noop drop: order + undo stack unchanged', JSON.stringify(activeDoc().rows.map(r => r.id)) === JSON.stringify(ids0) && UNDO.length === undoDepth);

  // sorting active -> drag refused, order unchanged
  docView(activeDoc()).sorts = [{ fieldId: activeDoc().fields[0].id, dir: 1 }];
  renderGrid(); stubRects();
  pev('pointerdown', handleOf(ids0[0]), 18);
  pev('pointermove', document, 130);
  pev('pointerup', document, 130);
  A('S8 sorted view: reorder refused', JSON.stringify(activeDoc().rows.map(r => r.id)) === JSON.stringify(ids0) && !document.body.classList.contains('row-dragging-active'));
  docView(activeDoc()).sorts = [];
  renderGrid();

  window.__log('DOM TEST DONE');
})();
`;
window.eval(app + tests);
