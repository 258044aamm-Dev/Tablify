// SAD-86: "Preview (row 1)" in the Add Field dialog (prototype `formulaPreview`).
//
// Evaluates an expression that is not saved yet against the table's first row. A throwaway
// FormulaEngine is built from the current fields plus one preview field, with that one row only,
// so the live table, its formula runtime and the undo stack are never touched.
// Pure model code, no Obsidian or DOM imports.
import { FormulaEngine, type FieldSpec } from '../formula/index.js';
import { cellToValue, valueToCell } from './formulaRuntime.js';
import type { FieldDefinition, Row } from './types.js';
import type { Value } from '../formula/index.js';

/** Id of the temporary field; real field ids are `fld_` + random characters. */
const PREVIEW_FIELD_ID = 'fld__preview';
/** A name no `{Field}` reference can spell (it contains a newline). */
const PREVIEW_FIELD_NAME = '\n(preview)';

/** Shown when there is nothing to evaluate, as in the prototype. */
export const EMPTY_PREVIEW = '—';
export const NO_ROWS_PREVIEW = '(no rows)';

export function previewFormula(fields: readonly FieldDefinition[], firstRow: Row | undefined, expression: string): string {
  if (!expression.trim()) return EMPTY_PREVIEW;
  if (!firstRow) return NO_ROWS_PREVIEW;
  const specs: FieldSpec[] = fields.map((f) =>
    f.type === 'formula' ? { id: f.id, name: f.name, formula: f.formula ?? '' } : { id: f.id, name: f.name },
  );
  specs.push({ id: PREVIEW_FIELD_ID, name: PREVIEW_FIELD_NAME, formula: expression });
  const inputs: Record<string, Value> = {};
  for (const f of fields) {
    if (f.type !== 'formula') inputs[f.id] = cellToValue(f, firstRow.values[f.id] ?? null);
  }
  const modifiedMs = Date.parse(firstRow.updatedAt);
  const createdMs = Date.parse(firstRow.createdAt ?? firstRow.updatedAt);
  try {
    const engine = new FormulaEngine({
      fields: specs,
      rows: [
        {
          id: firstRow.id,
          createdMs: Number.isNaN(createdMs) ? 0 : createdMs,
          modifiedMs: Number.isNaN(modifiedMs) ? 0 : modifiedMs,
          inputs,
        },
      ],
      now: () => Date.now(),
    });
    const cell = valueToCell(engine.value(firstRow.id, PREVIEW_FIELD_ID));
    return cell === null || cell === '' ? EMPTY_PREVIEW : String(cell);
  } catch {
    // The engine reports formula problems as error values; a throw means the input itself is
    // unusable (for example over the length limit). Say so rather than break the dialog.
    return '#ERROR!';
  }
}
