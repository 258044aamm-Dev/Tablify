// P7-01 — Obsidian wiring for the ```tablify code block (v1.1).
// Thin layer: parse the fence, share the document, render EmbedView, and release on unload.
// The logic lives in embedSource.ts, embedDocument.ts, and embedView.ts.

import { MarkdownRenderChild, TFile, type App, type MarkdownPostProcessorContext, type Plugin } from 'obsidian';
import { EmbedRegistry, type EmbedIO } from './embedDocument.js';
import { EmbedView } from './embedView.js';
import { parseEmbedSource } from './embedSource.js';

export const EMBED_FENCE_LANGUAGE = 'tablify';

/** Obsidian-backed I/O. Only .tablify files inside the vault are reachable, through the vault API. */
export function vaultEmbedIO(app: App): EmbedIO {
  const fileAt = (path: string): TFile => {
    const f = app.vault.getAbstractFileByPath(path);
    if (!(f instanceof TFile)) throw new Error('file not found');
    return f;
  };
  return {
    read: async (path) => app.vault.read(fileAt(path)),
    write: async (path, text) => {
      await app.vault.modify(fileAt(path), text);
    },
  };
}

class EmbedRenderChild extends MarkdownRenderChild {
  private readonly onDone: () => void;

  constructor(containerEl: HTMLElement, onDone: () => void) {
    super(containerEl);
    this.onDone = onDone;
  }

  onunload(): void {
    this.onDone();
  }
}

export interface EmbedRegistration {
  registry: EmbedRegistry;
}

export function registerEmbedProcessor(plugin: Plugin): EmbedRegistration {
  const registry = new EmbedRegistry();
  const app = plugin.app;

  plugin.registerMarkdownCodeBlockProcessor(
    EMBED_FENCE_LANGUAGE,
    async (source: string, el: HTMLElement, ctx: MarkdownPostProcessorContext) => {
      const parsed = parseEmbedSource(source);
      if (!parsed.ok) {
        const err = document.createElement('div');
        err.className = 'tablify__error';
        err.dataset.testid = 'tablify-embed-error';
        err.textContent = parsed.error;
        el.appendChild(err);
        return;
      }
      const path = parsed.path;
      const io = vaultEmbedIO(app);
      const doc = await registry.acquire(path, io);
      const view = new EmbedView({
        doc,
        onOpenFull: (p) => {
          void app.workspace.openLinkText(p, '', false);
        },
      });
      el.appendChild(view.root);
      ctx.addChild(
        new EmbedRenderChild(el, () => {
          view.destroy();
          registry.release(path);
        }),
      );
    },
  );

  // External changes (another editor, sync, the full view saving) reload the shared document.
  plugin.registerEvent(
    app.vault.on('modify', (file) => {
      if (file instanceof TFile) void registry.fileChanged(file.path);
    }),
  );

  return { registry };
}
