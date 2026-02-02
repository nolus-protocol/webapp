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
use tracing::{debug, error};

use crate::error::AppError;
use crate::external::chain::{ClosingLeaseInfo, LeaseStatusResponse, OpenedLeaseInfo};
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
    Repayment,
    /// Close in progress
    Close,
    /// Liquidation in progress
    Liquidation {
        #[serde(skip_serializing_if = "Option::is_none")]
        cause: Option<String>,
    },
    /// Transfer in (for closing)
    TransferIn {
        #[serde(skip_serializing_if = "Option::is_none")]
        stage: Option<String>,
    },
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
// Constants
// ============================================================================

const PERMILLE: f64 = 1000.0;
const PERCENT: f64 = 100.0;
const INTEREST_DECIMALS: u32 = 7;

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/leases?owner=...&protocol=...
/// Returns all leases for an owner across all or a specific protocol
pub async fn get_leases(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AddressWithProtocolQuery>,
) -> Result<Json<LeasesResponse>, AppError> {
    debug!("Getting leases for owner: {}", query.address);

    let admin_address = &state.config.protocols.admin_contract;

    // Get all protocols or filter to specific one
    let protocols: Vec<String> = match &query.protocol {
        Some(p) => vec![p.clone()],
        None => {
            state
                .chain_client
                .get_admin_protocols(admin_address)
                .await?
        }
    };

    // Fetch leases from all protocols in parallel
    let protocol_futures: Vec<_> = protocols
        .iter()
        .map(|protocol| {
            let state = state.clone();
            let protocol = protocol.clone();
            let owner = query.address.clone();
            let admin_address = admin_address.clone();
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

                // Fetch all lease details in parallel
                let lease_futures: Vec<_> = lease_addresses
                    .into_iter()
                    .map(|lease_address| {
                        let state = state.clone();
                        let protocol = protocol.clone();
                        async move {
                            fetch_lease_info(&state, &lease_address, &protocol)
                                .await
                                .ok()
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
    // The ETL returns history as part of the lease opening data
    let history = match lease_opening {
        Ok(_) => {
            // ETL history is embedded in the response
            // For now return empty - would need to parse from ETL response
            vec![]
        }
        Err(_) => vec![],
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
                    action: entry.action.clone().unwrap_or_default(),
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
            in_progress: Some(LeaseInProgress::Opening { stage: None }),
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
        LeaseStatusResponse::Opened(opened) => {
            build_opened_lease_info(lease_address, protocol, &opened.opened, etl_data, etl_info)
        }
        LeaseStatusResponse::Closing(closing) => build_closing_lease_info(
            lease_address,
            protocol,
            &closing.closing,
            etl_data,
            etl_info,
        ),
        LeaseStatusResponse::PaidOff(paid_off) => LeaseInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: LeaseStatusType::PaidOff,
            amount: LeaseAssetInfo {
                ticker: paid_off.paid_off.amount.ticker.clone(),
                amount: paid_off.paid_off.amount.amount.clone(),
                amount_usd: None,
            },
            debt: build_empty_debt(""),
            interest: LeaseInterestInfo {
                loan_rate: 0,
                margin_rate: 0,
                annual_rate_percent: 0.0,
            },
            liquidation_price: None,
            opened_at: etl_data.as_ref().and_then(|d| d.lease.timestamp.clone()),
            pnl: None,
            close_policy: None,
            overdue_collect_in: None,
            in_progress: parse_paid_off_in_progress(&paid_off.paid_off.in_progress),
            opening_info: None,
            etl_data: etl_info,
        },
        LeaseStatusResponse::Closed(_) => LeaseInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: LeaseStatusType::Closed,
            amount: LeaseAssetInfo {
                ticker: String::new(),
                amount: "0".to_string(),
                amount_usd: None,
            },
            debt: build_empty_debt(""),
            interest: LeaseInterestInfo {
                loan_rate: 0,
                margin_rate: 0,
                annual_rate_percent: 0.0,
            },
            liquidation_price: None,
            opened_at: etl_data.as_ref().and_then(|d| d.lease.timestamp.clone()),
            pnl: None,
            close_policy: None,
            overdue_collect_in: None,
            in_progress: None,
            opening_info: None,
            etl_data: etl_info,
        },
        LeaseStatusResponse::Liquidated(_) => LeaseInfo {
            address: lease_address.to_string(),
            protocol: protocol.to_string(),
            status: LeaseStatusType::Liquidated,
            amount: LeaseAssetInfo {
                ticker: String::new(),
                amount: "0".to_string(),
                amount_usd: None,
            },
            debt: build_empty_debt(""),
            interest: LeaseInterestInfo {
                loan_rate: 0,
                margin_rate: 0,
                annual_rate_percent: 0.0,
            },
            liquidation_price: None,
            opened_at: etl_data.as_ref().and_then(|d| d.lease.timestamp.clone()),
            pnl: None,
            close_policy: None,
            overdue_collect_in: None,
            in_progress: None,
            opening_info: None,
            etl_data: etl_info,
        },
    };

    Ok(lease_info)
}

fn build_opened_lease_info(
    lease_address: &str,
    protocol: &str,
    opened: &OpenedLeaseInfo,
    etl_data: Option<crate::external::etl::EtlLeaseOpening>,
    etl_info: Option<LeaseEtlData>,
) -> LeaseInfo {
    let total_debt = calculate_total_debt(opened);
    let interest_info = calculate_interest_info(opened);

    // Parse in_progress state
    let in_progress = parse_opened_in_progress(&opened.in_progress);

    // Build close policy from chain data
    let close_policy = opened.close_policy.as_ref().map(|cp| LeaseClosePolicy {
        stop_loss: cp.stop_loss,
        take_profit: cp.take_profit,
    });

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
        liquidation_price: None, // Would need price data to calculate
        opened_at: etl_data.as_ref().and_then(|d| d.lease.timestamp.clone()),
        pnl: etl_data.map(|d| LeasePnlInfo {
            amount: d.pnl.unwrap_or_else(|| "0".to_string()),
            percent: "0".to_string(),
            downpayment: d
                .lease
                .downpayment_amount
                .unwrap_or_else(|| "0".to_string()),
        }),
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
        in_progress: Some(LeaseInProgress::Close),
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

fn calculate_total_debt(opened: &OpenedLeaseInfo) -> String {
    // Parse all amounts and sum them
    let principal: u128 = opened.principal_due.amount.parse().unwrap_or(0);
    let overdue_margin: u128 = opened.overdue_margin.amount.parse().unwrap_or(0);
    let overdue_interest: u128 = opened.overdue_interest.amount.parse().unwrap_or(0);
    let due_margin: u128 = opened.due_margin.amount.parse().unwrap_or(0);
    let due_interest: u128 = opened.due_interest.amount.parse().unwrap_or(0);

    let total = principal + overdue_margin + overdue_interest + due_margin + due_interest;
    total.to_string()
}

fn calculate_total_debt_from_closing(closing: &ClosingLeaseInfo) -> String {
    let principal: u128 = closing.principal_due.amount.parse().unwrap_or(0);
    let overdue_margin: u128 = closing.overdue_margin.amount.parse().unwrap_or(0);
    let overdue_interest: u128 = closing.overdue_interest.amount.parse().unwrap_or(0);
    let due_margin: u128 = closing.due_margin.amount.parse().unwrap_or(0);
    let due_interest: u128 = closing.due_interest.amount.parse().unwrap_or(0);

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
    // loan_rate is in permille (per 1000)
    // margin_rate is in percent (per 100)
    // Both need to be converted to the interest decimals format
    let loan_percent = loan_rate as f64 / PERMILLE;
    let margin_percent = margin_rate as f64 / PERCENT;

    // Return combined annual rate as percentage
    (loan_percent + margin_percent) * 100.0
}

/// Parse the in_progress field from an opened lease status
fn parse_opened_in_progress(in_progress: &Option<serde_json::Value>) -> Option<LeaseInProgress> {
    let value = in_progress.as_ref()?;

    // The in_progress field can be:
    // - { "repayment": {} }
    // - { "close": {} }
    // - { "liquidation": { "cause": "..." } }
    if let Some(obj) = value.as_object() {
        if obj.contains_key("repayment") {
            return Some(LeaseInProgress::Repayment);
        }
        if obj.contains_key("close") {
            return Some(LeaseInProgress::Close);
        }
        if let Some(liq) = obj.get("liquidation") {
            let cause = liq
                .as_object()
                .and_then(|o| o.get("cause"))
                .and_then(|c| c.as_str())
                .map(String::from);
            return Some(LeaseInProgress::Liquidation { cause });
        }
    }

    None
}

/// Parse the in_progress field from a paid_off lease status
fn parse_paid_off_in_progress(in_progress: &Option<serde_json::Value>) -> Option<LeaseInProgress> {
    let value = in_progress.as_ref()?;

    // The in_progress field for paid_off can be:
    // - { "transfer_in_init": {} }
    // - { "transfer_in_finish": {} }
    if let Some(obj) = value.as_object() {
        if obj.contains_key("transfer_in_init") {
            return Some(LeaseInProgress::TransferIn {
                stage: Some("init".to_string()),
            });
        }
        if obj.contains_key("transfer_in_finish") {
            return Some(LeaseInProgress::TransferIn {
                stage: Some("finish".to_string()),
            });
        }
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
    pub status: String,
    pub amount: Option<LeaseAssetInfo>,
    pub debt: Option<LeaseDebtInfo>,
    pub interest: Option<LeaseInterestInfo>,
    pub liquidation_price: Option<String>,
    pub pnl: Option<LeasePnlInfo>,
    pub close_policy: Option<LeaseClosePolicy>,
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
                        async move { fetch_lease_monitor_info_internal(&chain_client, &addr).await }
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
) -> Result<LeaseMonitorInfo, AppError> {
    let lease_status = chain_client.get_lease_status(lease_address).await?;

    let info = match &lease_status {
        LeaseStatusResponse::Opening(opening) => LeaseMonitorInfo {
            address: lease_address.to_string(),
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
        },
        LeaseStatusResponse::Opened(opened) => {
            let info = &opened.opened;
            let total_debt = calculate_total_debt(info);
            LeaseMonitorInfo {
                address: lease_address.to_string(),
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
            }
        }
        LeaseStatusResponse::Closing(closing) => {
            let info = &closing.closing;
            let total_debt = calculate_total_debt_from_closing(info);
            LeaseMonitorInfo {
                address: lease_address.to_string(),
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
            }
        }
        LeaseStatusResponse::PaidOff(paid_off) => LeaseMonitorInfo {
            address: lease_address.to_string(),
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
        },
        LeaseStatusResponse::Closed(_) => LeaseMonitorInfo {
            address: lease_address.to_string(),
            status: "closed".to_string(),
            amount: None,
            debt: None,
            interest: None,
            liquidation_price: None,
            pnl: None,
            close_policy: None,
        },
        LeaseStatusResponse::Liquidated(_) => LeaseMonitorInfo {
            address: lease_address.to_string(),
            status: "liquidated".to_string(),
            amount: None,
            debt: None,
            interest: None,
            liquidation_price: None,
            pnl: None,
            close_policy: None,
        },
    };

    Ok(info)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_calculate_annual_rate() {
        // loan_rate = 50 (permille = 5%) + margin_rate = 5 (percent = 5%) = 10%
        assert!((calculate_annual_rate(50, 5) - 10.0).abs() < 0.001);
        // Zero rates
        assert_eq!(calculate_annual_rate(0, 0), 0.0);
        // Loan only: 100 permille = 10%
        assert!((calculate_annual_rate(100, 0) - 10.0).abs() < 0.001);
    }

    #[test]
    fn test_build_empty_debt() {
        let debt = build_empty_debt("USDC");
        assert_eq!(debt.ticker, "USDC");
        assert_eq!(debt.principal, "0");
        assert_eq!(debt.total, "0");
    }
}
