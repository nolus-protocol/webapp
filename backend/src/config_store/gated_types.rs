//! Gated Propagation Configuration Types
//!
//! These types define the configuration for the gated propagation system.
//! ETL items are hidden by default until explicitly configured here.
//!
//! ## Config Files
//! All files are stored in `backend/config/gated/`:
//! - `currency-display.json` - Currency enrichment (icon, color, displayName)
//! - `network-config.json` - Network settings (endpoints, gas, explorer, primaryProtocol)
//! - `lease-rules.json` - Downpayment ranges, asset restrictions
//! - `swap-settings.json` - Skip API settings, blacklist, venues
//! - `ui-settings.json` - Hidden proposals, feature flags, maintenance mode
//!
//! ## Design Principles
//! - **Hidden by default**: Unconfigured items never reach frontend
//! - **Admin never re-enters ETL data**: Only enrichment fields are editable
//! - **Protocol status is derived**: Based on network + currency configuration

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Currency Display Configuration
// ============================================================================

/// Currency display enrichment configuration
/// File: `config/gated/currency-display.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyDisplayConfig {
    /// Currency display settings keyed by ticker (e.g., "ATOM", "OSMO")
    #[serde(flatten)]
    pub currencies: HashMap<String, CurrencyDisplay>,
}

/// Display enrichment for a single currency
/// A currency is "configured" when it has icon + displayName
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyDisplay {
    /// Icon URL or path (required for currency to be configured)
    pub icon: String,
    /// Display name shown in UI (required for currency to be configured)
    #[serde(rename = "displayName")]
    pub display_name: String,
    /// Short name/ticker for display (e.g., "ATOM", "stATOM")
    #[serde(rename = "shortName", skip_serializing_if = "Option::is_none")]
    pub short_name: Option<String>,
    /// Theme color for the currency (hex format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// CoinGecko ID for price data (e.g., "cosmos", "osmosis")
    #[serde(rename = "coingeckoId", skip_serializing_if = "Option::is_none")]
    pub coingecko_id: Option<String>,
}

impl CurrencyDisplay {
    /// Check if this currency has minimum required fields to be "configured"
    pub fn is_configured(&self) -> bool {
        !self.icon.is_empty() && !self.display_name.is_empty()
    }
}

// ============================================================================
// Network Configuration
// ============================================================================

/// Network configuration for gated propagation
/// File: `config/gated/network-config.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GatedNetworkConfig {
    /// Network settings keyed by network key (e.g., "OSMOSIS", "NEUTRON")
    #[serde(flatten)]
    pub networks: HashMap<String, NetworkSettings>,
}

/// Pool-specific configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct PoolConfig {
    /// Pool icon path
    pub icon: String,
}

/// Settings for a single network
/// A network is "configured" when it has RPC + LCD + gas_price
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSettings {
    /// Display name (e.g., "Osmosis", "Neutron")
    pub name: String,
    /// Chain ID (e.g., "osmosis-1", "neutron-1")
    pub chain_id: String,
    /// Address prefix (e.g., "osmo", "neutron")
    pub prefix: String,
    /// Primary RPC endpoint (required)
    pub rpc: String,
    /// Primary LCD/REST endpoint (required)
    pub lcd: String,
    /// Fallback RPC endpoints
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fallback_rpc: Vec<String>,
    /// Fallback LCD endpoints
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub fallback_lcd: Vec<String>,
    /// Gas price with denom (e.g., "0.025uosmo") (required)
    pub gas_price: String,
    /// Block explorer URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explorer: Option<String>,
    /// Network icon path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Primary protocol for this network (used for price deduplication)
    /// Format: "NETWORK-DEX-LPN" (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
    #[serde(rename = "primaryProtocol", skip_serializing_if = "Option::is_none")]
    pub primary_protocol: Option<String>,
    /// Estimated transaction time in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
    /// Whether to use packet forwarding for IBC
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward: Option<bool>,
    /// Swap venue (DEX) for this network (optional — only networks with a DEX have this)
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub swap_venue: Option<NetworkSwapVenue>,
    /// Gas multiplier for fee estimation (e.g., 3.5 for Nolus, 2.5 for Neutron)
    pub gas_multiplier: f64,
    /// Pool-specific configurations keyed by protocol (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub pools: HashMap<String, PoolConfig>,
}

/// Swap venue (DEX) configuration within a network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSwapVenue {
    /// Venue name (e.g., "osmosis-poolmanager", "neutron-astroport")
    pub name: String,
    /// Contract address for this venue
    #[serde(skip_serializing_if = "Option::is_none")]
    pub address: Option<String>,
}

impl NetworkSettings {
    /// Check if this network has minimum required fields to be "configured"
    pub fn is_configured(&self) -> bool {
        !self.rpc.is_empty() && !self.lcd.is_empty() && !self.gas_price.is_empty()
    }
}

