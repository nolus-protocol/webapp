//! Unsigned Solana transaction build endpoints (webapp#293, WS1.4).
//!
//! `POST /api/solana/tx/{create-ata|send-source|send-sink}` (all strict-class)
//! compose an unsigned Solana v0 transaction the wallet later signs and
//! broadcasts. The backend derives the source-vs-sink transfer kind from the
//! asset's origin in the SOLANA protocol currency set — the caller never picks.
//! Every request is fully validated (base58 addresses, amount bounds, currency
//! membership, timeout presence), compute-budget instructions are injected
//! during composition, and the composed transaction is simulated against the
//! Solana RPC before it is returned so the wallet's preview never sees a failing
//! transaction.
//!
//! Composition is deterministic per input: the nondeterministic recent-blockhash
//! is an injected parameter so a fixed input yields a byte-stable base64
//! transaction (snapshot-tested).

use std::sync::Arc;

use axum::extract::State;
use axum::Json;
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

use crate::error::AppError;
use crate::handlers::currencies::{CurrenciesResponse, CurrencyInfo};
use crate::transfer_tracker::IbcHeight;
use crate::AppState;

/// Compute-unit limit injected into every composed transaction. Wallets do not
/// auto-inject priority fees, so the backend sets an explicit budget.
pub const COMPUTE_UNIT_LIMIT: u32 = 200_000;
/// Compute-unit price (micro-lamports) injected into every composed transaction.
pub const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS: u64 = 1_000;

/// Which solray transfer instruction the composition uses. Derived from the
/// asset's origin, never supplied by the caller.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum TransferKind {
    /// Solana-native asset leaving Solana: `SendSourceTokens` escrow.
    Source,
    /// Nolus-origin voucher returning to Nolus: `SendSinkTokens` burn.
    Sink,
}

/// The operation a composed transaction performs, surfaced in the summary.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub enum OperationKind {
    CreateAta,
    SendSource,
    SendSink,
}

/// Compute-budget settings the composed transaction carries, surfaced so the UI
/// can show the priority fee before the user signs.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct FeeSummary {
    pub compute_unit_limit: u32,
    pub compute_unit_price_micro_lamports: u64,
}

/// Human-readable pre-sign summary rendered by the UI (asset, amount,
/// destination, fees). Deterministic per input and snapshot-tested.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct OperationSummary {
    pub operation: OperationKind,
    /// Asset ticker (e.g. `USDC`).
    pub asset: String,
    /// Base-unit amount as a decimal string (`"0"` for account creation).
    pub amount: String,
    /// Destination the operation credits (Nolus recipient for a send, the owner
    /// wallet for a create-ATA).
    pub destination: String,
    pub fees: FeeSummary,
}

/// Build-endpoint success body: a base64 unsigned v0 transaction plus its
/// pre-sign summary.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct BuildTransactionResponse {
    /// Base64-encoded unsigned Solana v0 (`VersionedTransaction`) payload.
    pub transaction: String,
    pub summary: OperationSummary,
}

/// At least one of `height` / `timestamp` must be present — the solray program
/// rejects a send that carries no timeout at all.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct TimeoutSpec {
    pub height: Option<IbcHeight>,
    pub timestamp: Option<u64>,
}

/// `POST /api/solana/tx/create-ata` request body.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BuildCreateAtaRequest {
    /// Base58 wallet whose associated token account is created.
    pub owner: String,
    /// SOLANA-protocol currency key whose mint the ATA holds.
    pub currency: String,
}

/// `POST /api/solana/tx/{send-source|send-sink}` request body. Carries no
/// source/sink selector: the backend derives the kind from the currency origin.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct BuildSendRequest {
    /// Base58 Solana wallet paying and signing (slot-0 PAYER).
    pub sender: String,
    /// Nolus bech32 address credited on arrival.
    pub recipient: String,
    /// SOLANA-protocol currency key being sent.
    pub currency: String,
    /// Base-unit amount as a decimal string.
    pub amount: String,
    pub timeout: TimeoutSpec,
}

/// A send request that has passed validation and kind resolution, ready to
/// compose. The composition seam consumes this plus an injected blockhash.
#[derive(Debug, Clone)]
pub struct ValidatedSend {
    pub kind: TransferKind,
    pub sender: String,
    pub recipient: String,
    pub mint: String,
    pub ticker: String,
    pub amount: u128,
    pub decimals: u8,
    pub timeout: TimeoutSpec,
}

