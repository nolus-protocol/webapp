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

use std::str::FromStr as _;
use std::sync::{Arc, LazyLock};

use axum::extract::State;
use axum::Json;
use base64::Engine as _;
use ibc_core_channel_types::timeout::{TimeoutHeight, TimeoutTimestamp};
use ibc_solray::api::transfer::{IBCIdentifiers, SendSinkDetails, SendSourceDetails};
use ibc_solray::api::{Height, Timeout, Timestamp};
use serde::{Deserialize, Serialize};
use solana_hash::Hash;
use solana_instruction::{AccountMeta, Instruction};
use solana_message::v0::Message as V0Message;
use solana_message::VersionedMessage;
use solana_pubkey::Pubkey;
use utoipa::ToSchema;

use crate::error::AppError;
use crate::external::solana;
use crate::handlers::currencies::{CurrenciesResponse, CurrencyInfo};
use crate::transfer_tracker::IbcHeight;
use crate::AppState;

/// Compute-unit limit injected into every composed transaction. Wallets do not
/// auto-inject priority fees, so the backend sets an explicit budget.
pub const COMPUTE_UNIT_LIMIT: u32 = 200_000;
/// Compute-unit price (micro-lamports) injected into every composed transaction.
pub const COMPUTE_UNIT_PRICE_MICRO_LAMPORTS: u64 = 1_000;

/// Solana ComputeBudget program id — the target of the injected budget
/// instructions.
const COMPUTE_BUDGET_PROGRAM_ID: &str = "ComputeBudget111111111111111111111111111111";
/// `ComputeBudgetInstruction::SetComputeUnitLimit` discriminant.
const SET_COMPUTE_UNIT_LIMIT_TAG: u8 = 2;
/// `ComputeBudgetInstruction::SetComputeUnitPrice` discriminant.
const SET_COMPUTE_UNIT_PRICE_TAG: u8 = 3;

/// The Associated Token Account program id — the target of a create-ATA
/// instruction.
const ATA_PROGRAM_ID: &str = "ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL";
/// `AssociatedTokenAccountInstruction::CreateIdempotent` discriminant. Idempotent
/// so a create-ATA the wallet re-submits after the account already exists is a
/// no-op rather than a failure.
const CREATE_ATA_IDEMPOTENT_TAG: u8 = 1;
/// The System program id — an account of the create-ATA instruction.
const SYSTEM_PROGRAM_ID: &str = "11111111111111111111111111111111";
/// The classic SPL Token program id. The SOLANA-protocol mints this endpoint
/// composes for are classic SPL mints; it is the create-ATA token program and
/// the source send's mint owner.
const SPL_TOKEN_PROGRAM_ID: &str = "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA";

/// Ed25519 signature length, in bytes — the width of each empty signature slot
/// reserved in the unsigned transaction the wallet later fills.
const SIGNATURE_LEN: usize = 64;

/// A SOLANA-protocol currency's `protocol` starts with this segment. Nolus
/// protocol keys are `<DEX_NETWORK>-<DEX>-<LPN>`, so the first segment names the
/// DEX network; a `SOLANA-` prefix identifies the Solana network.
const SOLANA_PROTOCOL_PREFIX: &str = "SOLANA-";

/// A Solana-native asset is represented on Nolus as an IBC voucher whose
/// `bank_symbol` carries this trace prefix; a Nolus-origin asset keeps its native
/// Nolus denom (e.g. `unls`) instead. The presence of the trace is the
/// source-vs-sink origin discriminator.
const NOLUS_IBC_VOUCHER_PREFIX: &str = "ibc/";

/// Default IBC client name for the Solana transfer channel, overridable via
/// `SOLANA_IBC_CLIENT_NAME` (deploy-time wiring lands with the network config).
const DEFAULT_IBC_CLIENT_NAME: &str = "client-0";
/// Default IBC connection name, overridable via `SOLANA_IBC_CONNECTION_NAME`.
const DEFAULT_IBC_CONNECTION_NAME: &str = "connection-0";
/// Default Solana transfer channel ordinal, overridable via
/// `SOLANA_TRANSFER_CHANNEL_ORDINAL`.
const DEFAULT_TRANSFER_CHANNEL_ORDINAL: u16 = 0;

