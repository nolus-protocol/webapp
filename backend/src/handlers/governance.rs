//! Governance handlers
//!
//! Provides endpoints for governance proposals, voting, and params.

use std::sync::Arc;

use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::{error::AppError, external::chain, AppState};

/// Query params for proposals
#[derive(Debug, Deserialize)]
pub struct ProposalsQuery {
    pub limit: Option<u32>,
    pub voter: Option<String>,
}

/// Proposal response with tally and vote info
#[derive(Debug, Serialize)]
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
    pub messages: Vec<serde_json::Value>,
    pub metadata: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub tally: Option<chain::TallyResult>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub voted: Option<bool>,
}

/// Proposals list response
#[derive(Debug, Serialize)]
pub struct ProposalsListResponse {
    pub proposals: Vec<ProposalResponse>,
    pub pagination: PaginationInfo,
}

#[derive(Debug, Serialize)]
pub struct PaginationInfo {
    pub total: String,
    pub next_key: Option<String>,
}

/// Get governance proposals
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
            if let Ok(tally_response) = state.chain_client.get_proposal_tally(&proposal.id).await {
                response.tally = Some(tally_response.tally);
            }

            // If voter is provided, check if they voted
            if let Some(ref voter) = query.voter {
                if let Ok(Some(vote_response)) = state
                    .chain_client
                    .get_proposal_vote(&proposal.id, voter)
                    .await
                {
                    response.voted = Some(!vote_response.vote.options.is_empty());
                } else {
                    response.voted = Some(false);
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
pub async fn get_proposal_tally(
    State(state): State<Arc<AppState>>,
    Path(proposal_id): Path<String>,
) -> Result<Json<chain::TallyResponse>, AppError> {
    debug!("Fetching tally for proposal: {}", proposal_id);
    let tally = state.chain_client.get_proposal_tally(&proposal_id).await?;
    Ok(Json(tally))
}

/// Get vote for a proposal
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

/// Get tallying params
pub async fn get_tallying_params(
    State(state): State<Arc<AppState>>,
) -> Result<Json<chain::TallyingParamsResponse>, AppError> {
    debug!("Fetching tallying params");
    let params = state.chain_client.get_tallying_params().await?;
    Ok(Json(params))
}

/// Get staking pool (bonded tokens)
pub async fn get_staking_pool(
    State(state): State<Arc<AppState>>,
) -> Result<Json<chain::StakingPoolResponse>, AppError> {
    debug!("Fetching staking pool");
    let pool = state.chain_client.get_staking_pool().await?;
    Ok(Json(pool))
}

/// APR response
#[derive(Debug, Serialize)]
pub struct AprResponse {
    pub annual_inflation: String,
    pub bonded_tokens: String,
    pub apr: f64,
}

/// Get APR (combines inflation and staking pool)
pub async fn get_apr(State(state): State<Arc<AppState>>) -> Result<Json<AprResponse>, AppError> {
    debug!("Fetching APR");

    let (inflation_response, pool_response) = tokio::try_join!(
        state.chain_client.get_annual_inflation(),
        state.chain_client.get_staking_pool()
    )?;

    let annual_inflation: f64 = inflation_response.annual_inflation.parse().unwrap_or(0.0);
    let _bonded_tokens: f64 = pool_response.pool.bonded_tokens.parse().unwrap_or(1.0);

    // APR calculation: (inflation * total_supply) / bonded_tokens
    // Simplified: we just return the raw values and let frontend calculate
    let apr = annual_inflation;

    Ok(Json(AprResponse {
        annual_inflation: inflation_response.annual_inflation,
        bonded_tokens: pool_response.pool.bonded_tokens,
        apr,
    }))
}

/// Get account info (for vesting)
pub async fn get_account(
    State(state): State<Arc<AppState>>,
    Path(address): Path<String>,
) -> Result<Json<chain::AccountResponse>, AppError> {
    debug!("Fetching account for: {}", address);
    let account = state.chain_client.get_account(&address).await?;
    Ok(Json(account))
}

/// Get denom metadata
pub async fn get_denom_metadata(
    State(state): State<Arc<AppState>>,
    Path(denom): Path<String>,
) -> Result<Json<Option<chain::DenomMetadata>>, AppError> {
    debug!("Fetching denom metadata for: {}", denom);
    let metadata = state.chain_client.get_denom_metadata(&denom).await?;
    Ok(Json(metadata))
}

/// Node info response
#[derive(Debug, Serialize)]
pub struct NodeInfoResponse {
    pub version: String,
    pub network: String,
}

/// Get node info (version, network)
pub async fn get_node_info(
    State(state): State<Arc<AppState>>,
) -> Result<Json<NodeInfoResponse>, AppError> {
    debug!("Fetching node info");
    let info = state.chain_client.get_node_info().await?;
    Ok(Json(info))
}

/// Network status response
#[derive(Debug, Serialize)]
pub struct NetworkStatusResponse {
    pub network: String,
    pub latest_block_height: String,
    pub latest_block_time: String,
    pub catching_up: bool,
}

/// Get network status
pub async fn get_network_status(
    State(state): State<Arc<AppState>>,
) -> Result<Json<NetworkStatusResponse>, AppError> {
    debug!("Fetching network status");
    let status = state.chain_client.get_network_status().await?;
    Ok(Json(status))
}
