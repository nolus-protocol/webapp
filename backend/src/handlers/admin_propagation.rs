//! Admin endpoints for Gated Propagation configuration.
//!
//! These endpoints manage PostgreSQL-backed configuration for:
//! - Currency display (icons, colors, names)
//! - Protocol status (configured, blacklisted, unconfigured)
//! - Network configuration (explorers, gas, endpoints)
//! - Asset restrictions (blacklists, ignored assets)
//!
//! All endpoints require ADMIN_API_KEY authentication.

use axum::{
    extract::{Path, Query, State},
    http::StatusCode,
    Json,
};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use std::str::FromStr;
use std::sync::Arc;
use tracing::info;

use crate::db::{
    models::{
        protocol_statuses, AssetRestrictionInput, CurrencyDisplayInput, NetworkConfigInput,
        NetworkEndpointInput, ProtocolStatusInput,
    },
    AssetRestrictionsRepo, CurrencyDisplayRepo, NetworkConfigRepo, NetworkEndpointRepo,
    ProtocolStatusRepo,
};
use crate::error::AppError;
use crate::AppState;

// ============================================================================
// Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct AdminResponse {
    pub status: &'static str,
    pub message: String,
}

#[derive(Debug, Serialize)]
pub struct UnconfiguredSummary {
    pub currencies: Vec<String>,
    pub protocols: Vec<String>,
    pub networks: Vec<String>,
    pub currency_count: usize,
    pub protocol_count: usize,
    pub network_count: usize,
}

// ============================================================================
// Currency Display Endpoints
// ============================================================================

/// GET /api/admin/propagation/currencies
/// List all currency display configurations
pub async fn list_currencies(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let currencies = CurrencyDisplayRepo::get_all(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch currencies: {}", e)))?;

    let count = currencies.len();

    Ok(Json(serde_json::json!({
        "currencies": currencies,
        "count": count
    })))
}

/// GET /api/admin/propagation/currencies/{ticker}
/// Get a specific currency display configuration
pub async fn get_currency(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let currency = CurrencyDisplayRepo::get_by_ticker(&state.db, &ticker)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch currency: {}", e)))?
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Currency display for {}", ticker),
        })?;

    Ok(Json(serde_json::to_value(currency).unwrap()))
}

/// Request to create/update a currency display
#[derive(Debug, Deserialize)]
pub struct CurrencyDisplayRequest {
    pub ticker: String,
    pub icon_url: String,
    pub color: Option<String>,
    pub display_name: String,
    pub coingecko_id: Option<String>,
}

/// PUT /api/admin/propagation/currencies/{ticker}
/// Create or update a currency display configuration
pub async fn upsert_currency(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
    Json(request): Json<CurrencyDisplayRequest>,
) -> Result<Json<AdminResponse>, AppError> {
    // Validate ticker matches path
    if request.ticker != ticker {
        return Err(AppError::Validation {
            message: "Ticker in body must match path".to_string(),
            field: Some("ticker".to_string()),
            details: None,
        });
    }

    info!("Admin configuring currency display for: {}", ticker);

    let input = CurrencyDisplayInput {
        ticker: request.ticker,
        icon_url: request.icon_url,
        color: request.color,
        display_name: request.display_name,
        coingecko_id: request.coingecko_id,
    };

    CurrencyDisplayRepo::upsert(&state.db, &input)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to save currency: {}", e)))?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: format!("Currency {} configured", ticker),
    }))
}

/// DELETE /api/admin/propagation/currencies/{ticker}
/// Remove a currency display configuration (makes it unconfigured)
pub async fn delete_currency(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<StatusCode, AppError> {
    info!("Admin removing currency display for: {}", ticker);

    let deleted = CurrencyDisplayRepo::delete(&state.db, &ticker)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete currency: {}", e)))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound {
            resource: format!("Currency display for {}", ticker),
        })
    }
}

// ============================================================================
// Protocol Status Endpoints
// ============================================================================

/// GET /api/admin/propagation/protocols
/// List all protocol status configurations
pub async fn list_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let protocols = ProtocolStatusRepo::get_all(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch protocols: {}", e)))?;

    let configured_count = protocols
        .iter()
        .filter(|p| p.status == protocol_statuses::CONFIGURED)
        .count();
    let blacklisted_count = protocols
        .iter()
        .filter(|p| p.status == protocol_statuses::BLACKLISTED)
        .count();

    Ok(Json(serde_json::json!({
        "protocols": protocols,
        "count": protocols.len(),
        "configured_count": configured_count,
        "blacklisted_count": blacklisted_count
    })))
}