/// IBC client name in effect for composition. Read once (`SOLANA_IBC_CLIENT_NAME`
/// or the default) so a fixed input yields a byte-stable transaction.
static IBC_CLIENT_NAME: LazyLock<String> = LazyLock::new(|| {
    std::env::var("SOLANA_IBC_CLIENT_NAME")
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_IBC_CLIENT_NAME.to_string())
});

/// IBC connection name in effect for composition (see [`IBC_CLIENT_NAME`]).
static IBC_CONNECTION_NAME: LazyLock<String> = LazyLock::new(|| {
    std::env::var("SOLANA_IBC_CONNECTION_NAME")
        .ok()
        .filter(|value| !value.is_empty())
        .unwrap_or_else(|| DEFAULT_IBC_CONNECTION_NAME.to_string())
});

/// Solana transfer channel ordinal in effect for composition: `SOLANA_TRANSFER_CHANNEL_ORDINAL`
/// or the default. Unset/empty falls back; a set-but-unparseable value fails
/// loudly (a silent channel-0 fallback would compose against the wrong corridor).
fn transfer_channel_ordinal() -> Result<u16, AppError> {
    parse_channel_ordinal(
        std::env::var("SOLANA_TRANSFER_CHANNEL_ORDINAL")
            .ok()
            .as_deref(),
    )
}

/// Parse the channel-ordinal env value: unset/empty → default; present but not a
/// `u16` → an internal misconfiguration error, never a silent fallback.
fn parse_channel_ordinal(raw: Option<&str>) -> Result<u16, AppError> {
    match raw {
        Some(value) if !value.is_empty() => value.parse().map_err(|_err| {
            AppError::Internal(format!(
                "SOLANA_TRANSFER_CHANNEL_ORDINAL is set but not a valid u16 channel ordinal: {value}"
            ))
        }),
        _ => Ok(DEFAULT_TRANSFER_CHANNEL_ORDINAL),
    }
}

/// Which solray transfer instruction the composition uses. Derived from the
/// asset's origin, never supplied by the caller.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
enum TransferKind {
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
struct ValidatedSend {
    kind: TransferKind,
    sender: String,
    recipient: String,
    mint: String,
    /// Nolus-side IBC denom (`CurrencyInfo::bank_symbol`) — the remote-token
    /// denom a sink burn wraps. Unused by a source escrow.
    bank_symbol: String,
    ticker: String,
    amount: u128,
    timeout: TimeoutSpec,
}

/// Resolve the transfer kind from the asset's origin in the SOLANA protocol
/// currency set: a Solana-native asset escrows out (`Source`); a Nolus-origin
/// voucher burns back (`Sink`). Pure over the currency — the caller never picks.
/// Errors if the currency is not a transferable SOLANA-protocol asset.
fn resolve_transfer_kind(currency: &CurrencyInfo) -> Result<TransferKind, AppError> {
    // A Solana-native asset appears on Nolus as an IBC voucher (its `bank_symbol`
    // carries the `ibc/` trace), so it escrows out of Solana (Source). A
    // Nolus-origin asset keeps its native Nolus denom (e.g. `unls`), so on Solana
    // it is a voucher that burns back to Nolus (Sink). The `CurrencyInfo::native`
    // flag is Nolus-origin (set iff `bank_symbol == "unls"`), the inverse of
    // Solana-native, so the origin is keyed off the Nolus-side denom trace, not
    // that flag.
    if currency.bank_symbol.starts_with(NOLUS_IBC_VOUCHER_PREFIX) {
        Ok(TransferKind::Source)
    } else {
        Ok(TransferKind::Sink)
    }
}

/// Resolve a currency key to its SOLANA-protocol [`CurrencyInfo`]. Errors when
/// the key is absent from the currency set or belongs to a non-SOLANA protocol.
fn lookup_solana_currency<'set>(
    currencies: &'set CurrenciesResponse,
    key: &str,
) -> Result<&'set CurrencyInfo, AppError> {
    currencies
        .currencies
        .get(key)
        .filter(|currency| currency.protocol.starts_with(SOLANA_PROTOCOL_PREFIX))
        .ok_or_else(|| AppError::Validation {
            message: format!("unknown or non-SOLANA-protocol currency: {key}"),
            field: Some("currency".to_string()),
            details: None,
        })
}

