// Region map for plugin-vs-prototype comparison (SAD-75 / Step 0).
// Each region names the element on both pages. A list of selectors means "first match wins", so the
// map keeps working while later steps rename plugin classes. `styles` lists the computed properties
// compared for that region; geometry (width/height) is always compared.

export interface Region {
  id: string;
  plugin: string[];
  prototype: string[];
  styles: string[];
  /** Pixel comparison of the element crop; off for regions whose content is data-dependent. */
  pixels?: boolean;
}

const BOX = ['background-color', 'border-top-color', 'border-top-width', 'border-top-left-radius', 'box-shadow'];
const TEXT = ['font-family', 'font-size', 'font-weight', 'color', 'letter-spacing', 'text-transform'];
const PAD = ['padding-top', 'padding-right', 'padding-bottom', 'padding-left'];

export const REGIONS: Region[] = [
  { id: 'card', plugin: ['.tablify__card'], prototype: ['main > div.flex-1'], styles: [...BOX, ...PAD] },
  { id: 'title-row', plugin: ['.tablify__title-row'], prototype: ['#titleRow'], styles: [], pixels: true },
  { id: 'title', plugin: ['.tablify__title'], prototype: ['#editableTableTitle'], styles: [...TEXT] },
  { id: 'file-chip', plugin: ['.tablify__file-chip'], prototype: ['#fileChip'], styles: [...BOX, ...TEXT, ...PAD] },
  { id: 'toolbar-row', plugin: ['.tablify__toolbar-row'], prototype: ['#toolbarRow'], styles: ['border-bottom-width'], pixels: true },
  { id: 'search', plugin: ['input.tablify__search-input'], prototype: ['#searchInput'], styles: [...BOX, ...TEXT, ...PAD] },
  { id: 'btn-add-row', plugin: ['button[data-action="add-row"]', 'button[data-action="addRow"]'], prototype: ['#toolbarRow button[onclick="addRow()"]'], styles: [...BOX, ...TEXT, ...PAD], pixels: true },
  { id: 'btn-add-field', plugin: ['button[data-action="add-field"]', 'button[data-action="addField"]'], prototype: ['#toolbarRow button[onclick="showAddFieldModal()"]'], styles: [...BOX, ...TEXT, ...PAD], pixels: true },
  { id: 'btn-options', plugin: ['button[data-action="options"]'], prototype: ['#optionsBtn'], styles: [...BOX, ...TEXT, ...PAD], pixels: true },
  { id: 'btn-sync', plugin: ['button[data-action="sync"]'], prototype: ['#toolbarRow button[onclick="openSyncModal()"]'], styles: [...BOX, ...TEXT, ...PAD], pixels: true },
  { id: 'btn-filter', plugin: ['button[data-action="filter"]'], prototype: ['#toolbarRow button[onclick="openFilterBuilder()"]'], styles: [...BOX, ...TEXT, ...PAD], pixels: true },
  { id: 'btn-redo', plugin: ['button[data-action="redo"]'], prototype: ['#toolbarRow button[onclick="redo()"]'], styles: [...BOX, ...PAD], pixels: true },
  { id: 'btn-undo', plugin: ['button[data-action="undo"]'], prototype: ['#toolbarRow button[onclick="undo()"]'], styles: [...BOX, ...PAD], pixels: true },
  { id: 'row-count', plugin: ['.tablify__rowcount'], prototype: ['#rowCountBadge'], styles: [...TEXT] },
  // SAD-79: the shell is size-identical now, so the whole grid is pixel-compared.
  { id: 'grid-shell', plugin: ['.tablify--grid'], prototype: ['#tableInnerContainer'], styles: [...BOX, ...PAD], pixels: true },
  { id: 'header-capsule', plugin: ['.tablify__header-cell[data-field-id] .tablify__header-capsule', '.tablify__header-cell[data-field-id]', '.tablify__header-cell'], prototype: ['.header-capsule'], styles: [...BOX, ...PAD], pixels: true },
  { id: 'header-name', plugin: ['.tablify__hc-name', '.tablify__hc-name--static', '.tablify__header-name', '.tablify__header-cell'], prototype: ['.header-capsule button'], styles: [...TEXT] },
  { id: 'type-badge', plugin: ['.tablify__hc-badge', '.tablify__type-badge'], prototype: ['.header-capsule span.font-mono'], styles: [...BOX, ...TEXT, ...PAD], pixels: true },
  { id: 'header-num', plugin: ['.tablify__header .tablify__lead--num'], prototype: ['#tableHeaderHead th:nth-child(2)'], styles: [...TEXT], pixels: true },
  { id: 'body-cell', plugin: ['.tablify__row .tablify__cell[data-field-id] .tablify__capsule', '.tablify__row .tablify__cell[data-field-id]', '.tablify__row .tablify__cell'], prototype: ['.cell-capsule'], styles: [...BOX, ...TEXT, ...PAD], pixels: true },
  { id: 'row-number', plugin: ['.tablify__row .tablify__lead--num'], prototype: ['#tableBody tr:first-child td:nth-child(2)'], styles: [...TEXT], pixels: true },
  { id: 'insert-row', plugin: ['.tablify__insert-row'], prototype: ['#insertRowBtn'], styles: [...BOX, ...TEXT], pixels: true },
];

/** Prototype float panel (Options) region, captured only in the options-open state. */
export const OPTIONS_REGION: Region = {
  id: 'options-panel', plugin: ['.tablify__options'], prototype: ['#floatPanel'], styles: [...BOX], pixels: true,
};
