import { CONFIG, COLOR_KEYS } from './config';
import type { Note, NoteColor, NoteParagraph, StoredState, StorageListener, WidgetPosition, WidgetSize } from './types';

export const DEFAULT_STATE: StoredState = {
  schemaVersion: 1,
  notes: [],
  ui: {
    expanded: false,
    position: null,
    size: null,
  },
};

const POSITION_LIMIT = 100000;

function clampNumber(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/**
 * Validates a persisted widget position. Returns null when unset/invalid.
 */
export function sanitizePosition(raw: unknown): WidgetPosition | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.x !== 'number' || !Number.isFinite(obj.x) ||
    typeof obj.y !== 'number' || !Number.isFinite(obj.y)
  ) {
    return null;
  }

  return {
    x: Math.round(clampNumber(obj.x, 0, POSITION_LIMIT)),
    y: Math.round(clampNumber(obj.y, 0, POSITION_LIMIT)),
  };
}

/**
 * Validates a persisted panel size. Returns null when unset/invalid.
 */
export function sanitizeSize(raw: unknown): WidgetSize | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;
  if (
    typeof obj.width !== 'number' || !Number.isFinite(obj.width) ||
    typeof obj.height !== 'number' || !Number.isFinite(obj.height)
  ) {
    return null;
  }

  return {
    width: Math.round(clampNumber(obj.width, CONFIG.PANEL_MIN_WIDTH, CONFIG.PANEL_MAX_WIDTH)),
    height: Math.round(clampNumber(obj.height, CONFIG.PANEL_MIN_HEIGHT, CONFIG.PANEL_MAX_HEIGHT)),
  };
}

/**
 * Validates and normalizes raw color input
 */
export function sanitizeColor(color: unknown): NoteColor {
  if (typeof color === 'string' && (COLOR_KEYS as readonly string[]).includes(color)) {
    return color as NoteColor;
  }
  return 'yellow';
}

/**
 * Memecah teks lama (sebelum fitur checklist) menjadi paragraf.
 * ID deterministik agar dua tab yang memuat data lama tidak menghasilkan ID berbeda.
 */
function paragraphsFromText(noteId: string, text: string): NoteParagraph[] {
  const lines = text.split('\n');
  let remaining = CONFIG.MAX_CHARS_PER_NOTE;
  const paragraphs: NoteParagraph[] = [];

  for (let index = 0; index < lines.length; index++) {
    const separator = index > 0 ? 1 : 0;
    if (index > 0 && remaining <= separator) break;

    const allowed = Math.max(0, remaining - separator);
    const clipped = lines[index].slice(0, allowed);

    paragraphs.push({
      id: `${noteId}__p${index}`,
      text: clipped,
      checked: false,
    });

    remaining -= separator + clipped.length;
    if (remaining <= 0) break;
  }

  return paragraphs.length > 0 ? paragraphs : [{ id: `${noteId}__p0`, text: '', checked: false }];
}

/**
 * Validasi paragraf dari storage; kompatibel dengan catatan lama yang hanya punya `text`.
 * Total teks (termasuk newline) dibatasi MAX_CHARS_PER_NOTE.
 */
function sanitizeParagraphs(raw: unknown, noteId: string, fallbackText: string): NoteParagraph[] {
  const paragraphs: NoteParagraph[] = [];
  const usedIds = new Set<string>();
  let remaining = CONFIG.MAX_CHARS_PER_NOTE;

  if (Array.isArray(raw)) {
    for (const item of raw) {
      if (!item || typeof item !== 'object') continue;

      const obj = item as Record<string, unknown>;
      const separator = paragraphs.length > 0 ? 1 : 0;
      if (paragraphs.length > 0 && remaining <= separator) break;

      const allowed = Math.max(0, remaining - separator);
      const text = (typeof obj.text === 'string' ? obj.text : '').slice(0, allowed);
      let id = typeof obj.id === 'string' && obj.id.trim() !== ''
        ? obj.id
        : `${noteId}__p${paragraphs.length}`;

      if (usedIds.has(id)) {
        id = generateParagraphId();
      }
      usedIds.add(id);

      paragraphs.push({
        id,
        text,
        checked: obj.checked === true,
      });

      remaining -= separator + text.length;
      if (remaining <= 0) break;
    }
  }

  if (paragraphs.length === 0) {
    return paragraphsFromText(noteId, fallbackText.slice(0, CONFIG.MAX_CHARS_PER_NOTE));
  }

  return paragraphs;
}

