// Pure selection logic for the table view (P5-00). No DOM or Obsidian imports, so it is unit-tested in Node.

import type { GridAction } from './grid/keyboard.js';
import type { GridSelection } from './grid/GridView.js';

/**
 * Move the selection for one navigation action. Clamps at the edges.
 * tabNext/tabPrev move right/left and wrap to the next/previous row (spreadsheet convention).
 * Returns the same selection object when the action is not a movement or the grid is empty.
 */
export function moveSelection(sel: GridSelection, action: GridAction, rowCount: number, colCount: number): GridSelection {
  if (rowCount <= 0 || colCount <= 0) return sel;
  const clamp = (n: number, max: number) => Math.min(max - 1, Math.max(0, n));
  let { row, col } = sel;
  switch (action) {
    case 'moveUp':
      row = clamp(row - 1, rowCount);
      break;
    case 'moveDown':
      row = clamp(row + 1, rowCount);
      break;
    case 'moveLeft':
      col = clamp(col - 1, colCount);
      break;
    case 'moveRight':
      col = clamp(col + 1, colCount);
      break;
    case 'tabNext':
      if (col + 1 < colCount) col++;
      else if (row + 1 < rowCount) {
        row++;
        col = 0;
      }
      break;
    case 'tabPrev':
      if (col > 0) col--;
      else if (row > 0) {
        row--;
        col = colCount - 1;
      }
      break;
    default:
      return sel;
  }
  return { row: clamp(row, rowCount), col: clamp(col, colCount) };
}

/** Actions that move the selection. */
export function isMoveAction(action: GridAction): boolean {
  return action === 'moveUp' || action === 'moveDown' || action === 'moveLeft' || action === 'moveRight' || action === 'tabNext' || action === 'tabPrev';
}
