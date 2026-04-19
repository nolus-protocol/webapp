//! Background refresh tasks for the data cache
//!
//! Each function refreshes a single `Cached<T>` field in `AppDataCache`.
//! `start_all()` spawns them on appropriate intervals.
//! `warm_essential_data()` runs blocking at startup before the server accepts requests.

use std::collections::HashMap;
use std::sync::Arc;

use futures::future::join_all;
use tracing::{debug, error, info, warn};

use crate::chain_events::EventChannels;
use crate::data_cache::GatedConfigBundle;
use crate::external::chain::ProtocolContractsInfo;
use crate::handlers::config::{
    AppConfigResponse, ContractsInfo, NativeAssetInfo, NetworkInfo, ProtocolInfo,
};
use crate::handlers::currencies::{
    calculate_price_with_decimals, CurrenciesResponse, CurrencyInfo, PriceInfo, PricesResponse,
};
use crate::handlers::earn::EarnPool;
use crate::handlers::etl_proxy::{LoansStatsBatch, StatsOverviewBatch};
use crate::handlers::gated_assets::{get_price_for_asset, AssetResponse, AssetsResponse};
use crate::handlers::gated_networks::NetworksResponse;
use crate::handlers::leases::LeaseConfigResponse;
use crate::handlers::staking::Validator;
use crate::propagation::user_data_filter::UserDataFilterContext;
use crate::propagation::{PropagationFilter, PropagationMerger};
use crate::AppState;

// ============================================================================
// Startup & Scheduling
// ============================================================================

/// Warm up essential caches before the server starts accepting requests.
///
/// Runs blocking (awaited in main). If some data fails to load,
/// the server starts anyway — handlers return 503 for missing cache entries.
pub async fn warm_essential_data(state: Arc<AppState>) {
    info!("Starting essential data warm-up...");

    // Load gated config from disk first (no external deps)
    refresh_gated_config(&state).await;

    // Load filter context (needs gated config + ETL)
    refresh_filter_context(&state).await;

    // Load protocol contracts from admin contract
    refresh_protocol_contracts(&state).await;

    // These can run in parallel since they depend on data already loaded above
    tokio::join!(
        refresh_app_config(&state),
        refresh_currencies(&state),
        refresh_prices(&state),
        refresh_gated_protocols(&state),
        refresh_gated_networks(&state),
        refresh_gas_fee_config(&state),
        refresh_annual_inflation(&state),
        refresh_staking_pool(&state),
    );

    info!("Essential data warm-up complete");
}

/// Start all background refresh tasks grouped by dependency chain.
///
/// **Group 1 — Chain Data (event-driven, ~6s):**
///   Prices + gas fee config, both depend on chain state.
///
/// **Group 2 — ETL + Gated Core (60s, sequential):**
///   gated_config → filter_context → protocol_contracts → (currencies + app_config)
///   Runs in dependency order so derived caches always see fresh inputs.
///
/// **Group 3 — Derived Gated Views (60s, runs after Group 2):**
///   gated_assets, gated_protocols, gated_networks, lease_configs
///   All depend on Group 2 outputs.
///
/// **Group 4 — Domain Data (60s, independent):**
///   pools, validators — no internal dependencies.
///
/// **Group 5 — ETL Stats (60s, independent):**
///   stats_overview, loans_stats — pure ETL reads.
///
/// **Group 6 — Slow (300s):**
///   swap_config — depends on gated_config + ETL, infrequently changing.
pub fn start_all(state: Arc<AppState>, event_channels: &EventChannels) {
    // Group 1: Chain data (event-driven)
    spawn_event_refresh(
        "chain_data",
        state.clone(),
        event_channels.new_block.subscribe(),
        2,
        |s| {
            Box::pin(async move {
                tokio::join!(refresh_prices(s), refresh_gas_fee_config(s));
            })
        },
    );

    // Group 2+3: ETL + Gated Core → Derived Views (60s, sequential pipeline)
    spawn_refresh("gated_pipeline", state.clone(), 60, |s| {
        Box::pin(async move {
            // Phase 1: Core data (sequential — each depends on the previous)
            refresh_gated_config(s).await;
            refresh_filter_context(s).await;
            refresh_protocol_contracts(s).await;
            tokio::join!(refresh_currencies(s), refresh_app_config(s));

            // Phase 2: Derived views (parallel — all depend on Phase 1 outputs)
            tokio::join!(
                refresh_gated_assets(s),
                refresh_gated_protocols(s),
                refresh_gated_networks(s),
                refresh_lease_configs(s),
            );
        })
    });

    // Group 4: Domain data (60s, independent)
    spawn_refresh("domain_data", state.clone(), 60, |s| {
        Box::pin(async move {
            tokio::join!(
                refresh_pools(s),
                refresh_validators(s),
                refresh_annual_inflation(s),
                refresh_staking_pool(s),
            );
        })
    });

    // Group 5: ETL stats (60s, independent)
    spawn_refresh("etl_stats", state.clone(), 60, |s| {
        Box::pin(async move {
            tokio::join!(refresh_stats_overview(s), refresh_loans_stats(s));
        })
    });

    // Group 6: Slow refresh (300s)
    spawn_refresh("swap_config", state.clone(), 300, |s| {
        Box::pin(refresh_swap_config(s))
    });

    info!("All background refresh tasks started (6 groups)");
}

/// Spawn a single refresh task that runs on a timer interval.
fn spawn_refresh<F>(name: &'static str, state: Arc<AppState>, interval_secs: u64, f: F)
where
    F: Fn(&Arc<AppState>) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>>
        + Send
        + Sync
        + 'static,
{
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(interval_secs));
        loop {
            interval.tick().await;
            f(&state).await;
            tracing::trace!("Refreshed {}", name);
        }
    });
}

/// Spawn a refresh task triggered by broadcast channel events.
///
/// `skip_factor`: refresh every Nth event (1 = every event, 2 = every other, etc.).
/// When the channel closes, the task stops with an error log (fail loudly).
/// When the consumer lags behind channel capacity, it does a single catch-up refresh.
fn spawn_event_refresh<F, T: Clone + Send + 'static>(
    name: &'static str,
    state: Arc<AppState>,
    mut event_rx: tokio::sync::broadcast::Receiver<T>,
    skip_factor: u64,
    f: F,
) where
    F: Fn(&Arc<AppState>) -> std::pin::Pin<Box<dyn std::future::Future<Output = ()> + Send + '_>>
        + Send
        + Sync
        + 'static,
{
    tokio::spawn(async move {
        let mut counter: u64 = 0;
        loop {
            match event_rx.recv().await {
                Ok(_) => {
                    counter += 1;
                    if !counter.is_multiple_of(skip_factor) {
                        continue;
                    }
                    f(&state).await;
                    tracing::trace!("Refreshed {} (event-triggered)", name);
                }
                Err(tokio::sync::broadcast::error::RecvError::Lagged(n)) => {
                    tracing::debug!("{}: lagged {} events, refreshing once", name, n);
                    f(&state).await;
                }
                Err(tokio::sync::broadcast::error::RecvError::Closed) => {
                    tracing::error!("{}: event channel closed, task stopping", name);
                    break;
                }
            }
        }
    });
}

// ============================================================================
// Individual refresh functions
// ============================================================================

/// Load all 5 gated config JSON files from disk
pub async fn refresh_gated_config(state: &Arc<AppState>) {
    let store = &state.config_store;
    let result = tokio::try_join!(
        store.load_currency_display(),
        store.load_gated_network_config(),
        store.load_lease_rules(),
        store.load_swap_settings(),
        store.load_ui_settings(),
    );

    match result {
        Ok((currency_display, network_config, lease_rules, swap_settings, ui_settings)) => {
            state.data_cache.gated_config.store(GatedConfigBundle {
                currency_display,
                network_config,
                lease_rules,
                swap_settings,
                ui_settings,
            });
        }
        Err(e) => warn!("Failed to refresh gated config: {}", e),
    }
}

/// Build filter context from cached gated config + ETL protocols
pub async fn refresh_filter_context(state: &Arc<AppState>) {
    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => {
            warn!("Cannot refresh filter_context: gated_config not loaded yet");
            return;
        }
    };

    let etl_protocols = match state.etl_client.fetch_protocols().await {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to fetch ETL protocols for filter_context: {}", e);
            return;
        }
    };

    let ctx = UserDataFilterContext::from_config(
        &etl_protocols,
        &gated.currency_display,
        &gated.network_config,
        &gated.lease_rules,
    );

    state.data_cache.filter_context.store(ctx);
}

/// Load protocol contracts from the admin contract on chain
pub async fn refresh_protocol_contracts(state: &Arc<AppState>) {
    let admin_address = &state.config.protocols.admin_contract;

    let protocols = match state.chain_client.get_admin_protocols(admin_address).await {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to fetch admin protocols: {}", e);
            return;
        }
    };

    let mut contracts_map: HashMap<String, ProtocolContractsInfo> = HashMap::new();

    for protocol in &protocols {
        match state
            .chain_client
            .get_admin_protocol(admin_address, protocol)
            .await
        {
            Ok(resp) => {
                contracts_map.insert(protocol.clone(), resp.contracts);
            }
            Err(e) => {
                warn!("Failed to fetch protocol {}: {}", protocol, e);
            }
        }
    }

    if !contracts_map.is_empty() {
        debug!(
            "Refreshed protocol contracts: {} protocols",
            contracts_map.len()
        );
        // Update LPP addresses for WebSocket earn event filtering
        state.ws_manager.refresh_lpp_addresses(&contracts_map);
        state.data_cache.protocol_contracts.store(contracts_map);
    }
}

