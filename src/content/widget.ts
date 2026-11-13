import { CONFIG, NOTE_COLORS, COLOR_KEYS } from '../core/config';
import { STRINGS } from '../core/strings';
import {
  loadState,
  saveState,
  subscribeState,
  generateNoteId,
  generateParagraphId,
} from '../core/store';
import type { Note, NoteParagraph, StoredState, WidgetSettings } from '../core/types';
import { STYLES } from './styles';
import { debounce, autoGrowTextarea } from './events';
import { WidgetLayout } from './layout';
import { loadSettings, saveSettings, subscribeSettings, normalizeOrigin } from '../core/settings';

export class StickyDotWidget {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private state: StoredState = {
    schemaVersion: 1,
    notes: [],
    ui: { expanded: false, position: null, size: null },
  };
  private settings: WidgetSettings = { allowedOrigins: [], allSites: false };
  private settingsOpen = false;
  private layout: WidgetLayout | null = null;
  private pendingExternalState: StoredState | null = null;
  private focusedNoteId: string | null = null;
  private focusedParagraphId: string | null = null;
  private deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeStorage: (() => void) | null = null;
  private unsubscribeSettings: (() => void) | null = null;
  private lastSavedJson = '';
  private isRendering = false;
  private mountInProgress = false;

  private readonly flushOnExit = (): void => {
    this.flushPendingSave();
  };

  private readonly flushWhenHidden = (): void => {
    if (document.visibilityState === 'hidden') {
      this.flushPendingSave();
    }
  };

  private debouncedSave = debounce(() => {
    this.persistState();
  }, CONFIG.DEBOUNCE_MS);

  public async mount(): Promise<void> {
    if (this.mountInProgress) return;
    if (document.getElementById(CONFIG.HOST_ELEMENT_ID)) return;

    this.mountInProgress = true;
    try {
      await this.mountInternal();
    } finally {
      this.mountInProgress = false;
    }
  }

  private async mountInternal(): Promise<void> {
    this.host = document.createElement('div');
    this.host.id = CONFIG.HOST_ELEMENT_ID;
    this.host.style.cssText = `all: initial; position: fixed !important; top: ${CONFIG.TOP_OFFSET_PX}px !important; right: ${CONFIG.RIGHT_OFFSET_PX}px !important; z-index: ${CONFIG.Z_INDEX} !important; display: block !important;`;

    this.layout = new WidgetLayout(this.host, {
      onGeometryChange: (position, size) => {
        this.state.ui.position = position;
        this.state.ui.size = size;
        this.debouncedSave();
      },
      onInteractionEnd: () => {
        if (this.pendingExternalState) {
          const pending = this.pendingExternalState;
          this.pendingExternalState = null;
          // Geometri lokal yang baru saja diubah menang atas update yang datang saat drag.
          pending.ui.position = this.state.ui.position;
          pending.ui.size = this.state.ui.size;
          this.handleExternalState(pending);
        }
      },
    });

    this.shadow = this.host.attachShadow({ mode: 'open' });

    // Apply styles
    if ('adoptedStyleSheets' in this.shadow && typeof CSSStyleSheet !== 'undefined') {
      const sheet = new CSSStyleSheet();
      sheet.replaceSync(STYLES);
      this.shadow.adoptedStyleSheets = [sheet];
    } else {
      const styleEl = document.createElement('style');
      styleEl.textContent = STYLES;
      this.shadow.appendChild(styleEl);
    }

    // Load initial state & site settings
    const [state, settings] = await Promise.all([loadState(), loadSettings()]);
    if (!this.host || !this.shadow) return;

    this.state = state;
    this.settings = settings;
    this.lastSavedJson = JSON.stringify(this.state);
    this.layout?.applyLayout(this.state.ui.position, this.state.ui.size);

    // Subscribe to external storage updates (other tabs)
    this.unsubscribeStorage = subscribeState((externalState) => {
      this.handleExternalState(externalState);
    });

    this.unsubscribeSettings = subscribeSettings((nextSettings) => {
      this.settings = nextSettings;
      if (this.settingsOpen) {
        this.render();
      }
    });

    // Flush perubahan yang masih tertahan debounce sebelum tab/browser ditutup.
    window.addEventListener('pagehide', this.flushOnExit);
    window.addEventListener('beforeunload', this.flushOnExit);
    window.addEventListener('blur', this.flushOnExit);
    document.addEventListener('visibilitychange', this.flushWhenHidden);

    const targetParent = document.body || document.documentElement;
    targetParent.appendChild(this.host);
    this.render();
  }

