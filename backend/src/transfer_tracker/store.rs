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

use crate::error::AppError;

use super::TrackedTransfer;

/// Monotonic suffix source for temp-file uniqueness within a persist directory.
static TEMP_COUNTER: AtomicU64 = AtomicU64::new(0);

/// The durable, capped, self-pruning tracking set.
///
/// The canonical map is guarded by a single [`Mutex`]. The guard is never held
/// across an `.await`: async methods snapshot or mutate under the lock, drop
/// it, then do file I/O.
pub struct TransferStore {
    path: PathBuf,
    capacity: usize,
    retention: Duration,
    entries: Mutex<HashMap<String, TrackedTransfer>>,
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
        Ok(Self {
            path,
            capacity,
            retention,
            entries: Mutex::new(entries),
        })
    }

    /// Persist the whole map: unique temp file -> `sync_all` -> atomic rename
    /// -> parent-dir fsync.
    pub async fn persist(&self) -> Result<(), AppError> {
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

        if let Some(dir) = dir {
            if let Ok(handle) = tokio::fs::File::open(dir).await {
                let _ = handle.sync_all().await;
            }
        }
        Ok(())
    }

    /// Insert a new tracked route. Rejects with `Err` once the active set is at
    /// capacity.
    pub async fn insert(&self, record: TrackedTransfer) -> Result<(), AppError> {
        {
            let mut entries = self.lock();
            if entries.len() >= self.capacity {
                return Err(AppError::RateLimited { retry_after: None });
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
    pub fn prune(&self, now: DateTime<Utc>) {
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
        let path = std::env::temp_dir().join(format!(
            "transfers-test-{}-{}.json",
            std::process::id(),
            TEMP_COUNTER.fetch_add(1, Ordering::Relaxed)
        ));
        Self::create(path, super::DEFAULT_ACTIVE_SET_CAP, Duration::hours(1))
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
}