/**
 * Validates and sanitizes a single note
 */
export function sanitizeNote(raw: unknown): Note | null {
  if (!raw || typeof raw !== 'object') {
    return null;
  }

  const obj = raw as Record<string, unknown>;

  if (typeof obj.id !== 'string' || obj.id.trim() === '') {
    return null;
  }

  const rawText = typeof obj.text === 'string' ? obj.text : '';
  const paragraphs = sanitizeParagraphs(obj.paragraphs, obj.id, rawText);
  const text = paragraphs.map((paragraph) => paragraph.text).join('\n');
  const color = sanitizeColor(obj.color);
  const now = Date.now();
  const createdAt = typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : now;
  const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : now;

  return {
    id: obj.id,
    text,
    paragraphs,
    color,
    createdAt,
    updatedAt,
  };
}

/**
 * Migration framework for future storage schema upgrades
 */
export function migrate(raw: unknown): StoredState {
  if (!raw || typeof raw !== 'object') {
    return { ...DEFAULT_STATE, notes: [], ui: { ...DEFAULT_STATE.ui } };
  }

  const obj = raw as Record<string, unknown>;
  const version = obj.schemaVersion;

  if (version === 1) {
    const rawNotes = Array.isArray(obj.notes) ? obj.notes : [];
    const sanitizedNotes: Note[] = [];

    for (const item of rawNotes) {
      const sanitized = sanitizeNote(item);
      if (sanitized) {
        sanitizedNotes.push(sanitized);
        if (sanitizedNotes.length >= CONFIG.MAX_NOTES) {
          break;
        }
      }
    }

    const ui = obj.ui && typeof obj.ui === 'object'
      ? (obj.ui as Record<string, unknown>)
      : {};

    const expanded = typeof ui.expanded === 'boolean' ? ui.expanded : false;

    return {
      schemaVersion: 1,
      notes: sanitizedNotes,
      ui: {
        expanded,
        position: sanitizePosition(ui.position),
        size: sanitizeSize(ui.size),
      },
    };
  }

  // Unknown schema version: fallback to default without overwriting
  return { ...DEFAULT_STATE, notes: [], ui: { ...DEFAULT_STATE.ui } };
}

/**
 * Loads stored state from chrome.storage.local
 */
export async function loadState(): Promise<StoredState> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return { ...DEFAULT_STATE, notes: [], ui: { ...DEFAULT_STATE.ui } };
  }

  try {
    const result = await chrome.storage.local.get(CONFIG.STORAGE_KEY);
    const raw = result[CONFIG.STORAGE_KEY];

    if (!raw) {
      return { ...DEFAULT_STATE, notes: [], ui: { ...DEFAULT_STATE.ui } };
    }

    return migrate(raw);
  } catch (error) {
    console.error('[StickyDot] Error loading state:', error);
    return { ...DEFAULT_STATE, notes: [], ui: { ...DEFAULT_STATE.ui } };
  }
}

/**
 * Saves state to chrome.storage.local
 */
export async function saveState(state: StoredState): Promise<boolean> {
  if (typeof chrome === 'undefined' || !chrome.storage?.local) {
    return false;
  }

  // Ensure state conforms to limits before saving
  const sanitizedState = migrate(state);

  try {
    await chrome.storage.local.set({ [CONFIG.STORAGE_KEY]: sanitizedState });
    return true;
  } catch (error) {
    console.error('[StickyDot] Error saving state:', error);
    return false;
  }
}

/**
 * Subscribes to storage changes (e.g. from other tabs)
 */
export function subscribeState(listener: StorageListener): () => void {
  if (typeof chrome === 'undefined' || !chrome.storage?.onChanged) {
    return () => {};
  }

  const handler = (
    changes: { [key: string]: chrome.storage.StorageChange },
    areaName: string
  ) => {
    if (areaName === 'local' && changes[CONFIG.STORAGE_KEY]) {
      const change = changes[CONFIG.STORAGE_KEY];
      if (change.newValue) {
        const sanitized = migrate(change.newValue);
        listener(sanitized);
      }
    }
  };

  chrome.storage.onChanged.addListener(handler);

  return () => {
    chrome.storage.onChanged.removeListener(handler);
  };
}

/**
 * Helper to generate a unique ID
 */
function generateId(prefix: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `${prefix}_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export function generateNoteId(): string {
  return generateId('note');
}

export function generateParagraphId(): string {
  return generateId('para');
}

