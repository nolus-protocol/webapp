use async_trait::async_trait;
use reqwest::Client;
use serde::{de::DeserializeOwned, Deserialize, Serialize};

use crate::error::AppError;
use crate::external::base_client::ExternalApiClient;

/// Skip API client for cross-chain swap routing
pub struct SkipClient {
    base_url: String,
    api_key: Option<String>,
    client: Client,
}

#[async_trait]
impl ExternalApiClient for SkipClient {
    fn api_name(&self) -> &'static str {
        "Skip"
    }

    fn base_url(&self) -> &str {
        &self.base_url
    }

    fn client(&self) -> &Client {
        &self.client
    }
}

impl SkipClient {
    pub fn new(base_url: String, api_key: Option<String>, client: Client) -> Self {
        Self {
            base_url,
            api_key,
            client,
        }
    }

    /// Attach the Skip API key as a raw `authorization` header.
    /// Skip uses a raw API key, not a Bearer token.
    fn auth(&self, req: reqwest::RequestBuilder) -> reqwest::RequestBuilder {
        match &self.api_key {
            Some(key) => req.header("authorization", key),
            None => req,
        }
    }

    /// GET a full URL, parse JSON response
    async fn get_url<T: DeserializeOwned>(&self, url: &str) -> Result<T, AppError> {
        let req = self.auth(self.client.get(url));
        let response = req.send().await.map_err(|e| self.request_error(url, e))?;
        self.handle_response(response, url).await
    }

    /// POST a full URL with JSON body, parse JSON response
    async fn post_url<T: DeserializeOwned, B: Serialize + Send + Sync>(
        &self,
        url: &str,
        body: &B,
    ) -> Result<T, AppError> {
        let req = self.auth(self.client.post(url).json(body));
        let response = req.send().await.map_err(|e| self.request_error(url, e))?;
        self.handle_response(response, url).await
    }

    /// Make a raw POST request to a URL and return JSON response
    pub async fn post_raw(
        &self,
        url: &str,
        body: &serde_json::Value,
    ) -> Result<serde_json::Value, AppError> {
        self.post_url(url, body).await
    }

    /// Make a raw GET request to a URL and return JSON response
    pub async fn get_raw(&self, url: &str) -> Result<serde_json::Value, AppError> {
        self.get_url(url).await
    }

    /// Get optimal swap route
    pub async fn get_route(
        &self,
        request: SkipRouteRequest,
    ) -> Result<SkipRouteResponse, AppError> {
        let url = format!("{}/v2/fungible/route", self.base_url);
        self.post_url(&url, &request).await
    }

    /// Get messages for a route
    pub async fn get_messages(
        &self,
        request: SkipMessagesRequest,
    ) -> Result<SkipMessagesResponse, AppError> {
        let url = format!("{}/v2/fungible/msgs_direct", self.base_url);
        self.post_url(&url, &request).await
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
        self.get_url(&url).await
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
        self.get_url(&url).await
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
        self.post_url(&url, &body).await
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
    #[serde(default)]
    pub state: Option<String>,
    pub transfer_sequence: Option<Vec<SkipTransferSequenceItem>>,
    #[serde(default)]
    pub error: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipTransferSequenceItem {
    pub ibc_transfer: Option<SkipIbcTransferStatus>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipIbcTransferStatus {
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
