//! Solana JSON-RPC client for direct queries against the operator's Solana RPC.
//!
//! Solana RPC is JSON-RPC 2.0 (all-POST, `method` + `params` body), so it does
//! not fit the [`crate::external::base_client::ExternalApiClient`]
//! GET/endpoint-string trait. It instead mirrors [`crate::external::chain`]'s
//! bespoke shape: its own bounded-concurrency semaphore, its own 429/503 retry
//! with exponential backoff, and typed [`AppError`] mapping. Solana RPC and the
//! Nolus LCD are independent upstreams, so this client keeps a *separate*
//! semaphore/env var rather than sharing the chain client's. No raw RPC proxy
//! is exposed to the frontend.

use std::collections::BTreeSet;
use std::sync::Arc;
use std::time::Duration;

use reqwest::Client;
use serde::de::DeserializeOwned;
use serde::Deserialize;
use serde_json::{json, Value};
use tokio::sync::Semaphore;
use tracing::warn;

use crate::error::AppError;

/// Chain label embedded in `AppError::ChainRpc` for Solana upstream failures.
const CHAIN: &str = "solana";

/// Commitment level requested on every read. `confirmed` trades a small
/// freshness lag for far fewer rollbacks than `processed`, matching the read
/// semantics the balances and transfer-params endpoints need.
const COMMITMENT: &str = "confirmed";

/// Default cap on concurrent outbound Solana RPC requests. Prevents burst
/// overload on cold start and refresh cycles. Override with
/// `SOLANA_MAX_CONCURRENT_QUERIES`.
const DEFAULT_MAX_CONCURRENT_SOLANA_QUERIES: usize = 256;

/// Maximum retries for transient HTTP errors (429, 503).
const MAX_RETRIES: u32 = 3;

/// Initial backoff delay in milliseconds before the first retry.
const INITIAL_BACKOFF_MS: u64 = 100;

/// HTTP status codes that trigger retry with backoff.
const RETRYABLE_STATUS_CODES: [u16; 2] = [429, 503];

/// Milliseconds per second, for `Retry-After` (seconds) → millisecond conversion.
const MS_PER_SEC: u64 = 1000;

/// Cap on upstream error text embedded in a `ChainRpc` message. RPC error
/// messages and bodies can echo request input (e.g. an address carried in
/// `params`), so an unbounded copy would flow uncapped into the client error
/// envelope and server logs.
const ERROR_BODY_MAX_CHARS: usize = 256;

/// Read `SOLANA_MAX_CONCURRENT_QUERIES`, falling back to the default. Mirrors
/// [`crate::external::chain`]'s concurrency reader.
fn solana_query_concurrency() -> usize {
    std::env::var("SOLANA_MAX_CONCURRENT_QUERIES")
        .ok()
        .and_then(|v| v.parse::<usize>().ok())
        .filter(|&n| n > 0)
        .unwrap_or(DEFAULT_MAX_CONCURRENT_SOLANA_QUERIES)
}

/// Cap `body` at `ERROR_BODY_MAX_CHARS` characters, cutting on a char boundary.
fn truncate_error_body(body: &str) -> &str {
    body.char_indices()
        .nth(ERROR_BODY_MAX_CHARS)
        .map_or(body, |(boundary, _char)| &body[..boundary])
}

/// Jitter using system-time nanoseconds (no `rand` crate). Mirrors
/// [`crate::external::chain`]'s jitter helper so the two clients share retry
/// behavior without one depending on the other's internals.
fn rand_jitter(max: u64) -> u64 {
    if max == 0 {
        return 0;
    }
    let nanos = u64::from(
        std::time::SystemTime::now()
            .duration_since(std::time::UNIX_EPOCH)
            .unwrap_or_default()
            .subsec_nanos(),
    );
    nanos % max
}

/// Filter for `getTokenAccountsByOwner`: exactly one of a specific mint or an
/// owning token program, per the RPC's `RpcTokenAccountsFilter`.
pub enum TokenAccountsFilter {
    /// Match token accounts holding this mint (finds the account regardless of
    /// which token program owns it — classic SPL Token or Token-2022).
    Mint(String),
    /// Match all token accounts owned by this token program.
    ProgramId(String),
}

/// A parsed SPL token balance from `getTokenAccountsByOwner`.
#[derive(Debug, Clone)]
pub struct SolanaTokenBalance {
    pub mint: String,
    /// Raw amount in the mint's base units, as a decimal string.
    pub amount: String,
    pub decimals: u8,
}

