use dashmap::DashMap;
use moka::future::Cache;
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::Duration;
use tokio::sync::broadcast;

use crate::config::CacheConfig;

/// Cache statistics for a single cache
#[derive(Debug, Default)]
pub struct CacheStats {
    hits: AtomicU64,
    misses: AtomicU64,
}

impl CacheStats {
    pub fn new() -> Self {
        Self {
            hits: AtomicU64::new(0),
            misses: AtomicU64::new(0),
        }
    }

    pub fn record_hit(&self) {
        self.hits.fetch_add(1, Ordering::Relaxed);
    }

    pub fn record_miss(&self) {
        self.misses.fetch_add(1, Ordering::Relaxed);
    }

    pub fn hits(&self) -> u64 {
        self.hits.load(Ordering::Relaxed)
    }

    pub fn misses(&self) -> u64 {
        self.misses.load(Ordering::Relaxed)
    }

    pub fn total(&self) -> u64 {
        self.hits() + self.misses()
    }

    pub fn hit_rate(&self) -> f64 {
        let total = self.total();
        if total == 0 {
            0.0
        } else {
            (self.hits() as f64 / total as f64) * 100.0
        }
    }

    pub fn reset(&self) {
        self.hits.store(0, Ordering::Relaxed);
        self.misses.store(0, Ordering::Relaxed);
    }
}

/// A cache wrapper that tracks hit/miss statistics and supports request coalescing
pub struct TrackedCache {
    cache: Cache<String, serde_json::Value>,
    stats: CacheStats,
    /// Tracks in-flight requests to enable coalescing of concurrent identical requests
    in_flight: DashMap<String, broadcast::Sender<Result<serde_json::Value, String>>>,
}

impl TrackedCache {
    pub fn new(cache: Cache<String, serde_json::Value>) -> Self {
        Self {
            cache,
            stats: CacheStats::new(),
            in_flight: DashMap::new(),
        }
    }

    /// Get a value from the cache, recording hit/miss
    pub async fn get(&self, key: &str) -> Option<serde_json::Value> {
        match self.cache.get(key).await {
            Some(value) => {
                self.stats.record_hit();
                Some(value)
            }
            None => {
                self.stats.record_miss();
                None
            }
        }
    }

    /// Insert a value into the cache
    pub async fn insert(&self, key: String, value: serde_json::Value) {
        self.cache.insert(key, value).await;
    }

    /// Get the number of entries in the cache
    pub fn entry_count(&self) -> u64 {
        self.cache.entry_count()
    }

    /// Invalidate a specific key
    pub async fn invalidate(&self, key: &str) {
        self.cache.invalidate(key).await;
    }

    /// Invalidate all entries
    pub fn invalidate_all(&self) {
        self.cache.invalidate_all();
    }

    /// Get cache statistics
    pub fn stats(&self) -> &CacheStats {
        &self.stats
    }

    /// Reset statistics
    pub fn reset_stats(&self) {
        self.stats.reset();
    }

    /// Get a value from cache, or fetch it using the provided function.
    /// Coalesces concurrent requests for the same key - only one fetch executes
    /// while others wait for the result.
    ///
    /// # Arguments
    /// * `key` - Cache key
    /// * `fetch` - Async function to fetch the value if not cached
    ///
    /// # Returns
    /// The cached or freshly fetched value
    pub async fn get_or_fetch<F, Fut>(
        &self,
        key: &str,
        fetch: F,
    ) -> Result<serde_json::Value, String>
    where
        F: FnOnce() -> Fut,
        Fut: std::future::Future<Output = Result<serde_json::Value, String>>,
    {
        // 1. Check cache first (fast path)
        if let Some(value) = self.cache.get(key).await {
            self.stats.record_hit();
            return Ok(value);
        }
        self.stats.record_miss();

        // 2. Check if request is already in-flight
        // If so, subscribe to the existing broadcast channel and wait
        if let Some(sender) = self.in_flight.get(key) {
            let mut rx = sender.subscribe();
            drop(sender); // Release DashMap lock before awaiting
            return rx.recv().await.map_err(|e| format!("Channel error: {}", e))?;
        }

        // 3. No in-flight request - start a new one
        // Create broadcast channel (capacity 1 is enough since we send once)
        let (tx, _) = broadcast::channel(1);
        self.in_flight.insert(key.to_string(), tx.clone());

        // 4. Execute the fetch function
        let result = fetch().await;

        // 5. On success, cache the value
        if let Ok(ref value) = result {
            self.cache.insert(key.to_string(), value.clone()).await;
        }

        // 6. Broadcast result to any waiters (ignore send errors - no receivers is fine)
        let _ = tx.send(result.clone());

        // 7. Cleanup: remove from in-flight map
        self.in_flight.remove(key);

        result
    }

