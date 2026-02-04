//! Propagation Merger
//!
//! Merges ETL data with enrichment configuration to produce
//! the final data for the frontend.

use serde::{Deserialize, Serialize};

use crate::config_store::gated_types::GatedNetworkConfig;

/// Merged network with config data
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct MergedNetwork {
    /// Network key (e.g., "OSMOSIS")
    pub network: String,
    /// Display name
    pub name: String,
    /// Chain ID
    pub chain_id: String,
    /// Address prefix
    pub prefix: String,
    /// RPC endpoint
    pub rpc: String,
    /// LCD endpoint
    pub lcd: String,
    /// Fallback RPC endpoints
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub fallback_rpc: Vec<String>,
    /// Fallback LCD endpoints
    #[serde(skip_serializing_if = "Vec::is_empty")]
    pub fallback_lcd: Vec<String>,
    /// Gas price
    pub gas_price: String,
    /// Explorer URL
    #[serde(skip_serializing_if = "Option::is_none")]
    pub explorer: Option<String>,
    /// Network icon
    #[serde(skip_serializing_if = "Option::is_none")]
    pub icon: Option<String>,
    /// Primary protocol for price deduplication
    #[serde(rename = "primaryProtocol", skip_serializing_if = "Option::is_none")]
    pub primary_protocol: Option<String>,
    /// Transaction estimation time
    #[serde(skip_serializing_if = "Option::is_none")]
    pub estimation: Option<u32>,
}

/// Merges ETL data with enrichment configuration
pub struct PropagationMerger;

impl PropagationMerger {
    /// Merge network config into response format
    pub fn merge_networks(network_config: &GatedNetworkConfig) -> Vec<MergedNetwork> {
        network_config
            .networks
            .iter()
            .filter(|(_, settings)| settings.is_configured())
            .map(|(key, settings)| MergedNetwork {
                network: key.clone(),
                name: settings.name.clone(),
                chain_id: settings.chain_id.clone(),
                prefix: settings.prefix.clone(),
                rpc: settings.rpc.clone(),
                lcd: settings.lcd.clone(),
                fallback_rpc: settings.fallback_rpc.clone(),
                fallback_lcd: settings.fallback_lcd.clone(),
                gas_price: settings.gas_price.clone(),
                explorer: settings.explorer.clone(),
                icon: settings.icon.clone(),
                primary_protocol: settings.primary_protocol.clone(),
                estimation: settings.estimation,
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config_store::gated_types::NetworkSettings;
    use std::collections::HashMap;

    #[test]
    fn test_merge_networks() {
        let config = GatedNetworkConfig {
            networks: HashMap::from([(
                "OSMOSIS".to_string(),
                NetworkSettings {
                    name: "Osmosis".to_string(),
                    chain_id: "osmosis-1".to_string(),
                    prefix: "osmo".to_string(),
                    rpc: "https://rpc.osmosis.zone".to_string(),
                    lcd: "https://lcd.osmosis.zone".to_string(),
                    fallback_rpc: vec![],
                    fallback_lcd: vec![],
                    gas_price: "0.025uosmo".to_string(),
                    explorer: Some("https://www.mintscan.io/osmosis".to_string()),
                    icon: Some("/icons/osmosis.svg".to_string()),
                    primary_protocol: Some("OSMOSIS-OSMOSIS-USDC_NOBLE".to_string()),
                    estimation: Some(6),
                    forward: None,
                    pools: HashMap::new(),
                },
            )]),
        };

        let merged = PropagationMerger::merge_networks(&config);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].network, "OSMOSIS");
        assert_eq!(merged[0].name, "Osmosis");
        assert_eq!(merged[0].chain_id, "osmosis-1");
        assert_eq!(
            merged[0].primary_protocol,
            Some("OSMOSIS-OSMOSIS-USDC_NOBLE".to_string())
        );
    }
}