/// `getLatestBlockhash` value.
#[derive(Debug, Clone, Deserialize)]
pub struct SolanaLatestBlockhash {
    pub blockhash: String,
    #[serde(rename = "lastValidBlockHeight")]
    pub last_valid_block_height: u64,
}

/// `getEpochInfo` result. Carries the current absolute slot and epoch in one
/// atomic call — the transfer-params endpoint needs both fresh together.
#[derive(Debug, Clone, Deserialize)]
pub struct SolanaEpochInfo {
    #[serde(rename = "absoluteSlot")]
    pub absolute_slot: u64,
    pub epoch: u64,
}

/// A Solana account as returned by `getAccountInfo` with `base64` encoding.
#[derive(Debug, Clone, Deserialize)]
pub struct SolanaAccount {
    pub lamports: u64,
    pub owner: String,
    pub executable: bool,
    /// `[base64_payload, "base64"]` under the `base64` encoding.
    pub data: Vec<String>,
}

/// `simulateTransaction` value.
#[derive(Debug, Clone, Deserialize)]
pub struct SolanaSimulationResult {
    /// `None` on success; a structured transaction error otherwise.
    pub err: Option<Value>,
    pub logs: Option<Vec<String>>,
    #[serde(rename = "unitsConsumed")]
    pub units_consumed: Option<u64>,
}

/// A single entry from `getSignatureStatuses`.
#[derive(Debug, Clone, Deserialize)]
pub struct SolanaSignatureStatus {
    pub slot: u64,
    pub confirmations: Option<u64>,
    #[serde(rename = "confirmationStatus")]
    pub confirmation_status: Option<String>,
    pub err: Option<Value>,
}

/// JSON-RPC 2.0 client for the operator's Solana RPC endpoint.
#[derive(Clone)]
pub struct SolanaClient {
    /// `None` when `SOLANA_RPC_URL` is unset — every call then fails visibly
    /// with `AppError::ServiceUnavailable` rather than a silent fallback.
    rpc_url: Option<String>,
    client: Client,
    query_semaphore: Arc<Semaphore>,
}

/// The context wrapper Solana wraps most read results in: `{context, value}`.
#[derive(Deserialize)]
struct RpcContextValue<T> {
    value: T,
}

/// JSON-RPC error object.
#[derive(Deserialize)]
struct RpcError {
    code: i64,
    message: String,
}

/// JSON-RPC 2.0 response envelope.
#[derive(Deserialize)]
struct RpcEnvelope<T> {
    result: Option<T>,
    error: Option<RpcError>,
}

impl SolanaClient {
    pub fn new(rpc_url: Option<String>, client: Client) -> Self {
        Self {
            rpc_url,
            client,
            query_semaphore: Arc::new(Semaphore::new(solana_query_concurrency())),
        }
    }

    /// Whether a Solana RPC endpoint is configured. When `false`, every query
    /// returns `AppError::ServiceUnavailable`.
    pub const fn is_configured(&self) -> bool {
        self.rpc_url.is_some()
    }

