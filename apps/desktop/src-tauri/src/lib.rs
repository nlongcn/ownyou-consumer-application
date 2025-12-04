//! OwnYou Desktop Application - Tauri Backend
//!
//! This module handles:
//! - Deep link protocol (ownyou://) for OAuth callbacks
//! - OAuth authentication for Microsoft and Google (Sprint 1b)
//! - Integration with Sprint 0 packages via JS bindings

pub mod oauth;

use oauth::{OAuthClient, OAuthProvider, TokenData, is_token_expired};
use oauth2::PkceCodeVerifier;
use std::sync::Mutex;
use tauri::{Emitter, Listener, State};

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

/// Greet command - example Tauri command
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! Welcome to OwnYou Desktop.", name)
}

/// Initialize OAuth flow and return authorization URL
///
/// Opens system browser to OAuth provider's login page.
/// Returns the authorization URL to open.
#[tauri::command]
async fn start_oauth(
    provider: OAuthProvider,
    client_id: String,
    redirect_uri: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let oauth_client = OAuthClient::new(provider, client_id, None, redirect_uri)
        .map_err(|e| e.to_string())?;

    let (auth_url, pkce_verifier, csrf_token) = oauth_client
        .get_authorization_url()
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

    Ok(auth_url)
}

/// Complete OAuth flow by exchanging authorization code for tokens
///
/// Called when deep link callback is received (ownyou://oauth/callback?code=...)
#[tauri::command]
async fn complete_oauth(
    provider: OAuthProvider,
    client_id: String,
    redirect_uri: String,
    code: String,
    received_state: Option<String>,
    state: State<'_, AppState>,
) -> Result<TokenData, String> {
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

/// Main library entry point for Tauri
#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            microsoft_pkce_verifier: Mutex::new(None),
            google_pkce_verifier: Mutex::new(None),
            microsoft_csrf_state: Mutex::new(None),
            google_csrf_state: Mutex::new(None),
        })
        .plugin(tauri_plugin_deep_link::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
        .setup(|app| {
            // Log when OAuth is ready
            #[cfg(debug_assertions)]
            println!("OwnYou Desktop initialized with OAuth support (Sprint 1b)");

            // On macOS, we need to handle deep links that arrive when app is already running
            #[cfg(target_os = "macos")]
            {
                let handle = app.handle().clone();
                app.listen("deep-link://new-url", move |event| {
                    let payload = event.payload();
                    println!("Deep link received: {}", payload);
                    // Emit to frontend for OAuth callback handling
                    let _ = handle.emit("deep-link-received", payload);
                });
            }

            Ok(())
        })
        .invoke_handler(tauri::generate_handler![
            greet,
            start_oauth,
            complete_oauth,
            refresh_access_token,
            check_token_expiration
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
