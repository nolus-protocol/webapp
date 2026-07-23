//! Nolus <-> Solana transfer tracker: state model, per-leg reconciliation, and
//! the status response shape served by `GET /api/transfer/status/{id}`.
//!
//! Terminal outcomes derive from observed chain events, never from a packet
//! PDA snapshot: an acknowledgement PDA holds only a 32-byte commitment hash
//! whose success-vs-error polarity is unknowable off-chain. The durable
//! tracking set lives in [`store`].

use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use utoipa::ToSchema;

mod store;

pub use store::TransferStore;

/// Maximum number of legs a single tracked route may declare. A transfer ->
/// swap -> transfer route is three legs; the cap bounds pathological requests.
pub const MAX_TRACKED_LEGS: usize = 8;

/// Default cap on the durable active-tracking set. The tracker refuses new
/// registrations once this many in-flight routes are held.
pub const DEFAULT_ACTIVE_SET_CAP: usize = 512;

/// Top-level status string mirroring the Skip enum the frontend already
/// consumes. Kept as `&str` constants so the response contract is named once.
pub const STATE_PENDING: &str = "STATE_PENDING";
pub const STATE_COMPLETED_SUCCESS: &str = "STATE_COMPLETED_SUCCESS";
pub const STATE_COMPLETED_ERROR: &str = "STATE_COMPLETED_ERROR";
pub const STATE_ABANDONED: &str = "STATE_ABANDONED";

/// The two chains a transfer leg can touch.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "lowercase")]
pub enum Chain {
    Nolus,
    Solana,
}

impl Chain {
    /// Lowercase wire label, matching this enum's `serde` representation. Used
    /// where the response carries the chain as a plain `String`.
    pub const fn label(self) -> &'static str {
        match self {
            Self::Nolus => "nolus",
            Self::Solana => "solana",
        }
    }
}

/// Direction of the overall route, fixing which chain holds the commitment
/// truth and which supplies terminal events.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
#[serde(rename_all = "snake_case")]
pub enum Direction {
    NolusToSolana,
    SolanaToNolus,
}

/// Polarity of a Nolus `acknowledge_packet` event's ack payload. This is the
/// only source of success-vs-error truth for an acked leg.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum AckOutcome {
    Success,
    Error,
}

/// Whether a channel's commitment for this packet is still present.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum CommitmentObservation {
    Present,
    Gone,
}

/// Per-leg lifecycle phase. `Acked` records that an acknowledgement exists
/// without asserting its polarity; the success/error terminals are reachable
/// only from an ack *event*, and `TimedOutRefunded` only from an observed
/// timeout event (or the Solana->Nolus commitment-gone-without-recv
/// inference). `Indeterminate` is a real terminal: the commitment vanished
/// across an observation gap and no terminal was captured.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum LegPhase {
    Committed,
    Relayed,
    Acked,
    Delivered,
    AwaitingTimeout,
    CompletedSuccess,
    CompletedError,
    TimedOutRefunded,
    Indeterminate,
}

/// An IBC height is a `(revision_number, revision_height)` tuple. Timeout
/// eligibility compares the whole tuple, never the slot alone.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct IbcHeight {
    pub revision_number: u64,
    pub revision_height: u64,
}

/// The raw acknowledgement PDA image: a single 32-byte commitment hash. It
/// carries no success-vs-error signal by construction.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub struct AckPdaSnapshot {
    pub commitment_hash: [u8; 32],
}

/// One poll cycle's observation for a single leg. Feeds [`reconcile`].
#[derive(Debug, Clone)]
pub struct PollObservation {
    pub commitment: CommitmentObservation,
    pub ack_event: Option<AckOutcome>,
    pub timeout_event: bool,
    pub recv_observed: bool,
    pub event_gap: bool,
    pub current_height: IbcHeight,
    pub timeout_height: IbcHeight,
}

/// A single tracked leg's persisted record.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackedLeg {
    pub phase: LegPhase,
    pub from_chain: Chain,
    pub to_chain: Chain,
    pub timeout_height: IbcHeight,
}

