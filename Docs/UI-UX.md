# UI / UX

## 1. State Widget
1. **Terlipat (default)** — chip kecil 36×36 px, ikon sticky note, badge jumlah catatan (opsional, tampil jika > 0).
2. **Terbuka** — panel di bawah chip, anchor kanan atas.
3. **Pengaturan situs** — panel yang sama, menggantikan daftar catatan sementara (buka lewat ikon globe di header; kembali lewat tombol panah atau Esc).

## 2. Posisi & Ukuran
| Properti | Nilai |
|---|---|
| Posisi default | `fixed`, `top: 12px`, `right: 12px` (offset di config untuk menghindari menu website) |
| Posisi setelah digeser | koordinat kiri-atas (px) tersimpan di `ui.position`, di-clamp agar tetap di viewport |
| Chip | 36×36 px, radius 10 px |
| Panel default | lebar 280 px, maks tinggi `60vh`, scroll internal |
| Panel setelah resize | lebar 220–800 px, tinggi 160–1200 px, dibatasi viewport; tersimpan di `ui.size` |
| Z-index | 2147483647 |
| Layar sempit (< 480 px) | default panel `calc(100vw - 24px)`; ukuran hasil resize tetap di-clamp ke viewport |
| Drag handle | chip (saat terlipat) dan seluruh header panel |
| Resize handle | grip diagonal di pojok kanan bawah panel |

Posisi & ukuran diterapkan langsung ke DOM saat drag/resize (tanpa re-render) lalu disimpan dengan debounce yang sama seperti catatan.

## 3. Layout Panel
```
┌──────────────────────────────┐
│ Catatan (3)      [+] [🌐] [–]│  ← header: judul, tambah, pengaturan situs, lipat
├──────────────────────────────┤
│ ┌──────────────────────────┐ │
│ │ textarea (auto-grow)     │ │
│ │ ● ● ● ● ●        [Hapus] │ │  ← warna + hapus
│ └──────────────────────────┘ │
│ ┌──────────────────────────┐ │
│ │ ...                      │ │
└──────────────────────────────┘
```
- Empty state: teks "Belum ada catatan. Klik + untuk menambah."
- Counter karakter muncul saat > 90% limit.

## 3a. Layout Pengaturan Situs
```
┌──────────────────────────────┐
│ Pengaturan situs     [←] [–] │
├──────────────────────────────┤
│ Tambahkan alamat website ... │
│ [ contoh: mail.google.com ][+]│
│ ☐ Tampilkan di semua website │
│   Termasuk situs yang belum  │
│   ditambahkan...             │
│ WEBSITE AKTIF                │
│ ┌──────────────────────────┐ │
│ │ https://ft.karantinain...│ │
│ │                    Utama │ │
│ ├──────────────────────────┤ │
│ │ https://mail.google.com  │ │
│ │                         ×│ │
│ └──────────────────────────┘ │
│ Perubahan langsung berlaku…  │
└──────────────────────────────┘
```
- Situs utama selalu ditampilkan dengan badge "Utama" dan tanpa tombol hapus.
- Input menerima domain (`contoh.com`) maupun URL lengkap; yang disimpan hanya origin (`https://contoh.com`).
- Error (alamat tidak valid, duplikat, batas 50 situs) tampil sebagai toast di bawah panel.
- Menghapus situs tempat widget sedang berjalan akan melepas widget dari tab tersebut setelah penyimpanan selesai.

## 4. Visual
- Font: `system-ui, sans-serif`, 13 px.
- Palet kartu (latar / garis): kuning `#FFF4A3`/`#E6D76A`, pink `#FFD1E3`/`#E89BB9`, biru `#CFE8FF`/`#8DBDEB`, hijau `#D4F5D0`/`#8FCB89`, oranye `#FFDDB8`/`#E8B27A`.
- Teks gelap `#2B2B2B` di semua kartu (kontras tinggi).
- Bayangan lembut, panel latar putih `#FFFFFF`, border `1px #E5E7EB`.
- Dukung `prefers-color-scheme: dark` untuk panel (kartu tetap berwarna pastel).
- Animasi: buka/tutup 120 ms; hormati `prefers-reduced-motion`.

## 5. Interaksi
| Aksi | Hasil |
|---|---|
| Klik chip | Buka panel |
| Seret chip / header panel | Pindahkan widget; posisi diingat setelah reload |
| Seret grip pojok kanan bawah | Ubah ukuran panel; ukuran diingat setelah reload |
| Fokus grip + tombol panah | Ubah ukuran 16 px (Shift: 40 px) |
| Klik `–` / tekan Esc | Lipat panel |
| Klik `+` | Tambah catatan di atas, fokus textarea |
| Klik ikon globe | Buka pengaturan situs |
| Klik `←` / Esc di pengaturan | Kembali ke daftar catatan (tanpa melipat panel) |
| Isi alamat + klik `Tambah` / Enter | Tambah situs ke allowlist; widget langsung aktif di tab situs tersebut |
| Klik `×` pada situs | Hapus situs dari allowlist; widget dilepas dari tab situs itu |
| Centang "Tampilkan di semua website" | Widget aktif di semua halaman http/https (default mati) |
| Ketik | Autosave (debounce 400 ms) |
| Klik titik warna | Ubah warna catatan |
| Centang checkbox paragraf | Mencoret paragraf sebagai selesai/tidak terpakai |
| `Enter` di paragraf | Membuat paragraf baru |
| `Shift+Enter` di paragraf | Baris baru dalam paragraf yang sama |
| Klik `Hapus` | Tombol jadi "Yakin?" 3 detik; klik lagi = hapus |
| Capai 50 catatan | Tombol `+` nonaktif + tooltip "Maksimal 50 catatan" |

Catatan: drag memakai ambang 4 px, sehingga klik singkat pada chip tetap membuka panel (klik setelah drag diabaikan).

## 6. Aksesibilitas
- Semua tombol punya `aria-label` bahasa Indonesia, dapat difokus keyboard.
- Panel `role="region"` dengan `aria-label` yang berubah sesuai tampilan ("Sticky notes" / "Pengaturan situs").
- Input alamat situs punya label aksesibel; Enter di input = tombol Tambah.
- Grip resize `role="separator"` + `aria-label`, dapat difokus dan diubah dengan tombol panah.
- Fokus terlihat jelas (outline 2 px).
- Ukuran target klik minimal 28×28 px (grip 24×24 px di sudut panel).

## 7. Teks UI (Indonesia)
Judul: "Catatan" · Tambah: "Tambah catatan" · Lipat: "Lipat" · Hapus: "Hapus" / "Yakin?" · Error simpan: "Gagal menyimpan catatan" · Batas: "Maksimal 50 catatan" · Drag: "Tarik untuk memindahkan panel" · Resize: "Ubah ukuran panel (gunakan tombol panah)".
Pengaturan: "Pengaturan situs" · "Kembali ke catatan" · "Tambah" · "Website aktif" · "Utama" · "Hapus situs" · "Tampilkan di semua website" · "Alamat tidak valid. Gunakan http atau https." · "Website ini sudah aktif" · "Maksimal 50 website tambahan" · "Situs ditambahkan: …" · "Perubahan langsung berlaku di semua tab yang terbuka."