/// GET /api/admin/propagation/protocols/{protocol}
/// Get a specific protocol status
pub async fn get_protocol(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let status = ProtocolStatusRepo::get(&state.db, &protocol)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch protocol: {}", e)))?;

    match status {
        Some(p) => Ok(Json(serde_json::to_value(p).unwrap())),
        None => Ok(Json(serde_json::json!({
            "protocol": protocol,
            "status": protocol_statuses::UNCONFIGURED,
            "reason": null,
            "configured_at": null
        }))),
    }
}

/// Request to set protocol status
#[derive(Debug, Deserialize)]
pub struct ProtocolStatusRequest {
    pub status: String,
    pub reason: Option<String>,
}

/// PUT /api/admin/propagation/protocols/{protocol}
/// Set a protocol's status (configured, blacklisted, or delete to reset to unconfigured)
pub async fn set_protocol_status(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
    Json(request): Json<ProtocolStatusRequest>,
) -> Result<Json<AdminResponse>, AppError> {
    // Validate status
    if request.status != protocol_statuses::CONFIGURED
        && request.status != protocol_statuses::BLACKLISTED
        && request.status != protocol_statuses::UNCONFIGURED
    {
        return Err(AppError::Validation {
            message: format!(
                "Invalid status. Must be one of: {}, {}, {}",
                protocol_statuses::CONFIGURED,
                protocol_statuses::BLACKLISTED,
                protocol_statuses::UNCONFIGURED
            ),
            field: Some("status".to_string()),
            details: None,
        });
    }

    info!(
        "Admin setting protocol {} status to: {}",
        protocol, request.status
    );

    // If setting to unconfigured, delete the record
    if request.status == protocol_statuses::UNCONFIGURED {
        ProtocolStatusRepo::delete(&state.db, &protocol)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to delete protocol status: {}", e)))?;
    } else {
        let input = ProtocolStatusInput {
            protocol: protocol.clone(),
            status: request.status.clone(),
            reason: request.reason,
        };

        ProtocolStatusRepo::upsert(&state.db, &input)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to save protocol status: {}", e)))?;
    }

    Ok(Json(AdminResponse {
        status: "ok",
        message: format!("Protocol {} status set to {}", protocol, request.status),
    }))
}

/// DELETE /api/admin/propagation/protocols/{protocol}
/// Remove a protocol status (resets to unconfigured)
pub async fn delete_protocol_status(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<StatusCode, AppError> {
    info!("Admin removing protocol status for: {}", protocol);

    ProtocolStatusRepo::delete(&state.db, &protocol)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete protocol status: {}", e)))?;

    Ok(StatusCode::NO_CONTENT)
}

// ============================================================================
// Network Configuration Endpoints
// ============================================================================

/// GET /api/admin/propagation/networks
/// List all network configurations
pub async fn list_networks(
    State(state): State<Arc<AppState>>,
) -> Result<Json<serde_json::Value>, AppError> {
    let networks = NetworkConfigRepo::get_all(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch networks: {}", e)))?;

    Ok(Json(serde_json::json!({
        "networks": networks,
        "count": networks.len()
    })))
}

/// GET /api/admin/propagation/networks/{network_key}
/// Get a specific network configuration
pub async fn get_network(
    State(state): State<Arc<AppState>>,
    Path(network_key): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    let network = NetworkConfigRepo::get_by_key(&state.db, &network_key)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch network: {}", e)))?
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Network config for {}", network_key),
        })?;

    // Also fetch endpoints
    let endpoints = NetworkEndpointRepo::get_by_network(&state.db, &network_key)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch endpoints: {}", e)))?;

    Ok(Json(serde_json::json!({
        "network": network,
        "endpoints": endpoints
    })))
}

/// Request to create/update a network configuration
#[derive(Debug, Deserialize)]
pub struct NetworkConfigRequest {
    pub network_key: String,
    pub explorer_url: String,
    /// Gas price as string (will be parsed to Decimal)
    pub gas_price: String,
    /// Gas multiplier as string (will be parsed to Decimal)
    pub gas_multiplier: Option<String>,
    pub primary_protocol: Option<String>,
}

