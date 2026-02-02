//! Configuration storage implementation
//!
//! Provides file-based JSON storage with caching and atomic writes.

use crate::error::AppError;
use chrono::{DateTime, Utc};
use serde::{de::DeserializeOwned, Deserialize, Serialize};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::fs;
use tokio::sync::RwLock;
use tracing::{debug, error, info, warn};

use super::types::*;

/// Audit log entry for configuration changes
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogEntry {
    pub id: String,
    pub timestamp: DateTime<Utc>,
    pub action: String,
    pub resource: String,
    pub details: Option<String>,
}

/// Query parameters for audit log
#[derive(Debug, Clone, Default)]
pub struct AuditLogQuery {
    pub action: Option<String>,
    pub resource: Option<String>,
    pub from: Option<DateTime<Utc>>,
    pub to: Option<DateTime<Utc>>,
    pub offset: usize,
    pub limit: usize,
}

/// Response for audit log queries
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AuditLogResponse {
    pub entries: Vec<AuditLogEntry>,
    pub total: usize,
    pub offset: usize,
    pub limit: usize,
}

/// Configuration store that manages all webapp configuration
#[derive(Debug)]
pub struct ConfigStore {
    /// Base directory for config files
    config_dir: PathBuf,
    /// Cached full configuration
    cached_config: Arc<RwLock<Option<FullWebappConfig>>>,
    /// Cached locales (lang -> content)
    cached_locales: Arc<RwLock<std::collections::HashMap<String, serde_json::Value>>>,
    /// Audit log entries (in-memory, persisted to file)
    audit_log: Arc<RwLock<Vec<AuditLogEntry>>>,
}

