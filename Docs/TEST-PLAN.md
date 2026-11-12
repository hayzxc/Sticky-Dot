# TEST PLAN

## A. Manual (wajib, Chrome & Edge)
| ID | Langkah | Hasil yang diharapkan |
|---|---|---|
| M1 | Buka https://ft.karantinaindonesia.go.id | Chip muncul kecil di kanan atas |
| M2 | Buka google.com / situs lain | Tidak ada elemen `#barantin-sticky-host` di DOM |
| M3 | Buka subdomain/domain mirip (mis. karantinaindonesia.go.id tanpa `ft.`) | Widget tidak muncul |
| M4 | Klik chip | Panel terbuka, empty state tampil |
| M5 | Klik `+`, ketik teks | Tersimpan otomatis; reload → masih ada |
| M6 | Ganti warna | Warna berubah dan persisten setelah reload |
| M7 | Hapus catatan (klik 2×) | Catatan hilang; klik 1× lalu tunggu 3 dtk → batal |
| M8 | Buka 2 tab domain target, edit di tab A | Tab B terupdate ≤ 1 dtk, tanpa kehilangan fokus saat mengetik |
| M9 | Lipat panel, reload | State terlipat diingat |
| M10 | Tekan Esc saat fokus di panel | Panel terlipat |
| M11 | Tambah sampai 50 catatan | Tombol `+` nonaktif |
| M12 | Ketik > 5000 karakter | Dipotong/ditolak dengan pesan |
| M13 | Navigasi antar halaman dalam website (SPA/non-SPA) | Widget tetap ada, tidak dobel |
| M14 | Zoom 50%–200%, jendela sempit | Layout widget tetap rapi, tidak menutupi seluruh layar |
| M15 | Cek `chrome://extensions` → detail | Hanya akses ke situs ft.karantinaindonesia.go.id; tidak ada izin lain |

## B. Unit (Vitest) — `store.ts`
- `load()` dengan storage kosong → default.
- `load()` dengan data korup → default tanpa menimpa storage.
- Clamp teks > 5000, warna tidak valid → yellow, batasi 50 catatan.
- `migrate()` dengan `schemaVersion` tak dikenal.

## C. E2E (Playwright, opsional)
- Launch Chromium dengan `--load-extension=dist`.
- Halaman lokal yang di-route ke origin target (via `page.route`) → pastikan widget ada; origin lain → tidak ada.

## D. Definition of Done
Semua M1–M15 lulus, unit test hijau, build tanpa warning TypeScript, tidak ada `console.error` di halaman.
