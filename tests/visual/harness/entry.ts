// Visual-parity harness entry (SAD-75 / Step 0).
// Bundled by tests/visual/lib/harness.ts with `obsidian` aliased to tests/__mocks__/obsidian.ts,
// then loaded into a page that mimics Obsidian's leaf DOM. It mounts the real TableView —
// the same class Obsidian runs — so captures show production rendering, not a re-implementation.
import { TableView } from '../../../src/views/tableView';
import { FilterBuilderModal } from '../../../src/views/grid/FilterBuilderModal';
import { FormulaEditModal } from '../../../src/views/grid/FormulaEditModal';
import { LinkPickerModal } from '../../../src/views/grid/LinkPickerModal';
import { LinkIntegrityModal } from '../../../src/commands/linkIntegrity';
import { AddFieldModal } from '../../../src/views/grid/AddFieldModal';
import { previewFormula } from '../../../src/model/formulaPreview';
import { App, TFile, WorkspaceLeaf } from 'obsidian';

declare global {
  interface Window {
    __TABLIFY_FIXTURE__?: string;
    __TABLIFY_FILE_PATH__?: string;
    __tablifyView?: TableView;
    __tablifyReady?: boolean;
    __tablifyOpenFilterBuilder?: (input: string) => void;
    __tablifyOpenModal?: (kind: string) => void;
  }
}

async function mount(): Promise<void> {
  const host = document.querySelector('.workspace-leaf-content') as HTMLElement;
  const app = new App();
  const leaf = new WorkspaceLeaf(app);
  const view = new TableView(leaf as never);
  // Obsidian gives the view a file; the title row and sync read it. Name/path come from the page.
  const path = window.__TABLIFY_FILE_PATH__ ?? 'Tables/Untitled table.tablify';
  const file = new TFile();
  const f = file as unknown as { path: string; name: string; basename: string; extension: string };
  f.path = path;
  f.name = path.split('/').pop() ?? path;
  f.basename = f.name.replace(/\.tablify$/, '');
  f.extension = 'tablify';
  (view as unknown as { file: TFile }).file = file;
  // Obsidian's content element is `.view-content` inside the leaf.
  view.contentEl.classList.add('view-content');
  host.appendChild(view.contentEl);
  await view.onOpen();
  if (window.__TABLIFY_FIXTURE__ !== undefined) view.setViewData(window.__TABLIFY_FIXTURE__, true);
  view.onResize();
  window.__tablifyView = view;
  // SAD-78 capture hook: the obsidian mock's Modal never attaches to the DOM, so place the real
  // FilterBuilderModal in Obsidian's modal markup (.modal-container > .modal-bg + .modal with
  // .modal-close-button, .modal-header > .modal-title, .modal-content).
  // SAD-85: the same markup for any plugin modal (Obsidian's Modal.open() builds it for real).
  const mountModal = (modal: { titleEl: HTMLElement; contentEl: HTMLElement; modalEl: HTMLElement; open(): void }) => {
    modal.titleEl.classList.add('modal-title');
    modal.contentEl.classList.add('modal-content');
    modal.modalEl.classList.add('modal');
    modal.open();
    const container = document.createElement('div');
    container.className = 'modal-container mod-dim';
    const bg = document.createElement('div');
    bg.className = 'modal-bg';
    const close = document.createElement('div');
    close.className = 'modal-close-button';
    const header = document.createElement('div');
    header.className = 'modal-header';
    header.appendChild(modal.titleEl);
    modal.modalEl.append(close, header, modal.contentEl);
    container.append(bg, modal.modalEl);
    document.body.appendChild(container);
  };
  window.__tablifyOpenFilterBuilder = (input: string) => {
    const fields = (view as unknown as { session: { getFields(): unknown[] } }).session.getFields();
    mountModal(new FilterBuilderModal(app as never, fields as never, input, () => undefined));
  };
  window.__tablifyOpenModal = (kind: string) => {
    const noop = () => undefined;
    if (kind === 'formula') mountModal(new FormulaEditModal(app as never, '{Price} * 2', noop));
    if (kind === 'addField') {
      // SAD-86: as TableView.promptAddField builds it — this table as the link target, the
      // preview evaluated against row 1 of the live table.
      type Store = { getFields(): unknown[]; getDisplayOrder(): readonly string[]; getRow(id: string): unknown };
      const s = (view as unknown as { session: { store: Store; toFile(): { tableId: string } } }).session;
      const selfId = s.toFile().tableId;
      mountModal(
        new AddFieldModal(app as never, noop, {
          linkTargets: [{ tableId: selfId, name: f.basename }],
          defaultLinkTableId: selfId,
          formulaPreview: (expression) => {
            const first = s.store.getDisplayOrder()[0];
            return previewFormula(s.store.getFields() as never, (first === undefined ? undefined : s.store.getRow(first)) as never, expression);
          },
        }),
      );
    }
    if (kind === 'editField') {
      // COD-76 evidence: Modify Field with a model verdict on every type but this one's own, so the
      // blocked rows (greyed, with the reason) are on screen. The sentence is the shape
      // `planTypeChange` produces, not a made-up one.
      const field = { id: 'f1', name: 'Amount', type: 'number', required: false, unique: false, min: null, max: null, regex: null };
      mountModal(
        new AddFieldModal(app as never, noop, {
          mode: 'edit',
          initial: { field: field as never },
          // The sentence `planTypeChange` really produces (`fieldChange.ts:61`), so the capture
          // shows the copy users get rather than a placeholder.
          typeBlockReason: (type: string) =>
            type === 'number' ? null : `4 values cannot convert to ${type.replace(/_/g, ' ')}`,
        }),
      );
    }
    if (kind === 'linkPicker') {
      const rows = ['Acme Corp', 'Globex', 'Initech', 'Umbrella'].map((label, i) => ({ id: `r${i}`, label }));
      const index = { byTableId: () => ({ id: 't1', name: 'Customers', rows }) };
      const field = { id: 'f1', name: 'Customer', type: 'link', linkTableId: 't1' };
      const current = [{ tableId: 't1', rowId: 'r1' }];
      mountModal(new LinkPickerModal({ app: app as never, field: field as never, current, index: index as never, onSave: noop }));
    }
    if (kind === 'linkIntegrity') {
      const report = {
        checked: 12,
        broken: [{ sourceTable: 'Orders', sourcePath: 'Tables/Orders.tablify', fieldName: 'Customer', rowLabel: 'Order 7', message: 'the row was deleted', targetTableId: 't1', targetRowId: 'r9' }],
        duplicates: [],
      };
      mountModal(new LinkIntegrityModal(app as never, report as never));
    }
  };
  window.__tablifyReady = true;
}

void mount();
