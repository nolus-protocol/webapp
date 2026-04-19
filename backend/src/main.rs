use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;

use axum::{
    middleware as axum_middleware,
    routing::{delete, get, post},
    Router,
};
use tower_http::{
    compression::CompressionLayer,
    cors::{AllowOrigin, Any, CorsLayer},
    trace::TraceLayer,
};
use tracing::{info, warn};

use crate::middleware::{
    admin_auth_middleware, cache_control_middleware, create_rate_limit_state,
    rate_limit_middleware, standard_rate_limit_config, start_cleanup_task,
    strict_rate_limit_config,
};

pub mod chain_events;
mod config;
mod config_store;
pub mod data_cache;
mod error;
mod external;
mod handlers;
mod http_utils;
mod middleware;
mod propagation;
mod query_types;
pub mod refresh;
mod translations;
mod validation;

#[cfg(test)]
mod test_utils;

use crate::config::{AppConfig, ServerConfig};
use crate::config_store::ConfigStore;
use crate::handlers::websocket::WebSocketManager;
use crate::translations::{
    llm::{LlmClient, LlmConfig},
    TranslationStorage,
};

/// Application state shared across all handlers
pub struct AppState {
    pub config: AppConfig,
    pub etl_client: external::etl::EtlClient,
    pub skip_client: external::skip::SkipClient,
    pub chain_client: external::chain::ChainClient,
    pub referral_client: external::referral::ReferralClient,
    pub zero_interest_client: external::zero_interest::ZeroInterestClient,
    pub data_cache: data_cache::AppDataCache,
    pub ws_manager: WebSocketManager,
    pub config_store: ConfigStore,
    /// Translation storage for locale management
    pub translation_storage: TranslationStorage,
    /// LLM client for AI-powered translations (via OpenRouter)
    pub llm_client: LlmClient,
    /// Server startup time for uptime tracking
    pub startup_time: Instant,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables from .env file
    dotenvy::dotenv().ok();

