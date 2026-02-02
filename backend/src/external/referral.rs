//! Referral Program API Client
//!
//! Client for communicating with the Nolus Referral Program API.
//! See: https://github.com/nolus-protocol/nolus-referral-program
//!
//! This client uses the `ExternalApiClient` trait for standardized HTTP operations.

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::error::AppError;
use crate::external::base_client::{ApiWrapper, ExternalApiClient, WrappedResponseExt};

// ============================================================================
// Client
// ============================================================================

/// Client for the Referral Program API
/// Requires Bearer token authentication
pub struct ReferralClient {
    client: Client,
    base_url: String,
    bearer_token: String,
}

impl ReferralClient {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            client: Client::new(),
            base_url: config.external_apis.referral_api_url.clone(),
            bearer_token: config.external_apis.referral_api_token.clone(),
        }
    }

    /// Check if the referral client is fully configured
    pub fn is_fully_configured(&self) -> bool {
        !self.base_url.is_empty() && !self.bearer_token.is_empty()
    }
}

#[async_trait]
impl ExternalApiClient for ReferralClient {
    fn api_name(&self) -> &'static str {
        "Referral"
    }

    fn base_url(&self) -> &str {
        &self.base_url
    }

    fn client(&self) -> &Client {
        &self.client
    }

    fn bearer_token(&self) -> Option<&str> {
        if self.bearer_token.is_empty() {
            None
        } else {
            Some(&self.bearer_token)
        }
    }
}

// ============================================================================
// API Methods
// ============================================================================

impl ReferralClient {
    // ========================================================================
    // Public Endpoints (No Auth Required for validation)
    // ========================================================================

    /// Validate a referral code (public endpoint)
    /// GET /api/referrals/validate/:code
    pub async fn validate_code(&self, code: &str) -> Result<ValidateCodeResponse, AppError> {
        let endpoint = format!("api/referrals/validate/{}", code);
        let wrapper: ApiWrapper<ValidateCodeResponse> = self.get(&endpoint).await?;
        wrapper.extract_data(self.api_name())
    }

    // ========================================================================
    // Referrer Endpoints
    // ========================================================================

    /// Register as a referrer
    /// POST /api/referrers/register
    pub async fn register_referrer(
        &self,
        wallet_address: &str,
    ) -> Result<RegisterReferrerResponse, AppError> {
        let request = RegisterReferrerRequest {
            wallet_address: wallet_address.to_string(),
        };
        let wrapper: ApiWrapper<RegisterReferrerResponse> =
            self.post("api/referrers/register", &request).await?;
        wrapper.extract_data(self.api_name())
    }

    /// Get referrer statistics
    /// GET /api/referrers/:wallet_address/stats
    pub async fn get_referrer_stats(
        &self,
        wallet_address: &str,
    ) -> Result<ReferrerStatsResponse, AppError> {
        let endpoint = format!("api/referrers/{}/stats", wallet_address);
        let wrapper: ApiWrapper<ReferrerStatsResponse> = self.get(&endpoint).await?;
        wrapper.extract_data(self.api_name())
    }

    /// Get referrer rewards
    /// GET /api/referrers/:wallet_address/rewards
    pub async fn get_referrer_rewards(
        &self,
        wallet_address: &str,
        query: RewardsQuery,
    ) -> Result<RewardsResponse, AppError> {
        let endpoint = format!("api/referrers/{}/rewards", wallet_address);
        let params = query.to_params();
        let param_refs: Vec<(&str, &str)> = params.iter().map(|(k, v)| (*k, v.as_str())).collect();

        let wrapper: ApiWrapper<RewardsResponse> = if param_refs.is_empty() {
            self.get(&endpoint).await?
        } else {
            self.get_with_query(&endpoint, &param_refs).await?
        };
        wrapper.extract_data(self.api_name())
    }

