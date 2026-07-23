//! Propagation Merger
//!
//! Merges ETL data with enrichment configuration to produce
//! the final data for the frontend.

use serde::{Deserialize, Serialize};

use crate::config_store::gated_types::{GatedNetworkConfig, NetworkSettings};

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
    /// Gas multiplier for fee estimation
    pub gas_multiplier: f64,
}

/// Merges ETL data with enrichment configuration
pub struct PropagationMerger;

impl PropagationMerger {
    /// Merge network config into response format.
    ///
    /// svm networks carry a backend-internal RPC that must never reach this
    /// public list, so their endpoint fields are redacted to empty here.
    pub fn merge_networks(network_config: &GatedNetworkConfig) -> Vec<MergedNetwork> {
        network_config
            .networks
            .iter()
            .filter(|(_, settings)| settings.is_configured())
            .map(|(key, settings)| match settings {
                NetworkSettings::Cosmos(cosmos) => MergedNetwork {
                    network: key.clone(),
                    name: cosmos.name.clone(),
                    chain_id: cosmos.chain_id.clone(),
                    prefix: cosmos.prefix.clone(),
                    rpc: cosmos.rpc.clone(),
                    lcd: cosmos.lcd.clone(),
                    fallback_rpc: cosmos.fallback_rpc.clone(),
                    fallback_lcd: cosmos.fallback_lcd.clone(),
                    gas_price: cosmos.gas_price.clone(),
                    explorer: cosmos.explorer.clone(),
                    icon: cosmos.icon.clone(),
                    primary_protocol: cosmos.primary_protocol.clone(),
                    estimation: cosmos.estimation,
                    gas_multiplier: cosmos.gas_multiplier,
                },
                NetworkSettings::Svm(svm) => MergedNetwork {
                    network: key.clone(),
                    name: svm.name.clone(),
                    chain_id: svm.chain_id.clone(),
                    prefix: String::new(),
                    rpc: String::new(),
                    lcd: String::new(),
                    fallback_rpc: Vec::new(),
                    fallback_lcd: Vec::new(),
                    gas_price: String::new(),
                    explorer: None,
                    icon: svm.icon.clone(),
                    primary_protocol: None,
                    estimation: svm.estimation,
                    gas_multiplier: svm.gas_multiplier,
                },
            })
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config_store::gated_types::{CosmosNetworkSettings, NetworkSettings};
    use std::collections::HashMap;

    #[test]
    fn test_merge_networks() {
        let config = GatedNetworkConfig {
            networks: HashMap::from([(
                "OSMOSIS".to_string(),
                NetworkSettings::Cosmos(CosmosNetworkSettings {
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
                    gas_multiplier: 3.5,
                    swap_venue: None,
                    pools: HashMap::new(),
                }),
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

    /// Empty network config merges to zero entries — no panic, no defaults
    /// injected. Guards the contract that `merge_networks` is a pure filter +
    /// projection.
    #[test]
    fn test_merge_networks_empty() {
        let config = GatedNetworkConfig {
            networks: HashMap::new(),
        };

        let merged = PropagationMerger::merge_networks(&config);

        assert!(merged.is_empty());
    }

    /// Mixed config with one fully-configured and one unconfigured network
    /// (empty rpc/lcd/gas_price). Only the configured one should pass; the
    /// other is silently dropped by `is_configured()`.
    #[test]
    fn test_merge_networks_skips_unconfigured() {
        let config = GatedNetworkConfig {
            networks: HashMap::from([
                (
                    "OSMOSIS".to_string(),
                    NetworkSettings::Cosmos(CosmosNetworkSettings {
                        name: "Osmosis".to_string(),
                        chain_id: "osmosis-1".to_string(),
                        prefix: "osmo".to_string(),
                        rpc: "https://rpc.osmosis.zone".to_string(),
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
                    }),
                ),
                (
                    "NEUTRON".to_string(),
                    NetworkSettings::Cosmos(CosmosNetworkSettings {
                        name: "Neutron".to_string(),
                        chain_id: "neutron-1".to_string(),
                        prefix: "neutron".to_string(),
                        rpc: String::new(), // missing → not configured
                        lcd: String::new(),
                        fallback_rpc: vec![],
                        fallback_lcd: vec![],
                        gas_price: String::new(),
                        explorer: None,
                        icon: None,
                        primary_protocol: None,
                        estimation: None,
                        forward: None,
                        gas_multiplier: 2.5,
                        swap_venue: None,
                        pools: HashMap::new(),
                    }),
                ),
            ]),
        };

        let merged = PropagationMerger::merge_networks(&config);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].network, "OSMOSIS");
    }

    /// Verify fallback endpoints and pool configs propagate through unchanged.
    /// Prevents regression if the projection drops fields silently.
    #[test]
    fn test_merge_networks_preserves_fallbacks_and_gas_multiplier() {
        let config = GatedNetworkConfig {
            networks: HashMap::from([(
                "OSMOSIS".to_string(),
                NetworkSettings::Cosmos(CosmosNetworkSettings {
                    name: "Osmosis".to_string(),
                    chain_id: "osmosis-1".to_string(),
                    prefix: "osmo".to_string(),
                    rpc: "https://rpc.osmosis.zone".to_string(),
                    lcd: "https://lcd.osmosis.zone".to_string(),
                    fallback_rpc: vec!["https://rpc-backup.osmosis.zone".to_string()],
                    fallback_lcd: vec!["https://lcd-backup.osmosis.zone".to_string()],
                    gas_price: "0.025uosmo".to_string(),
                    explorer: None,
                    icon: None,
                    primary_protocol: None,
                    estimation: Some(6),
                    forward: None,
                    gas_multiplier: 7.25,
                    swap_venue: None,
                    pools: HashMap::new(),
                }),
            )]),
        };

        let merged = PropagationMerger::merge_networks(&config);

        assert_eq!(merged.len(), 1);
        assert_eq!(merged[0].fallback_rpc.len(), 1);
        assert_eq!(merged[0].fallback_lcd.len(), 1);
        // gas_multiplier is f64 — exact compare is fine here (we wrote 7.25)
        assert!((merged[0].gas_multiplier - 7.25).abs() < f64::EPSILON);
        assert_eq!(merged[0].estimation, Some(6));
    }

    // an svm entry's internal RPC must never reach
    // the public gated list served through refresh_gated_networks. Config is
    // built through the serde seam so the test is agnostic to whether the
    // implementation redacts svm rpc/lcd to empty or drops svm entries entirely
    // — either way the internal endpoint must be absent from the serialized
    // output, and cosmos endpoints must still be present.

    const SVM_INTERNAL_RPC: &str = "https://solana-rpc.internal-do-not-leak";
    const COSMOS_PUBLIC_RPC: &str = "https://rpc-osmosis.public";

    fn mixed_cosmos_and_svm_config() -> GatedNetworkConfig {
        serde_json::from_str(&format!(
            r#"{{
              "OSMOSIS": {{ "name":"Osmosis","chain_id":"osmosis-1","prefix":"osmo",
                "rpc":"{COSMOS_PUBLIC_RPC}","lcd":"https://lcd-osmosis.public",
                "gas_price":"0.025uosmo","gas_multiplier":3.5 }},
              "SOLANA": {{ "chain_type":"svm","name":"Solana","chain_id":"solana",
                "rpc":"{SVM_INTERNAL_RPC}",
                "program_id":"NoLuSpRoGrAm1111111111111111111111111111111",
                "transfer_channel_id":"channel-0",
                "explorer_url_pattern":"https://solscan.io/tx/{{txHash}}",
                "symbol":"SOL","gas_multiplier":1.0 }}
            }}"#
        ))
        .expect("mixed cosmos+svm gated network config deserializes")
    }

    #[test]
    fn merge_networks_does_not_leak_svm_internal_rpc() {
        let merged = PropagationMerger::merge_networks(&mixed_cosmos_and_svm_config());
        let json = serde_json::to_string(&merged).expect("merged networks serialize");
        assert!(
            !json.contains(SVM_INTERNAL_RPC),
            "svm internal RPC must never reach the public gated list: {json}"
        );
    }

    #[test]
    fn merge_networks_still_serves_cosmos_rpc() {
        let merged = PropagationMerger::merge_networks(&mixed_cosmos_and_svm_config());
        let json = serde_json::to_string(&merged).expect("merged networks serialize");
        assert!(
            json.contains(COSMOS_PUBLIC_RPC),
            "cosmos RPC must still be served through the gated list: {json}"
        );
    }
}