/// Refresh app config (protocols + networks + native asset + contracts)
pub async fn refresh_app_config(state: &Arc<AppState>) {
    let etl_response = match state.etl_client.fetch_protocols().await {
        Ok(r) => r,
        Err(e) => {
            warn!("Failed to refresh app_config: {}", e);
            return;
        }
    };

    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => {
            warn!("Cannot refresh app_config: gated_config not loaded");
            return;
        }
    };

    let mut protocols = HashMap::new();
    for etl_protocol in etl_response.protocols {
        let name = etl_protocol.name.clone();
        protocols.insert(name, ProtocolInfo::from(etl_protocol));
    }

    let networks: Vec<NetworkInfo> = gated
        .network_config
        .networks
        .iter()
        .filter(|(_, settings)| settings.is_configured())
        .map(|(key, settings)| {
            let symbol = settings
                .gas_price
                .trim_start_matches(|c: char| c.is_ascii_digit() || c == '.')
                .trim_start_matches('u')
                .to_uppercase();

            NetworkInfo {
                key: key.clone(),
                name: settings.name.clone(),
                chain_id: settings.chain_id.clone(),
                prefix: settings.prefix.clone(),
                rpc_url: settings.rpc.clone(),
                rest_url: settings.lcd.clone(),
                gas_price: settings.gas_price.clone(),
                chain_type: "cosmos".to_string(),
                native: key == "NOLUS",
                value: key.to_lowercase(),
                symbol,
                explorer: settings.explorer.clone(),
                icon: settings.icon.clone(),
                estimation: settings.estimation,
                primary_protocol: settings.primary_protocol.clone(),
                forward: settings.forward,
                gas_multiplier: settings.gas_multiplier,
            }
        })
        .collect();

    let response = AppConfigResponse {
        protocols,
        networks,
        native_asset: NativeAssetInfo {
            ticker: "NLS".to_string(),
            symbol: "NLS".to_string(),
            denom: "unls".to_string(),
            decimal_digits: 6,
        },
        contracts: ContractsInfo {
            admin: state.config.protocols.admin_contract.clone(),
            dispatcher: state.config.protocols.dispatcher_contract.clone(),
        },
    };

    state.data_cache.app_config.store(response);
}

/// Refresh currencies from ETL + gated display config
pub async fn refresh_currencies(state: &Arc<AppState>) {
    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => {
            warn!("Cannot refresh currencies: gated_config not loaded");
            return;
        }
    };

    let etl_response = match state.etl_client.fetch_currencies().await {
        Ok(r) => r,
        Err(e) => {
            warn!("Failed to refresh currencies: {}", e);
            return;
        }
    };

    let currency_config = &gated.currency_display;
    let ignore_all: std::collections::HashSet<&str> = gated
        .lease_rules
        .asset_restrictions
        .ignore_all
        .iter()
        .map(|s| s.as_str())
        .collect();

    // Only include currencies from active protocols (ones with oracle contracts).
    // This keeps currencies in sync with prices, which only queries active oracles.
    let active_protocols: Option<std::collections::HashSet<String>> = state
        .data_cache
        .protocol_contracts
        .load()
        .map(|pc| pc.keys().cloned().collect());

    let mut currencies_map: HashMap<String, CurrencyInfo> = HashMap::new();
    let mut lpn_currencies: Vec<CurrencyInfo> = Vec::new();
    let mut lease_currencies_set: std::collections::HashSet<String> =
        std::collections::HashSet::new();

    for etl_currency in etl_response.currencies {
        let is_ignored = ignore_all.contains(etl_currency.ticker.as_str());
        let display = currency_config.currencies.get(&etl_currency.ticker);

        for protocol_mapping in etl_currency.protocols {
            if let Some(ref active) = active_protocols {
                if !active.contains(protocol_mapping.protocol.as_str()) {
                    continue;
                }
            }

            let key = format!("{}@{}", etl_currency.ticker, protocol_mapping.protocol);
            let is_native = protocol_mapping.bank_symbol == "unls";
            let is_lpn = protocol_mapping.group == "lpn";

            let icon = display
                .map(|d| d.icon.clone())
                .unwrap_or_else(|| format!("/assets/icons/currencies/{}.svg", etl_currency.ticker));

            let currency_info = CurrencyInfo {
                key: key.clone(),
                ticker: etl_currency.ticker.clone(),
                symbol: protocol_mapping.bank_symbol.clone(),
                name: display
                    .map(|d| d.display_name.clone())
                    .unwrap_or_else(|| etl_currency.ticker.clone()),
                short_name: display
                    .and_then(|d| d.short_name.clone())
                    .unwrap_or_else(|| etl_currency.ticker.clone()),
                decimal_digits: etl_currency.decimal_digits,
                bank_symbol: protocol_mapping.bank_symbol,
                dex_symbol: protocol_mapping.dex_symbol,
                icon,
                native: is_native,
                coingecko_id: display.and_then(|d| d.coingecko_id.clone()),
                protocol: protocol_mapping.protocol.clone(),
                group: protocol_mapping.group.clone(),
                is_active: if is_ignored {
                    false
                } else {
                    etl_currency.is_active
                },
            };

            if !is_ignored && is_lpn && etl_currency.is_active {
                lpn_currencies.push(currency_info.clone());
            }

            if !is_ignored && protocol_mapping.group == "lease" && etl_currency.is_active {
                lease_currencies_set.insert(etl_currency.ticker.clone());
            }

            currencies_map.insert(key, currency_info);
        }
    }

    let response = CurrenciesResponse {
        currencies: currencies_map,
        lpn: lpn_currencies,
        lease_currencies: lease_currencies_set.into_iter().collect(),
        map: HashMap::new(),
    };

    state.data_cache.currencies.store(response);
}

