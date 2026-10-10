/**
 * Minimal Obsidian API mock for jsdom tests.
 *
 * Why this exists: SAD-69 happened partly because nothing could test Obsidian-facing UI.
 * No test file imported `tableView.ts` or `tableMenu.ts`, because they import 'obsidian'
 * and there was no mock — so P3-08 shipped a toolbar that was never rendered anywhere, and
 * the evidence file recorded it as "NOT RUN". Every piece of SAD-69 UI is now covered by
 * tests that run against this mock.
 *
 * Scope: only what src/ actually imports (plus the DOM helpers Obsidian adds to
 * HTMLElement). `Notice` and `Menu` keep their inputs so tests can assert on them.
 *
 * Wired up via the `obsidian` resolve alias in vitest.config.ts, so transitive imports
 * resolve here too — no per-file vi.mock() needed.
 */

// ---------------------------------------------------------------------------
// Obsidian's DOM helper augmentation
// ---------------------------------------------------------------------------

interface ElOptions {
  cls?: string | string[];
  text?: string;
  attr?: Record<string, string | number | boolean | null>;
  type?: string;
  placeholder?: string;
  value?: string;
  title?: string;
  href?: string;
}

function applyOptions(el: HTMLElement, options: ElOptions): HTMLElement {
  if (options.cls) {
    const classes = Array.isArray(options.cls) ? options.cls : [options.cls];
    for (const c of classes) if (c) el.classList.add(c);
  }
  if (options.text !== undefined) el.textContent = options.text;
  if (options.attr) {
    for (const [k, v] of Object.entries(options.attr)) {
      if (v === null || v === false) continue;
      el.setAttribute(k, v === true ? '' : String(v));
    }
  }
  if (options.type) el.setAttribute('type', options.type);
  if (options.placeholder) el.setAttribute('placeholder', options.placeholder);
  if (options.value !== undefined) el.setAttribute('value', options.value);
  if (options.title) el.setAttribute('title', options.title);
  if (options.href) el.setAttribute('href', options.href);
  return el;
}

const AUGMENTED = '__tablifyObsidianDomAugmented';
const proto = HTMLElement.prototype as unknown as Record<string, unknown>;

if (!proto[AUGMENTED]) {
  proto.createEl = function createEl(
    this: HTMLElement,
    tag: string,
    options?: ElOptions,
  ): HTMLElement {
    const el = document.createElement(tag);
    if (options) applyOptions(el, options);
    this.appendChild(el);
    return el;
  };
  proto.createDiv = function createDiv(this: HTMLElement, options?: ElOptions): HTMLElement {
    return (this as unknown as { createEl: typeof createEl }).createEl('div', options);
  };
  proto.createSpan = function createSpan(this: HTMLElement, options?: ElOptions): HTMLElement {
    return (this as unknown as { createEl: typeof createEl }).createEl('span', options);
  };
  proto.addClass = function addClass(this: HTMLElement, ...classes: string[]): void {
    for (const c of classes) if (c) this.classList.add(c);
  };
  proto.removeClass = function removeClass(this: HTMLElement, ...classes: string[]): void {
    for (const c of classes) this.classList.remove(c);
  };
  proto.hasClass = function hasClass(this: HTMLElement, cls: string): boolean {
    return this.classList.contains(cls);
  };
  proto.toggleClass = function toggleClass(
    this: HTMLElement,
    cls: string,
    value?: boolean,
  ): void {
    const on = value === undefined ? !this.classList.contains(cls) : value;
    if (on) this.classList.add(cls);
    else this.classList.remove(cls);
  };
  proto.setAttrs = function setAttrs(
    this: HTMLElement,
    attrs: Record<string, string | number | boolean | null>,
  ): void {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === false) this.removeAttribute(k);
      else this.setAttribute(k, v === true ? '' : String(v));
    }
  };
  proto.setText = function setText(this: HTMLElement, text: string): void {
    this.textContent = text;
  };
  proto.empty = function empty(this: HTMLElement): void {
    while (this.firstChild) this.removeChild(this.firstChild);
  };
  proto[AUGMENTED] = true;
}

// Declared so the calls above type-check against the augmented prototype.
declare global {
  interface HTMLElement {
    createEl(tag: string, options?: ElOptions): HTMLElement;
    createDiv(options?: ElOptions): HTMLElement;
    createSpan(options?: ElOptions): HTMLElement;
    addClass(...classes: string[]): void;
    removeClass(...classes: string[]): void;
    hasClass(cls: string): boolean;
    toggleClass(cls: string, value?: boolean): void;
    setAttrs(attrs: Record<string, string | number | boolean | null>): void;
    setText(text: string): void;
    empty(): void;
  }
}

