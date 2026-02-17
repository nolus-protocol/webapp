//! Consolidated query parameter types for handlers

use serde::Deserialize;

/// Query with a single address parameter
/// Supports both "address" and "owner" keys for backwards compatibility
#[derive(Debug, Deserialize)]
pub struct AddressQuery {
    /// The wallet address (accepts "address", "owner", or "delegator")
    #[serde(alias = "owner", alias = "delegator")]
    pub address: String,
}

/// Query with optional protocol parameter
#[derive(Debug, Deserialize)]
pub struct OptionalProtocolQuery {
    #[serde(default)]
    pub protocol: Option<String>,
}

/// Query with address and optional protocol
#[derive(Debug, Deserialize)]
pub struct AddressWithProtocolQuery {
    #[serde(alias = "owner")]
    pub address: String,
    #[serde(default)]
    pub protocol: Option<String>,
}
