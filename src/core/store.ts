import { CONFIG, COLOR_KEYS } from './config';
import type { Note, NoteColor, StoredState, StorageListener } from './types';

export const DEFAULT_STATE: StoredState = {
  schemaVersion: 1,
  notes: [],
  ui: {
    expanded: false,
  },
};

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

  const text = typeof obj.text === 'string' ? obj.text.slice(0, CONFIG.MAX_CHARS_PER_NOTE) : '';
  const color = sanitizeColor(obj.color);
  const now = Date.now();
  const createdAt = typeof obj.createdAt === 'number' && Number.isFinite(obj.createdAt) ? obj.createdAt : now;
  const updatedAt = typeof obj.updatedAt === 'number' && Number.isFinite(obj.updatedAt) ? obj.updatedAt : now;

  return {
    id: obj.id,
    text,
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

    const expanded = obj.ui && typeof obj.ui === 'object' && typeof (obj.ui as Record<string, unknown>).expanded === 'boolean'
      ? Boolean((obj.ui as Record<string, unknown>).expanded)
      : false;

    return {
      schemaVersion: 1,
      notes: sanitizedNotes,
      ui: { expanded },
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
 * Helper to generate a unique note ID
 */
export function generateNoteId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID();
  }
  return `note_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}