    /// Execute a JSON-RPC call and return the raw `result`.
    ///
    /// Acquires a semaphore permit held across the full retry chain; retries
    /// 429/503 with exponential backoff + jitter (honoring `Retry-After`); maps
    /// transport failures, non-2xx responses, and JSON-RPC `error` objects to
    /// typed [`AppError::ChainRpc`].
    async fn request<R: DeserializeOwned>(
        &self,
        method: &str,
        params: Value,
    ) -> Result<R, AppError> {
        let url = self
            .rpc_url
            .as_deref()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Solana RPC not configured (set SOLANA_RPC_URL)".to_string(),
            })?;

        let _permit = self
            .query_semaphore
            .acquire()
            .await
            .map_err(|e| AppError::Internal(format!("Semaphore closed: {e}")))?;

        let body = json!({
            "jsonrpc": "2.0",
            "id": 1,
            "method": method,
            "params": params,
        });

        let mut backoff_ms = INITIAL_BACKOFF_MS;

        for attempt in 0..=MAX_RETRIES {
            let response = self
                .client
                .post(url)
                .json(&body)
                .send()
                .await
                .map_err(|e| AppError::ChainRpc {
                    chain: CHAIN.to_string(),
                    message: format!("Request failed: {e}"),
                })?;

            let status = response.status().as_u16();

            if !RETRYABLE_STATUS_CODES.contains(&status) {
                return Self::parse_envelope(response, method).await;
            }

            if attempt == MAX_RETRIES {
                let body_text = response.text().await.unwrap_or_default();
                return Err(AppError::ChainRpc {
                    chain: CHAIN.to_string(),
                    message: format!(
                        "{method}: HTTP {status} after {MAX_RETRIES} retries: {}",
                        truncate_error_body(&body_text)
                    ),
                });
            }

            let retry_after_ms = response
                .headers()
                .get("retry-after")
                .and_then(|v| v.to_str().ok())
                .and_then(|v| v.parse::<u64>().ok())
                .map(|secs| secs * MS_PER_SEC);

            let wait_ms = retry_after_ms.unwrap_or(backoff_ms);
            let actual_wait = wait_ms + rand_jitter(wait_ms / 4);

            warn!(
                "Solana RPC {} got HTTP {}, retry {}/{} after {}ms",
                method,
                status,
                attempt + 1,
                MAX_RETRIES,
                actual_wait
            );

            tokio::time::sleep(Duration::from_millis(actual_wait)).await;
            backoff_ms *= 2;
        }

        // The `attempt == MAX_RETRIES` branch returns on the final iteration, so
        // this is only reached if the retry invariant is ever broken.
        Err(AppError::ChainRpc {
            chain: CHAIN.to_string(),
            message: format!("{method}: retry loop exhausted after {MAX_RETRIES} retries"),
        })
    }

    /// Parse a non-retryable response into `R`, mapping HTTP and JSON-RPC-level
    /// failures to typed errors.
    async fn parse_envelope<R: DeserializeOwned>(
        response: reqwest::Response,
        method: &str,
    ) -> Result<R, AppError> {
        let status = response.status();
        if !status.is_success() {
            let body = response.text().await.unwrap_or_default();
            return Err(AppError::ChainRpc {
                chain: CHAIN.to_string(),
                message: format!("{method}: HTTP {status}: {}", truncate_error_body(&body)),
            });
        }

        let envelope: RpcEnvelope<R> = response.json().await.map_err(|e| AppError::ChainRpc {
            chain: CHAIN.to_string(),
            message: format!("{method}: failed to parse response: {e}"),
        })?;

        if let Some(err) = envelope.error {
            return Err(AppError::ChainRpc {
                chain: CHAIN.to_string(),
                message: format!(
                    "{method}: RPC error {}: {}",
                    err.code,
                    truncate_error_body(&err.message)
                ),
            });
        }

        envelope.result.ok_or_else(|| AppError::ChainRpc {
            chain: CHAIN.to_string(),
            message: format!("{method}: response missing both result and error"),
        })
    }

    /// Current epoch info (absolute slot + epoch), fetched atomically.
    pub async fn get_epoch_info(&self) -> Result<SolanaEpochInfo, AppError> {
        self.request("getEpochInfo", json!([{ "commitment": COMMITMENT }]))
            .await
    }

    /// Native SOL balance, in lamports.
    pub async fn get_balance(&self, address: &str) -> Result<u64, AppError> {
        let wrapped: RpcContextValue<u64> = self
            .request("getBalance", json!([address, { "commitment": COMMITMENT }]))
            .await?;
        Ok(wrapped.value)
    }

    /// Latest blockhash and its last valid block height.
    pub async fn get_latest_blockhash(&self) -> Result<SolanaLatestBlockhash, AppError> {
        let wrapped: RpcContextValue<SolanaLatestBlockhash> = self
            .request("getLatestBlockhash", json!([{ "commitment": COMMITMENT }]))
            .await?;
        Ok(wrapped.value)
    }

    /// SPL token balances owned by `owner` matching `filter`, parsed via the
    /// RPC's `jsonParsed` encoding.
    pub async fn get_token_accounts_by_owner(
        &self,
        owner: &str,
        filter: &TokenAccountsFilter,
    ) -> Result<Vec<SolanaTokenBalance>, AppError> {
        let filter_json = match filter {
            TokenAccountsFilter::Mint(mint) => json!({ "mint": mint }),
            TokenAccountsFilter::ProgramId(program_id) => json!({ "programId": program_id }),
        };

        #[derive(Deserialize)]
        struct Accounts {
            account: AccountData,
        }
        #[derive(Deserialize)]
        struct AccountData {
            data: ParsedData,
        }
        #[derive(Deserialize)]
        struct ParsedData {
            parsed: Parsed,
        }
        #[derive(Deserialize)]
        struct Parsed {
            info: TokenInfo,
        }
        #[derive(Deserialize)]
        struct TokenInfo {
            mint: String,
            #[serde(rename = "tokenAmount")]
            token_amount: TokenAmount,
        }
        #[derive(Deserialize)]
        struct TokenAmount {
            amount: String,
            decimals: u8,
        }

        let wrapped: RpcContextValue<Vec<Accounts>> = self
            .request(
                "getTokenAccountsByOwner",
                json!([
                    owner,
                    filter_json,
                    { "encoding": "jsonParsed", "commitment": COMMITMENT },
                ]),
            )
            .await?;

        Ok(wrapped
            .value
            .into_iter()
            .map(|entry| SolanaTokenBalance {
                mint: entry.account.data.parsed.info.mint,
                amount: entry.account.data.parsed.info.token_amount.amount,
                decimals: entry.account.data.parsed.info.token_amount.decimals,
            })
            .collect())
    }

    /// Fetch an account (base64 encoding). `None` when the account does not
    /// exist — the token-account-existence (ATA) check.
    pub async fn get_account_info(&self, address: &str) -> Result<Option<SolanaAccount>, AppError> {
        let wrapped: RpcContextValue<Option<SolanaAccount>> = self
            .request(
                "getAccountInfo",
                json!([address, { "encoding": "base64", "commitment": COMMITMENT }]),
            )
            .await?;
        Ok(wrapped.value)
    }

    /// Fetch the raw account bytes of an address-lookup-table account. `None`
    /// when the ALT account does not exist. Decoding the table into its address
    /// list is left to the versioned-transaction builder that will consume it.
    pub async fn get_address_lookup_table(
        &self,
        address: &str,
    ) -> Result<Option<Vec<u8>>, AppError> {
        let Some(account) = self.get_account_info(address).await? else {
            return Ok(None);
        };
        let encoded = account.data.first().ok_or_else(|| AppError::ChainRpc {
            chain: CHAIN.to_string(),
            message: "address lookup table account carries no data".to_string(),
        })?;
        let bytes = base64::Engine::decode(&base64::engine::general_purpose::STANDARD, encoded)
            .map_err(|e| AppError::ChainRpc {
                chain: CHAIN.to_string(),
                message: format!("failed to decode ALT account data: {e}"),
            })?;
        Ok(Some(bytes))
    }

    /// Simulate a base64-encoded transaction without broadcasting it.
    pub async fn simulate_transaction(
        &self,
        transaction_base64: &str,
    ) -> Result<SolanaSimulationResult, AppError> {
        let wrapped: RpcContextValue<SolanaSimulationResult> = self
            .request(
                "simulateTransaction",
                json!([
                    transaction_base64,
                    { "encoding": "base64", "commitment": COMMITMENT },
                ]),
            )
            .await?;
        Ok(wrapped.value)
    }

    /// Broadcast a base64-encoded signed transaction, returning its signature.
    /// The fallback submission path when a client cannot broadcast directly.
    pub async fn send_raw_transaction(&self, transaction_base64: &str) -> Result<String, AppError> {
        self.request(
            "sendTransaction",
            json!([transaction_base64, { "encoding": "base64" }]),
        )
        .await
    }

    /// Confirmation status for each requested signature (`None` per entry when
    /// the signature is unknown to the node).
    pub async fn get_signature_statuses(
        &self,
        signatures: &[String],
    ) -> Result<Vec<Option<SolanaSignatureStatus>>, AppError> {
        let wrapped: RpcContextValue<Vec<Option<SolanaSignatureStatus>>> = self
            .request(
                "getSignatureStatuses",
                json!([signatures, { "searchTransactionHistory": false }]),
            )
            .await?;
        Ok(wrapped.value)
    }
}

