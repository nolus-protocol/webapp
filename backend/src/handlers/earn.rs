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
use tracing::{debug, warn};

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
    /// Pool icon path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
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
/// Reads from background-refreshed cache. Pools are filtered by gated configuration.
pub async fn get_pools(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<EarnPool>>, AppError> {
    debug!("Getting all earn pools");

    // Read filter context and pools from cache
    let filter_ctx = state
        .data_cache
        .filter_context
        .load_or_unavailable("Filter context")?;

    let pools = state.data_cache.pools.load_or_unavailable("Earn pools")?;

    // Load network config from cache for pool icons
    let gated = state.data_cache.gated_config.load();

    // Filter pools to only configured protocols and enrich with icons
    let filtered_pools: Vec<EarnPool> = pools
        .into_iter()
        .filter(|pool| filter_ctx.is_earn_position_visible(&pool.protocol))
        .map(|mut pool| {
            if let Some(ref gated) = gated {
                if let Some(network_key) = pool.protocol.split('-').next() {
                    if let Some(network_settings) = gated.network_config.networks.get(network_key) {
                        if let Some(pool_config) = network_settings.pools.get(&pool.protocol) {
                            pool.icon = Some(pool_config.icon.clone());
                        }
                    }
                }
            }
            pool
        })
        .collect();

    Ok(Json(filtered_pools))
}

/// GET /api/earn/pools/:protocol
/// Returns details for a specific pool
///
/// Returns 404 if protocol is not configured in gated config
pub async fn get_pool(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<Json<EarnPool>, AppError> {
    debug!("Getting pool for protocol: {}", protocol);

    // Read filter context from cache and check if protocol is configured
    let filter_ctx = state
        .data_cache
        .filter_context
        .load_or_unavailable("Filter context")?;
    if !filter_ctx.is_earn_position_visible(&protocol) {
        return Err(AppError::NotFound {
            resource: format!("Pool for protocol: {}", protocol),
        });
    }

    let etl_pools = match state.etl_client.fetch_pools().await {
        Ok(pools) => Some(pools),
        Err(e) => {
            warn!("Failed to fetch ETL pools for pool {}: {}", protocol, e);
            None
        }
    };

    fetch_pool_info(&state, &protocol, &etl_pools)
        .await
        .map(Json)
}

/// GET /api/earn/positions?owner=...
/// Returns all earn positions for an owner
///
/// Positions are filtered based on gated configuration - only configured protocols are returned
pub async fn get_positions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AddressQuery>,
) -> Result<Json<EarnPositionsResponse>, AppError> {
    crate::validation::validate_bech32_address(&query.address, "address")?;
    debug!("Getting earn positions for owner: {}", query.address);

    // Read filter context from cache
    let filter_ctx = state
        .data_cache
        .filter_context
        .load_or_unavailable("Filter context")?;

    // Get all protocols from cache and filter to configured ones
    let contracts_map = state
        .data_cache
        .protocol_contracts
        .load_or_unavailable("Protocol contracts")?;

    let protocols: Vec<String> = contracts_map
        .keys()
        .filter(|p| filter_ctx.is_earn_position_visible(p))
        .cloned()
        .collect();

    // Fetch ETL pool data for APY
    let etl_pools = match state.etl_client.fetch_pools().await {
        Ok(pools) => Some(pools),
        Err(e) => {
            warn!("Failed to fetch ETL pools for positions: {}", e);
            None
        }
    };

    // Fetch all positions in parallel (only for configured protocols)
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
                    match usd.parse::<f64>() {
                        Ok(val) => total_deposited_usd += val,
                        Err(e) => {
                            warn!(
                                "Failed to parse deposited_usd '{}' for position in {}: {}",
                                usd, position.protocol, e
                            );
                        }
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

    let contracts_map = state
        .data_cache
        .protocol_contracts
        .load_or_unavailable("Protocol contracts")?;
    let contract_info = contracts_map
        .get(&request.protocol)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Protocol {}", request.protocol),
        })?;

    // Build deposit message
    // Deposit to LPP is done by sending funds to the contract
    let deposit_msg = serde_json::json!({
        "deposit": {}
    });

    let execute_msg = serde_json::json!({
        "@type": "/cosmwasm.wasm.v1.MsgExecuteContract",
        "sender": "", // Will be filled by frontend with wallet address
        "contract": contract_info.lpp,
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

    let contracts_map = state
        .data_cache
        .protocol_contracts
        .load_or_unavailable("Protocol contracts")?;
    let contract_info = contracts_map
        .get(&request.protocol)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Protocol {}", request.protocol),
        })?;

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
        "contract": contract_info.lpp,
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
/// Uses ETL for TVL and pool data, only dispatcher rewards from on-chain
pub async fn get_earn_stats(
    State(state): State<Arc<AppState>>,
) -> Result<Json<EarnStats>, AppError> {
    debug!("Getting earn stats");

    // Fetch TVL, pools, and dispatcher rewards in parallel
    let (tvl_result, etl_pools_result, dispatcher_rewards_result) = tokio::join!(
        state.etl_client.fetch_tvl(),
        state.etl_client.fetch_pools(),
        state
            .chain_client
            .get_dispatcher_rewards(&state.config.protocols.dispatcher_contract)
    );

    // TVL from ETL - fail fast if unavailable
    let tvl = tvl_result
        .map_err(|e| AppError::Internal(format!("Failed to fetch TVL from ETL: {}", e)))?;

    // Pool data from ETL - fail fast if unavailable
    let etl_pools = etl_pools_result
        .map_err(|e| AppError::Internal(format!("Failed to fetch pools from ETL: {}", e)))?;

    // Dispatcher rewards from on-chain (optional - doesn't fail if unavailable)
    let dispatcher_rewards = dispatcher_rewards_result
        .ok()
        .map(|r| r as f64 / 10f64.powi(INTEREST_DECIMALS as i32));

    // Calculate pool count and average APY from ETL data
    let pool_count = etl_pools.len() as u32;
    let total_apy: f64 = etl_pools
        .iter()
        .filter_map(|p| p.apr.as_ref()?.parse::<f64>().ok())
        .sum();

    let average_apy = if pool_count > 0 {
        total_apy / pool_count as f64
    } else {
        0.0
    };

    Ok(Json(EarnStats {
        total_value_locked: tvl.total_value_locked,
        pools_count: pool_count,
        average_apy,
        dispatcher_rewards,
    }))
}

// ============================================================================
// Helper Functions
// ============================================================================

pub async fn fetch_pool_info(
    state: &AppState,
    protocol: &str,
    etl_pools: &Option<Vec<crate::external::etl::EtlPool>>,
) -> Result<EarnPool, AppError> {
    let contracts_map = state
        .data_cache
        .protocol_contracts
        .load_or_unavailable("Protocol contracts")?;
    let contract_info = contracts_map
        .get(protocol)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Protocol {}", protocol),
        })?;

    let lpp_address = &contract_info.lpp;

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
    let total_balance: u128 = lpp_balance.balance.amount.parse().unwrap_or_else(|_| {
        warn!(
            "Failed to parse LPP balance for {}: {}",
            protocol, lpp_balance.balance.amount
        );
        0
    });
    let total_principal: u128 = lpp_balance
        .total_principal_due
        .amount
        .parse()
        .unwrap_or_else(|_| {
            warn!(
                "Failed to parse LPP total_principal_due for {}: {}",
                protocol, lpp_balance.total_principal_due.amount
            );
            0
        });
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
        icon: None, // Populated later from network config
    })
}