    // Initialize tracing/logging
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "nolus_backend=debug,tower_http=debug".into()),
        )
        .json()
        .init();

    // Load and validate configuration. Validation enforces invariants like
    // "admin cannot be enabled without an api_key" — failing here prevents the
    // admin_auth middleware's 403 from being the only line of defense against
    // misconfig. We fail fast on errors and log warnings.
    let config = AppConfig::load()?;
    let validation = config.validate();
    for warning in &validation.warnings {
        tracing::warn!("Config warning: {warning}");
    }
    if !validation.is_ok() {
        for err in &validation.errors {
            tracing::error!("Config error: {err}");
        }
        anyhow::bail!(
            "Configuration validation failed with {} error(s); refusing to start",
            validation.errors.len()
        );
    }
    let addr: SocketAddr = format!("{}:{}", config.server.host, config.server.port)
        .parse()
        .expect("Invalid server address");

    // Create HTTP client for external APIs with optimized connection pooling
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(30))
        .pool_max_idle_per_host(32) // Increase from default 10 for better concurrency
        .pool_idle_timeout(std::time::Duration::from_secs(90)) // Keep connections alive longer
        .tcp_keepalive(std::time::Duration::from_secs(60)) // TCP keepalive for long-lived connections
        .build()?;

    // Initialize external API clients
    let etl_client =
        external::etl::EtlClient::new(config.external.etl_api_url.clone(), http_client.clone());

    let skip_client = external::skip::SkipClient::new(
        config.external.skip_api_url.clone(),
        config.external.skip_api_key.clone(),
        http_client.clone(),
    );

    // Initialize chain client for direct blockchain queries
    let chain_client = external::chain::ChainClient::new(
        config.external.nolus_rest_url.clone(),
        http_client.clone(),
    );

    // Initialize data cache (empty — populated by background refresh tasks)
    let data_cache = data_cache::AppDataCache::new();

    // Initialize referral and zero interest clients
    let referral_client = external::referral::ReferralClient::new(&config, http_client.clone());
    let zero_interest_client =
        external::zero_interest::ZeroInterestClient::new(&config, http_client.clone());

    // Initialize WebSocket manager
    let ws_max_connections: usize = std::env::var("WS_MAX_CONNECTIONS")
        .ok()
        .and_then(|v| v.parse().ok())
        .unwrap_or(5000);
    info!("WebSocket max connections: {}", ws_max_connections);
    let ws_manager = WebSocketManager::new(ws_max_connections);

    // Initialize config store for webapp configuration
    let config_dir = std::env::var("CONFIG_DIR").unwrap_or_else(|_| "./config".to_string());
    let config_store = ConfigStore::new(&config_dir);
    config_store.init().await?;

    // Initialize translation storage
    let config_path = std::path::Path::new(&config_dir);
    let translation_storage = TranslationStorage::new(config_path);
    translation_storage.init().await?;

    // Initialize LLM client for translations (via OpenRouter)
    let llm_api_key = std::env::var("OPENROUTER_API_KEY").unwrap_or_default();
    let llm_model = std::env::var("OPENROUTER_MODEL")
        .unwrap_or_else(|_| "google/gemini-3-flash-preview".to_string());
    let llm_client = LlmClient::new(LlmConfig {
        api_key: llm_api_key,
        model: llm_model,
        base_url: None,
    });

    // Create shared application state
    let state = Arc::new(AppState {
        config,
        etl_client,
        skip_client,
        chain_client,
        referral_client,
        zero_interest_client,
        data_cache,
        ws_manager,
        config_store,
        translation_storage,
        llm_client,
        startup_time: Instant::now(),
    });

    // Warm up essential caches before accepting requests (blocking)
    refresh::warm_essential_data(state.clone()).await;

    // Populate LPP addresses from protocol contracts for earn event filtering
    if let Some(contracts) = state.data_cache.protocol_contracts.load() {
        state.ws_manager.refresh_lpp_addresses(&contracts);
    }

    // Create event channels for CometBFT WebSocket events
    let event_channels = chain_events::EventChannels::new();

    // Start CometBFT WebSocket client (connects, subscribes, dispatches events)
    chain_events::start(&state.config.external.nolus_rpc_url, event_channels.clone());

    // Start background refresh tasks (prices: event-driven, others: timer-driven)
    refresh::start_all(state.clone(), &event_channels);

    // Start WebSocket background tasks (lease/earn/prices: event-driven, skip: timer)
    handlers::websocket::start_price_update_task(
        state.clone(),
        event_channels.new_block.subscribe(),
    )
    .await;
    handlers::websocket::start_lease_monitor_task(
        state.clone(),
        event_channels.contract_exec.subscribe(),
    )
    .await;
    handlers::websocket::start_skip_tracking_task(state.clone()).await;
    handlers::websocket::start_earn_monitor_task(
        state.clone(),
        event_channels.contract_exec.subscribe(),
    )
    .await;
    handlers::websocket::start_stale_connection_reaper(state.clone()).await;

    // Build router
    let app = create_router(state);

    // Start server
    info!("Starting server on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app)
        .with_graceful_shutdown(shutdown_signal())
        .await?;
    info!("Server shut down gracefully");

    Ok(())
}

async fn shutdown_signal() {
    let ctrl_c = tokio::signal::ctrl_c();
    let mut sigterm = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("failed to install SIGTERM handler");

    tokio::select! {
        _ = ctrl_c => { info!("Received SIGINT, shutting down"); }
        _ = sigterm.recv() => { info!("Received SIGTERM, shutting down"); }
    }
}

/// Build the CORS layer from server config, emitting startup warnings for
/// common misconfigurations:
/// - `cors_origins = None`         → allow-all (public API default) + warn
/// - `cors_origins = Some(vec![])` → block all cross-origin requests + warn
/// - `cors_origins = Some(list)`   → allow listed origins; warn per malformed entry
fn build_cors_layer(server: &ServerConfig) -> CorsLayer {
    match &server.cors_origins {
        None => {
            warn!(
                "CORS_ORIGINS not configured — allowing all origins. \
                 Set CORS_ORIGINS in production."
            );
            CorsLayer::new()
                .allow_origin(Any)
                .allow_methods(Any)
                .allow_headers(Any)
        }
        Some(origins) if origins.is_empty() => {
            warn!("CORS_ORIGINS is set but empty — all cross-origin requests will be blocked");
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(Vec::<axum::http::HeaderValue>::new()))
                .allow_methods(Any)
                .allow_headers(Any)
        }
        Some(origins) => {
            let mut header_values: Vec<axum::http::HeaderValue> = Vec::with_capacity(origins.len());
            for origin in origins {
                match origin.parse::<axum::http::HeaderValue>() {
                    Ok(hv) => header_values.push(hv),
                    Err(_) => warn!("Dropping malformed CORS origin: {origin}"),
                }
            }
            CorsLayer::new()
                .allow_origin(AllowOrigin::list(header_values))
                .allow_methods(Any)
                .allow_headers(Any)
        }
    }
}

