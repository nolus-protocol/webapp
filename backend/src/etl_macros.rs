//! ETL proxy macros for reducing handler boilerplate
//!
//! These macros generate typed handlers for ETL API endpoints with consistent:
//! - Error handling
//! - Logging
//! - Response formatting
//! - Type-safe deserialization

/// Generate a typed cached ETL proxy handler
///
/// This version deserializes the response into a specific type and returns
/// a proper typed JSON response with caching and request coalescing.
///
/// Usage:
/// ```ignore
/// etl_proxy_typed!(proxy_tvl, "total-value-locked", TvlResponse, cache_keys::etl::TVL);
/// ```
#[macro_export]
macro_rules! etl_proxy_typed {
    ($fn_name:ident, $endpoint:expr, $response_type:ty, $cache_key:expr) => {
        pub async fn $fn_name(
            axum::extract::State(state): axum::extract::State<std::sync::Arc<$crate::AppState>>,
        ) -> Result<axum::Json<$response_type>, $crate::error::AppError> {
            let url = format!("{}/api/{}", state.config.external.etl_api_url, $endpoint);
            let client = state.etl_client.client.clone();

            // Use get_or_fetch for caching + request coalescing
            let result = state
                .cache
                .data
                .get_or_fetch($cache_key, || async move {
                    match client.get(&url).send().await {
                        Ok(response) => {
                            match response.json::<serde_json::Value>().await {
                                Ok(json) => Ok(json),
                                Err(e) => Err(format!("Failed to parse response: {}", e)),
                            }
                        }
                        Err(e) => Err(format!("ETL API request failed: {}", e)),
                    }
                })
                .await
                .map_err(|e| $crate::error::AppError::Internal(e))?;

            // Deserialize into typed response
            let typed: $response_type = serde_json::from_value(result)
                .map_err(|e| $crate::error::AppError::Internal(
                    format!("Failed to deserialize ETL response: {}", e)
                ))?;

            Ok(axum::Json(typed))
        }
    };
}

/// Generate a typed ETL proxy handler with query parameters
///
/// Usage:
/// ```ignore
/// etl_proxy_typed_with_params!(proxy_earn_apr, "earn-apr", EarnAprResponse, ["protocol"]);
/// ```
#[macro_export]
macro_rules! etl_proxy_typed_with_params {
    ($fn_name:ident, $endpoint:expr, $response_type:ty, [$($param:expr),* $(,)?]) => {
        pub async fn $fn_name(
            axum::extract::State(state): axum::extract::State<std::sync::Arc<$crate::AppState>>,
            axum::extract::Query(query): axum::extract::Query<$crate::handlers::etl_proxy::ProxyQuery>,
        ) -> Result<axum::Json<$response_type>, $crate::error::AppError> {
            let base_url = &state.config.external.etl_api_url;

            // Build query string from parameters
            let mut params: Vec<String> = Vec::new();
            $(
                if let Some(value) = query.params.get($param) {
                    params.push(format!("{}={}", $param, urlencoding::encode(value)));
                }
            )*

            let url = if params.is_empty() {
                format!("{}/api/{}", base_url, $endpoint)
            } else {
                format!("{}/api/{}?{}", base_url, $endpoint, params.join("&"))
            };

            let response = state.etl_client.client
                .get(&url)
                .send()
                .await
                .map_err(|e| $crate::error::AppError::ExternalApi {
                    api: "ETL".to_string(),
                    message: format!("Request failed: {}", e),
                })?;

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| $crate::error::AppError::Internal(
                    format!("Failed to parse ETL response: {}", e)
                ))?;

            let typed: $response_type = serde_json::from_value(json)
                .map_err(|e| $crate::error::AppError::Internal(
                    format!("Failed to deserialize ETL response: {}", e)
                ))?;

            Ok(axum::Json(typed))
        }
    };
}

