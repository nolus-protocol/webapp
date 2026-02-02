//! Configuration type definitions
//!
//! These types match the JSON schemas from the frontend config files.

use serde::{Deserialize, Serialize};
use std::collections::HashMap;

// ============================================================================
// Currencies Configuration
// ============================================================================

/// Full currencies configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrenciesConfig {
    /// Base URL for currency icons
    pub icons: String,
    /// Currency definitions keyed by ticker
    pub currencies: HashMap<String, CurrencyInfo>,
    /// Currency mapping (FROM@PROTOCOL -> TO@PROTOCOL)
    #[serde(default)]
    pub map: HashMap<String, String>,
}

/// Individual currency information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyInfo {
    /// Full name (e.g., "Cosmos Hub")
    pub name: String,
    /// Short display name (e.g., "ATOM")
    #[serde(rename = "shortName")]
    pub short_name: String,
    /// CoinGecko identifier for price data
    #[serde(rename = "coinGeckoId")]
    pub coin_gecko_id: String,
    /// On-chain symbol/denom
    pub symbol: String,
}

// ============================================================================
// Chain IDs Configuration
// ============================================================================

/// Chain ID mappings for cosmos and EVM networks
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ChainIdsConfig {
    /// Cosmos chain IDs (NETWORK_NAME -> chain-id)
    pub cosmos: HashMap<String, String>,
    /// EVM chain IDs (NETWORK_NAME -> chain-id as string)
    pub evm: HashMap<String, String>,
}

// ============================================================================
// Networks Configuration
// ============================================================================

/// Networks configuration with chain details
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworksConfig {
    /// Network configurations keyed by network key (e.g., "nolus", "osmosis")
    pub networks: HashMap<String, NetworkConfig>,
    /// Native asset configuration for the primary chain
    pub native_asset: NativeAssetConfig,
}

/// Individual network configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfig {
    /// Display name (e.g., "Nolus", "Osmosis")
    pub name: String,
    /// Chain ID (e.g., "pirin-1", "osmosis-1")
    pub chain_id: String,
    /// Address prefix (e.g., "nolus", "osmo")
    pub prefix: String,
    /// Native denomination (e.g., "unls", "uosmo")
    pub native_denom: String,
    /// Gas price with denom (e.g., "0.0025unls")
    pub gas_price: String,
    /// Block explorer URL
    pub explorer: String,
    /// Decimal digits for native token
    #[serde(default = "default_decimal_digits")]
    pub decimal_digits: u8,
}

/// Native asset configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NativeAssetConfig {
    /// Ticker symbol (e.g., "NLS")
    pub ticker: String,
    /// Display symbol (e.g., "NLS")
    pub symbol: String,
    /// On-chain denomination (e.g., "unls")
    pub denom: String,
    /// Decimal digits
    pub decimal_digits: u8,
}

fn default_decimal_digits() -> u8 {
    6
}

// ============================================================================
// Network Endpoints Configuration
// ============================================================================

/// Network endpoints for a specific environment (pirin/rila/evm)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkEndpointsConfig {
    /// Downtime threshold in seconds
    #[serde(default = "default_downtime")]
    pub downtime: u32,
    /// Archive node RPC URL
    #[serde(default)]
    pub archive_node_rpc: Option<String>,
    /// Archive node API/LCD URL
    #[serde(default)]
    pub archive_node_api: Option<String>,
    /// Network-specific endpoints
    #[serde(flatten)]
    pub networks: HashMap<String, NetworkNode>,
}

fn default_downtime() -> u32 {
    30
}

/// Endpoints for a specific network
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkNode {
    /// Primary endpoint
    pub primary: EndpointPair,
    /// Fallback endpoints
    #[serde(default)]
    pub fallback: Vec<EndpointPair>,
}

/// RPC and API endpoint pair
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointPair {
    /// RPC endpoint URL
    pub rpc: String,
    /// API/LCD endpoint URL (optional for EVM)
    #[serde(default)]
    pub api: Option<String>,
}

// ============================================================================
// Lease Configuration
// ============================================================================

/// Downpayment ranges for all protocols
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownpaymentRangesConfig {
    /// Ranges keyed by protocol, then by asset ticker
    #[serde(flatten)]
    pub protocols: HashMap<String, HashMap<String, DownpaymentRange>>,
}

/// Min/max downpayment range for an asset
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DownpaymentRange {
    /// Minimum downpayment value
    pub min: f64,
    /// Maximum downpayment value
    pub max: f64,
}

/// Simple string array config (for ignore lists)
#[derive(Debug, Clone, Default, Serialize, Deserialize)]
#[serde(transparent)]
pub struct StringArrayConfig(pub Vec<String>);

/// Due projection configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct DueProjectionConfig {
    /// Projection timeout in seconds
    pub due_projection_secs: u32,
}

// ============================================================================
// Zero Interest Configuration
// ============================================================================

/// Zero interest payment addresses
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ZeroInterestConfig {
    /// List of addresses that receive zero interest payments
    pub interest_paid_to: Vec<String>,
}

// ============================================================================
// Skip Route Configuration
// ============================================================================