/// PUT /api/admin/propagation/networks/{network_key}
/// Create or update a network configuration
pub async fn upsert_network(
    State(state): State<Arc<AppState>>,
    Path(network_key): Path<String>,
    Json(request): Json<NetworkConfigRequest>,
) -> Result<Json<AdminResponse>, AppError> {
    if request.network_key != network_key {
        return Err(AppError::Validation {
            message: "network_key in body must match path".to_string(),
            field: Some("network_key".to_string()),
            details: None,
        });
    }

    info!("Admin configuring network: {}", network_key);

    // Parse gas_price string to Decimal
    let gas_price = Decimal::from_str(&request.gas_price).map_err(|e| AppError::Validation {
        message: format!("Invalid gas_price: {}", e),
        field: Some("gas_price".to_string()),
        details: None,
    })?;

    // Parse gas_multiplier string to Decimal if provided
    let gas_multiplier = request
        .gas_multiplier
        .map(|s| {
            Decimal::from_str(&s).map_err(|e| AppError::Validation {
                message: format!("Invalid gas_multiplier: {}", e),
                field: Some("gas_multiplier".to_string()),
                details: None,
            })
        })
        .transpose()?;

    let input = NetworkConfigInput {
        network_key: request.network_key,
        explorer_url: request.explorer_url,
        gas_price,
        gas_multiplier,
        primary_protocol: request.primary_protocol,
    };

    NetworkConfigRepo::upsert(&state.db, &input)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to save network: {}", e)))?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: format!("Network {} configured", network_key),
    }))
}

/// DELETE /api/admin/propagation/networks/{network_key}
/// Remove a network configuration
pub async fn delete_network(
    State(state): State<Arc<AppState>>,
    Path(network_key): Path<String>,
) -> Result<StatusCode, AppError> {
    info!("Admin removing network config for: {}", network_key);

    let deleted = NetworkConfigRepo::delete(&state.db, &network_key)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete network: {}", e)))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound {
            resource: format!("Network config for {}", network_key),
        })
    }
}

// ============================================================================
// Network Endpoints Management
// ============================================================================

/// Request to add a network endpoint
#[derive(Debug, Deserialize)]
pub struct NetworkEndpointRequest {
    pub endpoint_type: String, // "rpc" or "lcd"
    pub url: String,
    pub priority: Option<i32>,
}

/// POST /api/admin/propagation/networks/{network_key}/endpoints
/// Add an endpoint to a network
pub async fn add_endpoint(
    State(state): State<Arc<AppState>>,
    Path(network_key): Path<String>,
    Json(request): Json<NetworkEndpointRequest>,
) -> Result<Json<AdminResponse>, AppError> {
    // Validate endpoint type
    if request.endpoint_type != "rpc" && request.endpoint_type != "lcd" {
        return Err(AppError::Validation {
            message: "endpoint_type must be 'rpc' or 'lcd'".to_string(),
            field: Some("endpoint_type".to_string()),
            details: None,
        });
    }

    info!(
        "Admin adding {} endpoint for network: {}",
        request.endpoint_type, network_key
    );

    let input = NetworkEndpointInput {
        network_key,
        endpoint_type: request.endpoint_type,
        url: request.url,
        priority: request.priority,
    };

    NetworkEndpointRepo::create(&state.db, &input)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create endpoint: {}", e)))?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Endpoint added".to_string(),
    }))
}

/// DELETE /api/admin/propagation/networks/{network_key}/endpoints/{endpoint_id}
/// Remove an endpoint
pub async fn delete_endpoint(
    State(state): State<Arc<AppState>>,
    Path((network_key, endpoint_id)): Path<(String, i32)>,
) -> Result<StatusCode, AppError> {
    info!(
        "Admin removing endpoint {} from network: {}",
        endpoint_id, network_key
    );

    let deleted = NetworkEndpointRepo::delete(&state.db, endpoint_id)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete endpoint: {}", e)))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound {
            resource: format!("Endpoint {} for network {}", endpoint_id, network_key),
        })
    }
}

// ============================================================================
// Asset Restrictions Endpoints
// ============================================================================

/// Query parameters for restrictions
#[derive(Debug, Deserialize, Default)]
pub struct RestrictionsQuery {
    pub restriction_type: Option<String>,
    pub ticker: Option<String>,
}

/// GET /api/admin/propagation/restrictions
/// List all asset restrictions
pub async fn list_restrictions(
    State(state): State<Arc<AppState>>,
    Query(query): Query<RestrictionsQuery>,
) -> Result<Json<serde_json::Value>, AppError> {
    let restrictions = if let Some(ref restriction_type) = query.restriction_type {
        AssetRestrictionsRepo::get_by_type(&state.db, restriction_type)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch restrictions: {}", e)))?
    } else if let Some(ref ticker) = query.ticker {
        AssetRestrictionsRepo::get_by_ticker(&state.db, ticker)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch restrictions: {}", e)))?
    } else {
        AssetRestrictionsRepo::get_all(&state.db)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to fetch restrictions: {}", e)))?
    };

    Ok(Json(serde_json::json!({
        "restrictions": restrictions,
        "count": restrictions.len()
    })))
}

