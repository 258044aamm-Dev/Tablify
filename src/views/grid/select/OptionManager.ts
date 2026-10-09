/**
 * Option manager dialog — rename, recolor, reorder, delete with confirmation.
 * Uses src/model/selectOptions.ts manager.
 */

import { createSelectOptionManager } from '../../../model/selectOptions.js';
import type { FieldDefinition, SelectOption } from '../../../model/types.js';
import type { TableStore } from '../../../model/tableStore.js';

export class OptionManagerDialog {
  private manager = createSelectOptionManager();

  constructor(
    private field: FieldDefinition,
    private store: TableStore,
  ) {}

  rename(optionId: string, newName: string): SelectOption {
    return this.manager.rename(optionId, newName, this.field);
  }

  recolor(optionId: string, newColor: string): SelectOption {
    const opt = this.field.options?.find((o) => o.id === optionId);
    if (!opt) throw new Error('Option not found');
    (opt as SelectOption).color = newColor as SelectOption['color'];
    return opt;
  }

  reorder(optionIds: string[]): void {
    this.manager.reorder(optionIds, this.field);
  }

  /**
   * Delete with confirmation — returns affected cell count for UI.
   * Caller should show confirm dialog with this count before calling `confirmDelete`.
   */
  getDeleteAffectedCount(optionId: string): number {
    const id = optionId;
    let count = 0;
    for (const row of this.store.getAllRows()) {
      const v = row.values[this.field.id];
      if (this.field.type === 'single_select' && v === id) count++;
      if (this.field.type === 'multi_select' && Array.isArray(v) && (v as string[]).includes(id)) count++;
    }
    return count;
  }

  confirmDelete(optionId: string): { option: SelectOption; affected: number } {
    const before = this.getDeleteAffectedCount(optionId);
    const res = this.manager.delete(optionId, this.field, this.store);
    return { option: res.option, affected: before };
  }

  // For tests: get options in order
  getOptions(): SelectOption[] {
    return [...(this.field.options ?? [])];
  }
}
