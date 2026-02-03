//! Database models matching PostgreSQL schema.
//!
//! These structs represent admin-provided enrichment data stored in the database.

use chrono::{DateTime, Utc};
use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};

/// Currency display enrichment (admin-provided visual metadata).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct CurrencyDisplay {
    pub ticker: String,
    pub icon_url: String,
    pub color: Option<String>,
    pub display_name: String,
    pub coingecko_id: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input for creating/updating currency display.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyDisplayInput {
    pub ticker: String,
    pub icon_url: String,
    pub color: Option<String>,
    pub display_name: String,
    pub coingecko_id: Option<String>,
}

/// Network configuration (admin-provided infrastructure config).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NetworkConfig {
    pub network_key: String,
    pub explorer_url: String,
    pub gas_price: Decimal,
    pub gas_multiplier: Decimal,
    pub primary_protocol: Option<String>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input for creating/updating network config.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkConfigInput {
    pub network_key: String,
    pub explorer_url: String,
    pub gas_price: Decimal,
    pub gas_multiplier: Option<Decimal>,
    pub primary_protocol: Option<String>,
}

/// Network endpoint (RPC/LCD URL).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct NetworkEndpoint {
    pub id: i32,
    pub network_key: String,
    pub endpoint_type: String,
    pub url: String,
    pub priority: i32,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Input for creating network endpoint.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct NetworkEndpointInput {
    pub network_key: String,
    pub endpoint_type: String,
    pub url: String,
    pub priority: Option<i32>,
}

/// Asset restriction (blacklist or disabled asset).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct AssetRestriction {
    pub id: i32,
    pub ticker: String,
    pub restriction_type: String,
    pub reason: Option<String>,
    pub created_at: DateTime<Utc>,
}

/// Input for creating asset restriction.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AssetRestrictionInput {
    pub ticker: String,
    pub restriction_type: String,
    pub reason: Option<String>,
}

/// Restriction type constants.
pub mod restriction_types {
    pub const IGNORED: &str = "ignored";
    pub const DISABLED_LONG: &str = "disabled_long";
    pub const DISABLED_SHORT: &str = "disabled_short";
    pub const SWAP_BLACKLIST: &str = "swap_blacklist";
    pub const TRANSFER_BLACKLIST: &str = "transfer_blacklist";
}

/// Lease downpayment range (per protocol, per asset).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct LeaseDownpaymentRange {
    pub id: i32,
    pub protocol: String,
    pub asset_ticker: String,
    pub min_amount: Decimal,
    pub max_amount: Decimal,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input for creating/updating downpayment range.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LeaseDownpaymentRangeInput {
    pub protocol: String,
    pub asset_ticker: String,
    pub min_amount: Decimal,
    pub max_amount: Decimal,
}

/// Protocol status.
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct ProtocolStatus {
    pub protocol: String,
    pub status: String,
    pub reason: Option<String>,
    pub configured_at: Option<DateTime<Utc>>,
    pub created_at: DateTime<Utc>,
    pub updated_at: DateTime<Utc>,
}

/// Input for updating protocol status.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProtocolStatusInput {
    pub protocol: String,
    pub status: String,
    pub reason: Option<String>,
}

/// Protocol status constants.
pub mod protocol_statuses {
    pub const CONFIGURED: &str = "configured";
    pub const BLACKLISTED: &str = "blacklisted";
    pub const UNCONFIGURED: &str = "unconfigured";
}

/// Swap configuration entry (key-value).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SwapConfigEntry {
    pub key: String,
    pub value: String,
    pub updated_at: DateTime<Utc>,
}

/// Swap venue (DEX address).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct SwapVenue {
    pub id: i32,
    pub name: String,
    pub chain_id: String,
    pub address: String,
    pub is_active: bool,
    pub created_at: DateTime<Utc>,
}

/// Input for creating swap venue.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapVenueInput {
    pub name: String,
    pub chain_id: String,
    pub address: String,
}

/// UI settings entry (key-value with JSON).
#[derive(Debug, Clone, Serialize, Deserialize, sqlx::FromRow)]
pub struct UiSettingsEntry {
    pub key: String,
    pub value: serde_json::Value,
    pub updated_at: DateTime<Utc>,
}