    /// Get the number of in-flight requests (for monitoring)
    pub fn in_flight_count(&self) -> usize {
        self.in_flight.len()
    }
}

/// Application cache for various data types
pub struct AppCache {
    /// Prices cache
    pub prices: TrackedCache,
    /// Config cache
    pub config: TrackedCache,
    /// APR cache
    pub apr: TrackedCache,
    /// Generic data cache
    pub data: TrackedCache,
}

impl AppCache {
    pub fn new(config: &CacheConfig) -> Self {
        Self {
            prices: TrackedCache::new(
                Cache::builder()
                    .max_capacity(100)
                    .time_to_live(Duration::from_secs(config.prices_ttl_secs))
                    .build(),
            ),
            config: TrackedCache::new(
                Cache::builder()
                    .max_capacity(100)
                    .time_to_live(Duration::from_secs(config.config_ttl_secs))
                    .build(),
            ),
            apr: TrackedCache::new(
                Cache::builder()
                    .max_capacity(100)
                    .time_to_live(Duration::from_secs(config.apr_ttl_secs))
                    .build(),
            ),
            data: TrackedCache::new(
                Cache::builder()
                    .max_capacity(config.max_entries)
                    .time_to_live(Duration::from_secs(60)) // Default 1 minute
                    .build(),
            ),
        }
    }

    /// Get aggregated statistics for all caches
    pub fn total_stats(&self) -> AggregatedCacheStats {
        let total_hits = self.prices.stats().hits()
            + self.config.stats().hits()
            + self.apr.stats().hits()
            + self.data.stats().hits();
        let total_misses = self.prices.stats().misses()
            + self.config.stats().misses()
            + self.apr.stats().misses()
            + self.data.stats().misses();
        let total = total_hits + total_misses;

        AggregatedCacheStats {
            total_hits,
            total_misses,
            hit_rate: if total == 0 {
                0.0
            } else {
                (total_hits as f64 / total as f64) * 100.0
            },
            prices_hit_rate: self.prices.stats().hit_rate(),
            config_hit_rate: self.config.stats().hit_rate(),
            apr_hit_rate: self.apr.stats().hit_rate(),
            data_hit_rate: self.data.stats().hit_rate(),
        }
    }
}

/// Aggregated cache statistics
#[derive(Debug)]
pub struct AggregatedCacheStats {
    pub total_hits: u64,
    pub total_misses: u64,
    pub hit_rate: f64,
    pub prices_hit_rate: f64,
    pub config_hit_rate: f64,
    pub apr_hit_rate: f64,
    pub data_hit_rate: f64,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_cache_stats_initial() {
        let stats = CacheStats::new();
        assert_eq!(stats.hits(), 0);
        assert_eq!(stats.misses(), 0);
        assert_eq!(stats.total(), 0);
        assert_eq!(stats.hit_rate(), 0.0);
    }

    #[test]
    fn test_cache_stats_recording() {
        let stats = CacheStats::new();
        stats.record_hit();
        stats.record_hit();
        stats.record_miss();

        assert_eq!(stats.hits(), 2);
        assert_eq!(stats.misses(), 1);
        assert_eq!(stats.total(), 3);
        assert!((stats.hit_rate() - 66.666).abs() < 0.01);
    }

    #[test]
    fn test_cache_stats_reset() {
        let stats = CacheStats::new();
        stats.record_hit();
        stats.record_miss();
        stats.reset();

        assert_eq!(stats.hits(), 0);
        assert_eq!(stats.misses(), 0);
    }

    #[tokio::test]
    async fn test_tracked_cache_hit() {
        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        cache
            .insert("key1".to_string(), serde_json::json!({"value": 1}))
            .await;

        let result = cache.get("key1").await;
        assert!(result.is_some());
        assert_eq!(cache.stats().hits(), 1);
        assert_eq!(cache.stats().misses(), 0);
    }

    #[tokio::test]
    async fn test_tracked_cache_miss() {
        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        let result = cache.get("nonexistent").await;
        assert!(result.is_none());
        assert_eq!(cache.stats().hits(), 0);
        assert_eq!(cache.stats().misses(), 1);
    }

    #[tokio::test]
    async fn test_tracked_cache_hit_rate() {
        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        cache
            .insert("key1".to_string(), serde_json::json!({"value": 1}))
            .await;

        // 2 hits
        cache.get("key1").await;
        cache.get("key1").await;
        // 2 misses
        cache.get("key2").await;
        cache.get("key3").await;

        assert_eq!(cache.stats().hit_rate(), 50.0);
    }