// ---------------------------------------------------------------------------
// Core Obsidian classes
// ---------------------------------------------------------------------------

export class Notice {
  /** Every message shown, oldest first. Tests read and reset this. */
  static messages: string[] = [];

  constructor(
    message: string | DocumentFragment,
    public timeout?: number,
  ) {
    Notice.messages.push(typeof message === 'string' ? message : String(message));
  }

  hide(): void {
    /* no-op */
  }

  static reset(): void {
    Notice.messages = [];
  }
}

export class App {
  vault = {
    getFiles: (): TFile[] => [],
    getAbstractFileByPath: (): TAbstractFile | null => null,
    getName: () => 'vault',
  };
  workspace = {
    getActiveFile: (): TFile | null => null,
    getLeaf: () => null,
    iterateAllLeaves: (): void => {
      /* no-op */
    },
  };
  fileManager = {
    generateMarkdownLink: (): string => '',
  };
}

export class WorkspaceLeaf {
  app: App;
  view: unknown = null;

  constructor(app: App = new App()) {
    this.app = app;
  }

  async openFile(_file: TFile): Promise<void> {
    /* no-op */
  }

  async setViewState(_state: unknown): Promise<void> {
    /* no-op */
  }
}

export interface MenuItemApi {
  title: string;
  disabled: boolean;
  icon: string;
  callback?: (evt: MouseEvent) => void;
  setTitle(title: string | DocumentFragment): MenuItemApi;
  setDisabled(disabled: boolean): MenuItemApi;
  setIcon(icon: string): MenuItemApi;
  onClick(cb: (evt: MouseEvent) => void): MenuItemApi;
}

export class Menu {
  /** Items and separators in the order added, so tests can assert on the menu contents. */
  items: Array<{ type: 'item'; api: MenuItemApi } | { type: 'separator' }> = [];
  closed = false;

  addItem(cb: (item: MenuItemApi) => void): this {
    const api = {
      title: '',
      disabled: false,
      icon: '',
      callback: undefined as ((evt: MouseEvent) => void) | undefined,
      setTitle(title: string | DocumentFragment) {
        this.title = typeof title === 'string' ? title : String(title);
        return this;
      },
      setDisabled(disabled: boolean) {
        this.disabled = disabled;
        return this;
      },
      setIcon(icon: string) {
        this.icon = icon;
        return this;
      },
      onClick(cb2: (evt: MouseEvent) => void) {
        this.callback = cb2;
        return this;
      },
    } as MenuItemApi;
    cb(api);
    this.items.push({ type: 'item', api });
    return this;
  }

  addSeparator(): this {
    this.items.push({ type: 'separator' });
    return this;
  }

  showAtMouseEvent(_evt: MouseEvent): void {
    /* no-op */
  }

  showAtPosition(_pos: { x: number; y: number }): void {
    /* no-op */
  }

  close(): void {
    this.closed = true;
  }
}

export class Modal {
  app: App;
  contentEl: HTMLElement;
  titleEl: HTMLElement;
  modalEl: HTMLElement;
  isOpen = false;

  title = '';

  constructor(app: App) {
    this.app = app;
    this.contentEl = document.createElement('div');
    this.titleEl = document.createElement('div');
    this.modalEl = document.createElement('div');
  }

  setTitle(title: string): void {
    this.title = title;
    this.titleEl.textContent = title;
  }

  /** Every modal opened since the last reset, so tests can observe what the UI opened. */
  static opened: Modal[] = [];

  open(): void {
    this.isOpen = true;
    Modal.opened.push(this);
    this.onOpen();
  }

  close(): void {
    this.isOpen = false;
    this.onClose();
  }

  onOpen(): void {
    /* subclass hook */
  }

  onClose(): void {
    /* subclass hook */
  }

  static reset(): void {
    Modal.opened = [];
  }
}

export abstract class FuzzySuggestModal<T> extends Modal {
  inputEl: HTMLInputElement;
  placeholder = '';
  /** Result of the last getItems(), captured when the modal opens. */
  lastItems: T[] = [];

  constructor(app: App) {
    super(app);
    this.inputEl = document.createElement('input');
  }

  abstract getItems(): T[];
  abstract getItemText(item: T): string;
  abstract onChooseItem(item: T, evt: MouseEvent | KeyboardEvent): void;

  setPlaceholder(placeholder: string): void {
    this.placeholder = placeholder;
  }

  open(): void {
    this.lastItems = this.getItems();
    super.open();
  }
}

export class Setting {
  settingEl: HTMLElement;
  nameEl: HTMLElement;
  descEl: HTMLElement;
  controlEl: HTMLElement;
  name = '';
  desc = '';
  /** Values pushed through addText/addDropdown/addToggle, for assertions. */
  controls: unknown[] = [];

