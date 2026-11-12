# PRD — Barantin Sticky Notes

## 1. Ringkasan
Widget catatan kecil yang menempel di pojok kanan atas website `ft.karantinaindonesia.go.id`, supaya pengguna bisa mencatat hal singkat (nomor dokumen, nomor kontainer, pengingat) tanpa pindah aplikasi.

## 2. Tujuan
- G1: Catat cepat tanpa meninggalkan halaman.
- G2: Ringan dan tidak mengganggu tampilan website (ukuran kecil, bisa dilipat).
- G3: Hanya aktif di satu domain target.
- G4: Data tetap ada setelah tab/browser ditutup.

## 3. Non-Goals (v1)
- Sinkronisasi antar perangkat / cloud.
- Membaca atau auto-mengisi data dari halaman website.
- Dukungan Firefox / Safari.
- Rich text, gambar, lampiran.
- Draggable (masuk v1.1, lihat TASKS).

## 4. Pengguna
Satu pengguna lokal (Hayu / staf operasional) yang bekerja di website tersebut.

## 5. User Stories
| ID | Sebagai pengguna, saya ingin… | Agar… |
|---|---|---|
| US1 | melihat ikon catatan kecil di pojok kanan atas saat membuka ft.karantinaindonesia.go.id | tahu catatan tersedia |
| US2 | klik ikon untuk membuka panel catatan | mengetik/membaca |
| US3 | menambah, mengedit, menghapus catatan | mengelola catatan |
| US4 | catatan tersimpan otomatis | tidak perlu klik simpan |
| US5 | melipat panel kembali ke ikon kecil | layar tidak tertutup |
| US6 | widget tidak muncul di website lain | tidak mengganggu browsing lain |
| US7 | catatan sama muncul di semua tab website tersebut | konsisten |
| US8 | memilih warna catatan | membedakan prioritas |

## 6. Functional Requirements
- FR1: Widget hanya di-inject untuk URL `https://ft.karantinaindonesia.go.id/*`.
- FR2: State default = terlipat (ikon ± 36×36 px) di kanan atas.
- FR3: Klik ikon → panel terbuka (± 280 px lebar, maks tinggi 60 vh, scroll internal).
- FR4: Tombol `+` menambah catatan kosong dan memfokuskan textarea-nya.
- FR5: Autosave debounce 400 ms; juga simpan saat blur.
- FR6: Hapus catatan dengan konfirmasi satu klik (tombol berubah jadi "Yakin?" selama 3 detik).
- FR7: 5 pilihan warna per catatan.
- FR8: Perubahan di satu tab tampil di tab lain tanpa reload (`storage.onChanged`).
- FR9: State terlipat/terbuka diingat.
- FR10: Tombol Esc menutup panel saat fokus di dalam widget.
- FR11: Style widget terisolasi dari CSS website (Shadow DOM).

## 7. Non-Functional Requirements
- NFR1: Tidak memengaruhi performa halaman (inject < 50 ms, tanpa polling).
- NFR2: Permission minimal: hanya `storage`.
- NFR3: Tidak ada network request apa pun.
- NFR4: Tidak merusak layout website (position: fixed, tidak mengubah DOM website selain 1 host element).
- NFR5: Bahasa UI: Indonesia.

## 8. Acceptance Criteria
- AC1: Di domain target widget muncul di pojok kanan atas; di domain lain (mis. google.com) tidak ada elemen widget di DOM.
- AC2: Tambah catatan → reload halaman → catatan masih ada.
- AC3: Dua tab domain target terbuka; edit di tab A muncul di tab B dalam ≤ 1 detik.
- AC4: CSS website tidak mengubah tampilan widget, dan sebaliknya.
- AC5: Manifest hanya memuat permission `storage` dan tidak ada `host_permissions` lebar.
- AC6: Batas 50 catatan dan 5000 karakter/catatan ditegakkan dengan pesan jelas.

## 9. Pertanyaan Terbuka (verifikasi saat build)
- OQ1: Apakah pojok kanan atas website sudah ditempati elemen (menu user, notifikasi)? Jika ya, atur offset di `config.ts`.
- OQ2: Apakah website memakai CSP ketat atau iframe untuk konten utama? (Default: `all_frames: false`.)
- OQ3: Perlu subdomain lain selain `ft.`? (Default: tidak.)