  public unmount(): void {
    window.removeEventListener('pagehide', this.flushOnExit);
    window.removeEventListener('beforeunload', this.flushOnExit);
    window.removeEventListener('blur', this.flushOnExit);
    document.removeEventListener('visibilitychange', this.flushWhenHidden);

    if (this.unsubscribeStorage) {
      this.unsubscribeStorage();
      this.unsubscribeStorage = null;
    }
    if (this.unsubscribeSettings) {
      this.unsubscribeSettings();
      this.unsubscribeSettings = null;
    }
    this.settingsOpen = false;
    this.focusedNoteId = null;
    this.focusedParagraphId = null;

    for (const timer of this.deleteTimers.values()) {
      clearTimeout(timer);
    }
    this.deleteTimers.clear();

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
      this.toastTimer = null;
    }

    this.layout?.destroy();
    this.layout = null;
    this.pendingExternalState = null;
    this.debouncedSave.cancel();
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
  }

  private async persistState(): Promise<void> {
    const json = JSON.stringify(this.state);
    this.lastSavedJson = json;
    const success = await saveState(this.state);
    if (!success) {
      this.showToast(STRINGS.SAVE_ERROR);
    }
  }

  /**
   * Menyimpan segera perubahan yang masih menunggu debounce.
   * Dipanggil saat tab disembunyikan / browser ditutup agar catatan terakhir tidak hilang.
   */
  private flushPendingSave(): void {
    if (!this.debouncedSave.isPending()) return;
    this.debouncedSave.cancel();
    void this.persistState();
  }

  private handleExternalState(externalState: StoredState): void {
    // Jangan re-render di tengah drag/resize: simpan dulu, terapkan setelah selesai.
    if (this.layout?.isInteracting()) {
      this.pendingExternalState = externalState;
      return;
    }

    const incomingJson = JSON.stringify(externalState);
    // Ignore storage events triggered by our own local save
    if (incomingJson === this.lastSavedJson || incomingJson === JSON.stringify(this.state)) {
      return;
    }

    this.lastSavedJson = incomingJson;

    // Track cursor and selection if user is currently editing a note
    let cursorStart: number | null = null;
    let cursorEnd: number | null = null;
    const focusedId = this.focusedNoteId;
    const focusedParagraphId = this.focusedParagraphId;

    if (focusedId && this.shadow) {
      const activeTextarea = this.findParagraphTextarea(focusedId, focusedParagraphId);
      if (activeTextarea) {
        cursorStart = activeTextarea.selectionStart;
        cursorEnd = activeTextarea.selectionEnd;
      }

      const localEditingNote = this.state.notes.find((n) => n.id === focusedId);
      if (localEditingNote) {
        const extIndex = externalState.notes.findIndex((n) => n.id === focusedId);
        if (extIndex !== -1) {
          externalState.notes[extIndex] = { ...localEditingNote };
        }
      }
    }

    this.state = externalState;
    this.render();

    // Restore focus and cursor position after re-rendering external updates
    if (focusedId && cursorStart !== null && this.shadow) {
      requestAnimationFrame(() => {
        if (!this.shadow) return;
        const restoredTextarea = this.findParagraphTextarea(focusedId, focusedParagraphId);
        if (restoredTextarea) {
          restoredTextarea.focus();
          if (cursorStart !== null && cursorEnd !== null) {
            restoredTextarea.setSelectionRange(cursorStart, cursorEnd);
          }
        }
      });
    }
  }

  private render(): void {
    if (!this.shadow) return;

    this.isRendering = true;
    try {
      // Retain style element if adoptedStyleSheets not supported
      const styleEl = this.shadow.querySelector('style');
      this.shadow.innerHTML = '';
      if (styleEl) {
        this.shadow.appendChild(styleEl);
      }

      const container = document.createElement('div');
      container.className = 'sd-container';

      // Handle Esc key to go back from settings / collapse
      container.addEventListener('keydown', (e: KeyboardEvent) => {
        if (e.key !== 'Escape') return;

        if (this.settingsOpen) {
          e.stopPropagation();
          this.settingsOpen = false;
          this.render();
          return;
        }

        if (this.state.ui.expanded) {
          e.stopPropagation();
          this.toggleExpanded(false);
        }
      });

      if (this.state.ui.expanded) {
        const panel = this.createPanelElement();
        container.appendChild(panel);
        this.layout?.setPanel(panel);
      } else {
        this.layout?.setPanel(null);
        container.appendChild(this.createChipElement());
      }

      this.shadow.appendChild(container);
      this.layout?.applyLayout(this.state.ui.position, this.state.ui.size);
      this.layout?.constrainLayout();
    } finally {
      this.isRendering = false;
    }
  }

  private createChipElement(): HTMLElement {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'sd-chip';
    chip.setAttribute('aria-label', STRINGS.EXPAND);
    chip.setAttribute('title', STRINGS.EXPAND);

    // Sticky Note SVG Icon
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z');
    const polyline = document.createElementNS('http://www.w3.org/2000/svg', 'polyline');
    polyline.setAttribute('points', '14 2 14 8 20 8');
    const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    line.setAttribute('x1', '16');
    line.setAttribute('y1', '13');
    line.setAttribute('x2', '8');
    line.setAttribute('y2', '13');

    svg.appendChild(path);
    svg.appendChild(polyline);
    svg.appendChild(line);
    chip.appendChild(svg);

    // Badge for note count > 0
    if (this.state.notes.length > 0) {
      const badge = document.createElement('span');
      badge.className = 'sd-badge';
      badge.textContent = String(this.state.notes.length);
      chip.appendChild(badge);
    }

    chip.addEventListener('click', () => {
      if (this.layout?.consumeClickSuppression()) return;
      this.toggleExpanded(true);
    });

    this.layout?.makeDraggable(chip);

    return chip;
  }

  private createPanelElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sd-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', this.settingsOpen ? STRINGS.SETTINGS_TITLE : STRINGS.NOTE_REGION_LABEL);

    // Header
    const header = document.createElement('div');
    header.className = 'sd-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'sd-header-left';

    const dot = document.createElement('span');
    dot.className = 'sd-header-dot';

    const title = document.createElement('span');
    title.className = 'sd-header-title';
    title.textContent = this.settingsOpen
      ? STRINGS.SETTINGS_TITLE
      : `${STRINGS.NOTE_COUNT_PREFIX} (${this.state.notes.length})`;

    headerLeft.appendChild(dot);
    headerLeft.appendChild(title);

    const headerActions = document.createElement('div');
    headerActions.className = 'sd-header-actions';

    // Add button [+]
    const addBtn = document.createElement('button');
    addBtn.type = 'button';
    addBtn.className = 'sd-icon-btn';
    addBtn.setAttribute('aria-label', STRINGS.ADD_NOTE);
    addBtn.setAttribute('title', this.state.notes.length >= CONFIG.MAX_NOTES ? STRINGS.MAX_NOTES_REACHED : STRINGS.ADD_NOTE);
    addBtn.disabled = this.state.notes.length >= CONFIG.MAX_NOTES;

    const addSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    addSvg.setAttribute('viewBox', '0 0 24 24');
    addSvg.setAttribute('fill', 'none');
    addSvg.setAttribute('stroke', 'currentColor');
    addSvg.setAttribute('stroke-width', '2');
    addSvg.setAttribute('stroke-linecap', 'round');
    addSvg.setAttribute('stroke-linejoin', 'round');
    const plusLine1 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    plusLine1.setAttribute('x1', '12'); plusLine1.setAttribute('y1', '5');
    plusLine1.setAttribute('x2', '12'); plusLine1.setAttribute('y2', '19');
    const plusLine2 = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    plusLine2.setAttribute('x1', '5'); plusLine2.setAttribute('y1', '12');
    plusLine2.setAttribute('x2', '19'); plusLine2.setAttribute('y2', '12');
    addSvg.appendChild(plusLine1);
    addSvg.appendChild(plusLine2);
    addBtn.appendChild(addSvg);

    addBtn.addEventListener('click', () => {
      this.handleAddNote();
    });

    // Settings button (globe icon)
    const settingsBtn = document.createElement('button');
    settingsBtn.type = 'button';
    settingsBtn.className = 'sd-icon-btn sd-settings-btn';
    settingsBtn.setAttribute('aria-label', STRINGS.SETTINGS_TITLE);
    settingsBtn.setAttribute('title', STRINGS.SETTINGS_TITLE);
    settingsBtn.appendChild(this.createSvgIcon([
      'M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18z',
      'M3.2 9h17.6',
      'M3.2 15h17.6',
      'M12 3c2.5 2.7 2.5 15.3 0 18',
      'M12 3c-2.5 2.7-2.5 15.3 0 18',
    ]));
    settingsBtn.addEventListener('click', () => {
      this.settingsOpen = true;
      this.render();
    });

    // Back button (settings -> notes)
    const backBtn = document.createElement('button');
    backBtn.type = 'button';
    backBtn.className = 'sd-icon-btn sd-back-btn';
    backBtn.setAttribute('aria-label', STRINGS.BACK_TO_NOTES);
    backBtn.setAttribute('title', STRINGS.BACK_TO_NOTES);
    backBtn.appendChild(this.createSvgIcon(['M15 18l-6-6 6-6']));
    backBtn.addEventListener('click', () => {
      this.settingsOpen = false;
      this.render();
    });

    // Collapse button [–]
    const collapseBtn = document.createElement('button');
    collapseBtn.type = 'button';
    collapseBtn.className = 'sd-icon-btn';
    collapseBtn.setAttribute('aria-label', STRINGS.COLLAPSE);
    collapseBtn.setAttribute('title', STRINGS.COLLAPSE);

    const collapseSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    collapseSvg.setAttribute('viewBox', '0 0 24 24');
    collapseSvg.setAttribute('fill', 'none');
    collapseSvg.setAttribute('stroke', 'currentColor');
    collapseSvg.setAttribute('stroke-width', '2');
    collapseSvg.setAttribute('stroke-linecap', 'round');
    collapseSvg.setAttribute('stroke-linejoin', 'round');
    const minusLine = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    minusLine.setAttribute('x1', '5'); minusLine.setAttribute('y1', '12');
    minusLine.setAttribute('x2', '19'); minusLine.setAttribute('y2', '12');
    collapseSvg.appendChild(minusLine);
    collapseBtn.appendChild(collapseSvg);

    collapseBtn.addEventListener('click', () => {
      this.toggleExpanded(false);
    });

    if (this.settingsOpen) {
      headerActions.appendChild(backBtn);
    } else {
      headerActions.appendChild(addBtn);
      headerActions.appendChild(settingsBtn);
    }
    headerActions.appendChild(collapseBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerActions);
    header.setAttribute('title', STRINGS.DRAG_PANEL);
    panel.appendChild(header);
    this.layout?.makeDraggable(header);

    if (this.settingsOpen) {
      panel.appendChild(this.createSettingsElement());
    } else {
      // Notes list / Empty state
      const list = document.createElement('div');
      list.className = 'sd-notes-list';

      if (this.state.notes.length === 0) {
        list.appendChild(this.createEmptyStateElement());
      } else {
        for (const note of this.state.notes) {
          list.appendChild(this.createNoteCard(note));
        }
      }

      panel.appendChild(list);
    }

    // Resize grip (pojok kanan bawah)
    const grip = document.createElement('div');
    grip.className = 'sd-resize-grip';
    grip.setAttribute('role', 'separator');
    grip.setAttribute('aria-label', STRINGS.RESIZE_PANEL);
    grip.setAttribute('title', STRINGS.RESIZE_PANEL);
    grip.tabIndex = 0;

    grip.addEventListener('keydown', (event: KeyboardEvent) => {
      const step = event.shiftKey ? 40 : 16;
      let deltaWidth = 0;
      let deltaHeight = 0;

      switch (event.key) {
        case 'ArrowRight': deltaWidth = step; break;
        case 'ArrowLeft': deltaWidth = -step; break;
        case 'ArrowDown': deltaHeight = step; break;
        case 'ArrowUp': deltaHeight = -step; break;
        default: return;
      }

      event.preventDefault();
      event.stopPropagation();
      this.layout?.nudgeSize(deltaWidth, deltaHeight);
    });

    panel.appendChild(grip);
    this.layout?.makeResizable(grip, panel);

    // Toast element container
    const toast = document.createElement('div');
    toast.className = 'sd-toast';
    toast.id = 'sd-toast';
    panel.appendChild(toast);

    return panel;
  }

  private createSvgIcon(paths: string[]): SVGSVGElement {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '2');
    svg.setAttribute('stroke-linecap', 'round');
    svg.setAttribute('stroke-linejoin', 'round');

    for (const d of paths) {
      const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
    }

    return svg;
  }

  private createSettingsElement(): HTMLElement {
    const wrapper = document.createElement('div');
    wrapper.className = 'sd-settings';

    const desc = document.createElement('p');
    desc.className = 'sd-settings-desc';
    desc.textContent = STRINGS.SETTINGS_DESC;
    wrapper.appendChild(desc);

    const addRow = document.createElement('div');
    addRow.className = 'sd-site-add-row';

    const input = document.createElement('input');
    input.type = 'text';
    input.className = 'sd-site-input';
    input.placeholder = STRINGS.SITE_INPUT_PLACEHOLDER;
    input.setAttribute('aria-label', STRINGS.SITE_INPUT_LABEL);
    input.setAttribute('spellcheck', 'false');

    const addSiteBtn = document.createElement('button');
    addSiteBtn.type = 'button';
    addSiteBtn.className = 'sd-site-add-btn';
    addSiteBtn.textContent = STRINGS.ADD_SITE;

    const submit = () => {
      if (this.handleAddSite(input.value)) {
        input.value = '';
      }
    };

    addSiteBtn.addEventListener('click', submit);
    input.addEventListener('keydown', (event: KeyboardEvent) => {
      if (event.key === 'Enter') {
        event.preventDefault();
        submit();
      }
    });

    addRow.appendChild(input);
    addRow.appendChild(addSiteBtn);
    wrapper.appendChild(addRow);

    // Toggle semua website
    const allLabel = document.createElement('label');
    allLabel.className = 'sd-all-sites';

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sd-all-sites-checkbox';
    checkbox.checked = this.settings.allSites;
    checkbox.addEventListener('change', () => {
      this.handleToggleAllSites(checkbox.checked);
    });

    const allText = document.createElement('span');
    allText.textContent = STRINGS.ALL_SITES;

    allLabel.appendChild(checkbox);
    allLabel.appendChild(allText);
    wrapper.appendChild(allLabel);

    const allHint = document.createElement('p');
    allHint.className = 'sd-settings-hint';
    allHint.textContent = STRINGS.ALL_SITES_HINT;
    wrapper.appendChild(allHint);

    const listTitle = document.createElement('div');
    listTitle.className = 'sd-settings-section-title';
    listTitle.textContent = STRINGS.ACTIVE_SITES;
    wrapper.appendChild(listTitle);

    const siteList = document.createElement('div');
    siteList.className = 'sd-site-list';
    siteList.appendChild(this.createSiteItem(CONFIG.TARGET_ORIGIN, true));
    for (const origin of this.settings.allowedOrigins) {
      siteList.appendChild(this.createSiteItem(origin, false));
    }
    wrapper.appendChild(siteList);

    const syncHint = document.createElement('p');
    syncHint.className = 'sd-settings-hint';
    syncHint.textContent = STRINGS.SETTINGS_SYNC_HINT;
    wrapper.appendChild(syncHint);

    return wrapper;
  }

  private createSiteItem(origin: string, primary: boolean): HTMLElement {
    const item = document.createElement('div');
    item.className = 'sd-site-item';

    const name = document.createElement('span');
    name.className = 'sd-site-name';
    name.textContent = origin;
    name.title = origin;
    item.appendChild(name);

    if (primary) {
      const badge = document.createElement('span');
      badge.className = 'sd-site-badge';
      badge.textContent = STRINGS.PRIMARY_SITE;
      item.appendChild(badge);
    } else {
      const removeBtn = document.createElement('button');
      removeBtn.type = 'button';
      removeBtn.className = 'sd-site-remove';
      removeBtn.textContent = '×';
      removeBtn.setAttribute('aria-label', `${STRINGS.REMOVE_SITE}: ${origin}`);
      removeBtn.setAttribute('title', STRINGS.REMOVE_SITE);
      removeBtn.addEventListener('click', () => {
        this.handleRemoveSite(origin);
      });
      item.appendChild(removeBtn);
    }

    return item;
  }

  private handleAddSite(rawValue: string): boolean {
    const origin = normalizeOrigin(rawValue);

    if (!origin) {
      this.showToast(STRINGS.INVALID_SITE);
      return false;
    }

    if (origin === CONFIG.TARGET_ORIGIN || this.settings.allowedOrigins.includes(origin)) {
      this.showToast(STRINGS.SITE_ALREADY_ACTIVE);
      return false;
    }

    if (this.settings.allowedOrigins.length >= CONFIG.MAX_ALLOWED_SITES) {
      this.showToast(STRINGS.MAX_SITES_REACHED);
      return false;
    }

    this.settings = {
      ...this.settings,
      allowedOrigins: [...this.settings.allowedOrigins, origin],
    };

    void saveSettings(this.settings).then((success) => {
      if (!success) this.showToast(STRINGS.SAVE_ERROR);
    });

    this.render();
    this.showToast(`${STRINGS.SITE_ADDED_PREFIX} ${origin}`);
    return true;
  }

  private handleRemoveSite(origin: string): void {
    this.settings = {
      ...this.settings,
      allowedOrigins: this.settings.allowedOrigins.filter((item) => item !== origin),
    };

    void saveSettings(this.settings).then((success) => {
      if (!success) this.showToast(STRINGS.SAVE_ERROR);
    });

    this.render();
  }

  private handleToggleAllSites(enabled: boolean): void {
    this.settings = { ...this.settings, allSites: enabled };

    void saveSettings(this.settings).then((success) => {
      if (!success) this.showToast(STRINGS.SAVE_ERROR);
    });
  }

  private createEmptyStateElement(): HTMLElement {
    const empty = document.createElement('div');
    empty.className = 'sd-empty-state';

    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    svg.setAttribute('viewBox', '0 0 24 24');
    svg.setAttribute('fill', 'none');
    svg.setAttribute('stroke', 'currentColor');
    svg.setAttribute('stroke-width', '1.5');
    svg.setAttribute('class', 'sd-empty-icon');

    const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path.setAttribute('d', 'M19 3H5a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V5a2 2 0 0 0-2-2z');
    const path2 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path2.setAttribute('d', 'M12 8v8');
    const path3 = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    path3.setAttribute('d', 'M8 12h8');
    svg.appendChild(path);
    svg.appendChild(path2);
    svg.appendChild(path3);

    const text = document.createElement('p');
    text.className = 'sd-empty-text';
    text.textContent = STRINGS.EMPTY_STATE;

    empty.appendChild(svg);
    empty.appendChild(text);
    return empty;
  }

  private createNoteCard(note: Note): HTMLElement {
    const card = document.createElement('div');
    card.className = 'sd-note-card';
    card.setAttribute('data-id', note.id);

    const theme = NOTE_COLORS[note.color] || NOTE_COLORS.yellow;
    card.style.backgroundColor = theme.background;
    card.style.borderColor = theme.border;
    card.style.color = theme.text;

    // Paragraf dengan checkbox (checklist per paragraf)
    const paragraphsEl = document.createElement('div');
    paragraphsEl.className = 'sd-paragraphs';
    for (let index = 0; index < note.paragraphs.length; index++) {
      paragraphsEl.appendChild(
        this.createParagraphRow(card, note, note.paragraphs[index], index)
      );
    }
    card.appendChild(paragraphsEl);

    // Footer: Colors + Counter/Delete
    const footer = document.createElement('div');
    footer.className = 'sd-note-footer';

    // Color buttons
    const colorsDiv = document.createElement('div');
    colorsDiv.className = 'sd-colors';
    colorsDiv.setAttribute('role', 'radiogroup');
    colorsDiv.setAttribute('aria-label', STRINGS.COLOR_PICKER_LABEL);

    for (const colorKey of COLOR_KEYS) {
      const cTheme = NOTE_COLORS[colorKey];
      const dot = document.createElement('button');
      dot.type = 'button';
      dot.className = `sd-color-dot ${note.color === colorKey ? 'active' : ''}`;
      dot.style.backgroundColor = cTheme.background;
      dot.style.borderColor = cTheme.border;
      dot.setAttribute('role', 'radio');
      dot.setAttribute('aria-checked', note.color === colorKey ? 'true' : 'false');
      dot.setAttribute('aria-label', cTheme.label);
      dot.setAttribute('title', cTheme.label);

      dot.addEventListener('click', () => {
        if (note.color !== colorKey) {
          note.color = colorKey;
          note.updatedAt = Date.now();
          this.persistState();
          // Update visual directly
          card.style.backgroundColor = cTheme.background;
          card.style.borderColor = cTheme.border;
          colorsDiv.querySelectorAll('.sd-color-dot').forEach((d) => d.classList.remove('active'));
          dot.classList.add('active');
        }
      });

      colorsDiv.appendChild(dot);
    }

    footer.appendChild(colorsDiv);

    // Right footer (counter + delete)
    const rightFooter = document.createElement('div');
    rightFooter.className = 'sd-footer-right';

    // Character counter (shown if > 90% limit, i.e. > 4500)
    const counter = document.createElement('span');
    counter.className = 'sd-char-counter';
    this.renderCounterContent(counter, note.text.length);
    rightFooter.appendChild(counter);

    // Delete button with 2-step confirmation
    const deleteBtn = document.createElement('button');
    deleteBtn.type = 'button';
    deleteBtn.className = 'sd-btn-delete';
    deleteBtn.textContent = STRINGS.DELETE;
    deleteBtn.setAttribute('aria-label', `${STRINGS.DELETE} catatan`);

    deleteBtn.addEventListener('click', () => {
      this.handleDeleteClick(note.id, deleteBtn);
    });

    rightFooter.appendChild(deleteBtn);
    footer.appendChild(rightFooter);
    card.appendChild(footer);

    return card;
  }

  private createParagraphRow(
    card: HTMLElement,
    note: Note,
    paragraph: NoteParagraph,
    index: number
  ): HTMLElement {
    const row = document.createElement('div');
    row.className = `sd-paragraph${paragraph.checked ? ' is-checked' : ''}`;
    row.setAttribute('data-paragraph-id', paragraph.id);

    const checkbox = document.createElement('input');
    checkbox.type = 'checkbox';
    checkbox.className = 'sd-paragraph-check';
    checkbox.checked = paragraph.checked;
    checkbox.setAttribute(
      'aria-label',
      `${STRINGS.PARAGRAPH_CHECK}: ${paragraph.text.trim() || STRINGS.PARAGRAPH_EMPTY}`
    );

    checkbox.addEventListener('change', () => {
      paragraph.checked = checkbox.checked;
      row.classList.toggle('is-checked', checkbox.checked);
      note.updatedAt = Date.now();
      // Status checklist langsung disimpan agar tidak hilang saat tab ditutup.
      this.persistState();
    });

    const textarea = document.createElement('textarea');
    textarea.className = 'sd-textarea sd-paragraph-input';
    textarea.value = paragraph.text;
    textarea.rows = 1;
    textarea.setAttribute('data-paragraph-id', paragraph.id);
    textarea.setAttribute('aria-label', STRINGS.PARAGRAPH_LABEL);
    textarea.setAttribute('title', STRINGS.PARAGRAPH_HINT);
    if (index === 0) {
      textarea.placeholder = STRINGS.TEXTAREA_PLACEHOLDER;
    }

    requestAnimationFrame(() => {
      autoGrowTextarea(textarea);
    });

    textarea.addEventListener('focus', () => {
      this.focusedNoteId = note.id;
      this.focusedParagraphId = paragraph.id;
    });

    textarea.addEventListener('blur', () => {
      if (this.isRendering) return;
      if (this.focusedNoteId === note.id) {
        this.focusedNoteId = null;
      }
      if (this.focusedParagraphId === paragraph.id) {
        this.focusedParagraphId = null;
      }
      this.debouncedSave.cancel();
      this.persistState();
    });

    textarea.addEventListener('input', () => {
      this.handleParagraphInput(card, note, paragraph, textarea);
    });

    textarea.addEventListener('keydown', (event: KeyboardEvent) => {
      this.handleParagraphKeydown(event, note, paragraph, index, textarea);
    });

    row.appendChild(checkbox);
    row.appendChild(textarea);
    return row;
  }

  private handleParagraphInput(
    card: HTMLElement,
    note: Note,
    paragraph: NoteParagraph,
    textarea: HTMLTextAreaElement
  ): void {
    // Hitung sisa kuota berdasarkan total teks saat ini (termasuk newline).
    const otherLength = Math.max(0, note.text.length - paragraph.text.length);
    const allowed = Math.max(0, CONFIG.MAX_CHARS_PER_NOTE - otherLength);
    let text = textarea.value;

    if (text.length > allowed) {
      text = text.slice(0, allowed);
      textarea.value = text;
      this.showToast(STRINGS.MAX_CHARS_REACHED);
    }

    paragraph.text = text;
    this.syncNoteText(note);
    note.updatedAt = Date.now();
    autoGrowTextarea(textarea);
    this.updateCharCounter(card, note.text.length);
    this.debouncedSave();
  }

  private handleParagraphKeydown(
    event: KeyboardEvent,
    note: Note,
    paragraph: NoteParagraph,
    index: number,
    textarea: HTMLTextAreaElement
  ): void {
    // Enter membuat paragraf baru; Shift+Enter tetap newline dalam paragraf yang sama.
    if (event.key === 'Enter' && !event.shiftKey) {
      if (note.text.length >= CONFIG.MAX_CHARS_PER_NOTE) {
        event.preventDefault();
        this.showToast(STRINGS.MAX_CHARS_REACHED);
        return;
      }

      event.preventDefault();
      const start = textarea.selectionStart;
      const end = textarea.selectionEnd;
      const before = paragraph.text.slice(0, start);
      const after = paragraph.text.slice(end);

      paragraph.text = before;
      const nextParagraph: NoteParagraph = {
        id: generateParagraphId(),
        text: after,
        checked: false,
      };

      note.paragraphs.splice(index + 1, 0, nextParagraph);
      this.syncNoteText(note);
      note.updatedAt = Date.now();
      this.persistState();

      this.focusedNoteId = note.id;
      this.focusedParagraphId = nextParagraph.id;
      this.render();
      this.focusParagraph(note.id, nextParagraph.id, 0);
      return;
    }

    // Backspace di awal paragraf: hapus paragraf kosong atau gabung dengan paragraf sebelumnya.
    if (event.key === 'Backspace' && textarea.selectionStart === 0 && textarea.selectionEnd === 0) {
      if (index === 0) return;

      event.preventDefault();
      const previous = note.paragraphs[index - 1];
      let caret: number;

      if (paragraph.text.length === 0) {
        note.paragraphs.splice(index, 1);
        caret = previous.text.length;
      } else {
        caret = previous.text.length;
        previous.text += paragraph.text;
        note.paragraphs.splice(index, 1);
      }

      this.syncNoteText(note);
      note.updatedAt = Date.now();
      this.persistState();

      this.focusedNoteId = note.id;
      this.focusedParagraphId = previous.id;
      this.render();
      this.focusParagraph(note.id, previous.id, caret);
    }
  }

  private syncNoteText(note: Note): void {
    note.text = note.paragraphs.map((paragraph) => paragraph.text).join('\n');
  }

  private focusParagraph(noteId: string, paragraphId: string, caret: number | 'end'): void {
    requestAnimationFrame(() => {
      const textarea = this.findParagraphTextarea(noteId, paragraphId);
      if (!textarea) return;

      textarea.focus();
      const position = caret === 'end' ? textarea.value.length : caret;
      textarea.setSelectionRange(position, position);
      autoGrowTextarea(textarea);
    });
  }

  private findParagraphTextarea(noteId: string, paragraphId: string | null): HTMLTextAreaElement | null {
    if (!this.shadow) return null;

    const cards = this.shadow.querySelectorAll<HTMLElement>('.sd-note-card');
    for (const card of cards) {
      if (card.getAttribute('data-id') !== noteId) continue;

      const textareas = card.querySelectorAll<HTMLTextAreaElement>('.sd-textarea');
      if (!paragraphId) return textareas[0] ?? null;

      for (const textarea of textareas) {
        if (textarea.getAttribute('data-paragraph-id') === paragraphId) {
          return textarea;
        }
      }
      return textareas[0] ?? null;
    }

    return null;
  }

  private updateCharCounter(card: HTMLElement, length: number): void {
    const counter = card.querySelector<HTMLSpanElement>('.sd-char-counter');
    if (counter) {
      this.renderCounterContent(counter, length);
    }
  }

  private renderCounterContent(counter: HTMLSpanElement, length: number): void {
    const threshold = Math.floor(CONFIG.MAX_CHARS_PER_NOTE * 0.9);
    if (length >= threshold) {
      counter.textContent = `${length}/${CONFIG.MAX_CHARS_PER_NOTE}`;
      if (length >= CONFIG.MAX_CHARS_PER_NOTE) {
        counter.classList.add('warning');
      } else {
        counter.classList.remove('warning');
      }
      counter.style.display = 'inline';
    } else {
      counter.style.display = 'none';
    }
  }

  private handleDeleteClick(noteId: string, button: HTMLButtonElement): void {
    if (this.deleteTimers.has(noteId)) {
      // Second click within 3 seconds -> confirm delete
      const timer = this.deleteTimers.get(noteId);
      if (timer) clearTimeout(timer);
      this.deleteTimers.delete(noteId);

      this.state.notes = this.state.notes.filter((n) => n.id !== noteId);
      this.persistState();
      this.render();
    } else {
      // First click -> ask confirmation
      button.textContent = STRINGS.CONFIRM_DELETE;
      button.classList.add('confirm');

      const timer = setTimeout(() => {
        this.deleteTimers.delete(noteId);
        if (button.isConnected) {
          button.textContent = STRINGS.DELETE;
          button.classList.remove('confirm');
        }
      }, CONFIG.DELETE_CONFIRM_MS);

      this.deleteTimers.set(noteId, timer);
    }
  }

  private handleAddNote(): void {
    if (this.state.notes.length >= CONFIG.MAX_NOTES) {
      this.showToast(STRINGS.MAX_NOTES_REACHED);
      return;
    }

    const now = Date.now();
    const newNote: Note = {
      id: generateNoteId(),
      text: '',
      paragraphs: [
        {
          id: generateParagraphId(),
          text: '',
          checked: false,
        },
      ],
      color: 'yellow',
      createdAt: now,
      updatedAt: now,
    };

    this.state.notes.unshift(newNote);
    this.persistState();
    this.render();

    // Focus newly created note's textarea
    requestAnimationFrame(() => {
      if (!this.shadow) return;
      const firstTextarea = this.shadow.querySelector<HTMLTextAreaElement>('.sd-note-card .sd-textarea');
      if (firstTextarea) {
        firstTextarea.focus();
      }
    });
  }

  private toggleExpanded(expanded: boolean): void {
    this.state.ui.expanded = expanded;
    this.persistState();
    this.render();
  }

  private showToast(message: string): void {
    if (!this.shadow) return;
    const toast = this.shadow.getElementById('sd-toast');
    if (!toast) return;

    toast.textContent = message;
    toast.classList.add('show');

    if (this.toastTimer) {
      clearTimeout(this.toastTimer);
    }

    this.toastTimer = setTimeout(() => {
      toast.classList.remove('show');
      this.toastTimer = null;
    }, 2500);
  }
}
