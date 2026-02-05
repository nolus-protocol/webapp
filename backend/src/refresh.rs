//! Background refresh tasks for the data cache
//!
//! Each function refreshes a single `Cached<T>` field in `AppDataCache`.
//! `start_all()` spawns them on appropriate intervals.
//! `warm_essential_data()` runs blocking at startup before the server accepts requests.

use std::collections::HashMap;
use std::sync::Arc;

use futures::future::join_all;
use tracing::{debug, error, info, warn};

use crate::data_cache::GatedConfigBundle;
use crate::external::chain::ProtocolContractsInfo;
use crate::handlers::config::{
    AppConfigResponse, ContractsInfo, NativeAssetInfo, NetworkInfo, ProtocolInfo,
};
use crate::handlers::currencies::{
    calculate_price, calculate_price_with_decimals, CurrenciesResponse, CurrencyInfo, PriceInfo,
    PricesResponse,
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
    );

    info!("Essential data warm-up complete");
}

/// Start all background refresh tasks on their respective intervals.
pub fn start_all(state: Arc<AppState>) {
    // Fast refresh: prices (15s)
    spawn_refresh("prices", state.clone(), 15, |s| Box::pin(refresh_prices(s)));

    // Medium refresh: filter context (30s)
    spawn_refresh("filter_context", state.clone(), 30, |s| {
        Box::pin(refresh_filter_context(s))
    });

    // Standard refresh: most data (60s)
    spawn_refresh("gated_config", state.clone(), 60, |s| {
        Box::pin(refresh_gated_config(s))
    });
    spawn_refresh("protocol_contracts", state.clone(), 60, |s| {
        Box::pin(refresh_protocol_contracts(s))
    });
    spawn_refresh("app_config", state.clone(), 60, |s| {
        Box::pin(refresh_app_config(s))
    });
    spawn_refresh("currencies", state.clone(), 60, |s| {
        Box::pin(refresh_currencies(s))
    });
    spawn_refresh("pools", state.clone(), 60, |s| Box::pin(refresh_pools(s)));
    spawn_refresh("validators", state.clone(), 60, |s| {
        Box::pin(refresh_validators(s))
    });
    spawn_refresh("gated_assets", state.clone(), 60, |s| {
        Box::pin(refresh_gated_assets(s))
    });
    spawn_refresh("gated_protocols", state.clone(), 60, |s| {
        Box::pin(refresh_gated_protocols(s))
    });
    spawn_refresh("gated_networks", state.clone(), 60, |s| {
        Box::pin(refresh_gated_networks(s))
    });
    spawn_refresh("stats_overview", state.clone(), 60, |s| {
        Box::pin(refresh_stats_overview(s))
    });
    spawn_refresh("loans_stats", state.clone(), 60, |s| {
        Box::pin(refresh_loans_stats(s))
    });
    spawn_refresh("lease_configs", state.clone(), 60, |s| {
        Box::pin(refresh_lease_configs(s))
    });

    // Slow refresh: swap config (300s)
    spawn_refresh("swap_config", state.clone(), 300, |s| {
        Box::pin(refresh_swap_config(s))
    });

    info!("All background refresh tasks started");
}

/// Spawn a single refresh task that runs on an interval.
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
    let mut currencies_map: HashMap<String, CurrencyInfo> = HashMap::new();
    let mut lpn_currencies: Vec<CurrencyInfo> = Vec::new();
    let mut lease_currencies_set: std::collections::HashSet<String> =
        std::collections::HashSet::new();

    for etl_currency in etl_response.currencies {
        let display = currency_config.currencies.get(&etl_currency.ticker);

        for protocol_mapping in etl_currency.protocols {
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
                is_active: etl_currency.is_active,
            };

            if is_lpn && etl_currency.is_active {
                lpn_currencies.push(currency_info.clone());
            }

            if protocol_mapping.group == "lease" && etl_currency.is_active {
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
        .map(|(protocol_name, protocol_info)| {
            let chain_client = state.chain_client.clone();
            let oracle = protocol_info.contracts.oracle.clone().unwrap();
            let protocol_name = (*protocol_name).clone();
            let currencies_map = currencies_map.clone();
            async move {
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

                let lpn_price = calculate_price(
                    &stable_price.amount_quote.amount,
                    &stable_price.amount.amount,
                );

                let lpn_key = format!("{}@{}", base_currency, protocol_name);
                let lpn_decimals = currencies_map
                    .get(&lpn_key)
                    .map(|c| c.decimal_digits)
                    .unwrap_or(6);

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
                            let asset_decimals = currencies_map
                                .get(&key)
                                .map(|c| c.decimal_digits)
                                .unwrap_or(6);

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
            }
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
    let admin_address = &state.config.protocols.admin_contract;

    let protocols = match state.chain_client.get_admin_protocols(admin_address).await {
        Ok(p) => p,
        Err(e) => {
            warn!("Failed to refresh pools: {}", e);
            return;
        }
    };

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
            status: crate::handlers::staking::parse_validator_status(&v.status),
            jailed: v.jailed,
        })
        .collect();

    state.data_cache.validators.store(result);
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

    let prices = state.data_cache.prices.load().unwrap_or(PricesResponse {
        prices: HashMap::new(),
        updated_at: String::new(),
    });

    let configured_protocols = PropagationFilter::filter_protocols(
        &etl_protocols,
        &gated.currency_display,
        &gated.network_config,
    );

    let mut assets: Vec<AssetResponse> = Vec::new();

    for currency in &etl_currencies.currencies {
        if !currency.is_active {
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

    let protocols: Vec<ProtocolResponse> = filtered_protocols
        .iter()
        .filter_map(|p| {
            let lpn_display = gated.currency_display.currencies.get(&p.lpn_symbol)?;
            if !lpn_display.is_configured() {
                return None;
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
    let network_config = &gated.network_config;

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

    let mut response = serde_json::Map::new();
    response.insert(
        "api_url".to_string(),
        serde_json::json!(swap_settings.api_url),
    );
    response.insert(
        "blacklist".to_string(),
        serde_json::json!(swap_settings.blacklist),
    );
    response.insert(
        "slippage".to_string(),
        serde_json::json!(swap_settings.slippage),
    );
    response.insert(
        "gas_multiplier".to_string(),
        serde_json::json!(swap_settings.gas_multiplier),
    );
    response.insert("fee".to_string(), serde_json::json!(swap_settings.fee));
    response.insert(
        "fee_address".to_string(),
        serde_json::json!(swap_settings.fee_address.clone().unwrap_or_default()),
    );
    response.insert(
        "timeoutSeconds".to_string(),
        serde_json::json!(swap_settings.timeout_seconds),
    );

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

    let mut venues = Vec::new();
    for network_settings in network_config.networks.values() {
        if let Some(ref venue) = network_settings.swap_venue {
            if let Some(ref address) = venue.address {
                response.insert(venue.name.clone(), serde_json::json!(address));
            }
            venues.push(serde_json::json!({
                "name": venue.name,
                "chain_id": network_settings.chain_id,
            }));
        }
    }
    response.insert("swap_venues".to_string(), serde_json::json!(venues));
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