/// Refresh prices from oracle contracts across all active protocols
pub async fn refresh_prices(state: &Arc<AppState>) {
    let app_config = match state.data_cache.app_config.load() {
        Some(c) => c,
        None => {
            warn!("Cannot refresh prices: app_config not loaded");
            return;
        }
    };

    let currencies = match state.data_cache.currencies.load() {
        Some(c) => c,
        None => {
            warn!("Cannot refresh prices: currencies not loaded");
            return;
        }
    };

    let currencies_map = &currencies.currencies;

    let active_protocols: Vec<_> = app_config
        .protocols
        .iter()
        .filter(|(_, info)| info.is_active && info.contracts.oracle.is_some())
        .collect();

    let price_futures: Vec<_> = active_protocols
        .iter()
        .filter_map(|(protocol_name, protocol_info)| {
            let chain_client = state.chain_client.clone();
            let oracle = match protocol_info.contracts.oracle.clone() {
                Some(o) => o,
                None => {
                    error!(
                        "Protocol {} has no oracle address, skipping prices",
                        protocol_name
                    );
                    return None;
                }
            };
            let protocol_name = (*protocol_name).clone();
            let currencies_map = currencies_map.clone();
            Some(async move {
                let mut protocol_prices = Vec::new();

                let base_currency = match chain_client.get_base_currency(&oracle).await {
                    Ok(bc) => bc,
                    Err(e) => {
                        error!(
                            "Failed to fetch base currency from {}: {}",
                            protocol_name, e
                        );
                        return protocol_prices;
                    }
                };

                let stable_price =
                    match chain_client.get_stable_price(&oracle, &base_currency).await {
                        Ok(sp) => sp,
                        Err(e) => {
                            error!("Failed to fetch stable price from {}: {}", protocol_name, e);
                            return protocol_prices;
                        }
                    };

                let lpn_key = format!("{}@{}", base_currency, protocol_name);
                let lpn_decimals = match currencies_map.get(&lpn_key).map(|c| c.decimal_digits) {
                    Some(d) => d,
                    None => {
                        warn!("Currency {} not found in currencies map, skipping protocol price calculation", lpn_key);
                        return protocol_prices;
                    }
                };

                // Get stable currency decimals for proper price calculation
                // The stable currency ticker is in amount_quote.ticker
                let stable_ticker = &stable_price.amount_quote.ticker;
                let stable_key = format!("{}@{}", stable_ticker, protocol_name);
                let stable_decimals = match currencies_map.get(&stable_key).map(|c| c.decimal_digits) {
                    Some(d) => d,
                    None => {
                        warn!("Stable currency {} not found in currencies map, skipping protocol price calculation", stable_key);
                        return protocol_prices;
                    }
                };

                // Calculate LPN price with decimal adjustment
                // Formula: (quote_amount / amount) * 10^(lpn_decimals - stable_decimals)
                let lpn_price = calculate_price_with_decimals(
                    &stable_price.amount_quote.amount,
                    &stable_price.amount.amount,
                    "1.0", // lpn_price multiplier is 1.0 for the LPN itself
                    lpn_decimals,
                    stable_decimals,
                );

                protocol_prices.push((
                    lpn_key.clone(),
                    PriceInfo {
                        key: lpn_key,
                        symbol: base_currency.clone(),
                        price_usd: lpn_price.clone(),
                    },
                ));

                match chain_client.get_oracle_prices(&oracle).await {
                    Ok(oracle_prices) => {
                        for price in oracle_prices.prices {
                            let key = format!("{}@{}", price.amount.ticker, protocol_name);
                            let asset_decimals = match currencies_map.get(&key).map(|c| c.decimal_digits) {
                                Some(d) => d,
                                None => {
                                    warn!("Currency {} not found in currencies map, skipping asset price", key);
                                    continue;
                                }
                            };

                            let asset_price = calculate_price_with_decimals(
                                &price.amount_quote.amount,
                                &price.amount.amount,
                                &lpn_price,
                                asset_decimals,
                                lpn_decimals,
                            );
                            protocol_prices.push((
                                key.clone(),
                                PriceInfo {
                                    key,
                                    symbol: price.amount.ticker,
                                    price_usd: asset_price,
                                },
                            ));
                        }
                    }
                    Err(e) => {
                        error!("Failed to fetch prices from {}: {}", protocol_name, e);
                    }
                }

                protocol_prices
            })
        })
        .collect();

    let price_results = join_all(price_futures).await;

    let mut prices = HashMap::new();
    for protocol_prices in price_results {
        for (key, price_info) in protocol_prices {
            prices.insert(key, price_info);
        }
    }

    let response = PricesResponse {
        prices,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    state.data_cache.prices.store(response);
}

/// Refresh earn pools from chain + ETL
pub async fn refresh_pools(state: &Arc<AppState>) {
    let contracts_map = match state.data_cache.protocol_contracts.load() {
        Some(c) => c,
        None => {
            warn!("Failed to refresh pools: protocol contracts not cached");
            return;
        }
    };
    let protocols: Vec<String> = contracts_map.keys().cloned().collect();

    let etl_pools = match state.etl_client.fetch_pools().await {
        Ok(pools) => Some(pools),
        Err(e) => {
            warn!("Failed to fetch ETL pools for APY data: {}", e);
            None
        }
    };

    let pool_futures: Vec<_> =
        protocols
            .iter()
            .map(|protocol| {
                let state = state.clone();
                let etl_pools = etl_pools.clone();
                let protocol = protocol.clone();
                async move {
                    crate::handlers::earn::fetch_pool_info(&state, &protocol, &etl_pools).await
                }
            })
            .collect();

    let pool_results = join_all(pool_futures).await;

    let pools: Vec<EarnPool> = pool_results
        .into_iter()
        .filter_map(|result| match result {
            Ok(pool) => Some(pool),
            Err(e) => {
                debug!("Skipped pool: {}", e);
                None
            }
        })
        .collect();

    state.data_cache.pools.store(pools);
}

/// Refresh validators from chain
pub async fn refresh_validators(state: &Arc<AppState>) {
    let validators = match state.chain_client.get_validators().await {
        Ok(v) => v,
        Err(e) => {
            warn!("Failed to refresh validators: {}", e);
            return;
        }
    };

    let result: Vec<Validator> = validators
        .into_iter()
        .map(|v| Validator {
            operator_address: v.operator_address,
            moniker: v.description.moniker,
            identity: v.description.identity,
            website: v.description.website,
            details: v.description.details,
            commission_rate: v.commission.commission_rates.rate,
            max_commission_rate: v.commission.commission_rates.max_rate,
            max_commission_change_rate: v.commission.commission_rates.max_change_rate,
            tokens: v.tokens,
            delegator_shares: v.delegator_shares,
            unbonding_height: v.unbonding_height,
            unbonding_time: v.unbonding_time,
            status: crate::handlers::staking::parse_validator_status(&v.status),
            jailed: v.jailed,
        })
        .collect();

    state.data_cache.validators.store(result);
}

/// Refresh annual inflation from chain
pub async fn refresh_annual_inflation(state: &Arc<AppState>) {
    match state.chain_client.get_annual_inflation().await {
        Ok(resp) => state.data_cache.annual_inflation.store(resp),
        Err(e) => warn!("Failed to refresh annual_inflation: {}", e),
    }
}

/// Refresh staking pool from chain
pub async fn refresh_staking_pool(state: &Arc<AppState>) {
    match state.chain_client.get_staking_pool().await {
        Ok(resp) => state.data_cache.staking_pool.store(resp),
        Err(e) => warn!("Failed to refresh staking_pool: {}", e),
    }
}

/// Refresh gated assets (deduplicated view with prices)
pub async fn refresh_gated_assets(state: &Arc<AppState>) {
    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => return,
    };

    let (etl_currencies, etl_protocols) = match (
        state.etl_client.fetch_currencies().await,
        state.etl_client.fetch_protocols().await,
    ) {
        (Ok(c), Ok(p)) => (c, p),
        _ => {
            warn!("Failed to refresh gated_assets: ETL fetch failed");
            return;
        }
    };

    let prices = match state.data_cache.prices.load() {
        Some(p) => p,
        None => {
            warn!("Prices not loaded yet, skipping gated_assets refresh");
            return;
        }
    };

    let configured_protocols = PropagationFilter::filter_protocols(
        &etl_protocols,
        &gated.currency_display,
        &gated.network_config,
    );

    let ignore_all: std::collections::HashSet<&str> = gated
        .lease_rules
        .asset_restrictions
        .ignore_all
        .iter()
        .map(|s| s.as_str())
        .collect();

    let mut assets: Vec<AssetResponse> = Vec::new();

    for currency in &etl_currencies.currencies {
        if !currency.is_active {
            continue;
        }

        if ignore_all.contains(currency.ticker.as_str()) {
            continue;
        }

        let display = match gated.currency_display.currencies.get(&currency.ticker) {
            Some(d) if d.is_configured() => d,
            _ => continue,
        };

        let currency_protocols: Vec<&str> = currency
            .protocols
            .iter()
            .filter(|cp| configured_protocols.iter().any(|p| p.name == cp.protocol))
            .map(|cp| cp.protocol.as_str())
            .collect();

        if currency_protocols.is_empty() {
            continue;
        }

        let networks: Vec<String> = currency_protocols
            .iter()
            .filter_map(|protocol_name| {
                configured_protocols
                    .iter()
                    .find(|p| p.name == *protocol_name)
                    .and_then(|p| p.network.clone())
            })
            .collect::<std::collections::HashSet<_>>()
            .into_iter()
            .collect();

        let price = get_price_for_asset(
            &currency.ticker,
            &networks,
            &gated.network_config,
            &prices.prices,
        );

        assets.push(AssetResponse {
            ticker: currency.ticker.clone(),
            decimals: currency.decimal_digits,
            icon: display.icon.clone(),
            display_name: display.display_name.clone(),
            short_name: display
                .short_name
                .clone()
                .unwrap_or_else(|| currency.ticker.clone()),
            color: display.color.clone(),
            coingecko_id: display.coingecko_id.clone(),
            price,
            networks,
            protocols: currency_protocols.iter().map(|s| s.to_string()).collect(),
        });
    }

    let response = AssetsResponse {
        count: assets.len(),
        assets,
    };

    state.data_cache.gated_assets.store(response);
}

/// Refresh gated protocols
pub async fn refresh_gated_protocols(state: &Arc<AppState>) {
    use crate::handlers::common_types::{CurrencyDisplayInfo, ProtocolContracts};
    use crate::handlers::gated_protocols::ProtocolResponse;
    use std::collections::HashSet;

    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => return,
    };

    let etl_protocols = match state.etl_client.fetch_protocols().await {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to refresh gated_protocols: {}", e);
            return;
        }
    };

    let filtered_protocols = PropagationFilter::filter_protocols(
        &etl_protocols,
        &gated.currency_display,
        &gated.network_config,
    );

    // Build ignore sets for protocol filtering
    let ignore_short: HashSet<&str> = gated
        .lease_rules
        .asset_restrictions
        .ignore_short
        .iter()
        .map(|s| s.as_str())
        .collect();
    let ignore_long: HashSet<&str> = gated
        .lease_rules
        .asset_restrictions
        .ignore_long
        .iter()
        .map(|s| s.as_str())
        .collect();

    let protocols: Vec<ProtocolResponse> = filtered_protocols
        .iter()
        .filter_map(|p| {
            let lpn_display = gated.currency_display.currencies.get(&p.lpn_symbol)?;
            if !lpn_display.is_configured() {
                return None;
            }

            // Filter out protocols based on position type and ignore lists
            // For short protocols: if LPN is in ignore_short, skip
            // For long protocols: if LPN is in ignore_long, skip
            match p.position_type.to_lowercase().as_str() {
                "short" if ignore_short.contains(p.lpn_symbol.as_str()) => return None,
                "long" if ignore_long.contains(p.lpn_symbol.as_str()) => return None,
                _ => {}
            }

            Some(ProtocolResponse {
                protocol: p.name.clone(),
                network: p.network.clone().unwrap_or_default(),
                dex: p.dex.clone().unwrap_or_default(),
                position_type: p.position_type.clone(),
                lpn: p.lpn_symbol.clone(),
                lpn_display: CurrencyDisplayInfo {
                    ticker: p.lpn_symbol.clone(),
                    icon: lpn_display.icon.clone(),
                    display_name: lpn_display.display_name.clone(),
                    short_name: lpn_display
                        .short_name
                        .clone()
                        .unwrap_or_else(|| p.lpn_symbol.clone()),
                    color: lpn_display.color.clone(),
                },
                contracts: ProtocolContracts::from(&p.contracts),
            })
        })
        .collect();

    let response = crate::data_cache::GatedProtocolsResponse {
        count: protocols.len(),
        protocols,
    };

    state.data_cache.gated_protocols.store(response);
}

/// Refresh gated networks
pub async fn refresh_gated_networks(state: &Arc<AppState>) {
    use crate::handlers::gated_networks::NetworkResponse;

    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => return,
    };

    let merged_networks = PropagationMerger::merge_networks(&gated.network_config);

    let networks: Vec<NetworkResponse> = merged_networks
        .into_iter()
        .map(|n| NetworkResponse {
            network: n.network,
            name: n.name,
            chain_id: n.chain_id,
            prefix: n.prefix,
            rpc: n.rpc,
            lcd: n.lcd,
            fallback_rpc: n.fallback_rpc,
            fallback_lcd: n.fallback_lcd,
            gas_price: n.gas_price,
            explorer: n.explorer,
            icon: n.icon,
            primary_protocol: n.primary_protocol,
            estimation: n.estimation,
            gas_multiplier: n.gas_multiplier,
        })
        .collect();

    let response = NetworksResponse {
        count: networks.len(),
        networks,
    };

    state.data_cache.gated_networks.store(response);
}

