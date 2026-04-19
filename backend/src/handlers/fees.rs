//! Fee configuration handler
//!
//! Endpoints:
//! - GET /api/fees/gas-config - Get gas fee configuration (denoms, prices, multiplier)

use axum::extract::State;
use axum::Json;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::error::AppError;
use crate::AppState;

// ============================================================================
// Response Types
// ============================================================================

/// Gas fee configuration served to the frontend.
/// Replaces the direct ABCI query to `/nolus.tax.v2.Query/Params` from the browser.
#[derive(Debug, Clone, Serialize, ToSchema)]
pub struct GasFeeConfigResponse {
    /// Map of denom -> min gas price (e.g., "ibc/..." -> "0.003")
    pub gas_prices: HashMap<String, String>,
    /// Gas estimate multiplier (e.g., 3.5)
    pub gas_multiplier: f64,
}

// ============================================================================
// Handlers
// ============================================================================

/// Get gas fee configuration
///
/// Returns accepted fee denoms with their minimum gas prices plus the gas
/// estimate multiplier used by the app.
#[utoipa::path(
    get,
    path = "/api/fees/gas-config",
    tag = "fees",
    responses(
        (status = 200, description = "Gas fee configuration", body = GasFeeConfigResponse),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_gas_fee_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<GasFeeConfigResponse>, AppError> {
    let config = state
        .data_cache
        .gas_fee_config
        .load_or_unavailable("Gas fee config")?;

    Ok(Json(config))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::{collect_body_str, test_app_state};
    use axum::{body::Body, http::Request, http::StatusCode, routing::get, Router};
    use tower::ServiceExt;

    fn app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/api/fees/gas-config", get(get_gas_fee_config))
            .with_state(state)
    }

    #[tokio::test]
    async fn fees_gas_config_cold_cache_returns_503() {
        let state = test_app_state().await;
        let app = app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/fees/gas-config")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("router call");

        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("SERVICE_UNAVAILABLE"),
            "expected SERVICE_UNAVAILABLE code, got: {body}"
        );
        assert!(
            body.contains("Gas fee config"),
            "expected field name in message, got: {body}"
        );
    }

    #[tokio::test]
    async fn fees_gas_config_populated_cache_returns_200_with_expected_shape() {
        let state = test_app_state().await;
        let mut gas_prices = HashMap::new();
        gas_prices.insert("unls".to_string(), "0.003".to_string());
        state.data_cache.gas_fee_config.store(GasFeeConfigResponse {
            gas_prices,
            gas_multiplier: 3.5,
        });
        let app = app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/fees/gas-config")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .expect("router call");

        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(body.contains("\"gas_prices\""), "body: {body}");
        assert!(body.contains("\"gas_multiplier\""), "body: {body}");
        assert!(body.contains("3.5"), "body: {body}");
    }
}
