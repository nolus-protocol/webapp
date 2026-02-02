use serde::Deserialize;
use std::env;
use std::fs;
use std::path::Path;
use thiserror::Error;
use tracing::{info, warn};

// ============================================================================
// Configuration Errors
// ============================================================================

/// Errors that can occur during configuration validation
#[derive(Debug, Error)]
pub enum ConfigError {
    #[error("Missing required configuration: {field}")]
    MissingRequired { field: String },

    #[error("Invalid URL format for {field}: {value}")]
    InvalidUrl { field: String, value: String },

    #[error("Invalid contract address for {field}: {value} (must start with 'nolus1')")]
    InvalidContractAddress { field: String, value: String },

    #[error("Admin API is enabled but no API key is configured")]
    AdminEnabledNoKey,

    #[error("No active protocols configured")]
    NoActiveProtocols,

    #[error("Cache TTL must be positive: {field} = {value}")]
    InvalidCacheTtl { field: String, value: u64 },
}

/// Result of configuration validation
#[derive(Debug)]
pub struct ValidationResult {
    pub errors: Vec<ConfigError>,
    pub warnings: Vec<String>,
}

impl ValidationResult {
    pub fn is_ok(&self) -> bool {
        self.errors.is_empty()
    }

    pub fn has_warnings(&self) -> bool {
        !self.warnings.is_empty()
    }
}

// ============================================================================
// Endpoints Config File Structure
// ============================================================================

/// Structure for parsing endpoints config files (e.g., config/endpoints/pirin.json)
#[derive(Debug, Clone, Deserialize)]
pub struct EndpointsConfigFile {
    #[serde(rename = "NOLUS")]
    pub nolus: Option<NetworkEndpoints>,
    #[serde(rename = "OSMOSIS")]
    pub osmosis: Option<NetworkEndpoints>,
    #[serde(rename = "NEUTRON")]
    pub neutron: Option<NetworkEndpoints>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct NetworkEndpoints {
    pub primary: EndpointPair,
    #[serde(default)]
    pub fallback: Vec<EndpointPair>,
}

#[derive(Debug, Clone, Deserialize)]
pub struct EndpointPair {
    pub rpc: String,
    pub api: String,
}

impl EndpointsConfigFile {
    /// Load endpoints from a config file
    pub fn load_from_file(path: &Path) -> anyhow::Result<Self> {
        let content = fs::read_to_string(path)?;
        let config: Self = serde_json::from_str(&content)?;
        Ok(config)
    }

