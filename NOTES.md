# NOTES.md — Catatan Recon M0 & Keputusan Desain

## M0 — Hasil Recon

### 1. Website Target
- URL: `https://ft.karantinaindonesia.go.id`
- Aplikasi: Fumi TRUST Suite (Sistem Pengawasan Perlakuan Karantina Tumbuhan — Fumigasi, ISPM#15, dll.)
- Server / Stack: PHP 8.3 / Laravel, Caddy reverse proxy, Tailwind CSS.

### 2. Pertanyaan Terbuka (OQ1–OQ3)
- **OQ1: Area pojok kanan atas website**
  - Pada halaman publik / landing, navbar memiliki tinggi 80px (`h-20`), sticky top (`top-0 z-50`). Di sebelah kanan terdapat tombol LOGIN (`/admin/login`).
  - Pada halaman internal/admin setelah login, umumnya terdapat avatar/menu profil user di pojok kanan atas.
  - **Keputusan**: Sediakan konfigurasi offset di `src/core/config.ts` dengan default `TOP_PX = 12` dan `RIGHT_PX = 12` (atau dapat disesuaikan jika bertumpukan dengan tombol login/menu admin tanpa mengganggu fungsi). Chip menggunakan `z-index: 2147483647` agar selalu berada di lapisan terdepan.
- **OQ2: CSP & Iframe**
  - Respon HTTP tidak memuat header `Content-Security-Policy`.
  - Halaman tidak memuat tag `<meta http-equiv="Content-Security-Policy">`.
  - Konten utama bukan iframe.
  - **Keputusan**: Konfigurasi `all_frames: false` pada `manifest.json` sudah tepat dan aman.
- **OQ3: Subdomain**
  - Domain target murni `https://ft.karantinaindonesia.go.id/*`.
  - Tidak ada kebutuhan subdomain lain untuk saat ini.

### 3. Identitas Ekstensi
- Permintaan user: Nama "Sticky Dot" (sesuai prompt: *"build stcky notes named sticky dot"*).
- Manifest `name`: `Sticky Dot`
- Description: `Sticky notes kecil untuk produktivitas khusus ft.karantinaindonesia.go.id`
- Host id: `#barantin-sticky-host` (sesuai spec AGENTS.md)

