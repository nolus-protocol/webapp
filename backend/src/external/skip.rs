use async_trait::async_trait;
use reqwest::Client;
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use utoipa::ToSchema;

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

/// Skip `/v2/tx/status` response.
///
/// `state` drives the frontend tracking loop and `error.message` is what it
/// surfaces — both are validated at ingress. Every other field Skip returns
/// (`transfers`, `next_blocking_transfer`, `transfer_asset_release`, …) is
/// preserved verbatim through `additional`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipStatusResponse {
    /// Overall transaction state (`STATE_SUBMITTED`, `STATE_PENDING`,
    /// `STATE_COMPLETED_SUCCESS`, `STATE_COMPLETED_ERROR`,
    /// `STATE_PENDING_ERROR`, `STATE_ABANDONED`)
    pub state: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub error: Option<SkipStatusError>,
    /// Per-hop transfer events; each entry wraps exactly one transfer kind
    /// (`ibc_transfer`, `cctp_transfer`, `axelar_transfer`, …)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub transfer_sequence: Option<Vec<SkipTransferEvent>>,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
}

/// Structured Skip status error. Only `message` is consumed; `type` and
/// `details` ride in `additional`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipStatusError {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
}

/// One hop in a Skip transfer sequence. IBC hops are typed; every other
/// transfer kind (`cctp_transfer`, `axelar_transfer`, `go_fast_transfer`, …)
/// is preserved through `additional`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipTransferEvent {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub ibc_transfer: Option<SkipIbcTransferStatus>,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
}

/// IBC transfer hop status.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipIbcTransferStatus {
    pub src_chain_id: String,
    pub dst_chain_id: String,
    pub state: String,
    #[serde(default, skip_serializing_if = "Option::is_none")]
    #[schema(value_type = Object)]
    pub packet_txs: Option<serde_json::Value>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipChainsResponse {
    pub chains: Vec<SkipChain>,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
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

/// Skip `/v2/fungible/route` response.
///
/// Only the fields the swap flow consumes are typed and required; every other
/// field Skip returns (price impact, estimated fees, USD amounts, route
/// duration, …) is preserved verbatim through `additional` so the frontend
/// keeps its display data. `operations` stays opaque and is echoed back to
/// `/v2/fungible/msgs` unchanged, so it must round-trip byte-for-byte.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipRouteResponse {
    pub amount_in: String,
    pub amount_out: String,
    pub source_asset_denom: String,
    pub source_asset_chain_id: String,
    pub dest_asset_denom: String,
    pub dest_asset_chain_id: String,
    pub chain_ids: Vec<String>,
    #[schema(value_type = Vec<Object>)]
    pub operations: Vec<serde_json::Value>,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
}

/// Skip `/v2/fungible/msgs` response.
///
/// `txs` is validated down to the cosmos message envelope the frontend signs
/// and broadcasts; bridge-specific entries (`evm_tx`, `operations_indices`, …)
/// and any other top-level keys are preserved through `additional`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipMessagesResponse {
    pub txs: Vec<SkipTx>,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
}

/// One transaction in a Skip messages response. A cosmos transaction is typed;
/// other transaction kinds (e.g. `evm_tx`) and extra fields ride in `additional`.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipTx {
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub cosmos_tx: Option<SkipCosmosTx>,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
}

/// The cosmos transaction envelope the frontend signs and broadcasts.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipCosmosTx {
    pub chain_id: String,
    pub msgs: Vec<SkipMsg>,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
}