/// Parse and bound-check a base-unit amount string: rejects zero, negatives (the
/// leading `-` fails `u128` parsing), and values overflowing `u128`.
fn validate_amount(amount: &str) -> Result<u128, AppError> {
    match amount.parse::<u128>() {
        Ok(value) if value > 0 => Ok(value),
        _ => Err(AppError::Validation {
            message: "amount must be a positive base-unit integer".to_string(),
            field: Some("amount".to_string()),
            details: None,
        }),
    }
}

/// Enforce the send timeout policy: at least one of height / timestamp present.
fn validate_timeout(timeout: &TimeoutSpec) -> Result<(), AppError> {
    if timeout.height.is_none() && timeout.timestamp.is_none() {
        return Err(AppError::Validation {
            message: "a send timeout must carry a height, a timestamp, or both".to_string(),
            field: Some("timeout".to_string()),
            details: None,
        });
    }
    Ok(())
}

/// Fully validate a send request and resolve it against the currency set,
/// deriving the transfer kind from the asset origin (never from the caller).
/// The currency lookup runs first so an unknown/non-SOLANA currency is rejected
/// before per-field checks.
fn validate_send_request(
    request: &BuildSendRequest,
    currencies: &CurrenciesResponse,
) -> Result<ValidatedSend, AppError> {
    let currency = lookup_solana_currency(currencies, &request.currency)?;
    let kind = resolve_transfer_kind(currency)?;
    crate::validation::validate_solana_address(&request.sender, "sender")?;
    crate::validation::validate_nolus_address(&request.recipient, "recipient")?;
    let amount = validate_amount(&request.amount)?;
    validate_timeout(&request.timeout)?;
    Ok(ValidatedSend {
        kind,
        sender: request.sender.clone(),
        recipient: request.recipient.clone(),
        mint: currency.dex_symbol.clone(),
        bank_symbol: currency.bank_symbol.clone(),
        ticker: currency.ticker.clone(),
        amount,
        timeout: request.timeout.clone(),
    })
}

/// Validate a create-ATA request and resolve its SOLANA-protocol currency.
fn validate_create_ata_request<'set>(
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
fn compose_send(v: &ValidatedSend, blockhash: &str) -> Result<BuildTransactionResponse, AppError> {
    let payer = parse_pubkey(&v.sender, "sender")?;
    let amount = amount_to_u64(v.amount)?;
    let program = parse_program_id(solana::solray_program_id())?;
    let channel = transfer_channel_ordinal()?;
    let timeout = build_timeout(&v.timeout)?;
    let ibc_id = IBCIdentifiers {
        client_name: IBC_CLIENT_NAME.clone(),
        connection_name: IBC_CONNECTION_NAME.clone(),
    };

    let (operation, transfer_ix) = match v.kind {
        TransferKind::Source => {
            let mint_key = parse_pubkey(&v.mint, "currency")?;
            let details = SendSourceDetails {
                at_channel: channel,
                recipient: v.recipient.clone(),
                mint_key,
                amount,
                memo: String::new(),
            };
            let mint_owner = parse_program_id(SPL_TOKEN_PROGRAM_ID)?;
            let instruction = ibc_solray::build::transfer(program)
                .send_source_tokens(details, ibc_id, timeout, payer, mint_owner)
                .map_err(builder_error)?;
            (OperationKind::SendSource, instruction)
        }
        TransferKind::Sink => {
            let details = SendSinkDetails {
                at_channel: channel,
                recipient: v.recipient.clone(),
                remote_token_denom: v.bank_symbol.clone(),
                amount,
                memo: String::new(),
            };
            let instruction = ibc_solray::build::transfer(program)
                .send_sink_tokens(details, ibc_id, timeout, payer)
                .map_err(builder_error)?;
            (OperationKind::SendSink, instruction)
        }
    };

    let transaction = finalize_transaction(&payer, with_compute_budget(transfer_ix)?, blockhash)?;
    Ok(BuildTransactionResponse {
        transaction,
        summary: OperationSummary {
            operation,
            asset: v.ticker.clone(),
            amount: v.amount.to_string(),
            destination: v.recipient.clone(),
            fees: fee_summary(),
        },
    })
}

