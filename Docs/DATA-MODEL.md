# DATA MODEL

## Storage
`chrome.storage.local`, satu key: `barantinStickyNotes`

```ts
type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';

interface Note {
  id: string;          // crypto.randomUUID()
  text: string;        // maks 5000 karakter
  color: NoteColor;    // default 'yellow'
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
}

interface StoredState {
  schemaVersion: 1;
  notes: Note[];       // urut: terbaru di atas
  ui: { expanded: boolean };
}
```

## Default
```json
{ "schemaVersion": 1, "notes": [], "ui": { "expanded": false } }
```

## Limit (di `config.ts`)
| Konstanta | Nilai |
|---|---|
| MAX_NOTES | 50 |
| MAX_CHARS_PER_NOTE | 5000 |
| DEBOUNCE_MS | 400 |
| DELETE_CONFIRM_MS | 3000 |

## Validasi saat load
- Jika data bukan object / `schemaVersion` tidak dikenal → pakai default dan **jangan** menimpa data lama sebelum user mengubah sesuatu.
- Buang catatan dengan field wajib hilang; potong `text` melebihi limit; warna tidak valid → `yellow`.

## Migrasi
Fungsi `migrate(raw)` di `store.ts`: switch pada `schemaVersion`. v1 belum ada migrasi; siapkan kerangka untuk versi berikutnya.

## Kuota
`storage.local` ± 10 MB; 50 × 5000 karakter jauh di bawah batas. Tangkap error `set` dan tampilkan toast "Gagal menyimpan".
