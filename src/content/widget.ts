import { CONFIG, NOTE_COLORS, COLOR_KEYS } from '../core/config';
import { STRINGS } from '../core/strings';
import {
  loadState,
  saveState,
  subscribeState,
  generateNoteId,
} from '../core/store';
import type { Note, StoredState } from '../core/types';
import { STYLES } from './styles';
import { debounce, autoGrowTextarea } from './events';

export class StickyDotWidget {
  private host: HTMLElement | null = null;
  private shadow: ShadowRoot | null = null;
  private state: StoredState = {
    schemaVersion: 1,
    notes: [],
    ui: { expanded: false },
  };
  private focusedNoteId: string | null = null;
  private deleteTimers = new Map<string, ReturnType<typeof setTimeout>>();
  private toastTimer: ReturnType<typeof setTimeout> | null = null;
  private unsubscribeStorage: (() => void) | null = null;

  private debouncedSave = debounce(() => {
    this.persistState();
  }, CONFIG.DEBOUNCE_MS);

  public async mount(): Promise<void> {
    const existing = document.getElementById(CONFIG.HOST_ELEMENT_ID);
    if (existing) {
      return;
    }

    this.host = document.createElement('div');
    this.host.id = CONFIG.HOST_ELEMENT_ID;
    this.host.style.cssText = `position: fixed; top: ${CONFIG.TOP_OFFSET_PX}px; right: ${CONFIG.RIGHT_OFFSET_PX}px; z-index: ${CONFIG.Z_INDEX}; all: initial;`;

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

    // Load initial state
    this.state = await loadState();

    // Subscribe to external storage updates (other tabs)
    this.unsubscribeStorage = subscribeState((externalState) => {
      this.handleExternalState(externalState);
    });

    document.documentElement.appendChild(this.host);
    this.render();
  }

  public unmount(): void {
    if (this.unsubscribeStorage) {
      this.unsubscribeStorage();
      this.unsubscribeStorage = null;
    }
    if (this.host && this.host.parentNode) {
      this.host.parentNode.removeChild(this.host);
    }
    this.host = null;
    this.shadow = null;
  }

  private async persistState(): Promise<void> {
    const success = await saveState(this.state);
    if (!success) {
      this.showToast(STRINGS.SAVE_ERROR);
    }
  }

  private handleExternalState(externalState: StoredState): void {
    // If currently editing a note, preserve local text for that note
    if (this.focusedNoteId) {
      const localEditingNote = this.state.notes.find((n) => n.id === this.focusedNoteId);
      if (localEditingNote) {
        const extIndex = externalState.notes.findIndex((n) => n.id === this.focusedNoteId);
        if (extIndex !== -1) {
          externalState.notes[extIndex] = { ...localEditingNote };
        }
      }
    }

    this.state = externalState;
    this.render();
  }

  private render(): void {
    if (!this.shadow) return;

    // Retain style element if adoptedStyleSheets not supported
    const styleEl = this.shadow.querySelector('style');
    this.shadow.innerHTML = '';
    if (styleEl) {
      this.shadow.appendChild(styleEl);
    }

    const container = document.createElement('div');
    container.className = 'sd-container';

    // Handle Esc key to collapse
    container.addEventListener('keydown', (e: KeyboardEvent) => {
      if (e.key === 'Escape' && this.state.ui.expanded) {
        e.stopPropagation();
        this.toggleExpanded(false);
      }
    });

    if (this.state.ui.expanded) {
      container.appendChild(this.createPanelElement());
    } else {
      container.appendChild(this.createChipElement());
    }

    this.shadow.appendChild(container);
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
      this.toggleExpanded(true);
    });

    return chip;
  }

  private createPanelElement(): HTMLElement {
    const panel = document.createElement('div');
    panel.className = 'sd-panel';
    panel.setAttribute('role', 'region');
    panel.setAttribute('aria-label', STRINGS.NOTE_REGION_LABEL);

    // Header
    const header = document.createElement('div');
    header.className = 'sd-header';

    const headerLeft = document.createElement('div');
    headerLeft.className = 'sd-header-left';

    const dot = document.createElement('span');
    dot.className = 'sd-header-dot';

    const title = document.createElement('span');
    title.className = 'sd-header-title';
    title.textContent = `${STRINGS.NOTE_COUNT_PREFIX} (${this.state.notes.length})`;

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

    headerActions.appendChild(addBtn);
    headerActions.appendChild(collapseBtn);

    header.appendChild(headerLeft);
    header.appendChild(headerActions);
    panel.appendChild(header);

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

    // Toast element container
    const toast = document.createElement('div');
    toast.className = 'sd-toast';
    toast.id = 'sd-toast';
    panel.appendChild(toast);

    return panel;
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

    // Textarea (Safe from XSS via .value)
    const textarea = document.createElement('textarea');
    textarea.className = 'sd-textarea';
    textarea.placeholder = STRINGS.TEXTAREA_PLACEHOLDER;
    textarea.value = note.text;
    textarea.setAttribute('aria-label', `Isi catatan ${note.id}`);

    // Auto-grow height
    requestAnimationFrame(() => {
      autoGrowTextarea(textarea);
    });

    textarea.addEventListener('focus', () => {
      this.focusedNoteId = note.id;
    });

    textarea.addEventListener('blur', () => {
      if (this.focusedNoteId === note.id) {
        this.focusedNoteId = null;
      }
      this.debouncedSave.cancel();
      this.persistState();
    });

    textarea.addEventListener('input', () => {
      autoGrowTextarea(textarea);
      let text = textarea.value;

      if (text.length > CONFIG.MAX_CHARS_PER_NOTE) {
        text = text.slice(0, CONFIG.MAX_CHARS_PER_NOTE);
        textarea.value = text;
        this.showToast(STRINGS.MAX_CHARS_REACHED);
      }

      note.text = text;
      note.updatedAt = Date.now();
      this.updateCharCounter(card, text.length);
      this.debouncedSave();
    });

    card.appendChild(textarea);

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
