//! Referral Program API Client
//!
//! Client for communicating with the Nolus Referral Program API.
//! See: https://github.com/nolus-protocol/nolus-referral-program
//!
//! This client uses the `ExternalApiClient` trait for standardized HTTP operations.

use async_trait::async_trait;
use reqwest::Client;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use tracing::warn;

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
    pub fn new(config: &AppConfig, client: Client) -> Self {
        Self {
            client,
            base_url: config.external.referral_api_url.clone(),
            bearer_token: config.external.referral_api_token.clone(),
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
            let body = match response.text().await {
                Ok(text) => text,
                Err(e) => {
                    warn!("Failed to read error response body: {}", e);
                    "<unreadable response body>".to_string()
                }
            };

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

        let wrapper: ApiWrapper<AssignReferralResponse> =
            response.json().await.map_err(|e| AppError::ExternalApi {
                api: self.api_name().to_string(),
                message: format!("Failed to parse response: {}", e),
            })?;
        wrapper.extract_data(self.api_name())
    }
}

// ============================================================================
// Enums
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ReferrerTier {
    General,
    Premium,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ReferrerStatus {
    Active,
    Disabled,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum ReferralStatus {
    Active,
    Inactive,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum RewardStatus {
    Pending,
    Included,
    Paid,
}

#[derive(Debug, Clone, Serialize, Deserialize, PartialEq, ToSchema)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{body_partial_json, header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_config(url: &str, token: &str) -> AppConfig {
        let mut cfg = crate::test_utils::test_config();
        cfg.external.referral_api_url = url.to_string();
        cfg.external.referral_api_token = token.to_string();
        cfg
    }

    fn make_client(url: &str, token: &str) -> ReferralClient {
        let cfg = make_config(url, token);
        ReferralClient::new(&cfg, Client::new())
    }

    fn assert_referral_error(err: &AppError) {
        match err {
            AppError::ExternalApi { api, .. } => assert_eq!(api, "Referral"),
            other => panic!("expected ExternalApi Referral error, got {:?}", other),
        }
    }

    // ---- 107-109: is_fully_configured ----

    #[test]
    fn referral_is_fully_configured_true_when_both_set() {
        let client = make_client("http://host", "token");
        assert!(client.is_fully_configured());
    }

    #[test]
    fn referral_is_fully_configured_false_when_url_empty() {
        let client = make_client("", "token");
        assert!(!client.is_fully_configured());
    }

    #[test]
    fn referral_is_fully_configured_false_when_token_empty() {
        let client = make_client("http://host", "");
        assert!(!client.is_fully_configured());
    }

    // ---- 110: validate_code success ----

    #[tokio::test]
    async fn referral_validate_code_success() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrals/validate/ABC123"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "valid": true,
                    "referral_code": "ABC123",
                    "referrer_wallet": "nolus1abc"
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client.validate_code("ABC123").await.unwrap();
        assert!(resp.valid);
        assert_eq!(resp.referral_code.as_deref(), Some("ABC123"));
        assert_eq!(resp.referrer_wallet.as_deref(), Some("nolus1abc"));
    }

    // ---- 111: missing data + error message ----

    #[tokio::test]
    async fn referral_validate_code_extracts_none_on_missing_data() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrals/validate/XYZ"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": null,
                "error": "bad code"
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.validate_code("XYZ").await.unwrap_err();
        match err {
            AppError::ExternalApi { api, message } => {
                assert_eq!(api, "Referral");
                assert_eq!(message, "bad code");
            }
            other => panic!("got {:?}", other),
        }
    }

    // ---- 112: bearer token header ----

    #[tokio::test]
    async fn referral_bearer_token_attached_on_authenticated_calls() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/stats"))
            .and(header("authorization", "Bearer tkn"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "referrer": {
                        "wallet_address": "nolus1abc",
                        "referral_code": "ABC",
                        "tier": "general",
                        "status": "active",
                        "created_at": "2026-01-01"
                    },
                    "stats": {
                        "total_referrals": 0,
                        "active_referrals": 0,
                        "total_rewards_earned": "0",
                        "total_rewards_paid": "0",
                        "pending_rewards": "0",
                        "rewards_denom": "unls",
                        "bonus_rewards_earned": 0,
                        "bonus_rewards_paid": 0,
                        "total_bonus_amount_earned": "0",
                        "total_bonus_amount_paid": "0"
                    }
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client.get_referrer_stats("nolus1abc").await.unwrap();
        assert_eq!(resp.referrer.wallet_address, "nolus1abc");
    }

    // ---- 113: 401 error ----

    #[tokio::test]
    async fn referral_401_returns_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/stats"))
            .respond_with(ResponseTemplate::new(401).set_body_string("unauthorized"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.get_referrer_stats("nolus1abc").await.unwrap_err();
        match err {
            AppError::ExternalApi { api, message } => {
                assert_eq!(api, "Referral");
                assert!(message.contains("HTTP 401"), "msg: {}", message);
            }
            other => panic!("got {:?}", other),
        }
    }

    // ---- 114: register_referrer POST body ----

    #[tokio::test]
    async fn referral_register_referrer_posts_body() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrers/register"))
            .and(body_partial_json(
                serde_json::json!({ "wallet_address": "nolus1abc" }),
            ))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "wallet_address": "nolus1abc",
                    "referral_code": "NEW123",
                    "tier": "general",
                    "created_at": "2026-01-01",
                    "already_registered": false
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client.register_referrer("nolus1abc").await.unwrap();
        assert_eq!(resp.referral_code, "NEW123");
    }

    // ---- 115-116: get_referrer_stats ----

    #[tokio::test]
    async fn referral_get_referrer_stats_success() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/stats"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "referrer": {
                        "wallet_address": "nolus1abc",
                        "referral_code": "CDE",
                        "tier": "premium",
                        "status": "active",
                        "created_at": "2026-01-01"
                    },
                    "stats": {
                        "total_referrals": 5,
                        "active_referrals": 3,
                        "total_rewards_earned": "100",
                        "total_rewards_paid": "50",
                        "pending_rewards": "50",
                        "rewards_denom": "unls",
                        "bonus_rewards_earned": 0,
                        "bonus_rewards_paid": 0,
                        "total_bonus_amount_earned": "0",
                        "total_bonus_amount_paid": "0"
                    }
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client.get_referrer_stats("nolus1abc").await.unwrap();
        assert_eq!(resp.stats.total_referrals, 5);
    }

    #[tokio::test]
    async fn referral_get_referrer_stats_malformed_json() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/stats"))
            .respond_with(ResponseTemplate::new(200).set_body_string("{bad"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.get_referrer_stats("nolus1abc").await.unwrap_err();
        assert_referral_error(&err);
    }

    // ---- 117-118: get_referrals query params ----

    #[tokio::test]
    async fn referral_get_referrals_with_query_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/referrals"))
            .and(query_param("status", "active"))
            .and(query_param("limit", "10"))
            .and(query_param("offset", "20"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "referrals": [],
                    "total": 0,
                    "limit": 10,
                    "offset": 20
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let query = ReferralsQuery {
            status: Some(ReferralStatus::Active),
            limit: Some(10),
            offset: Some(20),
        };
        let resp = client.get_referrals("nolus1abc", query).await.unwrap();
        assert_eq!(resp.limit, 10);
    }

    #[tokio::test]
    async fn referral_get_referrals_without_query_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/referrals"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "referrals": [],
                    "total": 0,
                    "limit": 0,
                    "offset": 0
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client
            .get_referrals("nolus1abc", ReferralsQuery::default())
            .await
            .unwrap();
        assert_eq!(resp.total, 0);

        let received = server.received_requests().await.unwrap();
        assert_eq!(received.len(), 1);
        assert!(
            received[0].url.query().is_none_or(str::is_empty),
            "URL should have no query string, got: {:?}",
            received[0].url.query()
        );
    }

    // ---- 119: assign_referral success ----

    #[tokio::test]
    async fn referral_assign_referral_success() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrals/assign"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "id": 1,
                    "referrer_wallet": "nolus1ref",
                    "referred_wallet": "nolus1new",
                    "referral_code": "CODE",
                    "assigned_at": "2026-01-01"
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client.assign_referral("CODE", "nolus1new").await.unwrap();
        assert_eq!(resp.id, 1);
    }

    // ---- 120-124: assign_referral error mapping ----

    #[tokio::test]
    async fn referral_assign_referral_409_already_assigned_maps_to_specific_message() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrals/assign"))
            .respond_with(ResponseTemplate::new(409).set_body_string("wallet already assigned"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.assign_referral("CODE", "nolus1x").await.unwrap_err();
        match err {
            AppError::ExternalApi { message, .. } => {
                assert_eq!(message, "Wallet already has a referrer");
            }
            other => panic!("got {:?}", other),
        }
    }

    #[tokio::test]
    async fn referral_assign_referral_409_self_referral_maps_to_specific_message() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrals/assign"))
            .respond_with(ResponseTemplate::new(409).set_body_string("Self-referral not allowed"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.assign_referral("CODE", "nolus1x").await.unwrap_err();
        match err {
            AppError::ExternalApi { message, .. } => {
                assert_eq!(message, "Cannot refer yourself");
            }
            other => panic!("got {:?}", other),
        }
    }

    #[tokio::test]
    async fn referral_assign_referral_409_already_referrer_maps_to_specific_message() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrals/assign"))
            .respond_with(ResponseTemplate::new(409).set_body_string("already referrer"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.assign_referral("CODE", "nolus1x").await.unwrap_err();
        match err {
            AppError::ExternalApi { message, .. } => {
                assert_eq!(message, "Wallet is already a referrer");
            }
            other => panic!("got {:?}", other),
        }
    }

    #[tokio::test]
    async fn referral_assign_referral_404_maps_to_code_not_found() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrals/assign"))
            .respond_with(ResponseTemplate::new(404).set_body_string("nope"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.assign_referral("CODE", "nolus1x").await.unwrap_err();
        match err {
            AppError::ExternalApi { message, .. } => {
                assert_eq!(message, "Referral code not found");
            }
            other => panic!("got {:?}", other),
        }
    }

    #[tokio::test]
    async fn referral_assign_referral_other_error_uses_generic_message() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrals/assign"))
            .respond_with(ResponseTemplate::new(500).set_body_string("oops"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.assign_referral("CODE", "nolus1x").await.unwrap_err();
        match err {
            AppError::ExternalApi { message, .. } => {
                assert!(
                    message.contains("API error: 500") && message.contains("oops"),
                    "msg: {}",
                    message
                );
            }
            other => panic!("got {:?}", other),
        }
    }

    // ---- 125: malformed success body ----

    #[tokio::test]
    async fn referral_assign_referral_malformed_success_body() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/api/referrals/assign"))
            .respond_with(ResponseTemplate::new(200).set_body_string("{bad json"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.assign_referral("CODE", "nolus1x").await.unwrap_err();
        match err {
            AppError::ExternalApi { message, .. } => {
                assert!(
                    message.contains("Failed to parse response"),
                    "msg: {}",
                    message
                );
            }
            other => panic!("got {:?}", other),
        }
    }

    // ---- 126-127: rewards/payouts query params ----

    #[tokio::test]
    async fn referral_get_referrer_rewards_applies_query_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/rewards"))
            .and(query_param("status", "pending"))
            .and(query_param("limit", "5"))
            .and(query_param("offset", "0"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "rewards": [],
                    "total": 0,
                    "limit": 5,
                    "offset": 0
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let query = RewardsQuery {
            status: Some(RewardStatus::Pending),
            limit: Some(5),
            offset: Some(0),
        };
        let resp = client
            .get_referrer_rewards("nolus1abc", query)
            .await
            .unwrap();
        assert_eq!(resp.limit, 5);
    }

    #[tokio::test]
    async fn referral_get_referrer_payouts_applies_query_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/referrers/nolus1abc/payouts"))
            .and(query_param("status", "confirmed"))
            .and(query_param("limit", "3"))
            .and(query_param("offset", "7"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "data": {
                    "payouts": [],
                    "total": 0,
                    "limit": 3,
                    "offset": 7
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let query = PayoutsQuery {
            status: Some(PayoutStatus::Confirmed),
            limit: Some(3),
            offset: Some(7),
        };
        let resp = client
            .get_referrer_payouts("nolus1abc", query)
            .await
            .unwrap();
        assert_eq!(resp.offset, 7);
    }
}
