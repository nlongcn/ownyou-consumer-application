//! OwnYou Desktop Application - Tauri Backend
//!
//! This module handles:
//! - Deep link protocol (ownyou://) for OAuth callbacks
//! - Integration with Sprint 0 packages via JS bindings

use tauri::Manager;

/// Greet command - example Tauri command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to OwnYou Desktop.", name)
}

/// Main library entry point for Tauri
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_deep_link::init())
        .setup(|app| {
            // Log when deep link plugin is ready
            #[cfg(debug_assertions)]
            println!("OwnYou Desktop initialized with deep-link plugin");

            // On macOS, we need to handle deep links that arrive when app is already running
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event| {
                    if let Some(urls) = event.payload() {
                        println!("Deep link received: {}", urls);
                        // Emit to frontend
                        let _ = handle.emit("deep-link-received", urls);
                    }
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![greet])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
