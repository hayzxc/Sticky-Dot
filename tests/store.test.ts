import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  DEFAULT_STATE,
  sanitizeColor,
  sanitizeNote,
  migrate,
  loadState,
  saveState,
  generateNoteId,
} from '../src/core/store';
import { CONFIG } from '../src/core/config';
import type { Note } from '../src/core/types';

describe('Store & Data Model', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  describe('sanitizeColor', () => {
    it('allows valid colors', () => {
      expect(sanitizeColor('yellow')).toBe('yellow');
      expect(sanitizeColor('pink')).toBe('pink');
      expect(sanitizeColor('blue')).toBe('blue');
      expect(sanitizeColor('green')).toBe('green');
      expect(sanitizeColor('orange')).toBe('orange');
    });

    it('defaults invalid or unknown color to yellow', () => {
      expect(sanitizeColor('purple')).toBe('yellow');
      expect(sanitizeColor('')).toBe('yellow');
      expect(sanitizeColor(null)).toBe('yellow');
      expect(sanitizeColor(123)).toBe('yellow');
      expect(sanitizeColor(undefined)).toBe('yellow');
    });
  });

  describe('sanitizeNote', () => {
    it('returns valid note object', () => {
      const note = sanitizeNote({
        id: 'note-1',
        text: 'Halo barantin',
        color: 'pink',
        createdAt: 1000,
        updatedAt: 2000,
      });

      expect(note).toEqual({
        id: 'note-1',
        text: 'Halo barantin',
        color: 'pink',
        createdAt: 1000,
        updatedAt: 2000,
      });
    });

    it('clamps text exceeding MAX_CHARS_PER_NOTE', () => {
      const longText = 'a'.repeat(CONFIG.MAX_CHARS_PER_NOTE + 500);
      const note = sanitizeNote({
        id: 'note-1',
        text: longText,
        color: 'yellow',
      });

      expect(note).not.toBeNull();
      expect(note?.text.length).toBe(CONFIG.MAX_CHARS_PER_NOTE);
    });

    it('discards note with empty or non-string id', () => {
      expect(sanitizeNote(null)).toBeNull();
      expect(sanitizeNote({})).toBeNull();
      expect(sanitizeNote({ id: '', text: 'test' })).toBeNull();
      expect(sanitizeNote({ id: '   ', text: 'test' })).toBeNull();
      expect(sanitizeNote({ id: 123, text: 'test' })).toBeNull();
    });

    it('replaces invalid color with yellow', () => {
      const note = sanitizeNote({
        id: 'note-1',
        text: 'hello',
        color: 'cyan',
      });

      expect(note?.color).toBe('yellow');
    });
  });

  describe('migrate', () => {
    it('returns default state for non-object or invalid input', () => {
      expect(migrate(null)).toEqual(DEFAULT_STATE);
      expect(migrate(undefined)).toEqual(DEFAULT_STATE);
      expect(migrate('invalid string')).toEqual(DEFAULT_STATE);
      expect(migrate(123)).toEqual(DEFAULT_STATE);
    });

    it('returns default state for unknown schemaVersion', () => {
      const result = migrate({ schemaVersion: 99, notes: [] });
      expect(result).toEqual(DEFAULT_STATE);
    });

    it('limits notes to MAX_NOTES (50)', () => {
      const manyNotes = Array.from({ length: 60 }, (_, i) => ({
        id: `note-${i}`,
        text: `Catatan ${i}`,
        color: 'yellow',
      }));

      const result = migrate({
        schemaVersion: 1,
        notes: manyNotes,
        ui: { expanded: true },
      });

      expect(result.notes.length).toBe(CONFIG.MAX_NOTES);
      expect(result.ui.expanded).toBe(true);
    });

    it('filters out corrupt notes from the array', () => {
      const mixed = [
        { id: 'valid-1', text: 'ok', color: 'blue' },
        { corrupt: true },
        null,
        'string-note',
        { id: 'valid-2', text: 'ok 2', color: 'green' },
      ];

      const result = migrate({
        schemaVersion: 1,
        notes: mixed,
        ui: { expanded: false },
      });

      expect(result.notes.length).toBe(2);
      expect(result.notes[0].id).toBe('valid-1');
      expect(result.notes[1].id).toBe('valid-2');
    });
  });

  describe('generateNoteId', () => {
    it('generates non-empty string ids', () => {
      const id1 = generateNoteId();
      const id2 = generateNoteId();
      expect(typeof id1).toBe('string');
      expect(id1.length).toBeGreaterThan(5);
      expect(id1).not.toBe(id2);
    });
  });

  describe('loadState & saveState with mock chrome.storage.local', () => {
    it('returns default state when storage is empty', async () => {
      // Setup global chrome mock
      const mockStorage: Record<string, unknown> = {};
      globalThis.chrome = {
        storage: {
          local: {
            get: vi.fn().mockImplementation((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
            set: vi.fn().mockImplementation((items: Record<string, unknown>) => {
              Object.assign(mockStorage, items);
              return Promise.resolve();
            }),
          } as unknown as chrome.storage.LocalStorageArea,
        } as unknown as typeof chrome.storage,
      } as unknown as typeof chrome;

      const loaded = await loadState();
      expect(loaded).toEqual(DEFAULT_STATE);
    });

    it('returns default state and preserves storage if data is corrupt', async () => {
      const mockStorage: Record<string, unknown> = {
        [CONFIG.STORAGE_KEY]: 'corrupt data string',
      };
      globalThis.chrome = {
        storage: {
          local: {
            get: vi.fn().mockImplementation((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
            set: vi.fn().mockImplementation((items: Record<string, unknown>) => {
              Object.assign(mockStorage, items);
              return Promise.resolve();
            }),
          } as unknown as chrome.storage.LocalStorageArea,
        } as unknown as typeof chrome.storage,
      } as unknown as typeof chrome;

      const loaded = await loadState();
      expect(loaded).toEqual(DEFAULT_STATE);
      // Ensure storage was not overwritten
      expect(mockStorage[CONFIG.STORAGE_KEY]).toBe('corrupt data string');
    });

    it('saves and reloads state properly', async () => {
      const mockStorage: Record<string, unknown> = {};
      globalThis.chrome = {
        storage: {
          local: {
            get: vi.fn().mockImplementation((key: string) => Promise.resolve({ [key]: mockStorage[key] })),
            set: vi.fn().mockImplementation((items: Record<string, unknown>) => {
              Object.assign(mockStorage, items);
              return Promise.resolve();
            }),
          } as unknown as chrome.storage.LocalStorageArea,
        } as unknown as typeof chrome.storage,
      } as unknown as typeof chrome;

      const note: Note = {
        id: 'test-id',
        text: 'Ini catatan uji coba',
        color: 'pink',
        createdAt: 1000,
        updatedAt: 1000,
      };

      const stateToSave = {
        schemaVersion: 1 as const,
        notes: [note],
        ui: { expanded: true },
      };

      const saved = await saveState(stateToSave);
      expect(saved).toBe(true);

      const loaded = await loadState();
      expect(loaded.notes.length).toBe(1);
      expect(loaded.notes[0].id).toBe('test-id');
      expect(loaded.notes[0].text).toBe('Ini catatan uji coba');
      expect(loaded.notes[0].color).toBe('pink');
      expect(loaded.ui.expanded).toBe(true);
    });
  });
});
