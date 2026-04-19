//! Background-refresh cache system
//!
//! Replaces the old `get_or_fetch` coalescing cache with a simpler model:
//! - **One writer per data type** (background refresh task on an interval)
//! - **Many readers** (HTTP handlers + WebSocket tasks)
//! - **No coalescing needed** — exactly one writer, so no concurrent fetch dedup
//! - **No request ever blocks on a chain query** — reads are always from cache
//!
//! Uses `arc-swap` for lock-free reads with zero reader contention.

use arc_swap::ArcSwap;
use std::sync::Arc;
use std::time::Instant;

use crate::error::AppError;

use crate::config_store::gated_types::{
    CurrencyDisplayConfig, GatedNetworkConfig, LeaseRulesConfig, SwapSettingsConfig,
    UiSettingsConfig,
};
use crate::external::chain::{AnnualInflationResponse, StakingPoolResponse};
use crate::handlers::config::AppConfigResponse;
use crate::handlers::currencies::{CurrenciesResponse, PricesResponse};
use crate::handlers::earn::EarnPool;
use crate::handlers::etl_proxy::{LoansStatsBatch, StatsOverviewBatch};
use crate::handlers::fees::GasFeeConfigResponse;
use crate::handlers::gated_assets::AssetsResponse;
use crate::handlers::gated_networks::NetworksResponse;
use crate::handlers::leases::LeaseConfigResponse;
use crate::handlers::staking::Validator;
use crate::propagation::user_data_filter::UserDataFilterContext;
use std::collections::HashMap;

// Re-export for use in handlers
pub use crate::handlers::gated_protocols::ProtocolsResponse as GatedProtocolsResponse;

/// Inner state of a cached value
struct CachedInner<T> {
    value: Option<T>,
    updated_at: Option<Instant>,
}

/// Lock-free cached value. One writer (background task), many readers (handlers).
///
/// Uses `arc-swap` (atomic pointer swap) for zero reader contention.
/// Writers call `store()`, readers call `load()` — both are non-blocking.
pub struct Cached<T> {
    inner: ArcSwap<CachedInner<T>>,
}

impl<T: Clone> Cached<T> {
    /// Create a new empty cached value
    pub fn new() -> Self {
        Self {
            inner: ArcSwap::from_pointee(CachedInner {
                value: None,
                updated_at: None,
            }),
        }
    }

    /// Non-blocking read. Returns None if cache is empty (cold start).
    pub fn load(&self) -> Option<T> {
        let guard = self.inner.load();
        guard.value.clone()
    }

    /// Non-blocking write. Atomically swaps the cached value.
    pub fn store(&self, value: T) {
        self.inner.store(Arc::new(CachedInner {
            value: Some(value),
            updated_at: Some(Instant::now()),
        }));
    }

    /// Age of the cached value in seconds. None if cache is empty.
    pub fn age_secs(&self) -> Option<u64> {
        let guard = self.inner.load();
        guard.updated_at.map(|t| t.elapsed().as_secs())
    }

    /// Check if cache has a value
    pub fn is_populated(&self) -> bool {
        self.inner.load().value.is_some()
    }

    /// Load value or return 503 ServiceUnavailable.
    /// Use in handlers that require cached data to be populated.
    pub fn load_or_unavailable(&self, name: &str) -> Result<T, AppError> {
        self.load().ok_or_else(|| AppError::ServiceUnavailable {
            message: format!("{} not yet available", name),
        })
    }
}

impl<T: Clone> Default for Cached<T> {
    fn default() -> Self {
        Self::new()
    }
}

/// Bundle of all 5 gated config files, loaded together from disk.
/// Refreshed as a unit to ensure consistency.
#[derive(Debug, Clone)]
pub struct GatedConfigBundle {
    pub currency_display: CurrencyDisplayConfig,
    pub network_config: GatedNetworkConfig,
    pub lease_rules: LeaseRulesConfig,
    pub swap_settings: SwapSettingsConfig,
    pub ui_settings: UiSettingsConfig,
}