// ============================================================================
// Lease Rules Configuration
// ============================================================================

/// Lease rules configuration
/// File: `config/gated/lease-rules.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseRulesConfig {
    /// Downpayment ranges per protocol and asset
    /// Key: protocol (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
    /// Value: Map of asset ticker to downpayment range
    #[serde(default)]
    pub downpayment_ranges: HashMap<String, HashMap<String, DownpaymentRange>>,
    /// Asset restrictions (which assets to ignore)
    #[serde(default)]
    pub asset_restrictions: AssetRestrictions,
}

/// Downpayment range for an asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownpaymentRange {
    /// Minimum downpayment value in USD
    pub min: f64,
    /// Maximum downpayment value in USD
    pub max: f64,
}

/// Asset restriction configuration
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct AssetRestrictions {
    /// Assets to ignore completely (not shown anywhere)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ignore_all: Vec<String>,
    /// Assets to ignore for long positions only
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ignore_long: Vec<String>,
    /// Assets to ignore for short positions only
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub ignore_short: Vec<String>,
    /// Assets with free interest (zero interest)
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub free_interest: Vec<String>,
}

// ============================================================================
// Swap Settings Configuration
// ============================================================================

/// Swap settings configuration
/// File: `config/gated/swap-settings.json`
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapSettingsConfig {
    /// Skip API base URL
    pub api_url: String,
    /// Blacklisted currency tickers to exclude from swap routes
    /// Uses tickers (e.g., "ATOM", "OSMO") for uniformity with other gated configs
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub blacklist: Vec<String>,
    /// Slippage tolerance in percentage (e.g., 1 = 1%)
    #[serde(default = "default_slippage")]
    pub slippage: u32,
    /// Gas multiplier for swap transactions
    #[serde(default = "default_gas_multiplier")]
    pub gas_multiplier: u32,
    /// Base fee in basis points
    #[serde(default = "default_fee")]
    pub fee: u32,
    /// Fee recipient address
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub fee_address: Option<String>,
    /// Transaction timeout in seconds
    #[serde(rename = "timeoutSeconds", default = "default_timeout")]
    pub timeout_seconds: String,
    /// Swap currency ticker mapping per network (e.g., { "osmosis": "USDC_NOBLE" })
    /// Tickers are resolved to IBC denoms at runtime via ETL data
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub swap_currencies: HashMap<String, String>,
    /// Target currency ticker for swaps (e.g., "NLS")
    /// Resolved to denom at runtime via ETL data
    #[serde(skip_serializing_if = "Option::is_none")]
    pub swap_to_currency: Option<String>,
}

fn default_slippage() -> u32 {
    1
}

fn default_gas_multiplier() -> u32 {
    2
}

fn default_fee() -> u32 {
    35
}

fn default_timeout() -> String {
    "60".to_string()
}

// ============================================================================
// UI Settings Configuration
// ============================================================================

/// UI settings configuration
/// File: `config/gated/ui-settings.json`
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct UiSettingsConfig {
    /// Proposal IDs to hide from governance display
    #[serde(default, skip_serializing_if = "Vec::is_empty")]
    pub hidden_proposals: Vec<String>,
    /// Feature flags (key -> enabled)
    #[serde(default, skip_serializing_if = "HashMap::is_empty")]
    pub feature_flags: HashMap<String, bool>,
    /// Maintenance mode settings
    #[serde(default, skip_serializing_if = "Option::is_none")]
    pub maintenance: Option<MaintenanceConfig>,
}

/// Maintenance mode configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MaintenanceConfig {
    /// Whether maintenance mode is enabled
    pub enabled: bool,
    /// Optional message to display during maintenance
    #[serde(skip_serializing_if = "Option::is_none")]
    pub message: Option<String>,
    /// Optional end time (ISO 8601 format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub end_time: Option<String>,
}

// ============================================================================
// Admin API Response Types
// ============================================================================

/// Admin response wrapper showing ETL data + enrichment status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminCurrencyResponse {
    /// Currency ticker
    pub ticker: String,
    /// On-chain denom
    pub denom: String,
    /// Decimal places
    pub decimals: u8,
    /// Data source indicator
    #[serde(rename = "_source")]
    pub source: String,
    /// Enrichment data and status
    pub enrichment: CurrencyEnrichmentStatus,
}

/// Enrichment status for a currency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyEnrichmentStatus {
    /// Icon URL (null if not configured)
    pub icon: Option<String>,
    /// Display name (null if not configured)
    #[serde(rename = "displayName")]
    pub display_name: Option<String>,
    /// Short name
    #[serde(rename = "shortName")]
    pub short_name: Option<String>,
    /// Theme color
    pub color: Option<String>,
    /// CoinGecko ID
    #[serde(rename = "coingeckoId")]
    pub coingecko_id: Option<String>,
    /// Whether this currency is fully configured
    #[serde(rename = "_configured")]
    pub configured: bool,
}

