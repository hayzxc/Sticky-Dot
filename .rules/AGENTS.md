# AGENTS.md — Aturan untuk AI Coding Agent

## Misi
Bangun ekstensi Chromium MV3 "Barantin Sticky Notes" sesuai spec di folder ini. Spec adalah sumber kebenaran; jika ada konflik, urutan prioritas: `SECURITY-PRIVACY.md` > `PRD.md` > `ARCHITECTURE.md` > `UI-UX.md` > `TASKS.md`.

## Wajib
1. Baca seluruh spec dulu (urutan di `README.md`) sebelum menulis kode.
2. Kerjakan task sesuai urutan `TASKS.md`; satu milestone selesai dan terverifikasi sebelum lanjut.
3. TypeScript strict, tanpa `any` kecuali dijustifikasi di komentar.
4. Widget **hanya** untuk `https://ft.karantinaindonesia.go.id/*`. Jangan melebarkan `matches`.
5. Permission hanya `storage`. Jangan tambah permission apa pun tanpa persetujuan eksplisit user.
6. Semua UI di dalam Shadow DOM; satu-satunya elemen yang ditambahkan ke halaman adalah host `#barantin-sticky-host`.
7. Data user ditulis lewat `textContent`/`value`, bukan `innerHTML`.
8. Teks UI bahasa Indonesia, dikumpulkan di satu modul konstanta.
9. Tidak ada network request, analytics, atau dependency runtime di bundle (devDependencies saja).

## Dilarang
- Membaca/memodifikasi konten, form, cookie, atau storage website.
- Menambah fitur di luar scope PRD (lihat Non-Goals) tanpa izin.
- Menggunakan `eval`, `new Function`, script/font/gambar eksternal.
- Mengganti stack (framework UI, bundler) tanpa izin.

## Cara Verifikasi
- `npm run build` bersih tanpa error/warning TypeScript.
- Load unpacked dari `dist/` di Chrome/Edge dan jalankan test case di `TEST-PLAN.md`.
- Laporkan hasil tiap milestone: apa yang dikerjakan, test case yang lulus, dan masalah terbuka.

## Jika Ragu
Tanya user; jangan menebak. Catat pertanyaan terbuka (OQ1–OQ3 di PRD) dan hasil recon M0 di `NOTES.md`.
