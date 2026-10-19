# 0008. Multi-Watchlist Registry and Section Dividers Architecture

Untuk mengatasi keterbatasan daftar pantau tunggal (*single flat watchlist*) yang rentan tertimpa oleh *preset*, serta memberikan kebebasan bagi trader untuk mengkategorikan dan memisahkan instrumen pantauannya tanpa mengurangi kesederhanaan terminal, `trawangan` menetapkan keputusan arsitektur berikut:

1. **Multi-Watchlist Registry Isolation**:
   - Menggantikan tombol preset statis (`[Binance USDT]` & `[Indodax IDR]`) dengan komponen selektor popover di bagian atas panel Watchlist.
   - Mendukung pembuatan, penggantian nama (*rename*), duplikasi, dan penghapusan daftar pantau kustom tanpa batas.
   - Menyediakan daftar bawaan sistem (*factory presets*) sebagai template yang dapat diedit langsung oleh pengguna secara lokal, lengkap dengan opsi penyelamat *"Reset ke Default Bawaan"*.
   - **Isolasi Panel Sisi**: Seluruh mutasi multi-watchlist diisolasi murni di dalam panel sisi Watchlist, menjaga bilah koin cepat (*Quick Symbols*) di Header tetap sederhana dan tidak terdistorsi.

2. **Flat Ordered List with Section Divider Tokens**:
   - Struktur data di dalam tiap watchlist disimpan sebagai *flat ordered list* yang memadukan instrumen koin (`providerId:symbol`) dan baris pembatas kategori/seksi (`#section:<id>:<name>:<isCollapsed>`).
   - Pendekatan ini memungkinkan operasi penataan ulang (*re-order*) dan *Drag & Drop* lintas kategori dengan kompleksitas $O(1)$ serta mempermudah migrasi data lama tanpa merusak integritas urutan visual.

3. **Multiplexer Feed Guard & Non-Ticker Filtering**:
   - Subsistem *Multi-Provider Watchlist Polling Multiplexer* secara otomatis menyaring dan mengabaikan token `#section:`, sehingga hanya instrumen pasar valid yang ditembakkan ke adapter bursa.
   - Status terlipat (*collapsed*) pada sebuah seksi kategori bersifat murni presentasional; polling harga latar belakang dan pendeteksian sinyal *Price Alert* untuk koin di dalam kategori terlipat tetap aktif berjalan secara *real-time*.

4. **Fail-Safe Deletion and Minimum Watchlist Guard**:
   - **Penghapusan Seksi/Kategori**: Menghapus judul kategori hanya menghapus penanda pembatas visualnya; seluruh koin di bawahnya tetap aman tersimpan dan otomatis bergeser menjadi koin reguler (mencegah *accidental data loss*).
   - **Batas Minimum Watchlist**: Terminal wajib mempertahankan minimal 1 watchlist aktif (tombol hapus dinonaktifkan jika hanya tersisa 1 daftar). Jika watchlist aktif yang sedang dibuka dihapus, terminal secara otomatis mengalihkan tampilan ke *"Daftar Utama (Default)"*.
