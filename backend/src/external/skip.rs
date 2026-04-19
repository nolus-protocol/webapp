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

    /// Get transaction status
    pub async fn get_status(
        &self,
        tx_hash: &str,
        chain_id: &str,
    ) -> Result<SkipStatusResponse, AppError> {
        let url = format!(
            "{}/v2/tx/status?tx_hash={}&chain_id={}",
            self.base_url,
            urlencoding::encode(tx_hash),
            urlencoding::encode(chain_id)
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

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{body_partial_json, header, method, path, query_param};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn test_client(url: &str, api_key: Option<String>) -> SkipClient {
        SkipClient::new(url.to_string(), api_key, Client::new())
    }

    fn status_body() -> serde_json::Value {
        serde_json::json!({
            "status": "STATE_COMPLETED",
            "state": "STATE_COMPLETED",
            "transfer_sequence": [],
            "error": null
        })
    }

    fn assert_skip_error(err: &AppError) {
        match err {
            AppError::ExternalApi { api, .. } => assert_eq!(api, "Skip"),
            other => panic!("expected ExternalApi Skip error, got {:?}", other),
        }
    }

    // ---- 95: URL encoding of params ----

    #[tokio::test]
    async fn skip_get_status_builds_url_with_encoded_params() {
        let server = MockServer::start().await;
        // Raw values contain '+' and '/'. The client uses urlencoding::encode,
        // and wiremock's query_param matcher receives the decoded value.
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .and(query_param("tx_hash", "abc+/="))
            .and(query_param("chain_id", "osmosis/1"))
            .respond_with(ResponseTemplate::new(200).set_body_json(status_body()))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let resp = client.get_status("abc+/=", "osmosis/1").await.unwrap();
        assert_eq!(resp.status, "STATE_COMPLETED");
    }

    // ---- 96-98: get_status success/malformed/500 ----

    #[tokio::test]
    async fn skip_get_status_success() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(status_body()))
            .mount(&server)
            .await;
        let client = test_client(&server.uri(), None);
        let resp = client.get_status("h", "c").await.unwrap();
        assert_eq!(resp.status, "STATE_COMPLETED");
    }

    #[tokio::test]
    async fn skip_get_status_malformed_json_returns_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(ResponseTemplate::new(200).set_body_string("{bad"))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let err = client.get_status("h", "c").await.unwrap_err();
        assert_skip_error(&err);
    }

    #[tokio::test]
    async fn skip_get_status_http_500_returns_error() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(ResponseTemplate::new(500).set_body_string("err"))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let err = client.get_status("h", "c").await.unwrap_err();
        match err {
            AppError::ExternalApi { api, message } => {
                assert_eq!(api, "Skip");
                assert!(message.contains("HTTP 500"), "msg: {}", message);
            }
            other => panic!("got {:?}", other),
        }
    }

    // ---- 99: get_chains ----

    #[tokio::test]
    async fn skip_get_chains_success() {
        let server = MockServer::start().await;
        let body = serde_json::json!({ "chains": [] });
        Mock::given(method("GET"))
            .and(path("/v2/info/chains"))
            .and(query_param("include_evm", "true"))
            .and(query_param("include_svm", "false"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let resp = client.get_chains(true, false).await.unwrap();
        assert!(resp.chains.is_empty());
    }

    // ---- 100: track_transaction POST body ----

    #[tokio::test]
    async fn skip_track_transaction_sends_post_with_body() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v2/tx/track"))
            .and(body_partial_json(serde_json::json!({
                "chain_id": "osmosis-1",
                "tx_hash": "0xabc"
            })))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "tx_hash": "0xabc",
                "explorer_link": "https://ex/0xabc"
            })))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let resp = client
            .track_transaction("osmosis-1", "0xabc")
            .await
            .unwrap();
        assert_eq!(resp.tx_hash, "0xabc");
    }

    // ---- 101-102: auth header presence ----

    #[tokio::test]
    async fn skip_auth_header_attached_when_api_key_present() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .and(header("authorization", "secret"))
            .respond_with(ResponseTemplate::new(200).set_body_json(status_body()))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), Some("secret".to_string()));
        let resp = client.get_status("h", "c").await.unwrap();
        assert_eq!(resp.status, "STATE_COMPLETED");
    }

    #[tokio::test]
    async fn skip_no_auth_header_when_api_key_none() {
        let server = MockServer::start().await;
        // Register a permissive match so the request is accepted.
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(status_body()))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        client.get_status("h", "c").await.unwrap();

        // Inspect received request for authorization header.
        let received = server.received_requests().await.unwrap();
        assert_eq!(received.len(), 1);
        assert!(
            received[0].headers.get("authorization").is_none(),
            "authorization header should be absent when api_key is None"
        );
    }

    // ---- 103: post_raw ----

    #[tokio::test]
    async fn skip_post_raw_forwards_json_and_parses_response() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(path("/v2/raw"))
            .and(body_partial_json(serde_json::json!({ "a": 1 })))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({ "ok": true })),
            )
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let url = format!("{}/v2/raw", server.uri());
        let resp = client
            .post_raw(&url, &serde_json::json!({ "a": 1 }))
            .await
            .unwrap();
        assert_eq!(resp, serde_json::json!({ "ok": true }));
    }

    // ---- 104: get_raw ----

    #[tokio::test]
    async fn skip_get_raw_forwards_and_parses() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/raw-get"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({ "hello": "world" })),
            )
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let url = format!("{}/v2/raw-get", server.uri());
        let resp = client.get_raw(&url).await.unwrap();
        assert_eq!(resp["hello"], "world");
    }

    // ---- 105: null fields accepted ----

    #[tokio::test]
    async fn skip_status_response_accepts_null_fields() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "STATE_PENDING",
                "state": null,
                "transfer_sequence": null,
                "error": null
            })))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let resp = client.get_status("h", "c").await.unwrap();
        assert_eq!(resp.status, "STATE_PENDING");
        assert!(resp.state.is_none());
        assert!(resp.transfer_sequence.is_none());
    }

    // ---- 106: rejects wrong types ----

    #[tokio::test]
    async fn skip_status_response_unexpected_field_types_rejected() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({ "status": 123 })),
            )
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let err = client.get_status("h", "c").await.unwrap_err();
        assert_skip_error(&err);
    }
}