/// The deployed Solray program id. Every packet PDA fetched from Solana must be
/// owned by this program before its bytes are decoded — the decoders operate on
/// raw bytes and cannot tell a packet PDA from any other account whose data
/// happens to decode as the same B-tree.
pub const SOLRAY_PROGRAM_ID: &str = "JEKNVnkbo3jma5nREBBJCDoXFVeKkD56V3xKrvRmWxFF";

/// A decoded packet PDA, indexed by sequence. An `Absent` account (the
/// `getAccountInfo` value was null) is distinct from a `Present` but empty PDA:
/// the first means the channel has no such PDA, the second means the PDA exists
/// and currently holds no entries.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum PacketPdaSnapshot {
    Absent,
    Present(BTreeSet<u64>),
}

/// Decode a fetched packet-commitment PDA into the set of sequences that still
/// hold an outstanding commitment. Owner-checked against [`SOLRAY_PROGRAM_ID`];
/// `None` maps to [`PacketPdaSnapshot::Absent`]. Pure over the fetched
/// `account` — no RPC — so a poll cycle decodes once and indexes by sequence.
pub fn decode_commitment_pda(
    account: Option<&SolanaAccount>,
) -> Result<PacketPdaSnapshot, AppError> {
    let _ = account;
    todo!("Absent for None; else owner-check then ibc_solray::api::query::decode_packet_commitments")
}

