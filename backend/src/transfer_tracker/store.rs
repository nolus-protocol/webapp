//! Durable tracking set for in-flight transfers.
//!
//! A single locked canonical map of route id -> [`TrackedTransfer`], persisted
//! as a whole-map JSON image. Each write goes to a unique temp file, is
//! `sync_all`'d, renamed into place, and the parent directory is fsync'd. A
//! corrupt image on load is a loud failure with a `.bak` fallback — never a
//! silent empty start. Terminal routes are retained for a window, then pruned.

use std::collections::HashMap;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use std::sync::{Mutex, PoisonError};

use chrono::{DateTime, Duration, Utc};
use tokio::io::AsyncWriteExt as _;
use tracing::warn;

use crate::error::AppError;

use super::TrackedTransfer;

/// Monotonic suffix source for temp-file uniqueness within a persist directory.
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// The durable, capped, self-pruning tracking set.
///
/// The canonical map is guarded by a single std [`Mutex`], never held across an
/// `.await`: async methods snapshot or mutate under it, drop it, then do file
/// I/O. A separate async `write_gate` serializes persist calls so that the
/// image written to disk is always the newest snapshot (see [`persist`]).
pub struct TransferStore {
    path: PathBuf,
    capacity: usize,
    retention: Duration,
    entries: Mutex<HashMap<String, TrackedTransfer>>,
    write_gate: tokio::sync::Mutex<()>,
}

impl TransferStore {
    /// Bind a store to `path` with an empty in-memory set — the create path
    /// when no prior image exists.
    pub fn create(path: PathBuf, capacity: usize, retention: Duration) -> Self {
        Self {
            path,
            capacity,
            retention,
            entries: Mutex::new(HashMap::new()),
            write_gate: tokio::sync::Mutex::new(()),
        }
    }

    /// Load an existing image from `path`. A corrupt primary image falls back
    /// to `<path>.bak`; if neither loads, this returns `Err` — it must never
    /// silently yield an empty set.
    pub async fn load(
        path: PathBuf,
        capacity: usize,
        retention: Duration,
    ) -> Result<Self, AppError> {
        let primary = Self::read_image(&path).await;
        let entries = match primary {
            Ok(map) => map,
            Err(primary_err) => {
                let backup = Self::backup_path(&path);
                Self::read_image(&backup).await.map_err(|_backup_err| {
                    AppError::Internal(format!(
                        "transfer store image at {} is unreadable and no valid backup exists: {primary_err}",
                        path.display()
                    ))
                })?
            }
        };
        let store = Self {
            path,
            capacity,
            retention,
            entries: Mutex::new(entries),
            write_gate: tokio::sync::Mutex::new(()),
        };
        // Drop terminals whose retention window elapsed while the process was
        // down, so they neither reload nor count toward the cap.
        store.prune(Utc::now());
        Ok(store)
    }

    /// Durably write the current tracking set to the store's path. Concurrent
    /// callers are safe: the newest state always lands last, and a crash never
    /// leaves a partial image behind.
    pub async fn persist(&self) -> Result<(), AppError> {
        // Snapshot INSIDE the write gate so snapshot order equals rename
        // order — a slower writer must never rename a staler image over a
        // newer one (silent record loss across a restart).
        let _write = self.write_gate.lock().await;
        let snapshot = self.snapshot();
        let bytes = serde_json::to_vec_pretty(&snapshot)
            .map_err(|e| AppError::Internal(format!("serialising transfer store: {e}")))?;

        let dir = self.path.parent().filter(|p| !p.as_os_str().is_empty());
        let temp = self.temp_path();

        {
            let mut file = tokio::fs::File::create(&temp).await.map_err(|e| {
                AppError::Internal(format!("creating transfer store temp file: {e}"))
            })?;
            file.write_all(&bytes).await.map_err(|e| {
                AppError::Internal(format!("writing transfer store temp file: {e}"))
            })?;
            file.sync_all().await.map_err(|e| {
                AppError::Internal(format!("syncing transfer store temp file: {e}"))
            })?;
        }

        tokio::fs::rename(&temp, &self.path)
            .await
            .map_err(|e| AppError::Internal(format!("committing transfer store image: {e}")))?;

        // The parent-dir fsync durably records the rename; a failure here does
        // not lose the written image (already fsync'd), so it is non-fatal, but
        // it must be surfaced rather than swallowed.
        if let Some(dir) = dir {
            match tokio::fs::File::open(dir).await {
                Ok(handle) => {
                    if let Err(e) = handle.sync_all().await {
                        warn!(
                            "transfer store parent-dir fsync failed ({}): {e}",
                            dir.display()
                        );
                    }
                }
                Err(e) => {
                    warn!(
                        "transfer store parent-dir open failed ({}): {e}",
                        dir.display()
                    );
                }
            }
        }
        Ok(())
    }

