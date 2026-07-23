//! Solana balance and transfer-parameter handlers.
//!
//! Both endpoints are read-class (standard rate limit). They query the
//! operator's Solana RPC through [`crate::external::solana::SolanaClient`] and
//! surface typed [`AppError`]s: `400` for a malformed address, `502` for an RPC
//! failure, `503` when Solana RPC is unconfigured or a cache is cold.

use std::sync::Arc;

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::debug;
use utoipa::ToSchema;

use crate::error::AppError;
use crate::external::solana::{SolanaEpochInfo, SolanaTokenBalance, TokenAccountsFilter};
use crate::handlers::currencies::CurrencyInfo;
use crate::AppState;

/// Chain label embedded in `AppError::ChainRpc` for Solana upstream failures.
const CHAIN: &str = "solana";

/// Native SOL has 9 decimal places (1 SOL = 1e9 lamports).
const SOL_DECIMALS: u8 = 9;

/// Symbol reported for the native SOL balance entry.
const SOL_SYMBOL: &str = "SOL";

/// Network prefix in the `NETWORK-DEX-LPN` protocol identifier that marks a
/// currency as belonging to the SOLANA protocol set.
const SOLANA_PROTOCOL_PREFIX: &str = "SOLANA";

/// Conservative upper bound, in Solana slots, on how far past the current slot
/// an incoming packet's `timeout_height` may extend: 24h at the program's
/// floored 2 slots/s (`24 * 3600 * 2`).
///
/// Mirrors ibc-solray's `api::timeout::MAX_LIFETIME_BLOCKS`, which is gated
/// behind that crate's `program` feature and so is not importable by SDK
/// consumers. The recv chokepoint rejects a packet whose `timeout_height`
/// exceeds `host_height + MAX_LIFETIME_BLOCKS`, so a client must keep its chosen
/// timeout height within this many slots of the current slot.
const RECV_TIMEOUT_LIFETIME_SLOTS: u64 = 172_800;

/// SOL + SPL balances for a Solana wallet.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SolanaBalancesResponse {
    /// The queried base58 wallet address, echoed back.
    pub address: String,
    /// Native SOL balance (lamports; 9 decimals).
    pub sol: SolanaBalanceInfo,
    /// SPL balances for the SOLANA-protocol currency set. Empty when the wallet
    /// holds none of the provisioned mints — a legitimate result, not an error.
    pub tokens: Vec<SolanaBalanceInfo>,
}

/// A single Solana balance entry.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct SolanaBalanceInfo {
    /// Currency key (`TICKER@PROTOCOL`) when the balance maps to a provisioned
    /// SOLANA-protocol currency; `None` for native SOL.
    pub key: Option<String>,
    /// Human ticker/symbol (e.g. `SOL`, `USDC`).
    pub symbol: String,
    /// SPL mint address; `None` for native SOL.
    pub mint: Option<String>,
    /// Raw on-chain amount in base units (lamports for SOL), as a string.
    pub amount: String,
    /// Decimal places for the base-unit amount.
    pub decimal_digits: u8,
}

/// Fresh Solana height data for building an IBC `MsgTransfer` timeout height.
#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct SolanaTransferParamsResponse {
    /// Current absolute Solana slot — the `revision_height` reference a client
    /// bases its `timeout_height` on. Fetched fresh per request (never cached);
    /// a stale slot would silently shorten the usable timeout window.
    pub slot: u64,
    /// Current Solana epoch — the `revision_number` the program's host height
    /// carries. A packet `timeout_height` must use this revision number.
    pub revision_number: u64,
    /// Maximum slots past the current slot a packet `timeout_height` may extend
    /// before the recv chokepoint rejects it (~24h at 2 slots/s).
    pub max_lifetime_slots: u64,
    /// Convenience upper bound: `slot + max_lifetime_slots`. A client may set its
    /// timeout height's `revision_height` up to this value (inclusive).
    pub max_timeout_height: u64,
}