/// Decode a fetched packet-acknowledgement PDA into the set of acknowledged
/// sequences. Presence proves an ack exists; the success-vs-error polarity is
/// NOT decodable here (the PDA stores only a commitment hash). Owner-checked;
/// `None` maps to [`PacketPdaSnapshot::Absent`].
pub fn decode_acknowledgement_pda(
    account: Option<&SolanaAccount>,
) -> Result<PacketPdaSnapshot, AppError> {
    let _ = account;
    todo!("Absent for None; else owner-check then decode+index the ack PDA")
}

#[cfg(test)]
mod tests {
    use super::*;
    use wiremock::matchers::{body_partial_json, method};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn client_for(server: &MockServer) -> SolanaClient {
        SolanaClient::new(Some(server.uri()), Client::new())
    }

    /// Mount a JSON-RPC response for a specific `method`, matched on the request
    /// body so multiple methods can coexist on one mock server.
    async fn mount_result(server: &MockServer, rpc_method: &str, result: Value) {
        Mock::given(method("POST"))
            .and(body_partial_json(json!({ "method": rpc_method })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": result,
            })))
            .mount(server)
            .await;
    }

    #[tokio::test]
    async fn unconfigured_client_fails_visibly() {
        let client = SolanaClient::new(None, Client::new());
        assert!(!client.is_configured());
        match client.get_epoch_info().await {
            Err(AppError::ServiceUnavailable { message }) => {
                assert!(message.contains("SOLANA_RPC_URL"), "message was: {message}");
            }
            other => panic!("expected ServiceUnavailable for unconfigured client, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn get_epoch_info_carries_slot_and_epoch() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "getEpochInfo",
            json!({ "absoluteSlot": 250_000_000_u64, "epoch": 579, "blockHeight": 1 }),
        )
        .await;
        let info = client_for(&server)
            .get_epoch_info()
            .await
            .expect("epoch info");
        assert_eq!(info.absolute_slot, 250_000_000);
        assert_eq!(info.epoch, 579);
    }

    #[tokio::test]
    async fn get_balance_unwraps_context_value() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "getBalance",
            json!({ "context": { "slot": 1 }, "value": 42_000_000_u64 }),
        )
        .await;
        let lamports = client_for(&server)
            .get_balance("So11111111111111111111111111111111111111112")
            .await
            .expect("balance");
        assert_eq!(lamports, 42_000_000);
    }

    #[tokio::test]
    async fn get_token_accounts_parses_json_parsed_amounts() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "getTokenAccountsByOwner",
            json!({
                "context": { "slot": 1 },
                "value": [
                    {
                        "pubkey": "AtaAddr1111111111111111111111111111111111111",
                        "account": {
                            "data": {
                                "program": "spl-token",
                                "parsed": {
                                    "type": "account",
                                    "info": {
                                        "mint": "MintAddr11111111111111111111111111111111111",
                                        "owner": "OwnerAddr1111111111111111111111111111111111",
                                        "tokenAmount": {
                                            "amount": "1500000",
                                            "decimals": 6,
                                            "uiAmountString": "1.5"
                                        }
                                    }
                                }
                            }
                        }
                    }
                ]
            }),
        )
        .await;

        let filter =
            TokenAccountsFilter::Mint("MintAddr11111111111111111111111111111111111".into());
        let balances = client_for(&server)
            .get_token_accounts_by_owner("OwnerAddr1111111111111111111111111111111111", &filter)
            .await
            .expect("token accounts");
        assert_eq!(balances.len(), 1);
        assert_eq!(
            balances[0].mint,
            "MintAddr11111111111111111111111111111111111"
        );
        assert_eq!(balances[0].amount, "1500000");
        assert_eq!(balances[0].decimals, 6);
    }

    #[tokio::test]
    async fn get_account_info_maps_absent_account_to_none() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "getAccountInfo",
            json!({ "context": { "slot": 1 }, "value": null }),
        )
        .await;
        let account = client_for(&server)
            .get_account_info("MissingAddr11111111111111111111111111111111")
            .await
            .expect("account info");
        assert!(account.is_none());
    }

    #[tokio::test]
    async fn json_rpc_error_object_maps_to_chain_rpc() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "error": { "code": -32602, "message": "Invalid params: bad address" },
            })))
            .mount(&server)
            .await;

        match client_for(&server).get_epoch_info().await {
            Err(AppError::ChainRpc { chain, message }) => {
                assert_eq!(chain, "solana");
                assert!(message.contains("-32602"), "message was: {message}");
                assert!(message.contains("Invalid params"), "message was: {message}");
            }
            other => panic!("expected ChainRpc for a JSON-RPC error object, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn retryable_status_exhausts_to_typed_error() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(503))
            .mount(&server)
            .await;

        match client_for(&server).get_epoch_info().await {
            Err(AppError::ChainRpc { chain, message }) => {
                assert_eq!(chain, "solana");
                assert!(
                    message.contains(&format!("{MAX_RETRIES} retries")),
                    "expected retry count in message, got: {message}"
                );
            }
            other => panic!("expected ChainRpc after retry exhaustion, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn retry_then_success_recovers() {
        // First response 503, then a good result: the bounded retry loop must
        // recover rather than surface the transient failure.
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .respond_with(ResponseTemplate::new(503))
            .up_to_n_times(1)
            .mount(&server)
            .await;
        mount_result(
            &server,
            "getEpochInfo",
            json!({ "absoluteSlot": 7_u64, "epoch": 1 }),
        )
        .await;

        let info = client_for(&server)
            .get_epoch_info()
            .await
            .expect("epoch info after retry");
        assert_eq!(info.absolute_slot, 7);
    }

    /// Mount a JSON-RPC error object for `rpc_method`.
    async fn mount_error(server: &MockServer, rpc_method: &str, code: i64, msg: &str) {
        Mock::given(method("POST"))
            .and(body_partial_json(json!({ "method": rpc_method })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "error": { "code": code, "message": msg },
            })))
            .mount(server)
            .await;
    }

    /// Assert a result is a Solana `ChainRpc` error carrying `needle`.
    fn assert_chain_rpc<T: std::fmt::Debug>(result: Result<T, AppError>, needle: &str) {
        match result {
            Err(AppError::ChainRpc { chain, message }) => {
                assert_eq!(chain, "solana");
                assert!(message.contains(needle), "message was: {message}");
            }
            other => panic!("expected ChainRpc carrying {needle:?}, got {other:?}"),
        }
    }

    #[tokio::test]
    async fn get_latest_blockhash_parses_value() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "getLatestBlockhash",
            json!({
                "context": { "slot": 1 },
                "value": { "blockhash": "Hash11111111111111111111111111111111111111", "lastValidBlockHeight": 321 },
            }),
        )
        .await;
        let latest = client_for(&server)
            .get_latest_blockhash()
            .await
            .expect("blockhash");
        assert_eq!(
            latest.blockhash,
            "Hash11111111111111111111111111111111111111"
        );
        assert_eq!(latest.last_valid_block_height, 321);
    }

    #[tokio::test]
    async fn get_latest_blockhash_maps_rpc_error() {
        let server = MockServer::start().await;
        mount_error(&server, "getLatestBlockhash", -32000, "node behind").await;
        assert_chain_rpc(
            client_for(&server).get_latest_blockhash().await,
            "node behind",
        );
    }

    #[tokio::test]
    async fn get_address_lookup_table_returns_decoded_bytes() {
        let server = MockServer::start().await;
        // "AQID" is base64 for [1, 2, 3].
        mount_result(
            &server,
            "getAccountInfo",
            json!({
                "context": { "slot": 1 },
                "value": {
                    "lamports": 10,
                    "owner": "AddressLookupTab1e1111111111111111111111111",
                    "executable": false,
                    "rentEpoch": 0,
                    "data": ["AQID", "base64"],
                },
            }),
        )
        .await;
        let bytes = client_for(&server)
            .get_address_lookup_table("Tab1e11111111111111111111111111111111111111")
            .await
            .expect("alt fetch")
            .expect("alt present");
        assert_eq!(bytes, vec![1, 2, 3]);
    }

    #[tokio::test]
    async fn get_address_lookup_table_maps_rpc_error() {
        let server = MockServer::start().await;
        mount_error(&server, "getAccountInfo", -32000, "alt unavailable").await;
        assert_chain_rpc(
            client_for(&server)
                .get_address_lookup_table("Tab1e11111111111111111111111111111111111111")
                .await,
            "alt unavailable",
        );
    }

    #[tokio::test]
    async fn simulate_transaction_parses_value() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "simulateTransaction",
            json!({
                "context": { "slot": 1 },
                "value": { "err": null, "logs": ["Program log: ok"], "unitsConsumed": 4200 },
            }),
        )
        .await;
        let sim = client_for(&server)
            .simulate_transaction("AQAB")
            .await
            .expect("simulation");
        assert!(sim.err.is_none());
        assert_eq!(sim.units_consumed, Some(4200));
        assert_eq!(
            sim.logs.as_deref(),
            Some(&["Program log: ok".to_string()][..])
        );
    }

    #[tokio::test]
    async fn simulate_transaction_maps_rpc_error() {
        let server = MockServer::start().await;
        mount_error(&server, "simulateTransaction", -32602, "bad transaction").await;
        assert_chain_rpc(
            client_for(&server).simulate_transaction("AQAB").await,
            "bad transaction",
        );
    }

    #[tokio::test]
    async fn send_raw_transaction_returns_signature() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "sendTransaction",
            json!("Sig1111111111111111111111111111111111111111"),
        )
        .await;
        let signature = client_for(&server)
            .send_raw_transaction("AQAB")
            .await
            .expect("signature");
        assert_eq!(signature, "Sig1111111111111111111111111111111111111111");
    }

    #[tokio::test]
    async fn send_raw_transaction_maps_rpc_error() {
        let server = MockServer::start().await;
        mount_error(&server, "sendTransaction", -32003, "blockhash not found").await;
        assert_chain_rpc(
            client_for(&server).send_raw_transaction("AQAB").await,
            "blockhash not found",
        );
    }

    #[tokio::test]
    async fn get_signature_statuses_parses_present_and_absent() {
        let server = MockServer::start().await;
        mount_result(
            &server,
            "getSignatureStatuses",
            json!({
                "context": { "slot": 1 },
                "value": [
                    { "slot": 100, "confirmations": 5, "confirmationStatus": "confirmed", "err": null },
                    null,
                ],
            }),
        )
        .await;
        let statuses = client_for(&server)
            .get_signature_statuses(&["Sig1".to_string(), "Sig2".to_string()])
            .await
            .expect("statuses");
        assert_eq!(statuses.len(), 2);
        let present = statuses[0].as_ref().expect("first status present");
        assert_eq!(present.slot, 100);
        assert_eq!(present.confirmation_status.as_deref(), Some("confirmed"));
        assert!(statuses[1].is_none());
    }

    #[tokio::test]
    async fn get_signature_statuses_maps_rpc_error() {
        let server = MockServer::start().await;
        mount_error(
            &server,
            "getSignatureStatuses",
            -32602,
            "too many signatures",
        )
        .await;
        assert_chain_rpc(
            client_for(&server)
                .get_signature_statuses(&["Sig1".to_string()])
                .await,
            "too many signatures",
        );
    }
}

