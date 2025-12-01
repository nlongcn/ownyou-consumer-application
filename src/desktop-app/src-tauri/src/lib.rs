pub mod oauth;

use oauth::{MsalClient, TokenData, is_token_expired};
use oauth2::PkceCodeVerifier;
use std::sync::Mutex;
use tauri::State;

// Global state for PKCE verifier
struct AppState {
    pkce_verifier: Mutex<Option<PkceCodeVerifier>>,
}

// Learn more about Tauri commands at https://tauri.app/develop/calling-rust/
#[tauri::command]
fn greet(name: &str) -> String {
    format!("Hello, {}! You've been greeted from Rust!", name)
}

/// Initialize OAuth flow and return authorization URL
#[tauri::command]
async fn start_oauth(
    client_id: String,
    client_secret: Option<String>,
    redirect_uri: String,
    state: State<'_, AppState>,
) -> Result<String, String> {
    let msal_client = MsalClient::new(client_id, client_secret, redirect_uri)
        .map_err(|e| e.to_string())?;

    let (auth_url, pkce_verifier, _csrf_token) = msal_client
        .get_authorization_url()
        .map_err(|e| e.to_string())?;

    // Store PKCE verifier for later use
    let mut verifier_lock = state.pkce_verifier.lock().unwrap();
    *verifier_lock = Some(pkce_verifier);

    Ok(auth_url)
}

/// Complete OAuth flow by exchanging authorization code for tokens
#[tauri::command]
async fn complete_oauth(
    client_id: String,
    client_secret: Option<String>,
    redirect_uri: String,
    code: String,
    state: State<'_, AppState>,
) -> Result<TokenData, String> {
    let msal_client = MsalClient::new(client_id, client_secret, redirect_uri)
        .map_err(|e| e.to_string())?;

    // Retrieve stored PKCE verifier
    let pkce_verifier = {
        let mut verifier_lock = state.pkce_verifier.lock().unwrap();
        verifier_lock.take().ok_or("No PKCE verifier found")?
    };

    let token_data = msal_client
        .exchange_code(code, pkce_verifier)
        .await
        .map_err(|e| e.to_string())?;

    // Return token data - storage handled by frontend using Tauri Store plugin
    Ok(token_data)
}

/// Refresh access token
#[tauri::command]
async fn refresh_access_token(
    client_id: String,
    client_secret: Option<String>,
    redirect_uri: String,
    refresh_token: String,
) -> Result<TokenData, String> {
    let msal_client = MsalClient::new(client_id, client_secret, redirect_uri)
        .map_err(|e| e.to_string())?;

    let new_token = msal_client
        .refresh_token(refresh_token)
        .await
        .map_err(|e| e.to_string())?;

    // Return new token data - storage handled by frontend
    Ok(new_token)
}

/// Check if token is expired
#[tauri::command]
fn check_token_expiration(token_data: TokenData) -> Result<bool, String> {
    Ok(is_token_expired(&token_data))
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(AppState {
            pkce_verifier: Mutex::new(None),
        })
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_store::Builder::default().build())
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