/// A single cosmos message: the type URL the frontend dispatches on and its
/// encoded body.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SkipMsg {
    pub msg: String,
    pub msg_type_url: String,
    #[serde(flatten)]
    #[schema(value_type = Object)]
    pub additional: serde_json::Map<String, serde_json::Value>,
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
            "state": "STATE_COMPLETED_SUCCESS",
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
        assert_eq!(resp.state, "STATE_COMPLETED_SUCCESS");
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
        assert_eq!(resp.state, "STATE_COMPLETED_SUCCESS");
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
        assert_eq!(resp.state, "STATE_COMPLETED_SUCCESS");
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

    // ---- 105: null optional fields accepted, state required ----

    #[tokio::test]
    async fn skip_status_response_accepts_null_optional_fields() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "state": "STATE_PENDING",
                "transfer_sequence": null,
                "error": null
            })))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let resp = client.get_status("h", "c").await.unwrap();
        assert_eq!(resp.state, "STATE_PENDING");
        assert!(resp.transfer_sequence.is_none());
        assert!(resp.error.is_none());
    }

    #[tokio::test]
    async fn skip_status_response_missing_state_rejected() {
        // The frontend tracking loop dispatches on `state`; a payload without
        // it would spin the 60-retry poll to exhaustion. Fail loud instead.
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "status": "STATE_PENDING",
                "transfer_sequence": []
            })))
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let err = client.get_status("h", "c").await.unwrap_err();
        assert_skip_error(&err);
    }

    // ---- 106: rejects wrong types ----

    #[tokio::test]
    async fn skip_status_response_unexpected_field_types_rejected() {
        let server = MockServer::start().await;
        Mock::given(method("GET"))
            .and(path("/v2/tx/status"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(serde_json::json!({ "state": 123 })),
            )
            .mount(&server)
            .await;

        let client = test_client(&server.uri(), None);
        let err = client.get_status("h", "c").await.unwrap_err();
        assert_skip_error(&err);
    }

    #[test]
    fn skip_status_response_parses_and_preserves_unconsumed_fields() {
        // Shape per https://docs.skip.build /v2/tx/status: wrapped per-hop
        // transfer events, structured error, extra top-level tracking fields.
        let raw = serde_json::json!({
            "state": "STATE_COMPLETED_ERROR",
            "error": { "type": "STATUS_ERROR_TRANSACTION_EXECUTION", "message": "out of gas" },
            "transfer_sequence": [
                {
                    "ibc_transfer": {
                        "src_chain_id": "pirin-1",
                        "dst_chain_id": "osmosis-1",
                        "state": "TRANSFER_FAILURE",
                        "packet_txs": { "send_tx": { "tx_hash": "AA" } }
                    }
                },
                { "cctp_transfer": { "src_chain_id": "1", "state": "CCTP_TRANSFER_SENT" } }
            ],
            "transfers": [{ "state": "STATE_COMPLETED_ERROR" }],
            "transfer_asset_release": { "chain_id": "pirin-1", "denom": "unls", "released": true }
        });

        let parsed: SkipStatusResponse =
            serde_json::from_value(raw.clone()).expect("valid status response deserializes");

        assert_eq!(parsed.state, "STATE_COMPLETED_ERROR");
        assert_eq!(
            parsed.error.as_ref().and_then(|e| e.message.as_deref()),
            Some("out of gas")
        );
        let sequence = parsed
            .transfer_sequence
            .as_ref()
            .expect("transfer_sequence present");
        let ibc = sequence[0]
            .ibc_transfer
            .as_ref()
            .expect("first hop is an ibc_transfer");
        assert_eq!(ibc.dst_chain_id, "osmosis-1");
        // Non-IBC hops and extra tracking fields survive verbatim.
        assert!(sequence[1].additional.contains_key("cctp_transfer"));
        assert!(parsed.additional.contains_key("transfers"));
        assert!(parsed.additional.contains_key("transfer_asset_release"));
        // Re-serialization is shape-equal to the upstream payload (no field loss).
        assert_eq!(serde_json::to_value(&parsed).expect("re-serializes"), raw);
    }

    // ---- 107: route response validates envelope, keeps operations + extras ----

    #[test]
    fn skip_route_response_parses_and_preserves_unconsumed_fields() {
        let raw = serde_json::json!({
            "amount_in": "1000",
            "amount_out": "990",
            "source_asset_denom": "uatom",
            "source_asset_chain_id": "cosmoshub-4",
            "dest_asset_denom": "uosmo",
            "dest_asset_chain_id": "osmosis-1",
            "chain_ids": ["cosmoshub-4", "osmosis-1"],
            "operations": [{ "transfer": { "port": "transfer", "channel": "channel-0" } }],
            "does_swap": true,
            "estimated_amount_out": "990",
            "usd_amount_in": "10.00"
        });

        let parsed: SkipRouteResponse =
            serde_json::from_value(raw.clone()).expect("valid route response deserializes");

        assert_eq!(parsed.amount_in, "1000");
        assert_eq!(parsed.chain_ids, ["cosmoshub-4", "osmosis-1"]);
        // operations is opaque and echoed back to /msgs — it must round-trip verbatim.
        assert_eq!(
            parsed.operations,
            raw["operations"].as_array().cloned().unwrap()
        );
        // Unconsumed display fields survive in `additional`, not dropped.
        assert_eq!(
            parsed.additional.get("does_swap"),
            Some(&serde_json::json!(true))
        );
        // Re-serialization is shape-equal to the upstream payload (no field loss).
        assert_eq!(serde_json::to_value(&parsed).expect("re-serializes"), raw);
    }

    #[test]
    fn skip_route_response_rejects_missing_required_field() {
        // `amount_in` omitted — a partial route must not reach the money path.
        let raw = serde_json::json!({
            "amount_out": "990",
            "source_asset_denom": "uatom",
            "source_asset_chain_id": "cosmoshub-4",
            "dest_asset_denom": "uosmo",
            "dest_asset_chain_id": "osmosis-1",
            "chain_ids": ["osmosis-1"],
            "operations": []
        });
        let err = serde_json::from_value::<SkipRouteResponse>(raw).unwrap_err();
        assert!(err.to_string().contains("amount_in"), "err: {err}");
    }

    // ---- 108: messages response validates cosmos msgs, preserves other tx kinds ----

    #[test]
    fn skip_messages_response_validates_cosmos_msgs_and_preserves_evm() {
        let raw = serde_json::json!({
            "txs": [
                {
                    "cosmos_tx": {
                        "chain_id": "osmosis-1",
                        "msgs": [{ "msg": "{}", "msg_type_url": "/ibc.applications.transfer.v1.MsgTransfer" }],
                        "signer_address": "osmo1abc"
                    },
                    "operations_indices": [0]
                },
                { "evm_tx": { "chain_id": "1", "to": "0xabc", "data": "0x" } }
            ]
        });

        let parsed: SkipMessagesResponse =
            serde_json::from_value(raw.clone()).expect("valid messages response deserializes");

        let cosmos = parsed.txs[0]
            .cosmos_tx
            .as_ref()
            .expect("first tx carries a cosmos_tx");
        assert_eq!(cosmos.chain_id, "osmosis-1");
        assert_eq!(
            cosmos.msgs[0].msg_type_url,
            "/ibc.applications.transfer.v1.MsgTransfer"
        );
        // The evm-only tx has no cosmos_tx but is preserved verbatim via `additional`.
        assert!(parsed.txs[1].cosmos_tx.is_none());
        assert!(parsed.txs[1].additional.contains_key("evm_tx"));
        assert_eq!(serde_json::to_value(&parsed).expect("re-serializes"), raw);
    }

    #[test]
    fn skip_messages_response_rejects_cosmos_tx_missing_msg_type_url() {
        // A cosmos message without its type URL cannot be dispatched — reject it.
        let raw = serde_json::json!({
            "txs": [{ "cosmos_tx": { "chain_id": "osmosis-1", "msgs": [{ "msg": "{}" }] } }]
        });
        let err = serde_json::from_value::<SkipMessagesResponse>(raw).unwrap_err();
        assert!(err.to_string().contains("msg_type_url"), "err: {err}");
    }
}
