//! OAuth module for OwnYou Consumer App
//!
//! Implements Microsoft and Google OAuth with PKCE for desktop authentication.
//! Uses Rust HTTP client to avoid CORS issues with WebView token exchange.
//! Uses custom protocol (ownyou://) for OAuth callbacks.

use serde::{Deserialize, Serialize};
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use oauth2::basic::BasicClient;
use oauth2::reqwest::async_http_client;
use chrono::Utc;
use std::error::Error;

// Microsoft OAuth endpoints (using "consumers" for personal accounts)
const MS_AUTH_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/consumers/oauth2/v2.0/token";

// Google OAuth endpoints
const GOOGLE_AUTH_URL: &str = "https://accounts.google.com/o/oauth2/v2/auth";
const GOOGLE_TOKEN_URL: &str = "https://oauth2.googleapis.com/token";

/// Provider type for OAuth
#[derive(Debug, Clone, Copy, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum OAuthProvider {
    Microsoft,
    Google,
}

/// Token storage structure
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: Option<String>,
    pub expires_at: i64, // Unix timestamp in milliseconds
    pub scope: String,
    pub token_type: String,
}

/// OAuth client that works for both Microsoft and Google
pub struct OAuthClient {
    provider: OAuthProvider,
    oauth_client: BasicClient,
}

impl OAuthClient {
    /// Create a new OAuth client
    pub fn new(
        provider: OAuthProvider,
        client_id: String,
        client_secret: Option<String>,
        redirect_uri: String,
    ) -> Result<Self, Box<dyn Error + Send + Sync>> {
        let (auth_url, token_url) = match provider {
            OAuthProvider::Microsoft => (MS_AUTH_URL, MS_TOKEN_URL),
            OAuthProvider::Google => (GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL),
        };

        let auth_url = AuthUrl::new(auth_url.to_string())?;
        let token_url = TokenUrl::new(token_url.to_string())?;

        let oauth_client = BasicClient::new(
            ClientId::new(client_id),
            client_secret.map(ClientSecret::new),
            auth_url,
            Some(token_url),
        )
        .set_redirect_uri(RedirectUrl::new(redirect_uri)?);

        Ok(Self {
            provider,
            oauth_client,
        })
    }

    /// Generate authorization URL with PKCE
    pub fn get_authorization_url(&self, scopes: Vec<String>) -> Result<(String, PkceCodeVerifier, CsrfToken), Box<dyn Error + Send + Sync>> {
        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let mut auth_builder = self.oauth_client
            .authorize_url(CsrfToken::new_random)
            .set_pkce_challenge(pkce_challenge);

        // Add requested scopes
        for scope in scopes {
            auth_builder = auth_builder.add_scope(Scope::new(scope));
        }

        let (auth_url, csrf_token) = auth_builder.url();

        // For Google, add access_type=offline and prompt=consent for refresh token
        let mut url_string = auth_url.to_string();
        if self.provider == OAuthProvider::Google {
            url_string = format!("{}&access_type=offline&prompt=consent", url_string);
        }

        Ok((url_string, pkce_verifier, csrf_token))
    }

    /// Exchange authorization code for tokens (happens in Rust, no CORS issues)
    pub async fn exchange_code(
        &self,
        code: String,
        pkce_verifier: PkceCodeVerifier,
    ) -> Result<TokenData, Box<dyn Error + Send + Sync>> {
        log::info!("[OAuth Rust] Exchanging code for token via Rust HTTP client");

        let token_result = self.oauth_client
            .exchange_code(AuthorizationCode::new(code))
            .set_pkce_verifier(pkce_verifier)
            .request_async(async_http_client)
            .await
            .map_err(|e| {
                log::error!("[OAuth Rust] Token exchange error: {:?}", e);
                format!("Token exchange failed: {:?}", e)
            })?;

        let access_token = token_result.access_token().secret().to_string();
        let refresh_token = token_result
            .refresh_token()
            .map(|t| t.secret().to_string());

        let expires_in_secs = token_result
            .expires_in()
            .map(|d| d.as_secs() as i64)
            .unwrap_or(3600);

        let expires_at = Utc::now().timestamp_millis() + (expires_in_secs * 1000);

        let scope = token_result
            .scopes()
            .map(|scopes| {
                scopes
                    .iter()
                    .map(|s| s.as_str())
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();

        log::info!("[OAuth Rust] Token exchange successful");

        Ok(TokenData {
            access_token,
            refresh_token,
            expires_at,
            scope,
            token_type: "Bearer".to_string(),
        })
    }

    /// Refresh access token using refresh token
    pub async fn refresh_token(&self, refresh_token: String) -> Result<TokenData, Box<dyn Error + Send + Sync>> {
        let refresh_token_clone = refresh_token.clone();
        let token_result = self.oauth_client
            .exchange_refresh_token(&oauth2::RefreshToken::new(refresh_token))
            .request_async(async_http_client)
            .await?;

        let access_token = token_result.access_token().secret().to_string();
        let new_refresh_token = token_result
            .refresh_token()
            .map(|t| t.secret().to_string())
            .or(Some(refresh_token_clone));

        let expires_in_secs = token_result
            .expires_in()
            .map(|d| d.as_secs() as i64)
            .unwrap_or(3600);

        let expires_at = Utc::now().timestamp_millis() + (expires_in_secs * 1000);

        let scope = token_result
            .scopes()
            .map(|scopes| {
                scopes
                    .iter()
                    .map(|s| s.as_str())
                    .collect::<Vec<_>>()
                    .join(" ")
            })
            .unwrap_or_default();

        Ok(TokenData {
            access_token,
            refresh_token: new_refresh_token,
            expires_at,
            scope,
            token_type: "Bearer".to_string(),
        })
    }
}

/// Check if token is expired or about to expire (within 5 minutes)
pub fn is_token_expired(token_data: &TokenData) -> bool {
    let now = Utc::now().timestamp_millis();
    let buffer = 5 * 60 * 1000; // 5 minutes in milliseconds
    token_data.expires_at <= now + buffer
}
