# SECURITY & PRIVACY

## Prinsip
Ekstensi ini hanya wadah catatan lokal. Ia **tidak boleh** berinteraksi dengan data website.

## Aturan Wajib
1. Permission hanya `storage`. Dilarang menambah `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, `history`, atau `host_permissions`.
2. `matches` memakai `*://*/*` **hanya** karena daftar situs dapat diubah pengguna saat runtime. Ini pengecualian eksplisit terhadap aturan lama "hanya satu domain" dan **bukan** izin untuk membaca/mengubah data website:
   - Tidak ada `host_permissions`; akses berasal dari deklarasi content script.
   - Widget hanya dipasang setelah `isOriginAllowed(location.origin, settings)` bernilai true.
   - Situs utama (`TARGET_ORIGIN`) selalu diizinkan; situs lain harus ditambahkan manual atau opsi `allSites` dinyalakan.
   - Allowlist disimpan di `chrome.storage.local` (`barantinStickyNotesSettings`) dan dibatasi maksimal 50 origin.
   - Content script yang tidak lolos allowlist langsung berhenti; tidak membuat host element, tidak membaca DOM website.
3. Dilarang membaca isi form, tabel, cookie, localStorage/sessionStorage website, atau token apa pun milik website.
4. Dilarang `fetch`/`XMLHttpRequest`/`WebSocket`/`sendBeacon` ke mana pun. Tidak ada analytics/telemetri.
5. Dilarang `eval`, `new Function`, dan `innerHTML` dengan data user. Gunakan `textContent`/`value`.
6. Tidak memuat script/font/gambar eksternal (semua aset ada di paket).
7. Data hanya di `chrome.storage.local` perangkat pengguna.

## Risiko & Mitigasi
| Risiko | Mitigasi |
|---|---|
| Script website menyentuh widget | Shadow DOM mode `open` hanya untuk testing; pertimbangkan `closed` di rilis |
| CSS website mengganggu widget | Shadow DOM + `all: initial` pada host |
| Catatan berisi data sensitif (nomor dokumen) | Peringatan di README: catatan tersimpan lokal tanpa enkripsi; jangan simpan password |
| Widget aktif di situs yang tidak diinginkan | Allowlist eksplisit + konfirmasi tambah situs; `allSites` default mati; hapus situs langsung meng-unmount widget di tab tersebut |
| Izin browser terlihat luas ("all websites") | Didokumentasikan di README dan halaman ini; tidak ada `host_permissions`, tidak ada pembacaan data halaman, hanya 1 host element di situs yang diizinkan |
| Storage penuh/gagal | Tangkap error, tampilkan toast, jangan crash |
| Origin allowlist dimanipulasi | `sanitizeSettings` menormalkan URL (http/https saja), menolak kredensial, dedupe, dan membatasi jumlah |

## Distribusi
Mode developer (Load unpacked) untuk penggunaan pribadi. Jika dibagikan ke tim, bagikan folder `dist/` atau `.zip` dan tulis versi di `manifest.json`.
