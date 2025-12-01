//! Integration tests for OAuth flow
//!
//! These tests verify the complete OAuth flow works correctly
//! by testing the integration between components.

use tauri_app_lib::oauth::{MsalClient, TokenData, is_token_expired};
use chrono::{Utc, Duration};

#[cfg(test)]
mod integration_tests {
    use super::*;

    const TEST_CLIENT_ID: &str = "81f2799a-4e9d-4d46-947b-c51114e806d7";
    const TEST_REDIRECT_URI: &str = "http://localhost:8080/callback";

    #[test]
    fn test_complete_oauth_client_initialization() {
        // Test that we can create a client with real Azure credentials
        let client = MsalClient::new(
            TEST_CLIENT_ID.to_string(),
            None,
            TEST_REDIRECT_URI.to_string(),
        );

        assert!(client.is_ok(), "Failed to create MSAL client with real credentials");

        let client = client.unwrap();
        let auth_url_result = client.get_authorization_url();

        assert!(auth_url_result.is_ok(), "Failed to generate authorization URL");

        let (auth_url, _pkce_verifier, _csrf_token) = auth_url_result.unwrap();

        // Verify the URL contains all required parameters
        assert!(auth_url.contains("login.microsoftonline.com"));
        assert!(auth_url.contains(TEST_CLIENT_ID));
        assert!(auth_url.contains("code_challenge"));
        assert!(auth_url.contains("offline_access"));
        assert!(auth_url.contains("Mail.Read"));
        assert!(auth_url.contains("User.Read"));

        println!("✅ Authorization URL generated successfully");
        println!("URL: {}", &auth_url[..100]);
    }

    #[test]
    fn test_token_lifecycle() {
        // Simulate a complete token lifecycle

        // 1. Initial token (simulating fresh OAuth response)
        let initial_token = TokenData {
            access_token: "mock_access_token_12345".to_string(),
            refresh_token: "mock_refresh_token_67890".to_string(),
            expires_at: Utc::now() + Duration::days(90),
            scope: "offline_access Mail.Read User.Read".to_string(),
        };

        // 2. Token should be valid initially
        assert!(!is_token_expired(&initial_token), "Fresh token should not be expired");

        // 3. Serialize token (simulating storage)
        let serialized = serde_json::to_string(&initial_token);
        assert!(serialized.is_ok(), "Token serialization failed");

        // 4. Deserialize token (simulating retrieval)
        let deserialized: Result<TokenData, _> = serde_json::from_str(&serialized.unwrap());
        assert!(deserialized.is_ok(), "Token deserialization failed");

        let retrieved_token = deserialized.unwrap();
        assert_eq!(retrieved_token.access_token, initial_token.access_token);
        assert_eq!(retrieved_token.refresh_token, initial_token.refresh_token);

        // 5. Simulate token near expiration
        let almost_expired = TokenData {
            access_token: "expiring_token".to_string(),
            refresh_token: "refresh_token".to_string(),
            expires_at: Utc::now() + Duration::minutes(3), // Within 5-minute buffer
            scope: "test".to_string(),
        };

        assert!(is_token_expired(&almost_expired), "Token within buffer should be considered expired");

        println!("✅ Token lifecycle test passed");
    }

    #[test]
    fn test_90_day_token_validity() {
        // Test that tokens with 90-day expiration are handled correctly

        let token_90_days = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::days(90),
            scope: "test".to_string(),
        };

        // Should not be expired
        assert!(!is_token_expired(&token_90_days));

        // Calculate days until expiration
        let now = Utc::now();
        let days_until_expiry = (token_90_days.expires_at - now).num_days();

        assert!(days_until_expiry >= 89 && days_until_expiry <= 90,
                "Token should expire in approximately 90 days, got {} days", days_until_expiry);

        println!("✅ 90-day token validity test passed");
        println!("   Days until expiration: {}", days_until_expiry);
    }

    #[test]
    fn test_multiple_client_instances() {
        // Test that we can create multiple client instances
        // (simulating multiple users or sessions)

        let client1 = MsalClient::new(
            TEST_CLIENT_ID.to_string(),
            None,
            TEST_REDIRECT_URI.to_string(),
        );

        let client2 = MsalClient::new(
            "different-client-id".to_string(),
            Some("client-secret".to_string()),
            "http://localhost:3000/callback".to_string(),
        );

        assert!(client1.is_ok());
        assert!(client2.is_ok());

        // Both clients should be able to generate auth URLs
        let url1 = client1.unwrap().get_authorization_url();
        let url2 = client2.unwrap().get_authorization_url();

        assert!(url1.is_ok());
        assert!(url2.is_ok());

        println!("✅ Multiple client instances test passed");
    }

    #[test]
    fn test_token_expiration_edge_cases() {
        // Test various edge cases for token expiration

        // Exactly at buffer boundary (5 minutes)
        let token_5min = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::minutes(5),
            scope: "test".to_string(),
        };
        // Should be considered expired (buffer is inclusive)
        assert!(is_token_expired(&token_5min), "Token at 5-minute boundary should be expired");

        // Just beyond buffer (6 minutes)
        let token_6min = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() + Duration::minutes(6),
            scope: "test".to_string(),
        };
        assert!(!is_token_expired(&token_6min), "Token beyond buffer should be valid");

        // Already expired
        let token_past = TokenData {
            access_token: "test".to_string(),
            refresh_token: "test".to_string(),
            expires_at: Utc::now() - Duration::hours(1),
            scope: "test".to_string(),
        };
        assert!(is_token_expired(&token_past), "Past token should be expired");

        println!("✅ Token expiration edge cases test passed");
    }
}
