/**
 * P6-03 — Keyboard coverage guard.
 * Asserts the action→key map covers every keyboard-reachable MVP grid action and
 * that the shipped shortcut documentation lists them (prevents future MVP actions
 * from shipping without a keyboard path).
 */
import { describe, it, expect } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { getGridAction } from '../../src/views/grid/keyboard.js';

/** Every MVP grid action that must be reachable from the keyboard (P3-06 scope). */
const REQUIRED_KEYS: Array<{ key: string; label: string; action: string }> = [
  { key: 'ArrowUp', label: 'move selection up', action: 'moveUp' },
  { key: 'ArrowDown', label: 'move selection down', action: 'moveDown' },
  { key: 'ArrowLeft', label: 'move selection left', action: 'moveLeft' },
  { key: 'ArrowRight', label: 'move selection right', action: 'moveRight' },
  { key: 'Tab', label: 'next cell', action: 'tabNext' },
  { key: 'Shift+Tab', label: 'previous cell', action: 'tabPrev' },
  { key: 'Enter', label: 'edit/commit cell', action: 'enterEdit' },
  { key: 'Escape', label: 'cancel edit', action: 'escapeCancel' },
  { key: 'Ctrl/Cmd+Z', label: 'undo', action: 'undo' },
  { key: 'Ctrl/Cmd+Shift+Z', label: 'redo', action: 'redo' },
  { key: 'Ctrl/Cmd+Y', label: 'redo (alternative)', action: 'redo' },
  { key: 'Ctrl/Cmd+C', label: 'copy range', action: 'copy' },
  { key: 'Ctrl/Cmd+V', label: 'paste range', action: 'paste' },
];

function keyEvent(spec: string): { key: string; ctrlKey?: boolean; metaKey?: boolean; shiftKey?: boolean } {
  let key = spec;
  const ctrlKey = /(^|\+)Ctrl(\/|\+)/.test(spec) || /Cmd/.test(spec);
  const shiftKey = /Shift/.test(spec);
  key = key.replace('Ctrl/', '').replace('Cmd+', '').replace('Shift+', '');
  return { key, ctrlKey, metaKey: /Cmd/.test(spec), shiftKey };
}

describe('P6-03 — keyboard coverage of MVP grid actions', () => {
  it('every required MVP grid action maps from its documented key', () => {
    for (const { key, action } of REQUIRED_KEYS) {
      expect(getGridAction(keyEvent(key)), `${key} should map to ${action}`).toBe(action);
    }
  });

  it('docs/shortcuts.md documents every required MVP grid action', () => {
    const doc = readFileSync(join(process.cwd(), 'docs', 'shortcuts.md'), 'utf8');
    const mustMention: Array<[string, string]> = [
      ['ArrowUp', 'ArrowUp'],
      ['ArrowDown', 'ArrowDown'],
      ['ArrowLeft', 'ArrowLeft'],
      ['ArrowRight', 'ArrowRight'],
      ['Tab', 'Tab'],
      ['Enter', 'Enter'],
      ['Escape', 'Escape'],
      ['undo', 'Undo'],
      ['redo', 'Redo'],
      ['copy', 'Copy'],
      ['paste', 'Paste'],
    ];
    for (const [needle, what] of mustMention) {
      expect(doc.toLowerCase().includes(needle.toLowerCase()), `shortcuts doc must mention ${what}`).toBe(true);
    }
  });

  it('unmapped keys return none (focus guard stays predictable)', () => {
    expect(getGridAction({ key: 'F1' })).toBe('none');
    expect(getGridAction({ key: 'a' })).toBe('none');
    expect(getGridAction({ key: 'z' })).toBe('none'); // ctrl required for undo
  });
});
