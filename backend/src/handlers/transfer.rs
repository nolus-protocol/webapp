//! HTTP surface for the transfer tracker.
//!
//! `POST /api/transfer/track` (strict-class) registers an in-flight route for
//! tracking; `GET /api/transfer/status/{id}` (read-class) returns its status.
//! Registration is refused for untrackable work: an unknown channel, too many
//! legs, no on-chain commitment evidence, a full active set, or an
//! unconfigured Solana client.

use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use serde::{Deserialize, Serialize};

use crate::error::AppError;
use crate::transfer_tracker::{Chain, Direction, IbcHeight, TransferStatusResponse};
use crate::AppState;

/// One requested leg of a route to track.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackLegSpec {
    pub from_chain: Chain,
    pub to_chain: Chain,
    pub timeout_height: IbcHeight,
}

/// `POST /api/transfer/track` request body.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackRequest {
    pub direction: Direction,
    pub channel: String,
    pub legs: Vec<TrackLegSpec>,
}

/// `POST /api/transfer/track` success body.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TrackAccepted {
    pub id: String,
}

/// Runtime facts the registration check needs, gathered before validation.
pub struct TrackPreconditions {
    pub channel_known: bool,
    pub solana_configured: bool,
    pub commitment_evidence: bool,
    pub active_count: usize,
    pub capacity: usize,
}

/// Reject untrackable registration requests with the mapped typed error:
/// unconfigured Solana client -> 503, unknown channel / over-leg-cap / no
/// commitment evidence -> 400, full active set -> 429.
pub fn validate_track(request: &TrackRequest, pre: &TrackPreconditions) -> Result<(), AppError> {
    let _ = (request, pre);
    todo!("map each precondition failure to its typed AppError")
}

/// Register an in-flight route for tracking.
pub async fn track_transfer(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TrackRequest>,
) -> Result<Json<TrackAccepted>, AppError> {
    let _ = (state, request);
    todo!("gather preconditions, validate_track, insert into the store")
}

/// Return the current status of a tracked route.
pub async fn get_transfer_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TransferStatusResponse>, AppError> {
    let _ = (state, id);
    todo!("look up the route, build its status response, 404 when absent")
}

#[cfg(test)]
mod tests {
    use super::*;

    fn leg() -> TrackLegSpec {
        TrackLegSpec {
            from_chain: Chain::Solana,
            to_chain: Chain::Nolus,
            timeout_height: IbcHeight {
                revision_number: 5,
                revision_height: 100,
            },
        }
    }

    fn request_with_legs(count: usize) -> TrackRequest {
        TrackRequest {
            direction: Direction::SolanaToNolus,
            channel: "channel-0".to_string(),
            legs: std::iter::repeat_with(leg).take(count).collect(),
        }
    }

    /// Preconditions where every gate passes; each test flips exactly one.
    fn all_good() -> TrackPreconditions {
        TrackPreconditions {
            channel_known: true,
            solana_configured: true,
            commitment_evidence: true,
            active_count: 0,
            capacity: 512,
        }
    }

    #[test]
    fn accepts_a_valid_registration() {
        let result = validate_track(&request_with_legs(1), &all_good());
        assert!(result.is_ok(), "a fully-valid request must be accepted");
    }

    #[test]
    fn rejects_unknown_channel_as_validation_error() {
        let pre = TrackPreconditions {
            channel_known: false,
            ..all_good()
        };
        assert!(matches!(
            validate_track(&request_with_legs(1), &pre),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn rejects_leg_count_over_cap_as_validation_error() {
        let pre = all_good();
        assert!(matches!(
            validate_track(&request_with_legs(crate::transfer_tracker::MAX_TRACKED_LEGS + 1), &pre),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn rejects_registration_without_commitment_evidence() {
        let pre = TrackPreconditions {
            commitment_evidence: false,
            ..all_good()
        };
        assert!(matches!(
            validate_track(&request_with_legs(1), &pre),
            Err(AppError::Validation { .. })
        ));
    }

    #[test]
    fn rejects_registration_at_active_set_capacity() {
        let pre = TrackPreconditions {
            active_count: 512,
            capacity: 512,
            ..all_good()
        };
        assert!(matches!(
            validate_track(&request_with_legs(1), &pre),
            Err(AppError::RateLimited { .. })
        ));
    }

    #[test]
    fn rejects_registration_when_solana_client_unconfigured() {
        let pre = TrackPreconditions {
            solana_configured: false,
            ..all_good()
        };
        assert!(matches!(
            validate_track(&request_with_legs(1), &pre),
            Err(AppError::ServiceUnavailable { .. })
        ));
    }
}