/// Known-answer tests for the pinned `ibc-solray` SDK's PDA derivation.
///
/// These lock the pinned rev's on-chain address math: given the deployed Solray
/// program id, deriving the Program and Vault-Authority PDAs through the SDK
/// must yield these exact base58 addresses. A future pin bump that alters
/// derivation (seed layout, program id) fails here rather than silently
/// mis-addressing accounts. The vectors were produced by the pinned rev itself,
/// so this both proves the `sdk`-feature build works off-chain and pins its
/// output. A live-on-chain smoke test is a deploy-time concern needing a funded
/// RPC; these fixed vectors cover the offline gate.
#[cfg(test)]
mod sdk_pin_tests {
    use ibc_solray::api::{self, Id};
    use solana_pubkey::Pubkey;
    use std::str::FromStr as _;

    /// The deployed Solray program id (base58), the derivation root for its PDAs.
    const SOLRAY_PROGRAM_ID: &str = "JEKNVnkbo3jma5nREBBJCDoXFVeKkD56V3xKrvRmWxFF";
    /// Program PDA derived from `SOLRAY_PROGRAM_ID` via `api::this_program_id`.
    const EXPECTED_PROGRAM_PDA: &str = "2qoPsUrY5p5Khb1RninSiPuYBYDrrm4HqGsHKNW6yc9B";
    /// Vault-Authority PDA derived from `SOLRAY_PROGRAM_ID`.
    const EXPECTED_VAULT_AUTHORITY: &str = "FB9sB7fATJbiRETQw7gg497tipiHaMmdbhsxvCP8YVUY";

