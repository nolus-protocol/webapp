use axum::{
    extract::{Path, Query, State},
    Json,
};
use serde::{Deserialize, Serialize};
use std::sync::Arc;
use utoipa::{IntoParams, ToSchema};

use crate::error::AppError;
use crate::external::zero_interest::{
    ActiveCampaignsResponse, CampaignEligibilityResponse, CreateZeroInterestPaymentRequest,
    PaymentStatus as ExternalPaymentStatus,
};
use crate::AppState;

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct ZeroInterestConfigResponse {
    pub enabled: bool,
    pub max_payment_amount: String,
    pub min_lease_value: String,
    pub max_active_payments: u32,
    pub supported_denoms: Vec<String>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct EligibilityResponse {
    pub eligible: bool,
    pub reason: Option<String>,
    pub max_amount: Option<String>,
    pub available_slots: Option<u32>,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct PaymentResponse {
    pub id: String,
    pub lease_address: String,
    pub amount: String,
    pub denom: String,
    pub payment_date: String,
    pub status: PaymentStatus,
}

#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
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

#[derive(Debug, Deserialize, IntoParams)]
pub struct EligibilityQuery {
    /// Lease contract address being checked for zero-interest eligibility.
    pub lease: String,
    /// Owner wallet address.
    pub owner: String,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CreatePaymentRequest {
    pub lease_address: String,
    pub amount: String,
    pub denom: String,
    pub owner_address: String,
    pub signature: String,
}

#[derive(Debug, Serialize, Deserialize, ToSchema)]
pub struct CreatePaymentResponse {
    pub payment: PaymentResponse,
    pub tx_hash: Option<String>,
}

#[derive(Debug, Deserialize, ToSchema)]
pub struct CancelPaymentRequest {
    pub owner_address: String,
    pub signature: String,
}

/// Get zero-interest configuration
///
/// Returns whether the zero-interest feature is enabled, payment bounds, and supported denoms.
#[utoipa::path(
    get,
    path = "/api/zero-interest/config",
    tag = "zero-interest",
    responses(
        (status = 200, description = "Zero-interest configuration", body = ZeroInterestConfigResponse),
        (status = 502, description = "Upstream zero-interest service error", body = crate::error::ErrorResponse),
    ),
)]
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

/// Check zero-interest eligibility
///
/// Checks whether the given lease/owner pair is eligible for a zero-interest
/// payment and returns the allowed maximum amount.
#[utoipa::path(
    get,
    path = "/api/zero-interest/eligibility",
    tag = "zero-interest",
    params(EligibilityQuery),
    responses(
        (status = 200, description = "Eligibility result", body = EligibilityResponse),
        (status = 400, description = "Invalid lease/owner input", body = crate::error::ErrorResponse),
        (status = 502, description = "Upstream zero-interest service error", body = crate::error::ErrorResponse),
    ),
)]
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

/// Get zero-interest payments by owner
///
/// Returns all zero-interest payments (pending or completed) owned by `owner`.
#[utoipa::path(
    get,
    path = "/api/zero-interest/payments/by-owner/{owner}",
    tag = "zero-interest",
    params(
        ("owner" = String, Path, description = "Owner wallet address"),
    ),
    responses(
        (status = 200, description = "Payments owned by address", body = Vec<PaymentResponse>),
        (status = 502, description = "Upstream zero-interest service error", body = crate::error::ErrorResponse),
    ),
)]
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

/// Get zero-interest payments for a lease
///
/// Returns the zero-interest payments recorded against a specific lease.
#[utoipa::path(
    get,
    path = "/api/zero-interest/lease/{lease_address}/payments",
    tag = "zero-interest",
    params(
        ("lease_address" = String, Path, description = "Lease contract address"),
    ),
    responses(
        (status = 200, description = "Payments for lease", body = Vec<PaymentResponse>),
        (status = 502, description = "Upstream zero-interest service error", body = crate::error::ErrorResponse),
    ),
)]
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