/// Protocol contracts info cached from admin contract queries.
/// Keyed by protocol name (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE").
pub type ProtocolContractsMap = HashMap<String, crate::external::chain::ProtocolContractsInfo>;

/// All cached application data.
///
/// Each field is a `Cached<T>` populated by a dedicated background refresh task.
/// Handlers read from these — they never trigger fetches.
pub struct AppDataCache {
    // ── Core config ──────────────────────────────────────────────
    /// Full app config (protocols + networks + native asset + contracts)
    pub app_config: Cached<AppConfigResponse>,

    /// Protocol contracts from admin contract (oracle, lpp, leaser, profit addresses)
    pub protocol_contracts: Cached<ProtocolContractsMap>,

    /// All currencies with display info
    pub currencies: Cached<CurrenciesResponse>,

    /// All prices aggregated across protocols
    pub prices: Cached<PricesResponse>,

    // ── Gated config (disk-loaded) ───────────────────────────────
    /// Bundle of all 5 gated JSON config files
    pub gated_config: Cached<GatedConfigBundle>,

    /// Filter context built from gated config + ETL protocols
    pub filter_context: Cached<UserDataFilterContext>,

    // ── Domain data ──────────────────────────────────────────────
    /// Earn pools (ETL + chain LPP data)
    pub pools: Cached<Vec<EarnPool>>,

    /// Bonded validators
    pub validators: Cached<Vec<Validator>>,

    /// Annual inflation (from Nolus mint module, changes per governance proposal)
    pub annual_inflation: Cached<AnnualInflationResponse>,

    /// Staking pool (bonded/not-bonded tokens)
    pub staking_pool: Cached<StakingPoolResponse>,

    /// Gated assets (deduplicated, enriched view)
    pub gated_assets: Cached<AssetsResponse>,

    /// Gated protocols (filtered, enriched view)
    pub gated_protocols: Cached<GatedProtocolsResponse>,

    /// Gated networks (configured networks with pool info)
    pub gated_networks: Cached<NetworksResponse>,

    // ── Stats (ETL batches) ──────────────────────────────────────
    /// Stats overview (TVL, volume, buyback, PnL, revenue)
    pub stats_overview: Cached<StatsOverviewBatch>,

    /// Loans stats (open position value, open interest)
    pub loans_stats: Cached<LoansStatsBatch>,

    // ── Swap ─────────────────────────────────────────────────────
    /// Swap config (gated swap settings + ETL currencies resolved to denoms)
    pub swap_config: Cached<serde_json::Value>,

    // ── Lease configs ────────────────────────────────────────────
    /// Lease configs per protocol (downpayment ranges + leaser on-chain config)
    pub lease_configs: Cached<HashMap<String, LeaseConfigResponse>>,

    // ── Fees ─────────────────────────────────────────────────────
    /// Gas fee config (accepted denoms with min prices + gas multiplier)
    pub gas_fee_config: Cached<GasFeeConfigResponse>,
}

impl AppDataCache {
    /// Create a new empty data cache. All fields start as None.
    /// Background refresh tasks will populate them.
    pub fn new() -> Self {
        Self {
            app_config: Cached::new(),
            protocol_contracts: Cached::new(),
            currencies: Cached::new(),
            prices: Cached::new(),
            gated_config: Cached::new(),
            filter_context: Cached::new(),
            pools: Cached::new(),
            validators: Cached::new(),
            annual_inflation: Cached::new(),
            staking_pool: Cached::new(),
            gated_assets: Cached::new(),
            gated_protocols: Cached::new(),
            gated_networks: Cached::new(),
            stats_overview: Cached::new(),
            loans_stats: Cached::new(),
            swap_config: Cached::new(),
            lease_configs: Cached::new(),
            gas_fee_config: Cached::new(),
        }
    }

