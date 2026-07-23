//! HTTP surface for the transfer tracker.
//!
//! `POST /api/transfer/track` (strict-class) registers an in-flight route for
//! tracking; `GET /api/transfer/status/{id}` (read-class) returns its status.
//! Registration is refused for untrackable work: an unknown channel, too many
//! legs, no on-chain commitment evidence, a full active set, or an
//! unconfigured Solana client.

use std::str::FromStr as _;
use std::sync::Arc;

use axum::extract::{Path, State};
use axum::Json;
use chrono::Utc;
use ibc_solray::api::{
    channel_id_from_name, PacketAcknowledgementReference, PacketCommitmentsReference,
};
use serde::{Deserialize, Serialize};
use solana_pubkey::Pubkey;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::error::AppError;
use crate::external::solana::{
    decode_acknowledgement_pda, decode_commitment_pda, PacketPdaSnapshot, SolanaClient,
    SOLRAY_PROGRAM_ID,
};
use crate::transfer_tracker::{
    apply_poll, commitment_pda_chain, phase_from_ack_pda, status_response, AckPdaSnapshot, Chain,
    CommitmentObservation, Direction, IbcHeight, LegPhase, PollObservation, TrackedLeg,
    TrackedTransfer, TransferStatusResponse, MAX_TRACKED_LEGS,
};
use crate::AppState;

/// One requested leg of a route to track.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
pub struct TrackLegSpec {
    pub from_chain: Chain,
    pub to_chain: Chain,
    pub timeout_height: IbcHeight,
}

/// `POST /api/transfer/track` request body.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
#[schema(as = TransferTrackRequest)]
pub struct TrackRequest {
    pub direction: Direction,
    pub channel: String,
    pub legs: Vec<TrackLegSpec>,
}

/// `POST /api/transfer/track` success body.
#[derive(Debug, Clone, Serialize, Deserialize, ToSchema)]
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
    if !pre.solana_configured {
        return Err(AppError::ServiceUnavailable {
            message: "Solana RPC not configured (set SOLANA_RPC_URL)".to_string(),
        });
    }
    if !pre.channel_known {
        return Err(AppError::Validation {
            message: format!("unknown IBC channel: {}", request.channel),
            field: Some("channel".to_string()),
            details: None,
        });
    }
    if request.legs.is_empty() {
        return Err(AppError::Validation {
            message: "a tracked route must declare at least one leg".to_string(),
            field: Some("legs".to_string()),
            details: None,
        });
    }
    if request.legs.len() > MAX_TRACKED_LEGS {
        return Err(AppError::Validation {
            message: format!(
                "route declares {} legs; the maximum is {MAX_TRACKED_LEGS}",
                request.legs.len()
            ),
            field: Some("legs".to_string()),
            details: None,
        });
    }
    if !pre.commitment_evidence {
        return Err(AppError::Validation {
            message: "no on-chain commitment evidence for the route".to_string(),
            field: Some("channel".to_string()),
            details: None,
        });
    }
    if pre.active_count >= pre.capacity {
        return Err(AppError::RateLimited { retry_after: None });
    }
    Ok(())
}

/// Register an in-flight route for tracking.
#[utoipa::path(
    post,
    path = "/api/transfer/track",
    tag = "transfer",
    request_body = TrackRequest,
    responses(
        (status = 200, description = "Route registered for tracking", body = TrackAccepted),
        (status = 400, description = "Untrackable request", body = crate::error::ErrorResponse),
        (status = 429, description = "Active tracking set full", body = crate::error::ErrorResponse),
        (status = 502, description = "Solana RPC error", body = crate::error::ErrorResponse),
        (status = 503, description = "Solana RPC unconfigured", body = crate::error::ErrorResponse),
    ),
)]
pub async fn track_transfer(
    State(state): State<Arc<AppState>>,
    Json(request): Json<TrackRequest>,
) -> Result<Json<TrackAccepted>, AppError> {
    let solana_configured = state.solana_client.is_configured();
    let channel_known = channel_id_from_name(&request.channel).is_ok();

    // Only reach out to chain once the cheap gates can pass; validate_track
    // still makes the final decision and maps each failure to its typed error.
    let poll = if solana_configured && channel_known {
        Some(poll_route(&state.solana_client, request.direction, &request.channel).await?)
    } else {
        None
    };
    let commitment_evidence = poll.as_ref().is_some_and(|poll| {
        matches!(poll.commitment, CommitmentObservation::Present) || poll.ack_snapshot.is_some()
    });

    let pre = TrackPreconditions {
        channel_known,
        solana_configured,
        commitment_evidence,
        active_count: state.transfer_store.active_count(),
        capacity: state.transfer_store.capacity(),
    };
    validate_track(&request, &pre)?;

    let poll = poll.ok_or_else(|| {
        AppError::Internal("registration poll missing after passing validation".to_string())
    })?;

    let id = Uuid::new_v4().to_string();
    let legs = request
        .legs
        .iter()
        .map(|spec| TrackedLeg {
            phase: initial_leg_phase(request.direction, spec, &poll),
            from_chain: spec.from_chain,
            to_chain: spec.to_chain,
            timeout_height: spec.timeout_height,
        })
        .collect();
    let record = TrackedTransfer {
        id: id.clone(),
        direction: request.direction,
        channel: request.channel.clone(),
        legs,
        created_at: Utc::now(),
        terminal_at: None,
    };
    state.transfer_store.insert(record).await?;
    Ok(Json(TrackAccepted { id }))
}

