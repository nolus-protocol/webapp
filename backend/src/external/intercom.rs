//! Intercom Client for Identity Verification
//!
//! Generates JWT tokens for Intercom user authentication.
//! The frontend uses these tokens to initialize the Intercom messenger.

use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::error::AppError;

/// Client for Intercom Identity Verification
/// Generates JWT tokens for secure user identification
pub struct IntercomClient {
    secret_key: String,
}

/// JWT Claims for Intercom
#[derive(Debug, Serialize, Deserialize)]
struct IntercomClaims {
    /// User ID (wallet address)
    user_id: String,
    /// Expiration time (Unix timestamp)
    exp: usize,
    /// Wallet type (optional, for user segmentation)
    #[serde(skip_serializing_if = "Option::is_none")]
    wallet_type: Option<String>,
}

/// Response containing the JWT token
#[derive(Debug, Clone)]
pub struct IntercomToken {
    pub token: String,
}

impl IntercomClient {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            secret_key: config.external_apis.intercom_secret_key.clone(),
        }
    }

    /// Check if the Intercom client is configured
    pub fn is_configured(&self) -> bool {
        !self.secret_key.is_empty()
    }

    /// Generate a JWT token for Intercom identity verification
    ///
    /// The token is signed with the Intercom secret key and expires in 15 minutes.
    /// Short-lived tokens are more secure per Intercom best practices.
    ///
    /// # Arguments
    /// * `user_id` - The user's wallet address
    /// * `wallet_type` - Optional wallet type for user segmentation
    ///
    /// # Returns
    /// * `IntercomToken` containing the signed JWT
    pub fn generate_token(
        &self,
        user_id: &str,
        wallet_type: Option<&str>,
    ) -> Result<IntercomToken, AppError> {
        if user_id.is_empty() {
            return Err(AppError::Validation {
                message: "User ID cannot be empty".to_string(),
                field: Some("user_id".to_string()),
                details: None,
            });
        }

        if !self.is_configured() {
            return Err(AppError::Internal(
                "Intercom secret key not configured".to_string(),
            ));
        }

        // Calculate expiration: 15 minutes from now (short-lived for security)
        let exp = chrono::Utc::now()
            .checked_add_signed(chrono::Duration::minutes(15))
            .ok_or_else(|| AppError::Internal("Failed to calculate token expiration".to_string()))?
            .timestamp() as usize;

        let claims = IntercomClaims {
            user_id: user_id.to_string(),
            exp,
            wallet_type: wallet_type.map(|s| s.to_string()),
        };

        let token = encode(
            &Header::default(),
            &claims,
            &EncodingKey::from_secret(self.secret_key.as_bytes()),
        )
        .map_err(|e| AppError::Internal(format!("Failed to generate JWT: {}", e)))?;

        Ok(IntercomToken { token })
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use jsonwebtoken::{decode, DecodingKey, Validation};

    fn create_test_config() -> AppConfig {
        AppConfig {
            external_apis: crate::config::ExternalApiConfig {
                intercom_secret_key: "test-secret-key-for-jwt".to_string(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    #[test]
    fn test_generate_token() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);

        let result = client.generate_token("nolus1abc123", None).unwrap();

        assert!(!result.token.is_empty());
        // JWT has 3 parts separated by dots
        assert_eq!(result.token.matches('.').count(), 2);
    }

    #[test]
    fn test_token_contains_user_id() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);

        let result = client.generate_token("nolus1abc123", None).unwrap();

        // Decode and verify the token contains the correct user_id
        let token_data = decode::<IntercomClaims>(
            &result.token,
            &DecodingKey::from_secret("test-secret-key-for-jwt".as_bytes()),
            &Validation::default(),
        )
        .unwrap();

        assert_eq!(token_data.claims.user_id, "nolus1abc123");
    }

    #[test]
    fn test_token_contains_wallet_type() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);

        let result = client
            .generate_token("nolus1abc123", Some("keplr"))
            .unwrap();

        // Decode and verify the token contains the wallet_type
        let token_data = decode::<IntercomClaims>(
            &result.token,
            &DecodingKey::from_secret("test-secret-key-for-jwt".as_bytes()),
            &Validation::default(),
        )
        .unwrap();

        assert_eq!(token_data.claims.user_id, "nolus1abc123");
        assert_eq!(token_data.claims.wallet_type, Some("keplr".to_string()));
    }

    #[test]
    fn test_token_without_wallet_type() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);

        let result = client.generate_token("nolus1abc123", None).unwrap();

        let token_data = decode::<IntercomClaims>(
            &result.token,
            &DecodingKey::from_secret("test-secret-key-for-jwt".as_bytes()),
            &Validation::default(),
        )
        .unwrap();

        assert_eq!(token_data.claims.wallet_type, None);
    }

    #[test]
    fn test_token_has_expiration() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);

        let result = client.generate_token("nolus1abc123", None).unwrap();

        let token_data = decode::<IntercomClaims>(
            &result.token,
            &DecodingKey::from_secret("test-secret-key-for-jwt".as_bytes()),
            &Validation::default(),
        )
        .unwrap();

        // Expiration should be approximately 15 minutes from now
        let now = chrono::Utc::now().timestamp() as usize;
        let fifteen_minutes = 15 * 60;

        assert!(token_data.claims.exp > now);
        assert!(token_data.claims.exp <= now + fifteen_minutes + 10); // Allow 10 seconds tolerance
    }

    #[test]
    fn test_empty_user_id_fails() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);

        let result = client.generate_token("", None);

        assert!(result.is_err());
    }

    #[test]
    fn test_token_decodes_successfully() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);

        let result = client.generate_token("nolus1abc123", None).unwrap();

        // Token should decode successfully with the correct secret
        let validation = Validation::default();
        let key = DecodingKey::from_secret("test-secret-key-for-jwt".as_bytes());

        let decoded = decode::<IntercomClaims>(&result.token, &key, &validation);
        assert!(decoded.is_ok());
        assert_eq!(decoded.unwrap().claims.user_id, "nolus1abc123");
    }

    #[test]
    fn test_is_configured() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);
        assert!(client.is_configured());

        let empty_config = AppConfig {
            external_apis: crate::config::ExternalApiConfig {
                intercom_secret_key: String::new(),
                ..Default::default()
            },
            ..Default::default()
        };
        let empty_client = IntercomClient::new(&empty_config);
        assert!(!empty_client.is_configured());
    }

    #[test]
    fn test_unconfigured_client_fails() {
        let empty_config = AppConfig {
            external_apis: crate::config::ExternalApiConfig {
                intercom_secret_key: String::new(),
                ..Default::default()
            },
            ..Default::default()
        };
        let client = IntercomClient::new(&empty_config);

        let result = client.generate_token("nolus1abc123", None);
        assert!(result.is_err());
    }
}
