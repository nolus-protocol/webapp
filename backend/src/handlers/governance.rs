//! Governance handlers
//!
//! Provides endpoints for governance proposals, voting, and params.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};
use utoipa::{IntoParams, ToSchema};

use crate::{error::AppError, external::chain, AppState};

// ============================================================================
// Hidden Proposals
// ============================================================================

/// Response for hidden proposals endpoint
#[derive(Debug, Serialize, ToSchema)]
pub struct HiddenProposalsResponse {
    pub hidden_ids: Vec<String>,
}

/// Get hidden proposal IDs
///
/// Returns proposal IDs that should be hidden in the UI (curated via gated config).
#[utoipa::path(
    get,
    path = "/api/governance/hidden-proposals",
    tag = "governance",
    responses(
        (status = 200, description = "List of hidden proposal IDs", body = HiddenProposalsResponse),
        (status = 503, description = "Gated config cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_hidden_proposals(
    State(state): State<Arc<AppState>>,
) -> Result<Json<HiddenProposalsResponse>, AppError> {
    let gated = state
        .data_cache
        .gated_config
        .load_or_unavailable("Gated config")?;
    let ui_settings = gated.ui_settings;

    Ok(Json(HiddenProposalsResponse {
        hidden_ids: ui_settings.hidden_proposals,
    }))
}

// ============================================================================
// Proposals
// ============================================================================

/// Query params for proposals
#[derive(Debug, Deserialize, IntoParams)]
pub struct ProposalsQuery {
    /// Maximum number of proposals to return (defaults to 10).
    pub limit: Option<u32>,
    /// Voter address — when supplied, each voting-period proposal is annotated with `voted`.
    pub voter: Option<String>,
}

/// Proposal response with tally and vote info
#[derive(Debug, Serialize, ToSchema)]
pub struct ProposalResponse {
    pub id: String,
    pub status: String,
    pub final_tally_result: Option<chain::TallyResult>,
    pub submit_time: Option<String>,
    pub deposit_end_time: Option<String>,
    pub voting_start_time: Option<String>,
    pub voting_end_time: Option<String>,
    pub title: Option<String>,
    pub summary: Option<String>,
    /// Raw governance messages attached to this proposal (shape depends on proposal type).
    #[schema(value_type = Vec<Object>)]
    pub messages: Vec<serde_json::Value>,
    pub metadata: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tally: Option<chain::TallyResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voted: Option<bool>,
}

/// Proposals list response
#[derive(Debug, Serialize, ToSchema)]
pub struct ProposalsListResponse {
    pub proposals: Vec<ProposalResponse>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize, ToSchema)]
pub struct PaginationInfo {
    pub total: String,
    pub next_key: Option<String>,
}

