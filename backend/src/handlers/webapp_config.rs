//! Webapp Configuration Handlers
//!
//! These handlers serve all configuration that was previously fetched from GitHub.
//! All configuration is now served through the Rust backend with admin endpoints
//! for on-the-fly editing.

use axum::{
    extract::{Path, State},
    http::header,
    response::IntoResponse,
    Json,
};
use std::sync::Arc;
use tracing::debug;

use crate::error::AppError;
use crate::AppState;

// ============================================================================
// Full Config Endpoint
// ============================================================================

/// GET /api/config/full
/// Returns all webapp configuration in a single request for app initialization
pub async fn get_full_config(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting full webapp configuration");

    let config = state.config_store.get_full_config().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(config),
    ))
}

// ============================================================================
// Currencies Endpoints
// ============================================================================

/// GET /api/config/currencies
/// Returns currency definitions and mappings
pub async fn get_currencies(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting currencies configuration");

    let currencies = state.config_store.load_currencies().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(currencies),
    ))
}

// ============================================================================
// Chain IDs Endpoint
// ============================================================================

/// GET /api/config/chain-ids
/// Returns chain ID mappings for cosmos and EVM networks
pub async fn get_chain_ids(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting chain IDs configuration");

    let chain_ids = state.config_store.load_chain_ids().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(chain_ids),
    ))
}

// ============================================================================
// Networks Configuration
// ============================================================================

/// GET /api/config/networks
/// Returns networks configuration (chain details, gas prices, explorers)
pub async fn get_networks(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting networks configuration");

    let networks = state.config_store.load_networks().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(networks),
    ))
}

// ============================================================================
// Endpoints Configuration
// ============================================================================

/// GET /api/config/endpoints
/// Returns all endpoint configurations (pirin, rila, evm)
pub async fn get_all_endpoints(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting all endpoints configuration");

    let endpoints = state.config_store.load_all_endpoints().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(endpoints),
    ))
}

/// GET /api/config/endpoints/{network}
/// Returns endpoint configuration for a specific network (pirin, rila, or evm)
pub async fn get_endpoints(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting endpoints configuration for network: {}", network);

    // Validate network name
    if !["pirin", "rila", "evm"].contains(&network.as_str()) {
        return Err(AppError::Validation {
            message: format!("Invalid network: {}. Must be pirin, rila, or evm", network),
            field: Some("network".to_string()),
            details: None,
        });
    }

    let endpoints = state.config_store.load_endpoints(&network).await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(endpoints),
    ))
}

// ============================================================================
// Lease Configuration Endpoints
// ============================================================================

/// GET /api/config/lease
/// Returns all lease configuration
#[allow(dead_code)]
pub async fn get_lease_config(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting all lease configuration");

    let lease = state.config_store.load_lease_config().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(lease),
    ))
}

/// GET /api/config/lease/downpayment-ranges
/// Returns all downpayment ranges for all protocols
pub async fn get_downpayment_ranges(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting downpayment ranges");

    let ranges = state.config_store.load_downpayment_ranges().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(ranges),
    ))
}

/// GET /api/config/lease/downpayment-ranges/{protocol}
/// Returns downpayment ranges for a specific protocol
pub async fn get_downpayment_range_for_protocol(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting downpayment ranges for protocol: {}", protocol);

    let all_ranges = state.config_store.load_downpayment_ranges().await?;

    let protocol_ranges =
        all_ranges
            .protocols
            .get(&protocol)
            .ok_or_else(|| AppError::NotFound {
                resource: format!("Downpayment ranges for protocol: {}", protocol),
            })?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(protocol_ranges.clone()),
    ))
}

/// GET /api/config/lease/ignore-assets
/// Returns list of ignored assets
pub async fn get_ignore_assets(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting ignore assets list");

    let assets = state.config_store.load_ignore_assets().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(assets),
    ))
}