/// Admin response wrapper showing ETL protocol + readiness status
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminProtocolResponse {
    /// Protocol identifier (e.g., "OSMOSIS-OSMOSIS-USDC_NOBLE")
    pub protocol: String,
    /// Network this protocol operates on
    pub network: String,
    /// DEX name
    pub dex: String,
    /// LPN (Liquidity Pool Native) currency
    pub lpn: String,
    /// Data source indicator
    #[serde(rename = "_source")]
    pub source: String,
    /// Readiness status
    pub status: ProtocolReadinessStatus,
}

/// Readiness status for a protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolReadinessStatus {
    /// Whether the network is configured
    pub network_configured: bool,
    /// Whether the LPN currency is configured
    pub lpn_configured: bool,
    /// List of currencies that are missing configuration
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub missing_currencies: Vec<String>,
    /// Overall readiness (network + LPN + all currencies configured)
    #[serde(rename = "_ready")]
    pub ready: bool,
}

/// Admin response for network configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AdminNetworkResponse {
    /// Network key (e.g., "OSMOSIS")
    pub network: String,
    /// Data source indicator
    #[serde(rename = "_source")]
    pub source: String,
    /// Configuration status
    pub config: NetworkConfigStatus,
}

/// Configuration status for a network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfigStatus {
    /// Display name
    pub name: Option<String>,
    /// Chain ID
    pub chain_id: Option<String>,
    /// RPC endpoint
    pub rpc: Option<String>,
    /// LCD endpoint
    pub lcd: Option<String>,
    /// Gas price
    pub gas_price: Option<String>,
    /// Primary protocol for price deduplication
    pub primary_protocol: Option<String>,
    /// Whether this network is fully configured
    #[serde(rename = "_configured")]
    pub configured: bool,
}

/// Summary of unconfigured items
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct UnconfiguredSummary {
    /// Currencies from ETL without display config
    pub currencies: Vec<String>,
    /// Networks from ETL without full config
    pub networks: Vec<String>,
    /// Protocols not ready (missing network or currency config)
    pub protocols: Vec<String>,
}

// ============================================================================
// Input Types for Admin API
// ============================================================================

/// Input for upserting a currency display config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyDisplayInput {
    /// Icon URL or path
    pub icon: String,
    /// Display name shown in UI
    #[serde(rename = "displayName")]
    pub display_name: String,
    /// Short name/ticker for display
    #[serde(rename = "shortName", skip_serializing_if = "Option::is_none")]
    pub short_name: Option<String>,
    /// Theme color (hex format)
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
    /// CoinGecko ID for price data
    #[serde(rename = "coingeckoId", skip_serializing_if = "Option::is_none")]
    pub coingecko_id: Option<String>,
}

impl From<CurrencyDisplayInput> for CurrencyDisplay {
    fn from(input: CurrencyDisplayInput) -> Self {
        CurrencyDisplay {
            icon: input.icon,
            display_name: input.display_name,
            short_name: input.short_name,
            color: input.color,
            coingecko_id: input.coingecko_id,
        }
    }
}

/// Input for upserting a network config
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkSettingsInput {
    /// Display name
    pub name: String,
    /// Chain ID
    pub chain_id: String,
    /// Address prefix
    pub prefix: String,
    /// Primary RPC endpoint
    pub rpc: String,
    /// Primary LCD/REST endpoint
    pub lcd: String,
    /// Fallback RPC endpoints
    #[serde(default)]
    pub fallback_rpc: Vec<String>,
    /// Fallback LCD endpoints
    #[serde(default)]
    pub fallback_lcd: Vec<String>,
    /// Gas price with denom
    pub gas_price: String,
    /// Block explorer URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explorer: Option<String>,
    /// Network icon path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Primary protocol for price deduplication
    #[serde(rename = "primaryProtocol", skip_serializing_if = "Option::is_none")]
    pub primary_protocol: Option<String>,
    /// Estimated transaction time in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
    /// Whether to use packet forwarding
    #[serde(skip_serializing_if = "Option::is_none")]
    pub forward: Option<bool>,
    /// Gas multiplier for fee estimation
    pub gas_multiplier: f64,
}

impl From<NetworkSettingsInput> for NetworkSettings {
    fn from(input: NetworkSettingsInput) -> Self {
        NetworkSettings {
            name: input.name,
            chain_id: input.chain_id,
            prefix: input.prefix,
            rpc: input.rpc,
            lcd: input.lcd,
            fallback_rpc: input.fallback_rpc,
            fallback_lcd: input.fallback_lcd,
            gas_price: input.gas_price,
            explorer: input.explorer,
            icon: input.icon,
            primary_protocol: input.primary_protocol,
            estimation: input.estimation,
            forward: input.forward,
            gas_multiplier: input.gas_multiplier,
            swap_venue: None,
            pools: HashMap::new(),
        }
    }
}