/// Get Solana wallet balances
///
/// Returns the native SOL balance plus SPL balances for the SOLANA protocol's
/// currency set (mints resolved from each currency's `dex_symbol`), keyed by a
/// base58 wallet address. A funded wallet returns its holdings; an unfunded
/// wallet returns a zero SOL balance and an empty token list. Only a malformed
/// address returns a typed error.
#[utoipa::path(
    get,
    path = "/api/solana/balances/{address}",
    tag = "solana",
    params(
        ("address" = String, Path, description = "Base58 Solana wallet address"),
    ),
    responses(
        (status = 200, description = "Solana wallet balances", body = SolanaBalancesResponse),
        (status = 400, description = "Invalid address", body = crate::error::ErrorResponse),
        (status = 502, description = "Solana RPC error", body = crate::error::ErrorResponse),
        (status = 503, description = "Solana RPC unconfigured or cache cold", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_solana_balances(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<SolanaBalancesResponse>, AppError> {
    debug!("Fetching Solana balances");

    // Validate first: a malformed address is the only typed-error path.
    crate::validation::validate_solana_address(&address, "address")?;

    // Native SOL. 503 when Solana RPC is unconfigured; 502 on an RPC failure.
    let lamports = state.solana_client.get_balance(&address).await?;
    let sol = SolanaBalanceInfo {
        key: None,
        symbol: SOL_SYMBOL.to_string(),
        mint: None,
        amount: lamports.to_string(),
        decimal_digits: SOL_DECIMALS,
    };

    // SPL balances for the SOLANA-protocol currency set. Cold cache -> 503.
    let currencies = state
        .data_cache
        .currencies
        .load_or_unavailable("Currencies")?;

    // Fan out one getTokenAccountsByOwner per SOLANA-protocol mint concurrently;
    // the client's own semaphore bounds actual egress. try_join_all fails fast on
    // the first RPC error (502).
    let solana_client = &state.solana_client;
    let owner = address.as_str();
    let token_futures = currencies
        .currencies
        .values()
        .filter(|currency| {
            is_solana_protocol(&currency.protocol) && !currency.dex_symbol.is_empty()
        })
        .map(|currency| async move {
            let filter = TokenAccountsFilter::Mint(currency.dex_symbol.clone());
            let accounts = solana_client
                .get_token_accounts_by_owner(owner, &filter)
                .await?;
            fold_token_balance(currency, &accounts)
        });
    let tokens: Vec<SolanaBalanceInfo> = futures::future::try_join_all(token_futures)
        .await?
        .into_iter()
        .flatten()
        .collect();

    Ok(Json(SolanaBalancesResponse {
        address,
        sol,
        tokens,
    }))
}

/// Get Solana transfer-timeout parameters
///
/// Serves the fresh current slot and epoch a client needs to build a height-
/// based `MsgTransfer` timeout, plus the program's lifetime bound. The Solana
/// program rejects timestamp-only timeouts, so a client must set a
/// `timeout_height` with `revision_number = revision_number` and
/// `revision_height` in `(slot, max_timeout_height]`. Never cached.
#[utoipa::path(
    get,
    path = "/api/solana/transfer-params",
    tag = "solana",
    responses(
        (status = 200, description = "Fresh Solana transfer-timeout parameters", body = SolanaTransferParamsResponse),
        (status = 502, description = "Solana RPC error", body = crate::error::ErrorResponse),
        (status = 503, description = "Solana RPC unconfigured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_solana_transfer_params(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SolanaTransferParamsResponse>, AppError> {
    let epoch_info = state.solana_client.get_epoch_info().await?;
    Ok(Json(transfer_params_from_epoch(&epoch_info)))
}

/// Whether a `NETWORK-DEX-LPN` protocol identifier belongs to the SOLANA
/// network. Case-insensitive on the network prefix.
fn is_solana_protocol(protocol: &str) -> bool {
    protocol
        .to_ascii_uppercase()
        .starts_with(SOLANA_PROTOCOL_PREFIX)
}

/// Sum a currency's SPL token accounts into one balance entry, or `None` when
/// the wallet holds no account for the mint (omitted, mirroring the Nolus
/// balances handler which lists only held denoms). A token amount the RPC
/// returns that does not parse is an upstream failure, surfaced as a typed
/// `ChainRpc` error naming the mint rather than silently under-reporting.
fn fold_token_balance(
    currency: &CurrencyInfo,
    accounts: &[SolanaTokenBalance],
) -> Result<Option<SolanaBalanceInfo>, AppError> {
    let Some(first) = accounts.first() else {
        return Ok(None);
    };
    let decimals = first.decimals;

    let mut total: u128 = 0;
    for account in accounts {
        let amount = account
            .amount
            .parse::<u128>()
            .map_err(|_err| AppError::ChainRpc {
                chain: CHAIN.to_string(),
                message: format!(
                    "unparseable token amount for mint {}: {}",
                    account.mint, account.amount
                ),
            })?;
        total = total.saturating_add(amount);
    }

    Ok(Some(SolanaBalanceInfo {
        key: Some(currency.key.clone()),
        symbol: currency.symbol.clone(),
        mint: Some(currency.dex_symbol.clone()),
        amount: total.to_string(),
        decimal_digits: decimals,
    }))
}

/// Build the transfer-params payload from fresh epoch info. Pure so the lifetime
/// arithmetic (and its saturation guard) is unit-testable without an RPC.
fn transfer_params_from_epoch(epoch_info: &SolanaEpochInfo) -> SolanaTransferParamsResponse {
    SolanaTransferParamsResponse {
        slot: epoch_info.absolute_slot,
        revision_number: epoch_info.epoch,
        max_lifetime_slots: RECV_TIMEOUT_LIFETIME_SLOTS,
        max_timeout_height: epoch_info
            .absolute_slot
            .saturating_add(RECV_TIMEOUT_LIFETIME_SLOTS),
    }
}

#[cfg(test)]
mod tests {
    use std::collections::HashMap;
    use std::sync::Arc;

    use serde_json::json;
    use wiremock::matchers::{body_partial_json, method};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use super::*;
    use crate::handlers::currencies::CurrenciesResponse;

    /// AppState whose Solana client targets `solana_url` with a real-timeout HTTP
    /// client so handler tests can drive it against a mock server.
    async fn state_with_solana(solana_url: &str) -> Arc<AppState> {
        let mut config = crate::test_utils::test_config();
        config.external.solana_rpc_url = Some(solana_url.to_string());
        crate::test_utils::test_app_state_with_config_and_client(config, reqwest::Client::new())
            .await
    }

    /// Mount a `{context, value}` JSON-RPC success for `rpc_method`.
    async fn mount_value(server: &MockServer, rpc_method: &str, value: serde_json::Value) {
        Mock::given(method("POST"))
            .and(body_partial_json(json!({ "method": rpc_method })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": { "context": { "slot": 1 }, "value": value },
            })))
            .mount(server)
            .await;
    }

    fn currency(key: &str, protocol: &str, dex_symbol: &str) -> CurrencyInfo {
        CurrencyInfo {
            key: key.to_string(),
            ticker: "USDC".to_string(),
            symbol: "USDC".to_string(),
            name: "USD Coin".to_string(),
            short_name: "USDC".to_string(),
            decimal_digits: 6,
            bank_symbol: String::new(),
            dex_symbol: dex_symbol.to_string(),
            icon: String::new(),
            native: false,
            coingecko_id: None,
            protocol: protocol.to_string(),
            group: "lease".to_string(),
            is_active: true,
        }
    }

    fn token(mint: &str, amount: &str, decimals: u8) -> SolanaTokenBalance {
        SolanaTokenBalance {
            mint: mint.to_string(),
            amount: amount.to_string(),
            decimals,
        }
    }

    #[test]
    fn is_solana_protocol_matches_solana_network_only() {
        assert!(is_solana_protocol("SOLANA-JUPITER-USDC"));
        assert!(is_solana_protocol("solana-jupiter-usdc"));
        assert!(!is_solana_protocol("OSMOSIS-OSMOSIS-USDC_NOBLE"));
        assert!(!is_solana_protocol("NEUTRON-ASTROPORT-USDC"));
        assert!(!is_solana_protocol(""));
    }

    #[test]
    fn fold_token_balance_is_none_for_no_accounts() {
        let currency = currency("USDC@SOLANA-JUPITER-USDC", "SOLANA-JUPITER-USDC", "Mint1");
        assert!(fold_token_balance(&currency, &[])
            .expect("no rpc error")
            .is_none());
    }

    #[test]
    fn fold_token_balance_sums_multiple_accounts() {
        let currency = currency("USDC@SOLANA-JUPITER-USDC", "SOLANA-JUPITER-USDC", "MintX");
        let accounts = [token("MintX", "1500000", 6), token("MintX", "2500000", 6)];
        let info = fold_token_balance(&currency, &accounts)
            .expect("no rpc error")
            .expect("held balance");
        assert_eq!(info.amount, "4000000");
        assert_eq!(info.decimal_digits, 6);
        assert_eq!(info.key.as_deref(), Some("USDC@SOLANA-JUPITER-USDC"));
        assert_eq!(info.mint.as_deref(), Some("MintX"));
    }

    #[test]
    fn fold_token_balance_errors_on_unparseable_amount() {
        let currency = currency("USDC@SOLANA-JUPITER-USDC", "SOLANA-JUPITER-USDC", "MintX");
        let accounts = [token("MintX", "not-a-number", 6)];
        match fold_token_balance(&currency, &accounts) {
            Err(AppError::ChainRpc { chain, message }) => {
                assert_eq!(chain, "solana");
                assert!(message.contains("MintX"), "message was: {message}");
            }
            other => panic!("expected ChainRpc for an unparseable amount, got {other:?}"),
        }
    }

    #[test]
    fn transfer_params_bounds_timeout_by_lifetime() {
        let epoch_info = SolanaEpochInfo {
            absolute_slot: 250_000_000,
            epoch: 579,
        };
        let params = transfer_params_from_epoch(&epoch_info);
        assert_eq!(params.slot, 250_000_000);
        assert_eq!(params.revision_number, 579);
        assert_eq!(params.max_lifetime_slots, RECV_TIMEOUT_LIFETIME_SLOTS);
        assert_eq!(params.max_timeout_height, 250_000_000 + 172_800);
    }

    #[test]
    fn transfer_params_saturates_at_slot_ceiling() {
        let epoch_info = SolanaEpochInfo {
            absolute_slot: u64::MAX,
            epoch: 1,
        };
        let params = transfer_params_from_epoch(&epoch_info);
        assert_eq!(params.max_timeout_height, u64::MAX);
    }

    /// A malformed address is rejected before any RPC or cache access, as the
    /// 400-mapped `Validation` error — matching the Nolus balances contract.
    #[tokio::test]
    async fn get_solana_balances_rejects_invalid_address() {
        let state = crate::test_utils::test_app_state().await;
        let err = super::get_solana_balances(
            axum::extract::State(state),
            axum::extract::Path("not-a-solana-address".to_string()),
        )
        .await
        .expect_err("invalid address must be rejected");
        match err {
            AppError::Validation { field, .. } => {
                assert_eq!(field, Some("address".to_string()));
            }
            other => panic!("expected Validation for an invalid address, got {other:?}"),
        }
    }

    /// Happy path: native SOL plus one held SPL entry from the SOLANA-protocol
    /// currency set, resolved through mocked RPC and a provisioned currency.
    #[tokio::test]
    async fn get_solana_balances_returns_sol_and_held_spl() {
        let owner = "So11111111111111111111111111111111111111112";
        let mint = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";

        let server = MockServer::start().await;
        mount_value(&server, "getBalance", json!(2_000_000_000_u64)).await;
        mount_value(
            &server,
            "getTokenAccountsByOwner",
            json!([
                {
                    "account": {
                        "data": {
                            "parsed": {
                                "info": {
                                    "mint": mint,
                                    "tokenAmount": { "amount": "5000000", "decimals": 6 },
                                }
                            }
                        }
                    }
                }
            ]),
        )
        .await;

        let state = state_with_solana(&server.uri()).await;
        let mut currencies = HashMap::new();
        currencies.insert(
            "USDC@SOLANA-JUPITER-USDC".to_string(),
            currency("USDC@SOLANA-JUPITER-USDC", "SOLANA-JUPITER-USDC", mint),
        );
        state.data_cache.currencies.store(CurrenciesResponse {
            currencies,
            lpn: Vec::new(),
            lease_currencies: Vec::new(),
            map: HashMap::new(),
        });

        let response = super::get_solana_balances(
            axum::extract::State(state),
            axum::extract::Path(owner.to_string()),
        )
        .await
        .expect("balances")
        .0;

        assert_eq!(response.address, owner);
        assert_eq!(response.sol.amount, "2000000000");
        assert_eq!(response.sol.decimal_digits, 9);
        assert_eq!(response.tokens.len(), 1);
        assert_eq!(response.tokens[0].amount, "5000000");
        assert_eq!(response.tokens[0].decimal_digits, 6);
        assert_eq!(response.tokens[0].mint.as_deref(), Some(mint));
        assert_eq!(
            response.tokens[0].key.as_deref(),
            Some("USDC@SOLANA-JUPITER-USDC")
        );
    }

    /// The transfer-params handler serves the full response shape from a freshly
    /// fetched epoch, with the timeout bound applied.
    #[tokio::test]
    async fn get_solana_transfer_params_returns_full_shape() {
        let server = MockServer::start().await;
        Mock::given(method("POST"))
            .and(body_partial_json(json!({ "method": "getEpochInfo" })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0",
                "id": 1,
                "result": { "absoluteSlot": 300_000_000_u64, "epoch": 700 },
            })))
            .mount(&server)
            .await;

        let state = state_with_solana(&server.uri()).await;
        let response = super::get_solana_transfer_params(axum::extract::State(state))
            .await
            .expect("transfer params")
            .0;

        assert_eq!(response.slot, 300_000_000);
        assert_eq!(response.revision_number, 700);
        assert_eq!(response.max_lifetime_slots, RECV_TIMEOUT_LIFETIME_SLOTS);
        assert_eq!(response.max_timeout_height, 300_000_000 + 172_800);
    }
}