/// A tracked route: the durable unit the store persists and the status
/// endpoint reads.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
pub struct TrackedTransfer {
    pub id: String,
    pub direction: Direction,
    pub channel: String,
    pub legs: Vec<TrackedLeg>,
    pub created_at: DateTime<Utc>,
    pub terminal_at: Option<DateTime<Utc>>,
}

/// Where the asset currently rests, mirroring Skip's `transfer_asset_release`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct AssetRelease {
    pub chain: String,
    pub released: bool,
}

/// Typed per-route error, mirroring Skip's error envelope.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct TransferError {
    pub code: String,
    pub message: String,
}

/// One entry of the modern `transfers[]` shape: a per-leg state plus the
/// chains it bridges.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct TransferLeg {
    pub state: String,
    pub from_chain: String,
    pub to_chain: String,
}

/// The status response served by `GET /api/transfer/status/{id}`. This is the
/// tracker's own type, NOT a re-use of `SkipStatusResponse`.
#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize, ToSchema)]
pub struct TransferStatusResponse {
    pub state: String,
    pub transfers: Vec<TransferLeg>,
    pub next_blocking_transfer: Option<usize>,
    pub transfer_asset_release: Option<AssetRelease>,
    pub error: Option<TransferError>,
}

/// True when `current` is at or past `timeout`, comparing the full IBC height
/// tuple (revision number first, then revision height).
pub fn timeout_reached(current: IbcHeight, timeout: IbcHeight) -> bool {
    (current.revision_number, current.revision_height)
        >= (timeout.revision_number, timeout.revision_height)
}

/// Terminal phase derived from a Nolus `acknowledge_packet` event's ack
/// payload polarity — the only source of success-vs-error truth.
pub const fn phase_from_ack_event(outcome: AckOutcome) -> LegPhase {
    match outcome {
        AckOutcome::Success => LegPhase::CompletedSuccess,
        AckOutcome::Error => LegPhase::CompletedError,
    }
}

/// Phase implied by an acknowledgement PDA snapshot alone. The 32-byte hash
/// carries no polarity, so this never yields a success/error terminal.
pub const fn phase_from_ack_pda(snapshot: &AckPdaSnapshot) -> LegPhase {
    let _ = snapshot;
    LegPhase::Acked
}

/// The chain whose commitment PDA the tracker may query for this direction.
/// Nolus->Solana observes the commitment through Nolus CometBFT events, so it
/// has no commitment PDA to query (`None`); Solana->Nolus reads the commitment
/// PDA on Solana. Never Nolus — Nolus is Cosmos and holds no packet PDAs.
pub const fn commitment_pda_chain(direction: Direction) -> Option<Chain> {
    match direction {
        Direction::SolanaToNolus => Some(Chain::Solana),
        Direction::NolusToSolana => None,
    }
}

/// Fold one poll observation into the next leg phase. Applies the timeout
/// tuple rule, the Solana->Nolus timeout-refund inference, and the
/// commitment-gone-across-a-gap -> `Indeterminate` rule.
pub fn reconcile(prior: LegPhase, direction: Direction, obs: &PollObservation) -> LegPhase {
    // 1. A captured acknowledgement event is authoritative: it is the only
    //    source of success-vs-error polarity and wins over any inference.
    if let Some(outcome) = obs.ack_event {
        return phase_from_ack_event(outcome);
    }

    // 2. A captured timeout event refunds the leg, in either direction.
    if obs.timeout_event {
        return LegPhase::TimedOutRefunded;
    }

    // 3. The commitment vanished from the source channel.
    if matches!(obs.commitment, CommitmentObservation::Gone) {
        // A gap in observation with no captured terminal cannot be told apart
        // from a missed ack/timeout: the outcome is genuinely unknown.
        if obs.event_gap {
            return LegPhase::Indeterminate;
        }
        // Under continuous observation, only Solana->Nolus can infer a
        // timeout-refund from a vanished commitment with no receive; Nolus->Solana
        // has no queryable commitment and must wait for an event.
        if direction == Direction::SolanaToNolus && !obs.recv_observed {
            return LegPhase::TimedOutRefunded;
        }
    }

    // 4. Delivered to the destination, ack not yet returned.
    if obs.recv_observed {
        return LegPhase::Delivered;
    }

    // 5. Commitment still present past its timeout height: eligible for a
    //    timeout the relayer has not yet driven, not itself a refund.
    if matches!(obs.commitment, CommitmentObservation::Present)
        && timeout_reached(obs.current_height, obs.timeout_height)
    {
        return LegPhase::AwaitingTimeout;
    }

    // 6. Nothing new observed: hold the prior phase.
    prior
}

