export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';

/** Satu paragraf di dalam catatan; checkbox menandai paragraf selesai. */
export interface NoteParagraph {
  id: string;
  text: string;
  checked: boolean;
}

export interface Note {
  id: string;          // crypto.randomUUID()
  text: string;        // maks 5000 karakter; representasi gabungan paragraphs
  paragraphs: NoteParagraph[]; // minimal 1 paragraf
  color: NoteColor;    // default 'yellow'
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
}

/** Posisi kiri-atas widget dalam piksel (relatif viewport). */
export interface WidgetPosition {
  x: number;
  y: number;
}

/** Ukuran panel dalam piksel. */
export interface WidgetSize {
  width: number;
  height: number;
}

export interface UIState {
  expanded: boolean;
  /** null = tetap di anchor default kanan atas. */
  position: WidgetPosition | null;
  /** null = ukuran panel default (280 px, maks 60vh). */
  size: WidgetSize | null;
}

export interface StoredState {
  schemaVersion: 1;
  notes: Note[];       // urut: terbaru di atas
  ui: UIState;
}

export interface WidgetSettings {
  /** Origin tambahan (mis. https://mail.google.com) tempat widget boleh tampil. */
  allowedOrigins: string[];
  /** Jika true, widget tampil di semua website http/https. */
  allSites: boolean;
}

export type SettingsListener = (newSettings: WidgetSettings) => void;

export type StorageListener = (newState: StoredState) => void;
