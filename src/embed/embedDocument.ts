// P7-01 — one in-memory document per .tablify file, shared by every embed of that file.
//
// Two embeds of the same file use one TableSession, so an edit in one shows in the other on the
// next render. Every change goes through the session's command stack, then is saved with the
// same serialize() path as the full view. The file itself is the shared truth: when it changes
// outside this document (another editor, sync, the full view saving), the registry reloads it.
//
// Pure TypeScript with an injected I/O object, so it runs in Node tests.

import { parse } from '../format/parse.js';
import { serialize } from '../format/serialize.js';
import { createSession, type TableSession } from '../model/tableSession.js';

export interface EmbedIO {
  /** Reads the file text. Rejects when the file is missing. */
  read(path: string): Promise<string>;
  /** Writes the file text. */
  write(path: string, text: string): Promise<void>;
}

export class EmbedDocument {
  readonly path: string;
  private readonly io: EmbedIO;
  private session: TableSession | null = null;
  private error: string | null = null;
  /** Text this document last read or wrote. Used to skip our own writes when the file changes. */
  private lastText: string | null = null;
  private readonly listeners = new Set<() => void>();
  private writeChain: Promise<void> = Promise.resolve();

  constructor(path: string, io: EmbedIO) {
    this.path = path;
    this.io = io;
  }

  /** Current session, or null when the file is missing or invalid. */
  getSession(): TableSession | null {
    return this.session;
  }

  getError(): string | null {
    return this.error;
  }

  /** Reads the file and builds the session. A missing file is an error state, not a throw. */
  async load(): Promise<void> {
    let text: string;
    try {
      text = await this.io.read(this.path);
    } catch {
      this.setFailure(`Tablify embed: the file "${this.path}" was not found.`);
      return;
    }
    this.applyText(text);
    this.notify();
  }

  /**
   * The file changed on disk. Reloads unless the text is the one we last read or wrote, which is
   * the case for our own saves. Returns true when the content was reloaded.
   */
  async fileChanged(): Promise<boolean> {
    let text: string;
    try {
      text = await this.io.read(this.path);
    } catch {
      this.setFailure(`Tablify embed: the file "${this.path}" was not found.`);
      this.notify();
      return true;
    }
    if (text === this.lastText) return false;
    this.applyText(text);
    this.notify();
    return true;
  }

  /** Runs a model change (undoable through the session), then saves and notifies all embeds. */
  mutate(change: (s: TableSession) => void): void {
    if (!this.session) return;
    change(this.session);
    this.commit();
  }

  /** Called after an edit that already went through the command stack (for example an inline editor). */
  commit(): void {
    this.notify();
    void this.save();
  }

  /** Saves the serialized session. Writes run one at a time, so saves land in order. */
  save(): Promise<void> {
    const s = this.session;
    if (!s) return this.writeChain;
    const text = serialize(s.toFile());
    this.writeChain = this.writeChain
      .then(async () => {
        if (text === this.lastText) return;
        await this.io.write(this.path, text);
        this.lastText = text;
      })
      .catch(() => {
        // The write failed. Keep the in-memory state, so nothing is lost while the user retries.
        // The error message does not include the file text.
      });
    return this.writeChain;
  }

  subscribe(fn: () => void): () => void {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  }

  notify(): void {
    for (const fn of [...this.listeners]) fn();
  }

  private applyText(text: string): void {
    const parsed = parse(text);
    if (!parsed.ok) {
      this.session = null;
      this.error = parsed.error ?? 'Tablify embed: the file could not be read.';
      this.lastText = text;
      return;
    }
    this.session = createSession(parsed.data);
    this.error = null;
    this.lastText = text;
  }

  private setFailure(message: string): void {
    this.session = null;
    this.error = message;
    this.lastText = null;
  }
}

/** Shares one EmbedDocument per path. The document is dropped when the last embed releases it. */
export class EmbedRegistry {
  private readonly docs = new Map<string, { doc: EmbedDocument; refs: number }>();

  /** Returns the shared document, loading it on first use. */
  async acquire(path: string, io: EmbedIO): Promise<EmbedDocument> {
    const existing = this.docs.get(path);
    if (existing) {
      existing.refs += 1;
      return existing.doc;
    }
    const doc = new EmbedDocument(path, io);
    this.docs.set(path, { doc, refs: 1 });
    await doc.load();
    return doc;
  }

  release(path: string): void {
    const entry = this.docs.get(path);
    if (!entry) return;
    entry.refs -= 1;
    if (entry.refs <= 0) this.docs.delete(path);
  }

  /** Forwards a file change to the shared document, if one is open. */
  async fileChanged(path: string): Promise<void> {
    const entry = this.docs.get(path);
    if (!entry) return;
    await entry.doc.fileChanged();
  }

  /** For tests and diagnostics. */
  size(): number {
    return this.docs.size;
  }

  refCount(path: string): number {
    return this.docs.get(path)?.refs ?? 0;
  }
}
