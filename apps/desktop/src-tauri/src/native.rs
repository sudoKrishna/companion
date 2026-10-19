use base64::{engine::general_purpose::STANDARD, Engine};
use serde::Serialize;
use std::{fs, path::Path, process::Command};
use tauri::AppHandle;
use tauri_plugin_autostart::ManagerExt;

#[derive(Serialize, Debug)]
#[serde(rename_all = "camelCase")]
pub struct CaptureResult {
    pub text: String,
    pub image_base64: String,
}

/// Screen capture goes through the XDG desktop portal, which is the only way to
/// capture a Wayland session. Everything else the companion can do lives in the
/// TypeScript server.
#[tauri::command]
pub async fn capture_screen() -> Result<CaptureResult, String> {
    use ashpd::desktop::screenshot::Screenshot;

    let response = Screenshot::request()
        .interactive(false)
        .modal(true)
        .send()
        .await
        .map_err(|err| format!("screenshot portal request failed: {err}"))?
        .response()
        .map_err(|err| format!("screenshot was not granted: {err}"))?;

    let path = response
        .uri()
        .to_file_path()
        .map_err(|_| "screenshot portal returned an unusable path".to_string())?;

    let bytes = fs::read(&path).map_err(|err| format!("could not read screenshot: {err}"))?;

    let text = match ocr(&path) {
        Some(ocr_text) if !ocr_text.trim().is_empty() => {
            format!("Screenshot captured. Text read from the screen:\n\n{ocr_text}")
        }
        _ => "Screenshot captured and shown to the user. You cannot see the image itself — the \
              chat model is text-only and OCR is unavailable (install tesseract to read screen \
              text). Ask the user what they want you to do with it."
            .to_string(),
    };

    let _ = fs::remove_file(&path);

    Ok(CaptureResult {
        text,
        image_base64: STANDARD.encode(bytes),
    })
}

fn ocr(path: &Path) -> Option<String> {
    let output = Command::new("tesseract").arg(path).arg("stdout").output().ok()?;

    output
        .status
        .success()
        .then(|| String::from_utf8_lossy(&output.stdout).chars().take(10_000).collect())
}

#[tauri::command]
pub fn active_window() -> Result<String, String> {
    if let Some(details) = x11_active_window() {
        return Ok(details);
    }

    Ok("The focused window is not available: this is a GNOME Wayland session, which does not \
        expose the active window to applications. Ask the user what they are working on, or use \
        capture_screen with their approval."
        .to_string())
}

fn x11_active_window() -> Option<String> {
    let root = Command::new("xprop")
        .args(["-root", "_NET_ACTIVE_WINDOW"])
        .output()
        .ok()?;

    let root_text = String::from_utf8_lossy(&root.stdout);
    let window_id = root_text.split("# ").nth(1)?.trim().trim_end_matches(',');

    if window_id == "0x0" {
        return None;
    }

    let props = Command::new("xprop")
        .args(["-id", window_id, "_NET_WM_NAME", "WM_CLASS"])
        .output()
        .ok()?;

    let text = String::from_utf8_lossy(&props.stdout);
    if text.contains("not found") || text.trim().is_empty() {
        return None;
    }

    Some(text.trim().to_string())
}

#[tauri::command]
pub fn set_autostart(app: AppHandle, enabled: bool) -> Result<bool, String> {
    let manager = app.autolaunch();

    if enabled {
        manager.enable().map_err(|err| err.to_string())?;
    } else {
        manager.disable().map_err(|err| err.to_string())?;
    }

    Ok(enabled)
}

/// The frontend passes this token to the TypeScript server so that other local
/// processes cannot drive the tool executor over HTTP.
#[tauri::command]
pub fn app_token(token: tauri::State<'_, AppToken>) -> String {
    token.0.clone()
}

pub struct AppToken(pub String);

pub fn generate_token() -> String {
    use std::io::Read;

    let mut bytes = [0u8; 24];
    match fs::File::open("/dev/urandom").and_then(|mut file| file.read_exact(&mut bytes)) {
        Ok(()) => bytes.iter().map(|byte| format!("{byte:02x}")).collect(),
        Err(_) => "companion-fallback-token".into(),
    }
}
