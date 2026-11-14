// Modul Native Updater untuk deteksi lingkungan instalasi dan pembaruan paket Linux (.rpm / .deb)
use serde::Serialize;
use sha2::{Digest, Sha256};
use std::env;
use std::fs::{self, File};
use std::io::Write;
use std::path::{Path, PathBuf};
use std::process::{Command, Stdio};
use std::time::Instant;
use tauri::{AppHandle, Emitter};

const ALLOWED_RELEASE_PREFIX: &str = "https://github.com/KaleksananBarqi/trawangan/releases/download/";
const UPDATE_STAGING_DIR: &str = "trawangan-updates";

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum InstallKind {
    Windows,
    Macos,
    Appimage,
    Rpm,
    Deb,
    Flatpak,
    Dev,
    LinuxUnknown,
    Unknown,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "kebab-case")]
pub enum PackageManagerKind {
    Dnf,
    Zypper,
    Rpm,
    AptGet,
    Flatpak,
}

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
#[serde(rename_all = "snake_case")]
pub enum InstallResultStatus {
    Relaunching,
    Cancelled,
    FallbackOpened,
}

#[derive(Debug, Clone, Serialize, PartialEq, Eq)]
#[serde(rename_all = "camelCase")]
pub struct InstallEnvironment {
    pub os: String,
    pub arch: String,
    pub install_kind: InstallKind,
    pub recommended_linux_format: Option<InstallKind>,
    pub package_manager: Option<PackageManagerKind>,
    pub can_in_app_update: bool,
    pub is_dev: bool,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadProgressPayload {
    pub downloaded_bytes: u64,
    pub total_bytes: Option<u64>,
    pub percent: f64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct DownloadPackageResult {
    pub file_path: String,
    pub sha256: String,
    pub file_size: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstallPackageResult {
    pub status: InstallResultStatus,
    pub message: String,
}

/// Memeriksa apakah perintah biner tersedia di variabel lingkungan `PATH`.
fn command_exists(cmd: &str) -> bool {
    let Some(path_var) = env::var_os("PATH") else {
        return false;
    };
    env::split_paths(&path_var).any(|dir| dir.join(cmd).is_file())
}

/// Menebak format paket distro Linux dari `/etc/os-release` dan ketersediaan package manager.
fn infer_linux_distro_format() -> InstallKind {
    if let Ok(os_release) = fs::read_to_string("/etc/os-release") {
        let lower = os_release.to_lowercase();
        if lower.contains("fedora")
            || lower.contains("rhel")
            || lower.contains("centos")
            || lower.contains("rocky")
            || lower.contains("almalinux")
            || lower.contains("opensuse")
            || lower.contains("suse")
        {
            return InstallKind::Rpm;
        }
        if lower.contains("debian") || lower.contains("ubuntu") || lower.contains("pop") || lower.contains("mint") {
            return InstallKind::Deb;
        }
    }
    if command_exists("dnf") || command_exists("zypper") || command_exists("rpm") {
        return InstallKind::Rpm;
    }
    if command_exists("apt-get") || command_exists("dpkg") {
        return InstallKind::Deb;
    }
    InstallKind::Appimage
}

/// Memilih perintah package manager terbaik yang tersedia di sistem Linux.
fn pick_package_manager_kind(
    kind: InstallKind,
    has_dnf: bool,
    has_zypper: bool,
    has_rpm: bool,
    has_apt: bool,
) -> Option<PackageManagerKind> {
    match kind {
        InstallKind::Rpm => {
            if has_dnf {
                Some(PackageManagerKind::Dnf)
            } else if has_zypper {
                Some(PackageManagerKind::Zypper)
            } else if has_rpm {
                Some(PackageManagerKind::Rpm)
            } else {
                None
            }
        }
        InstallKind::Deb => has_apt.then_some(PackageManagerKind::AptGet),
        _ => None,
    }
}

/// Menyusun argumen `pkexec` untuk memasang paket lokal `.rpm` atau `.deb`.
pub(crate) fn build_linux_install_args(
    kind: InstallKind,
    package_path: &str,
    has_dnf: bool,
    has_zypper: bool,
    has_rpm: bool,
    has_apt: bool,
) -> Option<Vec<String>> {
    let pm = pick_package_manager_kind(kind, has_dnf, has_zypper, has_rpm, has_apt)?;
    let args = match pm {
        PackageManagerKind::Dnf => vec!["dnf".into(), "install".into(), "-y".into(), package_path.into()],
        PackageManagerKind::Zypper => vec![
            "zypper".into(),
            "--non-interactive".into(),
            "install".into(),
            "--allow-unsigned-rpm".into(),
            package_path.into(),
        ],
        PackageManagerKind::Rpm => vec!["rpm".into(), "-Uvh".into(), "--replacepkgs".into(), package_path.into()],
        PackageManagerKind::AptGet => vec!["apt-get".into(), "install".into(), "-y".into(), package_path.into()],
        PackageManagerKind::Flatpak => return None,
    };
    Some(args)
}

/// Memeriksa apakah path biner saat ini dimiliki oleh paket RPM atau DEB.
#[cfg(target_os = "linux")]
fn detect_linux_package_owner(exe_path: &Path) -> Option<InstallKind> {
    let mut candidates = vec![exe_path.to_path_buf()];
    if let Ok(canon) = fs::canonicalize(exe_path) {
        if canon != exe_path {
            candidates.push(canon);
        }
    }

    for candidate in &candidates {
        let Some(path_str) = candidate.to_str() else {
            continue;
        };
        if command_exists("rpm") {
            if let Ok(out) = Command::new("rpm").args(["-qf", path_str]).output() {
                if out.status.success() {
                    return Some(InstallKind::Rpm);
                }
            }
        }
        if command_exists("dpkg") {
            if let Ok(out) = Command::new("dpkg").args(["-S", path_str]).output() {
                if out.status.success() {
                    return Some(InstallKind::Deb);
                }
            }
        }
    }
    None
}

#[cfg(not(target_os = "linux"))]
fn detect_linux_package_owner(_exe_path: &Path) -> Option<InstallKind> {
    None
}

/// Mendeteksi lingkungan OS, arsitektur CPU, dan jenis instalasi aplikasi saat runtime.
#[tauri::command]
pub fn detect_install_environment() -> InstallEnvironment {
    let os = env::consts::OS.to_string();
    let arch = env::consts::ARCH.to_string();
    let is_dev = cfg!(debug_assertions);

    if os == "windows" || os == "macos" {
        let desktop_kind = if os == "windows" {
            InstallKind::Windows
        } else {
            InstallKind::Macos
        };
        return InstallEnvironment {
            os,
            arch,
            install_kind: if is_dev { InstallKind::Dev } else { desktop_kind },
            recommended_linux_format: None,
            package_manager: None,
            can_in_app_update: !is_dev,
            is_dev,
        };
    }

    if os == "linux" {
        let distro_hint = infer_linux_distro_format();

        if env::var_os("FLATPAK_ID").is_some() {
            return InstallEnvironment {
                os,
                arch,
                install_kind: InstallKind::Flatpak,
                recommended_linux_format: Some(InstallKind::Flatpak),
                package_manager: Some(PackageManagerKind::Flatpak),
                can_in_app_update: false,
                is_dev,
            };
        }

        if env::var_os("APPIMAGE").is_some() {
            return InstallEnvironment {
                os,
                arch,
                install_kind: InstallKind::Appimage,
                recommended_linux_format: Some(InstallKind::Appimage),
                package_manager: None,
                can_in_app_update: !is_dev,
                is_dev,
            };
        }

        if is_dev {
            return InstallEnvironment {
                os,
                arch,
                install_kind: InstallKind::Dev,
                recommended_linux_format: Some(distro_hint),
                package_manager: None,
                can_in_app_update: false,
                is_dev,
            };
        }

        if let Ok(exe_path) = env::current_exe() {
            if let Some(owner) = detect_linux_package_owner(&exe_path) {
                let pm = pick_package_manager_kind(
                    owner,
                    command_exists("dnf"),
                    command_exists("zypper"),
                    command_exists("rpm"),
                    command_exists("apt-get"),
                );
                return InstallEnvironment {
                    os,
                    arch,
                    install_kind: owner,
                    recommended_linux_format: Some(owner),
                    package_manager: pm,
                    can_in_app_update: true,
                    is_dev,
                };
            }
        }

        return InstallEnvironment {
            os,
            arch,
            install_kind: InstallKind::LinuxUnknown,
            recommended_linux_format: Some(distro_hint),
            package_manager: None,
            can_in_app_update: false,
            is_dev,
        };
    }

    InstallEnvironment {
        os,
        arch,
        install_kind: InstallKind::Unknown,
        recommended_linux_format: None,
        package_manager: None,
        can_in_app_update: false,
        is_dev,
    }
}

/// Memvalidasi URL rilis resmi GitHub trawangan untuk mencegah pengunduhan dari host sembarangan.
pub(crate) fn validate_release_url(url: &str) -> Result<(), String> {
    if !url.starts_with(ALLOWED_RELEASE_PREFIX) {
        return Err("URL rilis tidak berasal dari repositori resmi trawangan.".to_string());
    }
    Ok(())
}

/// Memvalidasi nama berkas paket Linux agar aman dari path traversal.
pub(crate) fn validate_package_filename(name: &str) -> Result<(), String> {
    if name.is_empty() || name.contains('/') || name.contains('\\') || name.contains("..") {
        return Err("Nama berkas paket pembaruan tidak valid.".to_string());
    }
    if !(name.ends_with(".rpm") || name.ends_with(".deb")) {
        return Err("Format paket Linux tidak didukung untuk instalasi native.".to_string());
    }
    Ok(())
}

/// Mem-parsing berkas `SHA256SUMS.txt` untuk menemukan digest hex 64-karakter milik aset tertentu.
pub(crate) fn parse_sha256_manifest(manifest: &str, asset_name: &str) -> Option<String> {
    for raw_line in manifest.lines() {
        let line = raw_line.trim();
        if line.is_empty() || line.starts_with('#') {
            continue;
        }
        let mut parts = line.split_whitespace();
        let Some(hash) = parts.next() else {
            continue;
        };
        let Some(file_part) = parts.next() else {
            continue;
        };
        let clean_name = file_part.trim_start_matches('*').trim_start_matches("./");
        let base_name = Path::new(clean_name).file_name().and_then(|s| s.to_str()).unwrap_or(clean_name);
        if base_name == asset_name && hash.len() == 64 && hash.chars().all(|c| c.is_ascii_hexdigit()) {
            return Some(hash.to_lowercase());
        }
    }
    None
}

fn get_staging_dir() -> PathBuf {
    env::temp_dir().join(UPDATE_STAGING_DIR)
}

/// Memastikan path berkas installer berada di dalam folder staging sementara dan berformat valid.
fn validate_staged_package_path(file_path: &str) -> Result<PathBuf, String> {
    let staging_dir = fs::canonicalize(get_staging_dir())
        .map_err(|_| "Direktori staging pembaruan tidak ditemukan.".to_string())?;
    let target = fs::canonicalize(Path::new(file_path))
        .map_err(|_| "Berkas paket pembaruan tidak ditemukan di disk.".to_string())?;
    if !target.starts_with(&staging_dir) {
        return Err("Lokasi berkas paket pembaruan berada di luar direktori staging.".to_string());
    }
    let name = target
        .file_name()
        .and_then(|s| s.to_str())
        .ok_or_else(|| "Nama berkas paket tidak valid.".to_string())?;
    validate_package_filename(name)?;
    Ok(target)
}

/// Membuka berkas lokal melalui `xdg-open` secara non-blocking.
fn spawn_xdg_open(target: &Path) -> Result<(), String> {
    Command::new("xdg-open")
        .arg(target)
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map(|_| ())
        .map_err(|e| format!("Gagal membuka installer lewat xdg-open: {}", e))
}

/// Mengunduh paket `.rpm` / `.deb` dari GitHub Releases dengan progress event dan memverifikasi hash SHA-256.
#[tauri::command]
pub async fn download_and_verify_linux_package(
    app: AppHandle,
    asset_name: String,
    asset_url: String,
    checksum_url: String,
) -> Result<DownloadPackageResult, String> {
    validate_package_filename(&asset_name)?;
    validate_release_url(&asset_url)?;
    validate_release_url(&checksum_url)?;

    let client = reqwest::Client::builder()
        .user_agent("trawangan-updater/1.0")
        .build()
        .map_err(|e| format!("Gagal menginisialisasi HTTP client: {}", e))?;

    // Ambil manifest SHA256SUMS.txt terlebih dahulu agar fail-fast jika aset belum terdaftar
    let manifest_res = client
        .get(&checksum_url)
        .send()
        .await
        .map_err(|e| format!("Gagal mengunduh manifest SHA256SUMS.txt: {}", e))?;

    if !manifest_res.status().is_success() {
        return Err(format!(
            "Manifest verifikasi SHA256SUMS.txt tidak tersedia (HTTP {}). Gunakan unduhan manual atau coba lagi nanti.",
            manifest_res.status()
        ));
    }

    let manifest_text = manifest_res
        .text()
        .await
        .map_err(|e| format!("Gagal membaca isi SHA256SUMS.txt: {}", e))?;

    let expected_hash = parse_sha256_manifest(&manifest_text, &asset_name).ok_or_else(|| {
        format!(
            "Hash SHA-256 untuk '{}' tidak ditemukan di SHA256SUMS.txt.",
            asset_name
        )
    })?;

    let staging_dir = get_staging_dir();
    fs::create_dir_all(&staging_dir)
        .map_err(|e| format!("Gagal membuat direktori sementara pembaruan: {}", e))?;
    let dest_path = staging_dir.join(&asset_name);

    let mut res = client
        .get(&asset_url)
        .send()
        .await
        .map_err(|e| format!("Gagal mengunduh paket pembaruan: {}", e))?;

    if !res.status().is_success() {
        return Err(format!(
            "Server mengembalikan status HTTP {} saat mengunduh paket.",
            res.status()
        ));
    }

    let total_bytes = res.content_length();
    let mut file = File::create(&dest_path)
        .map_err(|e| format!("Gagal membuat berkas sementara paket: {}", e))?;
    let mut hasher = Sha256::new();
    let mut downloaded_bytes: u64 = 0;
    let mut last_emit = Instant::now();

    let _ = app.emit(
        "updater://download-progress",
        DownloadProgressPayload {
            downloaded_bytes: 0,
            total_bytes,
            percent: 0.0,
        },
    );

    while let Some(chunk) = res.chunk().await.map_err(|e| {
        let _ = fs::remove_file(&dest_path);
        format!("Koneksi terputus saat mengunduh paket: {}", e)
    })? {
        if let Err(e) = file.write_all(&chunk) {
            let _ = fs::remove_file(&dest_path);
            return Err(format!("Gagal menulis berkas paket ke disk: {}", e));
        }
        hasher.update(&chunk);
        downloaded_bytes += chunk.len() as u64;

        if last_emit.elapsed().as_millis() >= 100 {
            let percent = match total_bytes {
                Some(total) if total > 0 => ((downloaded_bytes as f64 / total as f64) * 100.0).min(100.0),
                _ => 0.0,
            };
            let _ = app.emit(
                "updater://download-progress",
                DownloadProgressPayload {
                    downloaded_bytes,
                    total_bytes,
                    percent,
                },
            );
            last_emit = Instant::now();
        }
    }

    file.flush()
        .map_err(|e| format!("Gagal melakukan flush berkas ke disk: {}", e))?;

    let _ = app.emit(
        "updater://download-progress",
        DownloadProgressPayload {
            downloaded_bytes,
            total_bytes: total_bytes.or(Some(downloaded_bytes)),
            percent: 100.0,
        },
    );

    let actual_hash = hex::encode(hasher.finalize());
    if actual_hash != expected_hash {
        let _ = fs::remove_file(&dest_path);
        return Err(format!(
            "Verifikasi SHA-256 gagal! Berkas kemungkinan korup atau tidak asli (diharapkan {}, didapat {}).",
            expected_hash, actual_hash
        ));
    }

    Ok(DownloadPackageResult {
        file_path: dest_path.to_string_lossy().to_string(),
        sha256: actual_hash,
        file_size: downloaded_bytes,
    })
}

/// Menentukan lokasi biner terpasang yang bersih (menghindari akhiran ` (deleted)` di Linux setelah package upgrade).
fn resolve_relaunch_executable() -> PathBuf {
    if let Ok(exe) = env::current_exe() {
        let raw = exe.to_string_lossy();
        if let Some(stripped) = raw.strip_suffix(" (deleted)") {
            let candidate = PathBuf::from(stripped);
            if candidate.exists() {
                return candidate;
            }
        }
        if exe.exists() {
            return exe;
        }
    }
    PathBuf::from("/usr/bin/trawangan")
}

/// Meluncurkan proses terpisah yang menunggu PID proses ini selesai sebelum membuka ulang biner terbaru.
fn spawn_clean_relaunch_helper(target_exe: &Path) -> Result<(), String> {
    let pid = std::process::id();
    let exe_str = target_exe.to_string_lossy().to_string();
    // Tunggu proses lama berhenti agar lock tauri-plugin-single-instance terlepas bersih
    let script = "while kill -0 \"$1\" 2>/dev/null; do sleep 0.15; done; exec \"$2\" >/dev/null 2>&1";
    Command::new("sh")
        .args(["-c", script, "_", &pid.to_string(), &exe_str])
        .stdin(Stdio::null())
        .stdout(Stdio::null())
        .stderr(Stdio::null())
        .spawn()
        .map_err(|e| format!("Gagal menjadwalkan restart aplikasi: {}", e))?;
    Ok(())
}

/// Membuka berkas installer lokal dengan aplikasi GUI default OS (`xdg-open`).
#[tauri::command]
pub fn open_local_installer_fallback(file_path: String) -> Result<(), String> {
    let target = validate_staged_package_path(&file_path)?;
    spawn_xdg_open(&target)
}

/// Memasang paket `.rpm` atau `.deb` yang telah terverifikasi via `pkexec` lalu me-restart aplikasi.
#[tauri::command]
pub async fn install_linux_package_and_relaunch(
    app: AppHandle,
    file_path: String,
) -> Result<InstallPackageResult, String> {
    let target = validate_staged_package_path(&file_path)?;
    let target_str = target.to_string_lossy().to_string();
    let kind = if target_str.ends_with(".rpm") {
        InstallKind::Rpm
    } else {
        InstallKind::Deb
    };

    if !command_exists("pkexec") {
        spawn_xdg_open(&target).map_err(|e| format!("pkexec tidak tersedia dan {}", e))?;
        return Ok(InstallPackageResult {
            status: InstallResultStatus::FallbackOpened,
            message: "pkexec tidak tersedia. Berkas installer dibuka melalui Software Center sistem.".into(),
        });
    }

    let args = build_linux_install_args(
        kind,
        &target_str,
        command_exists("dnf"),
        command_exists("zypper"),
        command_exists("rpm"),
        command_exists("apt-get"),
    )
    .ok_or_else(|| "Package manager yang cocok untuk paket Linux ini tidak ditemukan.".to_string())?;

    let output = tokio::task::spawn_blocking(move || Command::new("pkexec").args(&args).output())
        .await
        .map_err(|e| format!("Gagal menjalankan task instalasi: {}", e))?
        .map_err(|e| format!("Gagal memanggil pkexec: {}", e))?;

    if !output.status.success() {
        let code = output.status.code().unwrap_or(-1);
        // Polkit mengembalikan 126 saat user membatalkan dialog autentikasi atau 127 jika auth gagal
        if code == 126 || code == 127 {
            return Ok(InstallPackageResult {
                status: InstallResultStatus::Cancelled,
                message: "Autentikasi sistem dibatalkan. Anda dapat mencoba lagi atau membuka installer secara manual."
                    .into(),
            });
        }
        let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
        let detail = if stderr.is_empty() {
            format!("Proses instalasi keluar dengan kode {}.", code)
        } else {
            stderr
        };
        return Err(format!("Instalasi paket gagal: {}", detail));
    }

    // Hapus berkas sementara setelah instalasi sukses
    let _ = fs::remove_file(&target);

    let relaunch_exe = resolve_relaunch_executable();
    spawn_clean_relaunch_helper(&relaunch_exe)?;

    // Keluar dari proses setelah jeda singkat agar response IPC terkirim ke frontend
    let app_clone = app.clone();
    tauri::async_runtime::spawn(async move {
        tokio::time::sleep(std::time::Duration::from_millis(180)).await;
        app_clone.exit(0);
    });

    Ok(InstallPackageResult {
        status: InstallResultStatus::Relaunching,
        message: "Pembaruan berhasil dipasang. Membuka ulang trawangan...".into(),
    })
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_sha256_manifest_formats() {
        let sample = "\
# Komentar diabaikan
e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855  trawangan-0.49.0-1.x86_64.rpm
0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef *./trawangan_0.49.0_amd64.deb
INVALIDHASH  trawangan_0.49.0_amd64.AppImage
";
        assert_eq!(
            parse_sha256_manifest(sample, "trawangan-0.49.0-1.x86_64.rpm").as_deref(),
            Some("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855")
        );
        assert_eq!(
            parse_sha256_manifest(sample, "trawangan_0.49.0_amd64.deb").as_deref(),
            Some("0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef")
        );
        assert_eq!(parse_sha256_manifest(sample, "trawangan_0.49.0_amd64.AppImage"), None);
        assert_eq!(parse_sha256_manifest(sample, "tidak-ada.rpm"), None);
    }

    #[test]
    fn test_validate_release_url_and_filename() {
        assert!(validate_release_url(
            "https://github.com/KaleksananBarqi/trawangan/releases/download/v0.49.0/trawangan-0.49.0-1.x86_64.rpm"
        )
        .is_ok());
        assert!(validate_release_url("https://evil.example.com/trawangan.rpm").is_err());

        assert!(validate_package_filename("trawangan-0.49.0-1.x86_64.rpm").is_ok());
        assert!(validate_package_filename("trawangan_0.49.0_amd64.deb").is_ok());
        assert!(validate_package_filename("../evil.rpm").is_err());
        assert!(validate_package_filename("foo/bar.rpm").is_err());
        assert!(validate_package_filename("trawangan.exe").is_err());
    }

    #[test]
    fn test_build_linux_install_args_priority() {
        let fedora_args = build_linux_install_args(InstallKind::Rpm, "/tmp/pkg.rpm", true, false, true, false).unwrap();
        assert_eq!(fedora_args, vec!["dnf", "install", "-y", "/tmp/pkg.rpm"]);

        let suse_args = build_linux_install_args(InstallKind::Rpm, "/tmp/pkg.rpm", false, true, true, false).unwrap();
        assert_eq!(
            suse_args,
            vec![
                "zypper",
                "--non-interactive",
                "install",
                "--allow-unsigned-rpm",
                "/tmp/pkg.rpm"
            ]
        );

        let generic_rpm =
            build_linux_install_args(InstallKind::Rpm, "/tmp/pkg.rpm", false, false, true, false).unwrap();
        assert_eq!(generic_rpm, vec!["rpm", "-Uvh", "--replacepkgs", "/tmp/pkg.rpm"]);

        let deb_args = build_linux_install_args(InstallKind::Deb, "/tmp/pkg.deb", false, false, false, true).unwrap();
        assert_eq!(deb_args, vec!["apt-get", "install", "-y", "/tmp/pkg.deb"]);

        assert!(build_linux_install_args(InstallKind::Deb, "/tmp/pkg.deb", true, false, false, false).is_none());
    }
}
