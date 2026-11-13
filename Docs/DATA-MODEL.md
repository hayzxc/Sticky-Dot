# DATA MODEL

## Storage
`chrome.storage.local`, dua key:

| Key | Isi |
|---|---|
| `barantinStickyNotes` | State catatan + layout (`StoredState`) |
| `barantinStickyNotesSettings` | Allowlist situs (`WidgetSettings`) |

`chrome.storage.local` persisten antar sesi browser (bukan `storage.session`), sehingga catatan & layout tetap ada setelah browser ditutup dan dibuka kembali. Perubahan yang masih tertahan debounce di-flush saat `visibilitychange` (hidden), `pagehide`, atau `beforeunload`.

```ts
type NoteColor = 'yellow' | 'pink' | 'blue' | 'green' | 'orange';

interface NoteParagraph {
  id: string;
  text: string;
  checked: boolean;
}

interface Note {
  id: string;          // crypto.randomUUID()
  text: string;        // maks 5000 karakter; gabungan paragraphs
  paragraphs: NoteParagraph[]; // minimal 1 paragraf
  color: NoteColor;    // default 'yellow'
  createdAt: number;   // epoch ms
  updatedAt: number;   // epoch ms
}

interface StoredState {
  schemaVersion: 1;
  notes: Note[];       // urut: terbaru di atas
  ui: {
    expanded: boolean;
    position: { x: number; y: number } | null; // kiri-atas widget (px)
    size: { width: number; height: number } | null; // ukuran panel (px)
  };
}

interface WidgetSettings {
  allowedOrigins: string[]; // origin http/https, tanpa situs utama
  allSites: boolean;        // default false
}
```

`position` / `size` = `null` berarti memakai anchor & ukuran default. Field ini opsional saat load: data lama tanpa layout tetap valid.

## Default
```json
{
  "schemaVersion": 1,
  "notes": [],
  "ui": { "expanded": false, "position": null, "size": null }
}
```

Settings default (tidak perlu ditulis sampai pengguna mengubah):
```json
{ "allowedOrigins": [], "allSites": false }
```

## Limit (di `config.ts`)
| Konstanta | Nilai |
|---|---|
| MAX_NOTES | 50 |
| MAX_CHARS_PER_NOTE | 5000 |
| MAX_ALLOWED_SITES | 50 |
| DEBOUNCE_MS | 400 |
| DELETE_CONFIRM_MS | 3000 |
| PANEL_MIN_WIDTH | 220 |
| PANEL_MIN_HEIGHT | 160 |
| PANEL_MAX_WIDTH | 800 |
| PANEL_MAX_HEIGHT | 1200 |

## Validasi saat load
- Jika data bukan object / `schemaVersion` tidak dikenal → pakai default dan **jangan** menimpa data lama sebelum user mengubah sesuatu.
- Buang catatan dengan field wajib hilang; potong `text` melebihi limit; warna tidak valid → `yellow`.
- `position`: hanya angka finite; negatif di-clamp ke 0. `size`: di-clamp ke `PANEL_MIN_*`/`PANEL_MAX_*`. Nilai tidak valid → `null` (default).
- `allowedOrigins`: hanya string; dinormalkan ke origin http/https (domain tanpa skema → `https://`); kredensial ditolak; duplikat dan `TARGET_ORIGIN` dibuang; maksimal 50.
- `paragraphs`: minimal 1; `text` selalu digabung dari `paragraphs` (join `\\n`); total teks (termasuk newline) dibatasi 5000. Catatan lama tanpa `paragraphs` dipecah per newline dengan ID deterministik. `checked` hanya boolean `true` yang dianggap selesai.
- `allSites`: hanya boolean `true` yang dianggap aktif; nilai lain → `false`.

## Migrasi
Fungsi `migrate(raw)` di `store.ts`: switch pada `schemaVersion`. v1 belum ada migrasi; siapkan kerangka untuk versi berikutnya.

## Kuota
`storage.local` ± 10 MB; 50 × 5000 karakter jauh di bawah batas. Tangkap error `set` dan tampilkan toast "Gagal menyimpan".
