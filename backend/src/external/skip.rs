use reqwest::Client;
use serde::{Deserialize, Serialize};

use crate::error::AppError;

/// Skip API client for cross-chain swap routing
pub struct SkipClient {
    base_url: String,
    api_key: Option<String>,
    client: Client,
}

impl SkipClient {
    pub fn new(base_url: String, api_key: Option<String>, client: Client) -> Self {
        Self {
            base_url,
            api_key,
            client,
        }
    }

    /// Get the base URL for direct API access
    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    /// Make a raw POST request to a URL and return JSON response
    pub async fn post_raw(
        &self,
        url: &str,
        body: &serde_json::Value,
    ) -> Result<serde_json::Value, AppError> {
        let mut req = self.client.post(url).json(body);

        if let Some(key) = &self.api_key {
            req = req.header("authorization", key);
        }

        let response = req.send().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: e.to_string(),
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi {
                api: "Skip".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        response.json().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: format!("Failed to parse response: {}", e),
        })
    }

    /// Make a raw GET request to a URL and return JSON response
    pub async fn get_raw(&self, url: &str) -> Result<serde_json::Value, AppError> {
        let mut req = self.client.get(url);

        if let Some(key) = &self.api_key {
            req = req.header("authorization", key);
        }

        let response = req.send().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: e.to_string(),
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi {
                api: "Skip".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        response.json().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: format!("Failed to parse response: {}", e),
        })
    }

    /// Get optimal swap route
    pub async fn get_route(
        &self,
        request: SkipRouteRequest,
    ) -> Result<SkipRouteResponse, AppError> {
        let url = format!("{}/v2/fungible/route", self.base_url);

        let mut req = self.client.post(&url).json(&request);

        if let Some(key) = &self.api_key {
            req = req.header("authorization", key);
        }

        let response = req.send().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: e.to_string(),
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi {
                api: "Skip".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        response.json().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: format!("Failed to parse route response: {}", e),
        })
    }

    /// Get messages for a route
    pub async fn get_messages(
        &self,
        request: SkipMessagesRequest,
    ) -> Result<SkipMessagesResponse, AppError> {
        let url = format!("{}/v2/fungible/msgs_direct", self.base_url);

        let mut req = self.client.post(&url).json(&request);

        if let Some(key) = &self.api_key {
            req = req.header("authorization", key);
        }

        let response = req.send().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: e.to_string(),
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi {
                api: "Skip".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        response.json().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: format!("Failed to parse messages response: {}", e),
        })
    }

    /// Get transaction status
    pub async fn get_status(
        &self,
        tx_hash: &str,
        chain_id: &str,
    ) -> Result<SkipStatusResponse, AppError> {
        let url = format!(
            "{}/v2/tx/status?tx_hash={}&chain_id={}",
            self.base_url, tx_hash, chain_id
        );

        let mut req = self.client.get(&url);

        if let Some(key) = &self.api_key {
            req = req.header("authorization", key);
        }

        let response = req.send().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: e.to_string(),
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi {
                api: "Skip".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        response.json().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: format!("Failed to parse status response: {}", e),
        })
    }

    /// Get supported chains from Skip API
    pub async fn get_chains(
        &self,
        include_evm: bool,
        include_svm: bool,
    ) -> Result<SkipChainsResponse, AppError> {
        let url = format!(
            "{}/v2/info/chains?include_evm={}&include_svm={}",
            self.base_url, include_evm, include_svm
        );

        let mut req = self.client.get(&url);

        if let Some(key) = &self.api_key {
            req = req.header("authorization", key);
        }

        let response = req.send().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: e.to_string(),
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi {
                api: "Skip".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        response.json().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: format!("Failed to parse chains response: {}", e),
        })
    }

    /// Track/register a transaction with Skip
    pub async fn track_transaction(
        &self,
        chain_id: &str,
        tx_hash: &str,
    ) -> Result<SkipTrackResponse, AppError> {
        let url = format!("{}/v2/tx/track", self.base_url);

        let body = serde_json::json!({
            "chain_id": chain_id,
            "tx_hash": tx_hash
        });

        let mut req = self.client.post(&url).json(&body);

        if let Some(key) = &self.api_key {
            req = req.header("authorization", key);
        }

        let response = req.send().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: e.to_string(),
        })?;

        if !response.status().is_success() {
            let status = response.status();
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ExternalApi {
                api: "Skip".to_string(),
                message: format!("HTTP {}: {}", status, body),
            });
        }

        response.json().await.map_err(|e| AppError::ExternalApi {
            api: "Skip".to_string(),
            message: format!("Failed to parse track response: {}", e),
        })
    }
}

// ============================================================================
// Skip Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipRouteRequest {
    pub source_asset_denom: String,
    pub source_asset_chain_id: String,
    pub dest_asset_denom: String,
    pub dest_asset_chain_id: String,
    pub amount_in: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slippage_tolerance_percent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipRouteResponse {
    pub amount_in: String,
    pub amount_out: String,
    pub operations: Vec<serde_json::Value>,
    pub chain_ids: Vec<String>,
    #[serde(default)]
    pub does_swap: bool,
    pub estimated_amount_out: Option<String>,
    pub swap_price_impact_percent: Option<String>,
    pub estimated_fees: Option<Vec<SkipFee>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipFee {
    pub amount: String,
    pub denom: String,
    pub chain_id: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipMessagesRequest {
    pub source_asset_denom: String,
    pub source_asset_chain_id: String,
    pub dest_asset_denom: String,
    pub dest_asset_chain_id: String,
    pub amount_in: String,
    pub chain_ids_to_addresses: std::collections::HashMap<String, String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub slippage_tolerance_percent: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipMessagesResponse {
    pub msgs: Vec<SkipChainMessage>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipChainMessage {
    pub chain_id: String,
    pub path: Vec<String>,
    pub msg: String,
    pub msg_type_url: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipStatusResponse {
    pub status: String,
    pub transfer_sequence: Option<Vec<SkipTransferStatus>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipTransferStatus {
    pub src_chain_id: String,
    pub dst_chain_id: String,
    pub state: String,
    pub packet_txs: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipChainsResponse {
    pub chains: Vec<SkipChain>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipChain {
    pub chain_name: String,
    pub chain_id: String,
    pub chain_type: String,
    pub pfm_enabled: Option<bool>,
    pub cosmos_module_support: Option<serde_json::Value>,
    pub supports_memo: Option<bool>,
    pub logo_uri: Option<String>,
    pub bech32_prefix: Option<String>,
    pub fee_assets: Option<Vec<serde_json::Value>>,
    pub is_testnet: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipTrackResponse {
    pub tx_hash: String,
    #[serde(default)]
    pub explorer_link: Option<String>,
}
