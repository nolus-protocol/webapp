use async_trait::async_trait;
use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};

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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
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
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CampaignEligibilityResponse {
    pub eligible: bool,
    #[serde(default)]
    pub matching_campaigns: Vec<CampaignMatch>,
    pub reason: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
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