/// Apply a poll result. A failed poll (RPC / decode error) is unknown, not
/// terminal: the prior phase is returned untouched.
pub fn apply_poll(
    prior: LegPhase,
    direction: Direction,
    poll: Result<PollObservation, crate::error::AppError>,
) -> LegPhase {
    match poll {
        Ok(obs) => reconcile(prior, direction, &obs),
        Err(_) => prior,
    }
}

/// Whether a per-leg phase is still in flight (blocking the route from
/// resolving). Terminal phases — the two successes, the two failures, and the
/// indeterminate terminal — are not blocking.
const fn is_in_flight(phase: LegPhase) -> bool {
    matches!(
        phase,
        LegPhase::Committed | LegPhase::Relayed | LegPhase::Acked | LegPhase::AwaitingTimeout
    )
}

/// Top-level route state from the per-leg phases, mirroring the Skip enum.
pub fn top_level_state(legs: &[LegPhase]) -> &'static str {
    let mut any_error = false;
    let mut any_indeterminate = false;
    let mut any_in_flight = false;
    for &phase in legs {
        match phase {
            LegPhase::CompletedError | LegPhase::TimedOutRefunded => any_error = true,
            LegPhase::Indeterminate => any_indeterminate = true,
            LegPhase::Committed
            | LegPhase::Relayed
            | LegPhase::Acked
            | LegPhase::AwaitingTimeout => any_in_flight = true,
            LegPhase::CompletedSuccess | LegPhase::Delivered => {}
        }
    }
    if any_error {
        STATE_COMPLETED_ERROR
    } else if any_indeterminate {
        STATE_ABANDONED
    } else if any_in_flight {
        STATE_PENDING
    } else {
        STATE_COMPLETED_SUCCESS
    }
}

/// Build the status response for a tracked route.
pub fn status_response(record: &TrackedTransfer) -> TransferStatusResponse {
    let phases: Vec<LegPhase> = record.legs.iter().map(|leg| leg.phase).collect();
    let state = top_level_state(&phases);

    let transfers = record
        .legs
        .iter()
        .map(|leg| TransferLeg {
            state: top_level_state(&[leg.phase]).to_string(),
            from_chain: leg.from_chain.label().to_string(),
            to_chain: leg.to_chain.label().to_string(),
        })
        .collect();

    let next_blocking_transfer = record.legs.iter().position(|leg| is_in_flight(leg.phase));

    let transfer_asset_release = asset_release(record, state);
    let error = route_error(&record.legs, state);

    TransferStatusResponse {
        state: state.to_string(),
        transfers,
        next_blocking_transfer,
        transfer_asset_release,
        error,
    }
}

/// Where the asset rests once the route reaches a terminal: released at the
/// final destination on success, refunded to the source on failure, and
/// unknown (in transit) while the route is still pending or abandoned.
fn asset_release(record: &TrackedTransfer, state: &str) -> Option<AssetRelease> {
    match state {
        STATE_COMPLETED_SUCCESS => record.legs.last().map(|leg| AssetRelease {
            chain: leg.to_chain.label().to_string(),
            released: true,
        }),
        STATE_COMPLETED_ERROR => record.legs.first().map(|leg| AssetRelease {
            chain: leg.from_chain.label().to_string(),
            released: true,
        }),
        _ => None,
    }
}