/// Generate a typed ETL proxy handler with pagination
///
/// Usage:
/// ```ignore
/// etl_proxy_typed_paginated!(proxy_pnl, "ls-loan-closing", LeaseClosingResponse,
///     required: ["address"],
///     optional: [],
///     defaults: [("skip", "0"), ("limit", "10")]
/// );
/// ```
#[macro_export]
macro_rules! etl_proxy_typed_paginated {
    (
        $fn_name:ident,
        $endpoint:expr,
        $response_type:ty,
        required: [$($req_param:expr),* $(,)?],
        optional: [$($opt_param:expr),* $(,)?],
        defaults: [$(($def_param:expr, $def_value:expr)),* $(,)?]
    ) => {
        pub async fn $fn_name(
            axum::extract::State(state): axum::extract::State<std::sync::Arc<$crate::AppState>>,
            axum::extract::Query(query): axum::extract::Query<$crate::handlers::etl_proxy::ProxyQuery>,
        ) -> Result<axum::Json<$response_type>, $crate::error::AppError> {
            let base_url = &state.config.external.etl_api_url;

            let mut params: Vec<String> = Vec::new();

            // Required parameters
            $(
                let value = query.params.get($req_param)
                    .map(|s| urlencoding::encode(s).into_owned())
                    .unwrap_or_default();
                params.push(format!("{}={}", $req_param, value));
            )*

            // Parameters with defaults
            $(
                let value = query.params.get($def_param)
                    .map(|s| urlencoding::encode(s).into_owned())
                    .unwrap_or_else(|| $def_value.to_string());
                params.push(format!("{}={}", $def_param, value));
            )*

            // Optional parameters (only if present)
            $(
                if let Some(value) = query.params.get($opt_param) {
                    if !value.is_empty() {
                        params.push(format!("{}={}", $opt_param, urlencoding::encode(value)));
                    }
                }
            )*

            let url = format!("{}/api/{}?{}", base_url, $endpoint, params.join("&"));

            let response = state.etl_client.client
                .get(&url)
                .send()
                .await
                .map_err(|e| $crate::error::AppError::ExternalApi {
                    api: "ETL".to_string(),
                    message: format!("Request failed: {}", e),
                })?;

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| $crate::error::AppError::Internal(
                    format!("Failed to parse ETL response: {}", e)
                ))?;

            let typed: $response_type = serde_json::from_value(json)
                .map_err(|e| $crate::error::AppError::Internal(
                    format!("Failed to deserialize ETL response: {}", e)
                ))?;

            Ok(axum::Json(typed))
        }
    };
}

/// Generate a typed batch ETL handler with request coalescing
///
/// Each field gets its own typed response, falling back to None on parse failure.
///
/// Usage:
/// ```ignore
/// etl_batch_handler_typed!(
///     batch_stats_overview,
///     StatsOverviewBatch,
///     cache_keys::etl::STATS_OVERVIEW,
///     [
///         (tvl, "total-value-locked", TvlResponse),
///         (tx_volume, "total-tx-value", TxVolumeResponse),
///     ]
/// );
/// ```
#[macro_export]
macro_rules! etl_batch_handler_typed {
    (
        $fn_name:ident,
        $response_type:ident,
        $cache_key:expr,
        [$(($field:ident, $endpoint:expr, $field_type:ty)),* $(,)?]
    ) => {
        pub async fn $fn_name(
            axum::extract::State(state): axum::extract::State<std::sync::Arc<$crate::AppState>>,
        ) -> Result<axum::Json<$response_type>, $crate::error::AppError> {
            let base_url = state.config.external.etl_api_url.clone();
            let client = state.etl_client.client.clone();

            // Use get_or_fetch for caching + request coalescing
            let result = state
                .cache
                .data
                .get_or_fetch($cache_key, || async move {
                    paste::paste! {
                        $(
                            let [<url_ $field>] = format!("{}/api/{}", base_url, $endpoint);
                        )*

                        // Fetch all in parallel
                        let ($($field,)*) = tokio::join!(
                            $(async {
                                $crate::handlers::etl_proxy::fetch_json(&client, &[<url_ $field>])
                                    .await
                                    .ok()
                                    .and_then(|v| serde_json::from_value::<$field_type>(v).ok())
                            },)*
                        );
                    }

                    let response = $response_type {
                        $($field,)*
                    };

                    serde_json::to_value(response)
                        .map_err(|e| format!("Failed to serialize batch response: {}", e))
                })
                .await
                .map_err(|e| $crate::error::AppError::Internal(e))?;

            let typed: $response_type = serde_json::from_value(result)
                .map_err(|e| $crate::error::AppError::Internal(
                    format!("Failed to deserialize cached response: {}", e)
                ))?;

            Ok(axum::Json(typed))
        }
    };
}