fn create_router(state: Arc<AppState>) -> Router {
    // CORS configuration
    let cors = build_cors_layer(&state.config.server);

    // Rate limiting configuration
    let standard_rate_limit = create_rate_limit_state(standard_rate_limit_config());
    let strict_rate_limit = create_rate_limit_state(strict_rate_limit_config());

    // Start periodic cleanup of stale rate limiter entries
    start_cleanup_task(standard_rate_limit.clone());
    start_cleanup_task(strict_rate_limit.clone());

    // ETL proxy routes
    // Specialized handlers for enriched/batch/POST endpoints; generic catch-all for passthrough
    let etl_routes = Router::new()
        // Enriched transactions (protobuf decoding + caching)
        .route(
            "/txs",
            get(handlers::transactions::get_enriched_transactions),
        )
        // POST endpoint
        .route("/subscribe", post(handlers::etl_proxy::proxy_subscribe))
        // Batch endpoints (parallel fetching + aggregation)
        .route(
            "/batch/stats-overview",
            get(handlers::etl_proxy::batch_stats_overview),
        )
        .route(
            "/batch/loans-stats",
            get(handlers::etl_proxy::batch_loans_stats),
        )
        .route(
            "/batch/user-dashboard",
            get(handlers::etl_proxy::batch_user_dashboard),
        )
        .route(
            "/batch/user-history",
            get(handlers::etl_proxy::batch_user_history),
        )
        // Generic passthrough for all other ETL endpoints (allowlist-gated)
        .route("/{path}", get(handlers::etl_proxy::etl_proxy_generic));

    // Health check routes (no rate limiting - used by monitoring/health checks)
    let health_routes = Router::new()
        .route("/health", get(handlers::admin::health_check))
        .route(
            "/health/detailed",
            get(handlers::admin::detailed_health_check),
        );

    // OpenAPI spec routes (no rate limiting - static spec, unauthenticated)
    // Admin endpoints are intentionally omitted from the spec.
    let openapi_routes =
        Router::new().route("/openapi.json", get(handlers::openapi::serve_openapi));

    // Read-only API routes (standard rate limit)
    let read_routes = Router::new()
        // Configuration
        .route("/config", get(handlers::config::get_config))
        .route("/config/protocols", get(handlers::config::get_protocols))
        .route("/config/networks", get(handlers::config::get_networks))
        // Locales
        .route("/locales/{lang}", get(handlers::locales::get_locale))
        // Protocols (ETL-based, includes active and deprecated)
        .route("/protocols", get(handlers::protocols::get_protocols))
        .route(
            "/protocols/active",
            get(handlers::protocols::get_active_protocols),
        )
        // Currencies & Prices
        .route("/currencies", get(handlers::currencies::get_currencies))
        .route("/currencies/{key}", get(handlers::currencies::get_currency))
        .route("/prices", get(handlers::currencies::get_prices))
        .route("/balances", get(handlers::currencies::get_balances))
        // Leases (read)
        .route("/leases", get(handlers::leases::get_leases))
        .route(
            "/leases/config/{protocol}",
            get(handlers::leases::get_lease_config),
        )
        .route("/leases/{address}", get(handlers::leases::get_lease))
        .route(
            "/leases/{address}/history",
            get(handlers::leases::get_lease_history),
        )
        // Earn (read)
        .route("/earn/pools", get(handlers::earn::get_pools))
        .route("/earn/pools/{pool_id}", get(handlers::earn::get_pool))
        .route("/earn/positions", get(handlers::earn::get_positions))
        .route("/earn/stats", get(handlers::earn::get_earn_stats))
        // Staking (read)
        .route(
            "/staking/validators",
            get(handlers::staking::get_validators),
        )
        .route(
            "/staking/validators/{address}",
            get(handlers::staking::get_validator),
        )
        .route("/staking/positions", get(handlers::staking::get_positions))
        .route(
            "/staking/params",
            get(handlers::staking::get_staking_params),
        )
        // Swap (read)
        .route("/swap/config", get(handlers::swap::get_swap_config))
        .route("/swap/status/{tx_hash}", get(handlers::swap::get_status))
        .route("/swap/chains", get(handlers::swap::get_chains))
        // Referral (read)
        .route(
            "/referral/validate/{code}",
            get(handlers::referral::validate_code),
        )
        .route(
            "/referral/stats/{address}",
            get(handlers::referral::get_stats),
        )
        .route(
            "/referral/rewards/{address}",
            get(handlers::referral::get_rewards),
        )
        .route(
            "/referral/payouts/{address}",
            get(handlers::referral::get_payouts),
        )
        .route(
            "/referral/referrals/{address}",
            get(handlers::referral::get_referrals),
        )
        // Zero Interest (read)
        .route(
            "/zero-interest/config",
            get(handlers::zero_interest::get_config),
        )
        .route(
            "/zero-interest/eligibility",
            get(handlers::zero_interest::check_eligibility),
        )
        .route(
            "/zero-interest/payments/by-owner/{owner}",
            get(handlers::zero_interest::get_payments),
        )
        .route(
            "/zero-interest/lease/{lease_address}/payments",
            get(handlers::zero_interest::get_lease_payments),
        )
        // Campaigns (zero-interest campaigns from payments manager)
        .route(
            "/campaigns/active",
            get(handlers::zero_interest::get_active_campaigns),
        )
        .route(
            "/campaigns/eligibility",
            get(handlers::zero_interest::check_campaign_eligibility),
        )
        // Governance (read)
        .route(
            "/governance/hidden-proposals",
            get(handlers::governance::get_hidden_proposals),
        )
        .route(
            "/governance/proposals",
            get(handlers::governance::get_proposals),
        )
        .route(
            "/governance/proposals/{proposal_id}/tally",
            get(handlers::governance::get_proposal_tally),
        )
        .route(
            "/governance/proposals/{proposal_id}/votes/{voter}",
            get(handlers::governance::get_proposal_vote),
        )
        .route(
            "/governance/params/tallying",
            get(handlers::governance::get_tallying_params),
        )
        .route(
            "/governance/staking-pool",
            get(handlers::governance::get_staking_pool),
        )
        .route("/governance/apr", get(handlers::governance::get_apr))
        .route(
            "/governance/accounts/{address}",
            get(handlers::governance::get_account),
        )
        .route(
            "/governance/denoms/{denom}",
            get(handlers::governance::get_denom_metadata),
        )
        .route("/node/info", get(handlers::governance::get_node_info))
        .route(
            "/node/status",
            get(handlers::governance::get_network_status),
        )
        // Fees
        .route("/fees/gas-config", get(handlers::fees::get_gas_fee_config))
        // Gated Propagation API - Assets (deduplicated view)
        .route("/assets", get(handlers::gated_assets::get_assets))
        .route("/assets/{ticker}", get(handlers::gated_assets::get_asset))
        // Gated Propagation API - Protocols
        .route(
            "/protocols/gated",
            get(handlers::gated_protocols::get_protocols),
        )
        .route(
            "/protocols/{protocol}/currencies",
            get(handlers::gated_protocols::get_protocol_currencies),
        )
        // Gated Propagation API - Networks
        .route(
            "/networks/gated",
            get(handlers::gated_networks::get_networks),
        )
        .route(
            "/networks/{network}/info",
            get(handlers::gated_networks::get_network),
        )
        .route(
            "/networks/{network}/assets",
            get(handlers::gated_assets::get_network_assets),
        )
        .route(
            "/networks/{network}/protocols",
            get(handlers::gated_protocols::get_network_protocols),
        )
        .route(
            "/networks/{network}/pools",
            get(handlers::gated_networks::get_network_pools),
        )
        .layer(axum_middleware::from_fn(move |req, next| {
            let state = standard_rate_limit.clone();
            async move { rate_limit_middleware(state, None, req, next).await }
        }));

    // Write API routes (strict rate limit)
    let write_routes = Router::new()
        // Leases (write)
        .route("/leases/quote", post(handlers::leases::get_lease_quote))
        .route("/leases/open", post(handlers::leases::open_lease))
        .route("/leases/repay", post(handlers::leases::repay_lease))
        .route("/leases/close", post(handlers::leases::close_lease))
        .route(
            "/leases/market-close",
            post(handlers::leases::market_close_lease),
        )
        // Earn (write)
        .route("/earn/deposit", post(handlers::earn::deposit))
        .route("/earn/withdraw", post(handlers::earn::withdraw))
        // Staking (write)
        .route("/staking/delegate", post(handlers::staking::delegate))
        .route("/staking/undelegate", post(handlers::staking::undelegate))
        .route("/staking/redelegate", post(handlers::staking::redelegate))
        .route(
            "/staking/claim-rewards",
            post(handlers::staking::claim_rewards),
        )
        // Swap (write)
        .route("/swap/track", post(handlers::swap::track_transaction))
        .route("/swap/route", post(handlers::swap::get_route))
        .route("/swap/messages", post(handlers::swap::get_messages))
        // Referral (write)
        .route("/referral/register", post(handlers::referral::register))
        .route("/referral/assign", post(handlers::referral::assign))
        // Zero Interest (write)
        .route(
            "/zero-interest/payments",
            post(handlers::zero_interest::create_payment),
        )
        .route(
            "/zero-interest/payments/{payment_id}",
            delete(handlers::zero_interest::cancel_payment),
        )
        // Intercom
        .route("/intercom/hash", post(handlers::admin::intercom_hash))
        .layer(axum_middleware::from_fn(move |req, next| {
            let state = strict_rate_limit.clone();
            async move { rate_limit_middleware(state, None, req, next).await }
        }));

    // Admin routes (protected with authentication middleware)
    let admin_routes = Router::new()
        .route("/cache/stats", get(handlers::admin::get_cache_stats))
        .route("/cache/invalidate", post(handlers::admin::invalidate_cache))
        // Translation Management
        .route(
            "/translations/sync",
            post(handlers::translations::sync_translations),
        )
        .route(
            "/translations/missing",
            get(handlers::translations::list_missing),
        )
        .route(
            "/translations/generate",
            post(handlers::translations::generate_translations),
        )
        .route(
            "/translations/pending",
            get(handlers::translations::list_pending),
        )
        .route(
            "/translations/pending/{id}",
            get(handlers::translations::get_pending),
        )
        .route(
            "/translations/pending/{id}/approve",
            post(handlers::translations::approve_pending),
        )
        .route(
            "/translations/pending/{id}/reject",
            post(handlers::translations::reject_pending),
        )
        .route(
            "/translations/pending/{id}/edit",
            post(handlers::translations::edit_pending),
        )
        .route(
            "/translations/pending/approve-batch",
            post(handlers::translations::approve_batch),
        )
        .route(
            "/translations/active",
            get(handlers::translations::get_active),
        )
        .route(
            "/translations/active/{lang}/{key}",
            axum::routing::put(handlers::translations::update_active),
        )
        .route(
            "/translations/languages",
            get(handlers::translations::list_languages),
        )
        .route(
            "/translations/languages",
            post(handlers::translations::add_language),
        )
        .route(
            "/translations/audit",
            get(handlers::translations::get_audit_log),
        )
        .route(
            "/translations/key-history/{lang}/{key}",
            get(handlers::translations::get_key_history),
        )
        // Gated Propagation Admin - Discovery
        .route(
            "/gated/currencies",
            get(handlers::gated_admin::list_currencies),
        )
        .route(
            "/gated/protocols",
            get(handlers::gated_admin::list_protocols),
        )
        .route("/gated/networks", get(handlers::gated_admin::list_networks))
        .route(
            "/gated/unconfigured",
            get(handlers::gated_admin::get_unconfigured),
        )
        // Gated Propagation Admin - Currency Display CRUD
        .route(
            "/gated/currency-display",
            get(handlers::gated_admin::get_currency_display),
        )
        .route(
            "/gated/currency-display",
            axum::routing::put(handlers::gated_admin::replace_currency_display),
        )
        .route(
            "/gated/currency-display/{ticker}",
            axum::routing::put(handlers::gated_admin::upsert_currency_display),
        )
        .route(
            "/gated/currency-display/{ticker}",
            delete(handlers::gated_admin::delete_currency_display),
        )
        // Gated Propagation Admin - Network Config CRUD
        .route(
            "/gated/network-config",
            get(handlers::gated_admin::get_network_config),
        )
        .route(
            "/gated/network-config",
            axum::routing::put(handlers::gated_admin::replace_network_config),
        )
        .route(
            "/gated/network-config/{network}",
            axum::routing::put(handlers::gated_admin::upsert_network_config),
        )
        .route(
            "/gated/network-config/{network}",
            delete(handlers::gated_admin::delete_network_config),
        )
        // Gated Propagation Admin - Lease Rules CRUD
        .route(
            "/gated/lease-rules",
            get(handlers::gated_admin::get_lease_rules),
        )
        .route(
            "/gated/lease-rules",
            axum::routing::put(handlers::gated_admin::replace_lease_rules),
        )
        .route(
            "/gated/lease-rules/downpayment/{protocol}",
            axum::routing::put(handlers::gated_admin::upsert_downpayment_ranges),
        )
        // Gated Propagation Admin - Swap Settings CRUD
        .route(
            "/gated/swap-settings",
            get(handlers::gated_admin::get_swap_settings),
        )
        .route(
            "/gated/swap-settings",
            axum::routing::put(handlers::gated_admin::replace_swap_settings),
        )
        // Gated Propagation Admin - UI Settings CRUD
        .route(
            "/gated/ui-settings",
            get(handlers::gated_admin::get_ui_settings),
        )
        .route(
            "/gated/ui-settings",
            axum::routing::put(handlers::gated_admin::replace_ui_settings),
        )
        .route(
            "/gated/ui-settings/hidden-proposals/{id}",
            post(handlers::gated_admin::add_hidden_proposal),
        )
        .route(
            "/gated/ui-settings/hidden-proposals/{id}",
            delete(handlers::gated_admin::remove_hidden_proposal),
        )
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            admin_auth_middleware,
        ));

    // WebSocket route (no rate limiting - has its own connection management)
    let ws_routes = Router::new().route("/", get(handlers::websocket::websocket_handler));

    // Static file serving for the frontend SPA
    // Serves files from ../dist (relative to backend directory)
    // Falls back to index.html for SPA routing with 200 OK status
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../dist".to_string());
    let index_path = format!("{}/index.html", static_dir);

    if !std::path::Path::new(&index_path).exists() {
        warn!(
            "Static directory '{}' or index.html not found. SPA routes will return 404.",
            static_dir
        );
    }

    // Create SPA fallback that serves index.html with 200 OK for client-side routes
    let spa_fallback = handlers::spa::create_spa_fallback(static_dir.clone(), index_path);

    // Combine all routes
    // API routes take precedence, then static files
    Router::new()
        .nest(
            "/api",
            health_routes
                .merge(openapi_routes)
                .merge(read_routes)
                .merge(write_routes),
        )
        .nest("/api/etl", etl_routes)
        .nest("/api/admin", admin_routes)
        .nest("/ws", ws_routes)
        .fallback_service(spa_fallback)
        .layer(axum_middleware::from_fn(cache_control_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state)
}

