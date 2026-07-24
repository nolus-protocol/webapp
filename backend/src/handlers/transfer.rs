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
use tracing::warn;
use utoipa::ToSchema;
use uuid::Uuid;

use crate::error::AppError;
use crate::external::solana::{
    decode_acknowledgement_pda, decode_commitment_pda, PacketPdaSnapshot, SolanaClient,
    SOLRAY_PROGRAM_ID,
};
use crate::transfer_tracker::{
    apply_poll, commitment_pda_chain, phase_from_ack_pda, status_response, top_level_state,
    AckPdaSnapshot, Chain, CommitmentObservation, Direction, IbcHeight, LegPhase, PollObservation,
    TrackedLeg, TrackedTransfer, TransferStatusResponse, MAX_TRACKED_LEGS, STATE_PENDING,
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

    // Cheap gates first — reject a saturated set, an unconfigured client, an
    // unknown channel, or a malformed leg list BEFORE spending any RPC. The
    // endpoint is unauthenticated, so an early reject also denies RPC
    // amplification. Commitment evidence is assumed here and verified against
    // chain immediately after, once the cheap gates pass.
    let base = TrackPreconditions {
        channel_known,
        solana_configured,
        commitment_evidence: true,
        active_count: state.transfer_store.active_count(),
        capacity: state.transfer_store.capacity(),
    };
    validate_track(&request, &base)?;

    // Cheap gates passed: one RPC verifies the route has a live on-chain
    // commitment before it is admitted to the tracking set.
    let observation = poll_route(&state.solana_client, request.direction, &request.channel).await?;
    let verified = TrackPreconditions {
        commitment_evidence: matches!(observation.commitment, CommitmentObservation::Present),
        ..base
    };
    validate_track(&request, &verified)?;

    let id = Uuid::new_v4().to_string();
    // Legs start at `Committed`; each GET /status re-polls and folds fresh
    // observations forward (REST poll v1), so registration does not seed phases.
    let legs = request
        .legs
        .iter()
        .map(|spec| TrackedLeg {
            phase: LegPhase::Committed,
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
    let mut record = state
        .transfer_store
        .get(&id)
        .ok_or_else(|| AppError::NotFound {
            resource: format!("transfer {id}"),
        })?;

    // REST poll v1 (matches the swap UI's polling model): fold a fresh on-chain
    // observation into per-leg state on every read, persisting when it advances.
    if refresh_record(&state.solana_client, &mut record).await {
        if let Err(e) = state.transfer_store.update(record.clone()).await {
            // The fresh status is already computed; a persist failure only means
            // the next GET re-derives it. Surface, do not fail the read.
            warn!("failed to persist transfer {id} status update: {e}");
        }
    }
    Ok(Json(status_response(&record)))
}

/// A single fresh read of a route's Solana packet PDAs plus the current Solana
/// height. Only the packet-commitment PDA drives phase transitions.
///
/// The acknowledgement PDA is per *channel* — a BTree of every acknowledged
/// sequence on the channel — and the tracked record carries no packet sequence
/// to pick out THIS transfer's ack. Ack-PDA presence is therefore *uncorrelated*
/// evidence: it may only ever keep a leg in an in-flight phase (`Acked` at
/// most), never advance it to `Delivered` or a terminal, so a still-in-flight
/// transfer on a channel that has ever carried an acked packet is never falsely
/// reported as completed. Receive events and success/error polarity are
/// event-sourced (Nolus CometBFT) and land in a later PR.
struct RouteObservation {
    current_height: IbcHeight,
    commitment: CommitmentObservation,
    ack_present: bool,
}

/// Which per-channel packet PDA to address.
enum PacketPdaKind {
    Commitment,
    Acknowledgement,
}

/// Fold one fresh on-chain observation into a record's per-leg phases, stamping
/// `terminal_at` when the route first reaches a terminal top-level state.
/// Returns whether anything changed. A poll failure leaves every leg untouched
/// (see [`apply_poll`]).
async fn refresh_record(client: &SolanaClient, record: &mut TrackedTransfer) -> bool {
    let observation = poll_route(client, record.direction, &record.channel).await;
    let mut changed = false;
    for leg in &mut record.legs {
        let next = match &observation {
            Ok(obs) => fold_leg(leg.phase, record.direction, leg.timeout_height, obs),
            Err(_) => leg.phase,
        };
        if next != leg.phase {
            leg.phase = next;
            changed = true;
        }
    }
    if changed && record.terminal_at.is_none() {
        let phases: Vec<LegPhase> = record.legs.iter().map(|leg| leg.phase).collect();
        if top_level_state(&phases) != STATE_PENDING {
            record.terminal_at = Some(Utc::now());
        }
    }
    changed
}

/// Fold a fresh observation into a leg's next phase. Commitment-PDA evidence
/// drives the sanctioned transitions through [`reconcile`]; uncorrelated ack-PDA
/// presence may only lift a still-pre-ack leg to the in-flight `Acked` phase,
/// never to `Delivered` or a terminal (see [`RouteObservation`]).
fn fold_leg(
    prior: LegPhase,
    direction: Direction,
    timeout_height: IbcHeight,
    obs: &RouteObservation,
) -> LegPhase {
    let observation = PollObservation {
        commitment: obs.commitment,
        ack_event: None, // success/error polarity is event-sourced, never PDA-sourced
        timeout_event: false, // timeout events are event-sourced, not observable from PDAs
        recv_observed: false, // never inferred from the uncorrelated ack PDA
        event_gap: false,
        current_height: obs.current_height,
        timeout_height,
    };
    let reconciled = apply_poll(prior, direction, Ok(observation));
    if obs.ack_present && matches!(reconciled, LegPhase::Committed | LegPhase::Relayed) {
        // Uncorrelated ack presence caps at the in-flight `Acked` phase; the
        // snapshot hash is ignored by `phase_from_ack_pda` (polarity unknowable).
        phase_from_ack_pda(&AckPdaSnapshot {
            commitment_hash: [0u8; 32],
        })
    } else {
        reconciled
    }
}

/// Poll a route's Solana packet PDAs once. See [`RouteObservation`] for why the
/// acknowledgement observation is presence-only and never terminal.
async fn poll_route(
    client: &SolanaClient,
    direction: Direction,
    channel: &str,
) -> Result<RouteObservation, AppError> {
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

    Ok(RouteObservation {
        current_height,
        commitment,
        ack_present,
    })
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

#[cfg(test)]
mod handler_tests {
    use super::*;
    use crate::transfer_tracker::{TransferStore, STATE_PENDING};
    use axum::extract::{Path, State};
    use axum::Json;
    use serde_json::json;
    use std::sync::Arc;
    use wiremock::matchers::{body_partial_json, method};
    use wiremock::{Mock, MockServer, ResponseTemplate};

    fn height(rev: u64, h: u64) -> IbcHeight {
        IbcHeight {
            revision_number: rev,
            revision_height: h,
        }
    }

    /// A one-leg Nolus->Solana request. This direction has no queryable Solana
    /// commitment PDA, so a poll only needs `getEpochInfo` + a null ack account.
    fn nolus_to_solana(timeout: IbcHeight) -> TrackRequest {
        TrackRequest {
            direction: Direction::NolusToSolana,
            channel: "channel-0".to_string(),
            legs: vec![TrackLegSpec {
                from_chain: Chain::Nolus,
                to_chain: Chain::Solana,
                timeout_height: timeout,
            }],
        }
    }

    async fn mount_epoch(server: &MockServer, slot: u64, epoch: u64) {
        Mock::given(method("POST"))
            .and(body_partial_json(json!({ "method": "getEpochInfo" })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0", "id": 1,
                "result": { "absoluteSlot": slot, "epoch": epoch },
            })))
            .mount(server)
            .await;
    }

    async fn mount_account_null(server: &MockServer) {
        Mock::given(method("POST"))
            .and(body_partial_json(json!({ "method": "getAccountInfo" })))
            .respond_with(ResponseTemplate::new(200).set_body_json(json!({
                "jsonrpc": "2.0", "id": 1,
                "result": { "context": { "slot": 1 }, "value": null },
            })))
            .mount(server)
            .await;
    }

    async fn state_with_solana(url: &str) -> Arc<crate::AppState> {
        let mut config = crate::test_utils::test_config();
        config.external.solana_rpc_url = Some(url.to_string());
        crate::test_utils::test_app_state_with_config_and_client(config, reqwest::Client::new())
            .await
    }

    #[tokio::test]
    async fn track_transfer_registers_a_route_and_persists_it() {
        let server = MockServer::start().await;
        mount_epoch(&server, 100, 5).await;
        mount_account_null(&server).await;
        let state = state_with_solana(&server.uri()).await;

        let accepted = track_transfer(State(state.clone()), Json(nolus_to_solana(height(5, 1000))))
            .await
            .expect("registration succeeds")
            .0;

        assert_eq!(state.transfer_store.active_count(), 1);
        let record = state
            .transfer_store
            .get(&accepted.id)
            .expect("record persisted");
        assert_eq!(record.legs[0].phase, LegPhase::Committed);
    }

    #[tokio::test]
    async fn get_transfer_status_repolls_advances_and_persists() {
        // Current height (6, 2000) is already past the leg's timeout (5, 100): a
        // status GET must fold Committed -> AwaitingTimeout and persist it.
        let server = MockServer::start().await;
        mount_epoch(&server, 2000, 6).await;
        mount_account_null(&server).await;
        let state = state_with_solana(&server.uri()).await;

        let accepted = track_transfer(State(state.clone()), Json(nolus_to_solana(height(5, 100))))
            .await
            .expect("registration")
            .0;
        assert_eq!(
            state.transfer_store.get(&accepted.id).unwrap().legs[0].phase,
            LegPhase::Committed
        );

        let response = get_transfer_status(State(state.clone()), Path(accepted.id.clone()))
            .await
            .expect("status")
            .0;
        assert_eq!(response.state, STATE_PENDING);
        assert_eq!(
            state.transfer_store.get(&accepted.id).unwrap().legs[0].phase,
            LegPhase::AwaitingTimeout,
            "the re-poll must advance and persist the leg phase"
        );
    }

    #[tokio::test]
    async fn get_transfer_status_unknown_id_is_404() {
        let state = state_with_solana("http://127.0.0.1:1/").await;
        let err = get_transfer_status(State(state), Path("missing".to_string()))
            .await
            .expect_err("unknown id must 404 before any poll");
        assert!(matches!(err, AppError::NotFound { .. }));
    }

    #[tokio::test]
    async fn track_transfer_rejects_at_capacity_before_any_rpc() {
        // A saturated set must reject BEFORE poll_route: the Solana client points
        // at an unroutable stub, so a RateLimited (rather than a ChainRpc/timeout)
        // proves the capacity check runs before any RPC is spent.
        let mut config = crate::test_utils::test_config();
        config.external.solana_rpc_url = Some("http://127.0.0.1:1/".to_string());
        let store = TransferStore::ephemeral_with_capacity(1);
        store
            .insert(TrackedTransfer {
                id: "existing".to_string(),
                direction: Direction::NolusToSolana,
                channel: "channel-0".to_string(),
                legs: Vec::new(),
                created_at: Utc::now(),
                terminal_at: None,
            })
            .await
            .expect("seed insert fills the single slot");
        let http = reqwest::Client::builder()
            .timeout(std::time::Duration::from_millis(1))
            .build()
            .expect("client builds");
        let state =
            crate::test_utils::test_app_state_with_config_client_and_store(config, http, store)
                .await;

        let err = track_transfer(State(state), Json(nolus_to_solana(height(5, 100))))
            .await
            .expect_err("a full set must reject");
        assert!(
            matches!(err, AppError::RateLimited { .. }),
            "capacity must reject before spending an RPC, got {err:?}"
        );
    }

    #[tokio::test]
    async fn refresh_record_keeps_prior_phase_on_poll_error() {
        let client = SolanaClient::new(
            Some("http://127.0.0.1:1/".to_string()),
            reqwest::Client::builder()
                .timeout(std::time::Duration::from_millis(1))
                .build()
                .expect("client builds"),
        );
        let mut record = TrackedTransfer {
            id: "t".to_string(),
            direction: Direction::NolusToSolana,
            channel: "channel-0".to_string(),
            legs: vec![TrackedLeg {
                phase: LegPhase::Relayed,
                from_chain: Chain::Nolus,
                to_chain: Chain::Solana,
                timeout_height: height(5, 100),
            }],
            created_at: Utc::now(),
            terminal_at: None,
        };
        let changed = refresh_record(&client, &mut record).await;
        assert!(!changed, "a failed poll must change nothing");
        assert_eq!(record.legs[0].phase, LegPhase::Relayed);
    }

    #[test]
    fn fold_leg_uncorrelated_ack_never_reaches_terminal_or_delivered() {
        let obs = RouteObservation {
            current_height: height(5, 10),
            commitment: CommitmentObservation::Present,
            ack_present: true,
        };
        let phase = fold_leg(
            LegPhase::Relayed,
            Direction::SolanaToNolus,
            height(5, 1000),
            &obs,
        );
        assert_eq!(
            phase,
            LegPhase::Acked,
            "uncorrelated ack presence caps at the in-flight Acked phase"
        );
        assert_eq!(top_level_state(&[phase]), STATE_PENDING);
        assert!(!matches!(
            phase,
            LegPhase::Delivered | LegPhase::CompletedSuccess | LegPhase::CompletedError
        ));
    }

    #[test]
    fn fold_leg_refund_comes_from_commitment_not_uncorrelated_ack() {
        // Commitment gone on Solana->Nolus with an ack present on the channel: the
        // sanctioned commitment inference still refunds; ack presence must never
        // upgrade it to a success.
        let obs = RouteObservation {
            current_height: height(5, 10),
            commitment: CommitmentObservation::Gone,
            ack_present: true,
        };
        let phase = fold_leg(
            LegPhase::Relayed,
            Direction::SolanaToNolus,
            height(5, 1000),
            &obs,
        );
        assert_eq!(phase, LegPhase::TimedOutRefunded);
    }
}
