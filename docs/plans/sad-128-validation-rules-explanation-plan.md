# SAD-128 — Validation rules explanation plan

**Mode:** Plan only. This file records the proposed explanation and documentation work; it does not change the user guide, product code, or current behavior.

## Goal

Explain in plain language what the **Validation rules** controls do, why they are useful, and when to use them. Keep the answer faithful to the current implementation, including the important limitation that rule failures are highlighted but are not rejected or prevented from being saved.

## Verified current behavior

- The rule controls are in **Add New Field**. The current UI has no separate field-settings editor for changing validation rules on an already-created field. The header’s **Change field type…** action changes the type; it does not edit the rules.
- Configured rules are stored on the field (`required`, `unique`, `min`, `max`, `regex`) and serialized in the `.tablify` file, so they persist when the file is reopened.
- The grid evaluates rules while rendering cells and after edits/reloads. A violation gives the cell an invalid style, `aria-invalid="true"`, and a tooltip/message. The tooltip shows the first reported violation.
- A rule violation does **not** keep the editor open or stop the cell edit from being saved. Field-type parsing is a separate check and can still reject a value that cannot be parsed as that field type.
- Rule details:
  - **Required:** flags `null`, an empty string, and an empty array. A whitespace-only string currently counts as filled in.
  - **Unique:** checks other rows in the same field. String values are trimmed before comparison, but comparison remains case-sensitive; null and empty-string values are skipped. Use scalar keys (for example, a text code) in examples. The implementation uses strict equality for non-string values, so documentation should not promise deep uniqueness for array-valued fields such as Multi select or Link.
  - **Min / Max:** inclusive lower and upper bounds. Numeric values compare numerically; string values compare lexicographically. The dialog offers these for Number, Currency, Percent, Duration, Rating, Date, and Date and time fields, and parses the bound as it would parse a cell value. Rating Max also supplies the scale shown in rating group headings.
  - **Regex:** a JavaScript regular-expression pattern, offered for Text, Long text, URL, Email, and Phone fields. It is tested against the value; it is not automatically anchored to the whole string. Use `^` and `$` when the entire value must match, and enter the pattern itself rather than slash delimiters. Invalid pattern syntax is rejected in the dialog. Null and empty-string values are skipped by the other checks; empty arrays are treated as empty by Required, but array-valued fields should not be presented as reliably handled by Unique.

## Proposed documentation and response

If documentation work is authorized, make a narrowly scoped update to `docs/user-guide.md`:

1. In **§3 Fields and field types**, replace the stale statement that cells are not checked yet. Keep the note that Rating Max is also used for its group-heading scale.
2. Expand **§8 Validation** to explain each rule, the supported types for Min/Max and Regex, the cell-level marker/message, and the non-blocking behavior. Include practical scalar examples such as a required name, a unique record code, a numeric/date range, and a format pattern such as `^[A-Z]{3}-\d{4}$`.
3. State that rules are configured when adding a field in the current UI, and that the rules help surface issues rather than enforce a hard save-time constraint. Be explicit that an existing-field rule editor is not currently exposed.
4. Keep edge-case notes concise but accurate: whitespace-only text passes Required; string uniqueness is trimmed but case-sensitive; use anchors for a full Regex match. Do not imply that Unique deeply compares multi-select/link arrays.

The eventual SAD-128 response/comment should give a short definition, explain the benefits (spot missing, duplicated, out-of-range, or misformatted data), give a few use cases, link to §8, and set expectations that invalid values remain editable/saveable. It should not claim that rules can currently be edited on existing fields.

## Out of scope

- No product-code, model, UI, file-format, or test changes under this plan.
- No save-blocking, import-blocking, or new editor for changing rules on existing fields.
- Do not change historical evidence documents that describe the behavior at the time they were written.
- If hard enforcement, rule editing, or deep uniqueness for array-valued fields is desired, treat it as separate implementation work rather than broadening this documentation task.

## Acceptance criteria for a later authorized documentation step

- The user guide no longer contradicts the current grid behavior.
- It explains what each rule does, when it is useful, how invalid cells are surfaced, and that rule violations do not block editing/saving.
- It does not promise existing-field rule editing or deep uniqueness for array-valued fields.
- No product behavior changes; the issue remains Todo while this work is still plan-only.

## Inspection references

`src/model/validation.ts`, `src/views/grid/validationDisplay.ts`, `src/views/grid/GridView.ts`, `src/views/grid/editors/index.ts`, `src/views/grid/AddFieldModal.ts`, `src/views/tableView.ts`, `src/model/tableSession.ts`, `src/format/serialize.ts`, `src/views/grid/grouping.ts`, `docs/user-guide.md` §§3 and 8, `tests/model/validation.test.ts`, and `tests/views/grid/validationRender.test.ts`.
