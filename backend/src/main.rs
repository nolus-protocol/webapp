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
    cors::{Any, CorsLayer},
    services::{ServeDir, ServeFile},
    trace::TraceLayer,
};
use tracing::{info, warn};

use crate::middleware::{
    admin_auth_middleware, cache_control_middleware, create_rate_limit_state,
    rate_limit_middleware, standard_rate_limit_config, strict_rate_limit_config,
};

mod cache;
mod cache_keys;
mod config;
mod config_store;
mod error;
mod etl_macros;
mod external;
mod handlers;
mod http_utils;
mod middleware;
mod models;
mod query_types;
mod response_types;
mod translations;

#[cfg(test)]
mod test_utils;

use crate::config::AppConfig;
use crate::config_store::ConfigStore;
use crate::handlers::websocket::WebSocketManager;
use crate::translations::{
    openai::{OpenAIClient, OpenAIConfig},
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
    pub cache: cache::AppCache,
    pub ws_manager: WebSocketManager,
    pub config_store: ConfigStore,
    /// Translation storage for locale management
    pub translation_storage: TranslationStorage,
    /// OpenAI client for AI-powered translations
    pub openai_client: OpenAIClient,
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

    // Load configuration
    let config = AppConfig::load()?;
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

    // Initialize cache
    let cache = cache::AppCache::new(&config.cache);

    // Initialize referral and zero interest clients
    let referral_client = external::referral::ReferralClient::new(&config);
    let zero_interest_client = external::zero_interest::ZeroInterestClient::new(&config);

    // Initialize WebSocket manager
    let ws_manager = WebSocketManager::new();

    // Initialize config store for webapp configuration
    let config_dir = std::env::var("CONFIG_DIR").unwrap_or_else(|_| "./config".to_string());
    let config_store = ConfigStore::new(&config_dir);
    config_store.init().await?;

    // Initialize translation storage
    let config_path = std::path::Path::new(&config_dir);
    let translation_storage = TranslationStorage::new(config_path);
    translation_storage.init().await?;

    // Initialize OpenAI client for translations
    let openai_api_key = std::env::var("OPENAI_API_KEY").unwrap_or_default();
    let openai_model = std::env::var("OPENAI_MODEL").unwrap_or_else(|_| "gpt-4o-mini".to_string());
    let openai_client = OpenAIClient::new(OpenAIConfig {
        api_key: openai_api_key,
        model: openai_model,
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
        cache,
        ws_manager,
        config_store,
        translation_storage,
        openai_client,
        startup_time: Instant::now(),
    });

    // Start WebSocket background tasks
    handlers::websocket::start_price_update_task(state.clone()).await;
    handlers::websocket::start_lease_monitor_task(state.clone()).await;
    handlers::websocket::start_skip_tracking_task(state.clone()).await;
    handlers::websocket::start_earn_monitor_task(state.clone()).await;

    // Warm up caches in background (non-blocking)
    warm_caches(state.clone());

    // Build router
    let app = create_router(state);

    // Start server
    info!("Starting server on {}", addr);
    let listener = tokio::net::TcpListener::bind(addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}

/// Warm up caches in the background to reduce cold start latency
fn warm_caches(state: Arc<AppState>) {
    tokio::spawn(async move {
        info!("Starting cache warm-up...");

        let admin_address = &state.config.protocols.admin_contract;

        // Warm up protocols/config cache
        let protocols_result = state.chain_client.get_admin_protocols(admin_address).await;
        match &protocols_result {
            Ok(protocols) => {
                info!("Cache warm-up: Loaded {} protocols", protocols.len());

                // Warm up prices for first protocol (most common)
                if let Some(protocol) = protocols.first() {
                    if let Ok(protocol_info) = state
                        .chain_client
                        .get_admin_protocol(admin_address, protocol)
                        .await
                    {
                        match state
                            .chain_client
                            .get_oracle_prices(&protocol_info.contracts.oracle)
                            .await
                        {
                            Ok(prices) => {
                                info!("Cache warm-up: Loaded {} prices", prices.prices.len());
                            }
                            Err(e) => {
                                warn!("Cache warm-up: Failed to load prices: {}", e);
                            }
                        }
                    }
                }
            }
            Err(e) => {
                warn!("Cache warm-up: Failed to load protocols: {}", e);
            }
        }

        // Warm up earn pools from ETL
        match state.etl_client.fetch_pools().await {
            Ok(pools) => {
                info!("Cache warm-up: Loaded {} earn pools", pools.len());
            }
            Err(e) => {
                warn!("Cache warm-up: Failed to load earn pools: {}", e);
            }
        }

        info!("Cache warm-up complete");
    });
}

fn create_router(state: Arc<AppState>) -> Router {
    // CORS configuration
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Rate limiting configuration
    let standard_rate_limit = create_rate_limit_state(standard_rate_limit_config());
    let strict_rate_limit = create_rate_limit_state(strict_rate_limit_config());

    // ETL proxy routes
    let etl_routes = Router::new()
        .route("/pools", get(handlers::etl_proxy::proxy_pools))
        .route("/ls-opening", get(handlers::etl_proxy::proxy_lease_opening))
        .route("/prices", get(handlers::etl_proxy::proxy_price_series))
        .route(
            "/pnl-over-time",
            get(handlers::etl_proxy::proxy_pnl_over_time),
        )
        .route("/total-value-locked", get(handlers::etl_proxy::proxy_tvl))
        .route("/total-tx-value", get(handlers::etl_proxy::proxy_tx_volume))
        .route(
            "/leases-monthly",
            get(handlers::etl_proxy::proxy_leases_monthly),
        )
        .route("/ls-loan-closing", get(handlers::etl_proxy::proxy_pnl))
        .route(
            "/open-position-value",
            get(handlers::etl_proxy::proxy_open_position_value),
        )
        .route(
            "/open-interest",
            get(handlers::etl_proxy::proxy_open_interest),
        )
        .route(
            "/unrealized-pnl",
            get(handlers::etl_proxy::proxy_unrealized_pnl),
        )
        .route(
            "/position-debt-value",
            get(handlers::etl_proxy::proxy_position_debt_value),
        )
        .route(
            "/realized-pnl",
            get(handlers::etl_proxy::proxy_realized_pnl),
        )
        .route(
            "/realized-pnl-data",
            get(handlers::etl_proxy::proxy_realized_pnl_data),
        )
        .route(
            "/realized-pnl-stats",
            get(handlers::etl_proxy::proxy_realized_pnl_stats),
        )
        .route(
            "/supplied-funds",
            get(handlers::etl_proxy::proxy_supplied_funds),
        )
        .route(
            "/supplied-borrowed-history",
            get(handlers::etl_proxy::proxy_time_series),
        )
        .route("/earnings", get(handlers::etl_proxy::proxy_earnings))
        .route("/lp-withdraw", get(handlers::etl_proxy::proxy_lp_withdraw))
        .route("/txs", get(handlers::etl_proxy::proxy_txs))
        .route(
            "/leases-search",
            get(handlers::etl_proxy::proxy_leases_search),
        )
        .route(
            "/leased-assets",
            get(handlers::etl_proxy::proxy_leased_assets),
        )
        .route(
            "/buyback-total",
            get(handlers::etl_proxy::proxy_buyback_total),
        )
        .route("/revenue", get(handlers::etl_proxy::proxy_revenue))
        .route(
            "/history-stats",
            get(handlers::etl_proxy::proxy_history_stats),
        )
        .route("/subscribe", post(handlers::etl_proxy::proxy_subscribe))
        // Batch endpoints - fetch multiple resources in parallel
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
        );

    // Read-only API routes (standard rate limit)
    let read_routes = Router::new()
        // Health check
        .route("/health", get(handlers::admin::health_check))
        .route(
            "/health/detailed",
            get(handlers::admin::detailed_health_check),
        )
        // Configuration
        .route("/config", get(handlers::config::get_config))
        .route("/config/protocols", get(handlers::config::get_protocols))
        .route("/config/networks", get(handlers::config::get_networks))
        // Currencies & Prices
        .route("/currencies", get(handlers::currencies::get_currencies))
        .route("/currencies/{key}", get(handlers::currencies::get_currency))
        .route("/prices", get(handlers::currencies::get_prices))
        .route("/balances", get(handlers::currencies::get_balances))
        // Leases (read)
        .route("/leases", get(handlers::leases::get_leases))
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
        .route("/swap/quote", get(handlers::swap::get_quote))
        .route("/swap/status/{tx_hash}", get(handlers::swap::get_status))
        .route("/swap/history", get(handlers::swap::get_history))
        .route(
            "/swap/supported-pairs",
            get(handlers::swap::get_supported_pairs),
        )
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
        // Webapp Config (read)
        .route(
            "/webapp/config",
            get(handlers::webapp_config::get_full_config),
        )
        .route(
            "/webapp/config/currencies",
            get(handlers::webapp_config::get_currencies),
        )
        .route(
            "/webapp/config/chain-ids",
            get(handlers::webapp_config::get_chain_ids),
        )
        .route(
            "/webapp/config/networks",
            get(handlers::webapp_config::get_networks),
        )
        .route(
            "/webapp/config/history-currencies",
            get(handlers::webapp_config::get_history_currencies),
        )
        .route(
            "/webapp/config/history-protocols",
            get(handlers::webapp_config::get_history_protocols),
        )
        .route(
            "/webapp/config/endpoints",
            get(handlers::webapp_config::get_all_endpoints),
        )
        .route(
            "/webapp/config/endpoints/{network}",
            get(handlers::webapp_config::get_endpoints),
        )
        .route(
            "/webapp/config/lease/downpayment-ranges",
            get(handlers::webapp_config::get_downpayment_ranges),
        )
        .route(
            "/webapp/config/lease/downpayment-ranges/{protocol}",
            get(handlers::webapp_config::get_downpayment_range_for_protocol),
        )
        .route(
            "/webapp/config/lease/ignore-assets",
            get(handlers::webapp_config::get_ignore_assets),
        )
        .route(
            "/webapp/config/lease/ignore-lease-long",
            get(handlers::webapp_config::get_ignore_lease_long),
        )
        .route(
            "/webapp/config/lease/ignore-lease-short",
            get(handlers::webapp_config::get_ignore_lease_short),
        )
        .route(
            "/webapp/config/lease/free-interest",
            get(handlers::webapp_config::get_free_interest_assets),
        )
        .route(
            "/webapp/config/lease/due-projection",
            get(handlers::webapp_config::get_due_projection),
        )
        .route(
            "/webapp/config/zero-interest/addresses",
            get(handlers::webapp_config::get_zero_interest_addresses),
        )
        .route(
            "/webapp/config/swap/skip-route",
            get(handlers::webapp_config::get_skip_route_config),
        )
        .route(
            "/webapp/config/governance/hidden-proposals",
            get(handlers::webapp_config::get_hidden_proposals),
        )
        .route(
            "/webapp/locales",
            get(handlers::webapp_config::list_locales),
        )
        .route(
            "/webapp/locales/{lang}",
            get(handlers::webapp_config::get_locale),
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
        .route("/swap/execute", post(handlers::swap::execute_swap))
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
        // Webapp Config Admin (write)
        .route(
            "/webapp/config/currencies",
            axum::routing::put(handlers::admin_config::update_currencies),
        )
        .route(
            "/webapp/config/chain-ids",
            axum::routing::put(handlers::admin_config::update_chain_ids),
        )
        .route(
            "/webapp/config/networks",
            axum::routing::put(handlers::admin_config::update_networks),
        )
        .route(
            "/webapp/config/endpoints/{network}",
            axum::routing::put(handlers::admin_config::update_endpoints),
        )
        .route(
            "/webapp/config/lease/downpayment-ranges",
            axum::routing::put(handlers::admin_config::update_downpayment_ranges),
        )
        .route(
            "/webapp/config/lease/ignore-assets",
            axum::routing::put(handlers::admin_config::update_ignore_assets),
        )
        .route(
            "/webapp/config/lease/ignore-lease-long",
            axum::routing::put(handlers::admin_config::update_ignore_lease_long),
        )
        .route(
            "/webapp/config/lease/ignore-lease-short",
            axum::routing::put(handlers::admin_config::update_ignore_lease_short),
        )
        .route(
            "/webapp/config/lease/free-interest",
            axum::routing::put(handlers::admin_config::update_free_interest_assets),
        )
        .route(
            "/webapp/config/lease/due-projection",
            axum::routing::put(handlers::admin_config::update_due_projection),
        )
        .route(
            "/webapp/config/zero-interest/addresses",
            axum::routing::put(handlers::admin_config::update_zero_interest_addresses),
        )
        .route(
            "/webapp/config/swap/skip-route",
            axum::routing::put(handlers::admin_config::update_skip_route_config),
        )
        .route(
            "/webapp/config/governance/hidden-proposals",
            axum::routing::put(handlers::admin_config::update_hidden_proposals),
        )
        .route(
            "/webapp/config/history/currencies",
            axum::routing::put(handlers::admin_config::update_history_currencies),
        )
        .route(
            "/webapp/config/history/protocols",
            axum::routing::put(handlers::admin_config::update_history_protocols),
        )
        .route(
            "/webapp/locales/{lang}",
            axum::routing::put(handlers::admin_config::update_locale),
        )
        .route(
            "/webapp/config/reload",
            post(handlers::admin_config::reload_config),
        )
        .route(
            "/webapp/config/audit",
            get(handlers::admin_config::get_audit_log),
        )
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
        .layer(axum_middleware::from_fn_with_state(
            state.clone(),
            admin_auth_middleware,
        ));

    // WebSocket route (no rate limiting - has its own connection management)
    let ws_routes = Router::new().route("/", get(handlers::websocket::websocket_handler));

    // Static file serving for the frontend SPA
    // Serves files from ../dist (relative to backend directory)
    // Falls back to index.html for SPA routing
    let static_dir = std::env::var("STATIC_DIR").unwrap_or_else(|_| "../dist".to_string());
    let index_path = format!("{}/index.html", static_dir);

    let serve_dir = ServeDir::new(&static_dir).not_found_service(ServeFile::new(&index_path));

    // Combine all routes
    // API routes take precedence, then static files
    Router::new()
        .nest("/api", read_routes.merge(write_routes))
        .nest("/api/etl", etl_routes)
        .nest("/api/admin", admin_routes)
        .nest("/ws", ws_routes)
        .fallback_service(serve_dir)
        .layer(axum_middleware::from_fn(cache_control_middleware))
        .layer(TraceLayer::new_for_http())
        .layer(CompressionLayer::new())
        .layer(cors)
        .with_state(state)
}