  constructor(containerEl: HTMLElement) {
    this.settingEl = containerEl.createDiv({ cls: 'setting-item' });
    this.nameEl = this.settingEl.createDiv({ cls: 'setting-item-name' });
    this.descEl = this.settingEl.createDiv({ cls: 'setting-item-description' });
    this.controlEl = this.settingEl.createDiv({ cls: 'setting-item-control' });
  }

  setName(name: string): this {
    this.name = name;
    this.nameEl.textContent = name;
    return this;
  }

  setDesc(desc: string): this {
    this.desc = desc;
    this.descEl.textContent = desc;
    return this;
  }

  setHeading(): this {
    this.settingEl.classList.add('setting-item-heading');
    return this;
  }

  // Component APIs mirror Obsidian: every setter returns the component, so calls chain
  // (`.setValue(x).onChange(fn)`), which is how src/ uses them.
  addText(cb: (text: TextComponent) => void): this {
    const input = this.controlEl.createEl('input', { type: 'text' });
    const api: TextComponent = {
      input,
      inputEl: input,
      setValue(v: string) {
        input.value = v;
        return api;
      },
      getValue() {
        return input.value;
      },
      setPlaceholder(p: string) {
        input.placeholder = p;
        return api;
      },
      onChange(fn: (v: string) => void) {
        input.addEventListener('input', () => fn(input.value));
        return api;
      },
      setDisabled(disabled: boolean) {
        input.disabled = disabled;
        return api;
      },
    };
    this.controls.push({ kind: 'text', input });
    cb(api);
    return this;
  }

  addDropdown(cb: (dd: DropdownComponent) => void): this {
    const select = this.controlEl.createEl('select');
    const api: DropdownComponent = {
      select,
      addOption(value: string, label: string) {
        const opt = select.createEl('option', { value });
        opt.textContent = label;
        return api;
      },
      addOptions(options: Record<string, string>) {
        for (const [value, label] of Object.entries(options)) api.addOption(value, label);
        return api;
      },
      setValue(v: string) {
        select.value = v;
        return api;
      },
      getValue() {
        return select.value;
      },
      onChange(fn: (v: string) => void) {
        select.addEventListener('change', () => fn(select.value));
        return api;
      },
    };
    this.controls.push({ kind: 'dropdown', select });
    cb(api);
    return this;
  }

  addToggle(cb: (t: ToggleComponent) => void): this {
    const input = this.controlEl.createEl('input', { type: 'checkbox' });
    const api: ToggleComponent = {
      input,
      setValue(v: boolean) {
        input.checked = v;
        return api;
      },
      getValue() {
        return input.checked;
      },
      onChange(fn: (v: boolean) => void) {
        input.addEventListener('change', () => fn(input.checked));
        return api;
      },
    };
    this.controls.push({ kind: 'toggle', input });
    cb(api);
    return this;
  }

  addButton(cb: (b: ButtonComponent) => void): this {
    const button = this.controlEl.createEl('button');
    const api: ButtonComponent = {
      button,
      setButtonText(text: string) {
        button.textContent = text;
        return api;
      },
      setCta() {
        button.classList.add('mod-cta');
        return api;
      },
      setWarning() {
        button.classList.add('mod-warning');
        return api;
      },
      setIcon(icon: string) {
        button.dataset.icon = icon;
        return api;
      },
      setTooltip(tooltip: string) {
        button.title = tooltip;
        return api;
      },
      onClick(fn: (evt: MouseEvent) => void) {
        button.addEventListener('click', (evt) => fn(evt as MouseEvent));
        return api;
      },
    };
    this.controls.push({ kind: 'button', button });
    cb(api);
    return this;
  }
}

export interface TextComponent {
  inputEl: HTMLInputElement;
  input: HTMLInputElement;
  setValue(v: string): TextComponent;
  getValue(): string;
  setPlaceholder(p: string): TextComponent;
  onChange(fn: (v: string) => void): TextComponent;
  setDisabled(disabled: boolean): TextComponent;
}

export interface DropdownComponent {
  select: HTMLSelectElement;
  addOption(value: string, label: string): DropdownComponent;
  addOptions(options: Record<string, string>): DropdownComponent;
  setValue(v: string): DropdownComponent;
  getValue(): string;
  onChange(fn: (v: string) => void): DropdownComponent;
}

export interface ToggleComponent {
  input: HTMLInputElement;
  setValue(v: boolean): ToggleComponent;
  getValue(): boolean;
  onChange(fn: (v: boolean) => void): ToggleComponent;
}

export interface ButtonComponent {
  button: HTMLButtonElement;
  setButtonText(text: string): ButtonComponent;
  setCta(): ButtonComponent;
  setWarning(): ButtonComponent;
  setIcon(icon: string): ButtonComponent;
  setTooltip(tooltip: string): ButtonComponent;
  onClick(fn: (evt: MouseEvent) => void): ButtonComponent;
}