#[cfg(test)]
mod cors_tests {
    //! Tests for `build_cors_layer`.
    //!
    //! These tests mount the built `CorsLayer` on a minimal router and fire
    //! real HTTP requests via `tower::ServiceExt::oneshot`. They assert on
    //! the `Access-Control-Allow-Origin` response header set by the layer —
    //! which is the contract visible to clients.
    //!
    //! The startup warnings themselves are plain `tracing::warn!` calls and
    //! are validated by inspection of `build_cors_layer` (no log-capture
    //! infrastructure is worth wiring up for one-line tracing statements).
    use super::*;
    use crate::config::ServerConfig;
    use axum::body::Body;
    use axum::http::{header, HeaderValue, Method, Request, StatusCode};
    use axum::routing::get;
    use tower::ServiceExt;

    fn server_config_with(cors: Option<Vec<String>>) -> ServerConfig {
        ServerConfig {
            host: "127.0.0.1".to_string(),
            port: 0,
            cors_origins: cors,
        }
    }

    fn router_with_cors(server: &ServerConfig) -> Router {
        Router::new()
            .route("/", get(|| async { "ok" }))
            .layer(build_cors_layer(server))
    }

    fn preflight(origin: &str, method: &str) -> Request<Body> {
        Request::builder()
            .method(Method::OPTIONS)
            .uri("/")
            .header(header::ORIGIN, origin)
            .header(header::ACCESS_CONTROL_REQUEST_METHOD, method)
            .body(Body::empty())
            .expect("build preflight request")
    }