async fn fetch_position_info(
    state: &AppState,
    protocol: &str,
    owner: &str,
    etl_pools: &Option<Vec<crate::external::etl::EtlPool>>,
) -> Result<Option<EarnPosition>, AppError> {
    let contracts_map = state
        .data_cache
        .protocol_contracts
        .load_or_unavailable("Protocol contracts")?;
    let contract_info = contracts_map
        .get(protocol)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Protocol {}", protocol),
        })?;

    let lpp_address = &contract_info.lpp;

    // Get lender deposit
    let deposit = state
        .chain_client
        .get_lender_deposit(lpp_address, owner)
        .await?;

    let deposit_amount: u128 = deposit.amount.parse().unwrap_or_else(|_| {
        warn!(
            "Failed to parse deposit amount for {} owner {}: {}",
            protocol, owner, deposit.amount
        );
        0
    });

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
    let price_quote: u128 = lpp_price.amount_quote.amount.parse().unwrap_or_else(|_| {
        warn!(
            "Failed to parse LPP price_quote for {}: {}",
            protocol, lpp_price.amount_quote.amount
        );
        1
    });
    let price_amount: u128 = lpp_price.amount.amount.parse().unwrap_or_else(|_| {
        warn!(
            "Failed to parse LPP price_amount for {}: {}",
            protocol, lpp_price.amount.amount
        );
        1
    });
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

