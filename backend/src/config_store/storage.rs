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

use super::gated_types::*;

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

/// Response for listing available locales
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LocalesListResponse {
    pub available: Vec<String>,
    pub default: String,
}

/// Configuration store that manages all webapp configuration
#[derive(Debug)]
pub struct ConfigStore {
    /// Base directory for config files
    config_dir: PathBuf,
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
            cached_locales: Arc::new(RwLock::new(std::collections::HashMap::new())),
            audit_log: Arc::new(RwLock::new(Vec::new())),
        }
    }

    /// Initialize the config store, creating directories if needed
    pub async fn init(&self) -> Result<(), AppError> {
        // Create config directories if they don't exist
        let dirs = [
            self.config_dir.clone(),
            self.config_dir.join("locales"),
            self.config_dir.join("gated"),
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

        // Load audit log
        if let Err(e) = self.load_audit_log().await {
            warn!("Could not load audit log (starting fresh): {}", e);
        }

        Ok(())
    }

    /// Invalidate the configuration cache
    pub async fn invalidate_cache(&self) {
        let mut locales = self.cached_locales.write().await;
        locales.clear();
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

    // =========================================================================
    // Locales
    // =========================================================================

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
                    let name = stem.to_string_lossy().to_string();
                    // Skip non-locale files like audit.json, pending.json, languages.json
                    if name.len() == 2 || name == "active" {
                        available.push(name);
                    }
                }
            }
        }

        available.sort();

        Ok(LocalesListResponse {
            available,
            default: "en".to_string(),
        })
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

    // =========================================================================
    // Gated Propagation Config Loaders
    // =========================================================================

    /// Load currency display configuration
    pub async fn load_currency_display(&self) -> Result<CurrencyDisplayConfig, AppError> {
        self.load_json_file("gated/currency-display.json").await
    }

    /// Load gated network configuration
    pub async fn load_gated_network_config(&self) -> Result<GatedNetworkConfig, AppError> {
        self.load_json_file("gated/network-config.json").await
    }

    /// Load lease rules configuration
    pub async fn load_lease_rules(&self) -> Result<LeaseRulesConfig, AppError> {
        self.load_json_file("gated/lease-rules.json").await
    }

    /// Load swap settings configuration
    pub async fn load_swap_settings(&self) -> Result<SwapSettingsConfig, AppError> {
        self.load_json_file("gated/swap-settings.json").await
    }

    /// Load UI settings configuration
    pub async fn load_ui_settings(&self) -> Result<UiSettingsConfig, AppError> {
        self.load_json_file("gated/ui-settings.json").await
    }

    // =========================================================================
    // Gated Propagation Config Writers
    // =========================================================================

    /// Save currency display configuration
    pub async fn save_currency_display(
        &self,
        config: &CurrencyDisplayConfig,
    ) -> Result<(), AppError> {
        self.save_json_file("gated/currency-display.json", config)
            .await?;
        self.record_audit("update", "gated/currency-display", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save gated network configuration
    pub async fn save_gated_network_config(
        &self,
        config: &GatedNetworkConfig,
    ) -> Result<(), AppError> {
        self.save_json_file("gated/network-config.json", config)
            .await?;
        self.record_audit("update", "gated/network-config", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save lease rules configuration
    pub async fn save_lease_rules(&self, config: &LeaseRulesConfig) -> Result<(), AppError> {
        self.save_json_file("gated/lease-rules.json", config)
            .await?;
        self.record_audit("update", "gated/lease-rules", None).await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save swap settings configuration
    pub async fn save_swap_settings(&self, config: &SwapSettingsConfig) -> Result<(), AppError> {
        self.save_json_file("gated/swap-settings.json", config)
            .await?;
        self.record_audit("update", "gated/swap-settings", None)
            .await;
        self.invalidate_cache().await;
        Ok(())
    }

    /// Save UI settings configuration
    pub async fn save_ui_settings(&self, config: &UiSettingsConfig) -> Result<(), AppError> {
        self.save_json_file("gated/ui-settings.json", config)
            .await?;
        self.record_audit("update", "gated/ui-settings", None).await;
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
        assert!(temp_dir.path().join("locales").exists());
        assert!(temp_dir.path().join("gated").exists());
    }

    #[tokio::test]
    async fn test_audit_log() {
        let temp_dir = TempDir::new().unwrap();
        let store = ConfigStore::new(temp_dir.path());
        store.init().await.unwrap();

        store
            .record_audit("create", "test-resource", Some("test details".to_string()))
            .await;

        let query = AuditLogQuery::default();
        let response = store.query_audit_log(query).await;

        assert_eq!(response.total, 1);
        assert_eq!(response.entries[0].action, "create");
        assert_eq!(response.entries[0].resource, "test-resource");
    }
}
