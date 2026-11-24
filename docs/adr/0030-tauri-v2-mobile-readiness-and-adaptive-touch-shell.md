# 0030. Tauri v2 Mobile Readiness and Adaptive Touch Shell Architecture (iOS & Android)

## Status
Dicatat & Direncanakan (*Recorded & Planned*), 24 November 2026.

## Konteks
`trawangan` dibangun di atas tumpukan teknologi **Tauri v2 (Rust Core)**, **Svelte 5 (Runes)**, **LuxAlgo Vela (WebGL2 Engine)**, dan **SQLite (`rusqlite`)**. Seiring kebutuhan pengguna untuk memantau grafik, rencana trading, dan alert secara portabel di perangkat **iOS** dan **Android**, diperlukan kajian dan peta jalan arsitektur untuk memastikan satu basis kode (*single codebase*) dapat dikompilasi ke target desktop maupun mobile tanpa melanggar batasan performa ringan (`ADR-0003`).

## Keputusan Arsitektur
1. **Kelayakan Satu Basis Kode (Tauri v2 Cross-Platform Target)**:
   - Memanfaatkan dukungan native `tauri android` (Kotlin/NDK) dan `tauri ios` (Swift/Xcode) pada Tauri v2.
   - Mesin grafik **WebGL2 (`@luxalgo/vela`)**, runtime **PineTS Web Worker**, dan basis data **SQLite (`rusqlite` dengan fitur `bundled`)** 100% kompatibel dengan Android WebView (Chromium) dan iOS WKWebView serta kompilasi cross-target ARM64 (`aarch64-linux-android` & `aarch64-apple-ios`).

2. **Isolasi Dependensi Khusus Desktop (`#[cfg(desktop)]`)**:
   - Crate dan plugin yang hanya relevan untuk sistem operasi desktop wajib dipisahkan di `src-tauri/Cargo.toml` menggunakan `[target.'cfg(not(any(target_os = "android", target_os = "ios")))'.dependencies]` dan guard kompilasi `#[cfg(desktop)]` di `src-tauri/src/lib.rs`:
     - `tauri-plugin-single-instance` (hanya desktop).
     - `tauri-plugin-updater` (pembaruan mobile ditangani oleh App Store / Play Store / APK release).
     - `rfd` (Native file dialog desktop digantikan oleh Web Share API / File System mobile).

3. **Adaptive Touch & Mobile Shell**:
   - Saat mendeteksi viewport layar sempit atau perangkat sentuh (`pointer: coarse`):
     - **Docked Structural Shell** (`Left Drawing Toolbar` + `Right Dock Rail`) bertransformasi menjadi **Bottom Navigation Bar** dan **Slide-Up Bottom Sheet** untuk tab `Watchlist`, `Alerts`, `Layers`, `Plan`, dan `Order`.
     - **Gesture Draw by Holding (`Shift+D` / `~`)** diadaptasi ke layar sentuh melalui tombol *Floating Touch Inking Toggle* sehingga sapuan satu jari dapat menggambar langsung di kanvas tanpa menahan tombol keyboard fisik, sedangkan cubitan dua jari (*pinch-to-zoom*) tetap mengatur skala harga/waktu.
     - **Type-to-Search Canvas Guard** dinonaktifkan pada perangkat tanpa keyboard fisik agar tidak memicu kemunculan keyboard virtual secara tidak sengaja saat menyentuh kanvas.

4. **Strategi Background Alert di Mobile**:
   - Mengingat batasan manajemen daya iOS dan Android yang membekukan WebView di latar belakang, evaluasi `Background Alert Engine` di perangkat mobile disiapkan untuk didelegasikan ke *Foreground Service* (Android) atau penjadwalan *Background Fetch* ringan di lapisan Rust native.

## Konsekuensi
- Tidak perlu menulis ulang aplikasi dengan Flutter atau React Native; seluruh investasi logika Svelte 5, parser Trade Plan, 37 tema budaya Jawa, dan database SQLite dapat dipakai ulang secara langsung.
- Implementasi desktop saat ini tetap berjalan murni dan ringan, sementara refactoring `#[cfg(desktop)]` dan *Adaptive Mobile Shell* dapat dieksekusi secara bertahap saat fase build mobile dimulai.