// ============================================================================
// WebSocket Monitoring Support
// ============================================================================

use super::websocket::EarnPositionInfo;

/// Fetch earn positions for WebSocket monitoring
/// Returns positions in the format needed by WebSocket updates
pub async fn fetch_earn_positions_for_monitoring(
    state: &AppState,
    address: &str,
) -> Result<(Vec<EarnPositionInfo>, String), AppError> {
    // Get all protocols from cache
    let contracts_map = state
        .data_cache
        .protocol_contracts
        .load_or_unavailable("Protocol contracts")?;
    let protocols: Vec<String> = contracts_map.keys().cloned().collect();

    // Fetch all positions in parallel
    let position_futures: Vec<_> = protocols
        .iter()
        .map(|protocol| {
            let state_ref = state;
            let protocol = protocol.clone();
            let address = address.to_string();
            async move { fetch_position_for_monitoring(state_ref, &protocol, &address).await }
        })
        .collect();

    let position_results = futures::future::join_all(position_futures).await;

    let mut positions = Vec::new();

    for result in position_results {
        match result {
            Ok(Some(position)) => {
                positions.push(position);
            }
            Ok(None) => {
                // No position in this pool
            }
            Err(e) => {
                debug!("Failed to fetch position for monitoring: {}", e);
            }
        }
    }

    // USD calculation would need price data - returning "0.00" for now
    Ok((positions, "0.00".to_string()))
}

/// Fetch a single position for monitoring
async fn fetch_position_for_monitoring(
    state: &AppState,
    protocol: &str,
    owner: &str,
) -> Result<Option<EarnPositionInfo>, AppError> {
    let contracts_map = state
        .data_cache
        .protocol_contracts
        .load_or_unavailable("Protocol contracts")?;
    let contract_info = contracts_map
        .get(protocol)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Protocol {}", protocol),
        })?;

    let lpp_address = &contract_info.lpp;

    // Get lender deposit
    let deposit = state
        .chain_client
        .get_lender_deposit(lpp_address, owner)
        .await?;

    let deposit_amount: u128 = deposit.amount.parse().unwrap_or_else(|_| {
        warn!(
            "Failed to parse WS deposit amount for {} owner {}: {}",
            protocol, owner, deposit.amount
        );
        0
    });

    // Skip if no deposit
    if deposit_amount == 0 {
        return Ok(None);
    }

    // Get LPP price
    let lpp_price = state.chain_client.get_lpp_price(lpp_address).await?;

    // Calculate LPN value from nLPN
    let price_quote: u128 = lpp_price.amount_quote.amount.parse().unwrap_or_else(|_| {
        warn!(
            "Failed to parse WS LPP price_quote for {}: {}",
            protocol, lpp_price.amount_quote.amount
        );
        1
    });
    let price_amount: u128 = lpp_price.amount.amount.parse().unwrap_or_else(|_| {
        warn!(
            "Failed to parse WS LPP price_amount for {}: {}",
            protocol, lpp_price.amount.amount
        );
        1
    });
    let lpp_price_ratio = if price_amount > 0 {
        price_quote as f64 / price_amount as f64
    } else {
        1.0
    };

    let deposited_lpn = (deposit_amount as f64 * lpp_price_ratio) as u128;

    // Calculate rewards (difference between current value and deposited value)
    // For now, rewards tracking would require historical data
    let rewards = "0".to_string();

    Ok(Some(EarnPositionInfo {
        protocol: protocol.to_string(),
        lpp_address: lpp_address.clone(),
        deposited_lpn: deposited_lpn.to_string(),
        deposited_asset: deposit.amount.clone(),
        rewards,
    }))
}
