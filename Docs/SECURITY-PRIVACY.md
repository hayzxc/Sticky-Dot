# SECURITY & PRIVACY

## Prinsip
Ekstensi ini hanya wadah catatan lokal. Ia **tidak boleh** berinteraksi dengan data website.

## Aturan Wajib
1. Permission hanya `storage`. Dilarang menambah `tabs`, `activeTab`, `scripting`, `webRequest`, `cookies`, `history`, atau `host_permissions`.
2. `matches` hanya `https://ft.karantinaindonesia.go.id/*`. Dilarang `<all_urls>` atau wildcard domain.
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
| Ekstensi dipasang ke domain lain tidak sengaja | Guard origin ganda (`matches` + cek `location.origin`) |
| Storage penuh/gagal | Tangkap error, tampilkan toast, jangan crash |

## Distribusi
Mode developer (Load unpacked) untuk penggunaan pribadi. Jika dibagikan ke tim, bagikan folder `dist/` atau `.zip` dan tulis versi di `manifest.json`.
