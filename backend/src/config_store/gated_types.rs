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

use serde::{Deserialize, Deserializer, Serialize};
use std::collections::HashMap;
use std::sync::LazyLock;

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

/// The kind of chain a network runs on. Serialized as the `chain_type` tag.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "lowercase")]
pub enum ChainType {
    Cosmos,
    Svm,
}

impl ChainType {
    /// Lowercase tag string as it appears on the wire.
    pub const fn as_str(self) -> &'static str {
        match self {
            Self::Cosmos => "cosmos",
            Self::Svm => "svm",
        }
    }
}

/// Cosmos-SDK network settings.
/// A cosmos network is "configured" when it has RPC + LCD + gas_price.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CosmosNetworkSettings {
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

/// SVM (Solana) network settings.
/// An svm network is "configured" when it has RPC + program_id + transfer_channel_id.
/// The RPC is backend-internal and must never reach a public surface.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvmNetworkSettings {
    /// Display name (e.g., "Solana")
    pub name: String,
    /// Chain ID (e.g., "solana")
    pub chain_id: String,
    /// Backend-internal RPC endpoint (required). Never serialized to public surfaces.
    pub rpc: String,
    /// On-chain program id (required)
    pub program_id: String,
    /// IBC transfer channel id (required)
    pub transfer_channel_id: String,
    /// Explorer URL pattern with a `{txHash}` placeholder
    pub explorer_url_pattern: String,
    /// Network ticker symbol (e.g., "SOL")
    pub symbol: String,
    /// Gas multiplier for fee estimation
    pub gas_multiplier: f64,
    /// Network icon path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Estimated transaction time in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
}

/// Settings for a single network, tagged by `chain_type`.
///
/// Serialization writes an explicit `chain_type` for every variant. A missing
/// `chain_type` on deserialization defaults to `cosmos` (back-compat with the
/// shipped tag-less `network-config.json`).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "chain_type", rename_all = "lowercase")]
pub enum NetworkSettings {
    Cosmos(CosmosNetworkSettings),
    Svm(SvmNetworkSettings),
}

/// Read the optional `chain_type` tag from a JSON object, defaulting to cosmos.
fn chain_type_from_value(value: &serde_json::Value) -> Result<ChainType, serde_json::Error> {
    value
        .get("chain_type")
        .map_or(Ok(ChainType::Cosmos), ChainType::deserialize)
}

// serde has no default-variant support for internally-tagged enums, so the
// tag-defaulting deserialization is hand-written.
impl<'de> Deserialize<'de> for NetworkSettings {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        chain_type_from_value(&value)
            .and_then(|chain_type| match chain_type {
                ChainType::Cosmos => CosmosNetworkSettings::deserialize(&value).map(Self::Cosmos),
                ChainType::Svm => SvmNetworkSettings::deserialize(&value).map(Self::Svm),
            })
            .map_err(serde::de::Error::custom)
    }
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

/// Shared empty pool map returned by `NetworkSettings::pools` for svm variants,
/// so cosmos-only consumers iterate a mixed map without special-casing.
static EMPTY_POOLS: LazyLock<HashMap<String, PoolConfig>> = LazyLock::new(HashMap::new);

impl NetworkSettings {
    /// The chain kind of this network.
    pub fn chain_type(&self) -> ChainType {
        match self {
            Self::Cosmos(_) => ChainType::Cosmos,
            Self::Svm(_) => ChainType::Svm,
        }
    }

    /// Whether this network has the minimum required fields to be "configured",
    /// evaluated per variant.
    pub fn is_configured(&self) -> bool {
        match self {
            Self::Cosmos(cosmos) => {
                !cosmos.rpc.is_empty() && !cosmos.lcd.is_empty() && !cosmos.gas_price.is_empty()
            }
            Self::Svm(svm) => {
                !svm.rpc.is_empty()
                    && !svm.program_id.is_empty()
                    && !svm.transfer_channel_id.is_empty()
            }
        }
    }

    /// Display name.
    pub fn name(&self) -> &str {
        match self {
            Self::Cosmos(cosmos) => &cosmos.name,
            Self::Svm(svm) => &svm.name,
        }
    }

    /// Chain ID.
    pub fn chain_id(&self) -> &str {
        match self {
            Self::Cosmos(cosmos) => &cosmos.chain_id,
            Self::Svm(svm) => &svm.chain_id,
        }
    }

    /// Gas multiplier for fee estimation.
    pub fn gas_multiplier(&self) -> f64 {
        match self {
            Self::Cosmos(cosmos) => cosmos.gas_multiplier,
            Self::Svm(svm) => svm.gas_multiplier,
        }
    }

