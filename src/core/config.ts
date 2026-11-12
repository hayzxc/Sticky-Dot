import type { NoteColor } from './types';

export const CONFIG = {
  STORAGE_KEY: 'barantinStickyNotes',
  TARGET_ORIGIN: 'https://ft.karantinaindonesia.go.id',
  HOST_ELEMENT_ID: 'barantin-sticky-host',
  MAX_NOTES: 50,
  MAX_CHARS_PER_NOTE: 5000,
  DEBOUNCE_MS: 400,
  DELETE_CONFIRM_MS: 3000,
  TOP_OFFSET_PX: 12,
  RIGHT_OFFSET_PX: 12,
  Z_INDEX: 2147483647,
  CURRENT_SCHEMA_VERSION: 1 as const,
} as const;

export interface ColorTheme {
  background: string;
  border: string;
  text: string;
  label: string;
}

export const NOTE_COLORS: Record<NoteColor, ColorTheme> = {
  yellow: {
    background: '#FFF4A3',
    border: '#E6D76A',
    text: '#2B2B2B',
    label: 'Kuning',
  },
  pink: {
    background: '#FFD1E3',
    border: '#E89BB9',
    text: '#2B2B2B',
    label: 'Pink',
  },
  blue: {
    background: '#CFE8FF',
    border: '#8DBDEB',
    text: '#2B2B2B',
    label: 'Biru',
  },
  green: {
    background: '#D4F5D0',
    border: '#8FCB89',
    text: '#2B2B2B',
    label: 'Hijau',
  },
  orange: {
    background: '#FFDDB8',
    border: '#E8B27A',
    text: '#2B2B2B',
    label: 'Oranye',
  },
};

export const COLOR_KEYS: NoteColor[] = ['yellow', 'pink', 'blue', 'green', 'orange'];
