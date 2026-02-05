//! Currency and Price Handlers
//!
//! Provides currency information, prices from Oracle contracts, and balance queries.

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use tracing::{debug, warn};

use crate::error::AppError;
use crate::query_types::AddressQuery;
use crate::AppState;

/// Currency information with all details needed by frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyInfo {
    pub key: String,
    pub ticker: String,
    pub symbol: String,
    pub name: String,
    pub short_name: String,
    pub decimal_digits: u8,
    /// IBC denom on Nolus chain
    pub bank_symbol: String,
    /// IBC denom on DEX network
    pub dex_symbol: String,
    pub icon: String,
    pub native: bool,
    pub coingecko_id: Option<String>,
    /// Protocol this currency belongs to
    pub protocol: String,
    /// Currency group (lease, lpn, native, payment_only)
    pub group: String,
    /// Whether currency is currently active
    pub is_active: bool,
}

/// Full currencies response for frontend
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrenciesResponse {
    /// All currencies indexed by key (TICKER@PROTOCOL)
    pub currencies: HashMap<String, CurrencyInfo>,
    /// LPN currencies (one per protocol)
    pub lpn: Vec<CurrencyInfo>,
    /// Lease-able currency tickers
    pub lease_currencies: Vec<String>,
    /// Currency key mappings (aliases)
    pub map: HashMap<String, String>,
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
/// Returns full currencies data for frontend including metadata from gated config
/// Reads from background-refreshed cache (zero latency).
pub async fn get_currencies(
    State(state): State<Arc<AppState>>,
) -> Result<Json<CurrenciesResponse>, AppError> {
    let response =
        state
            .data_cache
            .currencies
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Currencies not yet available".to_string(),
            })?;

    Ok(Json(response))
}

/// GET /api/currencies/:key
/// Returns details for a specific currency
pub async fn get_currency(
    State(state): State<Arc<AppState>>,
    Path(key): Path<String>,
) -> Result<Json<CurrencyInfo>, AppError> {
    let response = get_currencies(State(state)).await?;

    // Try exact key match first
    if let Some(currency) = response.0.currencies.get(&key) {
        return Ok(Json(currency.clone()));
    }

    // Try finding by ticker
    for currency in response.0.currencies.values() {
        if currency.ticker == key {
            return Ok(Json(currency.clone()));
        }
    }

    Err(AppError::NotFound {
        resource: format!("Currency {}", key),
    })
}

/// GET /api/prices
/// Returns current prices for all currencies from Oracle contracts
/// Reads from background-refreshed cache (zero latency).
pub async fn get_prices(
    State(state): State<Arc<AppState>>,
) -> Result<Json<PricesResponse>, AppError> {
    let response = state
        .data_cache
        .prices
        .load()
        .ok_or_else(|| AppError::ServiceUnavailable {
            message: "Prices not yet available".to_string(),
        })?;

    Ok(Json(response))
}