/// Input for upserting downpayment ranges for a protocol
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownpaymentRangesInput {
    /// Map of asset ticker to downpayment range
    #[serde(flatten)]
    pub ranges: HashMap<String, DownpaymentRange>,
}

/// Input for adding/removing a hidden proposal
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HiddenProposalInput {
    /// Proposal ID to hide/unhide
    pub proposal_id: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_currency_display_is_configured() {
        let configured = CurrencyDisplay {
            icon: "/icons/atom.svg".to_string(),
            display_name: "Cosmos Hub".to_string(),
            short_name: Some("ATOM".to_string()),
            color: None,
            coingecko_id: Some("cosmos".to_string()),
        };
        assert!(configured.is_configured());

        let unconfigured_no_icon = CurrencyDisplay {
            icon: "".to_string(),
            display_name: "Cosmos Hub".to_string(),
            short_name: None,
            color: None,
            coingecko_id: None,
        };
        assert!(!unconfigured_no_icon.is_configured());

        let unconfigured_no_name = CurrencyDisplay {
            icon: "/icons/atom.svg".to_string(),
            display_name: "".to_string(),
            short_name: None,
            color: None,
            coingecko_id: None,
        };
        assert!(!unconfigured_no_name.is_configured());
    }

    #[test]
    fn test_network_settings_is_configured() {
        let configured = NetworkSettings {
            name: "Osmosis".to_string(),
            chain_id: "osmosis-1".to_string(),
            prefix: "osmo".to_string(),
            rpc: "https://rpc.osmosis.zone".to_string(),
            lcd: "https://lcd.osmosis.zone".to_string(),
            fallback_rpc: vec![],
            fallback_lcd: vec![],
            gas_price: "0.025uosmo".to_string(),
            explorer: Some("https://mintscan.io/osmosis".to_string()),
            icon: None,
            primary_protocol: Some("OSMOSIS-OSMOSIS-USDC_NOBLE".to_string()),
            estimation: Some(20),
            forward: None,
            gas_multiplier: 3.5,
            swap_venue: None,
            pools: HashMap::new(),
        };
        assert!(configured.is_configured());

        let unconfigured_no_rpc = NetworkSettings {
            name: "Osmosis".to_string(),
            chain_id: "osmosis-1".to_string(),
            prefix: "osmo".to_string(),
            rpc: "".to_string(),
            lcd: "https://lcd.osmosis.zone".to_string(),
            fallback_rpc: vec![],
            fallback_lcd: vec![],
            gas_price: "0.025uosmo".to_string(),
            explorer: None,
            icon: None,
            primary_protocol: None,
            estimation: None,
            forward: None,
            gas_multiplier: 3.5,
            swap_venue: None,
            pools: HashMap::new(),
        };
        assert!(!unconfigured_no_rpc.is_configured());
    }

    #[test]
    fn test_currency_display_config_serialization() {
        let config = CurrencyDisplayConfig {
            currencies: HashMap::from([(
                "ATOM".to_string(),
                CurrencyDisplay {
                    icon: "/icons/atom.svg".to_string(),
                    display_name: "Cosmos Hub".to_string(),
                    short_name: Some("ATOM".to_string()),
                    color: Some("#6F7390".to_string()),
                    coingecko_id: Some("cosmos".to_string()),
                },
            )]),
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        assert!(json.contains("ATOM"));
        assert!(json.contains("Cosmos Hub"));

        let deserialized: CurrencyDisplayConfig = serde_json::from_str(&json).unwrap();
        assert!(deserialized.currencies.contains_key("ATOM"));
    }

    #[test]
    fn test_lease_rules_config_serialization() {
        let config = LeaseRulesConfig {
            downpayment_ranges: HashMap::from([(
                "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
                HashMap::from([(
                    "ATOM".to_string(),
                    DownpaymentRange {
                        min: 40.0,
                        max: 5000.0,
                    },
                )]),
            )]),
            asset_restrictions: AssetRestrictions {
                ignore_all: vec!["DEPRECATED_TOKEN".to_string()],
                ignore_long: vec![],
                ignore_short: vec![],
                free_interest: vec!["SPECIAL_TOKEN".to_string()],
            },
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        let deserialized: LeaseRulesConfig = serde_json::from_str(&json).unwrap();
        assert!(deserialized
            .downpayment_ranges
            .contains_key("OSMOSIS-OSMOSIS-USDC_NOBLE"));
        assert_eq!(deserialized.asset_restrictions.ignore_all.len(), 1);
    }
}
