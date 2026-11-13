import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StickyDotWidget } from '../src/content/widget';
import { CONFIG } from '../src/core/config';
import { STRINGS } from '../src/core/strings';
import type { StoredState } from '../src/core/types';

function createRect(left: number, top: number, width: number, height: number): DOMRect {
  return {
    left,
    top,
    width,
    height,
    right: left + width,
    bottom: top + height,
    x: left,
    y: top,
    toJSON: () => ({}),
  } as DOMRect;
}

describe('StickyDotWidget Integration', () => {
  let mockStorage: Record<string, unknown> = {};

  beforeEach(() => {
    mockStorage = {};
    // Setup global chrome mock
    globalThis.chrome = {
      storage: {
        local: {
          get: vi.fn().mockImplementation((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
          set: vi.fn().mockImplementation((items: Record<string, unknown>) => {
            Object.assign(mockStorage, items);
            return Promise.resolve();
          }),
        } as unknown as chrome.storage.LocalStorageArea,
        onChanged: {
          addListener: vi.fn(),
          removeListener: vi.fn(),
        } as unknown as chrome.events.Event<(changes: { [key: string]: chrome.storage.StorageChange }, areaName: string) => void>,
      } as unknown as typeof chrome.storage,
    } as unknown as typeof chrome;

    // Reset DOM
    document.documentElement.innerHTML = '<head></head><body></body>';
  });

  afterEach(() => {
    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    if (host) {
      host.remove();
    }
    vi.restoreAllMocks();
  });

  it('flushes pending note text when the page is closed or hidden', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-header-actions .sd-icon-btn')?.click();

    const textarea = host?.shadowRoot?.querySelector<HTMLTextAreaElement>('.sd-textarea');
    expect(textarea).not.toBeNull();

    if (textarea) {
      textarea.value = 'Catatan terakhir sebelum browser ditutup';
      textarea.dispatchEvent(new Event('input'));
    }

    // Debounce 400 ms belum berjalan: teks masih kosong di storage.
    const beforeFlush = mockStorage[CONFIG.STORAGE_KEY] as StoredState;
    expect(beforeFlush.notes[0].text).toBe('');

    // Simulasi browser/tab ditutup.
    window.dispatchEvent(new Event('pagehide'));

    // Flush harus menulis perubahan segera, tanpa menunggu debounce.
    const afterFlush = mockStorage[CONFIG.STORAGE_KEY] as StoredState;
    expect(afterFlush.notes[0].text).toBe('Catatan terakhir sebelum browser ditutup');

    widget.unmount();
  });

  it('mounts host element and shadow root on document.body or document.documentElement', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    expect(host).not.toBeNull();
    expect(host?.parentNode).toBe(document.documentElement);
    expect(host?.shadowRoot).not.toBeNull();
  });

  it('renders chip in folded state by default', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    const chip = host?.shadowRoot?.querySelector('.sd-chip');
    expect(chip).not.toBeNull();
    expect(chip?.getAttribute('aria-label')).toBe(STRINGS.EXPAND);

    // Panel should not be in DOM yet
    const panel = host?.shadowRoot?.querySelector('.sd-panel');
    expect(panel).toBeNull();
  });

  it('expands panel when chip is clicked', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    const chip = host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip');
    expect(chip).not.toBeNull();

    chip?.click();

    // Now panel should be visible
    const panel = host?.shadowRoot?.querySelector('.sd-panel');
    expect(panel).not.toBeNull();
    expect(panel?.getAttribute('role')).toBe('region');
    expect(panel?.getAttribute('aria-label')).toBe(STRINGS.NOTE_REGION_LABEL);

    // Empty state text should be visible since there are no notes
    const emptyText = panel?.querySelector('.sd-empty-text');
    expect(emptyText?.textContent).toBe(STRINGS.EMPTY_STATE);
  });

  it('adds a new note and persists it to storage', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    const chip = host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip');
    chip?.click();

    // Find add button
    const addBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-header-actions .sd-icon-btn');
    expect(addBtn).not.toBeNull();

    addBtn?.click();

    // Should now have 1 note card
    const cards = host?.shadowRoot?.querySelectorAll('.sd-note-card');
    expect(cards?.length).toBe(1);

    const textarea = cards?.[0]?.querySelector<HTMLTextAreaElement>('.sd-textarea');
    expect(textarea).not.toBeNull();
    expect(textarea?.value).toBe('');

    // Verify saved to chrome.storage.local
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });

  it('updates note text and clamps at 5000 chars', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-header-actions .sd-icon-btn')?.click();

    const textarea = host?.shadowRoot?.querySelector<HTMLTextAreaElement>('.sd-textarea');
    expect(textarea).not.toBeNull();

    if (textarea) {
      const longText = 'x'.repeat(5200);
      textarea.value = longText;
      textarea.dispatchEvent(new Event('input'));

      // Value should be clamped to 5000
      expect(textarea.value.length).toBe(CONFIG.MAX_CHARS_PER_NOTE);
    }
  });

  describe('paragraph checklist', () => {
    async function mountNoteWithText(text: string) {
      const widget = new StickyDotWidget();
      await widget.mount();

      const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();
      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-header-actions .sd-icon-btn')?.click();

      const textarea = host.shadowRoot?.querySelector<HTMLTextAreaElement>('.sd-textarea');
      if (textarea) {
        textarea.value = text;
        textarea.dispatchEvent(new Event('input'));
      }

      return { widget, host, textarea };
    }

    function flushAsync(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }

    it('renders one checkbox per paragraph and persists checked state', async () => {
      const { widget, host, textarea } = await mountNoteWithText('Selesaikan laporan');

      expect(host.shadowRoot?.querySelectorAll('.sd-paragraph')).toHaveLength(1);
      expect(host.shadowRoot?.querySelectorAll('.sd-paragraph-check')).toHaveLength(1);

      const checkbox = host.shadowRoot?.querySelector<HTMLInputElement>('.sd-paragraph-check');
      expect(checkbox?.checked).toBe(false);

      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
      }
      await flushAsync();

      const row = host.shadowRoot?.querySelector('.sd-paragraph');
      expect(row?.classList.contains('is-checked')).toBe(true);

      const stored = mockStorage[CONFIG.STORAGE_KEY] as StoredState;
      expect(stored.notes[0].text).toBe('Selesaikan laporan');
      expect(stored.notes[0].paragraphs[0].checked).toBe(true);
      expect(textarea?.value).toBe('Selesaikan laporan');

      widget.unmount();
    });

    it('creates a new paragraph when Enter is pressed at the cursor', async () => {
      const { widget, host, textarea } = await mountNoteWithText('PertamaKedua');

      if (textarea) {
        textarea.setSelectionRange(7, 7);
        textarea.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
      }
      await flushAsync();

      const inputs = host.shadowRoot?.querySelectorAll<HTMLTextAreaElement>('.sd-paragraph-input');
      expect(inputs).toHaveLength(2);
      expect(inputs?.[0].value).toBe('Pertama');
      expect(inputs?.[1].value).toBe('Kedua');

      const stored = mockStorage[CONFIG.STORAGE_KEY] as StoredState;
      expect(stored.notes[0].text).toBe('Pertama\nKedua');
      expect(stored.notes[0].paragraphs).toHaveLength(2);

      widget.unmount();
    });

    it('removes an empty paragraph when Backspace is pressed at its start', async () => {
      const { widget, host, textarea } = await mountNoteWithText('Pertama');

      if (textarea) {
        textarea.setSelectionRange(7, 7);
        textarea.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Enter', bubbles: true, cancelable: true })
        );
      }

      const secondInput = host.shadowRoot?.querySelectorAll<HTMLTextAreaElement>('.sd-paragraph-input')[1];
      expect(secondInput).not.toBeUndefined();

      if (secondInput) {
        secondInput.setSelectionRange(0, 0);
        secondInput.dispatchEvent(
          new KeyboardEvent('keydown', { key: 'Backspace', bubbles: true, cancelable: true })
        );
      }
      await flushAsync();

      expect(host.shadowRoot?.querySelectorAll('.sd-paragraph')).toHaveLength(1);

      const stored = mockStorage[CONFIG.STORAGE_KEY] as StoredState;
      expect(stored.notes[0].text).toBe('Pertama');

      widget.unmount();
    });

    it('loads legacy notes without paragraphs as a checklist', async () => {
      mockStorage[CONFIG.STORAGE_KEY] = {
        schemaVersion: 1,
        notes: [
          {
            id: 'legacy-note',
            text: 'Baris pertama\nBaris kedua',
            color: 'blue',
            createdAt: 1000,
            updatedAt: 1000,
          },
        ],
        ui: { expanded: false, position: null, size: null },
      };

      const widget = new StickyDotWidget();
      await widget.mount();

      const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();

      const inputs = host.shadowRoot?.querySelectorAll<HTMLTextAreaElement>('.sd-paragraph-input');
      expect(inputs).toHaveLength(2);
      expect(inputs?.[0].value).toBe('Baris pertama');
      expect(inputs?.[1].value).toBe('Baris kedua');
      expect(host.shadowRoot?.querySelectorAll('.sd-paragraph-check')).toHaveLength(2);

      widget.unmount();
    });
  });

  it('requires two clicks within 3 seconds to delete a note', async () => {
    vi.useFakeTimers();

    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-header-actions .sd-icon-btn')?.click();

    let cards = host?.shadowRoot?.querySelectorAll('.sd-note-card');
    expect(cards?.length).toBe(1);

    const deleteBtn = host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-btn-delete');
    expect(deleteBtn).not.toBeNull();
    expect(deleteBtn?.textContent).toBe(STRINGS.DELETE);

    // 1st click: changes to confirmation
    deleteBtn?.click();
    expect(deleteBtn?.textContent).toBe(STRINGS.CONFIRM_DELETE);
    expect(deleteBtn?.classList.contains('confirm')).toBe(true);

    // After 3000ms without 2nd click, reverts
    vi.advanceTimersByTime(3100);
    expect(deleteBtn?.textContent).toBe(STRINGS.DELETE);
    expect(deleteBtn?.classList.contains('confirm')).toBe(false);

    // 1st click again
    deleteBtn?.click();
    expect(deleteBtn?.textContent).toBe(STRINGS.CONFIRM_DELETE);

    // 2nd click immediately: deletes the note
    deleteBtn?.click();

    cards = host?.shadowRoot?.querySelectorAll('.sd-note-card');
    expect(cards?.length).toBe(0);

    vi.useRealTimers();
  });

  it('does not destroy or freeze textarea when typing and debounced save triggers', async () => {
    vi.useFakeTimers();

    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-header-actions .sd-icon-btn')?.click();

    const textareaBefore = host?.shadowRoot?.querySelector<HTMLTextAreaElement>('.sd-textarea');
    expect(textareaBefore).not.toBeNull();

    if (textareaBefore) {
      textareaBefore.focus();
      textareaBefore.value = 'Mengetik sesuatu...';
      textareaBefore.dispatchEvent(new Event('input'));

      // Advance timer to trigger 400ms debounced save
      vi.advanceTimersByTime(CONFIG.DEBOUNCE_MS + 50);

      // Verify the textarea element reference in the DOM is still identical (not recreated by innerHTML='')
      const textareaAfter = host?.shadowRoot?.querySelector<HTMLTextAreaElement>('.sd-textarea');
      expect(textareaAfter).toBe(textareaBefore);
      expect(textareaAfter?.value).toBe('Mengetik sesuatu...');
    }

    vi.useRealTimers();
  });

  it('closes panel when Escape is pressed', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    host?.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();

    expect(host?.shadowRoot?.querySelector('.sd-panel')).not.toBeNull();

    const container = host?.shadowRoot?.querySelector('.sd-container');
    container?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

    // Now it should be back to folded chip state
    expect(host?.shadowRoot?.querySelector('.sd-panel')).toBeNull();
    expect(host?.shadowRoot?.querySelector('.sd-chip')).not.toBeNull();
  });

  it('drags the folded chip, persists the position, and suppresses the follow-up click', async () => {
    vi.useFakeTimers();

    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
    const chip = host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip') as HTMLButtonElement;
    host.getBoundingClientRect = () => createRect(976, 12, 36, 36);

    chip.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 990,
      clientY: 24,
      button: 0,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 890, clientY: 124 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 890, clientY: 124 }));

    expect(host.style.left).toBe('876px');
    expect(host.style.top).toBe('112px');
    expect(host.style.right).toBe('auto');

    // Follow-up click is swallowed so a drag does not open the panel
    chip.dispatchEvent(new MouseEvent('click', { bubbles: true }));
    expect(host.shadowRoot?.querySelector('.sd-panel')).toBeNull();

    vi.advanceTimersByTime(CONFIG.DEBOUNCE_MS + 50);

    const stored = mockStorage[CONFIG.STORAGE_KEY] as StoredState;
    expect(stored.ui.position).toEqual({ x: 876, y: 112 });

    vi.advanceTimersByTime(1);
    vi.useRealTimers();
  });

  it('drags the panel by its header but ignores pointerdown on header buttons', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
    host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();

    const panel = host.shadowRoot?.querySelector('.sd-panel') as HTMLElement;
    const header = panel.querySelector('.sd-header') as HTMLElement;
    const addBtn = header.querySelector('.sd-icon-btn') as HTMLElement;

    host.getBoundingClientRect = () => createRect(700, 12, 280, 400);

    addBtn.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 900,
      clientY: 30,
      button: 0,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 950, clientY: 80 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 950, clientY: 80 }));

    // Header button did not start a drag
    expect(host.style.left).toBe('');

    header.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 710,
      clientY: 24,
      button: 0,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 610, clientY: 124 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 610, clientY: 124 }));

    expect(host.style.left).toBe('600px');
    expect(host.style.top).toBe('112px');
  });

  it('resizes the panel with the grip and persists the size', async () => {
    vi.useFakeTimers();

    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
    host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();

    const panel = host.shadowRoot?.querySelector('.sd-panel') as HTMLElement;
    const grip = panel.querySelector('.sd-resize-grip') as HTMLElement;

    host.getBoundingClientRect = () => createRect(100, 12, 280, 400);
    panel.getBoundingClientRect = () => createRect(100, 12, 280, 400);

    grip.dispatchEvent(new PointerEvent('pointerdown', {
      bubbles: true,
      clientX: 370,
      clientY: 405,
      button: 0,
    }));
    window.dispatchEvent(new PointerEvent('pointermove', { clientX: 470, clientY: 505 }));
    window.dispatchEvent(new PointerEvent('pointerup', { clientX: 470, clientY: 505 }));

    expect(panel.style.width).toBe('380px');
    expect(panel.style.height).toBe('500px');
    expect(panel.classList.contains('is-sized')).toBe(true);

    vi.advanceTimersByTime(CONFIG.DEBOUNCE_MS + 50);

    const stored = mockStorage[CONFIG.STORAGE_KEY] as StoredState;
    expect(stored.ui.size).toEqual({ width: 380, height: 500 });

    vi.advanceTimersByTime(1);
    vi.useRealTimers();
  });

  it('resizes the panel with the keyboard grip', async () => {
    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
    host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();

    const panel = host.shadowRoot?.querySelector('.sd-panel') as HTMLElement;
    const grip = panel.querySelector('.sd-resize-grip') as HTMLElement;
    panel.getBoundingClientRect = () => createRect(100, 12, 280, 400);

    grip.dispatchEvent(new KeyboardEvent('keydown', {
      key: 'ArrowRight',
      bubbles: true,
    }));

    expect(panel.style.width).toBe('296px');
    expect(panel.style.height).toBe('400px');
    expect(panel.classList.contains('is-sized')).toBe(true);
  });

  it('restores saved position and panel size on mount', async () => {
    mockStorage[CONFIG.STORAGE_KEY] = {
      schemaVersion: 1,
      notes: [],
      ui: {
        expanded: false,
        position: { x: 120, y: 80 },
        positionOrigin: 'http://localhost:3000',
        size: { width: 360, height: 420 },
      },
    } satisfies StoredState;

    const widget = new StickyDotWidget();
    await widget.mount();

    const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
    expect(host.style.left).toBe('120px');
    expect(host.style.top).toBe('80px');
    expect(host.style.right).toBe('auto');

    host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();

    const panel = host.shadowRoot?.querySelector('.sd-panel') as HTMLElement;
    expect(panel.style.width).toBe('360px');
    expect(panel.style.height).toBe('420px');
    expect(panel.classList.contains('is-sized')).toBe(true);
  });

  describe('site settings view', () => {
    async function openSettings() {
      const widget = new StickyDotWidget();
      await widget.mount();

      const host = document.getElementById(CONFIG.HOST_ELEMENT_ID) as HTMLElement;
      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-chip')?.click();
      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-settings-btn')?.click();

      return { widget, host };
    }

    function flushAsync(): Promise<void> {
      return new Promise((resolve) => setTimeout(resolve, 0));
    }

    it('opens the settings view and returns to the notes list', async () => {
      const { widget, host } = await openSettings();

      const panel = host.shadowRoot?.querySelector('.sd-panel');
      expect(panel?.getAttribute('aria-label')).toBe(STRINGS.SETTINGS_TITLE);
      expect(host.shadowRoot?.querySelector('.sd-header-title')?.textContent).toBe(STRINGS.SETTINGS_TITLE);

      const settingsView = host.shadowRoot?.querySelector('.sd-settings');
      expect(settingsView).not.toBeNull();
      expect(host.shadowRoot?.querySelector('.sd-notes-list')).toBeNull();

      // Situs utama selalu tampil sebagai badge dan tidak bisa dihapus.
      expect(host.shadowRoot?.querySelectorAll('.sd-site-item')).toHaveLength(1);
      expect(host.shadowRoot?.querySelector('.sd-site-name')?.textContent).toBe(CONFIG.TARGET_ORIGIN);
      expect(host.shadowRoot?.querySelector('.sd-site-badge')?.textContent).toBe(STRINGS.PRIMARY_SITE);
      expect(host.shadowRoot?.querySelectorAll('.sd-site-remove')).toHaveLength(0);

      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-back-btn')?.click();

      expect(host.shadowRoot?.querySelector('.sd-settings')).toBeNull();
      expect(host.shadowRoot?.querySelector('.sd-notes-list')).not.toBeNull();
      expect(host.shadowRoot?.querySelector('.sd-header-title')?.textContent).toBe(
        `${STRINGS.NOTE_COUNT_PREFIX} (0)`
      );

      widget.unmount();
    });

    it('adds a website, normalizes it, and persists the allowlist', async () => {
      const { widget, host } = await openSettings();

      const input = host.shadowRoot?.querySelector<HTMLInputElement>('.sd-site-input');
      expect(input).not.toBeNull();
      if (input) input.value = 'example.com/path';

      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-site-add-btn')?.click();
      await flushAsync();

      expect(mockStorage[CONFIG.SETTINGS_KEY]).toEqual({
        allowedOrigins: ['https://example.com'],
        allSites: false,
      });

      const items = host.shadowRoot?.querySelectorAll('.sd-site-item');
      expect(items).toHaveLength(2);
      expect(items?.[1].querySelector('.sd-site-name')?.textContent).toBe('https://example.com');

      widget.unmount();
    });

    it('rejects invalid addresses without writing settings', async () => {
      const { widget, host } = await openSettings();

      const input = host.shadowRoot?.querySelector<HTMLInputElement>('.sd-site-input');
      if (input) input.value = 'not a url';

      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-site-add-btn')?.click();
      await flushAsync();

      expect(mockStorage[CONFIG.SETTINGS_KEY]).toBeUndefined();
      expect(host.shadowRoot?.querySelectorAll('.sd-site-item')).toHaveLength(1);

      const toast = host.shadowRoot?.querySelector('.sd-toast');
      expect(toast?.textContent).toBe(STRINGS.INVALID_SITE);
      expect(toast?.classList.contains('show')).toBe(true);

      widget.unmount();
    });

    it('removes an added website and persists the change', async () => {
      mockStorage[CONFIG.SETTINGS_KEY] = {
        allowedOrigins: ['https://example.com'],
        allSites: false,
      };

      const { widget, host } = await openSettings();
      expect(host.shadowRoot?.querySelectorAll('.sd-site-item')).toHaveLength(2);

      host.shadowRoot?.querySelector<HTMLButtonElement>('.sd-site-remove')?.click();
      await flushAsync();

      expect(mockStorage[CONFIG.SETTINGS_KEY]).toEqual({
        allowedOrigins: [],
        allSites: false,
      });
      expect(host.shadowRoot?.querySelectorAll('.sd-site-item')).toHaveLength(1);

      widget.unmount();
    });

    it('persists the all-sites toggle', async () => {
      const { widget, host } = await openSettings();

      const checkbox = host.shadowRoot?.querySelector<HTMLInputElement>('.sd-all-sites-checkbox');
      expect(checkbox?.checked).toBe(false);

      if (checkbox) {
        checkbox.checked = true;
        checkbox.dispatchEvent(new Event('change'));
      }
      await flushAsync();

      expect(mockStorage[CONFIG.SETTINGS_KEY]).toEqual({
        allowedOrigins: [],
        allSites: true,
      });

      widget.unmount();
    });

    it('goes back to notes on Escape before collapsing the panel', async () => {
      const { widget, host } = await openSettings();

      const container = host.shadowRoot?.querySelector('.sd-container');
      container?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));

      expect(host.shadowRoot?.querySelector('.sd-settings')).toBeNull();
      expect(host.shadowRoot?.querySelector('.sd-notes-list')).not.toBeNull();

      host.shadowRoot
        ?.querySelector('.sd-container')
        ?.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
      expect(host.shadowRoot?.querySelector('.sd-panel')).toBeNull();
      expect(host.shadowRoot?.querySelector('.sd-chip')).not.toBeNull();

      widget.unmount();
    });
  });
});

