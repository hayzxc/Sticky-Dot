import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StickyDotWidget } from '../src/content/widget';
import { CONFIG } from '../src/core/config';
import { STRINGS } from '../src/core/strings';

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

  it('mounts host element and shadow root on document.documentElement', async () => {
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
});
