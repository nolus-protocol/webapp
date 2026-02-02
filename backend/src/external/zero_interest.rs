use chrono::{DateTime, Utc};
use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::config::AppConfig;
use crate::error::AppError;

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

fn api_error(message: String) -> AppError {
    AppError::ExternalApi {
        api: "ZeroInterest".to_string(),
        message,
    }
}

impl ZeroInterestClient {
    pub fn new(config: &AppConfig) -> Self {
        Self {
            client: Client::new(),
            base_url: config.external_apis.zero_interest_api_url.clone(),
            bearer_token: config.external_apis.zero_interest_api_token.clone(),
        }
    }

    /// Get zero interest configuration
    pub async fn get_config(&self) -> Result<ZeroInterestConfig, AppError> {
        let url = format!("{}/zero-interest/config", self.base_url);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.bearer_token)
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(api_error(format!("API error: {}", response.status())));
        }

        response
            .json()
            .await
            .map_err(|e| api_error(format!("Failed to parse response: {}", e)))
    }

    /// Check eligibility for zero interest payment
    pub async fn check_eligibility(
        &self,
        lease_address: &str,
        owner_address: &str,
    ) -> Result<ZeroInterestEligibility, AppError> {
        let url = format!(
            "{}/zero-interest/eligibility?lease={}&owner={}",
            self.base_url, lease_address, owner_address
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.bearer_token)
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(api_error(format!("API error: {}", response.status())));
        }

        response
            .json()
            .await
            .map_err(|e| api_error(format!("Failed to parse response: {}", e)))
    }

    /// Get all zero interest payments for a user
    pub async fn get_payments(
        &self,
        owner_address: &str,
    ) -> Result<Vec<ZeroInterestPayment>, AppError> {
        let url = format!("{}/zero-interest/payments/{}", self.base_url, owner_address);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.bearer_token)
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(api_error(format!("API error: {}", response.status())));
        }

        response
            .json()
            .await
            .map_err(|e| api_error(format!("Failed to parse response: {}", e)))
    }

    /// Get payments for a specific lease
    pub async fn get_lease_payments(
        &self,
        lease_address: &str,
    ) -> Result<Vec<ZeroInterestPayment>, AppError> {
        let url = format!(
            "{}/zero-interest/lease/{}/payments",
            self.base_url, lease_address
        );

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.bearer_token)
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            return Err(api_error(format!("API error: {}", response.status())));
        }

        response
            .json()
            .await
            .map_err(|e| api_error(format!("Failed to parse response: {}", e)))
    }

    /// Create a new zero interest payment
    pub async fn create_payment(
        &self,
        request: CreateZeroInterestPaymentRequest,
    ) -> Result<ZeroInterestPaymentResponse, AppError> {
        let url = format!("{}/zero-interest/payments", self.base_url);

        let response = self
            .client
            .post(&url)
            .bearer_auth(&self.bearer_token)
            .json(&request)
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(api_error(format!("API error: {} - {}", status, body)));
        }

        response
            .json()
            .await
            .map_err(|e| api_error(format!("Failed to parse response: {}", e)))
    }

    /// Cancel a pending zero interest payment
    pub async fn cancel_payment(
        &self,
        payment_id: &str,
        owner_address: &str,
        signature: &str,
    ) -> Result<(), AppError> {
        let url = format!("{}/zero-interest/payments/{}", self.base_url, payment_id);

        #[derive(Serialize)]
        struct CancelRequest<'a> {
            owner_address: &'a str,
            signature: &'a str,
        }

        let response = self
            .client
            .delete(&url)
            .bearer_auth(&self.bearer_token)
            .json(&CancelRequest {
                owner_address,
                signature,
            })
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(api_error(format!("API error: {} - {}", status, body)));
        }

        Ok(())
    }

    // ========================================================================
    // Campaign Methods (from Payments Manager /api/v1/campaigns/*)
    // ========================================================================

    /// Get all currently active zero-interest campaigns
    /// Returns campaign rules for display in the webapp
    pub async fn get_active_campaigns(&self) -> Result<ActiveCampaignsResponse, AppError> {
        let url = format!("{}/api/v1/campaigns/active", self.base_url);

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.bearer_token)
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(api_error(format!("API error: {} - {}", status, body)));
        }

        let wrapper: PaymentsManagerResponse<ActiveCampaignsResponse> = response
            .json()
            .await
            .map_err(|e| api_error(format!("Failed to parse response: {}", e)))?;

        Ok(wrapper.data)
    }

    /// Check if a wallet/protocol/currency is eligible for zero-interest campaigns
    pub async fn check_campaign_eligibility(
        &self,
        wallet: &str,
        protocol: Option<&str>,
        currency: Option<&str>,
    ) -> Result<CampaignEligibilityResponse, AppError> {
        let mut url = format!("{}/api/v1/campaigns/check-eligibility?wallet={}", self.base_url, wallet);
        
        if let Some(p) = protocol {
            url.push_str(&format!("&protocol={}", p));
        }
        if let Some(c) = currency {
            url.push_str(&format!("&currency={}", c));
        }

        let response = self
            .client
            .get(&url)
            .bearer_auth(&self.bearer_token)
            .send()
            .await
            .map_err(|e| api_error(format!("Request failed: {}", e)))?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(api_error(format!("API error: {} - {}", status, body)));
        }

        let wrapper: PaymentsManagerResponse<CampaignEligibilityResponse> = response
            .json()
            .await
            .map_err(|e| api_error(format!("Failed to parse response: {}", e)))?;

        Ok(wrapper.data)
    }
}
