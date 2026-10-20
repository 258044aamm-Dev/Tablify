/**
 * @vitest-environment jsdom
 *
 * SAD-356 — the menu an empty Attachment cell opens.
 *
 * Covers the markup (two entries, the issue's own labels), the keyboard focus it lands on, the two
 * callbacks, the dismissal rules it inherits from `wirePanelDismiss`, and the two host messages
 * (`setMessage` for a refused picker, `setBusy` while the copy runs).
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import {
  AttachmentMenu,
  CHOOSE_FILE_LABEL,
  ENTER_PATH_LABEL,
} from '../../../src/views/grid/AttachmentMenu.js';
import type { FieldDefinition } from '../../../src/model/types.js';

const FIELD: FieldDefinition = { id: 'fld_attach', name: 'Attachments', type: 'attachment' };

function makeAnchor(): HTMLElement {
  const anchor = document.createElement('div');
  anchor.getBoundingClientRect = () =>
    ({
      top: 100,
      left: 80,
      bottom: 134,
      right: 260,
      width: 180,
      height: 34,
      x: 80,
      y: 100,
      toJSON: () => ({}),
    }) as DOMRect;
  document.body.appendChild(anchor);
  return anchor;
}

function makeMenu(overrides: Partial<{ onChooseFile: () => void; onEnterPath: () => void; onDismiss: () => void }> = {}) {
  const onChooseFile = overrides.onChooseFile ?? vi.fn();
  const onEnterPath = overrides.onEnterPath ?? vi.fn();
  const onDismiss = overrides.onDismiss ?? vi.fn();
  const menu = new AttachmentMenu({ field: FIELD, onChooseFile, onEnterPath, onDismiss });
  return { menu, onChooseFile, onEnterPath, onDismiss };
}

function entries(menu: AttachmentMenu): HTMLButtonElement[] {
  return Array.from(menu.element.querySelectorAll<HTMLButtonElement>('[role="menuitem"]'));
}

beforeEach(() => {
  document.body.innerHTML = '';
});

afterEach(() => {
  document.body.innerHTML = '';
});

describe('SAD-356 — the empty-cell attachment menu', () => {
  it('renders the two entries the issue asks for, on the attachment card', () => {
    const { menu } = makeMenu();
    menu.open(makeAnchor());

    const card = document.body.querySelector<HTMLElement>('[data-testid="tablify-attachment-menu"]');
    expect(card).not.toBeNull();
    expect(card?.classList.contains('tablify__panel')).toBe(true);
    expect(card?.classList.contains('tablify__panel--attach')).toBe(true);
    expect(card?.getAttribute('aria-label')).toBe('Add an attachment to Attachments');
    expect(card?.querySelector('.tablify__attach-head')?.textContent).toBe('Add an attachment');

    const items = entries(menu);
    expect(items).toHaveLength(2);
    expect(items.map((b) => b.textContent)).toEqual([CHOOSE_FILE_LABEL, ENTER_PATH_LABEL]);
    expect(items[0].type).toBe('button');
    expect(items[0].querySelector('.tablify__attach-menu-icon')).not.toBeNull();
    expect(menu.element.querySelector('.tablify__attach-menu')?.getAttribute('role')).toBe('menu');
  });

  it('focuses the first entry when it opens', () => {
    const { menu } = makeMenu();
    menu.open(makeAnchor());
    expect(document.activeElement).toBe(entries(menu)[0]);
  });

  it('runs one callback per entry, and only that one', () => {
    const { menu, onChooseFile, onEnterPath } = makeMenu();
    menu.open(makeAnchor());

    entries(menu)[0].click();
    expect(onChooseFile).toHaveBeenCalledTimes(1);
    expect(onEnterPath).not.toHaveBeenCalled();

    entries(menu)[1].click();
    expect(onEnterPath).toHaveBeenCalledTimes(1);
    expect(onChooseFile).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape and on a press outside the card, reporting the dismissal once', () => {
    const { menu, onDismiss } = makeMenu();
    menu.open(makeAnchor());

    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(menu.element.isConnected).toBe(false);
    expect(onDismiss).toHaveBeenCalledTimes(1);

    // A second panel, dismissed by a press on the page behind it.
    const second = makeMenu();
    second.menu.open(makeAnchor());
    document.body.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(second.menu.element.isConnected).toBe(false);
    expect(second.onDismiss).toHaveBeenCalledTimes(1);
  });

  it('keeps a press inside the card open (choosing an entry must not dismiss first)', () => {
    const { menu, onDismiss } = makeMenu();
    menu.open(makeAnchor());
    entries(menu)[0].dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    expect(menu.element.isConnected).toBe(true);
    expect(onDismiss).not.toHaveBeenCalled();
  });

  it('shows a host message, and hides it again for an empty one', () => {
    const { menu } = makeMenu();
    menu.open(makeAnchor());

    const status = menu.element.querySelector<HTMLElement>('.tablify__attach-msg');
    expect(status?.hidden).toBe(true);

    menu.setMessage('This device did not open a file picker.');
    expect(status?.hidden).toBe(false);
    expect(status?.textContent).toBe('This device did not open a file picker.');
    expect(status?.getAttribute('role')).toBe('status');

    menu.setMessage('');
    expect(status?.hidden).toBe(true);
  });

  it('disables both entries and marks the card busy while a copy runs', () => {
    const { menu, onChooseFile } = makeMenu();
    menu.open(makeAnchor());

    menu.setBusy('Copying into your vault…');
    expect(menu.element.getAttribute('aria-busy')).toBe('true');
    expect(entries(menu).every((b) => b.disabled)).toBe(true);
    expect(menu.element.querySelector<HTMLElement>('.tablify__attach-msg')?.textContent).toBe(
      'Copying into your vault…',
    );

    entries(menu)[0].click();
    expect(onChooseFile).not.toHaveBeenCalled();

    menu.setBusy(null);
    expect(menu.element.getAttribute('aria-busy')).toBe('false');
    expect(entries(menu).every((b) => b.disabled)).toBe(false);
    entries(menu)[0].click();
    expect(onChooseFile).toHaveBeenCalledTimes(1);
  });

  it('leaves no listener behind once it is closed', () => {
    const { menu, onDismiss } = makeMenu();
    menu.open(makeAnchor());
    menu.close();
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    expect(onDismiss).not.toHaveBeenCalled();
  });
});
