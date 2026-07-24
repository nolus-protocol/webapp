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