/// Request to create a restriction
#[derive(Debug, Deserialize)]
pub struct AssetRestrictionRequest {
    pub ticker: String,
    pub restriction_type: String,
    pub reason: Option<String>,
}

/// POST /api/admin/propagation/restrictions
/// Add an asset restriction
pub async fn add_restriction(
    State(state): State<Arc<AppState>>,
    Json(request): Json<AssetRestrictionRequest>,
) -> Result<Json<AdminResponse>, AppError> {
    info!(
        "Admin adding {} restriction for: {}",
        request.restriction_type, request.ticker
    );

    let input = AssetRestrictionInput {
        ticker: request.ticker.clone(),
        restriction_type: request.restriction_type.clone(),
        reason: request.reason,
    };

    AssetRestrictionsRepo::create(&state.db, &input)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to create restriction: {}", e)))?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: format!(
            "Restriction {} added for {}",
            request.restriction_type, request.ticker
        ),
    }))
}

/// DELETE /api/admin/propagation/restrictions/{id}
/// Remove a restriction by ID
pub async fn delete_restriction(
    State(state): State<Arc<AppState>>,
    Path(id): Path<i32>,
) -> Result<StatusCode, AppError> {
    info!("Admin removing restriction: {}", id);

    let deleted = AssetRestrictionsRepo::delete(&state.db, id)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to delete restriction: {}", e)))?;

    if deleted {
        Ok(StatusCode::NO_CONTENT)
    } else {
        Err(AppError::NotFound {
            resource: format!("Restriction {}", id),
        })
    }
}

// ============================================================================
// Unconfigured Items Summary
// ============================================================================

/// GET /api/admin/propagation/unconfigured
/// Get summary of all unconfigured items that need attention
pub async fn get_unconfigured(
    State(state): State<Arc<AppState>>,
) -> Result<Json<UnconfiguredSummary>, AppError> {
    // Fetch all currencies from ETL
    let etl_currencies = state
        .etl_client
        .fetch_currencies()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch ETL currencies: {}", e)))?;

    // Fetch all protocols from ETL
    let etl_protocols = state
        .etl_client
        .fetch_protocols()
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch ETL protocols: {}", e)))?;

    // Get configured currencies from DB
    let configured_currencies = CurrencyDisplayRepo::get_all(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch configured currencies: {}", e)))?;

    let configured_tickers: std::collections::HashSet<String> = configured_currencies
        .into_iter()
        .map(|c| c.ticker)
        .collect();

    // Get configured protocols from DB
    let configured_protocols = ProtocolStatusRepo::get_configured_protocols(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch configured protocols: {}", e)))?;

    let configured_protocol_set: std::collections::HashSet<String> =
        configured_protocols.into_iter().collect();

    // Get configured networks from DB
    let configured_networks = NetworkConfigRepo::get_all(&state.db)
        .await
        .map_err(|e| AppError::Internal(format!("Failed to fetch configured networks: {}", e)))?;

    let configured_network_set: std::collections::HashSet<String> = configured_networks
        .into_iter()
        .map(|n| n.network_key)
        .collect();

    // Find unconfigured currencies
    let unconfigured_currencies: Vec<String> = etl_currencies
        .currencies
        .into_iter()
        .filter(|c| !configured_tickers.contains(&c.ticker))
        .map(|c| c.ticker)
        .collect();

    // Find unconfigured protocols
    let unconfigured_protocols: Vec<String> = etl_protocols
        .protocols
        .into_iter()
        .filter(|p| !configured_protocol_set.contains(&p.name))
        .map(|p| p.name)
        .collect();

    // Extract unique networks from protocols
    let etl_networks: std::collections::HashSet<String> = unconfigured_protocols
        .iter()
        .filter_map(|p| p.split('-').next().map(String::from))
        .collect();

    let unconfigured_networks: Vec<String> = etl_networks
        .into_iter()
        .filter(|n| !configured_network_set.contains(n) && !n.is_empty())
        .collect();

    Ok(Json(UnconfiguredSummary {
        currency_count: unconfigured_currencies.len(),
        protocol_count: unconfigured_protocols.len(),
        network_count: unconfigured_networks.len(),
        currencies: unconfigured_currencies,
        protocols: unconfigured_protocols,
        networks: unconfigured_networks,
    }))
}
