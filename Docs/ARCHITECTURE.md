# ARCHITECTURE

## 1. Tech Stack
- Chrome Extension **Manifest V3**
- TypeScript (strict) + **esbuild** (bundle satu file `content.js`)
- Tanpa framework UI; DOM native + **Shadow DOM**
- Storage: `chrome.storage.local`
- Test: Vitest (logic) + Playwright (load unpacked extension) — opsional v1

## 2. Struktur Proyek
```
barantin-sticky-notes/
├─ manifest.json
├─ package.json
├─ tsconfig.json
├─ build.mjs                 # esbuild script
├─ src/
│  ├─ content/
│  │  ├─ main.ts             # entry: load settings, mount/unmount sesuai allowlist
│  │  ├─ widget.ts           # buat host + shadow root, render UI + pengaturan situs
│  │  ├─ layout.ts           # drag, resize, clamp viewport, simpan geometri
│  │  ├─ styles.ts           # CSS string (adoptedStyleSheets)
│  │  └─ events.ts           # handler klik, keyboard, debounce
│  ├─ core/
│  │  ├─ store.ts            # baca/tulis state catatan, validasi, migrasi
│  │  ├─ settings.ts         # allowlist situs: normalisasi, validasi, load/save/subscribe
│  │  ├─ types.ts            # tipe Note, State, WidgetSettings
│  │  └─ config.ts           # TARGET_ORIGIN, limit, offset UI
│  └─ icons/                 # icon-16/32/48/128.png
├─ dist/                     # hasil build (di-gitignore)
└─ tests/
```

## 3. Manifest (acuan)
```json
{
  "manifest_version": 3,
  "name": "Barantin Sticky Notes",
  "version": "1.0.0",
  "description": "Sticky notes kecil untuk ft.karantinaindonesia.go.id dan situs lain pilihan Anda",
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": ["*://*/*"],
      "js": ["content.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "icons": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
}
```
Catatan:
- **Tidak ada** `host_permissions`, `tabs`, `activeTab`, `scripting`, atau background service worker. `matches: ["*://*/*"]` diperlukan agar situs tambahan bisa aktif tanpa reload; pembatasan domain dilakukan saat runtime lewat allowlist (`settings.ts`). Widget tidak dipasang di origin yang tidak diizinkan.
- Tidak ada popup/action; pengaturan situs berada di dalam panel widget (ikon globe).

## 4. Komponen
| Komponen | Tanggung jawab |
|---|---|
| `main.ts` | Load `WidgetSettings`, cek `isOriginAllowed(location.origin, settings)`, mount/unmount widget, subscribe perubahan settings agar tab terbuka ikut menyesuaikan |
| `widget.ts` | Buat `<div id="barantin-sticky-host">` di `document.body`/`document.documentElement`, `attachShadow({mode:'open'})`, render chip/panel, tampilan pengaturan situs, bind event |
| `layout.ts` | Drag chip/header, resize grip, clamp ke viewport, terapkan & persist `ui.position`/`ui.size` |
| `styles.ts` | Export CSS; pasang via `CSSStyleSheet` + `shadowRoot.adoptedStyleSheets` (fallback `<style>` jika tidak didukung) |
| `store.ts` | `load()`, `save()`, `subscribe(cb)`, validasi & clamp, migrasi skema catatan |
| `settings.ts` | `normalizeOrigin()`, `sanitizeSettings()`, `isOriginAllowed()`, `loadSettings()`, `saveSettings()`, `subscribeSettings()` |
| `events.ts` | Debounce 400 ms, Esc, klik luar (opsional), konfirmasi hapus |

## 5. Alur Data
```
Load halaman (http/https)
  → main.ts loadSettings() → isOriginAllowed(origin)?
      tidak → berhenti (tanpa host element)
      ya    → widget.mount()
  → store.load() → render
User ketik → debounce 400ms → store.save() → chrome.storage.local.set
User drag/resize → layout.ts terapkan style langsung → debounce → store.save()
Tab disembunyikan/ditutup → flush debounce → store.save() (ketikan terakhir tidak hilang)
User tambah/hapus situs di pengaturan
  → settings.saveSettings() → chrome.storage.local.set
  → storage.onChanged → main.ts syncWidget() di semua tab:
      origin diizinkan → mount bila belum ada
      tidak diizinkan → widget.unmount()
chrome.storage.onChanged (catatan, tab lain) → store.subscribe cb → re-render (tanpa merebut fokus jika sedang mengetik)
```

## 6. Aturan Teknis Penting
1. Host element: `position: fixed; top: 12px; right: 12px; z-index: 2147483647; all: initial` pada host; seluruh styling di dalam shadow root. Setelah digeser, posisi memakai `left/top` eksplisit yang tersimpan.
2. Jangan sentuh DOM/CSS website lain selain menambah 1 host element.
3. Render textarea: gunakan `textContent`/`value`, **jangan** `innerHTML` untuk data user (anti XSS).
4. Saat `onChanged` datang sementara user mengetik di textarea yang sama, jangan timpa nilai; terapkan last-write-wins berdasarkan `updatedAt` hanya untuk catatan yang tidak sedang fokus.
5. Website SPA: content script hidup selama dokumen hidup; cukup satu mount. Gunakan `MutationObserver` ringan pada `documentElement` **hanya** untuk memasang ulang host bila dihapus oleh script website (debounce, tanpa observasi subtree).
6. Semua teks UI dalam bahasa Indonesia, konstanta di satu tempat.
7. Mount/unmount dinamis: `main.ts` adalah satu-satunya pemilik siklus hidup widget. `widget.unmount()` wajib melepas listener storage/settings, layout, dan host element; jangan memanggil `mount()` ganda.
8. Allowlist situs hanya boleh berisi origin http/https yang dinormalkan (`normalizeOrigin`); situs utama tidak disimpan di daftar, dan jumlah situs tambahan dibatasi `MAX_ALLOWED_SITES`.

## 7. Build & Install
- `npm run build` → `dist/` berisi `manifest.json`, `content.js`, `icons/`.
- Install: `chrome://extensions` → Developer mode → Load unpacked → pilih `dist/`.
- Setelah ubah kode: build ulang + klik Reload di halaman ekstensi + refresh tab website.
