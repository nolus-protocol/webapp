//! Governance handlers
//!
//! Provides endpoints for governance proposals, voting, and params.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    http::{HeaderMap, HeaderValue},
    Json,
};
use futures::future;
use serde::{Deserialize, Serialize};
use tracing::{debug, warn};
use utoipa::{IntoParams, ToSchema};

use crate::{error::AppError, external::chain, AppState};

/// Status string the chain reports for proposals currently accepting votes.
const PROPOSAL_STATUS_VOTING_PERIOD: &str = "PROPOSAL_STATUS_VOTING_PERIOD";

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
/// Returns governance proposals in reverse-chronological order from the
/// background-refreshed cache. The response carries `Cache-Status: warm`
/// (with a `Cache-Age` value in seconds) once the refresh task has populated
/// the cache, or `Cache-Status: cold` with an empty list before the first
/// refresh completes — never 503 — so the frontend's `Promise.allSettled`
/// flow can render an empty state without a coordinated rollout.
///
/// Hidden proposals from the gated UI config are filtered at request time
/// against the latest config; cached tallies are attached for voting-period
/// proposals. The fresh tally for a single proposal is available on the
/// per-id `/proposals/{id}/tally` endpoint, which still queries the chain
/// directly. `?voter=` triggers a live `get_proposal_vote` fan-out across
/// voting-period proposals only — a failed lookup is logged and degrades
/// that proposal to `voted: false` ("hasn't voted") instead of failing the
/// request.
#[utoipa::path(
    get,
    path = "/api/governance/proposals",
    tag = "governance",
    params(ProposalsQuery),
    responses(
        (
            status = 200,
            description = "Paginated list of proposals",
            body = ProposalsListResponse,
            headers(
                ("Cache-Status" = String, description = "`warm` when served from the background-refreshed cache, `cold` before the first refresh has populated it (response body is then an empty list)."),
                ("Cache-Age" = String, description = "Age in seconds of the cached snapshot. Present on `warm` responses, omitted on `cold`."),
            ),
        ),
    ),
)]
pub async fn get_proposals(
    State(state): State<Arc<AppState>>,
    Query(query): Query<ProposalsQuery>,
) -> Result<(HeaderMap, Json<ProposalsListResponse>), AppError> {
    let limit = usize::try_from(query.limit.unwrap_or(10)).unwrap_or(usize::MAX);
    debug!("Fetching proposals from cache, limit: {}", limit);

    let cache = &state.data_cache.proposals_with_tally;
    let snapshot = match cache.load() {
        Some(snapshot) => snapshot,
        None => {
            // Cold cache — empty list with explicit header. The handler is
            // never the place that triggers a chain fetch on cold; the
            // background refresh task is the only writer.
            let mut headers = HeaderMap::new();
            headers.insert("Cache-Status", HeaderValue::from_static("cold"));
            return Ok((
                headers,
                Json(ProposalsListResponse {
                    proposals: Vec::new(),
                    pagination: PaginationInfo {
                        total: "0".to_string(),
                        next_key: None,
                    },
                }),
            ));
        }
    };

    // Hidden-proposal filter applies the *latest* gated config — request-time,
    // not cache-time, so toggles take effect immediately.
    let hidden_ids: std::collections::HashSet<String> = state
        .data_cache
        .gated_config
        .load()
        .map(|g| g.ui_settings.hidden_proposals.into_iter().collect())
        .unwrap_or_default();

    let visible: Vec<chain::Proposal> = snapshot
        .proposals
        .into_iter()
        .filter(|p| !hidden_ids.contains(&p.id))
        .collect();
    let total_visible = visible.len();
    let page: Vec<chain::Proposal> = visible.into_iter().take(limit).collect();

    // Live `?voter=` fan-out — only voting-period proposals trigger a vote
    // call. Lookups run concurrently and are tolerant: one failing lookup
    // must not fail the whole list, so a per-proposal error degrades to the
    // same "hasn't voted" shape (voted=false) rather than propagating.
    let voted_map: std::collections::HashMap<String, bool> =
        if let Some(voter) = query.voter.as_deref().filter(|v| !v.is_empty()) {
            let voting_ids: Vec<String> = page
                .iter()
                .filter(|p| p.status == PROPOSAL_STATUS_VOTING_PERIOD)
                .map(|p| p.id.clone())
                .collect();
            let chain_client = state.chain_client.clone();
            let voter = voter.to_string();
            let futs = voting_ids.into_iter().map(|id| {
                let chain_client = chain_client.clone();
                let voter = voter.clone();
                async move {
                    let outcome = chain_client.get_proposal_vote(&id, &voter).await;
                    (id, outcome)
                }
            });
            future::join_all(futs)
                .await
                .into_iter()
                .map(|(id, outcome)| {
                    let voted = match outcome {
                        Ok(Some(vote_response)) => !vote_response.vote.options.is_empty(),
                        Ok(None) => false,
                        Err(error) => {
                            warn!(
                                proposal_id = %id,
                                error = %error,
                                "governance vote lookup failed; treating proposal as not voted"
                            );
                            false
                        }
                    };
                    (id, voted)
                })
                .collect()
        } else {
            std::collections::HashMap::new()
        };

    let proposals: Vec<ProposalResponse> = page
        .into_iter()
        .map(|p| {
            let id = p.id.clone();
            let status = p.status.clone();
            let tally = if status == PROPOSAL_STATUS_VOTING_PERIOD {
                snapshot.tallies.get(&id).cloned()
            } else {
                None
            };
            let voted = voted_map.get(&id).copied();
            ProposalResponse {
                id,
                status,
                final_tally_result: p.final_tally_result,
                submit_time: p.submit_time,
                deposit_end_time: p.deposit_end_time,
                voting_start_time: p.voting_start_time,
                voting_end_time: p.voting_end_time,
                title: p.title,
                summary: p.summary,
                messages: p.messages,
                metadata: p.metadata,
                tally,
                voted,
            }
        })
        .collect();

    let mut headers = HeaderMap::new();
    headers.insert("Cache-Status", HeaderValue::from_static("warm"));
    let age = cache.age_secs().unwrap_or(0);
    if let Ok(value) = HeaderValue::from_str(&age.to_string()) {
        headers.insert("Cache-Age", value);
    }

    Ok((
        headers,
        Json(ProposalsListResponse {
            proposals,
            pagination: PaginationInfo {
                total: total_visible.to_string(),
                next_key: None,
            },
        }),
    ))
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

    // =======================================================================
    // Phase 1 cache refactor — proposals served from `proposals_with_tally`.
    // =======================================================================

    use std::collections::HashMap;
    use wiremock::matchers::{method as wm_method, path as wm_path};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    /// Build an `AppState` whose chain HTTP client uses a realistic timeout
    /// and points at the supplied mock chain URL. Mirrors the helper in
    /// `etl_proxy.rs::tests::state_with_etl_url`. Required for the live
    /// `?voter` fan-out and per-id tally tests where chain calls actually
    /// have to land on the wiremock.
    async fn state_with_chain_url(chain_url: &str) -> Arc<AppState> {
        use crate::config_store::ConfigStore;
        use crate::handlers::websocket::WebSocketManager;
        use crate::translations::{
            llm::{LlmClient, LlmConfig},
            TranslationStorage,
        };
        use std::time::Instant;

        let mut cfg = crate::test_utils::test_config();
        cfg.external.nolus_rest_url = chain_url.to_string();

        let http_client = reqwest::Client::builder()
            .timeout(std::time::Duration::from_secs(5))
            .build()
            .expect("reqwest client");

        let etl_client = crate::external::etl::EtlClient::new(
            cfg.external.etl_api_url.clone(),
            http_client.clone(),
        );
        let skip_client = crate::external::skip::SkipClient::new(
            cfg.external.skip_api_url.clone(),
            cfg.external.skip_api_key.clone(),
            http_client.clone(),
        );
        let chain_client = crate::external::chain::ChainClient::new(
            cfg.external.nolus_rest_url.clone(),
            http_client.clone(),
        );
        let referral_client =
            crate::external::referral::ReferralClient::new(&cfg, http_client.clone());
        let zero_interest_client =
            crate::external::zero_interest::ZeroInterestClient::new(&cfg, http_client.clone());

        let config_dir = tempfile::tempdir().expect("tempdir").keep();
        let config_store = ConfigStore::new(&config_dir);
        config_store.init().await.expect("ConfigStore init");
        let translation_dir = tempfile::tempdir().expect("tempdir").keep();
        let translation_storage = TranslationStorage::new(&translation_dir);
        translation_storage.init().await.expect("TS init");
        let llm_client = LlmClient::new(LlmConfig {
            api_key: String::new(),
            model: "stub".to_string(),
            base_url: Some("http://127.0.0.1:1/".to_string()),
        });

        Arc::new(AppState {
            config: cfg,
            etl_client,
            skip_client,
            chain_client,
            solana_client: crate::external::solana::SolanaClient::new(None, http_client.clone()),
            referral_client,
            zero_interest_client,
            data_cache: crate::data_cache::AppDataCache::new(),
            ws_manager: WebSocketManager::new(16),
            config_store,
            translation_storage,
            llm_client,
            startup_time: Instant::now(),
        })
    }

    fn sample_proposal(id: &str, status: &str) -> chain::Proposal {
        chain::Proposal {
            id: id.to_string(),
            status: status.to_string(),
            final_tally_result: None,
            submit_time: Some("2026-01-01T00:00:00Z".to_string()),
            deposit_end_time: Some("2026-01-08T00:00:00Z".to_string()),
            voting_start_time: Some("2026-01-08T00:00:00Z".to_string()),
            voting_end_time: Some("2026-01-15T00:00:00Z".to_string()),
            title: Some(format!("proposal {id}")),
            summary: Some(format!("summary {id}")),
            messages: vec![],
            metadata: None,
            tally: None,
            voted: None,
        }
    }

    fn populate_proposals_cache(state: &AppState, proposals: Vec<chain::Proposal>) {
        state
            .data_cache
            .proposals_with_tally
            .store(crate::data_cache::ProposalsWithTally {
                proposals,
                tallies: HashMap::new(),
            });
    }

    #[tokio::test]
    async fn governance_proposals_cold_cache_returns_empty_list_with_cache_status_header() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers()
                .get("cache-status")
                .map(|v| v.to_str().unwrap()),
            Some("cold")
        );
        let body = collect_body_str(resp).await;
        assert!(
            body.contains("\"proposals\":[]"),
            "cold cache must return empty proposals list, body: {body}"
        );
        assert!(
            body.contains("\"total\":\"0\""),
            "cold cache pagination.total must be \"0\", body: {body}"
        );
        assert!(
            body.contains("\"next_key\":null"),
            "cold cache pagination.next_key must be null, body: {body}"
        );
    }

    #[tokio::test]
    async fn governance_proposals_populated_cache_returns_list_with_cache_status_header() {
        let state = test_app_state().await;
        populate_proposals_cache(
            &state,
            vec![
                sample_proposal("1", "PROPOSAL_STATUS_PASSED"),
                sample_proposal("2", "PROPOSAL_STATUS_REJECTED"),
            ],
        );
        let app = build_app(state);

        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        assert_eq!(
            resp.headers()
                .get("cache-status")
                .map(|v| v.to_str().unwrap()),
            Some("warm")
        );
        // Cache-Age header must be present and a numeric string (likely "0").
        let age = resp
            .headers()
            .get("cache-age")
            .expect("cache-age header on warm response")
            .to_str()
            .expect("ascii cache-age")
            .to_string();
        let age_secs: u64 = age.parse().expect("cache-age is a non-negative integer");
        assert!(age_secs <= 5, "expected small age, got {age_secs}");

        let body = collect_body_str(resp).await;
        assert!(body.contains("\"id\":\"1\""), "body: {body}");
        assert!(body.contains("\"id\":\"2\""), "body: {body}");
        // No tally was populated for these finalized proposals; skip_serializing_if
        // means the field is absent.
        assert!(
            !body.contains("\"tally\""),
            "no tally field expected, body: {body}"
        );
    }

    #[tokio::test]
    async fn governance_proposals_with_voter_fans_out_live_vote_calls() {
        // 1 voting + 1 finalized; only the voting one should trigger the live
        // get_proposal_vote chain call.
        let mock = MockServer::start().await;
        let state = state_with_chain_url(&mock.uri()).await;
        populate_proposals_cache(
            &state,
            vec![
                sample_proposal("1", "PROPOSAL_STATUS_VOTING_PERIOD"),
                sample_proposal("2", "PROPOSAL_STATUS_PASSED"),
            ],
        );

        // Vote response for proposal 1 — voter cast a YES vote.
        Mock::given(wm_method("GET"))
            .and(wm_path("/cosmos/gov/v1/proposals/1/votes/nolus1xxxx"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "vote": {
                    "proposal_id": "1",
                    "voter": "nolus1xxxx",
                    "options": [{ "option": "VOTE_OPTION_YES", "weight": "1.0" }]
                }
            })))
            .mount(&mock)
            .await;

        let app = build_app(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals?voter=nolus1xxxx")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;

        // Only one chain vote call observed — the voting-period proposal.
        let received = mock.received_requests().await.unwrap_or_default();
        let vote_calls: Vec<_> = received
            .iter()
            .filter(|req| req.url.path().contains("/votes/"))
            .collect();
        assert_eq!(
            vote_calls.len(),
            1,
            "exactly one vote chain call expected for the voting-period proposal"
        );
        assert!(
            vote_calls[0].url.path().contains("/proposals/1/votes/"),
            "vote call must be for proposal 1, got: {}",
            vote_calls[0].url
        );

        // Response carries voted=true for proposal 1; proposal 2 has no `voted`.
        assert!(
            body.contains("\"voted\":true"),
            "voted=true expected for proposal 1, body: {body}"
        );
    }

    #[tokio::test]
    async fn governance_proposals_hidden_filter_uses_latest_gated_config() {
        let state = test_app_state().await;
        populate_proposals_cache(
            &state,
            vec![
                sample_proposal("X", "PROPOSAL_STATUS_PASSED"),
                sample_proposal("Y", "PROPOSAL_STATUS_PASSED"),
                sample_proposal("Z", "PROPOSAL_STATUS_PASSED"),
            ],
        );

        // First request: hide Y only. Expect X and Z, not Y.
        populate_gated(&state, vec!["Y".to_string()]);
        let resp1 = build_app(state.clone())
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp1.status(), StatusCode::OK);
        let body1 = collect_body_str(resp1).await;
        assert!(body1.contains("\"id\":\"X\""), "X visible, body: {body1}");
        assert!(
            !body1.contains("\"id\":\"Y\""),
            "Y must be filtered, body: {body1}"
        );
        assert!(body1.contains("\"id\":\"Z\""), "Z visible, body: {body1}");

        // Swap gated_config: now hide both X and Y. Proposals cache untouched.
        populate_gated(&state, vec!["X".to_string(), "Y".to_string()]);
        let resp2 = build_app(state.clone())
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp2.status(), StatusCode::OK);
        let body2 = collect_body_str(resp2).await;
        assert!(
            !body2.contains("\"id\":\"X\""),
            "X now filtered, body: {body2}"
        );
        assert!(
            !body2.contains("\"id\":\"Y\""),
            "Y still filtered, body: {body2}"
        );
        assert!(body2.contains("\"id\":\"Z\""), "Z visible, body: {body2}");
    }

    #[tokio::test]
    async fn governance_proposal_tally_per_id_stays_live() {
        // Even with the proposals cache populated, the per-id tally route must
        // still hit the chain — regression guard against accidentally routing
        // it through the cached map.
        let mock = MockServer::start().await;
        let state = state_with_chain_url(&mock.uri()).await;
        populate_proposals_cache(
            &state,
            vec![sample_proposal("7", "PROPOSAL_STATUS_VOTING_PERIOD")],
        );

        Mock::given(wm_method("GET"))
            .and(wm_path("/cosmos/gov/v1/proposals/7/tally"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "tally": {
                    "yes_count": "42",
                    "abstain_count": "0",
                    "no_count": "0",
                    "no_with_veto_count": "0"
                }
            })))
            .mount(&mock)
            .await;

        let app = build_app(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals/7/tally")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        assert!(body.contains("\"yes_count\":\"42\""), "body: {body}");

        // Chain mock was actually hit — proves per-id stayed live.
        let received = mock.received_requests().await.unwrap_or_default();
        let hits: Vec<_> = received
            .iter()
            .filter(|r| r.url.path() == "/cosmos/gov/v1/proposals/7/tally")
            .collect();
        assert_eq!(
            hits.len(),
            1,
            "per-id tally must be served live from chain, not from cache"
        );
    }

    #[tokio::test]
    async fn governance_proposals_tolerates_vote_lookup_failure_and_degrades_to_not_voted() {
        // A per-proposal vote lookup failure must NOT 502 the whole list: the
        // failing proposal degrades to the "hasn't voted" shape (voted=false)
        // while a sibling proposal whose lookup succeeds still reports its real
        // vote. The response stays 200.
        let mock = MockServer::start().await;
        let state = state_with_chain_url(&mock.uri()).await;
        populate_proposals_cache(
            &state,
            vec![
                sample_proposal("1", "PROPOSAL_STATUS_VOTING_PERIOD"),
                sample_proposal("2", "PROPOSAL_STATUS_VOTING_PERIOD"),
            ],
        );

        // Proposal 1 vote lookup fails hard (500).
        Mock::given(wm_method("GET"))
            .and(wm_path("/cosmos/gov/v1/proposals/1/votes/nolus1xxxx"))
            .respond_with(ResponseTemplate::new(500).set_body_string("vote rpc unavailable"))
            .mount(&mock)
            .await;
        // Proposal 2 vote lookup succeeds with a YES vote.
        Mock::given(wm_method("GET"))
            .and(wm_path("/cosmos/gov/v1/proposals/2/votes/nolus1xxxx"))
            .respond_with(ResponseTemplate::new(200).set_body_json(serde_json::json!({
                "vote": {
                    "proposal_id": "2",
                    "voter": "nolus1xxxx",
                    "options": [{ "option": "VOTE_OPTION_YES", "weight": "1.0" }]
                }
            })))
            .mount(&mock)
            .await;

        let app = build_app(state);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/governance/proposals?voter=nolus1xxxx")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::OK);
        let body = collect_body_str(resp).await;
        let json: serde_json::Value =
            serde_json::from_str(&body).expect("response body parses as JSON");
        let proposals = json["proposals"]
            .as_array()
            .expect("response carries a proposals array");
        let voted_of = |id: &str| {
            proposals
                .iter()
                .find(|p| p["id"] == id)
                .unwrap_or_else(|| panic!("proposal {id} present in response, body: {body}"))
                ["voted"]
                .clone()
        };
        assert_eq!(
            voted_of("1"),
            serde_json::json!(false),
            "failed lookup must degrade proposal 1 to voted=false, body: {body}"
        );
        assert_eq!(
            voted_of("2"),
            serde_json::json!(true),
            "successful lookup must report proposal 2 as voted=true, body: {body}"
        );
    }
}
