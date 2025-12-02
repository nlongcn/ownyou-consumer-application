use serde::{Deserialize, Serialize};
use oauth2::{
    AuthUrl, AuthorizationCode, ClientId, ClientSecret, CsrfToken, PkceCodeChallenge,
    PkceCodeVerifier, RedirectUrl, Scope, TokenResponse, TokenUrl,
};
use oauth2::basic::BasicClient;
use oauth2::reqwest::async_http_client;
use chrono::{DateTime, Utc, Duration};
use std::error::Error;

// Microsoft OAuth endpoints
const AUTH_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/authorize";
const TOKEN_URL: &str = "https://login.microsoftonline.com/common/oauth2/v2.0/token";

// Token storage structure
#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct TokenData {
    pub access_token: String,
    pub refresh_token: String,
    pub expires_at: DateTime<Utc>,
    pub scope: String,
}

/// OAuth client for Microsoft authentication
pub struct MsalClient {
    client_id: String,
    client_secret: Option<String>,
    redirect_uri: String,
    oauth_client: BasicClient,
}

impl MsalClient {
    /// Create a new MSAL client
    pub fn new(client_id: String, client_secret: Option<String>, redirect_uri: String) -> Result<Self, Box<dyn Error>> {
        let auth_url = AuthUrl::new(AUTH_URL.to_string())?;
        let token_url = TokenUrl::new(TOKEN_URL.to_string())?;

        let oauth_client = BasicClient::new(
            ClientId::new(client_id.clone()),
            client_secret.clone().map(ClientSecret::new),
            auth_url,
            Some(token_url),
        )
        .set_redirect_uri(RedirectUrl::new(redirect_uri.clone())?);

        Ok(Self {
            client_id,
            client_secret,
            redirect_uri,
            oauth_client,
        })
    }

    /// Generate authorization URL with PKCE
    pub fn get_authorization_url(&self) -> Result<(String, PkceCodeVerifier, CsrfToken), Box<dyn Error>> {
        let (pkce_challenge, pkce_verifier) = PkceCodeChallenge::new_random_sha256();

        let (auth_url, csrf_token) = self.oauth_client
            .authorize_url(CsrfToken::new_random)
            .add_scope(Scope::new("offline_access".to_string()))
            .add_scope(Scope::new("https://graph.microsoft.com/Mail.Read".to_string()))
            .add_scope(Scope::new("https://graph.microsoft.com/User.Read".to_string()))
            .set_pkce_challenge(pkce_challenge)
            .url();

        Ok((auth_url.to_string(), pkce_verifier, csrf_token))
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
            .await?;

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
            .unwrap_or(3600); // Default to 1 hour if not specified
        let expires_at = Utc::now() + Duration::seconds(expires_in_secs);

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

        // Use actual expires_in from token response, fallback to 1 hour if not provided
        let expires_in_secs = token_result
            .expires_in()
            .map(|d| d.as_secs() as i64)
            .unwrap_or(3600);
        let expires_at = Utc::now() + Duration::seconds(expires_in_secs);

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
        })
    }
}

/// Check if token is expired or about to expire (within 5 minutes)
pub fn is_token_expired(token_data: &TokenData) -> bool {
    let now = Utc::now();
    let buffer = Duration::minutes(5);
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
            expires_at: Utc::now() - Duration::hours(1),
            scope: "test".to_string(),
        };
        assert!(is_token_expired(&expired_token));

        let valid_token = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::days(30),
            scope: "test".to_string(),
        };
        assert!(!is_token_expired(&valid_token));
    }

    #[test]
    fn test_token_expiration_with_buffer() {
        // Token expires in 3 minutes - should be considered expired (buffer is 5 min)
        let almost_expired = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::minutes(3),
            scope: "test".to_string(),
        };
        assert!(is_token_expired(&almost_expired));

        // Token expires in 10 minutes - should be valid
        let safe_token = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::minutes(10),
            scope: "test".to_string(),
        };
        assert!(!is_token_expired(&safe_token));
    }

    #[test]
    fn test_msal_client_creation() {
        let client = MsalClient::new(
            "test-client-id".to_string(),
            None,
            "http://localhost:8080/callback".to_string(),
        );
        assert!(client.is_ok());
    }

    #[test]
    fn test_msal_client_with_secret() {
        let client = MsalClient::new(
            "test-client-id".to_string(),
            Some("test-secret".to_string()),
            "http://localhost:8080/callback".to_string(),
        );
        assert!(client.is_ok());
    }

    #[test]
    fn test_authorization_url_generation() {
        let client = MsalClient::new(
            "test-client-id".to_string(),
            None,
            "http://localhost:8080/callback".to_string(),
        ).unwrap();

        let result = client.get_authorization_url();
        assert!(result.is_ok());

        let (auth_url, _pkce_verifier, _csrf_token) = result.unwrap();

        // Verify URL contains expected parameters
        assert!(auth_url.contains("login.microsoftonline.com"));
        assert!(auth_url.contains("client_id=test-client-id"));
        assert!(auth_url.contains("redirect_uri="));
        assert!(auth_url.contains("code_challenge"));
        assert!(auth_url.contains("offline_access"));
    }

    #[test]
    fn test_token_data_serialization() {
        let token = TokenData {
            access_token: "test_access".to_string(),
            refresh_token: "test_refresh".to_string(),
            expires_at: Utc::now() + Duration::days(90),
            scope: "Mail.Read User.Read".to_string(),
        };

        // Test serialization
        let json = serde_json::to_string(&token);
        assert!(json.is_ok());

        // Test deserialization
        let deserialized: Result<TokenData, _> = serde_json::from_str(&json.unwrap());
        assert!(deserialized.is_ok());

        let deserialized_token = deserialized.unwrap();
        assert_eq!(deserialized_token.access_token, "test_access");
        assert_eq!(deserialized_token.refresh_token, "test_refresh");
        assert_eq!(deserialized_token.scope, "Mail.Read User.Read");
    }

    #[test]
    fn test_90_day_token_lifetime() {
        // Simulate token creation with 90-day expiration
        let token = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::days(90),
            scope: "test".to_string(),
        };

        // Should not be expired
        assert!(!is_token_expired(&token));

        // Token expiring in 89 days should still be valid
        let token_89_days = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::days(89),
            scope: "test".to_string(),
        };
        assert!(!is_token_expired(&token_89_days));
    }
}
