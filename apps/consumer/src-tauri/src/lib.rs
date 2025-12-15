//! OwnYou Consumer App - Tauri Backend
//!
//! This module handles:
//! - Deep link protocol (ownyou://) for OAuth callbacks
//! - OAuth authentication for Microsoft and Google (Rust-based to avoid CORS)
//! - Single instance management

pub mod oauth;

use oauth::{OAuthClient, OAuthProvider, TokenData, is_token_expired};
use oauth2::PkceCodeVerifier;
use std::sync::Mutex;
use std::time::Duration;
use tauri::{Manager, Emitter, State};
use once_cell::sync::Lazy;

/// Sprint 11b: Singleton HTTP client with connection pooling
///
/// Benefits:
/// - Reuses TCP connections (avoids handshake overhead)
/// - Connection pool maintains up to 10 idle connections per host
/// - 90 second idle timeout matches typical LLM API response times
///
/// Reference: https://docs.rs/reqwest/latest/reqwest/struct.ClientBuilder.html
static HTTP_CLIENT: Lazy<reqwest::Client> = Lazy::new(|| {
    reqwest::Client::builder()
        .pool_idle_timeout(Duration::from_secs(90))
        .pool_max_idle_per_host(10)
        .timeout(Duration::from_secs(60))
        .build()
        .expect("Failed to create HTTP client")
});

/// Application state for OAuth flow
struct AppState {
    /// PKCE verifier for Microsoft OAuth
    microsoft_pkce_verifier: Mutex<Option<PkceCodeVerifier>>,
    /// PKCE verifier for Google OAuth
    google_pkce_verifier: Mutex<Option<PkceCodeVerifier>>,
    /// CSRF state for Microsoft OAuth
    microsoft_csrf_state: Mutex<Option<String>>,
    /// CSRF state for Google OAuth
    google_csrf_state: Mutex<Option<String>>,
}

/// Initialize OAuth flow and return authorization URL
#[tauri::command]
async fn start_oauth(
    provider: OAuthProvider,
    client_id: String,
    redirect_uri: String,
    scopes: Vec<String>,
    state: State<'_, AppState>,
) -> Result<String, String> {
    log::info!("[OAuth] start_oauth called for {:?}", provider);

    let oauth_client = OAuthClient::new(provider, client_id, None, redirect_uri)
        .map_err(|e| e.to_string())?;

    let (auth_url, pkce_verifier, csrf_token) = oauth_client
        .get_authorization_url(scopes)
        .map_err(|e| e.to_string())?;

    // Store PKCE verifier and CSRF state based on provider
    match provider {
        OAuthProvider::Microsoft => {
            let mut verifier_lock = state.microsoft_pkce_verifier.lock().unwrap();
            *verifier_lock = Some(pkce_verifier);
            let mut csrf_lock = state.microsoft_csrf_state.lock().unwrap();
            *csrf_lock = Some(csrf_token.secret().clone());
        }
        OAuthProvider::Google => {
            let mut verifier_lock = state.google_pkce_verifier.lock().unwrap();
            *verifier_lock = Some(pkce_verifier);
            let mut csrf_lock = state.google_csrf_state.lock().unwrap();
            *csrf_lock = Some(csrf_token.secret().clone());
        }
    }

    log::info!("[OAuth] Authorization URL generated, PKCE verifier stored");
    Ok(auth_url)
}

/// Complete OAuth flow by exchanging authorization code for tokens
/// This happens in Rust to avoid CORS issues
#[tauri::command]
async fn complete_oauth(
    provider: OAuthProvider,
    client_id: String,
    redirect_uri: String,
    code: String,
    received_state: Option<String>,
    state: State<'_, AppState>,
) -> Result<TokenData, String> {
    log::info!("[OAuth] complete_oauth called for {:?}", provider);

    // Verify CSRF state if provided
    let expected_state = match provider {
        OAuthProvider::Microsoft => {
            let csrf_lock = state.microsoft_csrf_state.lock().unwrap();
            csrf_lock.clone()
        }
        OAuthProvider::Google => {
            let csrf_lock = state.google_csrf_state.lock().unwrap();
            csrf_lock.clone()
        }
    };

    if let Some(ref received) = received_state {
        if let Some(ref expected) = expected_state {
            if received != expected {
                log::warn!("[OAuth] CSRF state mismatch");
                return Err("CSRF state mismatch - possible attack".to_string());
            }
        }
    }

    let oauth_client = OAuthClient::new(provider, client_id, None, redirect_uri)
        .map_err(|e| e.to_string())?;

    // Retrieve stored PKCE verifier based on provider
    let pkce_verifier = match provider {
        OAuthProvider::Microsoft => {
            let mut verifier_lock = state.microsoft_pkce_verifier.lock().unwrap();
            verifier_lock.take().ok_or("No PKCE verifier found for Microsoft")?
        }
        OAuthProvider::Google => {
            let mut verifier_lock = state.google_pkce_verifier.lock().unwrap();
            verifier_lock.take().ok_or("No PKCE verifier found for Google")?
        }
    };

    log::info!("[OAuth] Exchanging code for token via Rust HTTP client...");

    let token_data = oauth_client
        .exchange_code(code, pkce_verifier)
        .await
        .map_err(|e| e.to_string())?;

    // Clear CSRF state
    match provider {
        OAuthProvider::Microsoft => {
            let mut csrf_lock = state.microsoft_csrf_state.lock().unwrap();
            *csrf_lock = None;
        }
        OAuthProvider::Google => {
            let mut csrf_lock = state.google_csrf_state.lock().unwrap();
            *csrf_lock = None;
        }
    }

    log::info!("[OAuth] Token exchange successful");
    Ok(token_data)
}

