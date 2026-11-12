export type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';

export interface Note {
  id: string;          // crypto.randomUUID()
  text: string;        // maks 5000 karakter
  color: NoteColor;    // default 'yellow'
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
}

export interface UIState {
  expanded: boolean;
}

export interface StoredState {
  schemaVersion: 1;
  notes: Note[];       // urut: terbaru di atas
  ui: UIState;
}

export type StorageListener = (newState: StoredState) => void;
