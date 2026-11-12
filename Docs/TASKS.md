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
- [x] `main.ts`: guard origin + cegah double-mount.
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

## Backlog v1.1
- [ ] Draggable + simpan posisi (tetap default kanan atas).
- [ ] Export/Import JSON.
- [ ] Pencarian catatan.
- [ ] Shortcut keyboard global (mis. Alt+N) via `commands`.
- [ ] Opsi `chrome.storage.sync` antar perangkat.
