//! Lease handlers for querying and managing lease positions
//!
//! Endpoints:
//! - GET /api/leases?owner=... - Get all leases for an owner
//! - GET /api/leases/:address - Get details for a specific lease
//! - GET /api/leases/:address/history - Get lease history
//! - POST /api/leases/quote - Get a quote for opening a lease
//! - POST /api/leases/open - Build transaction to open a lease
//! - POST /api/leases/repay - Build transaction to repay a lease
//! - POST /api/leases/close - Build transaction to close a lease
//! - POST /api/leases/market-close - Build transaction for market close

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use std::time::Duration;
use tracing::{debug, error, warn};

use crate::error::AppError;
use crate::external::chain::{AmountSpec, ClosingLeaseInfo, LeaseStatusResponse, OpenedLeaseInfo};
use crate::query_types::{AddressWithProtocolQuery, OptionalProtocolQuery};
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Serialize, Deserialize)]
pub struct LeasesResponse {
    pub leases: Vec<LeaseInfo>,
    pub total_collateral_usd: String,
    pub total_debt_usd: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseInfo {
    pub address: String,
    pub protocol: String,
    pub status: LeaseStatusType,
    /// Asset being held (collateral)
    pub amount: LeaseAssetInfo,
    /// Current debt (principal + interest)
    pub debt: LeaseDebtInfo,
    /// Interest rates
    pub interest: LeaseInterestInfo,
    /// Liquidation price
    pub liquidation_price: Option<String>,
    /// Opening timestamp (from ETL)
    pub opened_at: Option<String>,
    /// PnL information
    pub pnl: Option<LeasePnlInfo>,
    /// Close policy (stop loss / take profit)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub close_policy: Option<LeaseClosePolicy>,
    /// Time until overdue interest collection (nanoseconds)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub overdue_collect_in: Option<String>,
    /// In-progress operation (if any)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub in_progress: Option<LeaseInProgress>,
    /// Opening state info (for leases still opening)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub opening_info: Option<LeaseOpeningStateInfo>,
    /// Historical data from ETL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub etl_data: Option<LeaseEtlData>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LeaseStatusType {
    Opening,
    Opened,
    PaidOff,
    Closing,
    Closed,
    Liquidated,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseAssetInfo {
    pub ticker: String,
    pub amount: String,
    pub amount_usd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseDebtInfo {
    pub ticker: String,
    pub principal: String,
    pub overdue_margin: String,
    pub overdue_interest: String,
    pub due_margin: String,
    pub due_interest: String,
    pub total: String,
    pub total_usd: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseInterestInfo {
    /// Loan interest rate (permille)
    pub loan_rate: u32,
    /// Margin interest rate (percent)
    pub margin_rate: u32,
    /// Combined annual rate as percentage
    pub annual_rate_percent: f64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeasePnlInfo {
    pub amount: String,
    pub percent: String,
    pub downpayment: String,
    pub pnl_positive: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseClosePolicy {
    /// Stop loss threshold (permille)
    pub stop_loss: Option<u32>,
    /// Take profit threshold (permille)
    pub take_profit: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum LeaseInProgress {
    /// Lease is opening
    Opening {
        #[serde(skip_serializing_if = "Option::is_none")]
        stage: Option<String>,
    },
    /// Repayment in progress
    Repayment {},
    /// Close in progress
    Close {},
    /// Liquidation in progress
    Liquidation {
        #[serde(skip_serializing_if = "Option::is_none")]
        cause: Option<String>,
    },
    /// Slippage protection activated — actions blocked
    SlippageProtection {},
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseOpeningStateInfo {
    /// Currency being leased
    pub currency: String,
    /// Downpayment amount
    pub downpayment: LeaseAssetInfo,
    /// Loan amount
    pub loan: LeaseAssetInfo,
    /// Loan interest rate (permille)
    pub loan_interest_rate: u32,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseEtlData {
    /// Downpayment amount in USD
    pub downpayment_amount: Option<String>,
    /// Opening price per asset
    pub price: Option<String>,
    /// LPN price at opening (for short positions)
    pub lpn_price: Option<String>,
    /// DEX/swap fee
    pub fee: Option<String>,
    /// Lease asset symbol
    pub ls_asset_symbol: Option<String>,
    /// Position ticker
    pub lease_position_ticker: Option<String>,
    /// Repayment value (total repaid so far)
    pub repayment_value: Option<String>,
    /// Transaction history
    pub history: Option<Vec<LeaseHistoryEntry>>,
}

#[derive(Debug, Deserialize)]
pub struct LeaseQuoteRequest {
    pub protocol: String,
    pub downpayment_ticker: String,
    pub downpayment_amount: String,
    #[serde(default)]
    pub max_ltd: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct LeaseQuoteResponse {
    pub borrow_ticker: String,
    pub borrow_amount: String,
    pub annual_interest_rate: f64,
    pub estimated_liquidation_price: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct OpenLeaseRequest {
    pub protocol: String,
    pub downpayment_ticker: String,
    pub downpayment_amount: String,
    #[serde(default)]
    pub max_ltd: Option<u32>,
}

#[derive(Debug, Serialize)]
pub struct LeaseTransactionResponse {
    pub messages: Vec<serde_json::Value>,
    pub memo: String,
}

#[derive(Debug, Deserialize)]
pub struct RepayLeaseRequest {
    pub lease_address: String,
    pub amount: String,
}

#[derive(Debug, Deserialize)]
pub struct CloseLeaseRequest {
    pub lease_address: String,
}

#[derive(Debug, Deserialize)]
pub struct MarketCloseRequest {
    pub lease_address: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseHistoryEntry {
    pub tx_hash: Option<String>,
    pub action: String,
    pub amount: Option<String>,
    pub symbol: Option<String>,
    pub timestamp: Option<String>,
}

// ============================================================================
// Lease Configuration
// ============================================================================

/// Response for lease configuration per protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseConfigResponse {
    pub protocol: String,
    pub downpayment_ranges:
        std::collections::HashMap<String, crate::config_store::gated_types::DownpaymentRange>,
    pub min_asset: AmountSpec,
    pub min_transaction: AmountSpec,
}

/// GET /api/leases/config/:protocol
/// Returns lease validation configuration for a specific protocol.
/// Reads from background-refreshed cache.
pub async fn get_lease_config(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<Json<LeaseConfigResponse>, AppError> {
    debug!("Fetching lease config for protocol: {}", protocol);

    let lease_configs = state.data_cache.lease_configs.load_or_unavailable("Lease configs")?;

    let config = lease_configs
        .get(&protocol)
        .cloned()
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Lease config for protocol {}", protocol),
        })?;

    Ok(Json(config))
}

// ============================================================================
// Constants
// ============================================================================

const PERMILLE: f64 = 1000.0;
const INTEREST_DECIMALS: u32 = 7;

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/leases?owner=...&protocol=...
/// Returns all leases for an owner across all or a specific protocol
///
/// Leases are filtered based on gated configuration:
/// - Only leases from configured protocols are returned
/// - Asset restrictions (ignore_all, ignore_long, ignore_short) are applied
pub async fn get_leases(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AddressWithProtocolQuery>,
) -> Result<Json<LeasesResponse>, AppError> {
    crate::validation::validate_bech32_address(&query.address, "address")?;
    debug!("Getting leases for owner: {}", query.address);

    // Read filter context from cache
    let filter_ctx = state.data_cache.filter_context.load_or_unavailable("Filter context")?;

    let admin_address = &state.config.protocols.admin_contract;

    // Get all protocols or filter to specific one, then apply gated filter
    let protocols: Vec<String> = match &query.protocol {
        Some(p) => {
            // If specific protocol requested, only return it if configured
            if filter_ctx.is_protocol_visible(p) {
                vec![p.clone()]
            } else {
                vec![]
            }
        }
        None => {
            // Get all protocols from chain and filter to configured ones
            let all_protocols = state
                .chain_client
                .get_admin_protocols(admin_address)
                .await?;

            all_protocols
                .into_iter()
                .filter(|p| filter_ctx.is_protocol_visible(p))
                .collect()
        }
    };

    // Fetch leases from all configured protocols in parallel
    let protocol_futures: Vec<_> = protocols
        .iter()
        .map(|protocol| {
            let state = state.clone();
            let protocol = protocol.clone();
            let owner = query.address.clone();
            let admin_address = admin_address.clone();
            let filter_ctx = filter_ctx.clone();
            async move {
                // Get protocol contracts
                let protocol_contracts = match state
                    .chain_client
                    .get_admin_protocol(&admin_address, &protocol)
                    .await
                {
                    Ok(p) => p,
                    Err(e) => {
                        error!("Failed to get protocol {}: {}", protocol, e);
                        return Vec::new();
                    }
                };

                // Get lease addresses for this owner
                let lease_addresses = match state
                    .chain_client
                    .get_customer_leases(&protocol_contracts.contracts.leaser, &owner)
                    .await
                {
                    Ok(leases) => leases,
                    Err(e) => {
                        debug!("No leases found for protocol {}: {}", protocol, e);
                        return Vec::new();
                    }
                };

                // Fetch all lease details in parallel with per-lease timeout
                let lease_futures: Vec<_> = lease_addresses
                    .into_iter()
                    .map(|lease_address| {
                        let state = state.clone();
                        let protocol = protocol.clone();
                        async move {
                            match tokio::time::timeout(
                                Duration::from_secs(10),
                                fetch_lease_info(&state, &lease_address, &protocol),
                            )
                            .await
                            {
                                Ok(Ok(lease)) => Some(lease),
                                Ok(Err(e)) => {
                                    warn!("Failed to fetch lease {}: {}", lease_address, e);
                                    None
                                }
                                Err(_) => {
                                    warn!("Timeout fetching lease {}", lease_address);
                                    None
                                }
                            }
                        }
                    })
                    .collect();

                let leases: Vec<LeaseInfo> = futures::future::join_all(lease_futures)
                    .await
                    .into_iter()
                    .flatten()
                    .collect();

                // Filter leases based on asset restrictions
                leases
                    .into_iter()
                    .filter(|lease| {
                        filter_ctx.is_lease_visible(&lease.protocol, &lease.amount.ticker)
                    })
                    .collect::<Vec<_>>()
            }
        })
        .collect();

    let all_leases: Vec<LeaseInfo> = futures::future::join_all(protocol_futures)
        .await
        .into_iter()
        .flatten()
        .collect();

    // Calculate totals (simplified - would need prices for USD conversion)
    let total_collateral_usd = "0".to_string();
    let total_debt_usd = "0".to_string();

    Ok(Json(LeasesResponse {
        leases: all_leases,
        total_collateral_usd,
        total_debt_usd,
    }))
}

/// GET /api/leases/:address?protocol=...
/// Returns details for a specific lease
pub async fn get_lease(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
    Query(query): Query<OptionalProtocolQuery>,
) -> Result<Json<LeaseInfo>, AppError> {
    debug!("Getting lease: {}", address);

    let protocol = query
        .protocol
        .unwrap_or_else(|| "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string());

    fetch_lease_info(&state, &address, &protocol)
        .await
        .map(Json)
}

/// Compose an ETL history action with the liquidation cause from the `additional` field.
///
/// For liquidation entries, the ETL returns `additional` as "overdue interest" or
/// "high liability". We compose these into "liquidation-overdue interest" or
/// "liquidation-high liability" to match the locale keys directly.
///
/// Non-liquidation entries (repay, market-close) pass through unchanged.
fn enrich_history_action(action: &str, additional: Option<&str>) -> String {
    if action == "liquidation" {
        let cause = match additional {
            Some(c) if !c.is_empty() => c,
            _ => "unknown",
        };
        return format!("{}-{}", action, cause);
    }
    action.to_string()
}

/// GET /api/leases/:address/history
/// Returns transaction history for a lease
pub async fn get_lease_history(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<Vec<LeaseHistoryEntry>>, AppError> {
    debug!("Getting lease history: {}", address);

    // Fetch from ETL API
    let lease_opening = state.etl_client.fetch_lease_opening(&address).await;

    // Extract history from ETL response if available
    let history = match lease_opening {
        Ok(opening) => {
            // Check both top-level and nested history fields
            let etl_history = opening
                .history
                .or(opening.lease.history)
                .unwrap_or_default();

            // Convert ETL history entries to our format
            etl_history
                .into_iter()
                .map(|entry| LeaseHistoryEntry {
                    tx_hash: entry.tx_hash,
                    action: enrich_history_action(&entry.action, entry.additional.as_deref()),
                    amount: entry.amount,
                    symbol: entry.symbol,
                    timestamp: entry.timestamp,
                })
                .collect()
        }
        Err(e) => {
            debug!("Failed to fetch lease history from ETL: {}", e);
            vec![]
        }
    };

    Ok(Json(history))
}

/// POST /api/leases/quote
/// Get a quote for opening a lease
pub async fn get_lease_quote(
    State(state): State<Arc<AppState>>,
    Json(request): Json<LeaseQuoteRequest>,
) -> Result<Json<LeaseQuoteResponse>, AppError> {
    debug!("Getting lease quote for protocol: {}", request.protocol);

    let admin_address = &state.config.protocols.admin_contract;
    let protocol_contracts = state
        .chain_client
        .get_admin_protocol(admin_address, &request.protocol)
        .await?;

    let quote = state
        .chain_client
        .get_lease_quote(
            &protocol_contracts.contracts.leaser,
            &request.downpayment_amount,
            &request.downpayment_ticker,
            request.max_ltd,
        )
        .await?;

    // Convert interest rates to percentage
    let annual_interest = (quote.annual_interest_rate + quote.annual_interest_rate_margin) as f64
        / 10f64.powi(INTEREST_DECIMALS as i32)
        * 100.0;

    Ok(Json(LeaseQuoteResponse {
        borrow_ticker: quote.borrow.ticker,
        borrow_amount: quote.borrow.amount,
        annual_interest_rate: annual_interest,
        estimated_liquidation_price: None, // Would need price data to calculate
    }))
}

/// POST /api/leases/open
/// Build transaction messages to open a new lease
pub async fn open_lease(
    State(state): State<Arc<AppState>>,
    Json(request): Json<OpenLeaseRequest>,
) -> Result<Json<LeaseTransactionResponse>, AppError> {
    debug!(
        "Building open lease transaction for protocol: {}",
        request.protocol
    );

    let admin_address = &state.config.protocols.admin_contract;
    let protocol_contracts = state
        .chain_client
        .get_admin_protocol(admin_address, &request.protocol)
        .await?;

    // Build the open lease message
    // The actual transaction needs to be signed by the user's wallet
    let open_msg = serde_json::json!({
        "open_lease": {
            "currency": request.downpayment_ticker,
            "max_ltd": request.max_ltd
        }
    });

    let execute_msg = serde_json::json!({
        "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
        "sender": "", // Will be filled by frontend with wallet address
        "contract": protocol_contracts.contracts.leaser,
        "msg": open_msg,
        "funds": [{
            "denom": "", // Will be filled with IBC denom
            "amount": request.downpayment_amount
        }]
    });

    Ok(Json(LeaseTransactionResponse {
        messages: vec![execute_msg],
        memo: "Open Nolus Lease".to_string(),
    }))
}

/// POST /api/leases/repay
/// Build transaction messages to repay a lease
pub async fn repay_lease(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<RepayLeaseRequest>,
) -> Result<Json<LeaseTransactionResponse>, AppError> {
    debug!(
        "Building repay lease transaction for: {}",
        request.lease_address
    );

    let repay_msg = serde_json::json!({
        "repay": {}
    });

    let execute_msg = serde_json::json!({
        "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
        "sender": "", // Will be filled by frontend
        "contract": request.lease_address,
        "msg": repay_msg,
        "funds": [{
            "denom": "", // Will be filled with IBC denom based on currency
            "amount": request.amount
        }]
    });

    Ok(Json(LeaseTransactionResponse {
        messages: vec![execute_msg],
        memo: "Repay Nolus Lease".to_string(),
    }))
}

/// POST /api/leases/close
/// Build transaction messages to close a lease (full repay)
pub async fn close_lease(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<CloseLeaseRequest>,
) -> Result<Json<LeaseTransactionResponse>, AppError> {
    debug!(
        "Building close lease transaction for: {}",
        request.lease_address
    );

    let close_msg = serde_json::json!({
        "close_position": {
            "full_close": {}
        }
    });

    let execute_msg = serde_json::json!({
        "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
        "sender": "", // Will be filled by frontend
        "contract": request.lease_address,
        "msg": close_msg,
        "funds": []
    });

    Ok(Json(LeaseTransactionResponse {
        messages: vec![execute_msg],
        memo: "Close Nolus Lease".to_string(),
    }))
}

/// POST /api/leases/market-close
/// Build transaction messages for market close (sell collateral to repay)
pub async fn market_close_lease(
    State(_state): State<Arc<AppState>>,
    Json(request): Json<MarketCloseRequest>,
) -> Result<Json<LeaseTransactionResponse>, AppError> {
    debug!(
        "Building market close transaction for: {}",
        request.lease_address
    );

    let market_close_msg = serde_json::json!({
        "close_position": {
            "partial_close": {
                "amount": null // null means full market close
            }
        }
    });

    let execute_msg = serde_json::json!({
        "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
        "sender": "", // Will be filled by frontend
        "contract": request.lease_address,
        "msg": market_close_msg,
        "funds": []
    });

    Ok(Json(LeaseTransactionResponse {
        messages: vec![execute_msg],
        memo: "Market Close Nolus Lease".to_string(),
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

async fn fetch_lease_info(
    state: &AppState,
    lease_address: &str,
    protocol: &str,
) -> Result<LeaseInfo, AppError> {
    // Get lease status from contract
    let lease_status = state.chain_client.get_lease_status(lease_address).await?;

    // Try to get historical data from ETL
    let etl_data = state
        .etl_client
        .fetch_lease_opening(lease_address)
        .await
        .ok();

    // Load prices and currencies from cache (for PnL calculation)
    let prices = state.data_cache.prices.load();
    let currencies = state.data_cache.currencies.load();

    // Build ETL data struct if available
    // Note: Some fields are at the top level of EtlLeaseOpening, not inside lease
    let etl_info = etl_data.as_ref().map(|d| LeaseEtlData {
        downpayment_amount: d.lease.downpayment_amount.clone(),
        // Opening price is inside lease.opening_price (was LS_opening_price)
        price: d.lease.opening_price.clone(),
        // lpn_price and fee are at the top level, not inside lease
        lpn_price: d.lpn_price.clone(),
        fee: d.fee.clone(),
        // LS_asset_symbol is the leveraged asset ticker (e.g., ALL_BTC)
        ls_asset_symbol: d.lease.lease_position_ticker.clone(),
        // lease_position_ticker is the same as ls_asset_symbol for frontend compatibility
        lease_position_ticker: d.lease.lease_position_ticker.clone(),
        // repayment_value is at the top level
        repayment_value: d.repayment_value.clone(),
        // history is at the top level
        history: d.history.as_ref().map(|h| {
            h.iter()
                .map(|entry| LeaseHistoryEntry {
                    tx_hash: entry.tx_hash.clone(),
                    action: enrich_history_action(&entry.action, entry.additional.as_deref()),
                    amount: entry.amount.clone(),
                    symbol: entry.symbol.clone(),
                    timestamp: entry.timestamp.clone(),
                })
                .collect()
        }),
    });

    // Build lease info based on status
    let lease_info = match &lease_status {
        LeaseStatusResponse::Opening(opening) => LeaseInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: LeaseStatusType::Opening,
            amount: LeaseAssetInfo {
                ticker: opening.opening.currency.clone(),
                amount: "0".to_string(),
                amount_usd: None,
            },
            debt: build_empty_debt(&opening.opening.loan.ticker),
            interest: LeaseInterestInfo {
                loan_rate: opening.opening.loan_interest_rate,
                margin_rate: 0,
                annual_rate_percent: opening.opening.loan_interest_rate as f64 / PERMILLE,
            },
            liquidation_price: None,
            opened_at: etl_data.as_ref().and_then(|d| d.lease.timestamp.clone()),
            pnl: None,
            close_policy: None,
            overdue_collect_in: None,
            in_progress: Some(LeaseInProgress::Opening {
                stage: parse_opening_stage(&opening.opening.in_progress),
            }),
            opening_info: Some(LeaseOpeningStateInfo {
                currency: opening.opening.currency.clone(),
                downpayment: LeaseAssetInfo {
                    ticker: opening.opening.downpayment.ticker.clone(),
                    amount: opening.opening.downpayment.amount.clone(),
                    amount_usd: None,
                },
                loan: LeaseAssetInfo {
                    ticker: opening.opening.loan.ticker.clone(),
                    amount: opening.opening.loan.amount.clone(),
                    amount_usd: None,
                },
                loan_interest_rate: opening.opening.loan_interest_rate,
            }),
            etl_data: etl_info,
        },
        LeaseStatusResponse::Opened(opened) => build_opened_lease_info(
            lease_address,
            protocol,
            &opened.opened,
            etl_data,
            etl_info,
            &prices,
            &currencies,
        ),
        LeaseStatusResponse::Closing(closing) => build_closing_lease_info(
            lease_address,
            protocol,
            &closing.closing,
            etl_data,
            etl_info,
        ),
        LeaseStatusResponse::PaidOff(paid_off) => {
            let a = &paid_off.paid_off.amount;
            build_terminal_lease_info(
                lease_address,
                protocol,
                LeaseStatusType::PaidOff,
                Some((&a.ticker, &a.amount)),
                etl_data.as_ref(),
                etl_info,
            )
        }
        LeaseStatusResponse::Closed(_) => build_terminal_lease_info(
            lease_address,
            protocol,
            LeaseStatusType::Closed,
            None,
            etl_data.as_ref(),
            etl_info,
        ),
        LeaseStatusResponse::Liquidated(_) => build_terminal_lease_info(
            lease_address,
            protocol,
            LeaseStatusType::Liquidated,
            None,
            etl_data.as_ref(),
            etl_info,
        ),
    };

    Ok(lease_info)
}

fn build_opened_lease_info(
    lease_address: &str,
    protocol: &str,
    opened: &OpenedLeaseInfo,
    etl_data: Option<crate::external::etl::EtlLeaseOpening>,
    etl_info: Option<LeaseEtlData>,
    prices: &Option<crate::handlers::currencies::PricesResponse>,
    currencies: &Option<crate::handlers::currencies::CurrenciesResponse>,
) -> LeaseInfo {
    let total_debt = calculate_total_debt(opened);
    let interest_info = calculate_interest_info(opened);

    // Parse in_progress state
    let in_progress = parse_opened_status(&opened.status);

    // Build close policy from chain data
    let close_policy = opened.close_policy.as_ref().map(|cp| LeaseClosePolicy {
        stop_loss: cp.stop_loss,
        take_profit: cp.take_profit,
    });

    // Calculate PnL if we have prices, currencies, and ETL data
    let pnl = calculate_pnl(
        protocol,
        opened,
        &total_debt,
        etl_data.as_ref(),
        prices.as_ref(),
        currencies.as_ref(),
    );

    LeaseInfo {
        address: lease_address.to_string(),
        protocol: protocol.to_string(),
        status: LeaseStatusType::Opened,
        amount: LeaseAssetInfo {
            ticker: opened.amount.ticker.clone(),
            amount: opened.amount.amount.clone(),
            amount_usd: None,
        },
        debt: LeaseDebtInfo {
            ticker: opened.principal_due.ticker.clone(),
            principal: opened.principal_due.amount.clone(),
            overdue_margin: opened.overdue_margin.amount.clone(),
            overdue_interest: opened.overdue_interest.amount.clone(),
            due_margin: opened.due_margin.amount.clone(),
            due_interest: opened.due_interest.amount.clone(),
            total: total_debt,
            total_usd: None,
        },
        interest: interest_info,
        liquidation_price: None,
        opened_at: etl_data.as_ref().and_then(|d| d.lease.timestamp.clone()),
        pnl,
        close_policy,
        overdue_collect_in: opened.overdue_collect_in.map(|v| v.to_string()),
        in_progress,
        opening_info: None,
        etl_data: etl_info,
    }
}

fn build_closing_lease_info(
    lease_address: &str,
    protocol: &str,
    closing: &ClosingLeaseInfo,
    etl_data: Option<crate::external::etl::EtlLeaseOpening>,
    etl_info: Option<LeaseEtlData>,
) -> LeaseInfo {
    let total_debt = calculate_total_debt_from_closing(closing);

    LeaseInfo {
        address: lease_address.to_string(),
        protocol: protocol.to_string(),
        status: LeaseStatusType::Closing,
        amount: LeaseAssetInfo {
            ticker: closing.amount.ticker.clone(),
            amount: closing.amount.amount.clone(),
            amount_usd: None,
        },
        debt: LeaseDebtInfo {
            ticker: closing.principal_due.ticker.clone(),
            principal: closing.principal_due.amount.clone(),
            overdue_margin: closing.overdue_margin.amount.clone(),
            overdue_interest: closing.overdue_interest.amount.clone(),
            due_margin: closing.due_margin.amount.clone(),
            due_interest: closing.due_interest.amount.clone(),
            total: total_debt,
            total_usd: None,
        },
        interest: LeaseInterestInfo {
            loan_rate: closing.loan_interest_rate,
            margin_rate: closing.margin_interest_rate,
            annual_rate_percent: calculate_annual_rate(
                closing.loan_interest_rate,
                closing.margin_interest_rate,
            ),
        },
        liquidation_price: None,
        opened_at: etl_data.as_ref().and_then(|d| d.lease.timestamp.clone()),
        pnl: None,
        close_policy: None,
        overdue_collect_in: None,
        in_progress: Some(LeaseInProgress::Close {}),
        opening_info: None,
        etl_data: etl_info,
    }
}

/// Build lease info for terminal states (PaidOff, Closed, Liquidated).
/// These all share the same shape: zeroed debt/interest, no PnL, no close policy.
/// PaidOff provides an amount (the final asset snapshot); Closed/Liquidated do not.
fn build_terminal_lease_info(
    lease_address: &str,
    protocol: &str,
    status: LeaseStatusType,
    amount: Option<(&str, &str)>,
    etl_data: Option<&crate::external::etl::EtlLeaseOpening>,
    etl_info: Option<LeaseEtlData>,
) -> LeaseInfo {
    let asset = match amount {
        Some((ticker, amt)) => LeaseAssetInfo {
            ticker: ticker.to_string(),
            amount: amt.to_string(),
            amount_usd: None,
        },
        None => LeaseAssetInfo {
            ticker: String::new(),
            amount: "0".to_string(),
            amount_usd: None,
        },
    };

    LeaseInfo {
        address: lease_address.to_string(),
        protocol: protocol.to_string(),
        status,
        amount: asset,
        debt: build_empty_debt(""),
        interest: LeaseInterestInfo {
            loan_rate: 0,
            margin_rate: 0,
            annual_rate_percent: 0.0,
        },
        liquidation_price: None,
        opened_at: etl_data.and_then(|d| d.lease.timestamp.clone()),
        pnl: None,
        close_policy: None,
        overdue_collect_in: None,
        in_progress: None,
        opening_info: None,
        etl_data: etl_info,
    }
}

fn build_empty_debt(ticker: &str) -> LeaseDebtInfo {
    LeaseDebtInfo {
        ticker: ticker.to_string(),
        principal: "0".to_string(),
        overdue_margin: "0".to_string(),
        overdue_interest: "0".to_string(),
        due_margin: "0".to_string(),
        due_interest: "0".to_string(),
        total: "0".to_string(),
        total_usd: None,
    }
}

/// Parse amount string to u128 with warning on failure
fn parse_amount(amount: &str, field_name: &str) -> u128 {
    amount.parse().unwrap_or_else(|_| {
        warn!("Failed to parse {} amount: {}", field_name, amount);
        0
    })
}

fn calculate_total_debt(opened: &OpenedLeaseInfo) -> String {
    // Parse all amounts and sum them
    let principal = parse_amount(&opened.principal_due.amount, "principal_due");
    let overdue_margin = parse_amount(&opened.overdue_margin.amount, "overdue_margin");
    let overdue_interest = parse_amount(&opened.overdue_interest.amount, "overdue_interest");
    let due_margin = parse_amount(&opened.due_margin.amount, "due_margin");
    let due_interest = parse_amount(&opened.due_interest.amount, "due_interest");

    let total = principal + overdue_margin + overdue_interest + due_margin + due_interest;
    total.to_string()
}

fn calculate_total_debt_from_closing(closing: &ClosingLeaseInfo) -> String {
    let principal = parse_amount(&closing.principal_due.amount, "principal_due");
    let overdue_margin = parse_amount(&closing.overdue_margin.amount, "overdue_margin");
    let overdue_interest = parse_amount(&closing.overdue_interest.amount, "overdue_interest");
    let due_margin = parse_amount(&closing.due_margin.amount, "due_margin");
    let due_interest = parse_amount(&closing.due_interest.amount, "due_interest");

    let total = principal + overdue_margin + overdue_interest + due_margin + due_interest;
    total.to_string()
}

fn calculate_interest_info(opened: &OpenedLeaseInfo) -> LeaseInterestInfo {
    LeaseInterestInfo {
        loan_rate: opened.loan_interest_rate,
        margin_rate: opened.margin_interest_rate,
        annual_rate_percent: calculate_annual_rate(
            opened.loan_interest_rate,
            opened.margin_interest_rate,
        ),
    }
}

fn calculate_annual_rate(loan_rate: u32, margin_rate: u32) -> f64 {
    // Both loan_rate and margin_rate are in permille (per 1000)
    let loan_percent = loan_rate as f64 / PERMILLE;
    let margin_percent = margin_rate as f64 / PERMILLE;

    // Return combined annual rate as percentage
    (loan_percent + margin_percent) * 100.0
}

/// Parse the `status` field from an opened lease's chain response.
///
/// Chain format:
///   "idle"                           → None
///   "slippage_protection_activated"  → SlippageProtection
///   {"in_progress": {"repayment": {"payment": ..., "in_progress": "swap"}}}  → Repayment
///   {"in_progress": {"close": {"close": ..., "in_progress": "swap"}}}        → Close
///   {"in_progress": {"liquidation": {"liquidation": ..., "cause": "overdue", "in_progress": "swap"}}} → Liquidation
fn parse_opened_status(status: &Option<serde_json::Value>) -> Option<LeaseInProgress> {
    let value = status.as_ref()?;

    if let Some(s) = value.as_str() {
        return match s {
            "slippage_protection_activated" => Some(LeaseInProgress::SlippageProtection {}),
            _ => None, // "idle" — no operation in progress
        };
    }

    // {"in_progress": { <ongoing_trx> }}
    let ongoing = value.as_object()?.get("in_progress")?.as_object()?;

    if ongoing.contains_key("repayment") {
        return Some(LeaseInProgress::Repayment {});
    }
    if ongoing.contains_key("close") {
        return Some(LeaseInProgress::Close {});
    }
    if let Some(liq) = ongoing.get("liquidation") {
        let cause = liq
            .as_object()
            .and_then(|o| o.get("cause"))
            .and_then(|c| c.as_str())
            .map(String::from);
        return Some(LeaseInProgress::Liquidation { cause });
    }

    None
}
/// Calculate PnL for an opened lease.
///
/// Formula (matches frontend `LeaseCalculator.calculatePnl`):
///   pnlAmount = assetValueUsd - totalDebtUsd - downPayment + fee - repaymentValue
///   pnlPercent = pnlAmount / (downPayment + repaymentValue) * 100
///
/// Where:
///   - assetValueUsd = Dec(amount, assetDecimals) * assetPrice
///   - totalDebtUsd = Dec(debtTotal, lpnDecimals) * lpnPrice
///   - downPayment = Dec(etl.downpayment_amount, lpnDecimals)
///   - fee = Dec(etl.fee, assetDecimals)
///   - repaymentValue = parseFloat(etl.repayment_value) (already formatted)
fn calculate_pnl(
    protocol: &str,
    opened: &OpenedLeaseInfo,
    total_debt: &str,
    etl_data: Option<&crate::external::etl::EtlLeaseOpening>,
    prices: Option<&crate::handlers::currencies::PricesResponse>,
    currencies: Option<&crate::handlers::currencies::CurrenciesResponse>,
) -> Option<LeasePnlInfo> {
    let etl = etl_data?;
    let prices = prices?;
    let currencies = currencies?;

    let asset_ticker = &opened.amount.ticker;
    let lpn_ticker = &opened.principal_due.ticker;

    // Look up currency info for asset and LPN
    let asset_key = format!("{}@{}", asset_ticker, protocol);
    let lpn_key = format!("{}@{}", lpn_ticker, protocol);

    let asset_currency = currencies.currencies.get(&asset_key);
    let lpn_currency = currencies.currencies.get(&lpn_key);

    let asset_decimals = asset_currency.map(|c| c.decimal_digits).unwrap_or(6) as i32;
    let lpn_decimals = lpn_currency.map(|c| c.decimal_digits).unwrap_or(6) as i32;

    // Look up prices
    let asset_price: f64 = prices
        .prices
        .get(&asset_key)
        .and_then(|p| p.price_usd.parse().ok())
        .unwrap_or(0.0);
    let lpn_price: f64 = prices
        .prices
        .get(&lpn_key)
        .and_then(|p| p.price_usd.parse().ok())
        .unwrap_or(0.0);

    // Calculate asset value in USD
    let asset_amount: f64 = opened.amount.amount.parse().unwrap_or(0.0);
    let asset_value_usd = (asset_amount / 10_f64.powi(asset_decimals)) * asset_price;

    // Calculate total debt in USD
    let debt_total: f64 = total_debt.parse().unwrap_or(0.0);
    let total_debt_usd = (debt_total / 10_f64.powi(lpn_decimals)) * lpn_price;

    // Parse ETL data: downpayment uses LPN decimals
    let downpayment_raw: f64 = etl
        .lease
        .downpayment_amount
        .as_deref()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let downpayment = downpayment_raw / 10_f64.powi(lpn_decimals);

    // Fee uses asset decimals (matching frontend behavior)
    let fee_raw: f64 = etl
        .fee
        .as_deref()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);
    let fee = fee_raw / 10_f64.powi(asset_decimals);

    // repayment_value is already formatted as a decimal number
    let repayment_value: f64 = etl
        .repayment_value
        .as_deref()
        .and_then(|s| s.parse().ok())
        .unwrap_or(0.0);

    // PnL formula
    let pnl_amount = asset_value_usd - total_debt_usd - downpayment + fee - repayment_value;
    let total_invested = downpayment + repayment_value;
    let pnl_percent = if total_invested > 0.0 {
        (pnl_amount / total_invested) * 100.0
    } else {
        0.0
    };
    let pnl_positive = pnl_amount >= 0.0;

    Some(LeasePnlInfo {
        amount: format!("{:.6}", pnl_amount),
        percent: format!("{:.2}", pnl_percent),
        downpayment: etl
            .lease
            .downpayment_amount
            .clone()
            .unwrap_or_else(|| "0".to_string()),
        pnl_positive,
    })
}

/// Parse the opening stage from the chain's `in_progress` field.
///
/// Chain format (externally tagged enum):
///   "open_ica_account"                    → Some("open_ica_account")
///   {"transfer_out": {"ica_account": ..}} → Some("transfer_out")
///   {"buy_asset": {"ica_account": ..}}    → Some("buy_asset")
fn parse_opening_stage(in_progress: &Option<serde_json::Value>) -> Option<String> {
    let value = in_progress.as_ref()?;

    // Unit variant: serialized as a bare string (e.g., "open_ica_account")
    if let Some(s) = value.as_str() {
        return Some(s.to_string());
    }

    // Struct variant: serialized as {"variant_name": {...}}
    if let Some(obj) = value.as_object() {
        return obj.keys().next().cloned();
    }

    None
}

// ============================================================================
// Public API for WebSocket Module
// ============================================================================

/// Simplified lease info for WebSocket monitoring
/// Contains only the fields needed for change detection
#[derive(Debug, Clone)]
pub struct LeaseMonitorInfo {
    pub address: String,
    pub protocol: String,
    pub status: String,
    pub amount: Option<LeaseAssetInfo>,
    pub debt: Option<LeaseDebtInfo>,
    pub interest: Option<LeaseInterestInfo>,
    pub liquidation_price: Option<String>,
    pub pnl: Option<LeasePnlInfo>,
    pub close_policy: Option<LeaseClosePolicy>,
    pub in_progress: Option<LeaseInProgress>,
}

/// Fetch all leases for an owner (for WebSocket monitoring)
/// This is a simplified version that skips ETL data for performance
/// Uses parallel fetching across protocols for better performance
pub async fn fetch_leases_for_monitoring(
    state: &AppState,
    owner: &str,
) -> Result<Vec<LeaseMonitorInfo>, AppError> {
    let admin_address = &state.config.protocols.admin_contract;

    // Get active protocols
    let protocols = state
        .chain_client
        .get_admin_protocols(admin_address)
        .await?;

    // Filter to active protocols only
    let active_protocols: Vec<_> = protocols
        .iter()
        .filter(|p| state.config.protocols.active_protocols.contains(*p))
        .cloned()
        .collect();

    // Query all protocols in parallel
    let protocol_futures: Vec<_> = active_protocols
        .iter()
        .map(|protocol| {
            let chain_client = state.chain_client.clone();
            let admin_address = admin_address.clone();
            let protocol = protocol.clone();
            let owner = owner.to_string();
            async move {
                // Get protocol contracts
                let protocol_contracts = match chain_client
                    .get_admin_protocol(&admin_address, &protocol)
                    .await
                {
                    Ok(p) => p,
                    Err(_) => return Vec::new(),
                };

                // Get lease addresses for this owner
                let lease_addresses = match chain_client
                    .get_customer_leases(&protocol_contracts.contracts.leaser, &owner)
                    .await
                {
                    Ok(leases) => leases,
                    Err(_) => return Vec::new(),
                };

                // Fetch status for each lease in parallel
                let lease_futures: Vec<_> = lease_addresses
                    .iter()
                    .map(|addr| {
                        let chain_client = chain_client.clone();
                        let addr = addr.clone();
                        let protocol = protocol.clone();
                        async move {
                            fetch_lease_monitor_info_internal(&chain_client, &addr, &protocol).await
                        }
                    })
                    .collect();

                futures::future::join_all(lease_futures)
                    .await
                    .into_iter()
                    .flatten()
                    .collect::<Vec<_>>()
            }
        })
        .collect();

    let all_leases: Vec<LeaseMonitorInfo> = futures::future::join_all(protocol_futures)
        .await
        .into_iter()
        .flatten()
        .collect();

    Ok(all_leases)
}

/// Internal version of fetch_lease_monitor_info that takes ChainClient directly
/// Used for parallel fetching where we clone the client into async blocks
async fn fetch_lease_monitor_info_internal(
    chain_client: &crate::external::chain::ChainClient,
    lease_address: &str,
    protocol: &str,
) -> Result<LeaseMonitorInfo, AppError> {
    let lease_status = chain_client.get_lease_status(lease_address).await?;

    let info = match &lease_status {
        LeaseStatusResponse::Opening(opening) => LeaseMonitorInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: "opening".to_string(),
            amount: None,
            debt: Some(build_empty_debt(&opening.opening.loan.ticker)),
            interest: Some(LeaseInterestInfo {
                loan_rate: opening.opening.loan_interest_rate,
                margin_rate: 0,
                annual_rate_percent: opening.opening.loan_interest_rate as f64 / PERMILLE,
            }),
            liquidation_price: None,
            pnl: None,
            close_policy: None,
            in_progress: Some(LeaseInProgress::Opening {
                stage: parse_opening_stage(&opening.opening.in_progress),
            }),
        },
        LeaseStatusResponse::Opened(opened) => {
            let info = &opened.opened;
            let total_debt = calculate_total_debt(info);
            LeaseMonitorInfo {
                address: lease_address.to_string(),
                protocol: protocol.to_string(),
                status: "opened".to_string(),
                amount: Some(LeaseAssetInfo {
                    ticker: info.amount.ticker.clone(),
                    amount: info.amount.amount.clone(),
                    amount_usd: None,
                }),
                debt: Some(LeaseDebtInfo {
                    ticker: info.principal_due.ticker.clone(),
                    principal: info.principal_due.amount.clone(),
                    overdue_margin: info.overdue_margin.amount.clone(),
                    overdue_interest: info.overdue_interest.amount.clone(),
                    due_margin: info.due_margin.amount.clone(),
                    due_interest: info.due_interest.amount.clone(),
                    total: total_debt,
                    total_usd: None,
                }),
                interest: Some(LeaseInterestInfo {
                    loan_rate: info.loan_interest_rate,
                    margin_rate: info.margin_interest_rate,
                    annual_rate_percent: (info.loan_interest_rate + info.margin_interest_rate)
                        as f64
                        / PERMILLE,
                }),
                liquidation_price: None,
                pnl: None,
                close_policy: info.close_policy.as_ref().map(|cp| LeaseClosePolicy {
                    stop_loss: cp.stop_loss,
                    take_profit: cp.take_profit,
                }),
                in_progress: parse_opened_status(&info.status),
            }
        }
        LeaseStatusResponse::Closing(closing) => {
            let info = &closing.closing;
            let total_debt = calculate_total_debt_from_closing(info);
            LeaseMonitorInfo {
                address: lease_address.to_string(),
                protocol: protocol.to_string(),
                status: "closing".to_string(),
                amount: Some(LeaseAssetInfo {
                    ticker: info.amount.ticker.clone(),
                    amount: info.amount.amount.clone(),
                    amount_usd: None,
                }),
                debt: Some(LeaseDebtInfo {
                    ticker: info.principal_due.ticker.clone(),
                    principal: info.principal_due.amount.clone(),
                    overdue_margin: info.overdue_margin.amount.clone(),
                    overdue_interest: info.overdue_interest.amount.clone(),
                    due_margin: info.due_margin.amount.clone(),
                    due_interest: info.due_interest.amount.clone(),
                    total: total_debt,
                    total_usd: None,
                }),
                interest: Some(LeaseInterestInfo {
                    loan_rate: info.loan_interest_rate,
                    margin_rate: info.margin_interest_rate,
                    annual_rate_percent: (info.loan_interest_rate + info.margin_interest_rate)
                        as f64
                        / PERMILLE,
                }),
                liquidation_price: None,
                pnl: None,
                close_policy: None,
                in_progress: Some(LeaseInProgress::Close {}),
            }
        }
        LeaseStatusResponse::PaidOff(paid_off) => LeaseMonitorInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: "paid_off".to_string(),
            amount: Some(LeaseAssetInfo {
                ticker: paid_off.paid_off.amount.ticker.clone(),
                amount: paid_off.paid_off.amount.amount.clone(),
                amount_usd: None,
            }),
            debt: None,
            interest: None,
            liquidation_price: None,
            pnl: None,
            close_policy: None,
            in_progress: None,
        },
        LeaseStatusResponse::Closed(_) => LeaseMonitorInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: "closed".to_string(),
            amount: None,
            debt: None,
            interest: None,
            liquidation_price: None,
            pnl: None,
            close_policy: None,
            in_progress: None,
        },
        LeaseStatusResponse::Liquidated(_) => LeaseMonitorInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: "liquidated".to_string(),
            amount: None,
            debt: None,
            interest: None,
            liquidation_price: None,
            pnl: None,
            close_policy: None,
            in_progress: None,
        },
    };

    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_annual_rate() {
        // loan_rate = 50 (permille = 5%) + margin_rate = 50 (permille = 5%) = 10%
        assert!((calculate_annual_rate(50, 50) - 10.0).abs() < 0.001);
        // Zero rates
        assert_eq!(calculate_annual_rate(0, 0), 0.0);
        // Loan only: 100 permille = 10%
        assert!((calculate_annual_rate(100, 0) - 10.0).abs() < 0.001);
        // Real example: loan_rate=94, margin_rate=80 → (94+80)/1000*100 = 17.4%
        assert!((calculate_annual_rate(94, 80) - 17.4).abs() < 0.001);
    }

    #[test]
    fn test_build_empty_debt() {
        let debt = build_empty_debt("USDC");
        assert_eq!(debt.ticker, "USDC");
        assert_eq!(debt.principal, "0");
        assert_eq!(debt.total, "0");
    }

    #[test]
    fn test_parse_opened_status_none() {
        assert!(parse_opened_status(&None).is_none());
    }

    #[test]
    fn test_parse_opened_status_idle() {
        let status = Some(serde_json::json!("idle"));
        assert!(parse_opened_status(&status).is_none());
    }

    #[test]
    fn test_parse_opened_status_slippage_protection() {
        let status = Some(serde_json::json!("slippage_protection_activated"));
        let result = parse_opened_status(&status);
        assert!(matches!(
            result,
            Some(LeaseInProgress::SlippageProtection {})
        ));
    }

    #[test]
    fn test_parse_opened_status_repayment() {
        let status = Some(serde_json::json!({
            "in_progress": {
                "repayment": { "payment": {}, "in_progress": "swap" }
            }
        }));
        let result = parse_opened_status(&status);
        assert!(matches!(result, Some(LeaseInProgress::Repayment {})));
    }

    #[test]
    fn test_parse_opened_status_close() {
        let status = Some(serde_json::json!({
            "in_progress": {
                "close": { "close": {}, "in_progress": "swap" }
            }
        }));
        let result = parse_opened_status(&status);
        assert!(matches!(result, Some(LeaseInProgress::Close {})));
    }

    #[test]
    fn test_parse_opened_status_liquidation() {
        let status = Some(serde_json::json!({
            "in_progress": {
                "liquidation": { "liquidation": {}, "cause": "overdue", "in_progress": "swap" }
            }
        }));
        let result = parse_opened_status(&status);
        assert!(matches!(
            result,
            Some(LeaseInProgress::Liquidation { cause }) if cause.as_deref() == Some("overdue")
        ));
    }

    #[test]
    fn test_slippage_protection_serialization() {
        let sp = LeaseInProgress::SlippageProtection {};
        let json = serde_json::to_value(&sp).unwrap();
        assert_eq!(json, serde_json::json!({"slippage_protection": {}}));
    }

    // ── PnL calculation tests ────────────────────────────────────

    use crate::external::chain::LeaseAmount;
    use crate::external::etl::{EtlLeaseInfo, EtlLeaseOpening};
    use crate::handlers::currencies::{
        CurrenciesResponse, CurrencyInfo, PriceInfo, PricesResponse,
    };
    use std::collections::HashMap;

    fn make_opened(asset_ticker: &str, asset_amount: &str, debt_ticker: &str) -> OpenedLeaseInfo {
        OpenedLeaseInfo {
            amount: LeaseAmount {
                ticker: asset_ticker.to_string(),
                amount: asset_amount.to_string(),
            },
            loan_interest_rate: 50,
            margin_interest_rate: 30,
            principal_due: LeaseAmount {
                ticker: debt_ticker.to_string(),
                amount: "500000000".to_string(), // 500 USDC (6 dec)
            },
            overdue_margin: LeaseAmount {
                ticker: debt_ticker.to_string(),
                amount: "0".to_string(),
            },
            overdue_interest: LeaseAmount {
                ticker: debt_ticker.to_string(),
                amount: "0".to_string(),
            },
            due_margin: LeaseAmount {
                ticker: debt_ticker.to_string(),
                amount: "0".to_string(),
            },
            due_interest: LeaseAmount {
                ticker: debt_ticker.to_string(),
                amount: "0".to_string(),
            },
            validity: "valid".to_string(),
            overdue_collect_in: None,
            close_policy: None,
            status: Some(serde_json::json!("idle")),
        }
    }

    fn make_etl(downpayment: &str, fee: &str, repayment_value: &str) -> EtlLeaseOpening {
        EtlLeaseOpening {
            lease: EtlLeaseInfo {
                timestamp: None,
                downpayment_amount: Some(downpayment.to_string()),
                loan_amount: None,
                lease_position_ticker: None,
                collateral_symbol: None,
                opening_price: None,
                history: None,
            },
            downpayment_price: None,
            lpn_price: None,
            pnl: None,
            fee: Some(fee.to_string()),
            repayment_value: Some(repayment_value.to_string()),
            history: None,
        }
    }

    fn make_currency(key: &str, ticker: &str, decimals: u8) -> CurrencyInfo {
        CurrencyInfo {
            key: key.to_string(),
            ticker: ticker.to_string(),
            symbol: ticker.to_string(),
            name: ticker.to_string(),
            short_name: ticker.to_string(),
            decimal_digits: decimals,
            bank_symbol: "ibc/test".to_string(),
            dex_symbol: "ibc/test".to_string(),
            icon: "".to_string(),
            native: false,
            coingecko_id: None,
            protocol: "TEST-PROTOCOL".to_string(),
            group: "lease".to_string(),
            is_active: true,
        }
    }

    fn make_prices_and_currencies(
        asset_price: &str,
        lpn_price: &str,
    ) -> (PricesResponse, CurrenciesResponse) {
        let mut prices = HashMap::new();
        prices.insert(
            "ALL_BTC@TEST-PROTOCOL".to_string(),
            PriceInfo {
                key: "ALL_BTC@TEST-PROTOCOL".to_string(),
                symbol: "BTC".to_string(),
                price_usd: asset_price.to_string(),
            },
        );
        prices.insert(
            "USDC_NOBLE@TEST-PROTOCOL".to_string(),
            PriceInfo {
                key: "USDC_NOBLE@TEST-PROTOCOL".to_string(),
                symbol: "USDC".to_string(),
                price_usd: lpn_price.to_string(),
            },
        );

        let mut currencies = HashMap::new();
        currencies.insert(
            "ALL_BTC@TEST-PROTOCOL".to_string(),
            make_currency("ALL_BTC@TEST-PROTOCOL", "ALL_BTC", 8),
        );
        currencies.insert(
            "USDC_NOBLE@TEST-PROTOCOL".to_string(),
            make_currency("USDC_NOBLE@TEST-PROTOCOL", "USDC_NOBLE", 6),
        );

        (
            PricesResponse {
                prices,
                updated_at: "2024-01-01T00:00:00Z".to_string(),
            },
            CurrenciesResponse {
                currencies,
                lpn: vec![],
                lease_currencies: vec![],
                map: HashMap::new(),
            },
        )
    }

    #[test]
    fn test_calculate_pnl_positive() {
        // BTC at $100,000, holding 0.01 BTC = $1000 asset value
        // Debt: 500 USDC at $1.00 = $500 debt
        // Downpayment: 400 USDC (400_000_000 micro) → $400
        // Fee: 0 (no fee)
        // Repayment: $0
        // PnL = 1000 - 500 - 400 + 0 - 0 = $100
        // PnL% = 100 / (400 + 0) * 100 = 25%
        let opened = make_opened("ALL_BTC", "1000000", "USDC_NOBLE"); // 0.01 BTC (8 dec)
        let etl = make_etl("400000000", "0", "0"); // 400 USDC (6 dec)
        let (prices, currencies) = make_prices_and_currencies("100000", "1.0");
        let total_debt = "500000000"; // 500 USDC

        let result = calculate_pnl(
            "TEST-PROTOCOL",
            &opened,
            total_debt,
            Some(&etl),
            Some(&prices),
            Some(&currencies),
        );

        let pnl = result.unwrap();
        let amount: f64 = pnl.amount.parse().unwrap();
        let percent: f64 = pnl.percent.parse().unwrap();
        assert!((amount - 100.0).abs() < 0.01, "PnL amount: {}", amount);
        assert!((percent - 25.0).abs() < 0.01, "PnL percent: {}", percent);
        assert!(pnl.pnl_positive);
    }

    #[test]
    fn test_calculate_pnl_negative() {
        // BTC at $50,000, holding 0.01 BTC = $500 asset value
        // Debt: 500 USDC at $1.00 = $500
        // Downpayment: 400 USDC → $400
        // PnL = 500 - 500 - 400 = -$400
        // PnL% = -400 / 400 * 100 = -100%
        let opened = make_opened("ALL_BTC", "1000000", "USDC_NOBLE");
        let etl = make_etl("400000000", "0", "0");
        let (prices, currencies) = make_prices_and_currencies("50000", "1.0");

        let result = calculate_pnl(
            "TEST-PROTOCOL",
            &opened,
            "500000000",
            Some(&etl),
            Some(&prices),
            Some(&currencies),
        );

        let pnl = result.unwrap();
        let amount: f64 = pnl.amount.parse().unwrap();
        let percent: f64 = pnl.percent.parse().unwrap();
        assert!((amount - (-400.0)).abs() < 0.01, "PnL amount: {}", amount);
        assert!(
            (percent - (-100.0)).abs() < 0.01,
            "PnL percent: {}",
            percent
        );
        assert!(!pnl.pnl_positive);
    }

    #[test]
    fn test_calculate_pnl_with_repayment() {
        // BTC at $100,000, holding 0.01 BTC = $1000
        // Debt: 300 USDC = $300
        // Downpayment: 400 USDC = $400
        // Repayment: $200 (already formatted)
        // PnL = 1000 - 300 - 400 + 0 - 200 = $100
        // PnL% = 100 / (400 + 200) * 100 = 16.67%
        let opened = make_opened("ALL_BTC", "1000000", "USDC_NOBLE");
        let etl = make_etl("400000000", "0", "200");
        let (prices, currencies) = make_prices_and_currencies("100000", "1.0");

        let result = calculate_pnl(
            "TEST-PROTOCOL",
            &opened,
            "300000000",
            Some(&etl),
            Some(&prices),
            Some(&currencies),
        );

        let pnl = result.unwrap();
        let amount: f64 = pnl.amount.parse().unwrap();
        let percent: f64 = pnl.percent.parse().unwrap();
        assert!((amount - 100.0).abs() < 0.01, "PnL amount: {}", amount);
        assert!((percent - 16.67).abs() < 0.1, "PnL percent: {}", percent);
        assert!(pnl.pnl_positive);
    }

    #[test]
    fn test_calculate_pnl_none_without_etl() {
        let opened = make_opened("ALL_BTC", "1000000", "USDC_NOBLE");
        let (prices, currencies) = make_prices_and_currencies("100000", "1.0");

        let result = calculate_pnl(
            "TEST-PROTOCOL",
            &opened,
            "500000000",
            None,
            Some(&prices),
            Some(&currencies),
        );

        assert!(result.is_none());
    }

    #[test]
    fn test_calculate_pnl_none_without_prices() {
        let opened = make_opened("ALL_BTC", "1000000", "USDC_NOBLE");
        let etl = make_etl("400000000", "0", "0");
        let (_, currencies) = make_prices_and_currencies("100000", "1.0");

        let result = calculate_pnl(
            "TEST-PROTOCOL",
            &opened,
            "500000000",
            Some(&etl),
            None,
            Some(&currencies),
        );

        assert!(result.is_none());
    }

    #[test]
    fn test_enrich_history_action_liquidation_with_cause() {
        assert_eq!(
            enrich_history_action("liquidation", Some("overdue interest")),
            "liquidation-overdue interest"
        );
        assert_eq!(
            enrich_history_action("liquidation", Some("high liability")),
            "liquidation-high liability"
        );
    }

    #[test]
    fn test_enrich_history_action_liquidation_missing_cause_fails_visibly() {
        assert_eq!(
            enrich_history_action("liquidation", None),
            "liquidation-unknown"
        );
        assert_eq!(
            enrich_history_action("liquidation", Some("")),
            "liquidation-unknown"
        );
    }

    #[test]
    fn test_enrich_history_action_non_liquidation_passes_through() {
        assert_eq!(
            enrich_history_action("repay", Some("overdue interest")),
            "repay"
        );
        assert_eq!(
            enrich_history_action("partial-liquidation", Some("high liability")),
            "partial-liquidation"
        );
        assert_eq!(enrich_history_action("market-close", None), "market-close");
    }
}