// ---------------------------------------------------------------------------
// TextFileView — the base class TableView extends
// ---------------------------------------------------------------------------

export class TextFileView {
  contentEl: HTMLElement;
  app: App;
  leaf: WorkspaceLeaf;
  file: TFile | null = null;
  /** Number of times requestSave() was called — lets tests assert a save was requested. */
  saveRequests = 0;
  /** Data passed to the most recent setViewData(). */
  lastViewData: string | null = null;

  constructor(leaf: WorkspaceLeaf) {
    this.leaf = leaf;
    this.app = leaf.app;
    this.contentEl = document.createElement('div');
  }

  requestSave(): void {
    this.saveRequests += 1;
  }

  getViewType(): string {
    return '';
  }

  getDisplayText(): string {
    return '';
  }

  canAcceptExtension(_extension: string): boolean {
    return false;
  }

  async onOpen(): Promise<void> {
    /* subclass hook */
  }

  async onClose(): Promise<void> {
    /* subclass hook */
  }

  setViewData(data: string, _clear: boolean): void {
    this.lastViewData = data;
  }

  getViewData(): string {
    return '';
  }

  clear(): void {
    /* subclass hook */
  }
}

// ---------------------------------------------------------------------------
// Vault file types and Plugin
// ---------------------------------------------------------------------------

export class TAbstractFile {
  name = '';
  path = '';
  parent: TFolder | null = null;
}

export class TFile extends TAbstractFile {
  basename = '';
  extension = '';
}

export class TFolder extends TAbstractFile {
  children: TAbstractFile[] = [];
}

export class Plugin {
  app: App;
  manifest: unknown;
  /** Commands registered via addCommand(), for assertions. */
  commands: Array<{ id: string; name: string; callback?: () => void }> = [];

  constructor(app: App, manifest: unknown) {
    this.app = app;
    this.manifest = manifest;
  }

  addCommand(command: { id: string; name: string; callback?: () => void }): typeof command {
    this.commands.push(command);
    return command;
  }

  registerView(_type: string, _factory: unknown): void {
    /* no-op */
  }

  registerExtensions(_extensions: string[], _type: string): void {
    /* no-op */
  }

  registerEvent(): void {
    /* no-op */
  }

  addRibbonIcon(): HTMLElement {
    return document.createElement('div');
  }

  addSettingTab(): void {
    /* no-op */
  }

  async loadData(): Promise<unknown> {
    return {};
  }

  async saveData(): Promise<void> {
    /* no-op */
  }
}

/** P7-03 test-only: Obsidian's settings tab base class. */
export class PluginSettingTab {
  app: App;
  plugin: unknown;
  containerEl: HTMLElement;

  constructor(app: App, plugin: unknown) {
    this.app = app;
    this.plugin = plugin;
    this.containerEl = document.createElement('div');
  }

  display(): void {
    /* overridden by subclasses */
  }

  hide(): void {
    /* overridden by subclasses */
  }
}

/** Stub for Obsidian's normalizePath — the real one lives behind the Obsidian runtime. */
export function normalizePath(path: string): string {
  return path.replace(/\\/g, '/').replace(/\/+/g, '/');
}

export function addIcon(): void {
  /* no-op */
}

export type { App as AppType };

// ---------------------------------------------------------------------------
// P7-02 test-only addition: requestUrl
//
// Production code calls Obsidian's requestUrl for every network call. Tests install a
// handler (a mock server, see tests/__mocks__/airtableServer.ts) with setRequestUrlHandler.
// With no handler installed, any call fails loudly so that no test can reach the network.
// ---------------------------------------------------------------------------

export interface RequestUrlParam {
  url: string;
  method?: string;
  contentType?: string;
  body?: string | ArrayBuffer;
  headers?: Record<string, string>;
  throw?: boolean;
}

export interface RequestUrlResponse {
  status: number;
  headers: Record<string, string>;
  arrayBuffer: ArrayBuffer;
  json: unknown;
  text: string;
}

export type RequestUrlHandler = (param: RequestUrlParam) => Promise<RequestUrlResponse>;

let requestUrlHandler: RequestUrlHandler | null = null;

export function setRequestUrlHandler(handler: RequestUrlHandler | null): void {
  requestUrlHandler = handler;
}

export async function requestUrl(
  param: RequestUrlParam | string,
): Promise<RequestUrlResponse> {
  const p: RequestUrlParam = typeof param === 'string' ? { url: param } : param;
  if (!requestUrlHandler) {
    throw new Error('requestUrl called in a test with no handler installed (network is disabled in tests)');
  }
  return requestUrlHandler(p);
}
