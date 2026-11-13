# Barantin Sticky Notes — Spec Suite

Ekstensi browser (Chromium, Manifest V3) berupa sticky notes kecil yang secara default muncul di `https://ft.karantinaindonesia.go.id`, diletakkan kecil di **pojok kanan atas** halaman. Pengguna dapat menambahkan website lain lewat pengaturan situs; widget tidak muncul di situs yang belum diizinkan.

## Isi Suite

| File | Fungsi |
|---|---|
| `PRD.md` | Tujuan, user story, scope, acceptance criteria |
| `ARCHITECTURE.md` | Struktur proyek, manifest, komponen, alur data, tech stack |
| `DATA-MODEL.md` | Skema storage, limit, migrasi |
| `UI-UX.md` | Layout, ukuran, state, warna, interaksi, aksesibilitas |
| `SECURITY-PRIVACY.md` | Permission minimal, isolasi, aturan privasi |
| `TEST-PLAN.md` | Test case manual + otomatis |
| `TASKS.md` | Milestone & checklist build berurutan untuk AI agent |
| `AGENTS.md` | Aturan wajib untuk AI coding agent |

## Urutan Baca (untuk agent)
`AGENTS.md` → `PRD.md` → `ARCHITECTURE.md` → `DATA-MODEL.md` → `UI-UX.md` → `SECURITY-PRIVACY.md` → `TASKS.md` → `TEST-PLAN.md`

## Asumsi yang Dipakai
1. Browser target: Chrome / Edge (Chromium, MV3). Firefox di luar scope v1.
2. "Tidak muncul di tab lain" = widget hanya dipasang di origin yang diizinkan (situs utama + allowlist pengguna). Semua tab di situs yang diizinkan berbagi catatan yang sama dan tersinkron real-time.
3. Catatan disimpan lokal di browser (tanpa server, tanpa akun).
4. Ekstensi tidak membaca, mengubah, atau mengirim data dari halaman website.
5. Allowlist situs dapat diubah pengguna dan disimpan terpisah dari catatan (`barantinStickyNotesSettings`).