/// Return the current status of a tracked route.
#[utoipa::path(
    get,
    path = "/api/transfer/status/{id}",
    tag = "transfer",
    params(
        ("id" = String, Path, description = "Tracked route id"),
    ),
    responses(
        (status = 200, description = "Current route status", body = TransferStatusResponse),
        (status = 404, description = "Unknown route id", body = crate::error::ErrorResponse),
    ),
)]
pub async fn get_transfer_status(
    State(state): State<Arc<AppState>>,
    Path(id): Path<String>,
) -> Result<Json<TransferStatusResponse>, AppError> {
    let record = state
        .transfer_store
        .get(&id)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("transfer {id}"),
        })?;
    Ok(Json(status_response(&record)))
}

/// A one-shot read of a route's Solana packet PDAs plus the current Solana
/// height, used to seed a freshly registered route's per-leg phases.
struct RoutePoll {
    current_height: IbcHeight,
    commitment: CommitmentObservation,
    ack_snapshot: Option<AckPdaSnapshot>,
}

/// Which per-channel packet PDA to address.
enum PacketPdaKind {
    Commitment,
    Acknowledgement,
}

/// Poll a route's Solana packet PDAs once, deriving the current commitment
/// observation and (presence-only) acknowledgement snapshot.
async fn poll_route(
    client: &SolanaClient,
    direction: Direction,
    channel: &str,
) -> Result<RoutePoll, AppError> {
    let epoch = client.get_epoch_info().await?;
    let current_height = IbcHeight {
        revision_number: epoch.epoch,
        revision_height: epoch.absolute_slot,
    };

    let commitment = match commitment_pda_chain(direction) {
        Some(Chain::Solana) => {
            let address = packet_pda_address(channel, &PacketPdaKind::Commitment)?;
            let account = client.get_account_info(&address).await?;
            match decode_commitment_pda(account.as_ref())? {
                PacketPdaSnapshot::Present(sequences) if !sequences.is_empty() => {
                    CommitmentObservation::Present
                }
                _ => CommitmentObservation::Gone,
            }
        }
        // Nolus->Solana holds the source commitment on Nolus (observed via
        // CometBFT events, not a Solana PDA), so the poll cannot prove it gone.
        _ => CommitmentObservation::Present,
    };

    let ack_address = packet_pda_address(channel, &PacketPdaKind::Acknowledgement)?;
    let ack_account = client.get_account_info(&ack_address).await?;
    let ack_present = matches!(
        decode_acknowledgement_pda(ack_account.as_ref())?,
        PacketPdaSnapshot::Present(sequences) if !sequences.is_empty()
    );
    // The ack PDA proves an acknowledgement exists; its success-vs-error
    // polarity is unknowable off-chain, so the (ignored) hash is a presence
    // marker only. Event-sourced polarity arrives via the CometBFT path.
    let ack_snapshot = ack_present.then_some(AckPdaSnapshot {
        commitment_hash: [0u8; 32],
    });

    Ok(RoutePoll {
        current_height,
        commitment,
        ack_snapshot,
    })
}

/// Seed a leg's initial phase from a registration-time poll. A poll error keeps
/// the leg at `Committed` (unknown, not terminal) via [`apply_poll`].
fn initial_leg_phase(direction: Direction, spec: &TrackLegSpec, poll: &RoutePoll) -> LegPhase {
    let observation = PollObservation {
        commitment: poll.commitment,
        ack_event: None, // polarity is event-sourced, never PDA-sourced
        timeout_event: false,
        recv_observed: poll.ack_snapshot.is_some(),
        event_gap: false,
        current_height: poll.current_height,
        timeout_height: spec.timeout_height,
    };
    let reconciled = apply_poll(LegPhase::Committed, direction, Ok(observation));
    match (&poll.ack_snapshot, reconciled) {
        // An observed ack PDA proves the leg is at least acknowledged; do not
        // report it as still committed/relayed while that evidence stands.
        (Some(snapshot), LegPhase::Committed | LegPhase::Relayed) => phase_from_ack_pda(snapshot),
        _ => reconciled,
    }
}

/// Derive the base58 address of a per-channel packet PDA on Solana via the
/// pinned solray SDK's PDA derivation.
fn packet_pda_address(channel: &str, kind: &PacketPdaKind) -> Result<String, AppError> {
    let channel_id = channel_id_from_name(channel).map_err(|e| AppError::Validation {
        message: format!("unparseable IBC channel id {channel}: {e}"),
        field: Some("channel".to_string()),
        details: None,
    })?;
    let program = Pubkey::from_str(SOLRAY_PROGRAM_ID)
        .map_err(|e| AppError::Internal(format!("invalid solray program id: {e}")))?;
    let address = match kind {
        PacketPdaKind::Commitment => PacketCommitmentsReference::find(program, channel_id).addr(),
        PacketPdaKind::Acknowledgement => {
            PacketAcknowledgementReference::find(program, channel_id).addr()
        }
    };
    Ok(address.to_string())
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
            validate_track(
                &request_with_legs(crate::transfer_tracker::MAX_TRACKED_LEGS + 1),
                &pre
            ),
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