/// List governance proposals
///
/// Returns governance proposals in reverse-chronological order. For proposals
/// in the voting period, the live tally is fetched; if `voter` is supplied,
/// each such proposal is annotated with whether that address has voted.
#[utoipa::path(
    get,
    path = "/api/governance/proposals",
    tag = "governance",
    params(ProposalsQuery),
    responses(
        (status = 200, description = "Paginated list of proposals", body = ProposalsListResponse),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_proposals(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProposalsQuery>,
) -> Result<Json<ProposalsListResponse>, AppError> {
    let limit = query.limit.unwrap_or(10);
    debug!("Fetching proposals with limit: {}", limit);

    let proposals_response = state.chain_client.get_proposals(limit, true).await?;

    let mut proposals: Vec<ProposalResponse> = Vec::new();

    for proposal in proposals_response.proposals {
        let mut response = ProposalResponse {
            id: proposal.id.clone(),
            status: proposal.status.clone(),
            final_tally_result: proposal.final_tally_result,
            submit_time: proposal.submit_time,
            deposit_end_time: proposal.deposit_end_time,
            voting_start_time: proposal.voting_start_time,
            voting_end_time: proposal.voting_end_time,
            title: proposal.title,
            summary: proposal.summary,
            messages: proposal.messages,
            metadata: proposal.metadata,
            tally: None,
            voted: None,
        };

        // For voting proposals, fetch tally
        if proposal.status == "PROPOSAL_STATUS_VOTING_PERIOD" {
            match state.chain_client.get_proposal_tally(&proposal.id).await {
                Ok(tally_response) => {
                    response.tally = Some(tally_response.tally);
                }
                Err(e) => {
                    warn!("Failed to fetch tally for proposal {}: {}", proposal.id, e);
                }
            }

            // If voter is provided, check if they voted
            if let Some(ref voter) = query.voter {
                match state
                    .chain_client
                    .get_proposal_vote(&proposal.id, voter)
                    .await
                {
                    Ok(Some(vote_response)) => {
                        response.voted = Some(!vote_response.vote.options.is_empty());
                    }
                    Ok(None) => {
                        response.voted = Some(false);
                    }
                    Err(e) => {
                        warn!(
                            "Failed to check vote for proposal {} voter {}: {}",
                            proposal.id, voter, e
                        );
                    }
                }
            }
        }

        proposals.push(response);
    }

    Ok(Json(ProposalsListResponse {
        proposals,
        pagination: PaginationInfo {
            total: proposals_response.pagination.total,
            next_key: proposals_response.pagination.next_key,
        },
    }))
}

/// Get proposal tally
///
/// Returns the current (live) tally for a proposal.
#[utoipa::path(
    get,
    path = "/api/governance/proposals/{proposal_id}/tally",
    tag = "governance",
    params(
        ("proposal_id" = String, Path, description = "Governance proposal ID"),
    ),
    responses(
        (status = 200, description = "Tally for the given proposal", body = chain::TallyResponse),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_proposal_tally(
    State(state): State<Arc<AppState>>,
    Path(proposal_id): Path<String>,
) -> Result<Json<chain::TallyResponse>, AppError> {
    debug!("Fetching tally for proposal: {}", proposal_id);
    let tally = state.chain_client.get_proposal_tally(&proposal_id).await?;
    Ok(Json(tally))
}

/// Get a voter's vote for a proposal
///
/// Returns the vote cast by `voter` on `proposal_id`, or `null` if the voter
/// has not voted on this proposal.
#[utoipa::path(
    get,
    path = "/api/governance/proposals/{proposal_id}/votes/{voter}",
    tag = "governance",
    params(
        ("proposal_id" = String, Path, description = "Governance proposal ID"),
        ("voter" = String, Path, description = "Voter bech32 address"),
    ),
    responses(
        (status = 200, description = "Vote (nullable if voter has not voted)", body = Option<chain::VoteResponse>),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_proposal_vote(
    State(state): State<Arc<AppState>>,
    Path((proposal_id, voter)): Path<(String, String)>,
) -> Result<Json<Option<chain::VoteResponse>>, AppError> {
    debug!("Fetching vote for proposal {} by {}", proposal_id, voter);
    let vote = state
        .chain_client
        .get_proposal_vote(&proposal_id, &voter)
        .await?;
    Ok(Json(vote))
}

/// Get governance tallying params
///
/// Returns quorum / threshold / veto-threshold parameters used to decide proposals.
#[utoipa::path(
    get,
    path = "/api/governance/params/tallying",
    tag = "governance",
    responses(
        (status = 200, description = "Tallying parameters", body = chain::TallyingParamsResponse),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_tallying_params(
    State(state): State<Arc<AppState>>,
) -> Result<Json<chain::TallyingParamsResponse>, AppError> {
    debug!("Fetching tallying params");
    let params = state.chain_client.get_tallying_params().await?;
    Ok(Json(params))
}

/// Get staking pool (bonded tokens)
///
/// Returns the total bonded / not-bonded token supply — used to compute quorum and APR.
#[utoipa::path(
    get,
    path = "/api/governance/staking-pool",
    tag = "governance",
    responses(
        (status = 200, description = "Staking pool", body = chain::StakingPoolResponse),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_staking_pool(
    State(state): State<Arc<AppState>>,
) -> Result<Json<chain::StakingPoolResponse>, AppError> {
    debug!("Fetching staking pool");
    let pool = state
        .data_cache
        .staking_pool
        .load_or_unavailable("Staking pool")?;
    Ok(Json(pool))
}

/// APR response
#[derive(Debug, Serialize, ToSchema)]
pub struct AprResponse {
    pub annual_inflation: String,
    pub bonded_tokens: String,
    pub apr: f64,
}

/// Get APR
///
/// Combines annual inflation and staking-pool bonded tokens so the frontend can
/// render a staking APR figure.
#[utoipa::path(
    get,
    path = "/api/governance/apr",
    tag = "governance",
    responses(
        (status = 200, description = "APR inputs", body = AprResponse),
        (status = 503, description = "Cache not yet populated", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_apr(State(state): State<Arc<AppState>>) -> Result<Json<AprResponse>, AppError> {
    debug!("Fetching APR");

    let inflation_response = state
        .data_cache
        .annual_inflation
        .load_or_unavailable("Annual inflation")?;
    let pool_response = state
        .data_cache
        .staking_pool
        .load_or_unavailable("Staking pool")?;

    let annual_inflation: f64 = inflation_response.annual_inflation.parse().unwrap_or(0.0);

    // APR calculation: simplified — just return the raw values and let frontend calculate
    let apr = annual_inflation;

    Ok(Json(AprResponse {
        annual_inflation: inflation_response.annual_inflation,
        bonded_tokens: pool_response.pool.bonded_tokens,
        apr,
    }))
}

/// Get account info
///
/// Returns the raw auth account object for an address, used to detect vesting
/// accounts and derive spendable balances.
#[utoipa::path(
    get,
    path = "/api/governance/accounts/{address}",
    tag = "governance",
    params(
        ("address" = String, Path, description = "Nolus bech32 address"),
    ),
    responses(
        (status = 200, description = "Account (shape depends on account type)", body = chain::AccountResponse),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_account(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<chain::AccountResponse>, AppError> {
    debug!("Fetching account for: {}", address);
    let account = state.chain_client.get_account(&address).await?;
    Ok(Json(account))
}

/// Get denom metadata
///
/// Returns bank-module metadata (units, display, description) for a denom, or
/// `null` if the chain has no metadata registered for it.
#[utoipa::path(
    get,
    path = "/api/governance/denoms/{denom}",
    tag = "governance",
    params(
        ("denom" = String, Path, description = "Bank denom (e.g. `unls`, `ibc/...`)"),
    ),
    responses(
        (status = 200, description = "Denom metadata (nullable)", body = Option<chain::DenomMetadata>),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_denom_metadata(
    State(state): State<Arc<AppState>>,
    Path(denom): Path<String>,
) -> Result<Json<Option<chain::DenomMetadata>>, AppError> {
    debug!("Fetching denom metadata for: {}", denom);
    let metadata = state.chain_client.get_denom_metadata(&denom).await?;
    Ok(Json(metadata))
}

/// Node info response
#[derive(Debug, Serialize, ToSchema)]
pub struct NodeInfoResponse {
    pub version: String,
    pub network: String,
}

/// Get node info
///
/// Returns the chain software version and network identifier reported by the
/// node's ABCI info endpoint.
#[utoipa::path(
    get,
    path = "/api/node/info",
    tag = "node",
    responses(
        (status = 200, description = "Node info", body = NodeInfoResponse),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_node_info(
    State(state): State<Arc<AppState>>,
) -> Result<Json<NodeInfoResponse>, AppError> {
    debug!("Fetching node info");
    let info = state.chain_client.get_node_info().await?;
    Ok(Json(info))
}

/// Network status response
#[derive(Debug, Serialize, ToSchema)]
pub struct NetworkStatusResponse {
    pub network: String,
    pub latest_block_height: String,
    pub latest_block_time: String,
    pub catching_up: bool,
}

/// Get network status
///
/// Returns latest block height/time and sync state for the Nolus RPC node.
#[utoipa::path(
    get,
    path = "/api/node/status",
    tag = "node",
    responses(
        (status = 200, description = "Network status", body = NetworkStatusResponse),
        (status = 502, description = "Upstream chain RPC error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_network_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<NetworkStatusResponse>, AppError> {
    debug!("Fetching network status");
    let status = state.chain_client.get_network_status().await?;
    Ok(Json(status))
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::data_cache::GatedConfigBundle;
    use crate::test_utils::{collect_body_str, test_app_state};
    use axum::{body::Body, http::Request, http::StatusCode, routing::get, Router};
    use tower::ServiceExt;

    fn build_app(state: Arc<AppState>) -> Router {
        Router::new()
            .route(
                "/api/governance/hidden-proposals",
                get(get_hidden_proposals),
            )
            .route("/api/governance/proposals", get(get_proposals))
            .route(
                "/api/governance/proposals/{proposal_id}/tally",
                get(get_proposal_tally),
            )
            .with_state(state)
    }

    fn populate_gated(state: &AppState, hidden: Vec<String>) {
        use crate::config_store::gated_types::{
            CurrencyDisplayConfig, GatedNetworkConfig, LeaseRulesConfig, SwapSettingsConfig,
            UiSettingsConfig,
        };
        let ui = UiSettingsConfig {
            hidden_proposals: hidden,
            ..Default::default()
        };
        // Deserialize minimal JSON blobs for the other configs — most have
        // required fields (`api_url`, the flatten-map fields) that make
        // direct struct construction noisy.
        let currency_display: CurrencyDisplayConfig =
            serde_json::from_str("{}").expect("empty currency display");
        let network_config: GatedNetworkConfig =
            serde_json::from_str("{}").expect("empty network config");
        let lease_rules: LeaseRulesConfig = serde_json::from_str("{}").expect("empty lease rules");
        let swap_settings: SwapSettingsConfig =
            serde_json::from_str(r#"{"api_url":"http://stub.invalid/"}"#)
                .expect("minimal swap settings");
        state.data_cache.gated_config.store(GatedConfigBundle {
            currency_display,
            network_config,
            lease_rules,
            swap_settings,
            ui_settings: ui,
        });
    }

    #[tokio::test]
    async fn governance_hidden_proposals_cold_cache_returns_503() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/hidden-proposals")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::SERVICE_UNAVAILABLE);
    }

    #[tokio::test]
    async fn governance_hidden_proposals_returns_list_shape() {
        let state = test_app_state().await;
        populate_gated(&state, vec!["42".to_string(), "99".to_string()]);
        let app = build_app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/hidden-proposals")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(body.contains("\"hidden_ids\""), "body: {body}");
        assert!(body.contains("\"42\""), "body: {body}");
        assert!(body.contains("\"99\""), "body: {body}");
    }

    #[tokio::test]
    async fn governance_proposals_upstream_failure_returns_502() {
        // stub RPC (127.0.0.1:1 + 1ms timeout) ensures chain_client returns an
        // error that maps to 502 BAD_GATEWAY via AppError::ChainRpc.
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals?limit=5")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn governance_proposal_tally_upstream_failure_returns_502() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals/1/tally")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
    }
}