/// Create a zero-interest payment
///
/// Creates a signed zero-interest payment and submits it for processing. The
/// owner must sign the request; the backend forwards to the payments manager.
#[utoipa::path(
    post,
    path = "/api/zero-interest/payments",
    tag = "zero-interest",
    request_body = CreatePaymentRequest,
    responses(
        (status = 200, description = "Payment created", body = CreatePaymentResponse),
        (status = 400, description = "Invalid payment request", body = crate::error::ErrorResponse),
        (status = 502, description = "Upstream zero-interest service error", body = crate::error::ErrorResponse),
    ),
)]
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

/// Cancel a zero-interest payment
///
/// Cancels a pending zero-interest payment. The owner must sign the request.
#[utoipa::path(
    delete,
    path = "/api/zero-interest/payments/{payment_id}",
    tag = "zero-interest",
    params(
        ("payment_id" = String, Path, description = "Zero-interest payment ID"),
    ),
    request_body = CancelPaymentRequest,
    responses(
        (status = 200, description = "Payment cancelled"),
        (status = 404, description = "Payment not found", body = crate::error::ErrorResponse),
        (status = 502, description = "Upstream zero-interest service error", body = crate::error::ErrorResponse),
    ),
)]
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

/// Get active zero-interest campaigns
///
/// Returns all currently active zero-interest campaigns. Used by the frontend
/// to decide which lease/deposit actions to badge as zero-interest.
#[utoipa::path(
    get,
    path = "/api/campaigns/active",
    tag = "campaigns",
    responses(
        (status = 200, description = "Active campaigns", body = ActiveCampaignsResponse),
        (status = 502, description = "Upstream payments manager error", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_active_campaigns(
    State(state): State<Arc<AppState>>,
) -> Result<Json<ActiveCampaignsResponse>, AppError> {
    let campaigns = state.zero_interest_client.get_active_campaigns().await?;
    Ok(Json(campaigns))
}

#[derive(Debug, Deserialize, IntoParams)]
pub struct CampaignEligibilityQuery {
    /// Wallet address to check.
    pub wallet: String,
    /// Optional protocol name (filters matching campaigns).
    pub protocol: Option<String>,
    /// Optional currency ticker (filters matching campaigns).
    pub currency: Option<String>,
}

/// Check campaign eligibility
///
/// Checks whether a wallet/protocol/currency combination is eligible for any
/// zero-interest campaign and returns the matching campaigns.
#[utoipa::path(
    get,
    path = "/api/campaigns/eligibility",
    tag = "campaigns",
    params(CampaignEligibilityQuery),
    responses(
        (status = 200, description = "Eligibility result", body = CampaignEligibilityResponse),
        (status = 502, description = "Upstream payments manager error", body = crate::error::ErrorResponse),
    ),
)]
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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::test_utils::test_app_state;
    use axum::{
        body::Body,
        http::{Request, StatusCode},
        routing::{get, post},
        Router,
    };
    use tower::ServiceExt;

    fn build_app(state: Arc<AppState>) -> Router {
        Router::new()
            .route("/api/campaigns/active", get(get_active_campaigns))
            .route("/api/zero-interest/payments", post(create_payment))
            .route(
                "/api/zero-interest/lease/{lease_address}/payments",
                get(get_lease_payments),
            )
            .with_state(state)
    }

    #[tokio::test]
    async fn zero_interest_active_campaigns_upstream_failure_returns_502() {
        // stub zero_interest URL + 1ms timeout → AppError::ExternalApi → 502
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/campaigns/active")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
    }

    #[tokio::test]
    async fn zero_interest_create_payment_malformed_json_returns_400() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .method("POST")
                    .uri("/api/zero-interest/payments")
                    .header("content-type", "application/json")
                    .body(Body::from("{ malformed".to_string()))
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_REQUEST);
    }

    #[tokio::test]
    async fn zero_interest_lease_payments_upstream_failure_returns_502() {
        let app = build_app(test_app_state().await);
        let resp = app
            .oneshot(
                Request::builder()
                    .uri("/api/zero-interest/lease/nolus1lease/payments")
                    .body(Body::empty())
                    .unwrap(),
            )
            .await
            .unwrap();
        assert_eq!(resp.status(), StatusCode::BAD_GATEWAY);
    }
}
