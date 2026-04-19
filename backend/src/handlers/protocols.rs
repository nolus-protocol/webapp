//! Protocol handlers using ETL as primary data source
//!
//! Provides protocol registry including both active and deprecated protocols.

use axum::{extract::State, Json};
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::sync::Arc;
use utoipa::ToSchema;

use crate::error::AppError;
use crate::external::etl::EtlProtocol;
use crate::handlers::common_types::ProtocolContracts;
use crate::AppState;

/// Protocol information from ETL
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct Protocol {
    pub name: String,
    pub network: Option<String>,
    pub dex: Option<String>,
    pub position_type: String,
    pub lpn: String,
    pub is_active: bool,
    pub contracts: ProtocolContracts,
}

impl From<EtlProtocol> for Protocol {
    fn from(etl: EtlProtocol) -> Self {
        // Clean up dex field - ETL returns it with quotes like "\"Osmosis\""
        let dex = etl.dex.map(|d| d.trim_matches('"').to_string());

        Self {
            name: etl.name,
            network: etl.network,
            dex,
            position_type: etl.position_type.to_lowercase(),
            lpn: etl.lpn_symbol,
            is_active: etl.is_active,
            contracts: etl.contracts.into(),
        }
    }
}

/// Response for /api/protocols endpoint
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct ProtocolsResponse {
    pub protocols: HashMap<String, Protocol>,
    pub count: u32,
    pub active_count: u32,
    pub deprecated_count: u32,
}

/// List all protocols
///
/// Returns the registry of Nolus DeFi sub-protocols (active and deprecated)
/// with contract addresses and lease/LPN metadata.
#[utoipa::path(
    get,
    path = "/api/protocols",
    tag = "protocols",
    responses(
        (status = 200, description = "Protocol registry with counts", body = ProtocolsResponse),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ProtocolsResponse>, AppError> {
    // Read app_config from cache and convert to ProtocolsResponse
    let app_config = state
        .data_cache
        .app_config
        .load_or_unavailable("Protocols")?;

    let mut protocols = HashMap::new();
    let mut active_count = 0u32;
    let mut deprecated_count = 0u32;

    for (name, info) in &app_config.protocols {
        if info.is_active {
            active_count += 1;
        } else {
            deprecated_count += 1;
        }
        protocols.insert(
            name.clone(),
            Protocol {
                name: info.name.clone(),
                network: info.network.clone(),
                dex: info.dex.clone(),
                position_type: info.position_type.clone(),
                lpn: info.lpn.clone(),
                is_active: info.is_active,
                contracts: info.contracts.clone(),
            },
        );
    }

    let count = active_count + deprecated_count;

    Ok(Json(ProtocolsResponse {
        protocols,
        count,
        active_count,
        deprecated_count,
    }))
}

/// List active protocols
///
/// Returns only protocols where `is_active` is `true`.
#[utoipa::path(
    get,
    path = "/api/protocols/active",
    tag = "protocols",
    responses(
        (status = 200, description = "Map of active protocols keyed by name", body = HashMap<String, Protocol>),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_active_protocols(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HashMap<String, Protocol>>, AppError> {
    let response = get_protocols(State(state)).await?;
    let active: HashMap<String, Protocol> = response
        .0
        .protocols
        .into_iter()
        .filter(|(_, p)| p.is_active)
        .collect();
    Ok(Json(active))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::handlers::common_types::ProtocolContracts;
    use crate::handlers::config::{
        AppConfigResponse, ContractsInfo, NativeAssetInfo, ProtocolInfo,
    };
    use crate::test_utils::{collect_body_str, test_app_state};
    use axum::{body::Body, http::Request, http::StatusCode, routing::get, Router};
    use tower::ServiceExt;

    fn build_app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/api/protocols", get(get_protocols))
            .route("/api/protocols/active", get(get_active_protocols))
            .with_state(state)
    }

    fn sample_protocol(name: &str, is_active: bool) -> ProtocolInfo {
        ProtocolInfo {
            name: name.to_string(),
            network: Some("OSMOSIS".to_string()),
            dex: Some("Osmosis".to_string()),
            lpn: "USDC_NOBLE".to_string(),
            position_type: "long".to_string(),
            contracts: ProtocolContracts::default(),
            is_active,
        }
    }

    fn populate_cache(state: &AppState) {
        let mut protocols = HashMap::new();
        protocols.insert("P-ACTIVE".to_string(), sample_protocol("P-ACTIVE", true));
        protocols.insert("P-OLD".to_string(), sample_protocol("P-OLD", false));
        state.data_cache.app_config.store(AppConfigResponse {
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
                dispatcher: "nolus1dispatcher".to_string(),
            },
        });
    }

    #[tokio::test]
    async fn protocols_list_returns_expected_counts() {
        let state = test_app_state().await;
        populate_cache(&state);
        let app = build_app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/protocols")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(body.contains("\"count\":2"), "body: {body}");
        assert!(body.contains("\"active_count\":1"), "body: {body}");
        assert!(body.contains("\"deprecated_count\":1"), "body: {body}");
        assert!(body.contains("\"protocols\""), "body: {body}");
    }

    #[tokio::test]
    async fn protocols_active_filters_out_deprecated() {
        let state = test_app_state().await;
        populate_cache(&state);
        let app = build_app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/protocols/active")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(body.contains("P-ACTIVE"), "body: {body}");
        assert!(!body.contains("P-OLD"), "body: {body}");
    }
}
