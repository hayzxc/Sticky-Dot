# Sticky Dot (Barantin Sticky Notes)

Ekstensi browser Chromium (Manifest V3) berupa sticky notes kecil dan terisolasi untuk produktivitas kerja. Secara default aktif di `https://ft.karantinaindonesia.go.id`, dan pengguna dapat menambahkan website lain lewat menu pengaturan di panel.

Diletakkan di pojok kanan atas halaman dalam bentuk chip (36×36 px) yang dapat dilipat/dibuka, dan tersinkronisasi otomatis antar-tab secara lokal.

---

## 🔒 Privasi & Keamanan

Sesuai spesifikasi ketat di `Docs/SECURITY-PRIVACY.md`:
1. **Izin Minimal**: Hanya meminta izin `storage`. Tidak meminta `tabs`, `activeTab`, `scripting`, `cookies`, atau `host_permissions` lebar.
2. **Situs Dapat Diatur**: Content script dipasang di semua halaman http/https agar situs baru bisa langsung aktif tanpa reload, tetapi widget **hanya dipasang** jika origin ada di allowlist (situs utama selalu aktif, situs tambahan harus ditambahkan manual, atau opsi "semua website" dinyalakan). Daftar situs disimpan di `chrome.storage.local`.
3. **Isolasi Lengkap**: Berjalan di dalam **Shadow DOM**; satu-satunya elemen yang ditambahkan ke dokumen adalah `<div id="barantin-sticky-host">`. Tidak mengganggu stylesheet atau DOM website.
4. **Tanpa Akses Data Website**: Ekstensi tidak pernah membaca formulir, cookie, token, atau data halaman website.
5. **Tanpa Jaringan / Telemetri**: Tidak ada request HTTP, WebSocket, atau pelacakan analytics apa pun. Semua catatan disimpan secara lokal di `chrome.storage.local`.
6. **Bebas XSS**: Input pengguna dimasukkan secara eksklusif melalui `value` dan `textContent`, tidak menggunakan `innerHTML`.

> [!WARNING]
> Karena content script tersedia di semua halaman, Chrome/Edge akan menampilkan izin "read and change all your data on all websites" saat instalasi. Ini konsekuensi dari allowlist yang dapat diubah pengguna; ekstensi tidak membaca data halaman dan hanya memasang widget di situs yang diizinkan. Aktifkan "Tampilkan di semua website" hanya jika benar-benar diperlukan.

> [!WARNING]
> Catatan tersimpan secara lokal di browser Anda tanpa enkripsi tambahan. Hindari menyimpan kata sandi (password) atau informasi autentikasi rahasia pada sticky notes.

---

## 🚀 Panduan Instalasi (Load Unpacked)

### 1. Build Ekstensi
Pastikan Node.js (v18+) terpasang. Jalankan:
```bash
npm install
npm run build
```
Hasil build siap pakai akan berada di direktori `dist/`.

### 2. Pasang di Browser (Chrome / Edge / Brave)
1. Buka halaman ekstensi di browser:
   - Chrome: `chrome://extensions`
   - Edge: `edge://extensions`
2. Aktifkan **Developer mode** (Mode Pengembang) di pojok kanan atas.
3. Klik tombol **Load unpacked** (Muat yang belum dibongkar).
4. Pilih folder `dist` di dalam direktori proyek ini:
   ```
   D:\File Kerja\stickydot\dist
   ```
5. Buka [https://ft.karantinaindonesia.go.id](https://ft.karantinaindonesia.go.id) — chip Sticky Dot akan muncul di pojok kanan atas.
6. Ingin memakai di website lain? Buka panel, klik ikon globe (⚙/🌐) di header, masukkan alamat website (contoh: `mail.google.com`), lalu klik **Tambah**. Widget langsung aktif di tab website tersebut tanpa perlu reload ekstensi.

---

## 💡 Fitur Utama

- **Chip Lipat/Buka**: Default terlipat (36×36 px) dengan badge jumlah catatan aktif. Klik untuk membuka panel.
- **Multi-Situs**: Tambah/hapus alamat website lewat ikon globe di header panel. Situs utama selalu aktif; opsi "Tampilkan di semua website" tersedia untuk pengguna yang ingin widget di mana saja. Perubahan langsung berlaku di tab yang sudah terbuka. Catatan tetap sama di semua situs.
- **Checklist per Paragraf**: Setiap paragraf catatan punya checkbox. Centang untuk mencoret paragraf yang selesai/tidak terpakai. `Enter` membuat paragraf baru; `Shift+Enter` membuat baris baru dalam paragraf yang sama.
- **Geser & Atur Ukuran**: Seret chip atau header panel untuk memindahkan widget; seret grip pojok kanan bawah (atau pakai tombol panah) untuk mengubah ukuran panel. Posisi & ukuran diingat setelah reload dan selalu di-clamp ke dalam viewport.
- **Autosave Debounced**: Catatan tersimpan otomatis saat berhenti mengetik (debounce 400 ms) dan saat blur.
- **Persisten Setelah Browser Ditutup**: Data disimpan di `chrome.storage.local` (bertahan antar sesi browser). Perubahan yang masih menunggu debounce di-flush saat tab disembunyikan/ditutup (`visibilitychange`, `pagehide`, `beforeunload`) sehingga ketikan terakhir tidak hilang.
- **5 Pilihan Warna Pastel**: Kuning, Pink, Biru, Hijau, dan Oranye.
- **Hapus Aman (Konfirmasi 2-Langkah)**: Tombol "Hapus" berubah menjadi "Yakin?" selama 3 detik sebelum menghapus catatan.
- **Sinkronisasi Multi-Tab**: Menulis catatan di Tab A otomatis muncul di Tab B secara real-time tanpa mengganggu fokus mengetik.
- **Batas Aman**: Maksimal 50 catatan, maksimal 5.000 karakter per catatan (indikator counter muncul saat > 90%).
- **Aksesibilitas & Keyboard**: Tekan `Esc` untuk melipat panel kembali ke bentuk chip. Dukungan dark mode otomatis sesuai preferensi sistem.

---

## 🛠️ Perintah Pengembang

- `npm run build`: Kompilasi TypeScript dan bundel aset ke `dist/`
- `npm run watch`: Mode pantau perubahan otomatis saat coding
- `npm run typecheck`: Validasi tipe TypeScript strict
- `npm test`: Jalankan seluruh unit & integration test suite (Vitest)