/// Skip API routing configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SkipRouteConfig {
    /// Skip API base URL
    pub api_url: String,
    /// Blacklisted assets/denoms
    #[serde(default)]
    pub blacklist: Vec<String>,
    /// Slippage tolerance percentage
    #[serde(default = "default_slippage")]
    pub slippage: u32,
    /// Swap currency for Osmosis
    #[serde(default)]
    pub swap_currency_osmosis: Option<String>,
    /// Swap currency for Neutron
    #[serde(default)]
    pub swap_currency_neutron: Option<String>,
    /// Target swap currency
    #[serde(default)]
    pub swap_to_currency: Option<String>,
    /// Gas multiplier
    #[serde(default = "default_gas_multiplier")]
    pub gas_multiplier: u32,
    /// Base fee in basis points
    #[serde(default = "default_fee")]
    pub fee: u32,
    /// Timeout in seconds
    #[serde(rename = "timeoutSeconds", default = "default_timeout")]
    pub timeout_seconds: String,
    /// Osmosis pool manager address
    #[serde(rename = "osmosis-poolmanager", default)]
    pub osmosis_poolmanager: Option<String>,
    /// Neutron Astroport address
    #[serde(rename = "neutron-astroport", default)]
    pub neutron_astroport: Option<String>,
    /// Swap venues
    #[serde(default)]
    pub swap_venues: Vec<SwapVenue>,
    /// Transfer configurations per chain
    #[serde(default)]
    pub transfers: HashMap<String, TransferConfig>,
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

/// Swap venue configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapVenue {
    /// Venue name
    pub name: String,
    /// Chain ID
    pub chain_id: String,
}

/// Transfer configuration for a chain
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TransferConfig {
    /// Currency transfer routes
    pub currencies: Vec<CurrencyTransfer>,
}

/// Individual currency transfer route
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyTransfer {
    /// Source denom
    pub from: String,
    /// Destination denom
    pub to: String,
    /// Visible network (optional - only used by some chains like EVM bridges)
    #[serde(default)]
    pub visible: Option<String>,
}

// ============================================================================
// Governance Configuration
// ============================================================================

/// Governance proposals configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProposalsConfig {
    /// Proposal IDs to hide from display
    #[serde(default)]
    pub hide: Vec<String>,
}

// ============================================================================
// History Configuration
// ============================================================================

/// History currencies with extended metadata
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryCurrenciesConfig {
    #[serde(flatten)]
    pub currencies: HashMap<String, HistoryCurrency>,
}

/// Extended currency info for history display
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryCurrency {
    /// Full name
    pub name: String,
    /// On-chain symbol
    pub symbol: String,
    /// Ticker code
    pub ticker: String,
    /// Decimal places
    pub decimal_digits: u32,
    /// Icon URL
    pub icon: String,
    /// Short display name
    #[serde(rename = "shortName")]
    pub short_name: String,
    /// Whether this is a native token
    pub native: bool,
    /// CoinGecko ID
    #[serde(rename = "coingeckoId", default)]
    pub coingecko_id: Option<String>,
    /// Protocol-specific IBC data
    #[serde(default)]
    pub protocols: HashMap<String, ProtocolIbcData>,
}

/// Protocol-specific IBC data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolIbcData {
    /// IBC denom or hash
    #[serde(rename = "ibcData")]
    pub ibc_data: String,
}

/// History protocols configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryProtocolsConfig {
    #[serde(flatten)]
    pub protocols: HashMap<String, HistoryProtocol>,
}

/// Protocol info for history
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct HistoryProtocol {
    /// Contract address
    pub contract: String,
    /// LPN currency
    pub lpn: String,
}

// ============================================================================
// Full Webapp Configuration (combined)
// ============================================================================

/// Complete webapp configuration - returned by GET /api/config/full
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FullWebappConfig {
    pub currencies: CurrenciesConfig,
    pub chain_ids: ChainIdsConfig,
    pub networks: NetworksConfig,
    pub endpoints: EndpointsCollection,
    pub lease: LeaseConfig,
    pub zero_interest: ZeroInterestConfig,
    pub skip_route: SkipRouteConfig,
    pub governance: ProposalsConfig,
    pub history_currencies: HistoryCurrenciesConfig,
    pub history_protocols: HistoryProtocolsConfig,
}

/// All endpoint configurations
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EndpointsCollection {
    pub pirin: NetworkEndpointsConfig,
    pub rila: NetworkEndpointsConfig,
    pub evm: NetworkEndpointsConfig,
}

/// All lease-related configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseConfig {
    pub downpayment_ranges: DownpaymentRangesConfig,
    pub ignore_assets: StringArrayConfig,
    pub ignore_lease_long: StringArrayConfig,
    pub ignore_lease_short: StringArrayConfig,
    pub free_interest_assets: StringArrayConfig,
    pub due_projection: DueProjectionConfig,
}

// ============================================================================
// Locale Configuration
// ============================================================================

/// List of available locales
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalesListResponse {
    /// Available locale codes
    pub available: Vec<String>,
    /// Default locale code
    pub default: String,
}

impl Default for LocalesListResponse {
    fn default() -> Self {
        Self {
            available: vec![
                "en".to_string(),
                "ru".to_string(),
                "cn".to_string(),
                "fr".to_string(),
                "es".to_string(),
                "gr".to_string(),
                "tr".to_string(),
                "id".to_string(),
                "jp".to_string(),
                "kr".to_string(),
            ],
            default: "en".to_string(),
        }
    }
}