/// Resolve the transfer kind from the asset's origin in the SOLANA protocol
/// currency set: a Solana-native asset escrows out (`Source`); a Nolus-origin
/// voucher burns back (`Sink`). Pure over the currency — the caller never picks.
/// Errors if the currency is not a transferable SOLANA-protocol asset.
pub fn resolve_transfer_kind(currency: &CurrencyInfo) -> Result<TransferKind, AppError> {
    let _ = currency;
    todo!("WS1.4: derive Source/Sink from the SOLANA-protocol currency origin")
}

/// Resolve a currency key to its SOLANA-protocol [`CurrencyInfo`]. Errors when
/// the key is absent from the currency set or belongs to a non-SOLANA protocol.
pub fn lookup_solana_currency<'set>(
    currencies: &'set CurrenciesResponse,
    key: &str,
) -> Result<&'set CurrencyInfo, AppError> {
    let _ = (currencies, key);
    todo!("WS1.4: look up the key and confirm SOLANA-protocol membership")
}

/// Parse and bound-check a base-unit amount string: rejects zero, negatives (the
/// leading `-` fails `u128` parsing), and values overflowing `u128`.
pub fn validate_amount(amount: &str) -> Result<u128, AppError> {
    let _ = amount;
    todo!("WS1.4: parse to u128 and reject zero/negative/overflow")
}

/// Enforce the send timeout policy: at least one of height / timestamp present.
pub fn validate_timeout(timeout: &TimeoutSpec) -> Result<(), AppError> {
    let _ = timeout;
    todo!("WS1.4: reject a timeout carrying neither height nor timestamp")
}

/// Fully validate a send request and resolve it against the currency set,
/// deriving the transfer kind from the asset origin (never from the caller).
/// The currency lookup runs first so an unknown/non-SOLANA currency is rejected
/// before per-field checks.
pub fn validate_send_request(
    request: &BuildSendRequest,
    currencies: &CurrenciesResponse,
) -> Result<ValidatedSend, AppError> {
    let currency = lookup_solana_currency(currencies, &request.currency)?;
    let kind = resolve_transfer_kind(currency)?;
    crate::validation::validate_solana_address(&request.sender, "sender")?;
    crate::validation::validate_bech32_address(&request.recipient, "recipient")?;
    let amount = validate_amount(&request.amount)?;
    validate_timeout(&request.timeout)?;
    Ok(ValidatedSend {
        kind,
        sender: request.sender.clone(),
        recipient: request.recipient.clone(),
        mint: currency.dex_symbol.clone(),
        ticker: currency.ticker.clone(),
        amount,
        decimals: currency.decimal_digits,
        timeout: request.timeout.clone(),
    })
}

/// Validate a create-ATA request and resolve its SOLANA-protocol currency.
pub fn validate_create_ata_request<'set>(
    request: &BuildCreateAtaRequest,
    currencies: &'set CurrenciesResponse,
) -> Result<&'set CurrencyInfo, AppError> {
    let currency = lookup_solana_currency(currencies, &request.currency)?;
    crate::validation::validate_solana_address(&request.owner, "owner")?;
    Ok(currency)
}

/// Map a non-null Solana simulation error to a typed, non-retryable error. The
/// wallet's preview must never be handed a transaction that would fail on chain.
fn simulation_error(err: &serde_json::Value) -> AppError {
    AppError::ChainRpc {
        chain: "solana".to_string(),
        message: format!("transaction simulation failed: {err}"),
    }
}

/// Compose the unsigned v0 transaction for a validated send. Deterministic given
/// `blockhash`: injects compute-budget instructions, builds the solray transfer
/// instruction for `v.kind`, assembles a v0 message pinned to `blockhash`, and
/// returns the base64 transaction plus its summary. No RPC — the caller fetches
/// the blockhash and simulates separately.
pub fn compose_send(
    v: &ValidatedSend,
    blockhash: &str,
) -> Result<BuildTransactionResponse, AppError> {
    let _ = (
        v.kind,
        &v.sender,
        &v.recipient,
        &v.mint,
        &v.ticker,
        v.amount,
        v.decimals,
        &v.timeout,
        blockhash,
        COMPUTE_UNIT_LIMIT,
        COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
    );
    todo!("WS1.4: compose the SendSource/SendSink v0 transaction with compute budget")
}

