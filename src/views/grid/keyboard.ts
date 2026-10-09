/**
 * Keyboard navigation and shortcuts — grid has focus only.
 */

export type GridAction =
  | 'moveUp'
  | 'moveDown'
  | 'moveLeft'
  | 'moveRight'
  | 'tabNext'
  | 'tabPrev'
  | 'enterEdit'
  | 'escapeCancel'
  | 'undo'
  | 'redo'
  | 'copy'
  | 'paste'
  | 'none';

export interface KeyEventLike {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

export function getGridAction(e: KeyEventLike): GridAction {
  const ctrl = !!(e.ctrlKey || e.metaKey);
  if (ctrl && e.key.toLowerCase() === 'z' && !e.shiftKey) return 'undo';
  if (ctrl && e.key.toLowerCase() === 'z' && !!e.shiftKey) return 'redo';
  if (ctrl && e.key.toLowerCase() === 'y') return 'redo'; // alternative
  if (ctrl && e.key.toLowerCase() === 'c') return 'copy';
  if (ctrl && e.key.toLowerCase() === 'v') return 'paste';
  if (e.key === 'ArrowUp') return 'moveUp';
  if (e.key === 'ArrowDown') return 'moveDown';
  if (e.key === 'ArrowLeft') return 'moveLeft';
  if (e.key === 'ArrowRight') return 'moveRight';
  if (e.key === 'Tab' && !e.shiftKey) return 'tabNext';
  if (e.key === 'Tab' && !!e.shiftKey) return 'tabPrev';
  if (e.key === 'Enter') return 'enterEdit';
  if (e.key === 'Escape') return 'escapeCancel';
  return 'none';
}

export function shouldHandleForGrid(gridRoot: HTMLElement, activeElement: Element | null): boolean {
  return !!activeElement && gridRoot.contains(activeElement);
}

/**
 * Copy range as tab-separated text (for pasting into spreadsheets).
 */
export function copyRangeToText(rows: string[][]): string {
  return rows.map((r) => r.join('\t')).join('\n');
}

export function parseTextToRange(text: string): string[][] {
  return text.split('\n').map((line) => line.split('\t'));
}
