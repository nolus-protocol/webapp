//! Intercom Client for Identity Verification
//!
//! Generates JWT tokens for Intercom user authentication.
//! User attributes are embedded in the JWT payload so they are signed
//! and tamper-proof (per Intercom security best practices).

use jsonwebtoken::{encode, EncodingKey, Header};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;

use crate::config::AppConfig;
use crate::error::AppError;

/// Client for Intercom Identity Verification
/// Generates JWT tokens with embedded user attributes
pub struct IntercomClient {
    secret_key: String,
}

/// User attributes to embed in the JWT payload.
/// All fields are required — the backend computes everything server-side.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IntercomAttributes {
    pub wallet_type: String,
    pub total_balance_usd: String,
    pub positions_count: u32,
    pub positions_value_usd: String,
    pub positions_debt_usd: String,
    pub positions_unrealized_pnl_usd: String,
    pub earn_deposited_usd: String,
    pub earn_pools_count: u32,
    pub staking_delegated_nls: String,
    pub staking_delegated_usd: String,
    pub staking_vested_nls: String,
    pub staking_validators_count: u32,
    pub has_active_leases: bool,
    pub has_earn_positions: bool,
    pub has_staking_positions: bool,
    pub is_vesting_account: bool,
    pub positions_dashboard_url: String,
}

/// JWT Claims for Intercom
/// Includes user_id, expiration, and flattened user attributes
#[derive(Debug, Serialize, Deserialize)]
struct IntercomClaims {
    /// User ID (wallet address)
    user_id: String,
    /// Expiration time (Unix timestamp)
    exp: usize,
    /// User attributes flattened into the claims
    #[serde(flatten)]
    attributes: HashMap<String, serde_json::Value>,
}

/// Response containing the JWT token
#[derive(Debug, Clone)]
pub struct IntercomToken {
    pub token: String,
}

impl IntercomClient {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            secret_key: config.external.intercom_secret_key.clone(),
        }
    }

    /// Check if the Intercom client is configured
    pub fn is_configured(&self) -> bool {
        !self.secret_key.is_empty()
    }

    /// Generate a JWT token for Intercom identity verification
    ///
    /// The token is signed with the Intercom secret key and expires in 15 minutes.
    /// User attributes are embedded in the JWT payload so they are signed and
    /// cannot be tampered with on the client side.
    ///
    /// # Arguments
    /// * `user_id` - The user's wallet address
    /// * `attributes` - User attributes to embed in the JWT (computed server-side)
    ///
    /// # Returns
    /// * `IntercomToken` containing the signed JWT
    pub fn generate_token(
        &self,
        user_id: &str,
        attributes: &IntercomAttributes,
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

        // Flatten attributes into a HashMap for the JWT payload
        let attributes_map: HashMap<String, serde_json::Value> = {
            let value = serde_json::to_value(attributes)
                .map_err(|e| AppError::Internal(format!("Failed to serialize attributes: {}", e)))?;
            match value {
                serde_json::Value::Object(map) => map.into_iter().collect(),
                _ => HashMap::new(),
            }
        };

        let claims = IntercomClaims {
            user_id: user_id.to_string(),
            exp,
            attributes: attributes_map,
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
            external: crate::config::ExternalApiConfig {
                intercom_secret_key: "test-secret-key-for-jwt".to_string(),
                ..Default::default()
            },
            ..Default::default()
        }
    }

    fn create_test_attributes() -> IntercomAttributes {
        IntercomAttributes {
            wallet_type: "keplr".to_string(),
            total_balance_usd: "1234.56".to_string(),
            positions_count: 5,
            positions_value_usd: "0.00".to_string(),
            positions_debt_usd: "0.00".to_string(),
            positions_unrealized_pnl_usd: "0.00".to_string(),
            earn_deposited_usd: "500.00".to_string(),
            earn_pools_count: 2,
            staking_delegated_nls: "1000.000000".to_string(),
            staking_delegated_usd: "250.00".to_string(),
            staking_vested_nls: "0.000000".to_string(),
            staking_validators_count: 3,
            has_active_leases: true,
            has_earn_positions: true,
            has_staking_positions: true,
            is_vesting_account: false,
            positions_dashboard_url: "https://crtl.kostovster.io/chain-data/wallet-explorer?address=nolus1abc123".to_string(),
        }
    }

    #[test]
    fn test_generate_token() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);
        let attrs = create_test_attributes();

        let result = client.generate_token("nolus1abc123", &attrs).unwrap();

        assert!(!result.token.is_empty());
        // JWT has 3 parts separated by dots
        assert_eq!(result.token.matches('.').count(), 2);
    }

    #[test]
    fn test_token_contains_user_id() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);
        let attrs = create_test_attributes();

        let result = client.generate_token("nolus1abc123", &attrs).unwrap();

        let token_data = decode::<IntercomClaims>(
            &result.token,
            &DecodingKey::from_secret("test-secret-key-for-jwt".as_bytes()),
            &Validation::default(),
        )
        .unwrap();

        assert_eq!(token_data.claims.user_id, "nolus1abc123");
    }

    #[test]
    fn test_token_contains_attributes() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);
        let attrs = create_test_attributes();

        let result = client.generate_token("nolus1abc123", &attrs).unwrap();

        let token_data = decode::<IntercomClaims>(
            &result.token,
            &DecodingKey::from_secret("test-secret-key-for-jwt".as_bytes()),
            &Validation::default(),
        )
        .unwrap();

        assert_eq!(token_data.claims.user_id, "nolus1abc123");
        assert_eq!(
            token_data.claims.attributes.get("wallet_type"),
            Some(&serde_json::Value::String("keplr".to_string()))
        );
        assert_eq!(
            token_data.claims.attributes.get("positions_count"),
            Some(&serde_json::json!(5))
        );
        assert_eq!(
            token_data.claims.attributes.get("has_active_leases"),
            Some(&serde_json::json!(true))
        );
        assert_eq!(
            token_data.claims.attributes.get("total_balance_usd"),
            Some(&serde_json::Value::String("1234.56".to_string()))
        );
        // All fields should be present (no more optional fields)
        assert_eq!(
            token_data.claims.attributes.get("earn_deposited_usd"),
            Some(&serde_json::Value::String("500.00".to_string()))
        );
        assert_eq!(
            token_data.claims.attributes.get("staking_validators_count"),
            Some(&serde_json::json!(3))
        );
        assert_eq!(
            token_data.claims.attributes.get("positions_dashboard_url"),
            Some(&serde_json::Value::String(
                "https://crtl.kostovster.io/chain-data/wallet-explorer?address=nolus1abc123".to_string()
            ))
        );
    }

    #[test]
    fn test_token_has_expiration() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);
        let attrs = create_test_attributes();

        let result = client.generate_token("nolus1abc123", &attrs).unwrap();

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
        let attrs = create_test_attributes();

        let result = client.generate_token("", &attrs);

        assert!(result.is_err());
    }

    #[test]
    fn test_token_decodes_successfully() {
        let config = create_test_config();
        let client = IntercomClient::new(&config);
        let attrs = create_test_attributes();

        let result = client.generate_token("nolus1abc123", &attrs).unwrap();

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
            external: crate::config::ExternalApiConfig {
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
            external: crate::config::ExternalApiConfig {
                intercom_secret_key: String::new(),
                ..Default::default()
            },
            ..Default::default()
        };
        let client = IntercomClient::new(&empty_config);
        let attrs = create_test_attributes();

        let result = client.generate_token("nolus1abc123", &attrs);
        assert!(result.is_err());
    }
}
