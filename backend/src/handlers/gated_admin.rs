//! Gated Admin Handler
//!
//! Provides CRUD endpoints for managing gated configuration.
//! Admin endpoints show ETL data + enrichment status.

use axum::{
    extract::{Path, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use tracing::{debug, info, warn};

use crate::config_store::gated_types::{
    AdminCurrencyResponse, AdminNetworkResponse, AdminProtocolResponse, CurrencyDisplayConfig,
    CurrencyDisplayInput, CurrencyEnrichmentStatus, DownpaymentRangesInput, GatedNetworkConfig,
    LeaseRulesConfig, NetworkConfigStatus, NetworkSettingsInput, ProtocolReadinessStatus,
    SwapSettingsConfig, UiSettingsConfig, UnconfiguredSummary,
};
use crate::error::AppError;
use crate::propagation::PropagationValidator;
use crate::AppState;

// ============================================================================
// Admin Discovery Endpoints
// ============================================================================

/// GET /api/admin/gated/currencies
/// List all ETL currencies with enrichment status
pub async fn list_currencies(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AdminCurrencyResponse>>, AppError> {
    debug!("Admin: listing all currencies with enrichment status");

    // Load config and ETL data
    let currency_config = match state.config_store.load_currency_display().await {
        Ok(config) => Some(config),
        Err(e) => {
            warn!("Failed to load currency display config: {}", e);
            None
        }
    };
    let etl_currencies = state.etl_client.fetch_currencies().await?;

    let response: Vec<AdminCurrencyResponse> = etl_currencies
        .currencies
        .iter()
        .filter(|c| c.is_active)
        .map(|c| {
            let enrichment = currency_config
                .as_ref()
                .and_then(|config| config.currencies.get(&c.ticker));

            AdminCurrencyResponse {
                ticker: c.ticker.clone(),
                denom: c
                    .protocols
                    .first()
                    .map(|p| p.bank_symbol.clone())
                    .unwrap_or_default(),
                decimals: c.decimal_digits,
                source: "etl".to_string(),
                enrichment: CurrencyEnrichmentStatus {
                    icon: enrichment.map(|e| e.icon.clone()),
                    display_name: enrichment.map(|e| e.display_name.clone()),
                    short_name: enrichment.and_then(|e| e.short_name.clone()),
                    color: enrichment.and_then(|e| e.color.clone()),
                    coingecko_id: enrichment.and_then(|e| e.coingecko_id.clone()),
                    configured: enrichment.map(|e| e.is_configured()).unwrap_or(false),
                },
            }
        })
        .collect();

    Ok(Json(response))
}

/// GET /api/admin/gated/protocols
/// List all ETL protocols with readiness status
pub async fn list_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AdminProtocolResponse>>, AppError> {
    debug!("Admin: listing all protocols with readiness status");

    // Load configs and ETL data
    let currency_config = match state.config_store.load_currency_display().await {
        Ok(config) => Some(config),
        Err(e) => {
            warn!("Failed to load currency display config: {}", e);
            None
        }
    };
    let network_config = match state.config_store.load_gated_network_config().await {
        Ok(config) => Some(config),
        Err(e) => {
            warn!("Failed to load network config: {}", e);
            None
        }
    };
    let etl_protocols = state.etl_client.fetch_protocols().await?;
    let etl_currencies = state.etl_client.fetch_currencies().await?;

    let response: Vec<AdminProtocolResponse> = etl_protocols
        .protocols
        .iter()
        .filter(|p| p.is_active)
        .map(|p| {
            let network_configured = network_config
                .as_ref()
                .and_then(|config| {
                    p.network
                        .as_ref()
                        .and_then(|n| config.networks.get(&n.to_uppercase()).map(|s| s.is_configured()))
                })
                .unwrap_or(false);

            let lpn_configured = currency_config
                .as_ref()
                .and_then(|config| {
                    config
                        .currencies
                        .get(&p.lpn_symbol)
                        .map(|c| c.is_configured())
                })
                .unwrap_or(false);

            // Find missing currencies for this protocol
            let protocol_currencies: Vec<&str> = etl_currencies
                .currencies
                .iter()
                .filter(|c| c.is_active)
                .filter(|c| c.protocols.iter().any(|cp| cp.protocol == p.name))
                .map(|c| c.ticker.as_str())
                .collect();

            let missing_currencies: Vec<String> = protocol_currencies
                .iter()
                .filter(|ticker| {
                    !currency_config
                        .as_ref()
                        .and_then(|config| {
                            config
                                .currencies
                                .get(*ticker as &str)
                                .map(|c| c.is_configured())
                        })
                        .unwrap_or(false)
                })
                .map(|s| s.to_string())
                .collect();

            let ready = network_configured && lpn_configured && missing_currencies.is_empty();

            AdminProtocolResponse {
                protocol: p.name.clone(),
                network: p.network.clone().unwrap_or_default(),
                dex: p.dex.clone().unwrap_or_default(),
                lpn: p.lpn_symbol.clone(),
                source: "etl".to_string(),
                status: ProtocolReadinessStatus {
                    network_configured,
                    lpn_configured,
                    missing_currencies,
                    ready,
                },
            }
        })
        .collect();

    Ok(Json(response))
}

/// GET /api/admin/gated/networks
/// List all networks with configuration status
pub async fn list_networks(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<AdminNetworkResponse>>, AppError> {
    debug!("Admin: listing all networks with config status");

    // Load config and ETL data
    let network_config = match state.config_store.load_gated_network_config().await {
        Ok(config) => Some(config),
        Err(e) => {
            warn!("Failed to load network config: {}", e);
            None
        }
    };
    let etl_protocols = state.etl_client.fetch_protocols().await?;

    // Get unique networks from ETL
    let etl_networks: std::collections::HashSet<String> = etl_protocols
        .protocols
        .iter()
        .filter(|p| p.is_active)
        .filter_map(|p| p.network.clone())
        .collect();

    let response: Vec<AdminNetworkResponse> = etl_networks
        .iter()
        .map(|network| {
            let config = network_config
                .as_ref()
                .and_then(|c| c.networks.get(&network.to_uppercase()));

            AdminNetworkResponse {
                network: network.clone(),
                source: "etl".to_string(),
                config: NetworkConfigStatus {
                    name: config.map(|c| c.name.clone()),
                    chain_id: config.map(|c| c.chain_id.clone()),
                    rpc: config.map(|c| c.rpc.clone()),
                    lcd: config.map(|c| c.lcd.clone()),
                    gas_price: config.map(|c| c.gas_price.clone()),
                    primary_protocol: config.and_then(|c| c.primary_protocol.clone()),
                    configured: config.map(|c| c.is_configured()).unwrap_or(false),
                },
            }
        })
        .collect();

    Ok(Json(response))
}

/// GET /api/admin/gated/unconfigured
/// Get summary of all unconfigured items
pub async fn get_unconfigured(
    State(state): State<Arc<AppState>>,
) -> Result<Json<UnconfiguredSummary>, AppError> {
    debug!("Admin: getting unconfigured summary");

    // Load configs
    let currency_config = state
        .config_store
        .load_currency_display()
        .await
        .unwrap_or_else(|_| CurrencyDisplayConfig {
            currencies: std::collections::HashMap::new(),
        });

    let network_config = state
        .config_store
        .load_gated_network_config()
        .await
        .unwrap_or_else(|_| GatedNetworkConfig {
            networks: std::collections::HashMap::new(),
        });

    // Fetch ETL data
    let etl_currencies = state.etl_client.fetch_currencies().await?;
    let etl_protocols = state.etl_client.fetch_protocols().await?;

    let unconfigured_currencies =
        PropagationValidator::get_unconfigured_currencies(&currency_config, &etl_currencies);

    let unconfigured_networks =
        PropagationValidator::get_unconfigured_networks(&network_config, &etl_protocols);

    let unready_protocols = PropagationValidator::get_unready_protocols(
        &currency_config,
        &network_config,
        &etl_protocols,
        &etl_currencies,
    );

    Ok(Json(UnconfiguredSummary {
        currencies: unconfigured_currencies,
        networks: unconfigured_networks,
        protocols: unready_protocols,
    }))
}

// ============================================================================
// Currency Display CRUD
// ============================================================================

/// GET /api/admin/gated/currency-display
/// Get all currency display configs
pub async fn get_currency_display(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CurrencyDisplayConfig>, AppError> {
    let config = state.config_store.load_currency_display().await?;
    Ok(Json(config))
}

/// Trigger async refresh of gated config and dependent caches after admin writes.
/// This ensures changes propagate immediately instead of waiting for the next refresh interval.
fn trigger_gated_refresh(state: &Arc<AppState>) {
    let s = state.clone();
    tokio::spawn(async move {
        crate::refresh::refresh_gated_config(&s).await;
        // Refresh dependents in parallel
        let s2 = s.clone();
        let s3 = s.clone();
        let s4 = s.clone();
        let s5 = s.clone();
        tokio::join!(
            crate::refresh::refresh_filter_context(&s),
            crate::refresh::refresh_gated_assets(&s2),
            crate::refresh::refresh_gated_protocols(&s3),
            crate::refresh::refresh_gated_networks(&s4),
            crate::refresh::refresh_swap_config(&s5),
        );
    });
}

/// PUT /api/admin/gated/currency-display
/// Replace all currency display configs
pub async fn replace_currency_display(
    State(state): State<Arc<AppState>>,
    Json(config): Json<CurrencyDisplayConfig>,
) -> Result<Json<CurrencyDisplayConfig>, AppError> {
    info!("Admin: replacing all currency display configs");
    state.config_store.save_currency_display(&config).await?;
    trigger_gated_refresh(&state);
    Ok(Json(config))
}

/// PUT /api/admin/gated/currency-display/:ticker
/// Upsert a single currency display config
pub async fn upsert_currency_display(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
    Json(input): Json<CurrencyDisplayInput>,
) -> Result<Json<AdminCurrencyResponse>, AppError> {
    info!("Admin: upserting currency display for {}", ticker);

    let mut config = state
        .config_store
        .load_currency_display()
        .await
        .unwrap_or_else(|_| CurrencyDisplayConfig {
            currencies: std::collections::HashMap::new(),
        });

    let display = input.into();
    config.currencies.insert(ticker.clone(), display);

    state.config_store.save_currency_display(&config).await?;
    trigger_gated_refresh(&state);

    // Return the updated entry
    let enrichment = config.currencies.get(&ticker).unwrap();
    Ok(Json(AdminCurrencyResponse {
        ticker: ticker.clone(),
        denom: String::new(), // Would need ETL lookup
        decimals: 0,          // Would need ETL lookup
        source: "config".to_string(),
        enrichment: CurrencyEnrichmentStatus {
            icon: Some(enrichment.icon.clone()),
            display_name: Some(enrichment.display_name.clone()),
            short_name: enrichment.short_name.clone(),
            color: enrichment.color.clone(),
            coingecko_id: enrichment.coingecko_id.clone(),
            configured: enrichment.is_configured(),
        },
    }))
}

/// DELETE /api/admin/gated/currency-display/:ticker
/// Delete a currency display config (hides currency)
pub async fn delete_currency_display(
    State(state): State<Arc<AppState>>,
    Path(ticker): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!("Admin: deleting currency display for {}", ticker);

    let mut config = state.config_store.load_currency_display().await?;

    if config.currencies.remove(&ticker).is_none() {
        return Err(AppError::NotFound {
            resource: format!("Currency display config: {}", ticker),
        });
    }

    state.config_store.save_currency_display(&config).await?;
    trigger_gated_refresh(&state);

    Ok(Json(serde_json::json!({
        "deleted": ticker,
        "message": "Currency will now be hidden from frontend"
    })))
}

// ============================================================================
// Network Config CRUD
// ============================================================================

/// GET /api/admin/gated/network-config
/// Get all network configs
pub async fn get_network_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<GatedNetworkConfig>, AppError> {
    let config = state.config_store.load_gated_network_config().await?;
    Ok(Json(config))
}

/// PUT /api/admin/gated/network-config
/// Replace all network configs
pub async fn replace_network_config(
    State(state): State<Arc<AppState>>,
    Json(config): Json<GatedNetworkConfig>,
) -> Result<Json<GatedNetworkConfig>, AppError> {
    info!("Admin: replacing all network configs");
    state
        .config_store
        .save_gated_network_config(&config)
        .await?;
    Ok(Json(config))
}

/// PUT /api/admin/gated/network-config/:network
/// Upsert a single network config
pub async fn upsert_network_config(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
    Json(input): Json<NetworkSettingsInput>,
) -> Result<Json<AdminNetworkResponse>, AppError> {
    info!("Admin: upserting network config for {}", network);

    let mut config = state
        .config_store
        .load_gated_network_config()
        .await
        .unwrap_or_else(|_| GatedNetworkConfig {
            networks: std::collections::HashMap::new(),
        });

    let settings = input.into();
    config.networks.insert(network.clone(), settings);

    state
        .config_store
        .save_gated_network_config(&config)
        .await?;

    let net_config = config.networks.get(&network).unwrap();
    Ok(Json(AdminNetworkResponse {
        network: network.clone(),
        source: "config".to_string(),
        config: NetworkConfigStatus {
            name: Some(net_config.name.clone()),
            chain_id: Some(net_config.chain_id.clone()),
            rpc: Some(net_config.rpc.clone()),
            lcd: Some(net_config.lcd.clone()),
            gas_price: Some(net_config.gas_price.clone()),
            primary_protocol: net_config.primary_protocol.clone(),
            configured: net_config.is_configured(),
        },
    }))
}

/// DELETE /api/admin/gated/network-config/:network
/// Delete a network config
pub async fn delete_network_config(
    State(state): State<Arc<AppState>>,
    Path(network): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!("Admin: deleting network config for {}", network);

    let mut config = state.config_store.load_gated_network_config().await?;

    if config.networks.remove(&network).is_none() {
        return Err(AppError::NotFound {
            resource: format!("Network config: {}", network),
        });
    }

    state
        .config_store
        .save_gated_network_config(&config)
        .await?;

    Ok(Json(serde_json::json!({
        "deleted": network,
        "message": "Network and its protocols will now be hidden from frontend"
    })))
}

// ============================================================================
// Lease Rules CRUD
// ============================================================================

/// GET /api/admin/gated/lease-rules
/// Get lease rules config
pub async fn get_lease_rules(
    State(state): State<Arc<AppState>>,
) -> Result<Json<LeaseRulesConfig>, AppError> {
    let config = state.config_store.load_lease_rules().await?;
    Ok(Json(config))
}

/// PUT /api/admin/gated/lease-rules
/// Replace all lease rules
pub async fn replace_lease_rules(
    State(state): State<Arc<AppState>>,
    Json(config): Json<LeaseRulesConfig>,
) -> Result<Json<LeaseRulesConfig>, AppError> {
    info!("Admin: replacing all lease rules");
    state.config_store.save_lease_rules(&config).await?;
    trigger_gated_refresh(&state);
    Ok(Json(config))
}

/// PUT /api/admin/gated/lease-rules/downpayment/:protocol
/// Upsert downpayment ranges for a protocol
pub async fn upsert_downpayment_ranges(
    State(state): State<Arc<AppState>>,
    Path(protocol): Path<String>,
    Json(input): Json<DownpaymentRangesInput>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!("Admin: upserting downpayment ranges for {}", protocol);

    let mut config = state.config_store.load_lease_rules().await?;
    config
        .downpayment_ranges
        .insert(protocol.clone(), input.ranges);
    state.config_store.save_lease_rules(&config).await?;
    trigger_gated_refresh(&state);

    Ok(Json(serde_json::json!({
        "protocol": protocol,
        "message": "Downpayment ranges updated"
    })))
}

// ============================================================================
// Swap Settings CRUD
// ============================================================================

/// GET /api/admin/gated/swap-settings
/// Get swap settings config
pub async fn get_swap_settings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<SwapSettingsConfig>, AppError> {
    let config = state.config_store.load_swap_settings().await?;
    Ok(Json(config))
}

/// PUT /api/admin/gated/swap-settings
/// Replace swap settings
pub async fn replace_swap_settings(
    State(state): State<Arc<AppState>>,
    Json(config): Json<SwapSettingsConfig>,
) -> Result<Json<SwapSettingsConfig>, AppError> {
    info!("Admin: replacing swap settings");
    state.config_store.save_swap_settings(&config).await?;
    trigger_gated_refresh(&state);
    Ok(Json(config))
}

// ============================================================================
// UI Settings CRUD
// ============================================================================

/// GET /api/admin/gated/ui-settings
/// Get UI settings config
pub async fn get_ui_settings(
    State(state): State<Arc<AppState>>,
) -> Result<Json<UiSettingsConfig>, AppError> {
    let config = state.config_store.load_ui_settings().await?;
    Ok(Json(config))
}

/// PUT /api/admin/gated/ui-settings
/// Replace UI settings
pub async fn replace_ui_settings(
    State(state): State<Arc<AppState>>,
    Json(config): Json<UiSettingsConfig>,
) -> Result<Json<UiSettingsConfig>, AppError> {
    info!("Admin: replacing UI settings");
    state.config_store.save_ui_settings(&config).await?;
    trigger_gated_refresh(&state);
    Ok(Json(config))
}

/// Hidden proposal input
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiddenProposalInput {
    pub proposal_id: String,
}

/// POST /api/admin/gated/ui-settings/hidden-proposals/:id
/// Add a hidden proposal
pub async fn add_hidden_proposal(
    State(state): State<Arc<AppState>>,
    Path(proposal_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!("Admin: adding hidden proposal {}", proposal_id);

    let mut config = state.config_store.load_ui_settings().await?;

    if !config.hidden_proposals.contains(&proposal_id) {
        config.hidden_proposals.push(proposal_id.clone());
        state.config_store.save_ui_settings(&config).await?;
        trigger_gated_refresh(&state);
    }

    Ok(Json(serde_json::json!({
        "added": proposal_id,
        "hidden_proposals": config.hidden_proposals
    })))
}

/// DELETE /api/admin/gated/ui-settings/hidden-proposals/:id
/// Remove a hidden proposal
pub async fn remove_hidden_proposal(
    State(state): State<Arc<AppState>>,
    Path(proposal_id): Path<String>,
) -> Result<Json<serde_json::Value>, AppError> {
    info!("Admin: removing hidden proposal {}", proposal_id);

    let mut config = state.config_store.load_ui_settings().await?;

    let original_len = config.hidden_proposals.len();
    config.hidden_proposals.retain(|id| id != &proposal_id);

    if config.hidden_proposals.len() == original_len {
        return Err(AppError::NotFound {
            resource: format!("Hidden proposal: {}", proposal_id),
        });
    }

    state.config_store.save_ui_settings(&config).await?;
    trigger_gated_refresh(&state);

    Ok(Json(serde_json::json!({
        "removed": proposal_id,
        "hidden_proposals": config.hidden_proposals
    })))
}
