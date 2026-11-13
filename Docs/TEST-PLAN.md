# TEST PLAN

## A. Manual (wajib, Chrome & Edge)
| ID | Langkah | Hasil yang diharapkan |
|---|---|---|
| M1 | Buka https://ft.karantinaindonesia.go.id | Chip muncul kecil di kanan atas |
| M2 | Buka google.com / situs lain yang belum ditambahkan | Tidak ada elemen `#barantin-sticky-host` di DOM |
| M3 | Buka subdomain/domain mirip (mis. karantinaindonesia.go.id tanpa `ft.`) | Widget tidak muncul (belum diizinkan) |
| M4 | Klik chip | Panel terbuka, empty state tampil |
| M5 | Klik `+`, ketik teks | Tersimpan otomatis; reload → masih ada |
| M6 | Ganti warna | Warna berubah dan persisten setelah reload |
| M7 | Hapus catatan (klik 2×) | Catatan hilang; klik 1× lalu tunggu 3 dtk → batal |
| M8 | Buka 2 tab situs yang sama-sama diizinkan, edit di tab A | Tab B terupdate ≤ 1 dtk, tanpa kehilangan fokus saat mengetik |
| M9 | Lipat panel, reload | State terlipat diingat |
| M10 | Tekan Esc saat fokus di panel | Panel terlipat |
| M11 | Tambah sampai 50 catatan | Tombol `+` nonaktif |
| M12 | Ketik > 5000 karakter | Dipotong/ditolak dengan pesan |
| M13 | Navigasi antar halaman dalam website (SPA/non-SPA) | Widget tetap ada, tidak dobel |
| M14 | Zoom 50%–200%, jendela sempit | Layout widget tetap rapi, tidak menutupi seluruh layar |
| M15 | Cek `chrome://extensions` → detail | Hanya izin `storage`; peringatan akses situs luas muncul karena content script `*://*/*`, tanpa `host_permissions` tambahan |
| M16 | Seret chip ke tengah layar, reload | Widget muncul di posisi terakhir; klik singkat chip tetap membuka panel |
| M17 | Buka panel, seret header, resize via grip pojok kanan bawah, reload | Posisi & ukuran panel diingat; catatan tetap bisa di-scroll |
| M18 | Resize/geser panel ke tepi lalu perkecil jendela | Panel tetap terlihat (di-clamp), tidak keluar viewport |
| M19 | Ketik catatan lalu langsung tutup browser (< 400 ms) | Buka kembali website target → teks terakhir tetap ada (flush saat pagehide) |
| M20 | Tutup browser saat panel terbuka, lalu buka lagi | Panel kembali terbuka di posisi & ukuran terakhir |
| M21 | Buka pengaturan (ikon globe), tambah `example.com`, buka tab example.com | Widget muncul di example.com tanpa reload ekstensi; catatan sama dengan situs utama |
| M22 | Di pengaturan, isi alamat tidak valid (`not a url`) lalu Tambah | Toast "Alamat tidak valid…", daftar situs tidak berubah |
| M23 | Tambah situs yang sudah ada / situs utama | Toast "Website ini sudah aktif", tidak ada duplikat |
| M24 | Tambah situs dari Tab A, lihat Tab B yang sudah terbuka di situs itu | Widget langsung terpasang di Tab B (storage.onChanged) |
| M25 | Hapus situs dari daftar | Widget langsung hilang dari tab situs tersebut; catatan tetap tersimpan |
| M26 | Centang "Tampilkan di semua website" | Widget muncul di seluruh situs http/https; uncheck → kembali hanya situs utama + allowlist |
| M27 | Buka pengaturan lalu tekan Esc | Kembali ke daftar catatan; Esc kedua melipat panel |
| M28 | Reload browser, buka situs tambahan | Allowlist tetap tersimpan di `chrome.storage.local` |
| M29 | Tandai checkbox paragraf | Paragraf tercentang tampil dengan garis coret dan tersimpan |
| M30 | Tekan Enter di paragraf | Paragraf baru dibuat; teks terpisah per newline |
| M31 | Tekan Shift+Enter di paragraf | Baris baru dalam paragraf yang sama, tanpa checkbox baru |
| M32 | Buka catatan lama tanpa paragraphs | Setiap baris ditampilkan sebagai paragraf checklist |

## B. Unit (Vitest)
`store.ts`
- `load()` dengan storage kosong → default.
- `load()` dengan data korup → default tanpa menimpa storage.
- Clamp teks > 5000, warna tidak valid → yellow, batasi 50 catatan.
- `migrate()` dengan `schemaVersion` tak dikenal.

`settings.ts`
- `normalizeOrigin()`: domain tanpa skema → `https://`, URL lengkap → origin, hanya http/https, tolak kredensial/URL rusak.
- `sanitizeSettings()`: normalisasi, dedupe, buang `TARGET_ORIGIN`, batasi `MAX_ALLOWED_SITES`, `allSites` hanya boolean true.
- `isOriginAllowed()`: situs utama selalu true; allowlist; `allSites`; origin lain false.
- `loadSettings`/`saveSettings`: key terpisah, data tersanitasi.
- `subscribeSettings`: hanya bereaksi pada key settings di area `local`; unsubscribe melepas listener.

`widget.ts`
- Buka/tutup tampilan pengaturan, tombol kembali, Esc dua tingkat.
- Tambah situs valid → storage & daftar UI; alamat invalid → toast, tanpa menulis.
- Hapus situs & toggle semua website → tersimpan.

## C. E2E (Playwright, opsional)
- Launch Chromium dengan `--load-extension=dist`.
- Halaman lokal yang di-route ke origin target (via `page.route`) → pastikan widget ada; origin lain → tidak ada sampai ditambahkan lewat pengaturan.
- Seed `chrome.storage.local` dengan allowlist berisi origin halaman uji → widget muncul tanpa interaksi.

## D. Definition of Done
Semua M1–M28 lulus, unit test hijau, build tanpa warning TypeScript, tidak ada `console.error` di halaman.
