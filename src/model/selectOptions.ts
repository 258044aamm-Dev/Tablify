import type { CellValue, FieldDefinition, SelectOption, OptionColor } from './types.js';
import { OPTION_COLORS } from './types.js';
import type { TableStore } from './tableStore.js';
import type { Command } from './commands.js';
import { generateOptionId } from '../utils/idGen.js';

export interface SelectOptionManager {
  /** Find existing option by trimmed, case-insensitive name, or create new one */
  findOrCreate(name: string, field: FieldDefinition): SelectOption;

  /** Rename an option. ID stays the same. */
  rename(optionId: string, newName: string, field: FieldDefinition): SelectOption;

  /** Reorder options within a field */
  reorder(optionIds: string[], field: FieldDefinition): void;

  /** Delete an option. Clears cells that reference it (R-D12). Returns affected data. */
  delete(
    optionId: string,
    field: FieldDefinition,
    store: TableStore
  ): { option: SelectOption; affectedCells: Array<{ rowId: string; oldValue: CellValue }> };

  /** Create an undoable DeleteOptionCommand */
  createDeleteCommand(optionId: string, field: FieldDefinition, store: TableStore): Command;
}

export function createSelectOptionManager(): SelectOptionManager {
  function findOrCreate(name: string, field: FieldDefinition): SelectOption {
    const trimmed = name.trim();
    if (!trimmed) {
      throw new Error('Option name cannot be empty');
    }

    const lower = trimmed.toLowerCase();

    // Match by trimmed, case-insensitive name
    if (field.options) {
      const existing = field.options.find(opt => opt.name.trim().toLowerCase() === lower);
      if (existing) return existing;
    }

    // Create new option
    const newOption: SelectOption = {
      id: generateOptionId(),
      name: trimmed,
      color: getNextColor(field),
    };

    if (!field.options) {
      field.options = [];
    }
    field.options.push(newOption);
    return newOption;
  }

  function rename(optionId: string, newName: string, field: FieldDefinition): SelectOption {
    const trimmed = newName.trim();
    if (!trimmed) {
      throw new Error('Option name cannot be empty');
    }
    if (!field.options) {
      throw new Error('Field has no options');
    }

    const option = field.options.find(o => o.id === optionId);
    if (!option) {
      throw new Error(`Option not found: ${optionId}`);
    }

    option.name = trimmed;
    return option;
  }

  function reorder(optionIds: string[], field: FieldDefinition): void {
    if (!field.options) {
      throw new Error('Field has no options');
    }

    const optionMap = new Map(field.options.map(o => [o.id, o]));
    const reordered: SelectOption[] = [];

    for (const id of optionIds) {
      const opt = optionMap.get(id);
      if (!opt) {
        throw new Error(`Option not found: ${id}`);
      }
      reordered.push(opt);
    }

    // Add any remaining options not in the reorder list
    for (const opt of field.options) {
      if (!optionIds.includes(opt.id)) {
        reordered.push(opt);
      }
    }

    field.options = reordered;
  }

  function deleteOption(
    optionId: string,
    field: FieldDefinition,
    store: TableStore
  ): { option: SelectOption; affectedCells: Array<{ rowId: string; oldValue: CellValue }> } {
    if (!field.options) {
      throw new Error('Field has no options');
    }

    const optionIndex = field.options.findIndex(o => o.id === optionId);
    if (optionIndex === -1) {
      throw new Error(`Option not found: ${optionId}`);
    }

    const option = field.options[optionIndex];
    const affectedCells: Array<{ rowId: string; oldValue: CellValue }> = [];

    // Clear cells that reference this option
    const allRows = store.getAllRows();
    for (const row of allRows) {
      const cellValue = row.values[field.id];

      if (field.type === 'single_select' && cellValue === optionId) {
        affectedCells.push({ rowId: row.id, oldValue: cellValue });
        store.updateRow(row.id, { [field.id]: null });
      } else if (field.type === 'multi_select' && Array.isArray(cellValue) && (cellValue as string[]).includes(optionId)) {
        // multi_select cells hold option IDs (strings); the field type guarantees it.
        const newValue = (cellValue as string[]).filter(id => id !== optionId);
        affectedCells.push({ rowId: row.id, oldValue: cellValue });
        store.updateRow(row.id, { [field.id]: newValue.length > 0 ? newValue : null });
      }
    }

    // Remove option from field
    field.options.splice(optionIndex, 1);

    return { option, affectedCells };
  }

  function createDeleteCommand(
    optionId: string,
    field: FieldDefinition,
    store: TableStore
  ): Command {
    let affectedCells: Array<{ rowId: string; oldValue: CellValue }> = [];
    let removedOption: SelectOption | undefined;

    return {
      type: 'deleteOption',
      targetKey: `deleteOption:${field.id}:${optionId}`,
      do(_store: TableStore): void {
        const result = deleteOption(optionId, field, store);
        affectedCells = result.affectedCells;
        removedOption = result.option;
      },
      undo(store: TableStore): void {
        // Restore the option
        if (removedOption && field.options) {
          field.options.push(removedOption);
        }

        // Restore affected cells
        for (const { rowId, oldValue } of affectedCells) {
          store.updateRow(rowId, { [field.id]: oldValue });
        }
      },
    };
  }

  return {
    findOrCreate,
    rename,
    reorder,
    delete: deleteOption,
    createDeleteCommand,
  };
}

/** Get the next color in the palette rotation. */
function getNextColor(field: FieldDefinition): OptionColor {
  if (!field.options || field.options.length === 0) {
    return OPTION_COLORS[0];
  }
  const colorIndex = field.options.length % OPTION_COLORS.length;
  return OPTION_COLORS[colorIndex];
}
