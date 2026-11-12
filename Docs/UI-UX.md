# UI / UX

## 1. State Widget
1. **Terlipat (default)** — chip kecil 36×36 px, ikon sticky note, badge jumlah catatan (opsional, tampil jika > 0).
2. **Terbuka** — panel di bawah chip, anchor kanan atas.

## 2. Posisi & Ukuran
| Properti | Nilai |
|---|---|
| Posisi | `fixed`, `top: 12px`, `right: 12px` (offset bisa diubah di config untuk menghindari menu website) |
| Chip | 36×36 px, radius 10 px |
| Panel | lebar 280 px, maks tinggi `60vh`, scroll internal |
| Z-index | 2147483647 |
| Layar sempit (< 480 px) | panel lebar `calc(100vw - 24px)` |

## 3. Layout Panel
```
┌──────────────────────────────┐
│ Catatan (3)         [+] [–]  │  ← header: judul, tambah, lipat
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
| Klik `–` / tekan Esc | Lipat panel |
| Klik `+` | Tambah catatan di atas, fokus textarea |
| Ketik | Autosave (debounce 400 ms) |
| Klik titik warna | Ubah warna catatan |
| Klik `Hapus` | Tombol jadi "Yakin?" 3 detik; klik lagi = hapus |
| Capai 50 catatan | Tombol `+` nonaktif + tooltip "Maksimal 50 catatan" |

## 6. Aksesibilitas
- Semua tombol punya `aria-label` bahasa Indonesia, dapat difokus keyboard.
- Panel `role="region"` + `aria-label="Sticky notes"`.
- Fokus terlihat jelas (outline 2 px).
- Ukuran target klik minimal 28×28 px.

## 7. Teks UI (Indonesia)
Judul: "Catatan" · Tambah: "Tambah catatan" · Lipat: "Lipat" · Hapus: "Hapus" / "Yakin?" · Error simpan: "Gagal menyimpan catatan" · Batas: "Maksimal 50 catatan"