    /// Insert a new tracked route. Rejects with `Err` once the active set is at
    /// capacity. A persist failure rolls the in-memory insert back.
    pub async fn insert(&self, record: TrackedTransfer) -> Result<(), AppError> {
        let id = record.id.clone();
        // Prune expired terminals first so they stop counting toward the cap:
        // the capacity gate must reflect live, still-in-flight routes only.
        self.prune(Utc::now());
        {
            let mut entries = self.lock();
            if entries.len() >= self.capacity {
                return Err(AppError::RateLimited { retry_after: None });
            }
            entries.insert(id.clone(), record);
        }
        if let Err(e) = self.persist().await {
            // Roll back so a persist failure never leaves an orphan record that
            // permanently consumes a capacity slot until restart.
            self.lock().remove(&id);
            return Err(e);
        }
        Ok(())
    }

    /// Replace an already-tracked route's state and persist. Not capacity-gated
    /// (the id is already counted); a route absent from the set (pruned or
    /// removed) is a no-op, so a status re-poll never resurrects it.
    pub async fn update(&self, record: TrackedTransfer) -> Result<(), AppError> {
        // Opportunistically evict expired terminals on the write path (cheap for
        // a <=cap map); the just-updated record carries a fresh terminal_at when
        // it goes terminal, so it is never within the pruned set itself.
        self.prune(Utc::now());
        {
            let mut entries = self.lock();
            if !entries.contains_key(&record.id) {
                return Ok(());
            }
            entries.insert(record.id.clone(), record);
        }
        self.persist().await
    }

    /// Fetch a tracked route by id.
    pub fn get(&self, id: &str) -> Option<TrackedTransfer> {
        self.lock().get(id).cloned()
    }

    /// Number of routes currently held.
    pub fn active_count(&self) -> usize {
        self.lock().len()
    }

    /// The active-set cap this store enforces on new insertions.
    pub const fn capacity(&self) -> usize {
        self.capacity
    }

    /// Drop terminal routes whose `terminal_at` is older than the retention
    /// window relative to `now`.
    fn prune(&self, now: DateTime<Utc>) {
        let mut entries = self.lock();
        entries.retain(|_id, record| match record.terminal_at {
            Some(terminal_at) => terminal_at + self.retention >= now,
            None => true,
        });
    }