/// Refresh stats overview batch from ETL
pub async fn refresh_stats_overview(state: &Arc<AppState>) {
    let base_url = &state.config.external.etl_api_url;
    let client = &state.etl_client.client;

    let url_tvl = format!("{}/api/total-value-locked", base_url);
    let url_tx_volume = format!("{}/api/total-tx-value", base_url);
    let url_buyback = format!("{}/api/buyback-total", base_url);
    let url_pnl_stats = format!("{}/api/realized-pnl-stats", base_url);
    let url_revenue = format!("{}/api/revenue", base_url);

    let (tvl, tx_volume, buyback_total, realized_pnl_stats, revenue) = tokio::join!(
        fetch_json(client, &url_tvl),
        fetch_json(client, &url_tx_volume),
        fetch_json(client, &url_buyback),
        fetch_json(client, &url_pnl_stats),
        fetch_json(client, &url_revenue),
    );

    let response = StatsOverviewBatch {
        tvl: tvl.ok(),
        tx_volume: tx_volume.ok(),
        buyback_total: buyback_total.ok(),
        realized_pnl_stats: realized_pnl_stats.ok(),
        revenue: revenue.ok(),
    };

    state.data_cache.stats_overview.store(response);
}

/// Refresh loans stats batch from ETL
pub async fn refresh_loans_stats(state: &Arc<AppState>) {
    let base_url = &state.config.external.etl_api_url;
    let client = &state.etl_client.client;

    let url_position = format!("{}/api/open-position-value", base_url);
    let url_interest = format!("{}/api/open-interest", base_url);

    let (open_position_value, open_interest) = tokio::join!(
        fetch_json(client, &url_position),
        fetch_json(client, &url_interest),
    );

    let response = LoansStatsBatch {
        open_position_value: open_position_value.ok(),
        open_interest: open_interest.ok(),
    };

    state.data_cache.loans_stats.store(response);
}

/// Refresh swap config (settings + ETL currency denom resolution)
pub async fn refresh_swap_config(state: &Arc<AppState>) {
    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => return,
    };

    let (protocols_result, currencies_result) = tokio::join!(
        state.etl_client.fetch_protocols(),
        state.etl_client.fetch_currencies(),
    );

    let protocols_response = match protocols_result {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to refresh swap_config: {}", e);
            return;
        }
    };
    let currencies_response = match currencies_result {
        Ok(c) => c,
        Err(e) => {
            warn!("Failed to refresh swap_config: {}", e);
            return;
        }
    };

    let swap_settings = &gated.swap_settings;

    // Build protocol -> network lookup
    let mut protocol_to_network: HashMap<String, String> = HashMap::new();
    for protocol in &protocols_response.protocols {
        if let Some(ref network) = protocol.network {
            protocol_to_network.insert(protocol.name.clone(), network.to_uppercase());
        }
    }

    // Build ticker+network -> bank_symbol lookup
    let mut ticker_network_to_denom: HashMap<(String, String), String> = HashMap::new();
    let mut ticker_to_denom: HashMap<String, String> = HashMap::new();

    for currency in &currencies_response.currencies {
        if !currency.is_active {
            continue;
        }
        for protocol_mapping in &currency.protocols {
            if let Some(network) = protocol_to_network.get(&protocol_mapping.protocol) {
                ticker_network_to_denom
                    .entry((currency.ticker.clone(), network.clone()))
                    .or_insert_with(|| protocol_mapping.bank_symbol.clone());
            }
            ticker_to_denom
                .entry(currency.ticker.clone())
                .or_insert_with(|| protocol_mapping.bank_symbol.clone());
        }
    }

    // Build transfers
    let mut transfers: HashMap<String, Vec<serde_json::Value>> = HashMap::new();
    let mut seen: HashMap<String, std::collections::HashSet<String>> = HashMap::new();

    for currency in &currencies_response.currencies {
        if !currency.is_active {
            continue;
        }
        for protocol_mapping in &currency.protocols {
            let network = match protocol_to_network.get(&protocol_mapping.protocol) {
                Some(n) => n,
                None => continue,
            };
            if network == "NOLUS" {
                continue;
            }
            let network_seen = seen.entry(network.clone()).or_default();
            if !network_seen.insert(protocol_mapping.bank_symbol.clone()) {
                continue;
            }
            let entry = serde_json::json!({
                "from": protocol_mapping.bank_symbol,
                "to": protocol_mapping.dex_symbol,
                "native": false,
            });
            transfers.entry(network.clone()).or_default().push(entry);
        }
    }

    let mut transfers_map = serde_json::Map::new();
    for (network, currencies) in transfers {
        transfers_map.insert(network, serde_json::json!({ "currencies": currencies }));
    }

    // Build public config response (UI-only fields)
    let mut response = serde_json::Map::new();
    response.insert(
        "blacklist".to_string(),
        serde_json::json!(swap_settings.blacklist),
    );
    response.insert("fee".to_string(), serde_json::json!(swap_settings.fee));

    let swap_to_denom = swap_settings
        .swap_to_currency
        .as_deref()
        .and_then(|ticker| ticker_to_denom.get(ticker))
        .cloned()
        .unwrap_or_default();
    response.insert(
        "swap_to_currency".to_string(),
        serde_json::json!(swap_to_denom),
    );

    for (network, ticker) in &swap_settings.swap_currencies {
        let network_upper = network.to_uppercase();
        let denom = ticker_network_to_denom
            .get(&(ticker.clone(), network_upper))
            .or_else(|| ticker_to_denom.get(ticker))
            .cloned()
            .unwrap_or_default();
        response.insert(
            format!("swap_currency_{}", network),
            serde_json::json!(denom),
        );
    }

    response.insert(
        "transfers".to_string(),
        serde_json::Value::Object(transfers_map),
    );

    state
        .data_cache
        .swap_config
        .store(serde_json::Value::Object(response));
}

/// Refresh lease configs for all protocols
pub async fn refresh_lease_configs(state: &Arc<AppState>) {
    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => return,
    };

    let contracts = match state.data_cache.protocol_contracts.load() {
        Some(c) => c,
        None => return,
    };

    let lease_rules = &gated.lease_rules;
    let mut configs: HashMap<String, LeaseConfigResponse> = HashMap::new();

    for (protocol, contract_info) in &contracts {
        let leaser_address = &contract_info.leaser;

        match state.chain_client.get_leaser_config(leaser_address).await {
            Ok(leaser_config) => {
                let downpayment_ranges = lease_rules
                    .downpayment_ranges
                    .get(protocol)
                    .cloned()
                    .unwrap_or_default();

                configs.insert(
                    protocol.clone(),
                    LeaseConfigResponse {
                        protocol: protocol.clone(),
                        downpayment_ranges,
                        min_asset: leaser_config.lease_position_spec.min_asset,
                        min_transaction: leaser_config.lease_position_spec.min_transaction,
                    },
                );
            }
            Err(e) => {
                warn!("Failed to fetch leaser config for {}: {}", protocol, e);
            }
        }
    }

    if !configs.is_empty() {
        state.data_cache.lease_configs.store(configs);
    }
}

/// Refresh gas fee config from chain tax module + gated network config
pub async fn refresh_gas_fee_config(state: &Arc<AppState>) {
    let gated = match state.data_cache.gated_config.load() {
        Some(g) => g,
        None => {
            warn!("Cannot refresh gas_fee_config: gated_config not loaded");
            return;
        }
    };

    let tax_params = match state.chain_client.get_tax_params().await {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to refresh gas_fee_config: {}", e);
            return;
        }
    };

    let mut gas_prices = std::collections::HashMap::new();

    // Flatten all accepted denoms from tax module params
    for dex_fee in &tax_params.params.dex_fee_params {
        for denom_price in &dex_fee.accepted_denoms_min_prices {
            gas_prices.insert(denom_price.denom.clone(), denom_price.min_price.clone());
        }
    }

    // Always include unls with gas price from network config (single source of truth)
    if let Some(nolus) = gated.network_config.networks.get("NOLUS") {
        let nls_price = nolus
            .gas_price
            .trim_end_matches(|c: char| c.is_alphabetic() || c == '_')
            .to_string();
        gas_prices.insert("unls".to_string(), nls_price);
    }

    // Gas multiplier from gated network config for NOLUS (single source of truth)
    let gas_multiplier = match gated
        .network_config
        .networks
        .get("NOLUS")
        .map(|n| n.gas_multiplier)
    {
        Some(m) => m,
        None => {
            error!("NOLUS network not found in gated config — cannot compute gas fees");
            return;
        }
    };

    let config = crate::handlers::fees::GasFeeConfigResponse {
        gas_prices,
        gas_multiplier,
    };

    state.data_cache.gas_fee_config.store(config);
}

// ============================================================================
// Helpers
// ============================================================================