/// Operational error envelope for a failed route. Worded as an operational
/// outcome (the relayer is a permissioned single operator), never as a
/// cryptographic guarantee.
fn route_error(legs: &[TrackedLeg], state: &str) -> Option<TransferError> {
    if state != STATE_COMPLETED_ERROR {
        return None;
    }
    let failing = legs.iter().find_map(|leg| match leg.phase {
        LegPhase::CompletedError => Some(TransferError {
            code: "ERROR_ACKNOWLEDGED".to_string(),
            message:
                "The transfer was rejected on the destination chain and refunded to the source."
                    .to_string(),
        }),
        LegPhase::TimedOutRefunded => Some(TransferError {
            code: "TIMED_OUT_REFUNDED".to_string(),
            message: "The transfer timed out before delivery and was refunded to the source."
                .to_string(),
        }),
        _ => None,
    });
    failing.or(Some(TransferError {
        code: "TRANSFER_FAILED".to_string(),
        message: "The transfer did not complete and was refunded to the source.".to_string(),
    }))
}

#[cfg(test)]
mod tests {
    use super::*;

    const HASH: [u8; 32] = [0xAB; 32];

    fn height(rev: u64, h: u64) -> IbcHeight {
        IbcHeight {
            revision_number: rev,
            revision_height: h,
        }
    }

    // Rule 1 — terminal polarity comes from ack events, never PDAs.

    #[test]
    fn ack_pda_snapshot_never_yields_a_success_terminal() {
        let phase = phase_from_ack_pda(&AckPdaSnapshot {
            commitment_hash: HASH,
        });
        assert!(
            !matches!(phase, LegPhase::CompletedSuccess),
            "ack PDA hash has no polarity; must not imply CompletedSuccess"
        );
    }

    #[test]
    fn ack_pda_snapshot_never_yields_an_error_terminal() {
        let phase = phase_from_ack_pda(&AckPdaSnapshot {
            commitment_hash: HASH,
        });
        assert!(
            !matches!(phase, LegPhase::CompletedError),
            "ack PDA hash has no polarity; must not imply CompletedError"
        );
    }

    #[test]
    fn ack_pda_snapshot_resolves_to_acked_polarity_unknown() {
        let phase = phase_from_ack_pda(&AckPdaSnapshot {
            commitment_hash: HASH,
        });
        assert_eq!(phase, LegPhase::Acked);
    }

    #[test]
    fn ack_event_success_payload_yields_success_terminal() {
        assert_eq!(
            phase_from_ack_event(AckOutcome::Success),
            LegPhase::CompletedSuccess
        );
    }

    #[test]
    fn ack_event_error_payload_yields_error_terminal() {
        assert_eq!(
            phase_from_ack_event(AckOutcome::Error),
            LegPhase::CompletedError
        );
    }

    // Rule 2 — never query a commitment PDA on the wrong side for a direction.

    #[test]
    fn nolus_to_solana_has_no_commitment_pda_to_query() {
        assert_eq!(commitment_pda_chain(Direction::NolusToSolana), None);
    }

    #[test]
    fn solana_to_nolus_queries_the_solana_commitment_pda() {
        assert_eq!(
            commitment_pda_chain(Direction::SolanaToNolus),
            Some(Chain::Solana)
        );
    }

    #[test]
    fn commitment_pda_chain_is_never_nolus() {
        for direction in [Direction::NolusToSolana, Direction::SolanaToNolus] {
            assert_ne!(
                commitment_pda_chain(direction),
                Some(Chain::Nolus),
                "Nolus is Cosmos and holds no packet PDAs"
            );
        }
    }

    // Rule 3 — a gap without a captured terminal is INDETERMINATE.

