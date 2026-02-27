//! Fee configuration handler
//!
//! Endpoints:
//! - GET /api/fees/gas-config - Get gas fee configuration (denoms, prices, multiplier)

use axum::extract::State;
use axum::Json;
use serde::Serialize;
use std::collections::HashMap;
use std::sync::Arc;

use crate::error::AppError;
use crate::AppState;

// ============================================================================
// Response Types
// ============================================================================

/// Gas fee configuration served to the frontend.
/// Replaces the direct ABCI query to `/nolus.tax.v2.Query/Params` from the browser.
#[derive(Debug, Clone, Serialize)]
pub struct GasFeeConfigResponse {
    /// Map of denom -> min gas price (e.g., "ibc/..." -> "0.003")
    pub gas_prices: HashMap<String, String>,
    /// Gas estimate multiplier (e.g., 3.5)
    pub gas_multiplier: f64,
}

// ============================================================================
// Handlers
// ============================================================================

/// GET /api/fees/gas-config
///
/// Returns cached gas fee configuration including accepted fee denoms
/// with their minimum gas prices, and the gas multiplier.
pub async fn get_gas_fee_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<GasFeeConfigResponse>, AppError> {
    let config = state
        .data_cache
        .gas_fee_config
        .load_or_unavailable("Gas fee config")?;

    Ok(Json(config))
}