    /// Primary protocol for price deduplication; svm networks have none.
    pub fn primary_protocol(&self) -> Option<&str> {
        match self {
            Self::Cosmos(cosmos) => cosmos.primary_protocol.as_deref(),
            Self::Svm(_) => None,
        }
    }

    /// Swap venue (DEX) for this network; svm networks have none.
    pub fn swap_venue(&self) -> Option<&NetworkSwapVenue> {
        match self {
            Self::Cosmos(cosmos) => cosmos.swap_venue.as_ref(),
            Self::Svm(_) => None,
        }
    }

    /// Pool-specific configurations; svm networks have none.
    pub fn pools(&self) -> &HashMap<String, PoolConfig> {
        match self {
            Self::Cosmos(cosmos) => &cosmos.pools,
            Self::Svm(_) => LazyLock::force(&EMPTY_POOLS),
        }
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
    /// Seconds into the future to project due interest/margin when querying lease state.
    /// The lease contract returns projected interest accrued up to (now + this value),
    /// giving users a more accurate picture of what they'll owe at repayment time.
    #[serde(default = "default_due_projection_secs")]
    pub due_projection_secs: u64,
}

fn default_due_projection_secs() -> u64 {
    400
}

/// Downpayment range for an asset
#[derive(Debug, Clone, Serialize, Deserialize, utoipa::ToSchema)]
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
    /// Enable Go Fast transfers
    #[serde(default = "default_bool_true")]
    pub go_fast: bool,
    /// Enable smart relay
    #[serde(default = "default_bool_true")]
    pub smart_relay: bool,
    /// Allow multi-transaction routes
    #[serde(default = "default_bool_true")]
    pub allow_multi_tx: bool,
    /// Allow routes with poor execution quality
    #[serde(default = "default_bool_true")]
    pub allow_unsafe: bool,
    /// Bridge protocols to use (e.g., ["IBC"])
    #[serde(default = "default_bridges")]
    pub bridges: Vec<String>,
    /// Experimental protocol features (e.g., ["stargate", "eureka"])
    #[serde(default = "default_experimental_features")]
    pub experimental_features: Vec<String>,
    /// Smart swap options for route optimization
    #[serde(default)]
    pub smart_swap_options: SmartSwapOptions,
}

/// Smart swap route optimization options
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SmartSwapOptions {
    /// Enable route splitting for better pricing
    #[serde(default = "default_bool_true")]
    pub split_routes: bool,
    /// Enable EVM swaps on supported networks
    #[serde(default = "default_bool_true")]
    pub evm_swaps: bool,
}

impl Default for SmartSwapOptions {
    fn default() -> Self {
        Self {
            split_routes: true,
            evm_swaps: true,
        }
    }
}

fn default_bool_true() -> bool {
    true
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

fn default_bridges() -> Vec<String> {
    vec!["IBC".to_string()]
}

fn default_experimental_features() -> Vec<String> {
    vec!["stargate".to_string(), "eureka".to_string()]
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
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
pub struct NetworkConfigStatus {
    /// Display name
    pub name: Option<String>,
    /// Chain ID
    pub chain_id: Option<String>,
    /// RPC endpoint
    pub rpc: Option<String>,
    /// LCD endpoint (cosmos only)
    pub lcd: Option<String>,
    /// Gas price (cosmos only)
    pub gas_price: Option<String>,
    /// Primary protocol for price deduplication (cosmos only)
    pub primary_protocol: Option<String>,
    /// Whether this network is fully configured
    #[serde(rename = "_configured")]
    pub configured: bool,
}

impl NetworkConfigStatus {
    /// Build a status view from a configured network's settings, variant-aware:
    /// svm networks have no lcd / gas_price / primary_protocol, so those stay `None`.
    pub fn from_settings(settings: &NetworkSettings) -> Self {
        match settings {
            NetworkSettings::Cosmos(cosmos) => Self {
                name: Some(cosmos.name.clone()),
                chain_id: Some(cosmos.chain_id.clone()),
                rpc: Some(cosmos.rpc.clone()),
                lcd: Some(cosmos.lcd.clone()),
                gas_price: Some(cosmos.gas_price.clone()),
                primary_protocol: cosmos.primary_protocol.clone(),
                configured: settings.is_configured(),
            },
            NetworkSettings::Svm(svm) => Self {
                name: Some(svm.name.clone()),
                chain_id: Some(svm.chain_id.clone()),
                rpc: Some(svm.rpc.clone()),
                lcd: None,
                gas_price: None,
                primary_protocol: None,
                configured: settings.is_configured(),
            },
        }
    }
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

/// Cosmos-SDK network admin input.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CosmosNetworkInput {
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

/// SVM (Solana) network admin input.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SvmNetworkInput {
    /// Display name
    pub name: String,
    /// Chain ID
    pub chain_id: String,
    /// Backend-internal RPC endpoint
    pub rpc: String,
    /// On-chain program id
    pub program_id: String,
    /// IBC transfer channel id
    pub transfer_channel_id: String,
    /// Explorer URL pattern with a `{txHash}` placeholder
    pub explorer_url_pattern: String,
    /// Network ticker symbol
    pub symbol: String,
    /// Gas multiplier for fee estimation
    pub gas_multiplier: f64,
    /// Network icon path
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Estimated transaction time in seconds
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
}

/// Input for upserting a network config, tagged by `chain_type` (default cosmos).
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "chain_type", rename_all = "lowercase")]
pub enum NetworkSettingsInput {
    Cosmos(CosmosNetworkInput),
    Svm(SvmNetworkInput),
}

