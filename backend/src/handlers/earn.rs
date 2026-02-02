//! Earn handlers for deposit/withdraw operations in liquidity pools
//!
//! Endpoints:
//! - GET /api/earn/pools - Get all earn pools with APY and utilization
//! - GET /api/earn/pools/:pool_id - Get details for a specific pool
//! - GET /api/earn/positions?owner=... - Get all earn positions for an owner
//! - POST /api/earn/deposit - Build transaction to deposit into a pool
//! - POST /api/earn/withdraw - Build transaction to withdraw from a pool
//! - GET /api/earn/stats - Get overall earn statistics

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::debug;

use crate::error::AppError;
use crate::query_types::AddressQuery;
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarnPool {
    /// Protocol name (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
    pub protocol: String,
    /// LPP contract address
    pub lpp_address: String,
    /// LPN currency ticker
    pub currency: String,
    /// Total deposited amount (in base units)
    pub total_deposited: String,
    /// Total deposited in USD
    pub total_deposited_usd: Option<String>,
    /// Current APY as percentage
    pub apy: f64,
    /// Utilization ratio (0-100)
    pub utilization: f64,
    /// Available liquidity for borrowing
    pub available_liquidity: String,
    /// Deposit capacity remaining
    pub deposit_capacity: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarnPosition {
    /// Protocol name
    pub protocol: String,
    /// LPP contract address
    pub lpp_address: String,
    /// LPN currency ticker
    pub currency: String,
    /// Deposited amount in nLPN (receipt tokens)
    pub deposited_nlpn: String,
    /// Deposited amount in LPN (actual value)
    pub deposited_lpn: String,
    /// Deposited value in USD
    pub deposited_usd: Option<String>,
    /// LPP price (nLPN to LPN ratio)
    pub lpp_price: String,
    /// Current APY for this pool
    pub current_apy: f64,
}



#[derive(Debug, Serialize, Deserialize)]
pub struct EarnPositionsResponse {
    pub positions: Vec<EarnPosition>,
    pub total_deposited_usd: String,
}

#[derive(Debug, Deserialize)]
pub struct DepositRequest {
    pub protocol: String,
    pub amount: String,
}

#[derive(Debug, Deserialize)]
pub struct WithdrawRequest {
    pub protocol: String,
    /// Amount in nLPN to withdraw (receipt tokens)
    pub amount: String,
}

#[derive(Debug, Serialize)]
pub struct EarnTransactionResponse {
    pub messages: Vec<serde_json::Value>,
    pub memo: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EarnStats {
    /// Total value locked across all pools (USD)
    pub total_value_locked: String,
    /// Number of active pools
    pub pools_count: u32,
    /// Average APY across pools
    pub average_apy: f64,
    /// Dispatcher rewards rate
    pub dispatcher_rewards: Option<f64>,
}

// ============================================================================
// Constants
// ============================================================================

const INTEREST_DECIMALS: u32 = 7;

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/earn/pools
/// Returns all earn pools with current APY and utilization
/// Uses caching with request coalescing to prevent thundering herd
pub async fn get_pools(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<EarnPool>>, AppError> {
    debug!("Getting all earn pools");

    // Use get_or_fetch to coalesce concurrent requests
    let result = state
        .cache
        .data
        .get_or_fetch(crate::cache_keys::pools::ALL_POOLS, || {
            let state = state.clone();
            async move { fetch_all_pools_internal(state).await }
        })
        .await
        .map_err(|e| AppError::ExternalApi {
            api: "earn_pools".to_string(),
            message: e,
        })?;

    // Deserialize the cached JSON back to Vec<EarnPool>
    let pools: Vec<EarnPool> = serde_json::from_value(result).map_err(|e| {
        AppError::Internal(format!("Failed to deserialize pools: {}", e))
    })?;

    Ok(Json(pools))
}

/// Internal function to fetch all pools (called by cache)
async fn fetch_all_pools_internal(
    state: Arc<AppState>,
) -> Result<serde_json::Value, String> {
    let admin_address = &state.config.protocols.admin_contract;

    // Get all protocols
    let protocols = state
        .chain_client
        .get_admin_protocols(admin_address)
        .await
        .map_err(|e| e.to_string())?;

    // Fetch ETL pool data for APY
    let etl_pools = state.etl_client.fetch_pools().await.ok();

    // Fetch all pools in parallel
    let pool_futures: Vec<_> = protocols
        .iter()
        .map(|protocol| {
            let state = state.clone();
            let etl_pools = etl_pools.clone();
            let protocol = protocol.clone();
            async move { fetch_pool_info(&state, &protocol, &etl_pools).await }
        })
        .collect();

    let pool_results = futures::future::join_all(pool_futures).await;

    let pools: Vec<EarnPool> = pool_results
        .into_iter()
        .filter_map(|result| match result {
            Ok(pool) => Some(pool),
            Err(e) => {
                tracing::error!("Failed to fetch pool: {}", e);
                None
            }
        })
        .collect();

    serde_json::to_value(pools).map_err(|e| e.to_string())
}

/// GET /api/earn/pools/:protocol
/// Returns details for a specific pool
pub async fn get_pool(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<Json<EarnPool>, AppError> {
    debug!("Getting pool for protocol: {}", protocol);

    let etl_pools = state.etl_client.fetch_pools().await.ok();

    fetch_pool_info(&state, &protocol, &etl_pools)
        .await
        .map(Json)
}

/// GET /api/earn/positions?owner=...
/// Returns all earn positions for an owner
pub async fn get_positions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AddressQuery>,
) -> Result<Json<EarnPositionsResponse>, AppError> {
    debug!("Getting earn positions for owner: {}", query.address);

    let admin_address = &state.config.protocols.admin_contract;

    // Get all protocols
    let protocols = state
        .chain_client
        .get_admin_protocols(admin_address)
        .await?;

    // Fetch ETL pool data for APY
    let etl_pools = state.etl_client.fetch_pools().await.ok();

    // Fetch all positions in parallel
    let position_futures: Vec<_> = protocols
        .iter()
        .map(|protocol| {
            let state = state.clone();
            let etl_pools = etl_pools.clone();
            let protocol = protocol.clone();
            let address = query.address.clone();
            async move { fetch_position_info(&state, &protocol, &address, &etl_pools).await }
        })
        .collect();

    let position_results = futures::future::join_all(position_futures).await;

    let mut positions = Vec::new();
    let mut total_deposited_usd = 0.0f64;

    for result in position_results {
        match result {
            Ok(Some(position)) => {
                // Add to total if we have USD value
                if let Some(usd) = &position.deposited_usd {
                    if let Ok(val) = usd.parse::<f64>() {
                        total_deposited_usd += val;
                    }
                }
                positions.push(position);
            }
            Ok(None) => {
                // No position in this pool
            }
            Err(e) => {
                debug!("Failed to fetch position: {}", e);
            }
        }
    }

    Ok(Json(EarnPositionsResponse {
        positions,
        total_deposited_usd: format!("{:.2}", total_deposited_usd),
    }))
}

/// POST /api/earn/deposit
/// Build transaction messages to deposit into a pool
pub async fn deposit(
    State(state): State<Arc<AppState>>,
    Json(request): Json<DepositRequest>,
) -> Result<Json<EarnTransactionResponse>, AppError> {
    debug!(
        "Building deposit transaction for protocol: {}",
        request.protocol
    );

    let admin_address = &state.config.protocols.admin_contract;
    let protocol_contracts = state
        .chain_client
        .get_admin_protocol(admin_address, &request.protocol)
        .await?;

    // Build deposit message
    // Deposit to LPP is done by sending funds to the contract
    let deposit_msg = serde_json::json!({
        "deposit": {}
    });

    let execute_msg = serde_json::json!({
        "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
        "sender": "", // Will be filled by frontend with wallet address
        "contract": protocol_contracts.contracts.lpp,
        "msg": deposit_msg,
        "funds": [{
            "denom": "", // Will be filled with LPN IBC denom
            "amount": request.amount
        }]
    });

    Ok(Json(EarnTransactionResponse {
        messages: vec![execute_msg],
        memo: "Deposit to Nolus Earn".to_string(),
    }))
}

/// POST /api/earn/withdraw
/// Build transaction messages to withdraw from a pool
pub async fn withdraw(
    State(state): State<Arc<AppState>>,
    Json(request): Json<WithdrawRequest>,
) -> Result<Json<EarnTransactionResponse>, AppError> {
    debug!(
        "Building withdraw transaction for protocol: {}",
        request.protocol
    );

    let admin_address = &state.config.protocols.admin_contract;
    let protocol_contracts = state
        .chain_client
        .get_admin_protocol(admin_address, &request.protocol)
        .await?;

    // Build withdraw message
    // Withdraw from LPP burns nLPN and returns LPN
    let withdraw_msg = serde_json::json!({
        "burn_deposit": {
            "amount": request.amount
        }
    });

    let execute_msg = serde_json::json!({
        "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
        "sender": "", // Will be filled by frontend with wallet address
        "contract": protocol_contracts.contracts.lpp,
        "msg": withdraw_msg,
        "funds": []
    });

    Ok(Json(EarnTransactionResponse {
        messages: vec![execute_msg],
        memo: "Withdraw from Nolus Earn".to_string(),
    }))
}

/// GET /api/earn/stats
/// Returns overall earn statistics
pub async fn get_earn_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<EarnStats>, AppError> {
    debug!("Getting earn stats");

    let admin_address = &state.config.protocols.admin_contract;

    // Get all protocols
    let protocols = state
        .chain_client
        .get_admin_protocols(admin_address)
        .await?;

    // Fetch ETL pool data and dispatcher rewards in parallel
    let (etl_pools, dispatcher_rewards_result) = tokio::join!(
        state.etl_client.fetch_pools(),
        state
            .chain_client
            .get_dispatcher_rewards(&state.config.protocols.dispatcher_contract)
    );

    let etl_pools = etl_pools.ok();
    let dispatcher_rewards = dispatcher_rewards_result
        .ok()
        .map(|r| r as f64 / 10f64.powi(INTEREST_DECIMALS as i32));

    // Fetch all pools in parallel
    let pool_futures: Vec<_> = protocols
        .iter()
        .map(|protocol| {
            let state = state.clone();
            let etl_pools = etl_pools.clone();
            let protocol = protocol.clone();
            async move { fetch_pool_info(&state, &protocol, &etl_pools).await }
        })
        .collect();

    let pool_results = futures::future::join_all(pool_futures).await;

    let mut total_tvl = 0.0f64;
    let mut total_apy = 0.0f64;
    let mut pool_count = 0u32;

    for pool in pool_results.into_iter().flatten() {
        pool_count += 1;
        total_apy += pool.apy;
        if let Some(usd) = &pool.total_deposited_usd {
            if let Ok(val) = usd.parse::<f64>() {
                total_tvl += val;
            }
        }
    }

    let average_apy = if pool_count > 0 {
        total_apy / pool_count as f64
    } else {
        0.0
    };

    Ok(Json(EarnStats {
        total_value_locked: format!("{:.2}", total_tvl),
        pools_count: pool_count,
        average_apy,
        dispatcher_rewards,
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

async fn fetch_pool_info(
    state: &AppState,
    protocol: &str,
    etl_pools: &Option<Vec<crate::external::etl::EtlPool>>,
) -> Result<EarnPool, AppError> {
    let admin_address = &state.config.protocols.admin_contract;

    let protocol_contracts = state
        .chain_client
        .get_admin_protocol(admin_address, protocol)
        .await?;

    let lpp_address = &protocol_contracts.contracts.lpp;

    // Get LPP balance and deposit capacity
    let (lpp_balance, deposit_capacity, lpn_ticker) = tokio::try_join!(
        state.chain_client.get_lpp_balance(lpp_address),
        state.chain_client.get_deposit_capacity(lpp_address),
        state.chain_client.get_lpn(lpp_address),
    )?;

    // Get APY from ETL data
    let apy = etl_pools
        .as_ref()
        .and_then(|pools| {
            pools
                .iter()
                .find(|p| p.protocol.eq_ignore_ascii_case(protocol))
                .and_then(|p| p.apr.as_ref())
                .and_then(|apr| apr.parse::<f64>().ok())
        })
        .unwrap_or(0.0);

    // Get utilization from ETL data
    let utilization = etl_pools
        .as_ref()
        .and_then(|pools| {
            pools
                .iter()
                .find(|p| p.protocol.eq_ignore_ascii_case(protocol))
                .and_then(|p| p.utilization.as_ref())
                .and_then(|u| u.parse::<f64>().ok())
        })
        .unwrap_or(0.0);

    // Calculate available liquidity
    let total_balance: u128 = lpp_balance.balance.amount.parse().unwrap_or(0);
    let total_principal: u128 = lpp_balance.total_principal_due.amount.parse().unwrap_or(0);
    let available = total_balance.saturating_sub(total_principal);

    Ok(EarnPool {
        protocol: protocol.to_string(),
        lpp_address: lpp_address.clone(),
        currency: lpn_ticker,
        total_deposited: lpp_balance.balance.amount.clone(),
        total_deposited_usd: None, // Would need price data
        apy,
        utilization,
        available_liquidity: available.to_string(),
        deposit_capacity: deposit_capacity.map(|dc| dc.amount),
    })
}

async fn fetch_position_info(
    state: &AppState,
    protocol: &str,
    owner: &str,
    etl_pools: &Option<Vec<crate::external::etl::EtlPool>>,
) -> Result<Option<EarnPosition>, AppError> {
    let admin_address = &state.config.protocols.admin_contract;

    let protocol_contracts = state
        .chain_client
        .get_admin_protocol(admin_address, protocol)
        .await?;

    let lpp_address = &protocol_contracts.contracts.lpp;

    // Get lender deposit
    let deposit = state
        .chain_client
        .get_lender_deposit(lpp_address, owner)
        .await?;

    let deposit_amount: u128 = deposit.amount.parse().unwrap_or(0);

    // Skip if no deposit
    if deposit_amount == 0 {
        return Ok(None);
    }

    // Get LPP price and LPN ticker
    let (lpp_price, lpn_ticker) = tokio::try_join!(
        state.chain_client.get_lpp_price(lpp_address),
        state.chain_client.get_lpn(lpp_address),
    )?;

    // Calculate LPN value from nLPN
    let price_quote: u128 = lpp_price.amount_quote.amount.parse().unwrap_or(1);
    let price_amount: u128 = lpp_price.amount.amount.parse().unwrap_or(1);
    let lpp_price_ratio = if price_amount > 0 {
        price_quote as f64 / price_amount as f64
    } else {
        1.0
    };

    let deposited_lpn = (deposit_amount as f64 * lpp_price_ratio) as u128;

    // Get APY from ETL data
    let apy = etl_pools
        .as_ref()
        .and_then(|pools| {
            pools
                .iter()
                .find(|p| p.protocol.eq_ignore_ascii_case(protocol))
                .and_then(|p| p.apr.as_ref())
                .and_then(|apr| apr.parse::<f64>().ok())
        })
        .unwrap_or(0.0);

    Ok(Some(EarnPosition {
        protocol: protocol.to_string(),
        lpp_address: lpp_address.clone(),
        currency: lpn_ticker,
        deposited_nlpn: deposit.amount,
        deposited_lpn: deposited_lpn.to_string(),
        deposited_usd: None, // Would need price data
        lpp_price: format!("{:.6}", lpp_price_ratio),
        current_apy: apy,
    }))
}