async fn fetch_json(client: &reqwest::Client, url: &str) -> Result<serde_json::Value, String> {
    client
        .get(url)
        .send()
        .await
        .map_err(|e| e.to_string())?
        .json()
        .await
        .map_err(|e| e.to_string())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
#[allow(clippy::too_many_lines)]
mod tests {
    use super::*;

    use std::time::Instant;

    use serde_json::json;
    use wiremock::matchers::{method, path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    use crate::config::AppConfig;
    use crate::config_store::gated_types::{
        AssetRestrictions, CurrencyDisplay, CurrencyDisplayConfig, GatedNetworkConfig,
        LeaseRulesConfig, NetworkSettings, SmartSwapOptions, SwapSettingsConfig, UiSettingsConfig,
    };
    use crate::config_store::ConfigStore;
    use crate::data_cache::{AppDataCache, ProtocolContractsMap};
    use crate::external::chain::{
        AnnualInflationResponse, ProtocolContractsInfo, StakingPool, StakingPoolResponse,
    };
    use crate::handlers::config::{
        AppConfigResponse, ContractsInfo, NativeAssetInfo, ProtocolInfo,
    };
    use crate::handlers::currencies::{CurrenciesResponse, CurrencyInfo};
    use crate::handlers::etl_proxy::{LoansStatsBatch, StatsOverviewBatch};
    use crate::handlers::fees::GasFeeConfigResponse;
    use crate::handlers::staking::{Validator, ValidatorStatus};
    use crate::handlers::websocket::WebSocketManager;
    use crate::test_utils::test_config;
    use crate::translations::{
        llm::{LlmClient, LlmConfig},
        TranslationStorage,
    };
    use crate::AppState;

    // ========================================================================
    // Test fixtures
    // ========================================================================

    /// Build an `AppState` whose HTTP client uses realistic timeouts and whose
    /// ETL + chain URLs point at the supplied wiremock URIs.
    ///
    /// This is needed because `test_app_state` uses a 1ms timeout that causes
    /// every real HTTP call to fail, which is only useful for the
    /// "all-fails-fast" smoke tests.
    async fn make_state_with_urls(etl_url: &str, chain_url: &str) -> Arc<AppState> {
        let mut config: AppConfig = test_config();
        config.external.etl_api_url = etl_url.to_string();
        config.external.nolus_rest_url = chain_url.to_string();

        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("reqwest client builder cannot fail");

        let etl_client = crate::external::etl::EtlClient::new(
            config.external.etl_api_url.clone(),
            http_client.clone(),
        );
        let skip_client = crate::external::skip::SkipClient::new(
            config.external.skip_api_url.clone(),
            config.external.skip_api_key.clone(),
            http_client.clone(),
        );
        let chain_client = crate::external::chain::ChainClient::new(
            config.external.nolus_rest_url.clone(),
            http_client.clone(),
        );
        let referral_client =
            crate::external::referral::ReferralClient::new(&config, http_client.clone());
        let zero_interest_client =
            crate::external::zero_interest::ZeroInterestClient::new(&config, http_client.clone());

        let config_dir = tempfile::tempdir().expect("config tempdir").keep();
        let config_store = ConfigStore::new(&config_dir);
        config_store
            .init()
            .await
            .expect("ConfigStore init must succeed in tests");

        let translation_dir = tempfile::tempdir().expect("translation tempdir").keep();
        let translation_storage = TranslationStorage::new(&translation_dir);
        translation_storage
            .init()
            .await
            .expect("TranslationStorage init must succeed in tests");

        let llm_client = LlmClient::new(LlmConfig {
            api_key: String::new(),
            model: "stub".to_string(),
            base_url: Some("http://127.0.0.1:1/".to_string()),
        });

        Arc::new(AppState {
            config,
            etl_client,
            skip_client,
            chain_client,
            referral_client,
            zero_interest_client,
            data_cache: AppDataCache::new(),
            ws_manager: WebSocketManager::new(16),
            config_store,
            translation_storage,
            llm_client,
            startup_time: Instant::now(),
        })
    }

    /// Create a paired (etl, chain) mock server and a state wired to them.
    async fn state_with_wiremock_etl_and_chain() -> (Arc<AppState>, MockServer, MockServer) {
        let etl = MockServer::start().await;
        let chain = MockServer::start().await;
        let state = make_state_with_urls(&etl.uri(), &chain.uri()).await;
        (state, etl, chain)
    }

    /// Build a minimal `GatedConfigBundle` for tests.
    fn sample_gated_bundle() -> GatedConfigBundle {
        let mut currencies: HashMap<String, CurrencyDisplay> = HashMap::new();
        currencies.insert(
            "USDC".to_string(),
            CurrencyDisplay {
                icon: "/icons/usdc.svg".to_string(),
                display_name: "USD Coin".to_string(),
                short_name: Some("USDC".to_string()),
                color: None,
                coingecko_id: Some("usd-coin".to_string()),
            },
        );
        currencies.insert(
            "ATOM".to_string(),
            CurrencyDisplay {
                icon: "/icons/atom.svg".to_string(),
                display_name: "Cosmos Hub".to_string(),
                short_name: Some("ATOM".to_string()),
                color: None,
                coingecko_id: Some("cosmos".to_string()),
            },
        );

        let mut networks: HashMap<String, NetworkSettings> = HashMap::new();
        networks.insert(
            "NOLUS".to_string(),
            NetworkSettings {
                name: "Nolus".to_string(),
                chain_id: "pirin-1".to_string(),
                prefix: "nolus".to_string(),
                rpc: "https://rpc.nolus.network".to_string(),
                lcd: "https://lcd.nolus.network".to_string(),
                fallback_rpc: vec![],
                fallback_lcd: vec![],
                gas_price: "0.0025unls".to_string(),
                explorer: None,
                icon: None,
                primary_protocol: None,
                estimation: None,
                forward: None,
                swap_venue: None,
                gas_multiplier: 3.5,
                pools: HashMap::new(),
            },
        );
        networks.insert(
            "OSMOSIS".to_string(),
            NetworkSettings {
                name: "Osmosis".to_string(),
                chain_id: "osmosis-1".to_string(),
                prefix: "osmo".to_string(),
                rpc: "https://rpc.osmosis.zone".to_string(),
                lcd: "https://lcd.osmosis.zone".to_string(),
                fallback_rpc: vec![],
                fallback_lcd: vec![],
                gas_price: "0.025uosmo".to_string(),
                explorer: None,
                icon: None,
                primary_protocol: None,
                estimation: None,
                forward: None,
                swap_venue: None,
                gas_multiplier: 2.0,
                pools: HashMap::new(),
            },
        );

        GatedConfigBundle {
            currency_display: CurrencyDisplayConfig { currencies },
            network_config: GatedNetworkConfig { networks },
            lease_rules: LeaseRulesConfig {
                downpayment_ranges: HashMap::new(),
                asset_restrictions: AssetRestrictions::default(),
                due_projection_secs: 400,
            },
            swap_settings: SwapSettingsConfig {
                api_url: "https://api.skip.build".to_string(),
                blacklist: vec![],
                slippage: 1,
                gas_multiplier: 2,
                fee: 35,
                fee_address: None,
                timeout_seconds: "60".to_string(),
                swap_currencies: HashMap::new(),
                swap_to_currency: None,
                go_fast: true,
                smart_relay: true,
                allow_multi_tx: true,
                allow_unsafe: true,
                bridges: vec!["IBC".to_string()],
                experimental_features: vec![],
                smart_swap_options: SmartSwapOptions::default(),
            },
            ui_settings: UiSettingsConfig::default(),
        }
    }

    fn sentinel_app_config() -> AppConfigResponse {
        let mut protocols = HashMap::new();
        protocols.insert(
            "SENTINEL".to_string(),
            ProtocolInfo {
                name: "SENTINEL".to_string(),
                network: Some("OSMOSIS".to_string()),
                dex: Some("Osmosis".to_string()),
                lpn: "USDC".to_string(),
                position_type: "long".to_string(),
                contracts: crate::handlers::common_types::ProtocolContracts::default(),
                is_active: true,
            },
        );
        AppConfigResponse {
            protocols,
            networks: Vec::new(),
            native_asset: NativeAssetInfo {
                ticker: "NLS".to_string(),
                symbol: "NLS".to_string(),
                denom: "unls".to_string(),
                decimal_digits: 6,
            },
            contracts: ContractsInfo {
                admin: "nolus1admin".to_string(),
                dispatcher: "nolus1disp".to_string(),
            },
        }
    }

    fn sentinel_currencies() -> CurrenciesResponse {
        let mut map: HashMap<String, CurrencyInfo> = HashMap::new();
        map.insert(
            "SENT@P".to_string(),
            CurrencyInfo {
                key: "SENT@P".to_string(),
                ticker: "SENT".to_string(),
                symbol: "usent".to_string(),
                name: "Sentinel".to_string(),
                short_name: "SENT".to_string(),
                decimal_digits: 6,
                bank_symbol: "usent".to_string(),
                dex_symbol: "usent".to_string(),
                icon: "/icons/sent.svg".to_string(),
                native: false,
                coingecko_id: None,
                protocol: "P".to_string(),
                group: "lease".to_string(),
                is_active: true,
            },
        );
        CurrenciesResponse {
            currencies: map,
            lpn: Vec::new(),
            lease_currencies: Vec::new(),
            map: HashMap::new(),
        }
    }

    fn etl_protocols_json() -> serde_json::Value {
        json!({
            "protocols": [
                {
                    "name": "OSMOSIS-OSMOSIS-USDC_NOBLE",
                    "network": "osmosis",
                    "dex": "\"Osmosis\"",
                    "position_type": "long",
                    "lpn_symbol": "USDC",
                    "is_active": true,
                    "contracts": {
                        "leaser": "nolus1leaser",
                        "lpp": "nolus1lpp",
                        "oracle": "nolus1oracle",
                        "profit": "nolus1profit",
                        "reserve": null
                    }
                }
            ],
            "count": 1,
            "active_count": 1,
            "deprecated_count": 0
        })
    }

    fn etl_currencies_json_with_usdc() -> serde_json::Value {
        json!({
            "currencies": [
                {
                    "ticker": "USDC",
                    "decimal_digits": 6,
                    "is_active": true,
                    "protocols": [
                        {
                            "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
                            "group": "lpn",
                            "bank_symbol": "ibc/USDC-NOLUS",
                            "dex_symbol": "ibc/USDC-DEX"
                        }
                    ]
                }
            ],
            "count": 1,
            "active_count": 1,
            "deprecated_count": 0
        })
    }

    // Helper: build a `GatedConfigBundle` including a specific USDC ignore list entry.
    fn gated_bundle_with_ignore(tickers: Vec<&str>) -> GatedConfigBundle {
        let mut b = sample_gated_bundle();
        b.lease_rules.asset_restrictions.ignore_all =
            tickers.into_iter().map(|s| s.to_string()).collect();
        b
    }

    // =======================================================================
    // refresh_app_config
    // =======================================================================

    #[tokio::test]
    async fn refresh_app_config_populates_cache_on_success() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_protocols_json()))
            .mount(&etl)
            .await;

        refresh_app_config(&state).await;

        let loaded = state
            .data_cache
            .app_config
            .load()
            .expect("app_config should be populated");
        assert_eq!(loaded.native_asset.ticker, "NLS");
        assert!(loaded.protocols.contains_key("OSMOSIS-OSMOSIS-USDC_NOBLE"));
        assert!(!loaded.networks.is_empty());
    }

    #[tokio::test]
    async fn refresh_app_config_keeps_stale_on_etl_error() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());
        state.data_cache.app_config.store(sentinel_app_config());

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
            .mount(&etl)
            .await;

        refresh_app_config(&state).await;

        let loaded = state.data_cache.app_config.load().expect("stale retained");
        assert!(loaded.protocols.contains_key("SENTINEL"));
    }

    #[tokio::test]
    async fn refresh_app_config_keeps_stale_on_malformed_json() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());
        state.data_cache.app_config.store(sentinel_app_config());

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_string("{not json"))
            .mount(&etl)
            .await;

        refresh_app_config(&state).await;

        let loaded = state.data_cache.app_config.load().expect("stale retained");
        assert!(loaded.protocols.contains_key("SENTINEL"));
    }

    #[tokio::test]
    async fn refresh_app_config_noop_when_gated_config_missing() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_protocols_json()))
            .mount(&etl)
            .await;

        refresh_app_config(&state).await;

        assert!(!state.data_cache.app_config.is_populated());
    }

    // =======================================================================
    // refresh_gated_config
    // =======================================================================

    #[tokio::test]
    async fn refresh_gated_config_populates_bundle_on_success() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        let bundle = sample_gated_bundle();

        state
            .config_store
            .save_currency_display(&bundle.currency_display)
            .await
            .expect("seed currency_display");
        state
            .config_store
            .save_gated_network_config(&bundle.network_config)
            .await
            .expect("seed network_config");
        state
            .config_store
            .save_lease_rules(&bundle.lease_rules)
            .await
            .expect("seed lease_rules");
        state
            .config_store
            .save_swap_settings(&bundle.swap_settings)
            .await
            .expect("seed swap_settings");
        state
            .config_store
            .save_ui_settings(&bundle.ui_settings)
            .await
            .expect("seed ui_settings");

        refresh_gated_config(&state).await;

        assert!(state.data_cache.gated_config.is_populated());
        let loaded = state.data_cache.gated_config.load().expect("populated");
        assert!(loaded.currency_display.currencies.contains_key("USDC"));
        assert!(loaded.network_config.networks.contains_key("NOLUS"));
    }

    #[tokio::test]
    async fn refresh_gated_config_keeps_stale_on_disk_error() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        // Seed an in-memory bundle first…
        state.data_cache.gated_config.store(sample_gated_bundle());
        // …but never write files to disk, so load_* will fail (NotFound).
        // A real-world "disk error" covers the same code path that warn!s and
        // leaves the previous bundle in place.
        refresh_gated_config(&state).await;

        assert!(state.data_cache.gated_config.is_populated());
    }

    // =======================================================================
    // refresh_currencies
    // =======================================================================

    #[tokio::test]
    async fn refresh_currencies_populates_on_success() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_currencies_json_with_usdc()))
            .mount(&etl)
            .await;

        refresh_currencies(&state).await;

        let loaded = state
            .data_cache
            .currencies
            .load()
            .expect("currencies populated");
        assert!(loaded
            .currencies
            .contains_key("USDC@OSMOSIS-OSMOSIS-USDC_NOBLE"));
    }

    #[tokio::test]
    async fn refresh_currencies_noop_without_gated_config() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_currencies_json_with_usdc()))
            .mount(&etl)
            .await;

        refresh_currencies(&state).await;

        assert!(!state.data_cache.currencies.is_populated());
    }

    #[tokio::test]
    async fn refresh_currencies_keeps_stale_on_etl_failure() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());
        state.data_cache.currencies.store(sentinel_currencies());

        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(502).set_body_string("upstream exploded"))
            .mount(&etl)
            .await;

        refresh_currencies(&state).await;

        let loaded = state.data_cache.currencies.load().expect("stale retained");
        assert!(loaded.currencies.contains_key("SENT@P"));
    }

    #[tokio::test]
    async fn refresh_currencies_filters_ignored_assets() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state
            .data_cache
            .gated_config
            .store(gated_bundle_with_ignore(vec!["STRD"]));

        let body = json!({
            "currencies": [
                {
                    "ticker": "STRD",
                    "decimal_digits": 6,
                    "is_active": true,
                    "protocols": [
                        {
                            "protocol": "OSMOSIS-OSMOSIS-USDC_NOBLE",
                            "group": "lease",
                            "bank_symbol": "ustrd",
                            "dex_symbol": "ibc/ustrd"
                        }
                    ]
                }
            ],
            "count": 1,
            "active_count": 1,
            "deprecated_count": 0
        });

        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&etl)
            .await;

        refresh_currencies(&state).await;

        let loaded = state.data_cache.currencies.load().expect("populated");
        let strd = loaded
            .currencies
            .get("STRD@OSMOSIS-OSMOSIS-USDC_NOBLE")
            .expect("STRD entry must exist");
        assert!(!strd.is_active, "ignored asset must be marked inactive");
    }

    #[tokio::test]
    async fn refresh_currencies_filters_by_active_protocols() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        // Only PROTOCOL_A is active.
        let mut pc: ProtocolContractsMap = HashMap::new();
        pc.insert(
            "PROTOCOL_A".to_string(),
            ProtocolContractsInfo {
                oracle: "nolus1oracleA".to_string(),
                lpp: "nolus1lppA".to_string(),
                leaser: "nolus1leaserA".to_string(),
                profit: "nolus1profitA".to_string(),
                reserve: None,
            },
        );
        state.data_cache.protocol_contracts.store(pc);

        let body = json!({
            "currencies": [
                {
                    "ticker": "ATOM",
                    "decimal_digits": 6,
                    "is_active": true,
                    "protocols": [
                        {
                            "protocol": "PROTOCOL_A",
                            "group": "lease",
                            "bank_symbol": "ibc/atomA",
                            "dex_symbol": "ibc/atomA-dex"
                        },
                        {
                            "protocol": "PROTOCOL_B",
                            "group": "lease",
                            "bank_symbol": "ibc/atomB",
                            "dex_symbol": "ibc/atomB-dex"
                        }
                    ]
                }
            ],
            "count": 1,
            "active_count": 1,
            "deprecated_count": 0
        });

        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(body))
            .mount(&etl)
            .await;

        refresh_currencies(&state).await;

        let loaded = state.data_cache.currencies.load().expect("populated");
        assert!(loaded.currencies.contains_key("ATOM@PROTOCOL_A"));
        assert!(!loaded.currencies.contains_key("ATOM@PROTOCOL_B"));
    }

    // =======================================================================
    // refresh_prices
    // =======================================================================

    #[tokio::test]
    async fn refresh_prices_noop_without_app_config() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.currencies.store(sentinel_currencies());
        refresh_prices(&state).await;
        assert!(!state.data_cache.prices.is_populated());
    }

    #[tokio::test]
    async fn refresh_prices_noop_without_currencies() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.app_config.store(sentinel_app_config());
        refresh_prices(&state).await;
        assert!(!state.data_cache.prices.is_populated());
    }

    #[tokio::test]
    async fn refresh_prices_skips_protocol_without_oracle() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        // app_config with a protocol that has NO oracle set.
        let mut cfg = sentinel_app_config();
        cfg.protocols
            .get_mut("SENTINEL")
            .expect("sentinel exists")
            .contracts
            .oracle = None;
        state.data_cache.app_config.store(cfg);
        state.data_cache.currencies.store(sentinel_currencies());

        refresh_prices(&state).await;

        // The prices cache is still populated (with empty prices), because
        // refresh_prices always stores the final map — but we expect no entries
        // for the skipped protocol.
        let loaded = state
            .data_cache
            .prices
            .load()
            .expect("prices should still be stored (possibly empty)");
        assert!(!loaded.prices.keys().any(|k| k.ends_with("@SENTINEL")));
    }

    // =======================================================================
    // refresh_pools
    // =======================================================================

    #[tokio::test]
    async fn refresh_pools_noop_without_contracts() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        refresh_pools(&state).await;
        assert!(!state.data_cache.pools.is_populated());
    }

    // =======================================================================
    // refresh_validators
    // =======================================================================

    fn validators_body() -> serde_json::Value {
        json!({
            "validators": [
                {
                    "operator_address": "nolusvaloper1abc",
                    "consensus_pubkey": null,
                    "jailed": false,
                    "status": "BOND_STATUS_BONDED",
                    "tokens": "1000000000",
                    "delegator_shares": "1000000000.000000000000000000",
                    "description": {
                        "moniker": "Test Validator",
                        "identity": null,
                        "website": null,
                        "details": null
                    },
                    "unbonding_height": "0",
                    "unbonding_time": "1970-01-01T00:00:00Z",
                    "commission": {
                        "commission_rates": {
                            "rate": "0.100000000000000000",
                            "max_rate": "0.200000000000000000",
                            "max_change_rate": "0.010000000000000000"
                        }
                    }
                }
            ]
        })
    }

    #[tokio::test]
    async fn refresh_validators_populates_on_success() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/cosmos/staking/v1beta1/validators"))
            .respond_with(ResponseTemplate::new(200).set_body_json(validators_body()))
            .mount(&chain)
            .await;

        refresh_validators(&state).await;

        let loaded = state
            .data_cache
            .validators
            .load()
            .expect("validators populated");
        // Three bonded-status queries each return the same validator, so we
        // expect 3 entries (plan treats this as "all 3 statuses").
        assert_eq!(loaded.len(), 3);
        assert!(loaded
            .iter()
            .all(|v| matches!(v.status, ValidatorStatus::Bonded)));
    }

    #[tokio::test]
    async fn refresh_validators_keeps_stale_on_chain_error() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;
        let sentinel = vec![Validator {
            operator_address: "nolusvaloper1sentinel".to_string(),
            moniker: "Sentinel".to_string(),
            identity: None,
            website: None,
            details: None,
            commission_rate: "0.1".to_string(),
            max_commission_rate: "0.2".to_string(),
            max_commission_change_rate: "0.01".to_string(),
            tokens: "1".to_string(),
            delegator_shares: "1".to_string(),
            unbonding_height: "0".to_string(),
            unbonding_time: "1970-01-01T00:00:00Z".to_string(),
            status: ValidatorStatus::Bonded,
            jailed: false,
        }];
        state.data_cache.validators.store(sentinel);

        Mock::given(method("GET"))
            .and(path("/cosmos/staking/v1beta1/validators"))
            .respond_with(ResponseTemplate::new(500).set_body_string("chain oops"))
            .mount(&chain)
            .await;

        refresh_validators(&state).await;

        let loaded = state.data_cache.validators.load().expect("stale retained");
        assert_eq!(loaded.len(), 1);
        assert_eq!(loaded[0].operator_address, "nolusvaloper1sentinel");
    }

    // =======================================================================
    // refresh_annual_inflation / refresh_staking_pool
    // =======================================================================

    #[tokio::test]
    async fn refresh_annual_inflation_populates_on_success() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/nolus/mint/v1beta1/annual_inflation"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(json!({ "annual_inflation": "0.1234" })),
            )
            .mount(&chain)
            .await;

        refresh_annual_inflation(&state).await;

        let loaded = state.data_cache.annual_inflation.load().expect("populated");
        assert_eq!(loaded.annual_inflation, "0.1234");
    }

    #[tokio::test]
    async fn refresh_annual_inflation_keeps_stale_on_chain_error() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;
        state
            .data_cache
            .annual_inflation
            .store(AnnualInflationResponse {
                annual_inflation: "sentinel".to_string(),
            });

        Mock::given(method("GET"))
            .and(path("/nolus/mint/v1beta1/annual_inflation"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&chain)
            .await;

        refresh_annual_inflation(&state).await;

        let loaded = state
            .data_cache
            .annual_inflation
            .load()
            .expect("stale retained");
        assert_eq!(loaded.annual_inflation, "sentinel");
    }

    #[tokio::test]
    async fn refresh_staking_pool_populates_on_success() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/cosmos/staking/v1beta1/pool"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "pool": {
                    "not_bonded_tokens": "1",
                    "bonded_tokens": "2"
                }
            })))
            .mount(&chain)
            .await;

        refresh_staking_pool(&state).await;

        let loaded = state.data_cache.staking_pool.load().expect("populated");
        assert_eq!(loaded.pool.bonded_tokens, "2");
    }

    #[tokio::test]
    async fn refresh_staking_pool_keeps_stale_on_chain_error() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.staking_pool.store(StakingPoolResponse {
            pool: StakingPool {
                not_bonded_tokens: "sn".to_string(),
                bonded_tokens: "sb".to_string(),
            },
        });

        Mock::given(method("GET"))
            .and(path("/cosmos/staking/v1beta1/pool"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&chain)
            .await;

        refresh_staking_pool(&state).await;

        let loaded = state
            .data_cache
            .staking_pool
            .load()
            .expect("stale retained");
        assert_eq!(loaded.pool.bonded_tokens, "sb");
    }

    // =======================================================================
    // refresh_gas_fee_config
    // =======================================================================

    #[tokio::test]
    async fn refresh_gas_fee_config_noop_without_gated_config() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/nolus/tax/v2/params"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "params": {
                    "fee_rate": 0,
                    "base_denom": "unls",
                    "dex_fee_params": [],
                    "treasury_address": "nolus1treasury"
                }
            })))
            .mount(&chain)
            .await;

        refresh_gas_fee_config(&state).await;
        assert!(!state.data_cache.gas_fee_config.is_populated());
    }

    #[tokio::test]
    async fn refresh_gas_fee_config_populates_on_success() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        Mock::given(method("GET"))
            .and(path("/nolus/tax/v2/params"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "params": {
                    "fee_rate": 10,
                    "base_denom": "unls",
                    "dex_fee_params": [
                        {
                            "profit_address": "nolus1profit",
                            "accepted_denoms_min_prices": [
                                { "denom": "ibc/ABC", "ticker": "ATOM", "min_price": "0.01" }
                            ]
                        }
                    ],
                    "treasury_address": "nolus1treasury"
                }
            })))
            .mount(&chain)
            .await;

        refresh_gas_fee_config(&state).await;

        let loaded: GasFeeConfigResponse =
            state.data_cache.gas_fee_config.load().expect("populated");
        assert!(loaded.gas_prices.contains_key("unls"));
        assert!(loaded.gas_prices.contains_key("ibc/ABC"));
        // Matches gas_multiplier from sample_gated_bundle NOLUS entry.
        assert!((loaded.gas_multiplier - 3.5).abs() < f64::EPSILON);
    }

    #[tokio::test]
    async fn refresh_gas_fee_config_noop_when_nolus_missing_from_network_config() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;

        // Bundle with NO NOLUS network entry.
        let mut bundle = sample_gated_bundle();
        bundle.network_config.networks.remove("NOLUS");
        state.data_cache.gated_config.store(bundle);

        Mock::given(method("GET"))
            .and(path("/nolus/tax/v2/params"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "params": {
                    "fee_rate": 0,
                    "base_denom": "unls",
                    "dex_fee_params": [],
                    "treasury_address": "nolus1treasury"
                }
            })))
            .mount(&chain)
            .await;

        refresh_gas_fee_config(&state).await;
        assert!(!state.data_cache.gas_fee_config.is_populated());
    }

    // =======================================================================
    // refresh_filter_context
    // =======================================================================

    #[tokio::test]
    async fn refresh_filter_context_noop_without_gated_config() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_protocols_json()))
            .mount(&etl)
            .await;

        refresh_filter_context(&state).await;
        assert!(!state.data_cache.filter_context.is_populated());
    }

    #[tokio::test]
    async fn refresh_filter_context_populates_on_success() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_protocols_json()))
            .mount(&etl)
            .await;

        refresh_filter_context(&state).await;
        assert!(state.data_cache.filter_context.is_populated());
    }

    #[tokio::test]
    async fn refresh_filter_context_noop_on_etl_error() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
            .mount(&etl)
            .await;

        refresh_filter_context(&state).await;
        assert!(!state.data_cache.filter_context.is_populated());
    }

    // =======================================================================
    // refresh_gated_assets / refresh_gated_protocols / refresh_gated_networks
    // =======================================================================

    #[tokio::test]
    async fn refresh_gated_assets_noop_without_gated_config() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        refresh_gated_assets(&state).await;
        assert!(!state.data_cache.gated_assets.is_populated());
    }

    #[tokio::test]
    async fn refresh_gated_assets_noop_without_prices() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_protocols_json()))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_currencies_json_with_usdc()))
            .mount(&etl)
            .await;

        refresh_gated_assets(&state).await;
        assert!(!state.data_cache.gated_assets.is_populated());
    }

    #[tokio::test]
    async fn refresh_gated_protocols_noop_without_gated_config() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        refresh_gated_protocols(&state).await;
        assert!(!state.data_cache.gated_protocols.is_populated());
    }

    #[tokio::test]
    async fn refresh_gated_protocols_keeps_stale_on_etl_error() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        // Pre-seed a sentinel gated_protocols cache.
        state
            .data_cache
            .gated_protocols
            .store(crate::data_cache::GatedProtocolsResponse {
                count: 42,
                protocols: Vec::new(),
            });

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(500))
            .mount(&etl)
            .await;

        refresh_gated_protocols(&state).await;

        let loaded = state
            .data_cache
            .gated_protocols
            .load()
            .expect("stale retained");
        assert_eq!(loaded.count, 42);
    }

    #[tokio::test]
    async fn refresh_gated_networks_populates_from_config_only() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        refresh_gated_networks(&state).await;

        assert!(state.data_cache.gated_networks.is_populated());
    }

    // =======================================================================
    // refresh_stats_overview / refresh_loans_stats
    // =======================================================================

    #[tokio::test]
    async fn refresh_stats_overview_stores_partial_batch_on_mixed_failures() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;

        // 3 succeed, 2 fail.
        Mock::given(method("GET"))
            .and(path("/api/total-value-locked"))
            .respond_with(
                ResponseTemplate::new(200).set_body_json(json!({"total_value_locked": "1"})),
            )
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/total-tx-value"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({"total_tx_value": "2"})))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/buyback-total"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({"buyback_total": "3"})))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/realized-pnl-stats"))
            .respond_with(ResponseTemplate::new(500).set_body_string("fail"))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/revenue"))
            .respond_with(ResponseTemplate::new(500).set_body_string("fail"))
            .mount(&etl)
            .await;

        refresh_stats_overview(&state).await;

        let loaded: StatsOverviewBatch = state.data_cache.stats_overview.load().expect("populated");
        assert!(loaded.tvl.is_some());
        assert!(loaded.tx_volume.is_some());
        assert!(loaded.buyback_total.is_some());
        // The 2 failures produce JSON error payloads (mock returns non-JSON
        // "fail"); fetch_json treats a non-JSON body as an error and `.ok()`
        // coerces to None.
        assert!(loaded.realized_pnl_stats.is_none());
        assert!(loaded.revenue.is_none());
    }

    #[tokio::test]
    async fn refresh_stats_overview_stores_all_none_on_all_failures() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;

        for p in [
            "/api/total-value-locked",
            "/api/total-tx-value",
            "/api/buyback-total",
            "/api/realized-pnl-stats",
            "/api/revenue",
        ] {
            Mock::given(method("GET"))
                .and(path(p))
                .respond_with(ResponseTemplate::new(500).set_body_string("fail"))
                .mount(&etl)
                .await;
        }

        refresh_stats_overview(&state).await;

        let loaded: StatsOverviewBatch = state.data_cache.stats_overview.load().expect("populated");
        assert!(loaded.tvl.is_none());
        assert!(loaded.tx_volume.is_none());
        assert!(loaded.buyback_total.is_none());
        assert!(loaded.realized_pnl_stats.is_none());
        assert!(loaded.revenue.is_none());
    }

    #[tokio::test]
    async fn refresh_loans_stats_stores_partial_batch() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;

        Mock::given(method("GET"))
            .and(path("/api/open-position-value"))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({"value": "1"})))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/open-interest"))
            .respond_with(ResponseTemplate::new(500).set_body_string("fail"))
            .mount(&etl)
            .await;

        refresh_loans_stats(&state).await;

        let loaded: LoansStatsBatch = state.data_cache.loans_stats.load().expect("populated");
        assert!(loaded.open_position_value.is_some());
        assert!(loaded.open_interest.is_none());
    }

    // =======================================================================
    // refresh_swap_config
    // =======================================================================

    #[tokio::test]
    async fn refresh_swap_config_noop_without_gated_config() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        refresh_swap_config(&state).await;
        assert!(!state.data_cache.swap_config.is_populated());
    }

    #[tokio::test]
    async fn refresh_swap_config_keeps_stale_on_protocols_error() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        // Pre-seed swap_config with a sentinel.
        state
            .data_cache
            .swap_config
            .store(json!({"sentinel": true}));

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_currencies_json_with_usdc()))
            .mount(&etl)
            .await;

        refresh_swap_config(&state).await;

        let loaded = state.data_cache.swap_config.load().expect("stale retained");
        assert_eq!(loaded, json!({"sentinel": true}));
    }

    #[tokio::test]
    async fn refresh_swap_config_populates_on_success() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_protocols_json()))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(etl_currencies_json_with_usdc()))
            .mount(&etl)
            .await;

        refresh_swap_config(&state).await;

        let loaded = state.data_cache.swap_config.load().expect("populated");
        let obj = loaded.as_object().expect("object");
        assert!(obj.contains_key("blacklist"));
        assert!(obj.contains_key("fee"));
        assert!(obj.contains_key("swap_to_currency"));
        assert!(obj.contains_key("transfers"));
    }

    #[tokio::test]
    async fn refresh_swap_config_excludes_nolus_from_transfers() {
        let (state, etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        // Protocols: include a NOLUS-keyed protocol.
        let protocols_body = json!({
            "protocols": [
                {
                    "name": "NOLUS-PROTO",
                    "network": "nolus",
                    "dex": "\"Nolus\"",
                    "position_type": "long",
                    "lpn_symbol": "USDC",
                    "is_active": true,
                    "contracts": {
                        "leaser": "nolus1leaserN",
                        "lpp": "nolus1lppN",
                        "oracle": "nolus1oracleN",
                        "profit": "nolus1profitN",
                        "reserve": null
                    }
                }
            ],
            "count": 1,
            "active_count": 1,
            "deprecated_count": 0
        });

        let currencies_body = json!({
            "currencies": [
                {
                    "ticker": "NLS",
                    "decimal_digits": 6,
                    "is_active": true,
                    "protocols": [
                        {
                            "protocol": "NOLUS-PROTO",
                            "group": "native",
                            "bank_symbol": "unls",
                            "dex_symbol": "unls"
                        }
                    ]
                }
            ],
            "count": 1,
            "active_count": 1,
            "deprecated_count": 0
        });

        Mock::given(method("GET"))
            .and(path("/api/protocols"))
            .respond_with(ResponseTemplate::new(200).set_body_json(protocols_body))
            .mount(&etl)
            .await;
        Mock::given(method("GET"))
            .and(path("/api/currencies"))
            .respond_with(ResponseTemplate::new(200).set_body_json(currencies_body))
            .mount(&etl)
            .await;

        refresh_swap_config(&state).await;

        let loaded = state.data_cache.swap_config.load().expect("populated");
        let transfers = loaded
            .as_object()
            .and_then(|o| o.get("transfers"))
            .and_then(|t| t.as_object())
            .expect("transfers object");
        assert!(!transfers.contains_key("NOLUS"));
    }

    // =======================================================================
    // refresh_lease_configs
    // =======================================================================

    #[tokio::test]
    async fn refresh_lease_configs_noop_without_gated_config() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        refresh_lease_configs(&state).await;
        assert!(!state.data_cache.lease_configs.is_populated());
    }

    #[tokio::test]
    async fn refresh_lease_configs_noop_without_protocol_contracts() {
        let (state, _etl, _chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());
        refresh_lease_configs(&state).await;
        assert!(!state.data_cache.lease_configs.is_populated());
    }

    #[tokio::test]
    async fn refresh_lease_configs_keeps_stale_when_all_chain_calls_fail() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;
        state.data_cache.gated_config.store(sample_gated_bundle());

        let mut pc: ProtocolContractsMap = HashMap::new();
        pc.insert(
            "P1".to_string(),
            ProtocolContractsInfo {
                oracle: "nolus1oracle1".to_string(),
                lpp: "nolus1lpp1".to_string(),
                leaser: "nolus1leaser1".to_string(),
                profit: "nolus1profit1".to_string(),
                reserve: None,
            },
        );
        state.data_cache.protocol_contracts.store(pc);

        // Pre-seed lease_configs with a sentinel.
        let mut sentinel = HashMap::new();
        sentinel.insert(
            "SENT".to_string(),
            crate::handlers::leases::LeaseConfigResponse {
                protocol: "SENT".to_string(),
                downpayment_ranges: HashMap::new(),
                min_asset: crate::external::chain::AmountSpec {
                    amount: "1".to_string(),
                    ticker: "USDC".to_string(),
                },
                min_transaction: crate::external::chain::AmountSpec {
                    amount: "1".to_string(),
                    ticker: "USDC".to_string(),
                },
            },
        );
        state.data_cache.lease_configs.store(sentinel);

        // All leaser queries 500.
        Mock::given(method("GET"))
            .and(path(
                "/cosmwasm/wasm/v1/contract/nolus1leaser1/smart/eyJjb25maWciOnt9fQ==",
            ))
            .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
            .mount(&chain)
            .await;

        refresh_lease_configs(&state).await;

        let loaded = state
            .data_cache
            .lease_configs
            .load()
            .expect("stale retained");
        assert!(loaded.contains_key("SENT"));
    }

    // =======================================================================
    // refresh_protocol_contracts
    // =======================================================================

    #[tokio::test]
    async fn refresh_protocol_contracts_keeps_stale_on_admin_fetch_error() {
        let (state, _etl, chain) = state_with_wiremock_etl_and_chain().await;
        let mut pc: ProtocolContractsMap = HashMap::new();
        pc.insert(
            "SENT".to_string(),
            ProtocolContractsInfo {
                oracle: "nolus1o".to_string(),
                lpp: "nolus1l".to_string(),
                leaser: "nolus1le".to_string(),
                profit: "nolus1p".to_string(),
                reserve: None,
            },
        );
        state.data_cache.protocol_contracts.store(pc);

        // Any query to admin contract fails.
        Mock::given(method("GET"))
            .and(path_regex_match_any_contract())
            .respond_with(ResponseTemplate::new(500).set_body_string("boom"))
            .mount(&chain)
            .await;

        refresh_protocol_contracts(&state).await;

        let loaded = state
            .data_cache
            .protocol_contracts
            .load()
            .expect("stale retained");
        assert!(loaded.contains_key("SENT"));
    }

    /// Helper matcher that matches any `/cosmwasm/wasm/v1/contract/.../smart/...`
    /// URL. Used to simulate chain-wide 500s without pinning exact query b64.
    fn path_regex_match_any_contract() -> wiremock::matchers::PathRegexMatcher {
        wiremock::matchers::path_regex(r"^/cosmwasm/wasm/v1/contract/.+/smart/.+$")
    }

    // =======================================================================
    // warm_essential_data / start_all smoke tests
    // =======================================================================

    #[tokio::test]
    async fn warm_essential_data_runs_without_panic_on_all_failures() {
        // Use the default `test_app_state` whose 1ms client fails every call.
        let state = crate::test_utils::test_app_state().await;
        warm_essential_data(state.clone()).await;

        // Nothing should be populated — every fetch fast-failed.
        assert!(!state.data_cache.app_config.is_populated());
        assert!(!state.data_cache.currencies.is_populated());
        assert!(!state.data_cache.prices.is_populated());
        assert!(!state.data_cache.gas_fee_config.is_populated());
        assert!(!state.data_cache.annual_inflation.is_populated());
        assert!(!state.data_cache.staking_pool.is_populated());
    }

    #[tokio::test]
    async fn start_all_spawns_tasks_without_panic() {
        let state = crate::test_utils::test_app_state().await;
        let event_channels = crate::chain_events::EventChannels::new();
        start_all(state.clone(), &event_channels);
        // Give the spawned tasks a chance to register with the runtime.
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
        // Dropping `state` here (via scope end) is implicit — if any spawned
        // task held a problematic strong ref, clippy/miri would catch it in CI.
    }
}