    fn simple_get(origin: &str) -> Request<Body> {
        Request::builder()
            .method(Method::GET)
            .uri("/")
            .header(header::ORIGIN, origin)
            .body(Body::empty())
            .expect("build simple GET")
    }

    #[tokio::test]
    async fn cors_layer_allows_listed_origin_in_response_headers() {
        let server = server_config_with(Some(vec!["https://app.nolus.io".to_string()]));
        let app = router_with_cors(&server);

        let resp = app
            .oneshot(simple_get("https://app.nolus.io"))
            .await
            .expect("service oneshot");

        assert_eq!(resp.status(), StatusCode::OK);
        let allow_origin = resp
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .expect("allow-origin header present for listed origin");
        assert_eq!(
            allow_origin,
            &HeaderValue::from_static("https://app.nolus.io")
        );
    }

    #[tokio::test]
    async fn cors_layer_rejects_unlisted_origin() {
        let server = server_config_with(Some(vec!["https://app.nolus.io".to_string()]));
        let app = router_with_cors(&server);

        let resp = app
            .oneshot(simple_get("https://evil.com"))
            .await
            .expect("service oneshot");

        // tower-http CorsLayer strategy: for unlisted origins, no
        // Access-Control-Allow-Origin header is emitted, so the browser's
        // same-origin policy rejects the response.
        let allow_origin = resp.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN);
        assert_ne!(
            allow_origin,
            Some(&HeaderValue::from_static("https://evil.com")),
            "evil.com must not appear in allow-origin header"
        );
    }

    #[tokio::test]
    async fn cors_layer_handles_preflight_options_request() {
        let server = server_config_with(Some(vec!["https://app.nolus.io".to_string()]));
        let app = router_with_cors(&server);

        let resp = app
            .oneshot(preflight("https://app.nolus.io", "POST"))
            .await
            .expect("service oneshot");

        // tower-http returns 200 OK for preflight by default.
        assert!(
            resp.status() == StatusCode::OK || resp.status() == StatusCode::NO_CONTENT,
            "preflight should be 200 or 204, got {}",
            resp.status()
        );
        assert!(
            resp.headers()
                .contains_key(header::ACCESS_CONTROL_ALLOW_METHODS),
            "preflight response must include Access-Control-Allow-Methods"
        );
    }

    /// Documents the allow-all default: when `CORS_ORIGINS` is unset, every
    /// origin is allowed. This is the intended default for a public Nolus
    /// API, and a production warning (`tracing::warn!`) fires at startup to
    /// nudge operators to lock it down.
    #[tokio::test]
    async fn cors_layer_allows_any_when_unconfigured_documented() {
        let server = server_config_with(None);
        let app = router_with_cors(&server);

        let resp = app
            .oneshot(simple_get("https://literally-anywhere.example"))
            .await
            .expect("service oneshot");

        assert_eq!(resp.status(), StatusCode::OK);
        let allow_origin = resp
            .headers()
            .get(header::ACCESS_CONTROL_ALLOW_ORIGIN)
            .expect("allow-origin present when cors_origins=None");
        // `Any` serializes to the wildcard "*".
        assert_eq!(allow_origin, &HeaderValue::from_static("*"));
    }

    /// Documents F7: `CORS_ORIGINS=""` (empty vec) blocks every
    /// cross-origin request. The startup warning in `build_cors_layer`
    /// surfaces this to operators; the HTTP-level assertion here confirms
    /// the layer actually emits no allow-origin header for any caller.
    #[tokio::test]
    async fn cors_layer_empty_vec_blocks_cross_origin_requests() {
        let server = server_config_with(Some(vec![]));
        let app = router_with_cors(&server);

        for origin in [
            "https://app.nolus.io",
            "https://evil.com",
            "http://localhost:5173",
        ] {
            let resp = app
                .clone()
                .oneshot(simple_get(origin))
                .await
                .expect("service oneshot");

            let allow_origin = resp.headers().get(header::ACCESS_CONTROL_ALLOW_ORIGIN);
            assert!(
                allow_origin.is_none(),
                "origin {origin} must not be allowed when cors_origins is empty, got {allow_origin:?}"
            );
        }
    }
}
