/**
 * Vault-side link index (P8-04, SAD-63). Thin Obsidian layer over `src/model/link.ts`.
 *
 * - Reads every .tablify file in the vault (cached by mtime) and keeps one snapshot per file.
 * - An open table publishes its live state, so unsaved edits resolve correctly and a deleted
 *   target row shows at once. The file on disk is not read while a view has it open.
 * - Vault events (create, modify, delete, rename) schedule a debounced refresh. Listeners (open
 *   table views) are told when the index changed, so they can redraw broken-link markers.
 */

import type { App, Plugin } from 'obsidian';
import { parse } from '../format/parse.js';
import { createLinkIndex, snapshotTable, type LinkIndex, type TableSnapshot } from '../model/link.js';

const DEBOUNCE_MS = 250;

export class VaultLinkIndex {
  readonly index: LinkIndex = createLinkIndex();
  /** Paths whose file is open in a view, mapped to the live snapshot. */
  private readonly live = new Map<string, TableSnapshot>();
  /** mtime of the disk version last read, per path. */
  private readonly stamps = new Map<string, number>();
  private readonly listeners = new Set<() => void>();
  private timer: ReturnType<typeof setTimeout> | null = null;
  private running: Promise<void> = Promise.resolve();

  constructor(private readonly app: App) {}

  /** Wire the vault events and run the first refresh. Called once from the plugin's onload. */
  start(plugin: Plugin): void {
    const schedule = (): void => this.schedule();
    plugin.registerEvent(this.app.vault.on('create', schedule));
    plugin.registerEvent(this.app.vault.on('modify', schedule));
    plugin.registerEvent(this.app.vault.on('delete', schedule));
    plugin.registerEvent(this.app.vault.on('rename', schedule));
    this.app.workspace.onLayoutReady(() => void this.refresh());
  }

  onChange(listener: () => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /** Refresh now. Refreshes run one after another, so two never overlap. */
  refresh(): Promise<void> {
    this.running = this.running.then(() => this.doRefresh(), () => this.doRefresh());
    return this.running;
  }

  /** An open view publishes its state. Listeners are told only when the snapshot changed. */
  noteLive(path: string, snapshot: TableSnapshot): void {
    this.live.set(path, snapshot);
    const prev = this.index.get(path);
    if (prev && JSON.stringify(prev) === JSON.stringify(snapshot)) return;
    this.index.put(snapshot);
    this.notify();
  }

  /** The view closed. The next refresh reads the file from disk again. */
  dropLive(path: string): void {
    this.live.delete(path);
    this.stamps.delete(path);
    this.schedule();
  }

  private schedule(): void {
    if (this.timer !== null) clearTimeout(this.timer);
    this.timer = setTimeout(() => {
      this.timer = null;
      void this.refresh();
    }, DEBOUNCE_MS);
  }

  private async doRefresh(): Promise<void> {
    const files = this.app.vault.getFiles().filter((f) => f.extension === 'tablify');
    const present = new Set<string>();
    let changed = false;
    for (const file of files) {
      present.add(file.path);
      if (this.live.has(file.path)) continue;
      if (this.stamps.get(file.path) === file.stat.mtime) continue;
      const text = await this.app.vault.cachedRead(file);
      this.stamps.set(file.path, file.stat.mtime);
      const parsed = parse(text);
      if (parsed.ok) {
        this.index.put(snapshotTable(parsed.data, file.path));
      } else {
        // An unreadable file has no tables to link to. Its links show as missing.
        this.index.remove(file.path);
      }
      changed = true;
    }
    // A file that is gone (deleted, or renamed away from its old path) leaves the index.
    for (const path of this.index.paths()) {
      if (!present.has(path)) {
        this.index.remove(path);
        this.stamps.delete(path);
        this.live.delete(path);
        changed = true;
      }
    }
    for (const path of [...this.live.keys()]) {
      if (!present.has(path)) this.live.delete(path);
    }
    if (changed) this.notify();
  }

  private notify(): void {
    for (const listener of [...this.listeners]) listener();
  }
}

const indexes = new WeakMap<App, VaultLinkIndex>();

/** One index per app. Views and commands share it. */
export function linkIndexFor(app: App): VaultLinkIndex {
  let idx = indexes.get(app);
  if (!idx) {
    idx = new VaultLinkIndex(app);
    indexes.set(app, idx);
  }
  return idx;
}