    #[test]
    fn commitment_gone_across_observation_gap_is_indeterminate() {
        let obs = PollObservation {
            commitment: CommitmentObservation::Gone,
            ack_event: None,
            timeout_event: false,
            recv_observed: false,
            event_gap: true,
            current_height: height(5, 10),
            timeout_height: height(5, 1000),
        };
        assert_eq!(
            reconcile(LegPhase::Relayed, Direction::SolanaToNolus, &obs),
            LegPhase::Indeterminate
        );
    }

    #[test]
    fn indeterminate_is_never_a_fabricated_timeout() {
        let obs = PollObservation {
            commitment: CommitmentObservation::Gone,
            ack_event: None,
            timeout_event: false,
            recv_observed: false,
            event_gap: true,
            current_height: height(5, 10),
            timeout_height: height(5, 1000),
        };
        assert_ne!(
            reconcile(LegPhase::Relayed, Direction::NolusToSolana, &obs),
            LegPhase::TimedOutRefunded
        );
    }

    // Rule 2 — Solana->Nolus timeout-refund inference (continuous observation).

    #[test]
    fn solana_to_nolus_commitment_gone_no_recv_no_gap_is_timeout_refunded() {
        let obs = PollObservation {
            commitment: CommitmentObservation::Gone,
            ack_event: None,
            timeout_event: false,
            recv_observed: false,
            event_gap: false,
            current_height: height(5, 10),
            timeout_height: height(5, 5),
        };
        assert_eq!(
            reconcile(LegPhase::Relayed, Direction::SolanaToNolus, &obs),
            LegPhase::TimedOutRefunded
        );
    }

    // Rule 4 — past the timeout height with the commitment still present is
    // awaiting-timeout, not refunded. Straddles an epoch boundary.

    #[test]
    fn present_commitment_past_timeout_height_is_awaiting_not_refunded() {
        let obs = PollObservation {
            commitment: CommitmentObservation::Present,
            ack_event: None,
            timeout_event: false,
            recv_observed: false,
            event_gap: false,
            current_height: height(6, 1),
            timeout_height: height(5, 1000),
        };
        assert_eq!(
            reconcile(LegPhase::Relayed, Direction::NolusToSolana, &obs),
            LegPhase::AwaitingTimeout
        );
    }

    #[test]
    fn timeout_reached_uses_epoch_before_slot() {
        // Higher epoch, lower slot: reached despite the slot being smaller.
        assert!(timeout_reached(height(6, 1), height(5, 1000)));
    }

    #[test]
    fn timeout_not_reached_when_epoch_is_behind_despite_larger_slot() {
        // Lower epoch, larger slot: NOT reached. A slot-only comparison fails.
        assert!(!timeout_reached(height(5, 5000), height(6, 1)));
    }

    // Rule 5 — event-sourced terminals drive the leg terminal through
    // `reconcile` itself (not only the `phase_from_ack_event` helper), and take
    // precedence over the commitment inference. AC1: each terminal — delivered,
    // error-acked, timeout-refunded — is reached with the correct per-leg state.

    #[test]
    fn reconcile_ack_success_event_wins_over_commitment_gone_inference() {
        // Commitment gone with no recv on Solana->Nolus would otherwise infer a
        // timeout-refund; a success ack event must win and deliver the leg.
        let obs = PollObservation {
            commitment: CommitmentObservation::Gone,
            ack_event: Some(AckOutcome::Success),
            timeout_event: false,
            recv_observed: false,
            event_gap: false,
            current_height: height(5, 10),
            timeout_height: height(5, 1000),
        };
        assert_eq!(
            reconcile(LegPhase::Relayed, Direction::SolanaToNolus, &obs),
            LegPhase::CompletedSuccess
        );
    }

    #[test]
    fn reconcile_ack_error_event_yields_error_terminal_over_commitment_gone() {
        let obs = PollObservation {
            commitment: CommitmentObservation::Gone,
            ack_event: Some(AckOutcome::Error),
            timeout_event: false,
            recv_observed: false,
            event_gap: false,
            current_height: height(5, 10),
            timeout_height: height(5, 1000),
        };
        assert_eq!(
            reconcile(LegPhase::Relayed, Direction::SolanaToNolus, &obs),
            LegPhase::CompletedError
        );
    }