    fn program() -> Pubkey {
        Pubkey::from_str(SOLRAY_PROGRAM_ID).expect("solray program id parses")
    }

    #[test]
    fn program_pda_matches_known_vector() {
        let id = Id::find(program(), api::this_program_id());
        let derived = id.derive_address();
        assert_eq!(derived.to_string(), EXPECTED_PROGRAM_PDA);
        // Round-trip: the found bump re-derives the same address off the seeds.
        assert!(id.point_to(&derived));
    }

    #[test]
    fn vault_authority_pda_matches_known_vector() {
        let id = Id::find(program(), api::vault_authority_id());
        let derived = id.derive_address();
        assert_eq!(derived.to_string(), EXPECTED_VAULT_AUTHORITY);
        assert!(id.point_to(&derived));
    }
}

/// Wrapper behavior for the packet-PDA decoders: owner verification, the
/// absent-vs-empty distinction, and malformed-bytes error surfacing. The
/// happy-path B-tree decode itself is covered by ibc-solray's own crate tests;
/// these pin the webapp-side wrapper contract, which needs no live RPC.
#[cfg(test)]
mod packet_pda_tests {
    use super::*;
    use std::collections::BTreeSet;

    const OTHER_OWNER: &str = "11111111111111111111111111111111";
    /// base64 of a 3-byte buffer — too short to be a valid B-tree header.
    const TRUNCATED_BASE64: &str = "AAAA";

