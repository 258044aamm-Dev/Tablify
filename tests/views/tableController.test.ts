import { describe, it, expect } from 'vitest';
import { moveSelection, isMoveAction } from '../../src/views/tableController.js';

describe('moveSelection (P5-00)', () => {
  it('moves one cell in each direction and clamps at the edges', () => {
    expect(moveSelection({ row: 1, col: 1 }, 'moveDown', 3, 3)).toEqual({ row: 2, col: 1 });
    expect(moveSelection({ row: 2, col: 1 }, 'moveDown', 3, 3)).toEqual({ row: 2, col: 1 });
    expect(moveSelection({ row: 0, col: 1 }, 'moveUp', 3, 3)).toEqual({ row: 0, col: 1 });
    expect(moveSelection({ row: 1, col: 0 }, 'moveLeft', 3, 3)).toEqual({ row: 1, col: 0 });
    expect(moveSelection({ row: 1, col: 2 }, 'moveRight', 3, 3)).toEqual({ row: 1, col: 2 });
  });

  it('tab wraps to the next and previous row', () => {
    expect(moveSelection({ row: 0, col: 2 }, 'tabNext', 3, 3)).toEqual({ row: 1, col: 0 });
    expect(moveSelection({ row: 1, col: 0 }, 'tabPrev', 3, 3)).toEqual({ row: 0, col: 2 });
    expect(moveSelection({ row: 2, col: 2 }, 'tabNext', 3, 3)).toEqual({ row: 2, col: 2 });
    expect(moveSelection({ row: 0, col: 0 }, 'tabPrev', 3, 3)).toEqual({ row: 0, col: 0 });
  });

  it('returns the same selection for non-move actions and empty grids', () => {
    const sel = { row: 1, col: 1 };
    expect(moveSelection(sel, 'undo', 3, 3)).toBe(sel);
    expect(moveSelection(sel, 'moveDown', 0, 3)).toBe(sel);
  });

  it('identifies move actions', () => {
    expect(isMoveAction('tabNext')).toBe(true);
    expect(isMoveAction('enterEdit')).toBe(false);
  });
});
