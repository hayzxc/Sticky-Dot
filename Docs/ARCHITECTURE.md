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
│  │  ├─ main.ts             # entry: guard origin, mount widget
│  │  ├─ widget.ts           # buat host + shadow root, render UI
│  │  ├─ styles.ts           # CSS string (adoptedStyleSheets)
│  │  └─ events.ts           # handler klik, keyboard, debounce
│  ├─ core/
│  │  ├─ store.ts            # baca/tulis storage, validasi, migrasi
│  │  ├─ types.ts            # tipe Note, State
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
  "description": "Sticky notes kecil khusus ft.karantinaindonesia.go.id",
  "permissions": ["storage"],
  "content_scripts": [
    {
      "matches": ["https://ft.karantinaindonesia.go.id/*"],
      "js": ["content.js"],
      "run_at": "document_idle",
      "all_frames": false
    }
  ],
  "icons": { "16": "icons/icon-16.png", "32": "icons/icon-32.png", "48": "icons/icon-48.png", "128": "icons/icon-128.png" }
}
```
Catatan:
- **Tidak ada** `host_permissions`, `tabs`, `activeTab`, `scripting`, atau background service worker. Pembatasan domain murni lewat `matches`, sehingga widget otomatis tidak ada di tab lain.
- Tidak ada popup/action; ekstensi tidak punya UI di toolbar (opsional v1.1: action untuk toggle).

## 4. Komponen
| Komponen | Tanggung jawab |
|---|---|
| `main.ts` | Cek `location.origin === TARGET_ORIGIN` (defense in depth), cegah double-mount (cek id host), panggil `mountWidget()` |
| `widget.ts` | Buat `<div id="barantin-sticky-host">` di `document.documentElement`, `attachShadow({mode:'open'})`, render ikon + panel, bind event |
| `styles.ts` | Export CSS; pasang via `CSSStyleSheet` + `shadowRoot.adoptedStyleSheets` (fallback `<style>` jika tidak didukung) |
| `store.ts` | `load()`, `save()`, `subscribe(cb)`, validasi & clamp, migrasi skema |
| `events.ts` | Debounce 400 ms, Esc, klik luar (opsional), konfirmasi hapus |

## 5. Alur Data
```
Load halaman target
  → main.ts guard origin → widget.mount()
  → store.load() → render
User ketik → debounce 400ms → store.save() → chrome.storage.local.set
chrome.storage.onChanged (tab lain) → store.subscribe cb → re-render (tanpa merebut fokus jika sedang mengetik)
```

## 6. Aturan Teknis Penting
1. Host element: `position: fixed; top: 12px; right: 12px; z-index: 2147483647; all: initial` pada host; seluruh styling di dalam shadow root.
2. Jangan sentuh DOM/CSS website lain selain menambah 1 host element.
3. Render textarea: gunakan `textContent`/`value`, **jangan** `innerHTML` untuk data user (anti XSS).
4. Saat `onChanged` datang sementara user mengetik di textarea yang sama, jangan timpa nilai; terapkan last-write-wins berdasarkan `updatedAt` hanya untuk catatan yang tidak sedang fokus.
5. Website SPA: content script hidup selama dokumen hidup; cukup satu mount. Gunakan `MutationObserver` ringan pada `documentElement` **hanya** untuk memasang ulang host bila dihapus oleh script website (debounce, tanpa observasi subtree).
6. Semua teks UI dalam bahasa Indonesia, konstanta di satu tempat.

## 7. Build & Install
- `npm run build` → `dist/` berisi `manifest.json`, `content.js`, `icons/`.
- Install: `chrome://extensions` → Developer mode → Load unpacked → pilih `dist/`.
- Setelah ubah kode: build ulang + klik Reload di halaman ekstensi + refresh tab website.
