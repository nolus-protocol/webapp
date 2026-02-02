use axum::{
    extract::{Path, Query, State},
    Json,
};
use futures::future::join_all;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, error};

use crate::cache_keys;
use crate::error::AppError;
use crate::handlers::config::get_config;
use crate::query_types::AddressQuery;
use crate::AppState;

/// Currency information with all details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyInfo {
    pub key: String,
    pub ticker: String,
    pub symbol: String,
    pub name: String,
    pub decimal_digits: u8,
    pub bank_symbol: String,
    pub protocol: String,
    pub group: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    pub native: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PricesResponse {
    pub prices: HashMap<String, PriceInfo>,
    pub updated_at: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PriceInfo {
    pub key: String,
    pub symbol: String,
    pub price_usd: String,
}



#[derive(Debug, Serialize, Deserialize)]
pub struct BalancesResponse {
    pub balances: Vec<BalanceInfo>,
    pub total_value_usd: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct BalanceInfo {
    pub key: String,
    pub symbol: String,
    pub denom: String,
    pub amount: String,
    pub amount_usd: String,
    pub decimal_digits: u8,
}

/// GET /api/currencies
/// Returns list of all supported currencies from all active protocols
/// Uses request coalescing to deduplicate concurrent requests
pub async fn get_currencies(
    State(state): State<Arc<AppState>>,
) -> Result<Json<Vec<CurrencyInfo>>, AppError> {
    // Use get_or_fetch to coalesce concurrent requests
    let result = state
        .cache
        .config
        .get_or_fetch(cache_keys::config::CURRENCIES, || {
            let state = state.clone();
            async move { fetch_currencies_internal(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    let currencies: Vec<CurrencyInfo> = serde_json::from_value(result)
        .map_err(|e| AppError::Internal(format!("Failed to deserialize currencies: {}", e)))?;

    Ok(Json(currencies))
}

/// Internal function to fetch currencies from all protocols
/// Separated from handler to enable request coalescing
async fn fetch_currencies_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching currencies from Oracle contracts");

    // Get protocol config first (this is also cached)
    let config = get_config(State(state.clone()))
        .await
        .map_err(|e| format!("Failed to get config: {}", e))?;

    let mut currencies = Vec::new();
    let mut seen_keys = std::collections::HashSet::new();

    // Fetch currencies from all protocols in parallel
    let protocols: Vec<_> = config.0.protocols.iter().collect();
    let currency_futures: Vec<_> = protocols
        .iter()
        .map(|(protocol_name, protocol_info)| {
            let chain_client = state.chain_client.clone();
            let oracle = protocol_info.contracts.oracle.clone();
            let protocol_name = (*protocol_name).clone();
            async move {
                let result = chain_client.get_oracle_currencies(&oracle).await;
                (protocol_name, result)
            }
        })
        .collect();

    let currency_results = join_all(currency_futures).await;

    // Process results
    for (protocol_name, result) in currency_results {
        match result {
            Ok(oracle_currencies) => {
                for currency in oracle_currencies {
                    let key = format!("{}@{}", currency.ticker, protocol_name);

                    // Skip duplicates (same currency might exist in multiple protocols)
                    if seen_keys.contains(&key) {
                        continue;
                    }
                    seen_keys.insert(key.clone());

                    let is_native = currency.bank_symbol == "unls";

                    currencies.push(CurrencyInfo {
                        key: key.clone(),
                        ticker: currency.ticker.clone(),
                        symbol: currency.ticker.clone(), // TODO: Map to display symbol
                        name: currency.ticker.clone(),   // TODO: Map to full name
                        decimal_digits: currency.decimal_digits,
                        bank_symbol: currency.bank_symbol,
                        protocol: protocol_name.clone(),
                        group: currency.group,
                        icon: Some(format!(
                            "/assets/icons/currencies/{}.svg",
                            currency.ticker.to_lowercase()
                        )),
                        native: is_native,
                    });
                }
            }
            Err(e) => {
                error!(
                    "Failed to fetch currencies from protocol {}: {}",
                    protocol_name, e
                );
                // Continue with other protocols
            }
        }
    }

    serde_json::to_value(&currencies).map_err(|e| format!("Failed to serialize currencies: {}", e))
}

/// GET /api/currencies/:key
/// Returns details for a specific currency
pub async fn get_currency(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> Result<Json<CurrencyInfo>, AppError> {
    let currencies = get_currencies(State(state)).await?;

    currencies
        .0
        .iter()
        .find(|c| c.key == key || c.ticker == key)
        .cloned()
        .map(Json)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("Currency {}", key),
        })
}

/// GET /api/prices
/// Returns current prices for all currencies
/// Uses request coalescing to deduplicate concurrent requests
pub async fn get_prices(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PricesResponse>, AppError> {
    // Use get_or_fetch to coalesce concurrent requests
    // If multiple requests come in simultaneously, only one will fetch
    let result = state
        .cache
        .prices
        .get_or_fetch(cache_keys::prices::ALL_PRICES, || {
            let state = state.clone();
            async move { fetch_prices_internal(state).await }
        })
        .await
        .map_err(AppError::Internal)?;

    let response: PricesResponse = serde_json::from_value(result)
        .map_err(|e| AppError::Internal(format!("Failed to deserialize prices: {}", e)))?;

    Ok(Json(response))
}

/// Internal function to fetch prices from all protocols
/// Separated from handler to enable request coalescing
async fn fetch_prices_internal(state: Arc<AppState>) -> Result<serde_json::Value, String> {
    debug!("Fetching prices from Oracle contracts");

    // Get protocol config (this is also cached)
    let config = get_config(State(state.clone()))
        .await
        .map_err(|e| format!("Failed to get config: {}", e))?;

    let mut prices = HashMap::new();

    // Fetch prices from all protocols in parallel
    let protocols: Vec<_> = config.0.protocols.iter().collect();
    let price_futures: Vec<_> = protocols
        .iter()
        .map(|(protocol_name, protocol_info)| {
            let chain_client = state.chain_client.clone();
            let oracle = protocol_info.contracts.oracle.clone();
            let protocol_name = (*protocol_name).clone();
            async move {
                let mut protocol_prices = Vec::new();

                // Chain of calls within each protocol (must be sequential due to dependencies)
                let base_currency = match chain_client.get_base_currency(&oracle).await {
                    Ok(bc) => bc,
                    Err(e) => {
                        error!(
                            "Failed to fetch base currency from protocol {}: {}",
                            protocol_name, e
                        );
                        return protocol_prices;
                    }
                };

                let stable_price = match chain_client
                    .get_stable_price(&oracle, &base_currency)
                    .await
                {
                    Ok(sp) => sp,
                    Err(e) => {
                        error!(
                            "Failed to fetch stable price from protocol {}: {}",
                            protocol_name, e
                        );
                        return protocol_prices;
                    }
                };

                // Calculate LPN price in USD
                let lpn_price = calculate_price(
                    &stable_price.amount_quote.amount,
                    &stable_price.amount.amount,
                );

                let lpn_key = format!("{}@{}", base_currency, protocol_name);
                protocol_prices.push((
                    lpn_key.clone(),
                    PriceInfo {
                        key: lpn_key,
                        symbol: base_currency.clone(),
                        price_usd: lpn_price.clone(),
                    },
                ));

                // Get all other prices
                match chain_client.get_oracle_prices(&oracle).await {
                    Ok(oracle_prices) => {
                        for price in oracle_prices.prices {
                            let key = format!("{}@{}", price.amount.ticker, protocol_name);
                            let asset_price = calculate_price_with_lpn(
                                &price.amount_quote.amount,
                                &price.amount.amount,
                                &lpn_price,
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
                        error!(
                            "Failed to fetch prices from protocol {}: {}",
                            protocol_name, e
                        );
                    }
                }

                protocol_prices
            }
        })
        .collect();

    let price_results = join_all(price_futures).await;

    // Merge all protocol prices into single map
    for protocol_prices in price_results {
        for (key, price_info) in protocol_prices {
            prices.insert(key, price_info);
        }
    }

    let response = PricesResponse {
        prices,
        updated_at: chrono::Utc::now().to_rfc3339(),
    };

    serde_json::to_value(&response).map_err(|e| format!("Failed to serialize prices: {}", e))
}

/// GET /api/balances?address=...
/// Returns balances for a wallet address
pub async fn get_balances(
    State(state): State<Arc<AppState>>,
    Query(query): Query<AddressQuery>,
) -> Result<Json<BalancesResponse>, AppError> {
    debug!("Fetching balances for address: {}", query.address);

    // Validate address format
    if !query.address.starts_with("nolus1") {
        return Err(AppError::Validation {
            message: "Invalid Nolus address format".to_string(),
            field: Some("address".to_string()),
            details: None,
        });
    }

    // Fetch balances, currencies, and prices in parallel
    let (bank_balances_result, currencies_result, prices_result) = tokio::join!(
        state.chain_client.get_all_balances(&query.address),
        get_currencies(State(state.clone())),
        get_prices(State(state.clone()))
    );

    let bank_balances = bank_balances_result?;
    let currencies = currencies_result?;
    let prices_response = prices_result?;
    let prices = &prices_response.0.prices;

    let mut balances = Vec::new();
    let mut total_usd = 0.0_f64;

    for bank_balance in bank_balances {
        // Find currency info for this denom
        if let Some(currency) = currencies
            .0
            .iter()
            .find(|c| c.bank_symbol == bank_balance.denom)
        {
            // Calculate USD value (using human-readable amount for USD calculation)
            let amount_f64: f64 = bank_balance.amount.parse().unwrap_or(0.0);
            let decimal_factor = 10_f64.powi(currency.decimal_digits as i32);
            let human_amount = amount_f64 / decimal_factor;

            let price_usd = prices
                .get(&currency.key)
                .and_then(|p| p.price_usd.parse::<f64>().ok())
                .unwrap_or(0.0);

            let amount_usd = human_amount * price_usd;
            total_usd += amount_usd;

            // Return raw amount (not human-readable) for frontend compatibility
            // Frontend uses coin() which expects integer amounts
            balances.push(BalanceInfo {
                key: currency.key.clone(),
                symbol: currency.symbol.clone(),
                denom: bank_balance.denom,
                amount: bank_balance.amount, // Raw amount, not divided
                amount_usd: amount_usd.to_string(),
                decimal_digits: currency.decimal_digits,
            });
        } else {
            // Unknown denom - still include it but without USD value
            balances.push(BalanceInfo {
                key: bank_balance.denom.clone(),
                symbol: bank_balance.denom.clone(),
                denom: bank_balance.denom,
                amount: bank_balance.amount,
                amount_usd: "0".to_string(),
                decimal_digits: 6, // Default
            });
        }
    }

    Ok(Json(BalancesResponse {
        balances,
        total_value_usd: total_usd.to_string(),
    }))
}

/// Calculate price from quote_amount / amount
pub fn calculate_price(quote_amount: &str, amount: &str) -> String {
    let quote: f64 = quote_amount.parse().unwrap_or(0.0);
    let amt: f64 = amount.parse().unwrap_or(1.0);
    if amt == 0.0 {
        return "0".to_string();
    }
    (quote / amt).to_string()
}

/// Calculate price with LPN base: (quote_amount / amount) * lpn_price
pub fn calculate_price_with_lpn(quote_amount: &str, amount: &str, lpn_price: &str) -> String {
    let quote: f64 = quote_amount.parse().unwrap_or(0.0);
    let amt: f64 = amount.parse().unwrap_or(1.0);
    let lpn: f64 = lpn_price.parse().unwrap_or(1.0);
    if amt == 0.0 {
        return "0".to_string();
    }
    ((quote / amt) * lpn).to_string()
}

#[cfg(test)]
mod tests {
    use super::{calculate_price, calculate_price_with_lpn};

    #[test]
    fn test_calculate_price() {
        // Basic division
        assert_eq!(calculate_price("100", "50").parse::<f64>().unwrap(), 2.0);
        assert_eq!(calculate_price("150", "100").parse::<f64>().unwrap(), 1.5);
        // Division by zero
        assert_eq!(calculate_price("100", "0"), "0");
        // Invalid input
        assert_eq!(calculate_price("invalid", "100").parse::<f64>().unwrap(), 0.0);
    }

    #[test]
    fn test_calculate_price_with_lpn() {
        // (100 / 50) * 1.0 = 2.0
        assert_eq!(calculate_price_with_lpn("100", "50", "1.0").parse::<f64>().unwrap(), 2.0);
        // (100 / 50) * 0.5 = 1.0
        assert_eq!(calculate_price_with_lpn("100", "50", "0.5").parse::<f64>().unwrap(), 1.0);
        // Division by zero
        assert_eq!(calculate_price_with_lpn("100", "0", "1.0"), "0");
    }
}