    #[test]
    fn reconcile_recv_without_ack_is_delivered_not_terminal() {
        // Packet arrived on the destination; the source ack has not returned, so
        // the leg is delivered-but-not-yet-terminal.
        let obs = PollObservation {
            commitment: CommitmentObservation::Present,
            ack_event: None,
            timeout_event: false,
            recv_observed: true,
            event_gap: false,
            current_height: height(5, 10),
            timeout_height: height(5, 1000),
        };
        assert_eq!(
            reconcile(LegPhase::Relayed, Direction::NolusToSolana, &obs),
            LegPhase::Delivered
        );
    }

    #[test]
    fn reconcile_explicit_timeout_event_refunds_nolus_to_solana_leg() {
        // Nolus->Solana cannot infer a timeout from a vanished commitment; only
        // an observed timeout event reaches the refund terminal for that leg.
        let obs = PollObservation {
            commitment: CommitmentObservation::Gone,
            ack_event: None,
            timeout_event: true,
            recv_observed: false,
            event_gap: false,
            current_height: height(6, 1),
            timeout_height: height(5, 1000),
        };
        assert_eq!(
            reconcile(LegPhase::Relayed, Direction::NolusToSolana, &obs),
            LegPhase::TimedOutRefunded
        );
    }

    // Rule 9 — a poll error is unknown, not terminal.

    #[test]
    fn poll_error_leaves_prior_phase_untouched() {
        let poll = Err(crate::error::AppError::ChainRpc {
            chain: "solana".to_string(),
            message: "rpc down".to_string(),
        });
        assert_eq!(
            apply_poll(LegPhase::Relayed, Direction::SolanaToNolus, poll),
            LegPhase::Relayed
        );
    }

    // Rule 7 (body) — top-level state mapping and whole-value response shape.

    #[test]
    fn all_legs_delivered_maps_to_completed_success() {
        assert_eq!(
            top_level_state(&[LegPhase::CompletedSuccess, LegPhase::Delivered]),
            STATE_COMPLETED_SUCCESS
        );
    }

    #[test]
    fn any_error_leg_maps_to_completed_error() {
        assert_eq!(
            top_level_state(&[LegPhase::CompletedSuccess, LegPhase::CompletedError]),
            STATE_COMPLETED_ERROR
        );
    }

    #[test]
    fn any_indeterminate_leg_maps_to_abandoned() {
        assert_eq!(
            top_level_state(&[LegPhase::Delivered, LegPhase::Indeterminate]),
            STATE_ABANDONED
        );
    }

    #[test]
    fn in_flight_leg_maps_to_pending() {
        assert_eq!(top_level_state(&[LegPhase::Relayed]), STATE_PENDING);
    }

    #[test]
    fn status_response_matches_modern_transfers_shape() {
        let record = TrackedTransfer {
            id: "t1".to_string(),
            direction: Direction::SolanaToNolus,
            channel: "channel-0".to_string(),
            legs: vec![TrackedLeg {
                phase: LegPhase::CompletedSuccess,
                from_chain: Chain::Solana,
                to_chain: Chain::Nolus,
                timeout_height: height(5, 100),
            }],
            created_at: DateTime::<Utc>::from_timestamp(1_700_000_000, 0).unwrap(),
            terminal_at: Some(DateTime::<Utc>::from_timestamp(1_700_000_100, 0).unwrap()),
        };
        let expected = serde_json::json!({
            "state": "STATE_COMPLETED_SUCCESS",
            "transfers": [
                {
                    "state": "STATE_COMPLETED_SUCCESS",
                    "from_chain": "solana",
                    "to_chain": "nolus"
                }
            ],
            "next_blocking_transfer": null,
            "transfer_asset_release": { "chain": "nolus", "released": true },
            "error": null
        });
        let actual = serde_json::to_value(status_response(&record)).expect("response serializes");
        assert_eq!(actual, expected);
    }
}
