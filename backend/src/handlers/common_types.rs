//! Common types shared across handler modules
//!
//! This module contains types that are used by multiple handlers to avoid duplication.

use serde::{Deserialize, Serialize};

use crate::config_store::gated_types::CurrencyDisplay;
use crate::external::etl::EtlProtocolContracts;

/// Protocol contract addresses used in API responses
///
/// This is the canonical type for protocol contracts in handler responses.
/// All fields are optional because not all protocols have all contract types.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct ProtocolContracts {
    #[serde(skip_serializing_if = "Option::is_none")]
    pub leaser: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub lpp: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub oracle: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub profit: Option<String>,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub reserve: Option<String>,
}

impl From<EtlProtocolContracts> for ProtocolContracts {
    fn from(etl: EtlProtocolContracts) -> Self {
        Self {
            leaser: etl.leaser,
            lpp: etl.lpp,
            oracle: etl.oracle,
            profit: etl.profit,
            reserve: etl.reserve,
        }
    }
}

impl From<&EtlProtocolContracts> for ProtocolContracts {
    fn from(etl: &EtlProtocolContracts) -> Self {
        Self {
            leaser: etl.leaser.clone(),
            lpp: etl.lpp.clone(),
            oracle: etl.oracle.clone(),
            profit: etl.profit.clone(),
            reserve: etl.reserve.clone(),
        }
    }
}

/// Currency display information for API responses
///
/// This is the canonical type for currency display info across all handlers.
/// The `color` field is optional and will be omitted from JSON if None.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CurrencyDisplayInfo {
    pub ticker: String,
    pub icon: String,
    #[serde(rename = "displayName")]
    pub display_name: String,
    #[serde(rename = "shortName")]
    pub short_name: String,
    #[serde(skip_serializing_if = "Option::is_none")]
    pub color: Option<String>,
}

impl CurrencyDisplayInfo {
    /// Create from CurrencyDisplay config with ticker
    pub fn from_config(ticker: &str, display: &CurrencyDisplay, fallback_short_name: &str) -> Self {
        Self {
            ticker: ticker.to_string(),
            icon: display.icon.clone(),
            display_name: display.display_name.clone(),
            short_name: display
                .short_name
                .clone()
                .unwrap_or_else(|| fallback_short_name.to_string()),
            color: display.color.clone(),
        }
    }
}