impl<'de> Deserialize<'de> for NetworkSettingsInput {
    fn deserialize<D>(deserializer: D) -> Result<Self, D::Error>
    where
        D: Deserializer<'de>,
    {
        let value = serde_json::Value::deserialize(deserializer)?;
        chain_type_from_value(&value)
            .and_then(|chain_type| match chain_type {
                ChainType::Cosmos => CosmosNetworkInput::deserialize(&value).map(Self::Cosmos),
                ChainType::Svm => SvmNetworkInput::deserialize(&value).map(Self::Svm),
            })
            .map_err(serde::de::Error::custom)
    }
}

impl From<NetworkSettingsInput> for NetworkSettings {
    fn from(input: NetworkSettingsInput) -> Self {
        match input {
            NetworkSettingsInput::Cosmos(cosmos) => Self::Cosmos(CosmosNetworkSettings {
                name: cosmos.name,
                chain_id: cosmos.chain_id,
                prefix: cosmos.prefix,
                rpc: cosmos.rpc,
                lcd: cosmos.lcd,
                fallback_rpc: cosmos.fallback_rpc,
                fallback_lcd: cosmos.fallback_lcd,
                gas_price: cosmos.gas_price,
                explorer: cosmos.explorer,
                icon: cosmos.icon,
                primary_protocol: cosmos.primary_protocol,
                estimation: cosmos.estimation,
                forward: cosmos.forward,
                swap_venue: None,
                gas_multiplier: cosmos.gas_multiplier,
                pools: HashMap::new(),
            }),
            NetworkSettingsInput::Svm(svm) => Self::Svm(SvmNetworkSettings {
                name: svm.name,
                chain_id: svm.chain_id,
                rpc: svm.rpc,
                program_id: svm.program_id,
                transfer_channel_id: svm.transfer_channel_id,
                explorer_url_pattern: svm.explorer_url_pattern,
                symbol: svm.symbol,
                gas_multiplier: svm.gas_multiplier,
                icon: svm.icon,
                estimation: svm.estimation,
            }),
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
        let configured = NetworkSettings::Cosmos(CosmosNetworkSettings {
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
        });
        assert!(configured.is_configured());

        let unconfigured_no_rpc = NetworkSettings::Cosmos(CosmosNetworkSettings {
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
        });
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
            },
            due_projection_secs: 400,
        };