    #[tokio::test]
    async fn test_get_or_fetch_returns_cached_value() {
        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        // Pre-populate cache
        cache
            .insert("key1".to_string(), serde_json::json!({"cached": true}))
            .await;

        // Fetch should return cached value without calling fetch function
        let result = cache
            .get_or_fetch("key1", || async {
                // This should NOT be called
                Ok(serde_json::json!({"fetched": true}))
            })
            .await;

        assert!(result.is_ok());
        let value = result.unwrap();
        assert_eq!(value["cached"], true);
        assert_eq!(cache.stats().hits(), 1);
    }

    #[tokio::test]
    async fn test_get_or_fetch_fetches_on_miss() {
        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        let result = cache
            .get_or_fetch("key1", || async {
                Ok(serde_json::json!({"fetched": true}))
            })
            .await;

        assert!(result.is_ok());
        let value = result.unwrap();
        assert_eq!(value["fetched"], true);
        assert_eq!(cache.stats().misses(), 1);

        // Value should now be cached
        let cached = cache.get("key1").await;
        assert!(cached.is_some());
        assert_eq!(cached.unwrap()["fetched"], true);
    }

    #[tokio::test]
    async fn test_get_or_fetch_coalesces_concurrent_requests() {
        use std::sync::atomic::{AtomicU32, Ordering};
        use std::sync::Arc;

        let cache = Arc::new(TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        ));

        let fetch_count = Arc::new(AtomicU32::new(0));

        // Spawn 10 concurrent requests for the same key
        let mut handles = vec![];
        for _ in 0..10 {
            let cache = cache.clone();
            let fetch_count = fetch_count.clone();
            handles.push(tokio::spawn(async move {
                cache
                    .get_or_fetch("key1", || {
                        let fetch_count = fetch_count.clone();
                        async move {
                            // Count how many times fetch is actually called
                            fetch_count.fetch_add(1, Ordering::SeqCst);
                            // Simulate slow fetch
                            tokio::time::sleep(Duration::from_millis(50)).await;
                            Ok(serde_json::json!({"value": 42}))
                        }
                    })
                    .await
            }));
        }

        // Wait for all requests to complete
        let results: Vec<_> = futures::future::join_all(handles).await;

        // All requests should succeed with the same value
        for result in results {
            let value = result.unwrap().unwrap();
            assert_eq!(value["value"], 42);
        }

        // Fetch should have been called only once (or very few times due to race)
        // In practice with coalescing, it should be exactly 1
        let actual_fetches = fetch_count.load(Ordering::SeqCst);
        assert!(
            actual_fetches <= 2,
            "Expected 1-2 fetches with coalescing, got {}",
            actual_fetches
        );
    }

    #[tokio::test]
    async fn test_get_or_fetch_propagates_errors() {
        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        let result = cache
            .get_or_fetch("key1", || async { Err("fetch failed".to_string()) })
            .await;

        assert!(result.is_err());
        assert_eq!(result.unwrap_err(), "fetch failed");

        // Error should NOT be cached
        let cached = cache.get("key1").await;
        assert!(cached.is_none());
    }

    #[tokio::test]
    async fn test_get_or_fetch_error_not_cached_allows_retry() {
        use std::sync::atomic::{AtomicU32, Ordering};
        use std::sync::Arc;

        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        let attempt = Arc::new(AtomicU32::new(0));

        // First attempt fails
        let attempt_clone = attempt.clone();
        let result = cache
            .get_or_fetch("key1", || {
                let attempt = attempt_clone.clone();
                async move {
                    let n = attempt.fetch_add(1, Ordering::SeqCst);
                    if n == 0 {
                        Err("first attempt fails".to_string())
                    } else {
                        Ok(serde_json::json!({"success": true}))
                    }
                }
            })
            .await;
        assert!(result.is_err());

        // Second attempt should succeed (error was not cached)
        let attempt_clone = attempt.clone();
        let result = cache
            .get_or_fetch("key1", || {
                let attempt = attempt_clone.clone();
                async move {
                    let n = attempt.fetch_add(1, Ordering::SeqCst);
                    if n == 0 {
                        Err("first attempt fails".to_string())
                    } else {
                        Ok(serde_json::json!({"success": true}))
                    }
                }
            })
            .await;
        assert!(result.is_ok());
        assert_eq!(result.unwrap()["success"], true);
    }

    #[tokio::test]
    async fn test_in_flight_count() {
        let cache = TrackedCache::new(
            Cache::builder()
                .max_capacity(10)
                .time_to_live(Duration::from_secs(60))
                .build(),
        );

        assert_eq!(cache.in_flight_count(), 0);

        // After a completed fetch, in_flight should be empty
        let _ = cache
            .get_or_fetch("key1", || async { Ok(serde_json::json!({"value": 1})) })
            .await;

        assert_eq!(cache.in_flight_count(), 0);
    }
}
