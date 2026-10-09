/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { getGridAction, shouldHandleForGrid, copyRangeToText, parseTextToRange } from '../../../src/views/grid/keyboard.js';

describe('P3-06 — Keyboard navigation', () => {
  it('key maps to expected action', () => {
    expect(getGridAction({ key: 'ArrowUp' })).toBe('moveUp');
    expect(getGridAction({ key: 'ArrowDown' })).toBe('moveDown');
    expect(getGridAction({ key: 'ArrowLeft' })).toBe('moveLeft');
    expect(getGridAction({ key: 'ArrowRight' })).toBe('moveRight');
    expect(getGridAction({ key: 'Tab' })).toBe('tabNext');
    expect(getGridAction({ key: 'Tab', shiftKey: true })).toBe('tabPrev');
    expect(getGridAction({ key: 'Enter' })).toBe('enterEdit');
    expect(getGridAction({ key: 'Escape' })).toBe('escapeCancel');
    expect(getGridAction({ key: 'z', ctrlKey: true })).toBe('undo');
    expect(getGridAction({ key: 'Z', ctrlKey: true, shiftKey: true })).toBe('redo');
    expect(getGridAction({ key: 'c', ctrlKey: true })).toBe('copy');
    expect(getGridAction({ key: 'v', ctrlKey: true })).toBe('paste');
    expect(getGridAction({ key: 'a' })).toBe('none');
  });

  it('shortcuts apply only when grid has focus', () => {
    const grid = document.createElement('div');
    grid.className = 'tablify';
    const cell = document.createElement('div');
    grid.appendChild(cell);
    document.body.appendChild(grid);
    cell.focus = () => {};
    // grid contains cell
    expect(shouldHandleForGrid(grid, cell)).toBe(true);
    const note = document.createElement('div');
    document.body.appendChild(note);
    expect(shouldHandleForGrid(grid, note)).toBe(false);
    document.body.innerHTML = '';
  });

  it('copy produces tab-separated text for spreadsheets', () => {
    const rows = [
      ['a', 'b', 'c'],
      ['1', '2', '3'],
    ];
    const txt = copyRangeToText(rows);
    expect(txt).toBe('a\tb\tc\n1\t2\t3');
    // paste back
    expect(parseTextToRange(txt)).toEqual(rows);
  });

  it('copy from grid, paste into text editor is tab-separated', () => {
    const txt = copyRangeToText([['x', 'y']]);
    // simulate paste into textarea
    const ta = document.createElement('textarea');
    ta.value = txt;
    expect(ta.value).toBe('x\ty');
  });

  it('shortcut fired inside note pane does not change grid', () => {
    const grid = document.createElement('div');
    const note = document.createElement('div');
    note.tabIndex = 0;
    document.body.appendChild(grid);
    document.body.appendChild(note);
    note.focus();
    // grid should not handle when active is note
    expect(shouldHandleForGrid(grid, document.activeElement)).toBe(false);
    document.body.innerHTML = '';
  });
});
