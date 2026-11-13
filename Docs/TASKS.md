# TASKS — Urutan Build

Kerjakan berurutan. Centang hanya setelah verifikasi di browser.

## M0 — Recon (sebelum coding)
- [x] Buka website target, cek apakah pojok kanan atas sudah terpakai (OQ1); catat selector/area yang harus dihindari.
- [x] Cek apakah ada CSP ketat / iframe konten utama (OQ2).

## M1 — Scaffold
- [x] `npm init`, TypeScript strict, esbuild (`build.mjs`) → `dist/content.js`.
- [x] Salin `manifest.json` + icons ke `dist/` saat build.
- [x] Skrip `npm run build` dan `npm run watch`.

## M2 — Mount & Isolasi
- [x] `main.ts`: siklus hidup widget + cegah double-mount (guard origin awal; diganti allowlist di M8).
- [x] `widget.ts`: host + Shadow DOM + chip 36×36 di kanan atas.
- [x] Verifikasi M1–M3 pada TEST-PLAN.

## M3 — Store
- [x] `types.ts`, `config.ts`, `store.ts` (load/save/subscribe/validasi/migrasi).
- [x] Unit test store.

## M4 — UI Panel
- [x] Buka/lipat, header, empty state.
- [x] Tambah/edit/hapus (konfirmasi 2 klik), autosave debounce, pilih warna.
- [x] Counter karakter, batas 50 catatan.

## M5 — Sinkron Antar Tab
- [x] `storage.onChanged` → re-render tanpa merebut fokus.
- [x] Verifikasi M8.

## M6 — Polish
- [x] Aksesibilitas (aria, fokus, keyboard Esc).
- [x] Dark mode panel, reduced motion, layar sempit.
- [x] MutationObserver ringan untuk pasang ulang host jika dihapus.

## M7 — Rilis Pribadi
- [x] Jalankan seluruh TEST-PLAN.
- [x] README instalasi singkat + peringatan privasi.
- [x] Tag versi 1.0.0.

## M8 — Multi-Situs (allowlist)
- [x] `settings.ts`: normalisasi origin, sanitasi, load/save/subscribe allowlist.
- [x] `main.ts`: mount/unmount dinamis berdasarkan `isOriginAllowed`, reaktif terhadap perubahan settings.
- [x] `manifest.json`: content script `*://*/*`; widget tetap digating allowlist.
- [x] UI pengaturan situs di panel (tambah/hapus, toggle semua website, situs utama terkunci).
- [x] Unit & integration test untuk settings dan UI pengaturan.
- [ ] Verifikasi manual M21–M28 di Chrome/Edge.

## Backlog v1.1
- [x] Draggable + simpan posisi (tetap default kanan atas).
- [x] Panel resizable + simpan ukuran (min/max & clamp viewport).
- [x] Multi-situs: tambah/hapus website lewat pengaturan (allowlist) + opsi semua website.
- [x] Checklist per paragraf: checkbox, garis coret, Enter/Shift+Enter, migrasi catatan lama.
- [ ] Export/Import JSON.
- [ ] Pencarian catatan.
- [ ] Shortcut keyboard global (mis. Alt+N) via `commands`.
- [ ] Opsi `chrome.storage.sync` antar perangkat.