/// GET /api/config/lease/ignore-lease-long
/// Returns list of assets ignored for long leases
pub async fn get_ignore_lease_long(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting ignore lease long assets list");

    let assets = state.config_store.load_ignore_lease_long().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(assets),
    ))
}

/// GET /api/config/lease/ignore-lease-short
/// Returns list of assets ignored for short leases
pub async fn get_ignore_lease_short(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting ignore lease short assets list");

    let assets = state.config_store.load_ignore_lease_short().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(assets),
    ))
}

/// GET /api/config/lease/free-interest
/// Returns list of assets with free interest
pub async fn get_free_interest_assets(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting free interest assets list");

    let assets = state.config_store.load_free_interest_assets().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(assets),
    ))
}

/// GET /api/config/lease/due-projection
/// Returns due projection configuration
pub async fn get_due_projection(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting due projection configuration");

    let projection = state.config_store.load_due_projection().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(projection),
    ))
}

// ============================================================================
// Zero Interest Configuration
// ============================================================================

/// GET /api/config/zero-interest/addresses
/// Returns addresses that receive zero interest payments
pub async fn get_zero_interest_addresses(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting zero interest addresses");

    let config = state.config_store.load_zero_interest().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(config),
    ))
}

// ============================================================================
// Skip Route Configuration
// ============================================================================

/// GET /api/config/swap/skip-route
/// Returns Skip routing configuration
pub async fn get_skip_route_config(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting Skip route configuration");

    let config = state.config_store.load_skip_route().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(config),
    ))
}

// ============================================================================
// Governance Configuration
// ============================================================================

/// GET /api/config/governance/hidden-proposals
/// Returns list of hidden proposal IDs
pub async fn get_hidden_proposals(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting hidden proposals configuration");

    let config = state.config_store.load_governance().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(config),
    ))
}

// ============================================================================
// History Configuration
// ============================================================================

/// GET /api/config/history/currencies
/// Returns history currencies configuration
pub async fn get_history_currencies(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting history currencies configuration");

    let config = state.config_store.load_history_currencies().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(config),
    ))
}

/// GET /api/config/history/protocols
/// Returns history protocols configuration
pub async fn get_history_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting history protocols configuration");

    let config = state.config_store.load_history_protocols().await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=300")],
        Json(config),
    ))
}

// ============================================================================
// Locales Endpoints
// ============================================================================

/// GET /api/locales
/// Returns list of available locales
pub async fn list_locales(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Listing available locales");

    let languages = state.translation_storage.list_languages_with_info().await?;
    
    let available: Vec<String> = languages
        .iter()
        .filter(|l| l.is_active)
        .map(|l| l.key.clone())
        .collect();
    
    let locales = crate::config_store::types::LocalesListResponse {
        available,
        default: "en".to_string(),
    };

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=3600")],
        Json(locales),
    ))
}

/// GET /api/locales/{lang}
/// Returns locale content for a specific language
pub async fn get_locale(
    State(state): State<Arc<AppState>>,
    Path(lang): Path<String>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting locale for language: {}", lang);

    // Validate language code (basic check)
    if lang.len() < 2 || lang.len() > 5 {
        return Err(AppError::Validation {
            message: "Invalid language code".to_string(),
            field: Some("lang".to_string()),
            details: None,
        });
    }

    let locale = state.translation_storage.load_active(&lang).await?;

    Ok((
        [(header::CACHE_CONTROL, "public, max-age=3600")],
        Json(locale),
    ))
}

// ============================================================================
// Cache Management
// ============================================================================

/// POST /api/config/reload
/// Reloads all configuration from files (invalidates cache)
/// Note: This is a semi-admin operation - consider requiring auth
#[allow(dead_code)]
pub async fn reload_config(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Reloading configuration");

    state.config_store.invalidate_cache().await;

    // Pre-load the config to warm the cache
    let _ = state.config_store.get_full_config().await?;

    Ok(Json(serde_json::json!({
        "status": "ok",
        "message": "Configuration reloaded"
    })))
}
