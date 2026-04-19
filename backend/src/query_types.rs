//! Consolidated query parameter types for handlers

use serde::Deserialize;
use utoipa::IntoParams;

/// Query with a single address parameter
/// Supports both "address" and "owner" keys for backwards compatibility
#[derive(Debug, Deserialize, IntoParams)]
pub struct AddressQuery {
    /// The wallet address (accepts "address", "owner", or "delegator")
    #[serde(alias = "owner", alias = "delegator")]
    pub address: String,
}

/// Query with optional protocol parameter
#[derive(Debug, Deserialize, IntoParams)]
pub struct OptionalProtocolQuery {
    /// Filter by protocol name (optional)
    #[serde(default)]
    pub protocol: Option<String>,
}

/// Query with address and optional protocol
#[derive(Debug, Deserialize, IntoParams)]
pub struct AddressWithProtocolQuery {
    /// The wallet address (accepts "address" or "owner")
    #[serde(alias = "owner")]
    pub address: String,
    /// Filter by protocol name (optional)
    #[serde(default)]
    pub protocol: Option<String>,
}