    fn account(owner: &str, data_base64: &str) -> SolanaAccount {
        SolanaAccount {
            lamports: 10,
            owner: owner.to_string(),
            executable: false,
            data: vec![data_base64.to_string(), "base64".to_string()],
        }
    }

    #[test]
    fn absent_commitment_account_is_absent_not_empty() {
        assert_eq!(
            decode_commitment_pda(None).expect("absent decodes"),
            PacketPdaSnapshot::Absent
        );
    }

    #[test]
    fn present_empty_commitment_pda_is_present_with_no_sequences() {
        let empty = account(SOLRAY_PROGRAM_ID, "");
        assert_eq!(
            decode_commitment_pda(Some(&empty)).expect("empty PDA decodes"),
            PacketPdaSnapshot::Present(BTreeSet::new())
        );
    }

    #[test]
    fn wrong_owner_commitment_account_is_rejected_before_decode() {
        let foreign = account(OTHER_OWNER, "");
        assert!(
            decode_commitment_pda(Some(&foreign)).is_err(),
            "an account not owned by the solray program must be rejected"
        );
    }

    #[test]
    fn truncated_commitment_bytes_surface_as_error() {
        let malformed = account(SOLRAY_PROGRAM_ID, TRUNCATED_BASE64);
        assert!(
            decode_commitment_pda(Some(&malformed)).is_err(),
            "a sub-header byte buffer must surface a decode error"
        );
    }

    #[test]
    fn absent_acknowledgement_account_is_absent_not_empty() {
        assert_eq!(
            decode_acknowledgement_pda(None).expect("absent decodes"),
            PacketPdaSnapshot::Absent
        );
    }

    #[test]
    fn wrong_owner_acknowledgement_account_is_rejected_before_decode() {
        let foreign = account(OTHER_OWNER, "");
        assert!(
            decode_acknowledgement_pda(Some(&foreign)).is_err(),
            "an account not owned by the solray program must be rejected"
        );
    }
}