/// GET /api/balances?address=...
/// Returns balances for a wallet address
///
/// Balances are filtered based on gated configuration:
/// - Only balances for configured currencies are returned
/// - Currencies in ignore_all are excluded
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

    // Read filter context from cache
    let filter_ctx =
        state
            .data_cache
            .filter_context
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Filter context not yet available".to_string(),
            })?;

    // Read currencies and prices from cache, fetch balances from chain
    let currencies_response =
        state
            .data_cache
            .currencies
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Currencies not yet available".to_string(),
            })?;

    let prices_response =
        state
            .data_cache
            .prices
            .load()
            .ok_or_else(|| AppError::ServiceUnavailable {
                message: "Prices not yet available".to_string(),
            })?;

    let bank_balances = state.chain_client.get_all_balances(&query.address).await?;
    let prices = &prices_response.prices;

    let mut balances = Vec::new();
    let mut total_usd = 0.0_f64;

    for bank_balance in bank_balances {
        // Find currency info for this denom
        let currency = currencies_response
            .currencies
            .values()
            .find(|c| c.bank_symbol == bank_balance.denom);

        if let Some(currency) = currency {
            // Skip if currency is not visible (not configured or in ignore_all)
            if !filter_ctx.is_balance_visible(&currency.ticker) {
                continue;
            }

            // Calculate USD value
            let amount_f64: f64 = bank_balance.amount.parse().unwrap_or_else(|_| {
                warn!(
                    "Failed to parse balance amount for {}: {}",
                    currency.ticker, bank_balance.amount
                );
                0.0
            });
            let decimal_factor = 10_f64.powi(currency.decimal_digits as i32);
            let human_amount = amount_f64 / decimal_factor;

            let price_usd = prices
                .get(&currency.key)
                .and_then(|p| p.price_usd.parse::<f64>().ok())
                .unwrap_or(0.0);

            let amount_usd = human_amount * price_usd;
            total_usd += amount_usd;

            balances.push(BalanceInfo {
                key: currency.key.clone(),
                symbol: currency.symbol.clone(),
                denom: bank_balance.denom,
                amount: bank_balance.amount,
                amount_usd: amount_usd.to_string(),
                decimal_digits: currency.decimal_digits,
            });
        }
        // Note: Unknown denoms are now excluded (gated by default)
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

/// Calculate price with LPN base and decimal adjustment
/// Formula: ((quote_amount / amount) * lpn_price) * 10^(asset_decimals - lpn_decimals)
/// This accounts for the different decimal precisions between the asset and the LPN currency
pub fn calculate_price_with_decimals(
    quote_amount: &str,
    amount: &str,
    lpn_price: &str,
    asset_decimals: u8,
    lpn_decimals: u8,
) -> String {
    let quote: f64 = quote_amount.parse().unwrap_or(0.0);
    let amt: f64 = amount.parse().unwrap_or(1.0);
    let lpn: f64 = lpn_price.parse().unwrap_or(1.0);
    if amt == 0.0 {
        return "0".to_string();
    }

    let mut value = (quote / amt) * lpn;

    // Adjust for decimal difference between asset and LPN
    let decimal_diff = asset_decimals as i16 - lpn_decimals as i16;
    if decimal_diff != 0 {
        let power = 10_f64.powi(decimal_diff.abs() as i32);
        if decimal_diff > 0 {
            value *= power;
        } else {
            value /= power;
        }
    }

    value.to_string()
}

#[cfg(test)]
mod tests {
    use super::{calculate_price, calculate_price_with_decimals};

    #[test]
    fn test_calculate_price() {
        assert_eq!(calculate_price("100", "50").parse::<f64>().unwrap(), 2.0);
        assert_eq!(calculate_price("150", "100").parse::<f64>().unwrap(), 1.5);
        assert_eq!(calculate_price("100", "0"), "0");
        assert_eq!(
            calculate_price("invalid", "100").parse::<f64>().unwrap(),
            0.0
        );
    }

    #[test]
    fn test_calculate_price_with_decimals() {
        // BTC (8 decimals) vs USDC (6 decimals)
        // Raw price would be ~751, but with decimal adjustment should be ~75100
        // Using simplified test values: quote=150, amount=100, lpn_price=1
        // Raw: 150/100 * 1 = 1.5
        // With BTC(8) vs USDC(6): 1.5 * 10^(8-6) = 1.5 * 100 = 150
        let price = calculate_price_with_decimals("150", "100", "1.0", 8, 6);
        assert_eq!(price.parse::<f64>().unwrap(), 150.0);

        // Same decimals should give raw result
        let price_same = calculate_price_with_decimals("150", "100", "1.0", 6, 6);
        assert_eq!(price_same.parse::<f64>().unwrap(), 1.5);

        // Asset has fewer decimals than LPN (e.g., 4 vs 6)
        // Should divide by 10^2 = 100
        let price_fewer = calculate_price_with_decimals("150", "100", "1.0", 4, 6);
        assert_eq!(price_fewer.parse::<f64>().unwrap(), 0.015);

        // Zero amount should return "0"
        assert_eq!(calculate_price_with_decimals("100", "0", "1.0", 8, 6), "0");
    }
}