/// Compose the unsigned v0 create-ATA transaction. Deterministic given
/// `blockhash`; injects compute-budget instructions and the idempotent
/// create-ATA instruction for `mint` owned by `owner`.
pub fn compose_create_ata(
    owner: &str,
    mint: &str,
    ticker: &str,
    blockhash: &str,
) -> Result<BuildTransactionResponse, AppError> {
    let _ = (
        owner,
        mint,
        ticker,
        blockhash,
        COMPUTE_UNIT_LIMIT,
        COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
    );
    todo!("WS1.4: compose the create-ATA v0 transaction with compute budget")
}

/// Build an unsigned create-ATA transaction
#[utoipa::path(
    post,
    path = "/api/solana/tx/create-ata",
    tag = "solana",
    request_body = BuildCreateAtaRequest,
    responses(
        (status = 200, description = "Unsigned v0 transaction + summary", body = BuildTransactionResponse),
        (status = 400, description = "Invalid address or unknown currency", body = crate::error::ErrorResponse),
        (status = 502, description = "Solana RPC / simulation failure", body = crate::error::ErrorResponse),
        (status = 503, description = "Solana RPC unconfigured or cache cold", body = crate::error::ErrorResponse),
    ),
)]
pub async fn build_create_ata(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BuildCreateAtaRequest>,
) -> Result<Json<BuildTransactionResponse>, AppError> {
    let currencies = state
        .data_cache
        .currencies
        .load_or_unavailable("Currencies")?;
    let currency = validate_create_ata_request(&request, &currencies)?;
    let blockhash = state.solana_client.get_latest_blockhash().await?;
    let response = compose_create_ata(
        &request.owner,
        &currency.dex_symbol,
        &currency.ticker,
        &blockhash.blockhash,
    )?;
    let simulation = state
        .solana_client
        .simulate_transaction(&response.transaction)
        .await?;
    if let Some(err) = simulation.err.as_ref() {
        return Err(simulation_error(err));
    }
    Ok(Json(response))
}

/// Build an unsigned source-escrow send transaction
#[utoipa::path(
    post,
    path = "/api/solana/tx/send-source",
    tag = "solana",
    request_body = BuildSendRequest,
    responses(
        (status = 200, description = "Unsigned v0 transaction + summary", body = BuildTransactionResponse),
        (status = 400, description = "Invalid input, unknown currency, or non-source asset", body = crate::error::ErrorResponse),
        (status = 502, description = "Solana RPC / simulation failure", body = crate::error::ErrorResponse),
        (status = 503, description = "Solana RPC unconfigured or cache cold", body = crate::error::ErrorResponse),
    ),
)]
pub async fn build_send_source(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BuildSendRequest>,
) -> Result<Json<BuildTransactionResponse>, AppError> {
    build_send(&state, &request, TransferKind::Source).await
}

/// Shared send pipeline: validate + resolve kind, reject a route/kind mismatch
/// (the caller cannot force a kind the asset origin does not carry), compose,
/// simulate, and return the unsigned transaction.
async fn build_send(
    state: &Arc<AppState>,
    request: &BuildSendRequest,
    expected: TransferKind,
) -> Result<Json<BuildTransactionResponse>, AppError> {
    let currencies = state
        .data_cache
        .currencies
        .load_or_unavailable("Currencies")?;
    let validated = validate_send_request(request, &currencies)?;
    if validated.kind != expected {
        return Err(AppError::Validation {
            message: format!(
                "currency {} resolves to {:?}, not the {expected:?} this endpoint composes",
                request.currency, validated.kind
            ),
            field: Some("currency".to_string()),
            details: None,
        });
    }
    let blockhash = state.solana_client.get_latest_blockhash().await?;
    let response = compose_send(&validated, &blockhash.blockhash)?;
    let simulation = state
        .solana_client
        .simulate_transaction(&response.transaction)
        .await?;
    if let Some(err) = simulation.err.as_ref() {
        return Err(simulation_error(err));
    }
    Ok(Json(response))
}