    /// Get referrer payouts
    /// GET /api/referrers/:wallet_address/payouts
    pub async fn get_referrer_payouts(
        &self,
        wallet_address: &str,
        query: PayoutsQuery,
    ) -> Result<PayoutsResponse, AppError> {
        let endpoint = format!("api/referrers/{}/payouts", wallet_address);
        let params = query.to_params();
        let param_refs: Vec<(&str, &str)> = params.iter().map(|(k, v)| (*k, v.as_str())).collect();

        let wrapper: ApiWrapper<PayoutsResponse> = if param_refs.is_empty() {
            self.get(&endpoint).await?
        } else {
            self.get_with_query(&endpoint, &param_refs).await?
        };
        wrapper.extract_data(self.api_name())
    }

    /// Get referrals for a referrer
    /// GET /api/referrers/:wallet_address/referrals
    pub async fn get_referrals(
        &self,
        wallet_address: &str,
        query: ReferralsQuery,
    ) -> Result<ReferralsResponse, AppError> {
        let endpoint = format!("api/referrers/{}/referrals", wallet_address);
        let params = query.to_params();
        let param_refs: Vec<(&str, &str)> = params.iter().map(|(k, v)| (*k, v.as_str())).collect();

        let wrapper: ApiWrapper<ReferralsResponse> = if param_refs.is_empty() {
            self.get(&endpoint).await?
        } else {
            self.get_with_query(&endpoint, &param_refs).await?
        };
        wrapper.extract_data(self.api_name())
    }

    // ========================================================================
    // Referral Assignment
    // ========================================================================

    /// Assign a referral (link referred user to referrer)
    /// POST /api/referrals/assign
    pub async fn assign_referral(
        &self,
        referral_code: &str,
        referred_wallet: &str,
    ) -> Result<AssignReferralResponse, AppError> {
        let request = AssignReferralRequest {
            referral_code: referral_code.to_string(),
            referred_wallet: referred_wallet.to_string(),
        };

        // Use raw response for custom error handling
        let response = self.post_raw("api/referrals/assign", &request).await?;
        let status = response.status();

        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();

            // Parse specific error messages
            if status == reqwest::StatusCode::CONFLICT {
                if body.contains("already assigned") {
                    return Err(AppError::ExternalApi {
                        api: self.api_name().to_string(),
                        message: "Wallet already has a referrer".to_string(),
                    });
                }
                if body.contains("Self-referral") {
                    return Err(AppError::ExternalApi {
                        api: self.api_name().to_string(),
                        message: "Cannot refer yourself".to_string(),
                    });
                }
                if body.contains("already referrer") {
                    return Err(AppError::ExternalApi {
                        api: self.api_name().to_string(),
                        message: "Wallet is already a referrer".to_string(),
                    });
                }
            }
            if status == reqwest::StatusCode::NOT_FOUND {
                return Err(AppError::ExternalApi {
                    api: self.api_name().to_string(),
                    message: "Referral code not found".to_string(),
                });
            }

            return Err(AppError::ExternalApi {
                api: self.api_name().to_string(),
                message: format!("API error: {} - {}", status, body),
            });
        }

        let wrapper: ApiWrapper<AssignReferralResponse> = response.json().await.map_err(|e| {
            AppError::ExternalApi {
                api: self.api_name().to_string(),
                message: format!("Failed to parse response: {}", e),
            }
        })?;
        wrapper.extract_data(self.api_name())
    }
}