    /// Summary of cache population status for health checks
    pub fn status_summary(&self) -> CacheStatusSummary {
        CacheStatusSummary {
            app_config: self.field_status("app_config", &self.app_config),
            protocol_contracts: self.field_status("protocol_contracts", &self.protocol_contracts),
            currencies: self.field_status("currencies", &self.currencies),
            prices: self.field_status("prices", &self.prices),
            gated_config: self.field_status("gated_config", &self.gated_config),
            filter_context: self.field_status("filter_context", &self.filter_context),
            pools: self.field_status("pools", &self.pools),
            validators: self.field_status("validators", &self.validators),
            annual_inflation: self.field_status("annual_inflation", &self.annual_inflation),
            staking_pool: self.field_status("staking_pool", &self.staking_pool),
            gated_assets: self.field_status("gated_assets", &self.gated_assets),
            gated_protocols: self.field_status("gated_protocols", &self.gated_protocols),
            gated_networks: self.field_status("gated_networks", &self.gated_networks),
            stats_overview: self.field_status("stats_overview", &self.stats_overview),
            loans_stats: self.field_status("loans_stats", &self.loans_stats),
            swap_config: self.field_status("swap_config", &self.swap_config),
            lease_configs: self.field_status("lease_configs", &self.lease_configs),
            gas_fee_config: self.field_status("gas_fee_config", &self.gas_fee_config),
        }
    }

    fn field_status<T: Clone>(&self, name: &str, cached: &Cached<T>) -> CacheFieldStatus {
        CacheFieldStatus {
            name: name.to_string(),
            populated: cached.is_populated(),
            age_secs: cached.age_secs(),
        }
    }
}

impl Default for AppDataCache {
    fn default() -> Self {
        Self::new()
    }
}

/// Status of a single cache field
#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheFieldStatus {
    pub name: String,
    pub populated: bool,
    pub age_secs: Option<u64>,
}

/// Summary of all cache fields for health/admin endpoints
#[derive(Debug, Clone, serde::Serialize)]
pub struct CacheStatusSummary {
    pub app_config: CacheFieldStatus,
    pub protocol_contracts: CacheFieldStatus,
    pub currencies: CacheFieldStatus,
    pub prices: CacheFieldStatus,
    pub gated_config: CacheFieldStatus,
    pub filter_context: CacheFieldStatus,
    pub pools: CacheFieldStatus,
    pub validators: CacheFieldStatus,
    pub annual_inflation: CacheFieldStatus,
    pub staking_pool: CacheFieldStatus,
    pub gated_assets: CacheFieldStatus,
    pub gated_protocols: CacheFieldStatus,
    pub gated_networks: CacheFieldStatus,
    pub stats_overview: CacheFieldStatus,
    pub loans_stats: CacheFieldStatus,
    pub swap_config: CacheFieldStatus,
    pub lease_configs: CacheFieldStatus,
    pub gas_fee_config: CacheFieldStatus,
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::sync::atomic::{AtomicBool, Ordering};
    use std::time::Duration;

    #[derive(Clone, Debug, PartialEq)]
    struct TestVal {
        n: u32,
        tag: String,
    }

    impl TestVal {
        fn new(n: u32, tag: &str) -> Self {
            Self {
                n,
                tag: tag.to_string(),
            }
        }
    }

    // ========================================================================
    // Cached<T> tests
    // ========================================================================

    #[tokio::test]
    async fn cached_load_returns_none_on_cold_cache() {
        let cache: Cached<TestVal> = Cached::new();
        assert!(cache.load().is_none());
        assert!(!cache.is_populated());
        assert!(cache.age_secs().is_none());
    }

    #[tokio::test]
    async fn cached_store_then_load_returns_value() {
        let cache: Cached<TestVal> = Cached::new();
        let val = TestVal::new(1, "a");
        cache.store(val.clone());
        assert_eq!(cache.load(), Some(val));
    }

    #[tokio::test]
    async fn cached_store_overwrites_previous_value() {
        let cache: Cached<TestVal> = Cached::new();
        let a = TestVal::new(1, "first");
        let b = TestVal::new(2, "second");
        cache.store(a);
        cache.store(b.clone());
        assert_eq!(cache.load(), Some(b));
    }

