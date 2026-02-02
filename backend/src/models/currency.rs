use serde::{Deserialize, Serialize};

/// Represents a currency/asset in the system
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct Currency {
    /// Unique identifier (e.g., "ATOM", "OSMO", "NLS")
    pub key: String,
    /// Display symbol
    pub symbol: String,
    /// Full name
    pub name: String,
    /// Decimal places
    pub decimals: u8,
    /// Icon URL
    pub icon: String,
    /// Whether this is a native chain token
    pub native: bool,
    /// IBC denomination if applicable
    pub ibc_denom: Option<String>,
    /// Contract address if applicable
    pub contract_address: Option<String>,
}

/// Currency price information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyPrice {
    pub key: String,
    pub symbol: String,
    pub price_usd: String,
    pub price_change_24h: f64,
    pub updated_at: String,
}

/// User's balance for a specific currency
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyBalance {
    pub currency: Currency,
    /// Raw amount in smallest denomination
    pub amount_raw: String,
    /// Human-readable amount
    pub amount: String,
    /// USD value
    pub amount_usd: String,
}

/// IBC transfer route information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IbcRoute {
    pub source_chain: String,
    pub dest_chain: String,
    pub source_channel: String,
    pub dest_channel: String,
    pub port: String,
}

/// Amount with currency information
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyAmount {
    pub currency_key: String,
    pub amount: String,
    pub amount_usd: Option<String>,
}