    /// Lock the canonical map, recovering the inner guard on poisoning rather
    /// than panicking (a poisoned lock still holds a usable map).
    fn lock(&self) -> std::sync::MutexGuard<'_, HashMap<String, TrackedTransfer>> {
        self.entries.lock().unwrap_or_else(PoisonError::into_inner)
    }

    /// Snapshot the canonical map for a whole-image write.
    fn snapshot(&self) -> HashMap<String, TrackedTransfer> {
        self.lock().clone()
    }

    /// The `<path>.bak` fallback image path.
    fn backup_path(path: &Path) -> PathBuf {
        let mut name = path.file_name().unwrap_or_default().to_os_string();
        name.push(".bak");
        path.with_file_name(name)
    }

    /// A unique temp path in the image's directory for an atomic write.
    fn temp_path(&self) -> PathBuf {
        let counter = TEMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let mut name = self.path.file_name().unwrap_or_default().to_os_string();
        name.push(format!(".tmp-{}-{counter}", std::process::id()));
        self.path.with_file_name(name)
    }

    /// Read and deserialise a whole-map image. Any I/O or parse failure is an
    /// `Err` — a missing or corrupt image never yields an empty map here.
    async fn read_image(path: &Path) -> Result<HashMap<String, TrackedTransfer>, AppError> {
        let bytes = tokio::fs::read(path)
            .await
            .map_err(|e| AppError::Internal(format!("reading transfer store image: {e}")))?;
        serde_json::from_slice(&bytes)
            .map_err(|e| AppError::Internal(format!("parsing transfer store image: {e}")))
    }

    /// Ephemeral store bound to a unique temp file, for tests only.
    #[cfg(test)]
    pub fn ephemeral() -> Self {
        Self::ephemeral_with_capacity(super::DEFAULT_ACTIVE_SET_CAP)
    }

    /// Ephemeral store with an explicit capacity, bound to a unique temp file,
    /// for tests only.
    #[cfg(test)]
    pub fn ephemeral_with_capacity(capacity: usize) -> Self {
        let path = std::env::temp_dir().join(format!(
            "transfers-test-{}-{}.json",
            std::process::id(),
            TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        Self::create(path, capacity, Duration::hours(1))
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

        store
            .insert(record("t1", None))
            .await
            .expect("first insert fits");
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

    #[tokio::test]
    async fn failed_persist_rolls_back_the_insert() {
        // Bind the store under a directory that does not exist yet: the atomic
        // temp write fails, so persist() (and thus insert) must fail — and the
        // in-memory insert must roll back so the capacity slot is not leaked.
        let dir = TempDir::new().expect("tempdir");
        let missing = dir.path().join("not-created-yet");
        let path = missing.join("transfers.json");
        let store = TransferStore::create(path, 512, retention());

        assert!(
            store.insert(record("t1", None)).await.is_err(),
            "insert into a non-existent directory must fail to persist"
        );
        assert_eq!(
            store.active_count(),
            0,
            "a failed persist must not leak an orphan in-memory record"
        );

        // Create the directory so persist can now succeed: the previously
        // rolled-back slot is available and a fresh insert lands.
        std::fs::create_dir_all(&missing).expect("create parent dir");
        store
            .insert(record("t2", None))
            .await
            .expect("insert succeeds once the directory exists");
        assert_eq!(store.active_count(), 1);
    }

    #[tokio::test]
    async fn expired_terminals_free_capacity_for_new_inserts() {
        let dir = TempDir::new().expect("tempdir");
        let path = dir.path().join("transfers.json");
        let store = TransferStore::create(path, 512, retention());

        // Fill the set to capacity with terminal records long past retention.
        let expired = at(1_700_000_000);
        {
            let mut entries = store.entries.lock().expect("lock");
            for i in 0..512 {
                let id = format!("old-{i}");
                entries.insert(id.clone(), record(&id, Some(expired)));
            }
        }
        assert_eq!(store.active_count(), 512);

        // A fresh registration: insert prunes the expired terminals first, so the
        // cap no longer 429s forever after 512 lifetime transfers.
        store
            .insert(record("new", None))
            .await
            .expect("insert must succeed once expired terminals are pruned");
        assert!(store.get("new").is_some());
        assert!(
            store.get("old-0").is_none(),
            "expired terminals were pruned"
        );
    }

    #[tokio::test]
    async fn load_drops_expired_terminal_records() {
        let dir = TempDir::new().expect("tempdir");
        let path = dir.path().join("transfers.json");

        // Persist a set holding one within-retention terminal and one expired.
        let fresh = TransferStore::create(path.clone(), 512, retention());
        fresh
            .insert(record("fresh", Some(Utc::now())))
            .await
            .expect("insert fresh terminal");
        {
            let mut entries = fresh.entries.lock().expect("lock");
            entries.insert(
                "expired".to_string(),
                record("expired", Some(at(1_700_000_000))),
            );
        }
        fresh.persist().await.expect("persist");

        // Reload: the expired terminal is dropped, the fresh one survives.
        let reloaded = TransferStore::load(path, 512, retention())
            .await
            .expect("reload");
        assert!(
            reloaded.get("fresh").is_some(),
            "a within-retention terminal survives reload"
        );
        assert!(
            reloaded.get("expired").is_none(),
            "an expired terminal is dropped on load"
        );
    }
}