    #[tokio::test]
    async fn cached_is_populated_after_store() {
        let cache: Cached<TestVal> = Cached::new();
        cache.store(TestVal::new(7, "x"));
        assert!(cache.is_populated());
    }

    #[tokio::test]
    async fn cached_age_secs_returns_elapsed() {
        let cache: Cached<TestVal> = Cached::new();
        cache.store(TestVal::new(42, "aged"));
        tokio::time::sleep(Duration::from_millis(1_100)).await;
        let age = cache.age_secs().expect("age_secs must be Some after store");
        assert!(age >= 1, "expected age >= 1, got {}", age);
    }

    #[tokio::test]
    async fn cached_age_secs_none_when_empty() {
        let cache: Cached<TestVal> = Cached::new();
        assert!(cache.age_secs().is_none());
    }

    #[tokio::test]
    async fn cached_load_or_unavailable_ok_when_populated() {
        let cache: Cached<TestVal> = Cached::new();
        let val = TestVal::new(9, "ok");
        cache.store(val.clone());
        let got = cache.load_or_unavailable("MyCache").expect("must be Ok");
        assert_eq!(got, val);
    }

    #[tokio::test]
    async fn cached_load_or_unavailable_err_when_empty() {
        let cache: Cached<TestVal> = Cached::new();
        let err = cache
            .load_or_unavailable("MyCache")
            .expect_err("must be Err on empty");
        match err {
            AppError::ServiceUnavailable { message } => {
                assert!(
                    message.contains("MyCache"),
                    "message should contain the supplied name, got: {}",
                    message
                );
            }
            other => panic!("expected ServiceUnavailable, got {:?}", other),
        }
    }

    #[tokio::test]
    async fn cached_concurrent_readers_and_one_writer() {
        let cache: Arc<Cached<TestVal>> = Arc::new(Cached::new());
        // Seed initial value so readers don't have to handle None.
        cache.store(TestVal::new(0, "seed"));

        let saw_panic = Arc::new(AtomicBool::new(false));
        let mut handles: Vec<tokio::task::JoinHandle<()>> = Vec::new();

        for _ in 0..8 {
            let cache = cache.clone();
            let saw_panic = saw_panic.clone();
            handles.push(tokio::spawn(async move {
                for _ in 0..100 {
                    // Touch both getters to exercise arc-swap under contention.
                    let _ = cache.load();
                    let _ = cache.is_populated();
                    if std::thread::panicking() {
                        saw_panic.store(true, Ordering::SeqCst);
                    }
                    tokio::task::yield_now().await;
                }
            }));
        }

        let writer_cache = cache.clone();
        let writer = tokio::spawn(async move {
            for i in 1..=50 {
                writer_cache.store(TestVal::new(i, "w"));
                tokio::task::yield_now().await;
            }
        });

        writer.await.expect("writer panicked");
        for handle in handles {
            handle.await.expect("reader panicked");
        }

        assert!(!saw_panic.load(Ordering::SeqCst));
        let final_val = cache.load().expect("cache must be populated");
        assert_eq!(final_val, TestVal::new(50, "w"));
    }

    #[tokio::test]
    async fn cached_default_trait_matches_new() {
        let cache: Cached<TestVal> = Cached::default();
        assert!(!cache.is_populated());
        assert!(cache.load().is_none());
        assert!(cache.age_secs().is_none());
    }

    // ========================================================================
    // AppDataCache tests
    // ========================================================================

