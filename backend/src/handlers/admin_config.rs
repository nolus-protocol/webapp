//! Admin Configuration Handlers
//!
//! Protected endpoints for managing webapp configuration.
//! All endpoints require ADMIN_API_KEY authentication.

use axum::{
    extract::{Path, Query, State},
    response::IntoResponse,
    Json,
};
use serde::{Deserialize, Serialize};
use serde_json::Value;
use std::sync::Arc;
use tracing::{debug, info};

use crate::config_store::types::*;
use crate::error::AppError;
use crate::AppState;

// ============================================================================
// Request/Response Types
// ============================================================================

#[derive(Debug, Serialize)]
pub struct AdminResponse {
    pub status: &'static str,
    pub message: String,
}

#[derive(Debug, Deserialize)]
pub struct UpdateConfigRequest {
    pub data: Value,
}

// ============================================================================
// Currencies Admin Endpoints
// ============================================================================

/// PUT /api/admin/webapp/config/currencies
/// Update currencies configuration
pub async fn update_currencies(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating currencies configuration");

    let config: CurrenciesConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid currencies config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_currencies(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Currencies configuration updated".to_string(),
    }))
}

// ============================================================================
// Chain IDs Admin Endpoints
// ============================================================================

/// PUT /api/admin/webapp/config/chain-ids
/// Update chain IDs configuration
pub async fn update_chain_ids(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating chain IDs configuration");

    let config: ChainIdsConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid chain IDs config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_chain_ids(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Chain IDs configuration updated".to_string(),
    }))
}

// ============================================================================
// Networks Admin Endpoints
// ============================================================================

/// PUT /api/admin/webapp/config/networks
/// Update networks configuration (chain details, gas prices, explorers)
pub async fn update_networks(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating networks configuration");

    let config: NetworksConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid networks config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_networks(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Networks configuration updated".to_string(),
    }))
}

// ============================================================================
// Endpoints Admin
// ============================================================================

/// PUT /api/admin/webapp/config/endpoints/{network}
/// Update endpoints configuration for a specific network
pub async fn update_endpoints(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!(
        "Admin updating endpoints configuration for network: {}",
        network
    );

    // Validate network name format (alphanumeric and hyphens only)
    if !network
        .chars()
        .all(|c| c.is_alphanumeric() || c == '-' || c == '_')
    {
        return Err(AppError::Validation {
            message: format!(
                "Invalid network name: {}. Must contain only alphanumeric characters, hyphens, or underscores",
                network
            ),
            field: Some("network".to_string()),
            details: None,
        });
    }

    let config: NetworkEndpointsConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid endpoints config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_endpoints(&network, &config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: format!("Endpoints configuration for {} updated", network),
    }))
}

// ============================================================================
// Lease Configuration Admin Endpoints
// ============================================================================

/// PUT /api/admin/webapp/config/lease/downpayment-ranges
/// Update downpayment ranges configuration
pub async fn update_downpayment_ranges(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating downpayment ranges configuration");

    let config: DownpaymentRangesConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid downpayment ranges config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_downpayment_ranges(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Downpayment ranges configuration updated".to_string(),
    }))
}

/// PUT /api/admin/webapp/config/lease/ignore-assets
/// Update ignore assets list
pub async fn update_ignore_assets(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating ignore assets list");

    let config: StringArrayConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid ignore assets config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_ignore_assets(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Ignore assets list updated".to_string(),
    }))
}

/// PUT /api/admin/webapp/config/lease/ignore-lease-long
/// Update ignore lease long assets list
pub async fn update_ignore_lease_long(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating ignore lease long assets list");

    let config: StringArrayConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid ignore lease long assets config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_ignore_lease_long(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Ignore lease long assets list updated".to_string(),
    }))
}

/// PUT /api/admin/webapp/config/lease/ignore-lease-short
/// Update ignore lease short assets list
pub async fn update_ignore_lease_short(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating ignore lease short assets list");

    let config: StringArrayConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid ignore lease short assets config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_ignore_lease_short(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Ignore lease short assets list updated".to_string(),
    }))
}

/// PUT /api/admin/webapp/config/lease/free-interest
/// Update free interest assets list
pub async fn update_free_interest_assets(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating free interest assets list");

    let config: StringArrayConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid free interest assets config: {}", e),
            field: None,
            details: None,
        })?;

    state
        .config_store
        .save_free_interest_assets(&config)
        .await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Free interest assets list updated".to_string(),
    }))
}

/// PUT /api/admin/webapp/config/lease/due-projection
/// Update due projection configuration
pub async fn update_due_projection(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating due projection configuration");

    let config: DueProjectionConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid due projection config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_due_projection(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Due projection configuration updated".to_string(),
    }))
}

