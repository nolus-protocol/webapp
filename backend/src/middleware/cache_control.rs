//! Cache-Control header middleware
//!
//! Adds appropriate Cache-Control headers based on endpoint type.

#![allow(dead_code)]

use axum::{
    body::Body,
    http::{header, Request, Response},
    middleware::Next,
};

/// Cache durations for different data types
pub mod durations {
    /// Prices change frequently - very short cache
    pub const PRICES: u32 = 10;
    /// Config rarely changes - long cache
    pub const CONFIG: u32 = 3600;
    /// Webapp config (admin settings) - medium cache
    pub const WEBAPP_CONFIG: u32 = 300;
    /// Validators list - medium cache
    pub const VALIDATORS: u32 = 300;
    /// Earn pools - short cache
    pub const EARN_POOLS: u32 = 60;
    /// Static assets - very long cache
    pub const STATIC: u32 = 86400;
    /// Default for unspecified endpoints
    pub const DEFAULT: u32 = 30;
}

/// Middleware that adds Cache-Control headers based on the request path
pub async fn cache_control_middleware(request: Request<Body>, next: Next) -> Response<Body> {
    let path = request.uri().path().to_string();

    let mut response = next.run(request).await;

    // Only add cache headers to successful responses
    if !response.status().is_success() {
        return response;
    }

    // Determine cache duration based on path
    let max_age = determine_cache_duration(&path);

    // Skip cache headers for real-time endpoints
    if max_age == 0 {
        response
            .headers_mut()
            .insert(header::CACHE_CONTROL, "no-store".parse().unwrap());
    } else {
        response.headers_mut().insert(
            header::CACHE_CONTROL,
            format!(
                "public, max-age={}, stale-while-revalidate={}",
                max_age,
                max_age / 2
            )
            .parse()
            .unwrap(),
        );
    }

    response
}

/// Determine cache duration based on endpoint path
fn determine_cache_duration(path: &str) -> u32 {
    // WebSocket - no caching
    if path.contains("/ws") {
        return 0;
    }

    // Prices - short cache (changes frequently)
    if path.contains("/prices") {
        return durations::PRICES;
    }

    // User-specific data - no caching
    if path.contains("/balances") || path.contains("/leases") {
        return 0;
    }

    // Protocol config - long cache (rarely changes)
    if path == "/api/config" || path.contains("/api/config/protocols") {
        return durations::CONFIG;
    }

    // Webapp config (admin settings) - medium cache
    if path.contains("/webapp/config") || path.contains("/webapp/locales") {
        return durations::WEBAPP_CONFIG;
    }

    // Validators - medium cache
    if path.contains("/validators") {
        return durations::VALIDATORS;
    }

    // Earn pools - short cache
    if path.contains("/earn") {
        return durations::EARN_POOLS;
    }

    // Currencies - long cache (list doesn't change often)
    if path.contains("/currencies") && !path.contains("/prices") {
        return durations::CONFIG;
    }

    // ETL proxy endpoints - vary by type
    if path.contains("/etl/") {
        return determine_etl_cache_duration(path);
    }

    // Admin endpoints - no caching
    if path.contains("/admin/") {
        return 0;
    }

    // Default
    durations::DEFAULT
}

/// Determine cache duration for ETL proxy endpoints
fn determine_etl_cache_duration(path: &str) -> u32 {
    // Time series data - can cache longer since historical
    if path.contains("/prices/") || path.contains("/supplied-borrowed-series") {
        return 60; // 1 minute
    }

    // Pool data - medium cache
    if path.contains("/pools") {
        return 60;
    }

    // TVL/stats - medium cache
    if path.contains("/total-value-locked") || path.contains("/utilization") {
        return 120; // 2 minutes
    }

    // Transaction history - user specific, but can cache briefly
    if path.contains("/txs") || path.contains("/pnl") {
        return 30;
    }

    // Default for ETL
    60
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_duration_prices() {
        assert_eq!(determine_cache_duration("/api/prices"), durations::PRICES);
    }

    #[test]
    fn test_cache_duration_config() {
        assert_eq!(determine_cache_duration("/api/config"), durations::CONFIG);
    }

    #[test]
    fn test_cache_duration_no_cache_balances() {
        assert_eq!(determine_cache_duration("/api/balances"), 0);
    }

    #[test]
    fn test_cache_duration_no_cache_websocket() {
        assert_eq!(determine_cache_duration("/ws"), 0);
    }

    #[test]
    fn test_cache_duration_webapp_config() {
        assert_eq!(
            determine_cache_duration("/api/webapp/config/currencies"),
            durations::WEBAPP_CONFIG
        );
    }

    #[test]
    fn test_cache_duration_etl_pools() {
        assert_eq!(determine_etl_cache_duration("/api/etl/pools"), 60);
    }
}