    #[tokio::test]
    async fn app_data_cache_new_all_empty() {
        let cache = AppDataCache::new();
        assert!(!cache.app_config.is_populated());
        assert!(!cache.protocol_contracts.is_populated());
        assert!(!cache.currencies.is_populated());
        assert!(!cache.prices.is_populated());
        assert!(!cache.gated_config.is_populated());
        assert!(!cache.filter_context.is_populated());
        assert!(!cache.pools.is_populated());
        assert!(!cache.validators.is_populated());
        assert!(!cache.annual_inflation.is_populated());
        assert!(!cache.staking_pool.is_populated());
        assert!(!cache.gated_assets.is_populated());
        assert!(!cache.gated_protocols.is_populated());
        assert!(!cache.gated_networks.is_populated());
        assert!(!cache.stats_overview.is_populated());
        assert!(!cache.loans_stats.is_populated());
        assert!(!cache.swap_config.is_populated());
        assert!(!cache.lease_configs.is_populated());
        assert!(!cache.gas_fee_config.is_populated());
    }

    #[tokio::test]
    async fn app_data_cache_default_equivalent_to_new() {
        let cache = AppDataCache::default();
        let summary = cache.status_summary();
        // Default must produce the exact same "all empty" shape as ::new()
        assert!(!summary.app_config.populated);
        assert!(!summary.prices.populated);
        assert!(!summary.gas_fee_config.populated);
    }

    #[tokio::test]
    async fn status_summary_reports_all_fields_empty_initially() {
        let cache = AppDataCache::new();
        let summary = cache.status_summary();

        let rows = [
            ("app_config", &summary.app_config),
            ("protocol_contracts", &summary.protocol_contracts),
            ("currencies", &summary.currencies),
            ("prices", &summary.prices),
            ("gated_config", &summary.gated_config),
            ("filter_context", &summary.filter_context),
            ("pools", &summary.pools),
            ("validators", &summary.validators),
            ("annual_inflation", &summary.annual_inflation),
            ("staking_pool", &summary.staking_pool),
            ("gated_assets", &summary.gated_assets),
            ("gated_protocols", &summary.gated_protocols),
            ("gated_networks", &summary.gated_networks),
            ("stats_overview", &summary.stats_overview),
            ("loans_stats", &summary.loans_stats),
            ("swap_config", &summary.swap_config),
            ("lease_configs", &summary.lease_configs),
            ("gas_fee_config", &summary.gas_fee_config),
        ];

        for (expected_name, status) in rows {
            assert_eq!(status.name, expected_name, "field name mismatch");
            assert!(
                !status.populated,
                "expected {} to be unpopulated",
                expected_name
            );
            assert!(
                status.age_secs.is_none(),
                "expected {} age_secs to be None",
                expected_name
            );
        }
    }

    #[tokio::test]
    async fn status_summary_reports_populated_fields_after_store() {
        let cache = AppDataCache::new();

        // Populate app_config with a minimal valid response.
        cache
            .app_config
            .store(crate::handlers::config::AppConfigResponse {
                protocols: std::collections::HashMap::new(),
                networks: Vec::new(),
                native_asset: crate::handlers::config::NativeAssetInfo {
                    ticker: "NLS".into(),
                    symbol: "NLS".into(),
                    denom: "unls".into(),
                    decimal_digits: 6,
                },
                contracts: crate::handlers::config::ContractsInfo {
                    admin: "nolus1admin".into(),
                    dispatcher: "nolus1disp".into(),
                },
            });

        // Populate prices.
        cache
            .prices
            .store(crate::handlers::currencies::PricesResponse {
                prices: std::collections::HashMap::new(),
                updated_at: "2026-01-01T00:00:00Z".into(),
            });

        let summary = cache.status_summary();
        assert!(summary.app_config.populated);
        assert!(summary.prices.populated);
        assert!(!summary.currencies.populated);
        assert!(!summary.gas_fee_config.populated);
        assert_eq!(summary.app_config.name, "app_config");
        assert_eq!(summary.prices.name, "prices");
    }

    #[tokio::test]
    async fn status_summary_serializes_to_json() {
        let cache = AppDataCache::new();
        let summary = cache.status_summary();
        let json = serde_json::to_string(&summary).expect("Serialize must succeed");
        // Spot check that the shape is there.
        assert!(json.contains("\"app_config\""));
        assert!(json.contains("\"populated\""));
        assert!(json.contains("\"age_secs\""));
    }
}