// ============================================================================
// Enums
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ReferrerTier {
    General,
    Premium,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ReferrerStatus {
    Active,
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum ReferralStatus {
    Active,
    Inactive,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum RewardStatus {
    Pending,
    Included,
    Paid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq)]
#[serde(rename_all = "lowercase")]
pub enum PayoutStatus {
    Pending,
    Submitted,
    Confirmed,
    Failed,
}

// ============================================================================
// Referrer Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Referrer {
    pub wallet_address: String,
    pub referral_code: String,
    pub tier: ReferrerTier,
    pub status: ReferrerStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferrerStats {
    pub total_referrals: u64,
    pub active_referrals: u64,
    pub total_rewards_earned: String,
    pub total_rewards_paid: String,
    pub pending_rewards: String,
    pub rewards_denom: String,
    pub bonus_rewards_earned: u64,
    pub bonus_rewards_paid: u64,
    pub total_bonus_amount_earned: String,
    pub total_bonus_amount_paid: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferrerStatsResponse {
    pub referrer: Referrer,
    pub stats: ReferrerStats,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RegisterReferrerResponse {
    pub wallet_address: String,
    pub referral_code: String,
    pub tier: ReferrerTier,
    pub created_at: String,
    #[serde(default)]
    pub already_registered: bool,
}

// ============================================================================
// Referral Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Referral {
    pub id: i64,
    pub referrer_id: i64,
    pub referred_wallet: String,
    pub assigned_at: String,
    pub status: ReferralStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ReferralsResponse {
    pub referrals: Vec<Referral>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ValidateCodeResponse {
    pub valid: bool,
    #[serde(default)]
    pub referral_code: Option<String>,
    #[serde(default)]
    pub referrer_wallet: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssignReferralResponse {
    pub id: i64,
    pub referrer_wallet: String,
    pub referred_wallet: String,
    pub referral_code: String,
    pub assigned_at: String,
}

// ============================================================================
// Reward Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Reward {
    pub id: i64,
    pub lease_id: String,
    pub referred_wallet: String,
    pub period_start: String,
    pub period_end: String,
    pub interest_collected: String,
    pub interest_denom: String,
    pub reward_amount: String,
    pub reward_denom: String,
    pub status: RewardStatus,
    pub created_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RewardsResponse {
    pub rewards: Vec<Reward>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// ============================================================================
// Payout Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Payout {
    pub id: i64,
    pub total_amount: String,
    pub denom: String,
    pub tx_hash: Option<String>,
    pub status: PayoutStatus,
    pub created_at: String,
    pub executed_at: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PayoutsResponse {
    pub payouts: Vec<Payout>,
    pub total: u64,
    pub limit: u64,
    pub offset: u64,
}

// ============================================================================
// Request Types
// ============================================================================

#[derive(Debug, Clone, Serialize)]
pub struct RegisterReferrerRequest {
    pub wallet_address: String,
}

#[derive(Debug, Clone, Serialize)]
pub struct AssignReferralRequest {
    pub referral_code: String,
    pub referred_wallet: String,
}

// ============================================================================
// Query Parameters
// ============================================================================

#[derive(Debug, Clone, Default)]
pub struct RewardsQuery {
    pub status: Option<RewardStatus>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

impl RewardsQuery {
    fn to_params(&self) -> Vec<(&'static str, String)> {
        let mut params = vec![];
        if let Some(status) = &self.status {
            params.push((
                "status",
                serde_json::to_string(status)
                    .unwrap()
                    .trim_matches('"')
                    .to_string(),
            ));
        }
        if let Some(limit) = self.limit {
            params.push(("limit", limit.to_string()));
        }
        if let Some(offset) = self.offset {
            params.push(("offset", offset.to_string()));
        }
        params
    }
}

#[derive(Debug, Clone, Default)]
pub struct PayoutsQuery {
    pub status: Option<PayoutStatus>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

impl PayoutsQuery {
    fn to_params(&self) -> Vec<(&'static str, String)> {
        let mut params = vec![];
        if let Some(status) = &self.status {
            params.push((
                "status",
                serde_json::to_string(status)
                    .unwrap()
                    .trim_matches('"')
                    .to_string(),
            ));
        }
        if let Some(limit) = self.limit {
            params.push(("limit", limit.to_string()));
        }
        if let Some(offset) = self.offset {
            params.push(("offset", offset.to_string()));
        }
        params
    }
}

#[derive(Debug, Clone, Default)]
pub struct ReferralsQuery {
    pub status: Option<ReferralStatus>,
    pub limit: Option<u64>,
    pub offset: Option<u64>,
}

impl ReferralsQuery {
    fn to_params(&self) -> Vec<(&'static str, String)> {
        let mut params = vec![];
        if let Some(status) = &self.status {
            params.push((
                "status",
                serde_json::to_string(status)
                    .unwrap()
                    .trim_matches('"')
                    .to_string(),
            ));
        }
        if let Some(limit) = self.limit {
            params.push(("limit", limit.to_string()));
        }
        if let Some(offset) = self.offset {
            params.push(("offset", offset.to_string()));
        }
        params
    }
}

// ============================================================================
// Tests
// ============================================================================