/// Compose the unsigned v0 create-ATA transaction. Deterministic given
/// `blockhash`; injects compute-budget instructions and the idempotent
/// create-ATA instruction for `mint` owned by `owner`.
fn compose_create_ata(
    owner: &str,
    mint: &str,
    ticker: &str,
    blockhash: &str,
) -> Result<BuildTransactionResponse, AppError> {
    let owner_key = parse_pubkey(owner, "owner")?;
    let mint_key = parse_pubkey(mint, "currency")?;
    let create_ata_ix = create_ata_instruction(owner_key, mint_key)?;

    let transaction =
        finalize_transaction(&owner_key, with_compute_budget(create_ata_ix)?, blockhash)?;
    Ok(BuildTransactionResponse {
        transaction,
        summary: OperationSummary {
            operation: OperationKind::CreateAta,
            asset: ticker.to_string(),
            amount: "0".to_string(),
            destination: owner.to_string(),
            fees: fee_summary(),
        },
    })
}

/// The compute-budget settings every composed transaction carries.
fn fee_summary() -> FeeSummary {
    FeeSummary {
        compute_unit_limit: COMPUTE_UNIT_LIMIT,
        compute_unit_price_micro_lamports: COMPUTE_UNIT_PRICE_MICRO_LAMPORTS,
    }
}

/// Parse a base58 Solana address, mapping a malformed value to a 400 naming
/// `field`. The addresses reaching here are pre-validated, so this is a
/// defensive re-parse rather than the primary gate.
fn parse_pubkey(value: &str, field: &str) -> Result<Pubkey, AppError> {
    Pubkey::from_str(value).map_err(|_err| AppError::Validation {
        message: format!("Invalid {field} format"),
        field: Some(field.to_string()),
        details: None,
    })
}

/// Parse a program id (solray, token, ATA, …) that is operator-configured or a
/// module constant, so a parse failure is an internal misconfiguration (500),
/// not caller input.
fn parse_program_id(value: &str) -> Result<Pubkey, AppError> {
    Pubkey::from_str(value)
        .map_err(|err| AppError::Internal(format!("invalid program id {value}: {err}")))
}

/// Narrow a validated `u128` base-unit amount to the `u64` Solana token amount,
/// rejecting a value past the SPL base-unit ceiling.
fn amount_to_u64(amount: u128) -> Result<u64, AppError> {
    u64::try_from(amount).map_err(|_err| AppError::Validation {
        message: "amount exceeds the u64 base-unit ceiling".to_string(),
        field: Some("amount".to_string()),
        details: None,
    })
}

/// Map an SDK instruction-builder failure (bad channel/client/connection config)
/// to an internal error — these inputs are module/operator config, not caller
/// data.
fn builder_error(err: ibc_solray::api::Error) -> AppError {
    AppError::Internal(format!(
        "failed to compose Solana transfer instruction: {err}"
    ))
}