// ============================================================================
// Zero Interest Admin
// ============================================================================

/// PUT /api/admin/webapp/config/zero-interest/addresses
/// Update zero interest payment addresses
pub async fn update_zero_interest_addresses(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating zero interest addresses");

    let config: ZeroInterestConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid zero interest config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_zero_interest(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Zero interest addresses updated".to_string(),
    }))
}

// ============================================================================
// Swap Configuration Admin
// ============================================================================

/// PUT /api/admin/webapp/config/swap/skip-route
/// Update Skip route configuration
pub async fn update_skip_route_config(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating Skip route configuration");

    let config: SkipRouteConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid Skip route config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_skip_route(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Skip route configuration updated".to_string(),
    }))
}

// ============================================================================
// Governance Admin
// ============================================================================

/// PUT /api/admin/webapp/config/governance/hidden-proposals
/// Update hidden proposals list
pub async fn update_hidden_proposals(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating hidden proposals list");

    let config: ProposalsConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid hidden proposals config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_governance(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Hidden proposals list updated".to_string(),
    }))
}

// ============================================================================
// History Configuration Admin
// ============================================================================

/// PUT /api/admin/webapp/config/history/currencies
/// Update history currencies configuration
pub async fn update_history_currencies(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating history currencies configuration");

    let config: HistoryCurrenciesConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid history currencies config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_history_currencies(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "History currencies configuration updated".to_string(),
    }))
}

/// PUT /api/admin/webapp/config/history/protocols
/// Update history protocols configuration
pub async fn update_history_protocols(
    State(state): State<Arc<AppState>>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating history protocols configuration");

    let config: HistoryProtocolsConfig =
        serde_json::from_value(payload.data).map_err(|e| AppError::Validation {
            message: format!("Invalid history protocols config: {}", e),
            field: None,
            details: None,
        })?;

    state.config_store.save_history_protocols(&config).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "History protocols configuration updated".to_string(),
    }))
}

// ============================================================================
// Locales Admin
// ============================================================================

/// PUT /api/admin/webapp/locales/{lang}
/// Update locale content for a specific language
pub async fn update_locale(
    State(state): State<Arc<AppState>>,
    Path(lang): Path<String>,
    Json(payload): Json<UpdateConfigRequest>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin updating locale for language: {}", lang);

    // Validate language code
    if lang.len() < 2 || lang.len() > 5 {
        return Err(AppError::Validation {
            message: "Invalid language code".to_string(),
            field: Some("lang".to_string()),
            details: None,
        });
    }

    // Locales are stored as raw JSON values (not typed)
    state.config_store.save_locale(&lang, &payload.data).await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: format!("Locale {} updated", lang),
    }))
}

// ============================================================================
// Cache Management
// ============================================================================

/// POST /api/admin/webapp/config/reload
/// Reload all configuration from files (invalidates cache)
pub async fn reload_config(
    State(state): State<Arc<AppState>>,
) -> Result<impl IntoResponse, AppError> {
    info!("Admin reloading all configuration");

    state.config_store.invalidate_cache().await;

    // Pre-load the config to warm the cache
    let _ = state.config_store.get_full_config().await?;

    Ok(Json(AdminResponse {
        status: "ok",
        message: "Configuration reloaded from files".to_string(),
    }))
}

/// Query parameters for audit log endpoint
#[derive(Debug, Deserialize)]
pub struct AuditLogQueryParams {
    pub action: Option<String>,
    pub resource: Option<String>,
    pub from: Option<String>,
    pub to: Option<String>,
    pub offset: Option<usize>,
    pub limit: Option<usize>,
}

/// GET /api/admin/webapp/config/audit
/// Get configuration change audit log
pub async fn get_audit_log(
    State(state): State<Arc<AppState>>,
    Query(params): Query<AuditLogQueryParams>,
) -> Result<impl IntoResponse, AppError> {
    debug!("Getting configuration audit log");

    use crate::config_store::storage::AuditLogQuery;
    use chrono::DateTime;

    let query = AuditLogQuery {
        action: params.action,
        resource: params.resource,
        from: params.from.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc))
        }),
        to: params.to.and_then(|s| {
            DateTime::parse_from_rfc3339(&s)
                .ok()
                .map(|dt| dt.with_timezone(&chrono::Utc))
        }),
        offset: params.offset.unwrap_or(0),
        limit: params.limit.unwrap_or(50),
    };

    let response = state.config_store.query_audit_log(query).await;

    Ok(Json(response))
}