/// Generate a raw JSON passthrough ETL proxy handler (no deserialization)
///
/// This version passes through the JSON response directly without
/// attempting to deserialize into a specific type.
///
/// Usage:
/// ```ignore
/// etl_proxy_raw!(proxy_leases_monthly, "leases-monthly", cache_keys::etl::LEASES_MONTHLY);
/// ```
#[macro_export]
macro_rules! etl_proxy_raw {
    ($fn_name:ident, $endpoint:expr, $cache_key:expr) => {
        pub async fn $fn_name(
            axum::extract::State(state): axum::extract::State<std::sync::Arc<$crate::AppState>>,
        ) -> Result<axum::Json<serde_json::Value>, $crate::error::AppError> {
            let url = format!("{}/api/{}", state.config.external.etl_api_url, $endpoint);
            let client = state.etl_client.client.clone();

            // Use get_or_fetch for caching + request coalescing
            let result = state
                .cache
                .data
                .get_or_fetch($cache_key, || async move {
                    match client.get(&url).send().await {
                        Ok(response) => {
                            match response.json::<serde_json::Value>().await {
                                Ok(json) => Ok(json),
                                Err(e) => Err(format!("Failed to parse response: {}", e)),
                            }
                        }
                        Err(e) => Err(format!("ETL API request failed: {}", e)),
                    }
                })
                .await
                .map_err(|e| $crate::error::AppError::Internal(e))?;

            Ok(axum::Json(result))
        }
    };
}

/// Generate a raw JSON passthrough ETL proxy handler with query parameters
///
/// Usage:
/// ```ignore
/// etl_proxy_raw_with_params!(proxy_txs, "txs", ["address", "skip", "limit"]);
/// ```
#[macro_export]
macro_rules! etl_proxy_raw_with_params {
    ($fn_name:ident, $endpoint:expr, [$($param:expr),* $(,)?]) => {
        pub async fn $fn_name(
            axum::extract::State(state): axum::extract::State<std::sync::Arc<$crate::AppState>>,
            axum::extract::Query(query): axum::extract::Query<$crate::handlers::etl_proxy::ProxyQuery>,
        ) -> Result<axum::Json<serde_json::Value>, $crate::error::AppError> {
            let base_url = &state.config.external.etl_api_url;

            // Build query string from parameters
            let mut params: Vec<String> = Vec::new();
            $(
                if let Some(value) = query.params.get($param) {
                    params.push(format!("{}={}", $param, urlencoding::encode(value)));
                }
            )*

            let url = if params.is_empty() {
                format!("{}/api/{}", base_url, $endpoint)
            } else {
                format!("{}/api/{}?{}", base_url, $endpoint, params.join("&"))
            };

            let response = state.etl_client.client
                .get(&url)
                .send()
                .await
                .map_err(|e| $crate::error::AppError::ExternalApi {
                    api: "ETL".to_string(),
                    message: format!("Request failed: {}", e),
                })?;

            let json: serde_json::Value = response
                .json()
                .await
                .map_err(|e| $crate::error::AppError::Internal(
                    format!("Failed to parse ETL response: {}", e)
                ))?;

            Ok(axum::Json(json))
        }
    };
}

#[cfg(test)]
mod tests {
    #[test]
    fn test_macros_compile() {
        // This test just verifies the macros compile correctly
        // Actual functionality is tested in the etl_proxy module
    }
}
