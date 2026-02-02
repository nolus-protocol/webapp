use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;

use crate::error::AppError;
use crate::external::zero_interest::{
    ActiveCampaignsResponse, CampaignEligibilityResponse,
    CreateZeroInterestPaymentRequest, PaymentStatus as ExternalPaymentStatus,
};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize)]
pub struct ZeroInterestConfigResponse {
    pub enabled: bool,
    pub max_payment_amount: String,
    pub min_lease_value: String,
    pub max_active_payments: u32,
    pub supported_denoms: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct EligibilityResponse {
    pub eligible: bool,
    pub reason: Option<String>,
    pub max_amount: Option<String>,
    pub available_slots: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct PaymentResponse {
    pub id: String,
    pub lease_address: String,
    pub amount: String,
    pub denom: String,
    pub payment_date: String,
    pub status: PaymentStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum PaymentStatus {
    Pending,
    Completed,
    Failed,
    Cancelled,
}

impl From<ExternalPaymentStatus> for PaymentStatus {
    fn from(status: ExternalPaymentStatus) -> Self {
        match status {
            ExternalPaymentStatus::Pending => PaymentStatus::Pending,
            ExternalPaymentStatus::Completed => PaymentStatus::Completed,
            ExternalPaymentStatus::Failed => PaymentStatus::Failed,
            ExternalPaymentStatus::Cancelled => PaymentStatus::Cancelled,
        }
    }
}

#[derive(Debug, Deserialize)]
pub struct EligibilityQuery {
    pub lease: String,
    pub owner: String,
}

#[derive(Debug, Deserialize)]
pub struct CreatePaymentRequest {
    pub lease_address: String,
    pub amount: String,
    pub denom: String,
    pub owner_address: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize)]
pub struct CreatePaymentResponse {
    pub payment: PaymentResponse,
    pub tx_hash: Option<String>,
}

#[derive(Debug, Deserialize)]
pub struct CancelPaymentRequest {
    pub owner_address: String,
    pub signature: String,
}

/// GET /api/zero-interest/config
/// Get zero interest configuration
pub async fn get_config(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ZeroInterestConfigResponse>, AppError> {
    let config = state.zero_interest_client.get_config().await?;

    Ok(Json(ZeroInterestConfigResponse {
        enabled: config.enabled,
        max_payment_amount: config.max_payment_amount,
        min_lease_value: config.min_lease_value,
        max_active_payments: config.max_active_payments,
        supported_denoms: config.supported_denoms,
    }))
}

/// GET /api/zero-interest/eligibility
/// Check eligibility for zero interest payment
pub async fn check_eligibility(
    State(state): State<Arc<AppState>>,
    Query(query): Query<EligibilityQuery>,
) -> Result<Json<EligibilityResponse>, AppError> {
    let eligibility = state
        .zero_interest_client
        .check_eligibility(&query.lease, &query.owner)
        .await?;

    Ok(Json(EligibilityResponse {
        eligible: eligibility.eligible,
        reason: eligibility.reason,
        max_amount: eligibility.max_amount,
        available_slots: eligibility.available_slots,
    }))
}

/// GET /api/zero-interest/payments/:owner
/// Get all zero interest payments for an owner
pub async fn get_payments(
    State(state): State<Arc<AppState>>,
    Path(owner): Path<String>,
) -> Result<Json<Vec<PaymentResponse>>, AppError> {
    let payments = state.zero_interest_client.get_payments(&owner).await?;

    let response: Vec<PaymentResponse> = payments
        .into_iter()
        .map(|p| PaymentResponse {
            id: p.id,
            lease_address: p.lease_address,
            amount: p.amount,
            denom: p.denom,
            payment_date: p.payment_date,
            status: p.status.into(),
        })
        .collect();

    Ok(Json(response))
}

/// GET /api/zero-interest/lease/:lease_address/payments
/// Get payments for a specific lease
pub async fn get_lease_payments(
    State(state): State<Arc<AppState>>,
    Path(lease_address): Path<String>,
) -> Result<Json<Vec<PaymentResponse>>, AppError> {
    let payments = state
        .zero_interest_client
        .get_lease_payments(&lease_address)
        .await?;

    let response: Vec<PaymentResponse> = payments
        .into_iter()
        .map(|p| PaymentResponse {
            id: p.id,
            lease_address: p.lease_address,
            amount: p.amount,
            denom: p.denom,
            payment_date: p.payment_date,
            status: p.status.into(),
        })
        .collect();

    Ok(Json(response))
}

/// POST /api/zero-interest/payments
/// Create a new zero interest payment
pub async fn create_payment(
    State(state): State<Arc<AppState>>,
    Json(request): Json<CreatePaymentRequest>,
) -> Result<Json<CreatePaymentResponse>, AppError> {
    let client_request = CreateZeroInterestPaymentRequest {
        lease_address: request.lease_address,
        amount: request.amount,
        denom: request.denom,
        owner_address: request.owner_address,
        signature: request.signature,
    };

    let result = state
        .zero_interest_client
        .create_payment(client_request)
        .await?;

    Ok(Json(CreatePaymentResponse {
        payment: PaymentResponse {
            id: result.payment.id,
            lease_address: result.payment.lease_address,
            amount: result.payment.amount,
            denom: result.payment.denom,
            payment_date: result.payment.payment_date,
            status: result.payment.status.into(),
        },
        tx_hash: result.tx_hash,
    }))
}

/// DELETE /api/zero-interest/payments/:payment_id
/// Cancel a pending zero interest payment
pub async fn cancel_payment(
    State(state): State<Arc<AppState>>,
    Path(payment_id): Path<String>,
    Json(request): Json<CancelPaymentRequest>,
) -> Result<(), AppError> {
    state
        .zero_interest_client
        .cancel_payment(&payment_id, &request.owner_address, &request.signature)
        .await?;

    Ok(())
}

// ============================================================================
// Campaign Endpoints
// ============================================================================

/// GET /api/campaigns/active
/// Get all currently active zero-interest campaigns
/// Used by frontend to display campaign eligibility badges
pub async fn get_active_campaigns(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ActiveCampaignsResponse>, AppError> {
    let campaigns = state.zero_interest_client.get_active_campaigns().await?;
    Ok(Json(campaigns))
}

#[derive(Debug, Deserialize)]
pub struct CampaignEligibilityQuery {
    pub wallet: String,
    pub protocol: Option<String>,
    pub currency: Option<String>,
}

/// GET /api/campaigns/eligibility
/// Check if a wallet/protocol/currency combination is eligible for zero-interest
pub async fn check_campaign_eligibility(
    State(state): State<Arc<AppState>>,
    Query(query): Query<CampaignEligibilityQuery>,
) -> Result<Json<CampaignEligibilityResponse>, AppError> {
    let eligibility = state
        .zero_interest_client
        .check_campaign_eligibility(
            &query.wallet,
            query.protocol.as_deref(),
            query.currency.as_deref(),
        )
        .await?;
    Ok(Json(eligibility))
}

