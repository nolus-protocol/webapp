//! Consolidated query parameter types for handlers
//!
//! These types reduce duplication across handlers by providing common
//! query parameter patterns.

#![allow(dead_code)]

use serde::Deserialize;

/// Query with a single address parameter
/// Supports both "address" and "owner" keys for backwards compatibility
#[derive(Debug, Deserialize)]
pub struct AddressQuery {
    /// The wallet address (accepts "address", "owner", or "delegator")
    #[serde(alias = "owner", alias = "delegator")]
    pub address: String,
}

/// Query with pagination parameters
#[derive(Debug, Deserialize)]
pub struct PaginationQuery {
    #[serde(default)]
    pub skip: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

impl PaginationQuery {
    pub fn skip_or_default(&self) -> u32 {
        self.skip.unwrap_or(0)
    }

    pub fn limit_or_default(&self, default: u32) -> u32 {
        self.limit.unwrap_or(default)
    }
}

/// Query with address and pagination
#[derive(Debug, Deserialize)]
pub struct AddressWithPaginationQuery {
    #[serde(alias = "owner", alias = "delegator")]
    pub address: String,
    #[serde(default)]
    pub skip: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

impl AddressWithPaginationQuery {
    pub fn skip_or_default(&self) -> u32 {
        self.skip.unwrap_or(0)
    }

    pub fn limit_or_default(&self, default: u32) -> u32 {
        self.limit.unwrap_or(default)
    }
}

/// Query with protocol parameter
#[derive(Debug, Deserialize)]
pub struct ProtocolQuery {
    pub protocol: String,
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

/// Query with interval parameter (for time series data)
#[derive(Debug, Deserialize)]
pub struct IntervalQuery {
    pub interval: String,
}

/// Query with address and interval (for user time series)
#[derive(Debug, Deserialize)]
pub struct AddressWithIntervalQuery {
    pub address: String,
    pub interval: String,
}

/// Empty query (for endpoints with no parameters)
#[derive(Debug, Deserialize)]
pub struct EmptyQuery;

/// Query with a single ID parameter
#[derive(Debug, Deserialize)]
pub struct IdQuery {
    pub id: String,
}

/// Query with a search parameter
#[derive(Debug, Deserialize)]
pub struct SearchQuery {
    pub address: String,
    #[serde(default)]
    pub search: Option<String>,
    #[serde(default)]
    pub skip: Option<u32>,
    #[serde(default)]
    pub limit: Option<u32>,
}

impl SearchQuery {
    pub fn skip_or_default(&self) -> u32 {
        self.skip.unwrap_or(0)
    }

    pub fn limit_or_default(&self, default: u32) -> u32 {
        self.limit.unwrap_or(default)
    }
}

