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
    pub gated_assets: CacheFieldStatus,
    pub gated_protocols: CacheFieldStatus,
    pub gated_networks: CacheFieldStatus,
    pub stats_overview: CacheFieldStatus,
    pub loans_stats: CacheFieldStatus,
    pub swap_config: CacheFieldStatus,
    pub lease_configs: CacheFieldStatus,
    pub gas_fee_config: CacheFieldStatus,
}
