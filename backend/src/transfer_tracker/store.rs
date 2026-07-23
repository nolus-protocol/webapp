//! Durable tracking set for in-flight transfers.
//!
//! A single locked canonical map of route id -> [`TrackedTransfer`], persisted
//! as a whole-map JSON image. Each write goes to a unique temp file, is
//! `sync_all`'d, renamed into place, and the parent directory is fsync'd. A
//! corrupt image on load is a loud failure with a `.bak` fallback — never a
//! silent empty start. Terminal routes are retained for a window, then pruned.

use std::path::PathBuf;

use chrono::{DateTime, Duration, Utc};

use crate::error::AppError;

use super::TrackedTransfer;

/// The durable, capped, self-pruning tracking set.
pub struct TransferStore {
    path: PathBuf,
    capacity: usize,
    retention: Duration,
}

impl TransferStore {
    /// Bind a store to `path` with an empty in-memory set — the create path
    /// when no prior image exists.
    pub fn create(path: PathBuf, capacity: usize, retention: Duration) -> Self {
        let _ = (path, capacity, retention);
        todo!("initialise an empty locked map bound to `path`")
    }

    /// Load an existing image from `path`. A corrupt primary image falls back
    /// to `<path>.bak`; if neither loads, this returns `Err` — it must never
    /// silently yield an empty set.
    pub async fn load(path: PathBuf, capacity: usize, retention: Duration) -> Result<Self, AppError> {
        let _ = (path, capacity, retention);
        todo!("load primary; on corruption try .bak; else Err (never empty-start)")
    }

    /// Persist the whole map: unique temp file -> `sync_all` -> atomic rename
    /// -> parent-dir fsync.
    pub async fn persist(&self) -> Result<(), AppError> {
        todo!("whole-map write via unique temp + sync_all + parent fsync")
    }

    /// Insert a new tracked route. Rejects with `Err` once the active set is at
    /// capacity.
    pub async fn insert(&self, record: TrackedTransfer) -> Result<(), AppError> {
        let _ = record;
        todo!("reject at capacity; otherwise insert and persist")
    }

    /// Fetch a tracked route by id.
    pub fn get(&self, id: &str) -> Option<TrackedTransfer> {
        let _ = id;
        todo!("clone the record out of the locked map")
    }

    /// Number of routes currently held.
    pub fn active_count(&self) -> usize {
        todo!("map length under the lock")
    }

    /// Drop terminal routes whose `terminal_at` is older than the retention
    /// window relative to `now`.
    pub fn prune(&self, now: DateTime<Utc>) {
        let _ = now;
        todo!("evict terminal routes past the retention window")
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::transfer_tracker::{Chain, Direction, IbcHeight, LegPhase, TrackedLeg};
    use tempfile::TempDir;

    fn retention() -> Duration {
        Duration::seconds(3600)
    }

    fn at(secs: i64) -> DateTime<Utc> {
        DateTime::<Utc>::from_timestamp(secs, 0).expect("valid timestamp")
    }

    fn record(id: &str, terminal_at: Option<DateTime<Utc>>) -> TrackedTransfer {
        TrackedTransfer {
            id: id.to_string(),
            direction: Direction::SolanaToNolus,
            channel: "channel-0".to_string(),
            legs: vec![TrackedLeg {
                phase: LegPhase::CompletedSuccess,
                from_chain: Chain::Solana,
                to_chain: Chain::Nolus,
                timeout_height: IbcHeight {
                    revision_number: 5,
                    revision_height: 100,
                },
            }],
            created_at: at(1_700_000_000),
            terminal_at,
        }
    }

    #[tokio::test]
    async fn insert_persist_then_reload_recovers_the_record() {
        let dir = TempDir::new().expect("tempdir");
        let path = dir.path().join("transfers.json");
        let original = record("t1", None);

        let store = TransferStore::create(path.clone(), 512, retention());
        store.insert(original.clone()).await.expect("insert");
        store.persist().await.expect("persist");

        let reloaded = TransferStore::load(path, 512, retention())
            .await
            .expect("reload from persisted image");
        assert_eq!(reloaded.get("t1"), Some(original));
    }

    #[tokio::test]
    async fn corrupt_image_load_errors_rather_than_starting_empty() {
        let dir = TempDir::new().expect("tempdir");
        let path = dir.path().join("transfers.json");
        std::fs::write(&path, b"{ this is not valid json").expect("seed corrupt file");

        let result = TransferStore::load(path, 512, retention()).await;
        assert!(
            result.is_err(),
            "a corrupt image must be a loud failure, never a silent empty set"
        );
    }

    #[tokio::test]
    async fn insert_is_rejected_at_capacity() {
        let dir = TempDir::new().expect("tempdir");
        let path = dir.path().join("transfers.json");
        let store = TransferStore::create(path, 1, retention());

        store.insert(record("t1", None)).await.expect("first insert fits");
        assert!(
            store.insert(record("t2", None)).await.is_err(),
            "insert past the active-set cap must be rejected"
        );
    }

    #[tokio::test]
    async fn terminal_record_survives_within_retention_then_prunes() {
        let dir = TempDir::new().expect("tempdir");
        let path = dir.path().join("transfers.json");
        let terminal = at(1_700_000_000);
        let store = TransferStore::create(path, 512, retention());
        store
            .insert(record("t1", Some(terminal)))
            .await
            .expect("insert terminal record");

        store.prune(terminal + Duration::seconds(60));
        assert!(
            store.get("t1").is_some(),
            "terminal record must remain within the retention window"
        );

        store.prune(terminal + retention() + Duration::seconds(1));
        assert!(
            store.get("t1").is_none(),
            "terminal record must be pruned past the retention window"
        );
    }
}