        let json = serde_json::to_string_pretty(&config).unwrap();
        let deserialized: LeaseRulesConfig = serde_json::from_str(&json).unwrap();
        assert!(deserialized
            .downpayment_ranges
            .contains_key("OSMOSIS-OSMOSIS-USDC_NOBLE"));
        assert_eq!(deserialized.asset_restrictions.ignore_all.len(), 1);
        assert_eq!(deserialized.due_projection_secs, 400);
    }

    #[test]
    fn test_lease_rules_config_default_due_projection() {
        // Existing JSON without due_projection_secs should get the default of 400
        let json = r#"{"downpayment_ranges": {}, "asset_restrictions": {}}"#;
        let config: LeaseRulesConfig = serde_json::from_str(json).unwrap();
        assert_eq!(config.due_projection_secs, 400);
    }

    // Contract these tests pin for the svm ChainType + SOLANA network model.
    // `NetworkSettings` becomes
    // a tagged enum with a custom `Deserialize` that defaults a *missing*
    // `chain_type` to cosmos (back-compat), plus:
    //   * `enum ChainType { Cosmos, Svm }` — derives Debug + PartialEq (serde
    //     `rename_all = "lowercase"` so it maps to "cosmos" / "svm").
    //   * `NetworkSettings::chain_type(&self) -> ChainType`.
    //   * `NetworkSettings::is_configured(&self)` — per-variant completeness rule
    //     (cosmos: non-empty rpc + lcd + gas_price, byte-identical to today;
    //     svm: non-empty rpc + program_id + transfer_channel_id).
    //   * `NetworkSettings::swap_venue(&self) -> Option<&NetworkSwapVenue>` and
    //     `NetworkSettings::pools(&self) -> &HashMap<String, PoolConfig>` — svm
    //     returns None / empty so the cosmos-only consumers (swap.rs, earn.rs)
    //     iterate them without special-casing.
    //   * `Serialize` writes `chain_type` explicitly for every variant.
    //   * `NetworkSettingsInput` mirrors the same variants; `From` preserves them.
    //
    // Every construction goes through the serde seam (JSON) so the tests pin
    // OBSERVABLE behaviour, never the enum's internal field layout.

    const COSMOS_ENTRY_JSON: &str = r#"{
        "name": "Osmosis", "chain_id": "osmosis-1", "prefix": "osmo",
        "rpc": "https://rpc-osmosis.internal", "lcd": "https://lcd-osmosis.internal",
        "gas_price": "0.025uosmo", "gas_multiplier": 3.5,
        "swap_venue": { "name": "osmosis-poolmanager", "address": "osmo1venue" },
        "pools": { "OSMOSIS-OSMOSIS-USDC_NOBLE": { "icon": "/pools/usdc.svg" } }
    }"#;

    const SVM_ENTRY_JSON: &str = r#"{
        "chain_type": "svm",
        "name": "Solana", "chain_id": "solana",
        "rpc": "https://solana-rpc.internal-do-not-leak",
        "program_id": "NoLuSpRoGrAm1111111111111111111111111111111",
        "transfer_channel_id": "channel-0",
        "explorer_url_pattern": "https://solscan.io/tx/{txHash}",
        "symbol": "SOL", "icon": "/networks/solana.svg",
        "gas_multiplier": 1.0, "estimation": 5
    }"#;

    // back-compat deserialization of the shipped config file
    const REPO_NETWORK_CONFIG: &str = include_str!(concat!(
        env!("CARGO_MANIFEST_DIR"),
        "/config/gated/network-config.json"
    ));

    #[test]
    fn verbatim_network_config_loads_all_shipped_entries() {
        let config: GatedNetworkConfig = serde_json::from_str(REPO_NETWORK_CONFIG)
            .expect("shipped network-config.json (no chain_type) deserializes verbatim");
        let mut keys: Vec<&str> = config.networks.keys().map(String::as_str).collect();
        keys.sort_unstable();
        assert_eq!(keys, ["NEUTRON", "NOLUS", "OSMOSIS"]);
    }

    #[test]
    fn verbatim_network_config_entries_default_to_cosmos() {
        let config: GatedNetworkConfig = serde_json::from_str(REPO_NETWORK_CONFIG)
            .expect("shipped network-config.json deserializes verbatim");
        let all_cosmos = config
            .networks
            .values()
            .all(|s| s.chain_type() == ChainType::Cosmos);
        assert!(
            all_cosmos,
            "every entry in the chain_type-less shipped file must load as cosmos"
        );
    }

    // svm variant round-trip + required-field enforcement
    #[test]
    fn svm_entry_deserializes_as_svm_chain_type() {
        let settings: NetworkSettings = serde_json::from_str(SVM_ENTRY_JSON)
            .expect("svm entry with all required fields deserializes");
        assert_eq!(settings.chain_type(), ChainType::Svm);
    }

    #[test]
    fn svm_entry_missing_program_id_is_rejected() {
        let json = SVM_ENTRY_JSON.replace(
            "\"program_id\": \"NoLuSpRoGrAm1111111111111111111111111111111\",",
            "",
        );
        assert!(
            serde_json::from_str::<NetworkSettings>(&json).is_err(),
            "an svm entry without program_id must be rejected, not silently accepted"
        );
    }

    #[test]
    fn svm_entry_missing_transfer_channel_id_is_rejected() {
        let json = SVM_ENTRY_JSON.replace("\"transfer_channel_id\": \"channel-0\",", "");
        assert!(
            serde_json::from_str::<NetworkSettings>(&json).is_err(),
            "an svm entry without transfer_channel_id must be rejected"
        );
    }

    #[test]
    fn svm_entry_serialization_writes_chain_type_svm() {
        let settings: NetworkSettings =
            serde_json::from_str(SVM_ENTRY_JSON).expect("svm entry deserializes");
        let value = serde_json::to_value(&settings).expect("svm settings serialize");
        assert_eq!(
            value.get("chain_type"),
            Some(&serde_json::Value::from("svm"))
        );
    }

    #[test]
    fn cosmos_entry_serialization_writes_chain_type_cosmos() {
        let settings: NetworkSettings =
            serde_json::from_str(COSMOS_ENTRY_JSON).expect("cosmos entry deserializes");
        let value = serde_json::to_value(&settings).expect("cosmos settings serialize");
        assert_eq!(
            value.get("chain_type"),
            Some(&serde_json::Value::from("cosmos"))
        );
    }

    // is_configured() is per-variant
    #[test]
    fn cosmos_entry_with_endpoints_is_configured() {
        let settings: NetworkSettings =
            serde_json::from_str(COSMOS_ENTRY_JSON).expect("cosmos entry deserializes");
        assert!(settings.is_configured());
    }

    #[test]
    fn cosmos_entry_with_empty_rpc_is_not_configured() {
        let json = COSMOS_ENTRY_JSON.replace("https://rpc-osmosis.internal", "");
        let settings: NetworkSettings =
            serde_json::from_str(&json).expect("cosmos entry with empty rpc still deserializes");
        assert!(!settings.is_configured());
    }

    #[test]
    fn svm_entry_with_required_fields_is_configured() {
        let settings: NetworkSettings =
            serde_json::from_str(SVM_ENTRY_JSON).expect("svm entry deserializes");
        assert!(settings.is_configured());
    }

    #[test]
    fn svm_entry_with_empty_rpc_is_not_configured() {
        let json = SVM_ENTRY_JSON.replace("https://solana-rpc.internal-do-not-leak", "");
        let settings: NetworkSettings =
            serde_json::from_str(&json).expect("svm entry with empty rpc still deserializes");
        assert!(!settings.is_configured());
    }

    // svm entries expose no cosmos-only swap venue / pools
    #[test]
    fn svm_entry_exposes_no_swap_venue() {
        let settings: NetworkSettings =
            serde_json::from_str(SVM_ENTRY_JSON).expect("svm entry deserializes");
        assert!(settings.swap_venue().is_none());
    }

    #[test]
    fn svm_entry_exposes_no_pools() {
        let settings: NetworkSettings =
            serde_json::from_str(SVM_ENTRY_JSON).expect("svm entry deserializes");
        assert!(settings.pools().is_empty());
    }

    #[test]
    fn cosmos_entry_still_exposes_its_swap_venue() {
        let settings: NetworkSettings =
            serde_json::from_str(COSMOS_ENTRY_JSON).expect("cosmos entry deserializes");
        assert_eq!(
            settings.swap_venue().map(|v| v.name.as_str()),
            Some("osmosis-poolmanager")
        );
    }

    // admin NetworkSettingsInput round-trips both variants
    const COSMOS_INPUT_JSON: &str = r#"{
        "name": "Neutron", "chain_id": "neutron-1", "prefix": "neutron",
        "rpc": "https://rpc-neutron.internal", "lcd": "https://lcd-neutron.internal",
        "gas_price": "0.025untrn", "gas_multiplier": 2.5
    }"#;

    const SVM_INPUT_JSON: &str = r#"{
        "chain_type": "svm",
        "name": "Solana", "chain_id": "solana",
        "rpc": "https://solana-rpc.internal-do-not-leak",
        "program_id": "NoLuSpRoGrAm1111111111111111111111111111111",
        "transfer_channel_id": "channel-0",
        "explorer_url_pattern": "https://solscan.io/tx/{txHash}",
        "symbol": "SOL", "gas_multiplier": 1.0
    }"#;

    #[test]
    fn cosmos_network_input_converts_to_cosmos_settings() {
        let input: NetworkSettingsInput =
            serde_json::from_str(COSMOS_INPUT_JSON).expect("cosmos admin input deserializes");
        assert_eq!(NetworkSettings::from(input).chain_type(), ChainType::Cosmos);
    }

    #[test]
    fn svm_network_input_converts_to_svm_settings() {
        let input: NetworkSettingsInput =
            serde_json::from_str(SVM_INPUT_JSON).expect("svm admin input deserializes");
        assert_eq!(NetworkSettings::from(input).chain_type(), ChainType::Svm);
    }
}
