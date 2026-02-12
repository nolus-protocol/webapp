//! Propagation Validator
//!
//! Validates gated configuration against ETL data to ensure consistency.
//! Provides discovery functions for unconfigured items.

use std::collections::HashSet;

use crate::config_store::gated_types::{CurrencyDisplayConfig, GatedNetworkConfig};
use crate::external::etl::{EtlCurrenciesResponse, EtlProtocolsResponse};

/// Validates gated configuration against ETL data
pub struct PropagationValidator;

impl PropagationValidator {
    /// Get list of unconfigured currencies (in ETL but not in config)
    pub fn get_unconfigured_currencies(
        config: &CurrencyDisplayConfig,
        etl_currencies: &EtlCurrenciesResponse,
    ) -> Vec<String> {
        etl_currencies
            .currencies
            .iter()
            .filter(|c| c.is_active)
            .filter(|c| {
                !config.currencies.contains_key(&c.ticker)
                    || !config.currencies[&c.ticker].is_configured()
            })
            .map(|c| c.ticker.clone())
            .collect()
    }

    /// Get list of unconfigured networks (in ETL but not in config)
    pub fn get_unconfigured_networks(
        config: &GatedNetworkConfig,
        etl_protocols: &EtlProtocolsResponse,
    ) -> Vec<String> {
        let etl_networks: HashSet<String> = etl_protocols
            .protocols
            .iter()
            .filter(|p| p.is_active)
            .filter_map(|p| p.network.clone())
            .collect();

        etl_networks
            .into_iter()
            .filter(|network| {
                !config.networks.contains_key(&network.to_uppercase()) || !config.networks[&network.to_uppercase()].is_configured()
            })
            .collect()
    }

    /// Get list of protocols that are not ready
    ///
    /// A protocol is ready when:
    /// - Its network is configured
    /// - Its LPN currency is configured
    /// - All currencies used by the protocol are configured
    pub fn get_unready_protocols(
        currency_config: &CurrencyDisplayConfig,
        network_config: &GatedNetworkConfig,
        etl_protocols: &EtlProtocolsResponse,
        etl_currencies: &EtlCurrenciesResponse,
    ) -> Vec<String> {
        etl_protocols
            .protocols
            .iter()
            .filter(|p| p.is_active)
            .filter(|protocol| {
                // Check network is configured
                let network_configured = protocol
                    .network
                    .as_ref()
                    .map(|n| {
                        network_config
                            .networks
                            .get(&n.to_uppercase())
                            .map(|s| s.is_configured())
                            .unwrap_or(false)
                    })
                    .unwrap_or(false);

                if !network_configured {
                    return true; // Not ready
                }

                // Check LPN currency is configured
                let lpn_configured = currency_config
                    .currencies
                    .get(&protocol.lpn_symbol)
                    .map(|c| c.is_configured())
                    .unwrap_or(false);

                if !lpn_configured {
                    return true; // Not ready
                }

                // Check all currencies for this protocol are configured
                let protocol_currencies: Vec<&str> = etl_currencies
                    .currencies
                    .iter()
                    .filter(|c| c.is_active)
                    .filter(|c| c.protocols.iter().any(|p| p.protocol == protocol.name))
                    .map(|c| c.ticker.as_str())
                    .collect();

                let all_currencies_configured = protocol_currencies.iter().all(|ticker| {
                    currency_config
                        .currencies
                        .get(*ticker)
                        .map(|c| c.is_configured())
                        .unwrap_or(false)
                });

                !all_currencies_configured // Not ready if not all configured
            })
            .map(|p| p.name.clone())
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config_store::gated_types::{CurrencyDisplay, NetworkSettings};
    use crate::external::etl::{EtlCurrency, EtlProtocol, EtlProtocolContracts};
    use std::collections::HashMap;

    fn mock_etl_currencies() -> EtlCurrenciesResponse {
        EtlCurrenciesResponse {
            currencies: vec![
                EtlCurrency {
                    ticker: "ATOM".to_string(),
                    decimal_digits: 6,
                    is_active: true,
                    protocols: vec![],
                },
                EtlCurrency {
                    ticker: "OSMO".to_string(),
                    decimal_digits: 6,
                    is_active: true,
                    protocols: vec![],
                },
            ],
            count: 2,
            active_count: 2,
            deprecated_count: 0,
        }
    }

    fn mock_etl_protocols() -> EtlProtocolsResponse {
        EtlProtocolsResponse {
            protocols: vec![EtlProtocol {
                name: "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
                network: Some("OSMOSIS".to_string()),
                dex: Some("OSMOSIS".to_string()),
                position_type: "long".to_string(),
                lpn_symbol: "USDC_NOBLE".to_string(),
                is_active: true,
                contracts: EtlProtocolContracts {
                    leaser: None,
                    lpp: None,
                    oracle: None,
                    profit: None,
                    reserve: None,
                },
            }],
            count: 1,
            active_count: 1,
            deprecated_count: 0,
        }
    }

    #[test]
    fn test_get_unconfigured_currencies() {
        let config = CurrencyDisplayConfig {
            currencies: HashMap::from([(
                "ATOM".to_string(),
                CurrencyDisplay {
                    icon: "/icons/atom.svg".to_string(),
                    display_name: "Cosmos".to_string(),
                    short_name: None,
                    color: None,
                    coingecko_id: None,
                },
            )]),
        };

        let unconfigured =
            PropagationValidator::get_unconfigured_currencies(&config, &mock_etl_currencies());
        assert_eq!(unconfigured, vec!["OSMO".to_string()]);
    }

    #[test]
    fn test_get_unconfigured_networks() {
        let config = GatedNetworkConfig {
            networks: HashMap::new(),
        };

        let unconfigured =
            PropagationValidator::get_unconfigured_networks(&config, &mock_etl_protocols());
        assert_eq!(unconfigured, vec!["OSMOSIS".to_string()]);
    }

    #[test]
    fn test_get_unconfigured_networks_with_config() {
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
                    explorer: None,
                    icon: None,
                    primary_protocol: None,
                    estimation: None,
                    forward: None,
                    gas_multiplier: 3.5,
                    swap_venue: None,
                    pools: HashMap::new(),
                },
            )]),
        };

        let unconfigured =
            PropagationValidator::get_unconfigured_networks(&config, &mock_etl_protocols());
        assert!(unconfigured.is_empty());
    }
}