/// Refresh access token using refresh token
#[tauri::command]
async fn refresh_access_token(
    provider: OAuthProvider,
    client_id: String,
    redirect_uri: String,
    refresh_token: String,
) -> Result<TokenData, String> {
    let oauth_client = OAuthClient::new(provider, client_id, None, redirect_uri)
        .map_err(|e| e.to_string())?;

    let new_token = oauth_client
        .refresh_token(refresh_token)
        .await
        .map_err(|e| e.to_string())?;

    Ok(new_token)
}

/// Check if token is expired
#[tauri::command]
fn check_token_expiration(token_data: TokenData) -> Result<bool, String> {
    Ok(is_token_expired(&token_data))
}

use std::collections::HashMap;

/// Proxy HTTP request via Rust backend to bypass browser limits
///
/// Sprint 11b: Now uses singleton HTTP_CLIENT with connection pooling
/// for better performance on repeated requests (e.g., LLM API calls)
#[tauri::command]
async fn http_request(
    method: String,
    url: String,
    headers: Option<HashMap<String, String>>,
    body: Option<String>,
) -> Result<String, String> {
    // Use singleton client with connection pooling (Sprint 11b)
    let client = &*HTTP_CLIENT;

    let method = match method.to_uppercase().as_str() {
        "GET" => reqwest::Method::GET,
        "POST" => reqwest::Method::POST,
        "PUT" => reqwest::Method::PUT,
        "DELETE" => reqwest::Method::DELETE,
        "PATCH" => reqwest::Method::PATCH,
        "HEAD" => reqwest::Method::HEAD,
        "OPTIONS" => reqwest::Method::OPTIONS,
        _ => return Err(format!("Unsupported method: {}", method)),
    };

    let mut request = client.request(method, &url);

    if let Some(h) = headers {
        for (k, v) in h {
            request = request.header(&k, &v);
        }
    }

    if let Some(b) = body {
        request = request.body(b);
    }

    let response = request
        .send()
        .await
        .map_err(|e| format!("Request failed: {}", e))?;

    let status = response.status().as_u16();
    let text = response.text().await.map_err(|e| format!("Failed to read body: {}", e))?;

    // Return simple JSON structure
    let result = serde_json::json!({
        "status": status,
        "data": text
    });

    Ok(result.to_string())
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            microsoft_pkce_verifier: Mutex::new(None),
            google_pkce_verifier: Mutex::new(None),
            microsoft_csrf_state: Mutex::new(None),
            google_csrf_state: Mutex::new(None),
        })
        // IMPORTANT: Single instance plugin MUST be registered first
        .plugin(tauri_plugin_single_instance::init(|app, argv, _cwd| {
            // When a second instance is launched with a deep link URL, emit it to the frontend
            log::info!("Single instance received argv: {:?}", argv);

            // On macOS, deep link URLs come through argv when another instance tries to open
            for arg in argv.iter().skip(1) {
                if arg.starts_with("ownyou://") {
                    log::info!("Deep link from secondary instance: {}", arg);
                    if let Err(e) = app.emit("deep-link-received", vec![arg.clone()]) {
                        log::error!("Failed to emit deep-link-received event: {}", e);
                    }
                }
            }

            // Focus the existing window
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.set_focus();
                let _ = window.unminimize();
            }
        }))
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_http::init())
        .invoke_handler(tauri::generate_handler![
            start_oauth,
            complete_oauth,
            refresh_access_token,
            check_token_expiration,
            http_request
        ])
        // ALWAYS enable logging (both debug and release builds)
        // Logs written to repo: apps/consumer/logs/
        .plugin(
            tauri_plugin_log::Builder::default()
                .level(log::LevelFilter::Debug)  // Capture all levels
                .max_file_size(10_000_000)       // 10MB per log file
                .rotation_strategy(tauri_plugin_log::RotationStrategy::KeepAll)
                .target(tauri_plugin_log::Target::new(
                    tauri_plugin_log::TargetKind::Folder {
                        path: std::path::PathBuf::from("/Volumes/T7_new/developer_old/ownyou_consumer_application/apps/consumer/logs"),
                        file_name: Some("ownyou".into()),
                    }
                ))
                .build(),
        )
        .setup(|app| {
            // Open devtools in debug builds only
            if cfg!(debug_assertions) {
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            log::info!("[App] OwnYou started - logs at apps/consumer/logs/ownyou.log");
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
