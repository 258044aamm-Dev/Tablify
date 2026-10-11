// Visual-parity harness entry (SAD-75 / Step 0).
// Bundled by tests/visual/lib/harness.ts with `obsidian` aliased to tests/__mocks__/obsidian.ts,
// then loaded into a page that mimics Obsidian's leaf DOM. It mounts the real TableView —
// the same class Obsidian runs — so captures show production rendering, not a re-implementation.
import { TableView } from '../../../src/views/tableView';
import { FilterBuilderModal } from '../../../src/views/grid/FilterBuilderModal';
import { App, TFile, WorkspaceLeaf } from 'obsidian';

declare global {
  interface Window {
    __TABLIFY_FIXTURE__?: string;
    __TABLIFY_FILE_PATH__?: string;
    __tablifyView?: TableView;
    __tablifyReady?: boolean;
    __tablifyOpenFilterBuilder?: (input: string) => void;
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
  window.__tablifyOpenFilterBuilder = (input: string) => {
    const fields = (view as unknown as { session: { getFields(): unknown[] } }).session.getFields();
    const modal = new FilterBuilderModal(app as never, fields as never, input, () => undefined);
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
  window.__tablifyReady = true;
}

void mount();
