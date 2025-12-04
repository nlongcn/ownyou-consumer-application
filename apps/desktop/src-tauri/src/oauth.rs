//! OAuth module for OwnYou Desktop - Sprint 1b
//!
//! Implements Microsoft and Google OAuth with PKCE for desktop authentication.
//! Uses custom protocol (ownyou://) for 90-day refresh tokens.

use serde::{Deserialize, Serialize};
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use oauth2::basic::BasicClient;
use oauth2::reqwest::async_http_client;
use chrono::Utc;
use std::error::Error;

// Microsoft OAuth endpoints
const MS_AUTH_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const MS_TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

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

/// Token storage structure (matches @ownyou/oauth StoredTokens)
#[derive(Debug, Serialize, Deserialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: i64, // Unix timestamp in milliseconds (matches JS Date.now())
    pub scope: String,
    pub token_type: String,
}

/// OAuth client that works for both Microsoft and Google
pub struct OAuthClient {
    provider: OAuthProvider,
    client_id: String,
    redirect_uri: String,
    oauth_client: BasicClient,
}

impl OAuthClient {
    /// Create a new OAuth client
    pub fn new(
        provider: OAuthProvider,
        client_id: String,
        client_secret: Option<String>,
        redirect_uri: String,
    ) -> Result<Self, Box<dyn Error>> {
        let (auth_url, token_url) = match provider {
            OAuthProvider::Microsoft => (MS_AUTH_URL, MS_TOKEN_URL),
            OAuthProvider::Google => (GOOGLE_AUTH_URL, GOOGLE_TOKEN_URL),
        };

        let auth_url = AuthUrl::new(auth_url.to_string())?;
        let token_url = TokenUrl::new(token_url.to_string())?;

        let oauth_client = BasicClient::new(
            ClientId::new(client_id.clone()),
            client_secret.map(ClientSecret::new),
            auth_url,
            Some(token_url),
        )
        .set_redirect_uri(RedirectUrl::new(redirect_uri.clone())?);

        Ok(Self {
            provider,
            client_id,
            redirect_uri,
            oauth_client,
        })
    }

    /// Generate authorization URL with PKCE
    pub fn get_authorization_url(&self) -> Result<(String, PkceCodeVerifier, CsrfToken), Box<dyn Error>> {
        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let mut auth_builder = self.oauth_client
            .authorize_url(CsrfToken::new_random)
            .set_pkce_challenge(pkce_challenge);

        // Add provider-specific scopes
        match self.provider {
            OAuthProvider::Microsoft => {
                auth_builder = auth_builder
                    .add_scope(Scope::new("offline_access".to_string()))
                    .add_scope(Scope::new("https://graph.microsoft.com/Mail.Read".to_string()))
                    .add_scope(Scope::new("https://graph.microsoft.com/User.Read".to_string()));
            }
            OAuthProvider::Google => {
                auth_builder = auth_builder
                    .add_scope(Scope::new("https://www.googleapis.com/auth/gmail.readonly".to_string()))
                    .add_scope(Scope::new("https://www.googleapis.com/auth/userinfo.email".to_string()));
            }
        }

        let (auth_url, csrf_token) = auth_builder.url();

        // For Google, add access_type=offline and prompt=consent for refresh token
        let mut url_string = auth_url.to_string();
        if self.provider == OAuthProvider::Google {
            url_string = format!("{}&access_type=offline&prompt=consent", url_string);
        }

        Ok((url_string, pkce_verifier, csrf_token))
    }

    /// Exchange authorization code for tokens
    pub async fn exchange_code(
        &self,
        code: String,
        pkce_verifier: PkceCodeVerifier,
    ) -> Result<TokenData, Box<dyn Error>> {
        let token_result = self.oauth_client
            .exchange_code(AuthorizationCode::new(code))
            .set_pkce_verifier(pkce_verifier)
            .request_async(async_http_client)
            .await
            .map_err(|e| {
                eprintln!("[OAuth] Token exchange error: {:?}", e);
                format!("Token exchange failed: {:?}", e)
            })?;

        let access_token = token_result.access_token().secret().to_string();
        let refresh_token = token_result
            .refresh_token()
            .ok_or("No refresh token received")?
            .secret()
            .to_string();

        // Use actual expires_in from token response, fallback to 1 hour if not provided
        let expires_in_secs = token_result
            .expires_in()
            .map(|d| d.as_secs() as i64)
            .unwrap_or(3600);

        // Convert to JS-compatible milliseconds timestamp
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
            refresh_token,
            expires_at,
            scope,
            token_type: "Bearer".to_string(),
        })
    }

    /// Refresh access token using refresh token
    pub async fn refresh_token(&self, refresh_token: String) -> Result<TokenData, Box<dyn Error>> {
        let refresh_token_clone = refresh_token.clone();
        let token_result = self.oauth_client
            .exchange_refresh_token(&oauth2::RefreshToken::new(refresh_token))
            .request_async(async_http_client)
            .await?;

        let access_token = token_result.access_token().secret().to_string();
        let new_refresh_token = token_result
            .refresh_token()
            .map(|t| t.secret().to_string())
            .unwrap_or(refresh_token_clone);

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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_token_expiration() {
        let expired_token = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now().timestamp_millis() - 3600000, // 1 hour ago
            scope: "test".to_string(),
            token_type: "Bearer".to_string(),
        };
        assert!(is_token_expired(&expired_token));

        let valid_token = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now().timestamp_millis() + (30 * 24 * 3600000), // 30 days ahead
            scope: "test".to_string(),
            token_type: "Bearer".to_string(),
        };
        assert!(!is_token_expired(&valid_token));
    }

    #[test]
    fn test_oauth_client_creation_microsoft() {
        let client = OAuthClient::new(
            OAuthProvider::Microsoft,
            "test-client-id".to_string(),
            None,
            "ownyou://oauth/callback".to_string(),
        );
        assert!(client.is_ok());
    }

    #[test]
    fn test_oauth_client_creation_google() {
        let client = OAuthClient::new(
            OAuthProvider::Google,
            "test-client-id".to_string(),
            None,
            "ownyou://oauth/callback".to_string(),
        );
        assert!(client.is_ok());
    }

    #[test]
    fn test_authorization_url_generation_microsoft() {
        let client = OAuthClient::new(
            OAuthProvider::Microsoft,
            "test-client-id".to_string(),
            None,
            "ownyou://oauth/callback".to_string(),
        ).unwrap();

        let result = client.get_authorization_url();
        assert!(result.is_ok());

        let (auth_url, _pkce_verifier, _csrf_token) = result.unwrap();
        assert!(auth_url.contains("login.microsoftonline.com"));
        assert!(auth_url.contains("client_id=test-client-id"));
        assert!(auth_url.contains("offline_access"));
    }

    #[test]
    fn test_authorization_url_generation_google() {
        let client = OAuthClient::new(
            OAuthProvider::Google,
            "test-client-id".to_string(),
            None,
            "ownyou://oauth/callback".to_string(),
        ).unwrap();

        let result = client.get_authorization_url();
        assert!(result.is_ok());

        let (auth_url, _pkce_verifier, _csrf_token) = result.unwrap();
        assert!(auth_url.contains("accounts.google.com"));
        assert!(auth_url.contains("access_type=offline"));
        assert!(auth_url.contains("prompt=consent"));
    }
}