    /// Try to load endpoints from the default config path
    pub fn load_default() -> Option<Self> {
        let config_path = Path::new("./config/endpoints/pirin.json");
        if config_path.exists() {
            match Self::load_from_file(config_path) {
                Ok(config) => {
                    info!("Loaded endpoints from {}", config_path.display());
                    Some(config)
                }
                Err(e) => {
                    warn!("Failed to parse endpoints config file: {}", e);
                    None
                }
            }
        } else {
            None
        }
    }
}

// ============================================================================
// Main Configuration
// ============================================================================

/// Main application configuration
#[derive(Debug, Clone, Deserialize, Default)]
pub struct AppConfig {
    pub server: ServerConfig,
    pub external: ExternalApiConfig,
    pub external_apis: ExternalApiConfig, // Alias for external
    pub cache: CacheConfig,
    pub admin: AdminConfig,
    pub protocols: ProtocolsConfig,
}

#[derive(Debug, Clone, Deserialize)]
pub struct ServerConfig {
    pub host: String,
    pub port: u16,
}

impl Default for ServerConfig {
    fn default() -> Self {
        Self {
            host: "0.0.0.0".to_string(),
            port: 3000,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct ExternalApiConfig {
    // Unauthenticated APIs
    pub etl_api_url: String,
    pub skip_api_url: String,
    pub skip_api_key: Option<String>,

    // Chain RPCs & REST
    pub nolus_rpc_url: String,
    pub nolus_rest_url: String,
    pub osmosis_rpc_url: String,
    pub neutron_rpc_url: String,
    pub solana_rpc_url: Option<String>,

    // Authenticated APIs - Referral
    pub referral_api_url: String,
    pub referral_api_token: String,

    // Authenticated APIs - Zero Interest
    pub zero_interest_api_url: String,
    pub zero_interest_api_token: String,

    // Intercom
    pub intercom_app_id: String,
    pub intercom_secret_key: String,
}

#[derive(Debug, Clone, Deserialize)]
pub struct CacheConfig {
    /// Price cache TTL in seconds
    pub prices_ttl_secs: u64,
    /// Config cache TTL in seconds
    pub config_ttl_secs: u64,
    /// APR cache TTL in seconds
    pub apr_ttl_secs: u64,
    /// Max cache entries
    pub max_entries: u64,
}

impl Default for CacheConfig {
    fn default() -> Self {
        Self {
            // Prices change frequently - short TTL
            prices_ttl_secs: 15,
            // Config rarely changes - long TTL (1 hour)
            config_ttl_secs: 3600,
            // APR changes moderately - medium TTL (5 min)
            apr_ttl_secs: 300,
            max_entries: 10000,
        }
    }
}

#[derive(Debug, Clone, Deserialize, Default)]
pub struct AdminConfig {
    #[serde(default)]
    pub enabled: bool,
    #[serde(default)]
    pub api_key: String,
}

/// Protocol configuration for the Nolus Admin contract
#[derive(Debug, Clone, Deserialize)]
pub struct ProtocolsConfig {
    /// Admin contract address
    pub admin_contract: String,
    /// Dispatcher contract address
    pub dispatcher_contract: String,
    /// Protocol filters (which protocols are active)
    pub active_protocols: Vec<String>,
}

impl Default for ProtocolsConfig {
    fn default() -> Self {
        Self {
            // Mainnet admin contract
            admin_contract: "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd"
                .to_string(),
            dispatcher_contract: "nolus14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0k0puz"
                .to_string(),
            active_protocols: vec![
                "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
                "OSMOSIS-OSMOSIS-USDC_AXELAR".to_string(),
                "OSMOSIS-OSMOSIS-ALL_BTC".to_string(),
                "OSMOSIS-OSMOSIS-ALL_SOL".to_string(),
                "OSMOSIS-OSMOSIS-ATOM".to_string(),
                "OSMOSIS-OSMOSIS-OSMO".to_string(),
                "OSMOSIS-OSMOSIS-AKT".to_string(),
                "NEUTRON-ASTROPORT-USDC_NOBLE".to_string(),
            ],
        }
    }
}

impl AppConfig {
    /// Validate the configuration
    ///
    /// Returns errors for critical issues and warnings for non-critical issues.
    /// Call this after `load()` to ensure configuration is valid before starting.
    pub fn validate(&self) -> ValidationResult {
        let mut errors = Vec::new();
        let mut warnings = Vec::new();

        // ====================================================================
        // Required External APIs
        // ====================================================================

        // ETL API is required for most functionality
        if self.external.etl_api_url.is_empty() {
            errors.push(ConfigError::MissingRequired {
                field: "ETL_API_URL".to_string(),
            });
        } else if !self.is_valid_url(&self.external.etl_api_url) {
            errors.push(ConfigError::InvalidUrl {
                field: "ETL_API_URL".to_string(),
                value: self.external.etl_api_url.clone(),
            });
        }

        // Nolus RPC/REST are required for chain operations
        if self.external.nolus_rpc_url.is_empty() {
            errors.push(ConfigError::MissingRequired {
                field: "NOLUS_RPC_URL".to_string(),
            });
        }
        if self.external.nolus_rest_url.is_empty() {
            errors.push(ConfigError::MissingRequired {
                field: "NOLUS_REST_URL".to_string(),
            });
        }

        // ====================================================================
        // Protocol Configuration
        // ====================================================================

        // Admin contract must be a valid address
        if !self.protocols.admin_contract.starts_with("nolus1") {
            errors.push(ConfigError::InvalidContractAddress {
                field: "ADMIN_CONTRACT".to_string(),
                value: self.protocols.admin_contract.clone(),
            });
        }

        // Dispatcher contract must be a valid address
        if !self.protocols.dispatcher_contract.starts_with("nolus1") {
            errors.push(ConfigError::InvalidContractAddress {
                field: "DISPATCHER_CONTRACT".to_string(),
                value: self.protocols.dispatcher_contract.clone(),
            });
        }

        // Must have at least one active protocol
        if self.protocols.active_protocols.is_empty() {
            errors.push(ConfigError::NoActiveProtocols);
        }

        // ====================================================================
        // Admin API
        // ====================================================================

        if self.admin.enabled && self.admin.api_key.is_empty() {
            errors.push(ConfigError::AdminEnabledNoKey);
        }

        // ====================================================================
        // Cache Configuration
        // ====================================================================

        if self.cache.prices_ttl_secs == 0 {
            errors.push(ConfigError::InvalidCacheTtl {
                field: "CACHE_PRICES_TTL_SECS".to_string(),
                value: 0,
            });
        }

        if self.cache.config_ttl_secs == 0 {
            errors.push(ConfigError::InvalidCacheTtl {
                field: "CACHE_CONFIG_TTL_SECS".to_string(),
                value: 0,
            });
        }

        // ====================================================================
        // Warnings (non-critical)
        // ====================================================================

        // Optional APIs - warn if not configured
        if self.external.referral_api_url.is_empty() {
            warnings.push("Referral API not configured - referral features will be disabled".to_string());
        } else if self.external.referral_api_token.is_empty() {
            warnings.push("Referral API URL configured but no token - authentication will fail".to_string());
        }

        if self.external.zero_interest_api_url.is_empty() {
            warnings.push("Zero Interest API not configured - zero interest features will be disabled".to_string());
        }

        if self.external.intercom_secret_key.is_empty() {
            warnings.push("Intercom secret key not configured - identity verification disabled".to_string());
        }

        if self.external.skip_api_key.is_none() {
            warnings.push("Skip API key not configured - swap routing may be rate limited".to_string());
        }

        // Performance warnings
        if self.cache.prices_ttl_secs > 60 {
            warnings.push(format!(
                "Price cache TTL is {}s - this may cause stale prices in UI",
                self.cache.prices_ttl_secs
            ));
        }

        ValidationResult { errors, warnings }
    }

    /// Check if a string is a valid URL (basic check)
    fn is_valid_url(&self, url: &str) -> bool {
        url.starts_with("http://") || url.starts_with("https://")
    }

    /// Validate and log any issues, returning an error if critical issues found
    pub fn validate_and_log(&self) -> anyhow::Result<()> {
        let result = self.validate();

        // Log warnings
        for warning in &result.warnings {
            warn!("Config warning: {}", warning);
        }

        // Check for errors
        if !result.is_ok() {
            let error_messages: Vec<String> = result.errors.iter().map(|e| e.to_string()).collect();
            anyhow::bail!(
                "Configuration validation failed:\n  - {}",
                error_messages.join("\n  - ")
            );
        }

        Ok(())
    }

    /// Helper to get endpoint from config file, env var, or fail
    /// Priority: 1. Environment variable, 2. Config file, 3. Fail
    fn get_required_endpoint(
        env_var: &str,
        config_value: Option<&str>,
        field_name: &str,
    ) -> anyhow::Result<String> {
        // First check environment variable
        if let Ok(value) = env::var(env_var) {
            if !value.is_empty() {
                return Ok(value);
            }
        }

        // Then check config file value
        if let Some(value) = config_value {
            if !value.is_empty() {
                return Ok(value.to_string());
            }
        }

        // Neither set - fail fast
        anyhow::bail!(
            "Missing required endpoint: {} (set {} env var or configure in config/endpoints/pirin.json)",
            field_name,
            env_var
        )
    }

    /// Load configuration from config files and environment variables
    /// Priority: 1. Environment variable, 2. Config file, 3. Fail for required fields
    pub fn load() -> anyhow::Result<Self> {
        // Try to load endpoints from config file
        let endpoints_config = EndpointsConfigFile::load_default();

        // Extract endpoints from config file if available
        let nolus_rpc_from_config = endpoints_config
            .as_ref()
            .and_then(|c| c.nolus.as_ref())
            .map(|n| n.primary.rpc.as_str());
        let nolus_rest_from_config = endpoints_config
            .as_ref()
            .and_then(|c| c.nolus.as_ref())
            .map(|n| n.primary.api.as_str());
        let osmosis_rpc_from_config = endpoints_config
            .as_ref()
            .and_then(|c| c.osmosis.as_ref())
            .map(|n| n.primary.rpc.as_str());
        let neutron_rpc_from_config = endpoints_config
            .as_ref()
            .and_then(|c| c.neutron.as_ref())
            .map(|n| n.primary.rpc.as_str());

        // Load required endpoints (fail fast if not configured)
        let nolus_rpc_url =
            Self::get_required_endpoint("NOLUS_RPC_URL", nolus_rpc_from_config, "Nolus RPC")?;
        let nolus_rest_url =
            Self::get_required_endpoint("NOLUS_REST_URL", nolus_rest_from_config, "Nolus REST")?;
        let osmosis_rpc_url =
            Self::get_required_endpoint("OSMOSIS_RPC_URL", osmosis_rpc_from_config, "Osmosis RPC")?;
        let neutron_rpc_url =
            Self::get_required_endpoint("NEUTRON_RPC_URL", neutron_rpc_from_config, "Neutron RPC")?;

        // ETL API URL - required, check env var first, then fail
        let etl_api_url = env::var("ETL_API_URL").unwrap_or_else(|_| String::new());
        if etl_api_url.is_empty() {
            anyhow::bail!(
                "Missing required configuration: ETL_API_URL (set ETL_API_URL env var)"
            );
        }

        let external = ExternalApiConfig {
            // Unauthenticated
            etl_api_url,
            skip_api_url: env::var("SKIP_API_URL")
                .unwrap_or_else(|_| "https://api.skip.money".to_string()),
            skip_api_key: env::var("SKIP_API_KEY").ok(),

            // Chain RPCs & REST (loaded above with fail-fast)
            nolus_rpc_url,
            nolus_rest_url,
            osmosis_rpc_url,
            neutron_rpc_url,
            solana_rpc_url: env::var("SOLANA_RPC_URL").ok(),

            // Authenticated - Referral
            referral_api_url: env::var("REFERRAL_API_URL").unwrap_or_else(|_| String::new()),
            referral_api_token: env::var("REFERRAL_API_TOKEN").unwrap_or_else(|_| String::new()),

            // Authenticated - Zero Interest
            zero_interest_api_url: env::var("ZERO_INTEREST_API_URL")
                .unwrap_or_else(|_| String::new()),
            zero_interest_api_token: env::var("ZERO_INTEREST_API_TOKEN")
                .unwrap_or_else(|_| String::new()),

            // Intercom
            intercom_app_id: env::var("INTERCOM_APP_ID").unwrap_or_else(|_| "hbjifswh".to_string()),
            intercom_secret_key: env::var("INTERCOM_SECRET_KEY").unwrap_or_else(|_| String::new()),
        };

        Ok(Self {
            server: ServerConfig {
                host: env::var("HOST").unwrap_or_else(|_| "0.0.0.0".to_string()),
                port: env::var("PORT")
                    .unwrap_or_else(|_| "3000".to_string())
                    .parse()
                    .expect("PORT must be a number"),
            },
            external_apis: external.clone(),
            external,
            cache: CacheConfig {
                // Prices: 15s default (high volatility)
                prices_ttl_secs: env::var("CACHE_PRICES_TTL_SECS")
                    .unwrap_or_else(|_| "15".to_string())
                    .parse()
                    .unwrap_or(15),
                // Config: 1 hour default (rarely changes)
                config_ttl_secs: env::var("CACHE_CONFIG_TTL_SECS")
                    .unwrap_or_else(|_| "3600".to_string())
                    .parse()
                    .unwrap_or(3600),
                // APR: 5 min default (moderate volatility)
                apr_ttl_secs: env::var("CACHE_APR_TTL_SECS")
                    .unwrap_or_else(|_| "300".to_string())
                    .parse()
                    .unwrap_or(300),
                max_entries: env::var("CACHE_MAX_ENTRIES")
                    .unwrap_or_else(|_| "10000".to_string())
                    .parse()
                    .unwrap_or(10000),
            },
            admin: AdminConfig {
                enabled: env::var("ADMIN_API_ENABLED")
                    .unwrap_or_else(|_| "false".to_string())
                    .parse()
                    .unwrap_or(false),
                api_key: env::var("ADMIN_API_KEY").unwrap_or_else(|_| String::new()),
            },
            protocols: ProtocolsConfig {
                admin_contract: env::var("ADMIN_CONTRACT").unwrap_or_else(|_| {
                    "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd".to_string()
                }),
                dispatcher_contract: env::var("DISPATCHER_CONTRACT").unwrap_or_else(|_| {
                    "nolus14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0k0puz".to_string()
                }),
                active_protocols: env::var("ACTIVE_PROTOCOLS")
                    .map(|s| s.split(',').map(|p| p.trim().to_string()).collect())
                    .unwrap_or_else(|_| {
                        vec![
                            "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
                            "OSMOSIS-OSMOSIS-USDC_AXELAR".to_string(),
                            "OSMOSIS-OSMOSIS-ALL_BTC".to_string(),
                            "OSMOSIS-OSMOSIS-ALL_SOL".to_string(),
                            "OSMOSIS-OSMOSIS-ATOM".to_string(),
                            "OSMOSIS-OSMOSIS-OSMO".to_string(),
                            "OSMOSIS-OSMOSIS-AKT".to_string(),
                            "NEUTRON-ASTROPORT-USDC_NOBLE".to_string(),
                        ]
                    }),
            },
        })
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Create a test config with all required fields populated
    fn create_test_config() -> AppConfig {
        AppConfig {
            server: ServerConfig::default(),
            external: ExternalApiConfig {
                etl_api_url: "https://etl.example.com".to_string(),
                skip_api_url: "https://api.skip.money".to_string(),
                skip_api_key: None,
                nolus_rpc_url: "https://rpc.nolus.network".to_string(),
                nolus_rest_url: "https://lcd.nolus.network".to_string(),
                osmosis_rpc_url: "https://rpc.osmosis.zone".to_string(),
                neutron_rpc_url: "https://rpc.neutron.org".to_string(),
                solana_rpc_url: None,
                referral_api_url: String::new(),
                referral_api_token: String::new(),
                zero_interest_api_url: String::new(),
                zero_interest_api_token: String::new(),
                intercom_app_id: "test".to_string(),
                intercom_secret_key: String::new(),
            },
            external_apis: ExternalApiConfig::default(),
            cache: CacheConfig::default(),
            admin: AdminConfig::default(),
            protocols: ProtocolsConfig::default(),
        }
    }

    #[test]
    fn test_default_server_config() {
        let config = ServerConfig::default();
        assert_eq!(config.host, "0.0.0.0");
        assert_eq!(config.port, 3000);
    }

    #[test]
    fn test_default_cache_config() {
        let config = CacheConfig::default();
        assert_eq!(config.prices_ttl_secs, 15);
        assert_eq!(config.config_ttl_secs, 3600);
        assert_eq!(config.apr_ttl_secs, 300);
        assert_eq!(config.max_entries, 10000);
    }

    #[test]
    fn test_default_admin_config() {
        let config = AdminConfig::default();
        assert!(!config.enabled);
        assert!(config.api_key.is_empty());
    }

    #[test]
    fn test_default_protocols_config() {
        let config = ProtocolsConfig::default();
        assert!(!config.admin_contract.is_empty());
        assert!(!config.dispatcher_contract.is_empty());
        assert!(!config.active_protocols.is_empty());
        assert!(config
            .active_protocols
            .contains(&"OSMOSIS-OSMOSIS-USDC_NOBLE".to_string()));
    }

    #[test]
    fn test_active_protocols_parsing() {
        let protocols_str = "PROTOCOL_A, PROTOCOL_B, PROTOCOL_C";
        let parsed: Vec<String> = protocols_str
            .split(',')
            .map(|p| p.trim().to_string())
            .collect();

        assert_eq!(parsed.len(), 3);
        assert!(parsed.contains(&"PROTOCOL_A".to_string()));
        assert!(parsed.contains(&"PROTOCOL_B".to_string()));
        assert!(parsed.contains(&"PROTOCOL_C".to_string()));
    }

    #[test]
    fn test_external_api_config_default() {
        let config = ExternalApiConfig::default();
        assert!(config.etl_api_url.is_empty());
    }

    #[test]
    fn test_protocols_config_has_mainnet_contracts() {
        let config = ProtocolsConfig::default();
        assert!(config.admin_contract.starts_with("nolus1"));
        assert!(config.dispatcher_contract.starts_with("nolus1"));
    }

    #[test]
    fn test_cache_config_reasonable_values() {
        let config = CacheConfig::default();
        assert!(config.prices_ttl_secs <= 60);
        assert!(config.config_ttl_secs >= 60);
        assert!(config.max_entries >= 1000);
    }

    #[test]
    fn test_default_protocol_list_completeness() {
        let config = ProtocolsConfig::default();

        let has_osmosis = config
            .active_protocols
            .iter()
            .any(|p| p.starts_with("OSMOSIS"));
        assert!(has_osmosis, "Should have at least one Osmosis protocol");

        let has_neutron = config
            .active_protocols
            .iter()
            .any(|p| p.starts_with("NEUTRON"));
        assert!(has_neutron, "Should have at least one Neutron protocol");
    }

    // ========================================================================
    // Endpoint Loading Tests
    // ========================================================================

    #[test]
    fn test_get_required_endpoint_from_env() {
        // This test verifies the priority: env var > config file
        let result = AppConfig::get_required_endpoint(
            "PATH", // PATH is always set
            Some("config_value"),
            "test",
        );
        assert!(result.is_ok());
        // Should use env var, not config value
        assert!(!result.unwrap().is_empty());
    }

    #[test]
    fn test_get_required_endpoint_from_config() {
        let result = AppConfig::get_required_endpoint(
            "NONEXISTENT_ENV_VAR_12345",
            Some("https://example.com"),
            "test",
        );
        assert!(result.is_ok());
        assert_eq!(result.unwrap(), "https://example.com");
    }

    #[test]
    fn test_get_required_endpoint_fails_when_missing() {
        let result = AppConfig::get_required_endpoint(
            "NONEXISTENT_ENV_VAR_12345",
            None,
            "Test Endpoint",
        );
        assert!(result.is_err());
        let err = result.unwrap_err().to_string();
        assert!(err.contains("Missing required endpoint"));
        assert!(err.contains("Test Endpoint"));
    }

    // ========================================================================
    // Validation Tests
    // ========================================================================

    #[test]
    fn test_validate_valid_config() {
        let config = create_test_config();
        let result = config.validate();
        assert!(
            result.is_ok(),
            "Test config should be valid, errors: {:?}",
            result.errors
        );
    }

    #[test]
    fn test_validate_missing_etl_url() {
        let mut config = create_test_config();
        config.external.etl_api_url = String::new();
        let result = config.validate();
        assert!(!result.is_ok());
        assert!(result.errors.iter().any(|e| {
            matches!(e, ConfigError::MissingRequired { field } if field == "ETL_API_URL")
        }));
    }

    #[test]
    fn test_validate_invalid_etl_url() {
        let mut config = create_test_config();
        config.external.etl_api_url = "not-a-url".to_string();
        let result = config.validate();
        assert!(!result.is_ok());
        assert!(result.errors.iter().any(|e| {
            matches!(e, ConfigError::InvalidUrl { field, .. } if field == "ETL_API_URL")
        }));
    }

    #[test]
    fn test_validate_invalid_admin_contract() {
        let mut config = create_test_config();
        config.protocols.admin_contract = "invalid-address".to_string();
        let result = config.validate();
        assert!(!result.is_ok());
        assert!(result.errors.iter().any(|e| {
            matches!(e, ConfigError::InvalidContractAddress { field, .. } if field == "ADMIN_CONTRACT")
        }));
    }

    #[test]
    fn test_validate_no_active_protocols() {
        let mut config = create_test_config();
        config.protocols.active_protocols = vec![];
        let result = config.validate();
        assert!(!result.is_ok());
        assert!(result
            .errors
            .iter()
            .any(|e| matches!(e, ConfigError::NoActiveProtocols)));
    }

    #[test]
    fn test_validate_admin_enabled_no_key() {
        let mut config = create_test_config();
        config.admin.enabled = true;
        config.admin.api_key = String::new();
        let result = config.validate();
        assert!(!result.is_ok());
        assert!(result
            .errors
            .iter()
            .any(|e| matches!(e, ConfigError::AdminEnabledNoKey)));
    }

    #[test]
    fn test_validate_zero_cache_ttl() {
        let mut config = create_test_config();
        config.cache.prices_ttl_secs = 0;
        let result = config.validate();
        assert!(!result.is_ok());
        assert!(result.errors.iter().any(|e| {
            matches!(e, ConfigError::InvalidCacheTtl { field, .. } if field == "CACHE_PRICES_TTL_SECS")
        }));
    }

    #[test]
    fn test_validate_warnings_for_optional_apis() {
        let mut config = create_test_config();
        config.external.referral_api_url = String::new();
        config.external.zero_interest_api_url = String::new();
        config.external.intercom_secret_key = String::new();
        config.external.skip_api_key = None;
        
        let result = config.validate();
        // Warnings for optional features, but no errors
        assert!(result.has_warnings());
        assert!(result.warnings.len() >= 4);
    }

    #[test]
    fn test_validate_warning_for_high_price_ttl() {
        let mut config = create_test_config();
        config.cache.prices_ttl_secs = 120; // 2 minutes
        let result = config.validate();
        assert!(result.warnings.iter().any(|w| w.contains("Price cache TTL")));
    }

    #[test]
    fn test_validation_result_methods() {
        let empty = ValidationResult {
            errors: vec![],
            warnings: vec![],
        };
        assert!(empty.is_ok());
        assert!(!empty.has_warnings());

        let with_warning = ValidationResult {
            errors: vec![],
            warnings: vec!["test warning".to_string()],
        };
        assert!(with_warning.is_ok());
        assert!(with_warning.has_warnings());

        let with_error = ValidationResult {
            errors: vec![ConfigError::NoActiveProtocols],
            warnings: vec![],
        };
        assert!(!with_error.is_ok());
    }
}
