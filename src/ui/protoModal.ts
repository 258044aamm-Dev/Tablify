// SAD-85 (Step 7a): the prototype modal card, shared by every plugin dialog.
//
// The prototype draws each dialog as one card — `rounded-2xl p-6 shadow-2xl`, a Poppins 14/600
// title led by a terracotta Font Awesome glyph, Lora 12 body, `.pill-input` fields, a ghost
// Cancel and a terracotta primary button (see styles.css, "Prototype modal card"). This helper
// only adds classes, the theme variables and the title glyph: it never touches a modal's
// controls, handlers or content, so dressing a modal cannot change what it does.
import { applyTheme } from './theme/tokens.js';
import { faIcon, type FaGlyph } from './faIcons.js';

/** Card widths of the prototype dialogs (Tailwind `max-w-sm` / `max-w-md` / `max-w-xl` / `max-w-2xl`). */
export type ProtoModalSize = 'sm' | 'md' | 'xl' | '2xl';

export interface ProtoModalOptions {
  /** Glyph shown before the title, in the accent colour. */
  icon?: FaGlyph;
  /** Card width; defaults to the prototype's most common `max-w-sm` (384px). */
  size?: ProtoModalSize;
}

interface ModalParts {
  modalEl: HTMLElement;
  titleEl: HTMLElement;
}

export function dressProtoModal(modal: ModalParts, options: ProtoModalOptions = {}): void {
  const { modalEl, titleEl } = modal;
  modalEl.classList.add('tablify__modal', 'tablify__pmodal', `tablify__pmodal--${options.size ?? 'sm'}`);
  applyTheme(modalEl, document.body.classList.contains('theme-dark') ? 'dark' : 'light');
  if (options.icon && !titleEl.querySelector(':scope > .tablify__pmodal-icon')) {
    // faIcon returns trusted, generated SVG markup (src/ui/faIcons.ts), never user text.
    titleEl.insertAdjacentHTML('afterbegin', `<span class="tablify__pmodal-icon" aria-hidden="true">${faIcon(options.icon)}</span>`);
  }
}