impl ConfigStore {
    /// Create a new ConfigStore with the given config directory
    pub fn new<P: AsRef<Path>>(config_dir: P) -> Self {
        Self {
            config_dir: config_dir.as_ref().to_path_buf(),
            cached_config: Arc::new(RwLock::new(None)),
            cached_locales: Arc::new(RwLock::new(std::collections::HashMap::new())),
            audit_log: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Initialize the config store, creating directories if needed
    pub async fn init(&self) -> Result<(), AppError> {
        // Create config directories if they don't exist
        let dirs = [
            self.config_dir.clone(),
            self.config_dir.join("endpoints"),
            self.config_dir.join("lease"),
            self.config_dir.join("zero-interest"),
            self.config_dir.join("swap"),
            self.config_dir.join("governance"),
            self.config_dir.join("locales"),
        ];

        for dir in &dirs {
            if !dir.exists() {
                fs::create_dir_all(dir).await.map_err(|e| {
                    AppError::Internal(format!(
                        "Failed to create config directory {:?}: {}",
                        dir, e
                    ))
                })?;
                info!("Created config directory: {:?}", dir);
            }
        }

        // Try to load and cache the full config
        match self.load_full_config().await {
            Ok(config) => {
                let mut cache = self.cached_config.write().await;
                *cache = Some(config);
                info!("Loaded and cached webapp configuration");
            }
            Err(e) => {
                warn!(
                    "Could not load full config on init (will use defaults): {}",
                    e
                );
            }
        }

        // Load audit log
        if let Err(e) = self.load_audit_log().await {
            warn!("Could not load audit log (starting fresh): {}", e);
        }

        Ok(())
    }

    /// Get the full webapp configuration (cached)
    pub async fn get_full_config(&self) -> Result<FullWebappConfig, AppError> {
        // Check cache first
        {
            let cache = self.cached_config.read().await;
            if let Some(config) = cache.as_ref() {
                return Ok(config.clone());
            }
        }

        // Load from files
        let config = self.load_full_config().await?;

        // Update cache
        {
            let mut cache = self.cached_config.write().await;
            *cache = Some(config.clone());
        }

        Ok(config)
    }

    /// Invalidate the configuration cache
    pub async fn invalidate_cache(&self) {
        {
            let mut cache = self.cached_config.write().await;
            *cache = None;
        }
        {
            let mut locales = self.cached_locales.write().await;
            locales.clear();
        }
        info!("Configuration cache invalidated");
    }

    // =========================================================================
    // Audit Log
    // =========================================================================

    /// Record an audit log entry
    pub async fn record_audit(&self, action: &str, resource: &str, details: Option<String>) {
        let entry = AuditLogEntry {
            id: uuid::Uuid::new_v4().to_string(),
            timestamp: Utc::now(),
            action: action.to_string(),
            resource: resource.to_string(),
            details,
        };

        {
            let mut log = self.audit_log.write().await;
            log.push(entry.clone());

            // Keep only the last 1000 entries in memory
            let len = log.len();
            if len > 1000 {
                log.drain(0..len - 1000);
            }
        }

        // Persist to file asynchronously (best effort)
        let _ = self.persist_audit_log().await;

        info!("Audit: {} - {}", action, resource);
    }

    /// Query the audit log
    pub async fn query_audit_log(&self, query: AuditLogQuery) -> AuditLogResponse {
        let log = self.audit_log.read().await;

        let filtered: Vec<_> = log
            .iter()
            .filter(|entry| {
                // Filter by action
                if let Some(ref action) = query.action {
                    if !entry.action.contains(action) {
                        return false;
                    }
                }
                // Filter by resource
                if let Some(ref resource) = query.resource {
                    if !entry.resource.contains(resource) {
                        return false;
                    }
                }
                // Filter by date range
                if let Some(ref from) = query.from {
                    if entry.timestamp < *from {
                        return false;
                    }
                }
                if let Some(ref to) = query.to {
                    if entry.timestamp > *to {
                        return false;
                    }
                }
                true
            })
            .cloned()
            .collect();

        let total = filtered.len();
        let limit = if query.limit == 0 {
            50
        } else {
            query.limit.min(100)
        };
        let offset = query.offset.min(total);

        let entries: Vec<_> = filtered
            .into_iter()
            .rev() // Most recent first
            .skip(offset)
            .take(limit)
            .collect();

        AuditLogResponse {
            entries,
            total,
            offset,
            limit,
        }
    }

    /// Persist audit log to file
    async fn persist_audit_log(&self) -> Result<(), AppError> {
        let log = self.audit_log.read().await;
        let path = self.config_dir.join("audit-log.json");

        let content = serde_json::to_string_pretty(&*log)
            .map_err(|e| AppError::Internal(format!("Failed to serialize audit log: {}", e)))?;

        fs::write(&path, content).await.map_err(|e| {
            error!("Failed to persist audit log: {}", e);
            AppError::Internal(format!("Failed to persist audit log: {}", e))
        })?;

        Ok(())
    }

    /// Load audit log from file (called during init)
    async fn load_audit_log(&self) -> Result<(), AppError> {
        let path = self.config_dir.join("audit-log.json");

        if !path.exists() {
            return Ok(());
        }

        let content = fs::read_to_string(&path)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read audit log: {}", e)))?;

        let entries: Vec<AuditLogEntry> = serde_json::from_str(&content).map_err(|e| {
            warn!("Failed to parse audit log (starting fresh): {}", e);
            AppError::Internal(format!("Failed to parse audit log: {}", e))
        })?;

        let mut log = self.audit_log.write().await;
        *log = entries;

        Ok(())
    }

    /// Load the full configuration from files
    async fn load_full_config(&self) -> Result<FullWebappConfig, AppError> {
        debug!("Loading full webapp configuration from files");

        let currencies = self.load_currencies().await?;
        let chain_ids = self.load_chain_ids().await?;
        let networks = self.load_networks().await?;
        let endpoints = self.load_all_endpoints().await?;
        let lease = self.load_lease_config().await?;
        let zero_interest = self.load_zero_interest().await?;
        let skip_route = self.load_skip_route().await?;
        let governance = self.load_governance().await?;
        let history_currencies = self.load_history_currencies().await?;
        let history_protocols = self.load_history_protocols().await?;

        Ok(FullWebappConfig {
            currencies,
            chain_ids,
            networks,
            endpoints,
            lease,
            zero_interest,
            skip_route,
            governance,
            history_currencies,
            history_protocols,
        })
    }

    // =========================================================================
    // Individual Config Loaders
    // =========================================================================

    /// Load currencies configuration
    pub async fn load_currencies(&self) -> Result<CurrenciesConfig, AppError> {
        self.load_json_file("currencies.json").await
    }

    /// Load chain IDs configuration
    pub async fn load_chain_ids(&self) -> Result<ChainIdsConfig, AppError> {
        self.load_json_file("chain-ids.json").await
    }

    /// Load networks configuration
    pub async fn load_networks(&self) -> Result<NetworksConfig, AppError> {
        self.load_json_file("networks.json").await
    }

    /// Load all endpoint configurations dynamically from config/endpoints/*.json
    pub async fn load_all_endpoints(&self) -> Result<EndpointsCollection, AppError> {
        let endpoints_dir = self.config_dir.join("endpoints");
        let mut networks = std::collections::HashMap::new();

        // Read all .json files from the endpoints directory
        if endpoints_dir.exists() {
            let mut entries = fs::read_dir(&endpoints_dir).await.map_err(|e| {
                AppError::Internal(format!("Failed to read endpoints directory: {}", e))
            })?;

            while let Some(entry) = entries.next_entry().await.map_err(|e| {
                AppError::Internal(format!("Failed to read directory entry: {}", e))
            })? {
                let path = entry.path();
                if path.extension().and_then(|s| s.to_str()) == Some("json") {
                    if let Some(network_name) = path.file_stem().and_then(|s| s.to_str()) {
                        match self.load_endpoints(network_name).await {
                            Ok(config) => {
                                debug!("Loaded endpoints for network: {}", network_name);
                                networks.insert(network_name.to_string(), config);
                            }
                            Err(e) => {
                                warn!("Failed to load endpoints for {}: {}", network_name, e);
                            }
                        }
                    }
                }
            }
        }

        if networks.is_empty() {
            warn!("No endpoint configurations found in {:?}", endpoints_dir);
        }

        Ok(EndpointsCollection { networks })
    }

    /// Load endpoints for a specific network
    pub async fn load_endpoints(&self, network: &str) -> Result<NetworkEndpointsConfig, AppError> {
        let path = format!("endpoints/{}.json", network);
        self.load_json_file(&path).await
    }

    /// Load all lease configuration
    pub async fn load_lease_config(&self) -> Result<LeaseConfig, AppError> {
        let downpayment_ranges = self.load_downpayment_ranges().await?;
        let ignore_assets = self.load_ignore_assets().await?;
        let ignore_lease_long = self.load_ignore_lease_long().await?;
        let ignore_lease_short = self.load_ignore_lease_short().await?;
        let free_interest_assets = self.load_free_interest_assets().await?;
        let due_projection = self.load_due_projection().await?;

        Ok(LeaseConfig {
            downpayment_ranges,
            ignore_assets,
            ignore_lease_long,
            ignore_lease_short,
            free_interest_assets,
            due_projection,
        })
    }

    /// Load downpayment ranges configuration
    pub async fn load_downpayment_ranges(&self) -> Result<DownpaymentRangesConfig, AppError> {
        self.load_json_file("lease/downpayment-ranges.json").await
    }

    /// Load ignore assets list
    pub async fn load_ignore_assets(&self) -> Result<StringArrayConfig, AppError> {
        self.load_json_file("lease/ignore-assets.json").await
    }

    /// Load ignore lease long assets list
    pub async fn load_ignore_lease_long(&self) -> Result<StringArrayConfig, AppError> {
        self.load_json_file("lease/ignore-lease-long-assets.json")
            .await
    }

    /// Load ignore lease short assets list
    pub async fn load_ignore_lease_short(&self) -> Result<StringArrayConfig, AppError> {
        self.load_json_file("lease/ignore-lease-short-assets.json")
            .await
    }

    /// Load free interest assets list
    pub async fn load_free_interest_assets(&self) -> Result<StringArrayConfig, AppError> {
        self.load_json_file("lease/free-interest-assets.json").await
    }

    /// Load due projection configuration
    pub async fn load_due_projection(&self) -> Result<DueProjectionConfig, AppError> {
        self.load_json_file("lease/due-projection-secs.json").await
    }

    /// Load zero interest configuration
    pub async fn load_zero_interest(&self) -> Result<ZeroInterestConfig, AppError> {
        self.load_json_file("zero-interest/payment-addresses.json")
            .await
    }

    /// Load skip route configuration
    pub async fn load_skip_route(&self) -> Result<SkipRouteConfig, AppError> {
        self.load_json_file("swap/skip-route-config.json").await
    }

    /// Load governance configuration
    pub async fn load_governance(&self) -> Result<ProposalsConfig, AppError> {
        self.load_json_file("governance/hidden-proposals.json")
            .await
    }

    /// Load history currencies configuration
    pub async fn load_history_currencies(&self) -> Result<HistoryCurrenciesConfig, AppError> {
        self.load_json_file("history-currencies.json").await
    }

    /// Load history protocols configuration
    pub async fn load_history_protocols(&self) -> Result<HistoryProtocolsConfig, AppError> {
        self.load_json_file("history-protocols.json").await
    }

    /// Load a locale by language code
    pub async fn load_locale(&self, lang: &str) -> Result<serde_json::Value, AppError> {
        // Check cache first
        {
            let cache = self.cached_locales.read().await;
            if let Some(locale) = cache.get(lang) {
                return Ok(locale.clone());
            }
        }

        // Load from file
        let path = format!("locales/{}.json", lang);
        let locale: serde_json::Value = self.load_json_file(&path).await?;

        // Update cache
        {
            let mut cache = self.cached_locales.write().await;
            cache.insert(lang.to_string(), locale.clone());
        }

        Ok(locale)
    }

    /// List available locales
    pub async fn list_locales(&self) -> Result<LocalesListResponse, AppError> {
        let locales_dir = self.config_dir.join("locales");

        if !locales_dir.exists() {
            return Ok(LocalesListResponse::default());
        }

        let mut entries = fs::read_dir(&locales_dir)
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read locales directory: {}", e)))?;

        let mut available = Vec::new();

        while let Some(entry) = entries
            .next_entry()
            .await
            .map_err(|e| AppError::Internal(format!("Failed to read directory entry: {}", e)))?
        {
            let path = entry.path();
            if path.extension().is_some_and(|ext| ext == "json") {
                if let Some(stem) = path.file_stem() {
                    available.push(stem.to_string_lossy().to_string());
                }
            }
        }

        available.sort();

        Ok(LocalesListResponse {
            available,
            default: "en".to_string(),
        })
    }

    // =========================================================================
    // Individual Config Writers (for admin API)
    // =========================================================================

    /// Save currencies configuration
    pub async fn save_currencies(&self, config: &CurrenciesConfig) -> Result<(), AppError> {
        self.save_json_file("currencies.json", config).await?;
        self.record_audit("update", "currencies", None).await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save chain IDs configuration
    pub async fn save_chain_ids(&self, config: &ChainIdsConfig) -> Result<(), AppError> {
        self.save_json_file("chain-ids.json", config).await?;
        self.record_audit("update", "chain-ids", None).await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save networks configuration
    pub async fn save_networks(&self, config: &NetworksConfig) -> Result<(), AppError> {
        self.save_json_file("networks.json", config).await?;
        self.record_audit("update", "networks", None).await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save endpoints for a specific network
    pub async fn save_endpoints(
        &self,
        network: &str,
        config: &NetworkEndpointsConfig,
    ) -> Result<(), AppError> {
        let path = format!("endpoints/{}.json", network);
        self.save_json_file(&path, config).await?;
        self.record_audit("update", &format!("endpoints/{}", network), None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save downpayment ranges
    pub async fn save_downpayment_ranges(
        &self,
        config: &DownpaymentRangesConfig,
    ) -> Result<(), AppError> {
        self.save_json_file("lease/downpayment-ranges.json", config)
            .await?;
        self.record_audit("update", "lease/downpayment-ranges", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save ignore assets list
    pub async fn save_ignore_assets(&self, config: &StringArrayConfig) -> Result<(), AppError> {
        self.save_json_file("lease/ignore-assets.json", config)
            .await?;
        self.record_audit("update", "lease/ignore-assets", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save ignore lease long assets list
    pub async fn save_ignore_lease_long(&self, config: &StringArrayConfig) -> Result<(), AppError> {
        self.save_json_file("lease/ignore-lease-long-assets.json", config)
            .await?;
        self.record_audit("update", "lease/ignore-lease-long", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save ignore lease short assets list
    pub async fn save_ignore_lease_short(
        &self,
        config: &StringArrayConfig,
    ) -> Result<(), AppError> {
        self.save_json_file("lease/ignore-lease-short-assets.json", config)
            .await?;
        self.record_audit("update", "lease/ignore-lease-short", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save free interest assets list
    pub async fn save_free_interest_assets(
        &self,
        config: &StringArrayConfig,
    ) -> Result<(), AppError> {
        self.save_json_file("lease/free-interest-assets.json", config)
            .await?;
        self.record_audit("update", "lease/free-interest-assets", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save due projection configuration
    pub async fn save_due_projection(&self, config: &DueProjectionConfig) -> Result<(), AppError> {
        self.save_json_file("lease/due-projection-secs.json", config)
            .await?;
        self.record_audit("update", "lease/due-projection", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save zero interest configuration
    pub async fn save_zero_interest(&self, config: &ZeroInterestConfig) -> Result<(), AppError> {
        self.save_json_file("zero-interest/payment-addresses.json", config)
            .await?;
        self.record_audit("update", "zero-interest/addresses", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save skip route configuration
    pub async fn save_skip_route(&self, config: &SkipRouteConfig) -> Result<(), AppError> {
        self.save_json_file("swap/skip-route-config.json", config)
            .await?;
        self.record_audit("update", "swap/skip-route", None).await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save governance configuration
    pub async fn save_governance(&self, config: &ProposalsConfig) -> Result<(), AppError> {
        self.save_json_file("governance/hidden-proposals.json", config)
            .await?;
        self.record_audit("update", "governance/hidden-proposals", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save a locale
    pub async fn save_locale(
        &self,
        lang: &str,
        content: &serde_json::Value,
    ) -> Result<(), AppError> {
        let path = format!("locales/{}.json", lang);
        self.save_json_file(&path, content).await?;
        self.record_audit("update", &format!("locales/{}", lang), None)
            .await;

        // Invalidate locale cache
        {
            let mut cache = self.cached_locales.write().await;
            cache.remove(lang);
        }

        Ok(())
    }

    /// Save history currencies configuration
    pub async fn save_history_currencies(
        &self,
        config: &HistoryCurrenciesConfig,
    ) -> Result<(), AppError> {
        self.save_json_file("history-currencies.json", config)
            .await?;
        self.record_audit("update", "history-currencies", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save history protocols configuration
    pub async fn save_history_protocols(
        &self,
        config: &HistoryProtocolsConfig,
    ) -> Result<(), AppError> {
        self.save_json_file("history-protocols.json", config)
            .await?;
        self.record_audit("update", "history-protocols", None).await;
        self.invalidate_cache().await;
        Ok(())
    }

    // =========================================================================
    // Internal Helpers
    // =========================================================================

    /// Load a JSON file and deserialize it
    async fn load_json_file<T: DeserializeOwned>(
        &self,
        relative_path: &str,
    ) -> Result<T, AppError> {
        let path = self.config_dir.join(relative_path);
        debug!("Loading config file: {:?}", path);

        if !path.exists() {
            return Err(AppError::NotFound {
                resource: format!("Config file: {}", relative_path),
            });
        }

        let content = fs::read_to_string(&path).await.map_err(|e| {
            error!("Failed to read config file {:?}: {}", path, e);
            AppError::Internal(format!("Failed to read config file: {}", e))
        })?;

        serde_json::from_str(&content).map_err(|e| {
            error!("Failed to parse config file {:?}: {}", path, e);
            AppError::Internal(format!(
                "Failed to parse config file {}: {}",
                relative_path, e
            ))
        })
    }

    /// Save a JSON file with atomic write (write to temp, then rename)
    async fn save_json_file<T: Serialize>(
        &self,
        relative_path: &str,
        data: &T,
    ) -> Result<(), AppError> {
        let path = self.config_dir.join(relative_path);
        let temp_path = path.with_extension("json.tmp");

        debug!("Saving config file: {:?}", path);

        // Ensure parent directory exists
        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .await
                .map_err(|e| AppError::Internal(format!("Failed to create directory: {}", e)))?;
        }

        // Serialize with pretty printing
        let content = serde_json::to_string_pretty(data)
            .map_err(|e| AppError::Internal(format!("Failed to serialize config: {}", e)))?;

        // Write to temp file first
        fs::write(&temp_path, &content).await.map_err(|e| {
            error!("Failed to write temp config file {:?}: {}", temp_path, e);
            AppError::Internal(format!("Failed to write config file: {}", e))
        })?;

        // Atomic rename
        fs::rename(&temp_path, &path).await.map_err(|e| {
            error!(
                "Failed to rename config file {:?} -> {:?}: {}",
                temp_path, path, e
            );
            AppError::Internal(format!("Failed to save config file: {}", e))
        })?;

        info!("Saved config file: {:?}", path);
        Ok(())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    #[tokio::test]
    async fn test_config_store_init() {
        let temp_dir = TempDir::new().unwrap();
        let store = ConfigStore::new(temp_dir.path());

        store.init().await.unwrap();

        // Check that directories were created
        assert!(temp_dir.path().join("endpoints").exists());
        assert!(temp_dir.path().join("lease").exists());
        assert!(temp_dir.path().join("locales").exists());
    }

    #[tokio::test]
    async fn test_save_and_load_currencies() {
        let temp_dir = TempDir::new().unwrap();
        let store = ConfigStore::new(temp_dir.path());
        store.init().await.unwrap();

        let config = CurrenciesConfig {
            icons: "https://example.com/icons".to_string(),
            currencies: std::collections::HashMap::from([(
                "NLS".to_string(),
                CurrencyInfo {
                    name: "Nolus".to_string(),
                    short_name: "NLS".to_string(),
                    coin_gecko_id: "nolus".to_string(),
                    symbol: "unls".to_string(),
                },
            )]),
            map: std::collections::HashMap::new(),
        };

        store.save_currencies(&config).await.unwrap();
        let loaded = store.load_currencies().await.unwrap();

        assert_eq!(loaded.icons, config.icons);
        assert!(loaded.currencies.contains_key("NLS"));
    }

    #[tokio::test]
    async fn test_load_missing_file_returns_error() {
        let temp_dir = TempDir::new().unwrap();
        let store = ConfigStore::new(temp_dir.path());
        store.init().await.unwrap();

        let result = store.load_currencies().await;
        assert!(result.is_err());
    }
}