/// Convert the request's [`TimeoutSpec`] into the SDK [`Timeout`]. An absent half
/// maps to `Never`; presence is already enforced by [`validate_timeout`].
fn build_timeout(timeout: &TimeoutSpec) -> Result<Timeout, AppError> {
    let height = match &timeout.height {
        Some(h) => TimeoutHeight::At(Height::new(h.revision_number, h.revision_height).map_err(
            |err| AppError::Validation {
                message: format!("invalid timeout height: {err}"),
                field: Some("timeout".to_string()),
                details: None,
            },
        )?),
        None => TimeoutHeight::Never,
    };
    let time = match timeout.timestamp {
        Some(ts) => TimeoutTimestamp::At(Timestamp::from_nanoseconds(ts)),
        None => TimeoutTimestamp::Never,
    };
    Ok(Timeout::new(height, time))
}

/// The two compute-budget instructions injected ahead of every operation: an
/// explicit compute-unit limit and priority-fee price (wallets inject neither).
fn compute_budget_instructions() -> Result<[Instruction; 2], AppError> {
    let program = parse_program_id(COMPUTE_BUDGET_PROGRAM_ID)?;
    let mut limit_data = Vec::with_capacity(5);
    limit_data.push(SET_COMPUTE_UNIT_LIMIT_TAG);
    limit_data.extend_from_slice(&COMPUTE_UNIT_LIMIT.to_le_bytes());
    let mut price_data = Vec::with_capacity(9);
    price_data.push(SET_COMPUTE_UNIT_PRICE_TAG);
    price_data.extend_from_slice(&COMPUTE_UNIT_PRICE_MICRO_LAMPORTS.to_le_bytes());
    Ok([
        Instruction::new_with_bytes(program, &limit_data, Vec::new()),
        Instruction::new_with_bytes(program, &price_data, Vec::new()),
    ])
}

/// Prepend the compute-budget instructions to `operation`, yielding the full
/// instruction list a transaction compiles from.
fn with_compute_budget(operation: Instruction) -> Result<Vec<Instruction>, AppError> {
    let mut instructions = compute_budget_instructions()?.to_vec();
    instructions.push(operation);
    Ok(instructions)
}

/// Build an idempotent create-ATA instruction: `owner`'s associated token account
/// on `mint` under the classic SPL Token program, funded and signed by `owner`.
fn create_ata_instruction(owner: Pubkey, mint: Pubkey) -> Result<Instruction, AppError> {
    let ata_program = parse_program_id(ATA_PROGRAM_ID)?;
    let token_program = parse_program_id(SPL_TOKEN_PROGRAM_ID)?;
    let system_program = parse_program_id(SYSTEM_PROGRAM_ID)?;
    let associated_account = Pubkey::find_program_address(
        &[owner.as_ref(), token_program.as_ref(), mint.as_ref()],
        &ata_program,
    )
    .0;
    Ok(Instruction::new_with_bytes(
        ata_program,
        &[CREATE_ATA_IDEMPOTENT_TAG],
        vec![
            AccountMeta::new(owner, true),
            AccountMeta::new(associated_account, false),
            AccountMeta::new_readonly(owner, false),
            AccountMeta::new_readonly(mint, false),
            AccountMeta::new_readonly(system_program, false),
            AccountMeta::new_readonly(token_program, false),
        ],
    ))
}

/// Compile `instructions` into an unsigned base64 v0 transaction pinned to
/// `blockhash`, `payer` in slot 0. The signature array is zero-filled to the
/// required width; the wallet fills it before broadcast. Deterministic per input.
fn finalize_transaction(
    payer: &Pubkey,
    instructions: Vec<Instruction>,
    blockhash: &str,
) -> Result<String, AppError> {
    let recent_blockhash = Hash::from_str(blockhash)
        .map_err(|err| AppError::Internal(format!("invalid recent blockhash: {err}")))?;
    let message = V0Message::try_compile(payer, &instructions, &[], recent_blockhash)
        .map_err(|err| AppError::Internal(format!("failed to compile v0 message: {err}")))?;
    let signature_count = message.header.num_required_signatures;
    let message_bytes = VersionedMessage::V0(message).serialize();

    let mut transaction = Vec::new();
    encode_compact_u16(&mut transaction, u16::from(signature_count));
    transaction.extend(std::iter::repeat_n(
        0u8,
        usize::from(signature_count) * SIGNATURE_LEN,
    ));
    transaction.extend_from_slice(&message_bytes);
    Ok(base64::engine::general_purpose::STANDARD.encode(&transaction))
}

