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

/**
 * What deleting an option leaves behind (R-D12), as data: the option list without `optionId` and
 * the cells that referenced it, each with the value it should hold afterwards — `null` for a
 * single_select cell, the remaining ids for a multi_select one. Pure, so the UI can carry the
 * write through its own undoable path (`createSetFieldOptionsCommand`) instead of editing cells
 * one by one.
 */
export function planOptionRemoval(
  optionId: string,
  field: FieldDefinition,
  store: TableStore
): { options: SelectOption[]; values: Record<string, CellValue> } {
  const options = (field.options ?? []).filter(o => o.id !== optionId);
  const values: Record<string, CellValue> = {};

  for (const row of store.getAllRows()) {
    const cellValue = row.values[field.id];

    if (field.type === 'single_select' && cellValue === optionId) {
      values[row.id] = null;
    } else if (
      field.type === 'multi_select' &&
      Array.isArray(cellValue) &&
      (cellValue as string[]).includes(optionId)
    ) {
      // multi_select cells hold option IDs (strings); the field type guarantees it.
      const rest = (cellValue as string[]).filter(id => id !== optionId);
      values[row.id] = rest.length > 0 ? rest : null;
    }
  }

  return { options, values };
}

/**
 * What adding an option leaves behind, as data: the option list with the new entry appended (or
 * unchanged when a trimmed, case-insensitive match already exists) and the option itself. Pure, so
 * the UI can put the new option and the cell write into one undoable command
 * (`createSetFieldOptionsCommand`) instead of mutating the field outside the stack.
 */
export function planOptionAdd(
  name: string,
  field: FieldDefinition
): { options: SelectOption[]; option: SelectOption; created: boolean } {
  const trimmed = name.trim();
  if (!trimmed) {
    throw new Error('Option name cannot be empty');
  }

  const lower = trimmed.toLowerCase();
  const current = field.options ?? [];
  const existing = current.find(opt => opt.name.trim().toLowerCase() === lower);
  if (existing) return { options: current, option: existing, created: false };

  const option: SelectOption = {
    id: generateOptionId(),
    name: trimmed,
    color: getNextColor(field),
  };
  return { options: [...current, option], option, created: true };
}

export function createSelectOptionManager(): SelectOptionManager {
  function findOrCreate(name: string, field: FieldDefinition): SelectOption {
    // Match by trimmed, case-insensitive name; otherwise append a new option.
    const plan = planOptionAdd(name, field);
    if (plan.created) {
      if (!field.options) {
        field.options = [];
      }
      field.options.push(plan.option);
    }
    return plan.option;
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
    const plan = planOptionRemoval(optionId, field, store);
    const affectedCells: Array<{ rowId: string; oldValue: CellValue }> = [];

    // Clear cells that reference this option (R-D12)
    for (const [rowId, value] of Object.entries(plan.values)) {
      affectedCells.push({ rowId, oldValue: (store.getRow(rowId)?.values[field.id] ?? null) as CellValue });
      store.updateRow(rowId, { [field.id]: value });
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