/// Build an unsigned sink-burn send transaction
#[utoipa::path(
    post,
    path = "/api/solana/tx/send-sink",
    tag = "solana",
    request_body = BuildSendRequest,
    responses(
        (status = 200, description = "Unsigned v0 transaction + summary", body = BuildTransactionResponse),
        (status = 400, description = "Invalid input, unknown currency, or non-sink asset", body = crate::error::ErrorResponse),
        (status = 502, description = "Solana RPC / simulation failure", body = crate::error::ErrorResponse),
        (status = 503, description = "Solana RPC unconfigured or cache cold", body = crate::error::ErrorResponse),
    ),
)]
pub async fn build_send_sink(
    State(state): State<Arc<AppState>>,
    Json(request): Json<BuildSendRequest>,
) -> Result<Json<BuildTransactionResponse>, AppError> {
    build_send(&state, &request, TransferKind::Sink).await
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::str::FromStr as _;
    use std::sync::Arc;

    use serde_json::json;
    use solana_pubkey::Pubkey;
    use wiremock::matchers::{body_partial_json, method};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use super::*;
    use crate::handlers::currencies::CurrenciesResponse;

    // ── Canonical fixtures ──────────────────────────────────────────────
    const SENDER: &str = "So11111111111111111111111111111111111111112";
    const RECIPIENT: &str = "nolus1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7nad0vhyhtuhw3sqaa3c5";
    const MINT: &str = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
    const VOUCHER_MINT: &str = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
    const BLOCKHASH: &str = "9WzDXwBbmkg8ZTbNMqUxvQRAyrZzDsGYdLVL9zYtAWWM";
    const SOLANA_PROTOCOL: &str = "SOLANA-JUPITER-USDC";
    /// The Solana ComputeBudget program id; its 32 bytes appear in any composed
    /// transaction that injects compute-budget instructions.
    const COMPUTE_BUDGET_PROGRAM_ID: &str = "ComputeBudget111111111111111111111111111111";

    /// A Solana-native currency in the SOLANA protocol set (dispatches Source).
    ///
    /// INTERPRETATION: `native == true` is used here as the Solana-origin
    /// discriminator. If WS1.4 keys origin off the IBC trace of `bank_symbol`
    /// instead, adjust this one builder (see report — interpretation call #1).
    fn native_currency() -> CurrencyInfo {
        CurrencyInfo {
            key: "USDC@SOLANA-JUPITER-USDC".to_string(),
            ticker: "USDC".to_string(),
            symbol: "USDC".to_string(),
            name: "USD Coin".to_string(),
            short_name: "USDC".to_string(),
            decimal_digits: 6,
            bank_symbol: "ibc/USDCONSOLANA".to_string(),
            dex_symbol: MINT.to_string(),
            icon: String::new(),
            native: true,
            coingecko_id: None,
            protocol: SOLANA_PROTOCOL.to_string(),
            group: "lease".to_string(),
            is_active: true,
        }
    }

    /// A Nolus-origin voucher in the SOLANA protocol set (dispatches Sink).
    fn voucher_currency() -> CurrencyInfo {
        CurrencyInfo {
            key: "NLS@SOLANA-JUPITER-USDC".to_string(),
            ticker: "NLS".to_string(),
            symbol: "NLS".to_string(),
            name: "Nolus".to_string(),
            short_name: "NLS".to_string(),
            decimal_digits: 6,
            bank_symbol: "unls".to_string(),
            dex_symbol: VOUCHER_MINT.to_string(),
            icon: String::new(),
            native: false,
            coingecko_id: None,
            protocol: SOLANA_PROTOCOL.to_string(),
            group: "payment_only".to_string(),
            is_active: true,
        }
    }

    fn osmosis_currency() -> CurrencyInfo {
        CurrencyInfo {
            protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
            key: "USDC@OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
            ..native_currency()
        }
    }

    fn timeout_height() -> TimeoutSpec {
        TimeoutSpec {
            height: Some(IbcHeight {
                revision_number: 1,
                revision_height: 250_000_000,
            }),
            timestamp: None,
        }
    }

    fn validated_source_send() -> ValidatedSend {
        ValidatedSend {
            kind: TransferKind::Source,
            sender: SENDER.to_string(),
            recipient: RECIPIENT.to_string(),
            mint: MINT.to_string(),
            ticker: "USDC".to_string(),
            amount: 5_000_000,
            decimals: 6,
            timeout: timeout_height(),
        }
    }

    fn currencies_with(entries: &[CurrencyInfo]) -> CurrenciesResponse {
        let mut currencies = HashMap::new();
        for c in entries {
            currencies.insert(c.key.clone(), c.clone());
        }
        CurrenciesResponse {
            currencies,
            lpn: Vec::new(),
            lease_currencies: Vec::new(),
            map: HashMap::new(),
        }
    }

    fn expected_fees() -> FeeSummary {
        FeeSummary {
            compute_unit_limit: COMPUTE_UNIT_LIMIT,
            compute_unit_price_micro_lamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
        }
    }

    async fn state_with_solana(url: &str) -> Arc<AppState> {
        let mut config = crate::test_utils::test_config();
        config.external.solana_rpc_url = Some(url.to_string());
        let state = crate::test_utils::test_app_state_with_config_and_client(
            config,
            reqwest::Client::new(),
        )
        .await;
        state
            .data_cache
            .currencies
            .store(currencies_with(&[native_currency(), voucher_currency()]));
        state
    }

    async fn mount_blockhash(server: &MockServer) {
        Mock::given(method("POST"))
            .and(body_partial_json(json!({ "method": "getLatestBlockhash" })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0", "id": 1,
                "result": { "context": { "slot": 1 },
                    "value": { "blockhash": BLOCKHASH, "lastValidBlockHeight": 321 } },
            })))
            .mount(server)
            .await;
    }

    async fn mount_simulate(server: &MockServer, err: serde_json::Value) {
        Mock::given(method("POST"))
            .and(body_partial_json(
                json!({ "method": "simulateTransaction" }),
            ))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0", "id": 1,
                "result": { "context": { "slot": 1 },
                    "value": { "err": err, "logs": [], "unitsConsumed": 1000 } },
            })))
            .mount(server)
            .await;
    }

    fn send_request(currency_key: &str) -> BuildSendRequest {
        BuildSendRequest {
            sender: SENDER.to_string(),
            recipient: RECIPIENT.to_string(),
            currency: currency_key.to_string(),
            amount: "5000000".to_string(),
            timeout: timeout_height(),
        }
    }

    // ── Dispatch: backend derives kind, caller cannot override (constraint 1) ──

    #[test]
    fn resolve_transfer_kind_native_asset_dispatches_source() {
        assert_eq!(
            resolve_transfer_kind(&native_currency()).expect("native resolves"),
            TransferKind::Source
        );
    }

    #[test]
    fn resolve_transfer_kind_nolus_voucher_dispatches_sink() {
        assert_eq!(
            resolve_transfer_kind(&voucher_currency()).expect("voucher resolves"),
            TransferKind::Sink
        );
    }

    #[tokio::test]
    async fn build_send_source_rejects_a_voucher_currency() {
        // Caller-cannot-override: hitting the source route with a Nolus-origin
        // voucher must be rejected, not silently composed as a sink.
        let state = crate::test_utils::test_app_state().await;
        state
            .data_cache
            .currencies
            .store(currencies_with(&[voucher_currency()]));
        let err = build_send_source(State(state), Json(send_request("NLS@SOLANA-JUPITER-USDC")))
            .await
            .expect_err("source route must reject a voucher asset");
        assert!(matches!(err, AppError::Validation { .. }));
    }

    #[tokio::test]
    async fn build_send_sink_rejects_a_native_currency() {
        let state = crate::test_utils::test_app_state().await;
        state
            .data_cache
            .currencies
            .store(currencies_with(&[native_currency()]));
        let err = build_send_sink(State(state), Json(send_request("USDC@SOLANA-JUPITER-USDC")))
            .await
            .expect_err("sink route must reject a native asset");
        assert!(matches!(err, AppError::Validation { .. }));
    }

    // ── Validation matrix (AC#2) ────────────────────────────────────────

    #[test]
    fn validate_amount_rejects_zero() {
        assert!(matches!(
            validate_amount("0"),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn validate_amount_rejects_negative() {
        assert!(matches!(
            validate_amount("-1"),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn validate_amount_rejects_overflow() {
        // 2^128 — one past u128::MAX, must not parse.
        assert!(matches!(
            validate_amount("340282366920938463463374607431768211456"),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn validate_amount_accepts_a_positive_value() {
        assert_eq!(
            validate_amount("5000000").expect("positive amount"),
            5_000_000
        );
    }

    #[test]
    fn lookup_solana_currency_rejects_an_unknown_key() {
        let set = currencies_with(&[native_currency()]);
        assert!(matches!(
            lookup_solana_currency(&set, "MISSING@SOLANA-JUPITER-USDC"),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn lookup_solana_currency_rejects_a_non_solana_protocol_currency() {
        let set = currencies_with(&[osmosis_currency()]);
        assert!(matches!(
            lookup_solana_currency(&set, "USDC@OSMOSIS-OSMOSIS-USDC_NOBLE"),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn validate_timeout_rejects_neither_height_nor_timestamp() {
        let spec = TimeoutSpec {
            height: None,
            timestamp: None,
        };
        assert!(matches!(
            validate_timeout(&spec),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn validate_timeout_accepts_height_only() {
        assert!(validate_timeout(&timeout_height()).is_ok());
    }

    #[test]
    fn validate_timeout_accepts_timestamp_only() {
        let spec = TimeoutSpec {
            height: None,
            timestamp: Some(1_900_000_000),
        };
        assert!(validate_timeout(&spec).is_ok());
    }

    #[tokio::test]
    async fn build_send_source_rejects_a_malformed_sender_address() {
        let state = state_with_solana("http://127.0.0.1:1/").await;
        let mut req = send_request("USDC@SOLANA-JUPITER-USDC");
        req.sender = "not-a-base58-address".to_string();
        let err = build_send_source(State(state), Json(req))
            .await
            .expect_err("malformed sender must be rejected");
        assert!(
            matches!(err, AppError::Validation { field, .. } if field.as_deref() == Some("sender"))
        );
    }

    #[tokio::test]
    async fn build_send_source_rejects_a_malformed_recipient_address() {
        let state = state_with_solana("http://127.0.0.1:1/").await;
        let mut req = send_request("USDC@SOLANA-JUPITER-USDC");
        req.recipient = "not-a-nolus-address".to_string();
        let err = build_send_source(State(state), Json(req))
            .await
            .expect_err("malformed recipient must be rejected");
        assert!(
            matches!(err, AppError::Validation { field, .. } if field.as_deref() == Some("recipient"))
        );
    }

    // ── Deterministic composition + compute budget (AC#3, constraint 4) ──

    #[test]
    fn compose_send_is_byte_stable_for_a_fixed_input() {
        let v = validated_source_send();
        let a = compose_send(&v, BLOCKHASH).expect("compose a");
        let b = compose_send(&v, BLOCKHASH).expect("compose b");
        assert_eq!(a.transaction, b.transaction);
    }

    #[test]
    fn compose_create_ata_is_byte_stable_for_a_fixed_input() {
        let a = compose_create_ata(SENDER, MINT, "USDC", BLOCKHASH).expect("compose a");
        let b = compose_create_ata(SENDER, MINT, "USDC", BLOCKHASH).expect("compose b");
        assert_eq!(a.transaction, b.transaction);
    }

    #[test]
    fn compose_send_transaction_references_the_compute_budget_program() {
        let resp = compose_send(&validated_source_send(), BLOCKHASH).expect("compose");
        let raw = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &resp.transaction,
        )
        .expect("base64 decodes");
        let id = Pubkey::from_str(COMPUTE_BUDGET_PROGRAM_ID)
            .expect("compute budget id parses")
            .to_bytes();
        assert!(raw.windows(32).any(|w| w == id));
    }

    #[test]
    fn compose_create_ata_transaction_references_the_compute_budget_program() {
        let resp = compose_create_ata(SENDER, MINT, "USDC", BLOCKHASH).expect("compose");
        let raw = base64::Engine::decode(
            &base64::engine::general_purpose::STANDARD,
            &resp.transaction,
        )
        .expect("base64 decodes");
        let id = Pubkey::from_str(COMPUTE_BUDGET_PROGRAM_ID)
            .expect("compute budget id parses")
            .to_bytes();
        assert!(raw.windows(32).any(|w| w == id));
    }

    // ── Summary snapshot (AC#6) ─────────────────────────────────────────

    #[test]
    fn compose_send_summary_matches_known_answer() {
        let resp = compose_send(&validated_source_send(), BLOCKHASH).expect("compose");
        assert_eq!(
            resp.summary,
            OperationSummary {
                operation: OperationKind::SendSource,
                asset: "USDC".to_string(),
                amount: "5000000".to_string(),
                destination: RECIPIENT.to_string(),
                fees: expected_fees(),
            }
        );
    }

    #[test]
    fn compose_create_ata_summary_matches_known_answer() {
        let resp = compose_create_ata(SENDER, MINT, "USDC", BLOCKHASH).expect("compose");
        assert_eq!(
            resp.summary,
            OperationSummary {
                operation: OperationKind::CreateAta,
                asset: "USDC".to_string(),
                amount: "0".to_string(),
                destination: SENDER.to_string(),
                fees: expected_fees(),
            }
        );
    }

    // ── Simulation gate (AC#5, constraint 5) ────────────────────────────

    #[tokio::test]
    async fn build_send_source_failing_simulation_returns_error_not_transaction() {
        let server = MockServer::start().await;
        mount_blockhash(&server).await;
        mount_simulate(&server, json!({ "InstructionError": [0, "Custom"] })).await;
        let state = state_with_solana(&server.uri()).await;

        let result =
            build_send_source(State(state), Json(send_request("USDC@SOLANA-JUPITER-USDC"))).await;
        assert!(
            matches!(result, Err(AppError::ChainRpc { .. })),
            "a failing simulation must return a typed error, never a transaction"
        );
    }

    #[tokio::test]
    async fn build_create_ata_failing_simulation_returns_error_not_transaction() {
        let server = MockServer::start().await;
        mount_blockhash(&server).await;
        mount_simulate(&server, json!({ "InstructionError": [0, "Custom"] })).await;
        let state = state_with_solana(&server.uri()).await;

        let req = BuildCreateAtaRequest {
            owner: SENDER.to_string(),
            currency: "USDC@SOLANA-JUPITER-USDC".to_string(),
        };
        let result = build_create_ata(State(state), Json(req)).await;
        assert!(matches!(result, Err(AppError::ChainRpc { .. })));
    }

    // ── Happy path through the handler (AC#3 end-to-end, dispatch) ───────

    #[tokio::test]
    async fn build_send_source_composes_a_source_operation_for_a_native_asset() {
        let server = MockServer::start().await;
        mount_blockhash(&server).await;
        mount_simulate(&server, serde_json::Value::Null).await;
        let state = state_with_solana(&server.uri()).await;

        let resp = build_send_source(State(state), Json(send_request("USDC@SOLANA-JUPITER-USDC")))
            .await
            .expect("source send composes")
            .0;
        assert_eq!(resp.summary.operation, OperationKind::SendSource);
    }

    #[tokio::test]
    async fn build_send_sink_composes_a_sink_operation_for_a_voucher_asset() {
        let server = MockServer::start().await;
        mount_blockhash(&server).await;
        mount_simulate(&server, serde_json::Value::Null).await;
        let state = state_with_solana(&server.uri()).await;

        let resp = build_send_sink(State(state), Json(send_request("NLS@SOLANA-JUPITER-USDC")))
            .await
            .expect("sink send composes")
            .0;
        assert_eq!(resp.summary.operation, OperationKind::SendSink);
    }

    #[tokio::test]
    async fn build_create_ata_composes_a_create_ata_operation() {
        let server = MockServer::start().await;
        mount_blockhash(&server).await;
        mount_simulate(&server, serde_json::Value::Null).await;
        let state = state_with_solana(&server.uri()).await;

        let req = BuildCreateAtaRequest {
            owner: SENDER.to_string(),
            currency: "USDC@SOLANA-JUPITER-USDC".to_string(),
        };
        let resp = build_create_ata(State(state), Json(req))
            .await
            .expect("create-ata composes")
            .0;
        assert_eq!(resp.summary.operation, OperationKind::CreateAta);
    }

    // ── OpenAPI registration (AC#4) ─────────────────────────────────────
    //
    // The three build paths are registered in `handlers::openapi::ApiDoc` and
    // wired strict-class in `main.rs`; the pre-existing
    // `openapi::tests::openapi_spec_matches_snapshot` guards their presence and
    // full shape via the committed `openapi.snapshot.json` (regenerated to
    // include them). No duplicate assertion here — a lone path-presence check
    // would be green scaffolding, not a red behavioral test.
}