/// Encode `value` as a Solana `short_u16` (compact-u16) length prefix.
fn encode_compact_u16(out: &mut Vec<u8>, mut value: u16) {
    loop {
        let low_seven = value & 0x7f;
        let byte = low_seven.to_le_bytes()[0];
        if value < 0x80 {
            out.push(byte);
            break;
        }
        out.push(byte | 0x80);
        value >>= 7;
    }
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
    /// Origin keys off the Nolus-side `bank_symbol` trace, not `native`: a
    /// Solana-native asset is an IBC voucher on Nolus (`ibc/…`), and the real
    /// model sets `native` iff `bank_symbol == "unls"` — so a Solana-native asset
    /// is `native: false` (see report — origin-discriminator finding).
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
            native: false,
            coingecko_id: None,
            protocol: SOLANA_PROTOCOL.to_string(),
            group: "lease".to_string(),
            is_active: true,
        }
    }

    /// A Nolus-origin voucher in the SOLANA protocol set (dispatches Sink). Its
    /// native Nolus denom is `unls`, so the real model sets `native: true`.
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
            native: true,
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
            bank_symbol: "ibc/USDCONSOLANA".to_string(),
            ticker: "USDC".to_string(),
            amount: 5_000_000,
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

    #[test]
    fn parse_channel_ordinal_defaults_when_unset_or_empty_and_parses_a_value() {
        assert_eq!(
            parse_channel_ordinal(None).expect("unset defaults"),
            DEFAULT_TRANSFER_CHANNEL_ORDINAL
        );
        assert_eq!(
            parse_channel_ordinal(Some("")).expect("empty defaults"),
            DEFAULT_TRANSFER_CHANNEL_ORDINAL
        );
        assert_eq!(parse_channel_ordinal(Some("7")).expect("valid parses"), 7);
    }

    #[test]
    fn parse_channel_ordinal_fails_loudly_on_a_malformed_value() {
        // A set-but-unparseable ordinal must surface, never silently compose
        // against the channel-0 default.
        assert!(matches!(
            parse_channel_ordinal(Some("not-a-number")),
            Err(AppError::Internal(_))
        ));
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

    #[tokio::test]
    async fn build_send_source_rejects_a_wrong_hrp_recipient_address() {
        // Recipient validation is Nolus-only: a well-formed bech32 address on a
        // foreign HRP (a valid `osmo1…`) must be rejected, not just malformed
        // input — a Solana send credits a Nolus recipient.
        let state = state_with_solana("http://127.0.0.1:1/").await;
        let mut req = send_request("USDC@SOLANA-JUPITER-USDC");
        req.recipient = "osmo1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3aq6l09".to_string();
        let err = build_send_source(State(state), Json(req))
            .await
            .expect_err("a valid osmo address must be rejected on the nolus HRP");
        assert!(
            matches!(err, AppError::Validation { field, .. } if field.as_deref() == Some("recipient"))
        );
    }

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

    // The three build paths are registered in `handlers::openapi::ApiDoc` and
    // wired strict-class in `main.rs`; the pre-existing
    // `openapi::tests::openapi_spec_matches_snapshot` guards their presence and
    // full shape via the committed `openapi.snapshot.json` (regenerated to
    // include them). No duplicate assertion here — a lone path-presence check
    // would be green scaffolding, not a red behavioral test.
}
