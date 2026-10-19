use std::{
    net::TcpStream,
    process::{Child, Command, Stdio},
    sync::Mutex,
};
use tauri::{
    menu::{Menu, MenuItem},
    tray::TrayIconBuilder,
    Manager, RunEvent, WindowEvent,
};
use tauri_plugin_autostart::MacosLauncher;

mod native;

struct AiServer(Mutex<Option<Child>>);

fn reveal(app: &tauri::AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        let _ = window.show();
        let _ = window.unminimize();
        let _ = window.set_focus();
    }
}

fn toggle(app: &tauri::AppHandle, label: &str) {
    if let Some(window) = app.get_webview_window(label) {
        if window.is_visible().unwrap_or(false) {
            let _ = window.hide();
        } else {
            reveal(app, label);
        }
    }
}

/// Starts the Bun AI server unless something is already serving port 4000.
fn spawn_ai_server(token: &str) -> Option<Child> {
    if TcpStream::connect("127.0.0.1:4000").is_ok() {
        log::info!("ai-server already running on 4000, not spawning one");
        return None;
    }

    let cwd = std::env::current_dir().ok()?;
    let server_dir = ["../../ai-server", "../ai-server", "apps/ai-server"]
        .iter()
        .map(|candidate| cwd.join(candidate))
        .find(|dir| dir.join("src/index.ts").exists())?;

    match Command::new("bun")
        .arg("src/index.ts")
        .current_dir(server_dir)
        .env("COMPANION_TOKEN", token)
        .stdout(Stdio::inherit())
        .stderr(Stdio::inherit())
        .spawn()
    {
        Ok(child) => Some(child),
        Err(err) => {
            log::error!("failed to start ai-server: {err}");
            None
        }
    }
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let app = tauri::Builder::default()
        .plugin(tauri_plugin_autostart::init(
            MacosLauncher::LaunchAgent,
            None,
        ))
        .invoke_handler(tauri::generate_handler![
            native::capture_screen,
            native::active_window,
            native::set_autostart,
            native::app_token,
        ])
        .setup(|app| {
            let token = native::generate_token();
            app.manage(AiServer(Mutex::new(spawn_ai_server(&token))));
            app.manage(native::AppToken(token));

            #[cfg(target_os = "linux")]
            {
                use webkit2gtk::{PermissionRequestExt, SettingsExt, WebViewExt};

                // The orb records and speaks; the dashboard also has a mic button.
                for label in ["orb", "main"] {
                    if let Some(window) = app.get_webview_window(label) {
                        window.with_webview(|webview| {
                            let wv = webview.inner();
                            if let Some(settings) = WebViewExt::settings(&wv) {
                                settings.set_enable_media_stream(true);
                                settings.set_media_playback_requires_user_gesture(false);
                            }
                            wv.connect_permission_request(|_wv, request| {
                                request.allow();
                                true
                            });
                        })?;
                    }
                }
            }
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }

            // --- System tray -------------------------------------------------
            let open = MenuItem::with_id(app, "open", "Open Companion", true, None::<&str>)?;
            let orb = MenuItem::with_id(app, "orb", "Show / hide orb", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let menu = Menu::with_items(app, &[&open, &orb, &quit])?;

            TrayIconBuilder::new()
                .icon(app.default_window_icon().unwrap().clone())
                .menu(&menu)
                .show_menu_on_left_click(false)
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "open" => reveal(app, "main"),
                    "orb" => toggle(app, "orb"),
                    "quit" => app.exit(0),
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let tauri::tray::TrayIconEvent::Click { .. } = event {
                        toggle(tray.app_handle(), "orb");
                    }
                })
                .build(app)?;

            // --- Closing a window hides it instead of quitting ---------------
            for label in ["orb", "main"] {
                if let Some(window) = app.get_webview_window(label) {
                    let w = window.clone();
                    window.on_window_event(move |event| {
                        if let WindowEvent::CloseRequested { api, .. } = event {
                            api.prevent_close();
                            let _ = w.hide();
                        }
                    });
                }
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application");

    app.run(|handle, event| {
        if let RunEvent::Exit = event {
            if let Some(server) = handle.try_state::<AiServer>() {
                if let Some(mut child) = server.0.lock().unwrap().take() {
                    let _ = child.kill();
                }
            }
        }
    });
}