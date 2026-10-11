/**
 * @vitest-environment jsdom
 *
 * SAD-85 (Step 7a) — the shared prototype modal card. dressProtoModal only adds classes, the
 * theme variables and the title glyph; the three shell-only dialogs wear it without any change to
 * their controls.
 */
import { describe, it, expect, beforeEach } from 'vitest';
import { App, Modal } from 'obsidian';
import { dressProtoModal } from '../../src/ui/protoModal.js';
import { FormulaEditModal } from '../../src/views/grid/FormulaEditModal.js';
import { LinkPickerModal } from '../../src/views/grid/LinkPickerModal.js';
import { LinkIntegrityModal } from '../../src/commands/linkIntegrity.js';

describe('SAD-85 — dressProtoModal', () => {
  beforeEach(() => {
    document.body.className = '';
  });

  it('adds the card classes, the default sm width and the theme variables', () => {
    const modal = new Modal(new App() as never);
    dressProtoModal(modal);
    const cls = modal.modalEl.classList;
    expect(cls.contains('tablify__modal')).toBe(true);
    expect(cls.contains('tablify__pmodal')).toBe(true);
    expect(cls.contains('tablify__pmodal--sm')).toBe(true);
    expect(cls.contains('tablify--light')).toBe(true);
    expect(modal.modalEl.style.getPropertyValue('--tablify-accent-fill')).not.toBe('');
  });

  it('follows the dark host theme and the requested width', () => {
    document.body.classList.add('theme-dark');
    const modal = new Modal(new App() as never);
    dressProtoModal(modal, { size: '2xl' });
    expect(modal.modalEl.classList.contains('tablify--dark')).toBe(true);
    expect(modal.modalEl.classList.contains('tablify__pmodal--2xl')).toBe(true);
  });

  it('puts one decorative glyph before the title text, however often it is called', () => {
    const modal = new Modal(new App() as never);
    modal.setTitle('Edit formula');
    dressProtoModal(modal, { icon: 'link' });
    dressProtoModal(modal, { icon: 'link' });
    const icons = modal.titleEl.querySelectorAll('.tablify__pmodal-icon');
    expect(icons).toHaveLength(1);
    expect(icons[0].getAttribute('aria-hidden')).toBe('true');
    expect(modal.titleEl.firstElementChild).toBe(icons[0]);
    expect(modal.titleEl.textContent).toBe('Edit formula');
  });

  it('leaves the content untouched', () => {
    const modal = new Modal(new App() as never);
    modal.contentEl.innerHTML = '<p>body</p>';
    dressProtoModal(modal, { icon: 'link' });
    expect(modal.contentEl.innerHTML).toBe('<p>body</p>');
  });

  it('dresses Edit formula, Link picker and Link integrity', () => {
    const app = new App() as never;
    const formula = new FormulaEditModal(app, '{A}', () => undefined);
    const index = { byTableId: () => ({ id: 't', name: 'T', rows: [] }) };
    const picker = new LinkPickerModal({
      app,
      field: { id: 'f', name: 'L', type: 'link', linkTableId: 't' } as never,
      current: [],
      index: index as never,
      onSave: () => undefined,
    });
    const integrity = new LinkIntegrityModal(app, { checked: 0, broken: [], duplicates: [] } as never);
    for (const [modal, size, title] of [
      [formula, 'sm', 'Edit formula'],
      [picker, 'md', 'Link: L'],
      [integrity, 'md', 'Link integrity'],
    ] as const) {
      modal.open();
      expect(modal.modalEl.classList.contains('tablify__pmodal')).toBe(true);
      expect(modal.modalEl.classList.contains(`tablify__pmodal--${size}`)).toBe(true);
      expect(modal.titleEl.querySelector('.tablify__pmodal-icon svg')).not.toBeNull();
      expect(modal.titleEl.textContent).toBe(title);
    }
  });
});
