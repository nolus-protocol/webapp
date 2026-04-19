use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::config::AppConfig;
use crate::error::AppError;
use crate::external::base_client::ExternalApiClient;

/// Client for the Zero Interest Payments API
/// Requires Bearer token authentication
pub struct ZeroInterestClient {
    client: Client,
    base_url: String,
    bearer_token: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeroInterestPayment {
    pub id: String,
    pub lease_address: String,
    pub amount: String,
    pub denom: String,
    pub payment_date: String,
    pub status: PaymentStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Completed,
    Failed,
    Cancelled,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeroInterestEligibility {
    pub eligible: bool,
    pub reason: Option<String>,
    pub max_amount: Option<String>,
    pub available_slots: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeroInterestConfig {
    pub enabled: bool,
    pub max_payment_amount: String,
    pub min_lease_value: String,
    pub max_active_payments: u32,
    pub supported_denoms: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateZeroInterestPaymentRequest {
    pub lease_address: String,
    pub amount: String,
    pub denom: String,
    pub owner_address: String,
    pub signature: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeroInterestPaymentResponse {
    pub payment: ZeroInterestPayment,
    pub tx_hash: Option<String>,
}

// ============================================================================
// Campaign Types (from Payments Manager)
// ============================================================================

/// Zero-interest campaign information
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ZeroInterestCampaign {
    pub id: i64,
    pub name: String,
    pub active: bool,
    /// Eligible protocol/leaser addresses (empty = all protocols)
    #[serde(default)]
    pub eligible_protocols: Vec<String>,
    /// Eligible currency tickers (empty = all currencies)
    #[serde(default)]
    pub eligible_currencies: Vec<String>,
    /// Eligible wallet addresses (empty = all wallets)
    #[serde(default)]
    pub eligible_wallets: Vec<String>,
    /// Campaign start date
    pub start_date: Option<DateTime<Utc>>,
    /// Campaign end date
    pub end_date: Option<DateTime<Utc>>,
    /// Human-readable description
    pub description: Option<String>,
}

/// Response for active campaigns endpoint
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ActiveCampaignsResponse {
    /// List of active campaigns
    pub campaigns: Vec<ZeroInterestCampaign>,
    /// All currencies eligible across any campaign
    #[serde(default)]
    pub all_eligible_currencies: Vec<String>,
    /// All protocols eligible across any campaign
    #[serde(default)]
    pub all_eligible_protocols: Vec<String>,
    /// True if any campaign has no restrictions
    #[serde(default)]
    pub has_universal_campaign: bool,
}

/// Response for eligibility check
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CampaignEligibilityResponse {
    pub eligible: bool,
    #[serde(default)]
    pub matching_campaigns: Vec<CampaignMatch>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct CampaignMatch {
    pub id: i64,
    pub name: String,
}

/// Wrapper for payments manager API responses
#[derive(Debug, Clone, Deserialize)]
struct PaymentsManagerResponse<T> {
    #[allow(dead_code)]
    pub success: bool,
    pub data: T,
}

#[async_trait]
impl ExternalApiClient for ZeroInterestClient {
    fn api_name(&self) -> &'static str {
        "ZeroInterest"
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

impl ZeroInterestClient {
    pub fn new(config: &AppConfig, client: Client) -> Self {
        Self {
            client,
            base_url: config.external.zero_interest_api_url.clone(),
            bearer_token: config.external.zero_interest_api_token.clone(),
        }
    }

    /// Get zero interest configuration
    pub async fn get_config(&self) -> Result<ZeroInterestConfig, AppError> {
        self.get("zero-interest/config").await
    }

    /// Check eligibility for zero interest payment
    pub async fn check_eligibility(
        &self,
        lease_address: &str,
        owner_address: &str,
    ) -> Result<ZeroInterestEligibility, AppError> {
        self.get_with_query(
            "zero-interest/eligibility",
            &[("lease", lease_address), ("owner", owner_address)],
        )
        .await
    }

    /// Get all zero interest payments for a user
    pub async fn get_payments(
        &self,
        owner_address: &str,
    ) -> Result<Vec<ZeroInterestPayment>, AppError> {
        let endpoint = format!("zero-interest/payments/{}", owner_address);
        self.get(&endpoint).await
    }

    /// Get payments for a specific lease
    pub async fn get_lease_payments(
        &self,
        lease_address: &str,
    ) -> Result<Vec<ZeroInterestPayment>, AppError> {
        let endpoint = format!("zero-interest/lease/{}/payments", lease_address);
        self.get(&endpoint).await
    }

    /// Create a new zero interest payment
    pub async fn create_payment(
        &self,
        request: CreateZeroInterestPaymentRequest,
    ) -> Result<ZeroInterestPaymentResponse, AppError> {
        self.post("zero-interest/payments", &request).await
    }

    /// Cancel a pending zero interest payment
    pub async fn cancel_payment(
        &self,
        payment_id: &str,
        owner_address: &str,
        signature: &str,
    ) -> Result<(), AppError> {
        let url = self.build_url(&format!("zero-interest/payments/{}", payment_id));

        #[derive(Serialize)]
        struct CancelRequest<'a> {
            owner_address: &'a str,
            signature: &'a str,
        }

        let mut req = self.client.delete(&url).json(&CancelRequest {
            owner_address,
            signature,
        });
        if let Some(token) = self.bearer_token() {
            req = req.bearer_auth(token);
        }

        let response = req
            .send()
            .await
            .map_err(|e| self.request_error("cancel_payment", e))?;
        self.check_status(response, "cancel_payment").await?;

        Ok(())
    }

    // ========================================================================
    // Campaign Methods (from Payments Manager /api/v1/campaigns/*)
    // ========================================================================

    /// Get all currently active zero-interest campaigns
    pub async fn get_active_campaigns(&self) -> Result<ActiveCampaignsResponse, AppError> {
        let wrapper: PaymentsManagerResponse<ActiveCampaignsResponse> =
            self.get("api/v1/campaigns/active").await?;
        Ok(wrapper.data)
    }

    /// Check if a wallet/protocol/currency is eligible for zero-interest campaigns
    pub async fn check_campaign_eligibility(
        &self,
        wallet: &str,
        protocol: Option<&str>,
        currency: Option<&str>,
    ) -> Result<CampaignEligibilityResponse, AppError> {
        let mut params: Vec<(&str, &str)> = vec![("wallet", wallet)];
        if let Some(p) = protocol {
            params.push(("protocol", p));
        }
        if let Some(c) = currency {
            params.push(("currency", c));
        }

        let wrapper: PaymentsManagerResponse<CampaignEligibilityResponse> = self
            .get_with_query("api/v1/campaigns/check-eligibility", &params)
            .await?;
        Ok(wrapper.data)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{body_partial_json, header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn make_config(url: &str, token: &str) -> AppConfig {
        let mut cfg = crate::test_utils::test_config();
        cfg.external.zero_interest_api_url = url.to_string();
        cfg.external.zero_interest_api_token = token.to_string();
        cfg
    }

    fn make_client(url: &str, token: &str) -> ZeroInterestClient {
        ZeroInterestClient::new(&make_config(url, token), Client::new())
    }

    fn assert_zi_error(err: &AppError) {
        match err {
            AppError::ExternalApi { api, .. } => assert_eq!(api, "ZeroInterest"),
            other => panic!("expected ExternalApi ZeroInterest error, got {:?}", other),
        }
    }

    fn config_body() -> serde_json::Value {
        serde_json::json!({
            "enabled": true,
            "max_payment_amount": "1000",
            "min_lease_value": "100",
            "max_active_payments": 3,
            "supported_denoms": ["unls", "uusdc"]
        })
    }

    // ---- 128-130: get_config ----

    #[tokio::test]
    async fn zi_get_config_success() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/zero-interest/config"))
            .respond_with(ResponseTemplate::new(200).set_body_json(config_body()))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let cfg = client.get_config().await.unwrap();
        assert!(cfg.enabled);
        assert_eq!(cfg.max_active_payments, 3);
    }

    #[tokio::test]
    async fn zi_get_config_malformed_returns_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/zero-interest/config"))
            .respond_with(ResponseTemplate::new(200).set_body_string("{bad"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.get_config().await.unwrap_err();
        assert_zi_error(&err);
    }

    #[tokio::test]
    async fn zi_get_config_401_returns_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/zero-interest/config"))
            .respond_with(ResponseTemplate::new(401).set_body_string("no auth"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.get_config().await.unwrap_err();
        match err {
            AppError::ExternalApi { api, message } => {
                assert_eq!(api, "ZeroInterest");
                assert!(message.contains("HTTP 401"), "msg: {}", message);
            }
            other => panic!("got {:?}", other),
        }
    }

    // ---- 131: check_eligibility query params ----

    #[tokio::test]
    async fn zi_check_eligibility_builds_query_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/zero-interest/eligibility"))
            .and(query_param("lease", "addr1"))
            .and(query_param("owner", "addr2"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "eligible": true,
                "reason": null,
                "max_amount": "500",
                "available_slots": 2
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client.check_eligibility("addr1", "addr2").await.unwrap();
        assert!(resp.eligible);
    }

    // ---- 132: get_payments path includes owner ----

    #[tokio::test]
    async fn zi_get_payments_path_includes_owner() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/zero-interest/payments/nolus1owner"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!([])))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let payments = client.get_payments("nolus1owner").await.unwrap();
        assert!(payments.is_empty());
    }

    // ---- 133: get_lease_payments path includes lease ----

    #[tokio::test]
    async fn zi_get_lease_payments_path_includes_lease() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/zero-interest/lease/nolus1lease/payments"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!([])))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let payments = client.get_lease_payments("nolus1lease").await.unwrap();
        assert!(payments.is_empty());
    }

    // ---- 134: create_payment posts request body ----

    #[tokio::test]
    async fn zi_create_payment_posts_request_body() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/zero-interest/payments"))
            .and(body_partial_json(serde_json::json!({
                "lease_address": "nolus1lease",
                "amount": "100",
                "denom": "unls",
                "owner_address": "nolus1owner",
                "signature": "sig"
            })))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "payment": {
                    "id": "pay1",
                    "lease_address": "nolus1lease",
                    "amount": "100",
                    "denom": "unls",
                    "payment_date": "2026-01-01",
                    "status": "pending"
                },
                "tx_hash": "TXH"
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let req = CreateZeroInterestPaymentRequest {
            lease_address: "nolus1lease".to_string(),
            amount: "100".to_string(),
            denom: "unls".to_string(),
            owner_address: "nolus1owner".to_string(),
            signature: "sig".to_string(),
        };
        let resp = client.create_payment(req).await.unwrap();
        assert_eq!(resp.payment.id, "pay1");
        assert_eq!(resp.tx_hash.as_deref(), Some("TXH"));
    }

    // ---- 135: cancel_payment DELETE with body ----

    #[tokio::test]
    async fn zi_cancel_payment_sends_delete_with_body() {
        let server = MockServer::start().await;
        Mock::given(method("DELETE"))
            .and(path("/zero-interest/payments/pay1"))
            .and(body_partial_json(serde_json::json!({
                "owner_address": "nolus1owner",
                "signature": "sig"
            })))
            .respond_with(ResponseTemplate::new(200).set_body_string(""))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        client
            .cancel_payment("pay1", "nolus1owner", "sig")
            .await
            .unwrap();
    }

    // ---- 136: cancel_payment bubbles 500 ----

    #[tokio::test]
    async fn zi_cancel_payment_bubbles_http_error() {
        let server = MockServer::start().await;
        Mock::given(method("DELETE"))
            .and(path("/zero-interest/payments/pay1"))
            .respond_with(ResponseTemplate::new(500).set_body_string("oops"))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client
            .cancel_payment("pay1", "nolus1owner", "sig")
            .await
            .unwrap_err();
        assert_zi_error(&err);
    }

    // ---- 137-138: get_active_campaigns ----

    #[tokio::test]
    async fn zi_get_active_campaigns_unwraps_data_field() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/v1/campaigns/active"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "success": true,
                "data": {
                    "campaigns": [],
                    "all_eligible_currencies": ["USDC"],
                    "all_eligible_protocols": ["OSMOSIS"],
                    "has_universal_campaign": false
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client.get_active_campaigns().await.unwrap();
        assert!(resp.campaigns.is_empty());
        assert_eq!(resp.all_eligible_currencies, vec!["USDC".to_string()]);
        assert!(!resp.has_universal_campaign);
    }

    #[tokio::test]
    async fn zi_get_active_campaigns_malformed_wrapper_returns_error() {
        let server = MockServer::start().await;
        // Missing "data" field → parse error.
        Mock::given(method("GET"))
            .and(path("/api/v1/campaigns/active"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({ "success": true })),
            )
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let err = client.get_active_campaigns().await.unwrap_err();
        assert_zi_error(&err);
    }

    // ---- 139-140: check_campaign_eligibility query params ----

    #[tokio::test]
    async fn zi_check_campaign_eligibility_without_optional_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/v1/campaigns/check-eligibility"))
            .and(query_param("wallet", "nolus1w"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "success": true,
                "data": {
                    "eligible": true,
                    "matching_campaigns": [],
                    "reason": null
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client
            .check_campaign_eligibility("nolus1w", None, None)
            .await
            .unwrap();
        assert!(resp.eligible);

        let received = server.received_requests().await.unwrap();
        let q = received[0].url.query().unwrap_or("");
        assert!(!q.contains("protocol="), "q: {}", q);
        assert!(!q.contains("currency="), "q: {}", q);
    }

    #[tokio::test]
    async fn zi_check_campaign_eligibility_with_all_params() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/api/v1/campaigns/check-eligibility"))
            .and(query_param("wallet", "nolus1w"))
            .and(query_param("protocol", "OSMOSIS"))
            .and(query_param("currency", "USDC"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "success": true,
                "data": {
                    "eligible": true,
                    "matching_campaigns": [{ "id": 1, "name": "Campaign A" }],
                    "reason": null
                }
            })))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "tkn");
        let resp = client
            .check_campaign_eligibility("nolus1w", Some("OSMOSIS"), Some("USDC"))
            .await
            .unwrap();
        assert_eq!(resp.matching_campaigns.len(), 1);
    }

    // ---- 141: bearer token attached when configured ----

    #[tokio::test]
    async fn zi_bearer_token_attached_when_configured() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/zero-interest/config"))
            .and(header("authorization", "Bearer real-token"))
            .respond_with(ResponseTemplate::new(200).set_body_json(config_body()))
            .mount(&server)
            .await;

        let client = make_client(&server.uri(), "real-token");
        let cfg = client.get_config().await.unwrap();
        assert!(cfg.enabled);
    }

    // ---- 142: bearer_token omitted when empty ----

    #[tokio::test]
    async fn zi_bearer_token_omitted_when_empty() {
        let client = make_client("http://host", "");
        assert!(client.bearer_token().is_none());
    }
}
