//! Propagation Filter
//!
//! Filters ETL data based on gated configuration.
//! Only configured items pass through to the frontend.

use std::collections::HashSet;

use crate::config_store::gated_types::{CurrencyDisplayConfig, GatedNetworkConfig};
use crate::external::etl::{EtlCurrenciesResponse, EtlCurrency, EtlProtocol, EtlProtocolsResponse};

/// Filters ETL data based on gated configuration
pub struct PropagationFilter;

impl PropagationFilter {
    /// Filter protocols to only return those that are fully configured
    ///
    /// A protocol is configured when:
    /// - It's active in ETL
    /// - Its network is configured
    /// - Its LPN currency is configured
    pub fn filter_protocols(
        etl_protocols: &EtlProtocolsResponse,
        currency_config: &CurrencyDisplayConfig,
        network_config: &GatedNetworkConfig,
    ) -> Vec<EtlProtocol> {
        etl_protocols
            .protocols
            .iter()
            .filter(|p| p.is_active)
            .filter(|protocol| {
                // Check network is configured (normalize to uppercase for comparison)
                let network_configured = protocol
                    .network
                    .as_ref()
                    .map(|n| {
                        let network_key = n.to_uppercase();
                        network_config
                            .networks
                            .get(&network_key)
                            .map(|s| s.is_configured())
                            .unwrap_or(false)
                    })
                    .unwrap_or(false);

                if !network_configured {
                    return false;
                }

                // Check LPN currency is configured
                currency_config
                    .currencies
                    .get(&protocol.lpn_symbol)
                    .map(|c| c.is_configured())
                    .unwrap_or(false)
            })
            .cloned()
            .collect()
    }

    /// Filter currencies for a specific protocol
    ///
    /// Returns only currencies that:
    /// - Are active in ETL
    /// - Have display config
    /// - Belong to the specified protocol
    pub fn filter_currencies_for_protocol(
        etl_currencies: &EtlCurrenciesResponse,
        currency_config: &CurrencyDisplayConfig,
        protocol_name: &str,
    ) -> Vec<EtlCurrency> {
        etl_currencies
            .currencies
            .iter()
            .filter(|c| c.is_active)
            .filter(|currency| {
                // Check currency is configured
                let is_configured = currency_config
                    .currencies
                    .get(&currency.ticker)
                    .map(|c| c.is_configured())
                    .unwrap_or(false);

                if !is_configured {
                    return false;
                }

                // Check currency belongs to protocol
                currency
                    .protocols
                    .iter()
                    .any(|p| p.protocol == protocol_name)
            })
            .cloned()
            .collect()
    }

    /// Filter currencies for a specific network
    ///
    /// Returns only currencies that:
    /// - Are active in ETL
    /// - Have display config
    /// - Belong to at least one configured protocol on the network
    pub fn filter_currencies_for_network(
        etl_currencies: &EtlCurrenciesResponse,
        etl_protocols: &EtlProtocolsResponse,
        currency_config: &CurrencyDisplayConfig,
        network_config: &GatedNetworkConfig,
        network: &str,
    ) -> Vec<EtlCurrency> {
        // Get configured protocols for this network (normalize network comparison)
        let filtered = Self::filter_protocols(etl_protocols, currency_config, network_config);
        let network_upper = network.to_uppercase();
        let configured_protocols: HashSet<String> = filtered
            .iter()
            .filter(|p| p.network.as_ref().map(|n| n.to_uppercase()) == Some(network_upper.clone()))
            .map(|p| p.name.clone())
            .collect();

        etl_currencies
            .currencies
            .iter()
            .filter(|c| c.is_active)
            .filter(|currency| {
                // Check currency is configured
                let is_configured = currency_config
                    .currencies
                    .get(&currency.ticker)
                    .map(|c| c.is_configured())
                    .unwrap_or(false);

                if !is_configured {
                    return false;
                }

                // Check currency belongs to at least one configured protocol on this network
                currency
                    .protocols
                    .iter()
                    .any(|p| configured_protocols.contains(&p.protocol))
            })
            .cloned()
            .collect()
    }

    /// Filter protocols for a specific network
    pub fn filter_protocols_for_network(
        etl_protocols: &EtlProtocolsResponse,
        currency_config: &CurrencyDisplayConfig,
        network_config: &GatedNetworkConfig,
        network: &str,
    ) -> Vec<EtlProtocol> {
        let network_upper = network.to_uppercase();
        Self::filter_protocols(etl_protocols, currency_config, network_config)
            .into_iter()
            .filter(|p| p.network.as_ref().map(|n| n.to_uppercase()) == Some(network_upper.clone()))
            .collect()
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config_store::gated_types::{CurrencyDisplay, NetworkSettings};
    use crate::external::etl::{EtlCurrencyProtocol, EtlProtocolContracts};
    use std::collections::HashMap;

    fn mock_currency_config() -> CurrencyDisplayConfig {
        CurrencyDisplayConfig {
            currencies: HashMap::from([
                (
                    "ATOM".to_string(),
                    CurrencyDisplay {
                        icon: "/icons/atom.svg".to_string(),
                        display_name: "Cosmos Hub".to_string(),
                        short_name: Some("ATOM".to_string()),
                        color: None,
                        coingecko_id: Some("cosmos".to_string()),
                    },
                ),
                (
                    "USDC_NOBLE".to_string(),
                    CurrencyDisplay {
                        icon: "/icons/usdc.svg".to_string(),
                        display_name: "Noble USDC".to_string(),
                        short_name: Some("USDC".to_string()),
                        color: None,
                        coingecko_id: Some("usd-coin".to_string()),
                    },
                ),
            ]),
        }
    }

    fn mock_network_config() -> GatedNetworkConfig {
        GatedNetworkConfig {
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
                    primary_protocol: Some("OSMOSIS-OSMOSIS-USDC_NOBLE".to_string()),
                    estimation: None,
                    forward: None,
                    gas_multiplier: 3.5,
                    swap_venue: None,
                    pools: HashMap::new(),
                },
            )]),
        }
    }

    fn mock_etl_protocols() -> EtlProtocolsResponse {
        EtlProtocolsResponse {
            protocols: vec![
                EtlProtocol {
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
                },
                EtlProtocol {
                    name: "NEUTRON-ASTROPORT-USDC_NOBLE".to_string(),
                    network: Some("NEUTRON".to_string()),
                    dex: Some("ASTROPORT".to_string()),
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
                },
            ],
            count: 2,
            active_count: 2,
            deprecated_count: 0,
        }
    }

    fn mock_etl_currencies() -> EtlCurrenciesResponse {
        EtlCurrenciesResponse {
            currencies: vec![
                EtlCurrency {
                    ticker: "ATOM".to_string(),
                    decimal_digits: 6,
                    is_active: true,
                    protocols: vec![EtlCurrencyProtocol {
                        protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
                        group: "collateral".to_string(),
                        bank_symbol: "uatom".to_string(),
                        dex_symbol: "uatom".to_string(),
                    }],
                },
                EtlCurrency {
                    ticker: "OSMO".to_string(),
                    decimal_digits: 6,
                    is_active: true,
                    protocols: vec![EtlCurrencyProtocol {
                        protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
                        group: "collateral".to_string(),
                        bank_symbol: "uosmo".to_string(),
                        dex_symbol: "uosmo".to_string(),
                    }],
                },
                EtlCurrency {
                    ticker: "USDC_NOBLE".to_string(),
                    decimal_digits: 6,
                    is_active: true,
                    protocols: vec![EtlCurrencyProtocol {
                        protocol: "OSMOSIS-OSMOSIS-USDC_NOBLE".to_string(),
                        group: "lpn".to_string(),
                        bank_symbol: "uusdc".to_string(),
                        dex_symbol: "uusdc".to_string(),
                    }],
                },
            ],
            count: 3,
            active_count: 3,
            deprecated_count: 0,
        }
    }

    #[test]
    fn test_filter_protocols() {
        let protocols = PropagationFilter::filter_protocols(
            &mock_etl_protocols(),
            &mock_currency_config(),
            &mock_network_config(),
        );

        // Only OSMOSIS protocol should pass (NEUTRON network not configured)
        assert_eq!(protocols.len(), 1);
        assert_eq!(protocols[0].name, "OSMOSIS-OSMOSIS-USDC_NOBLE");
    }

    #[test]
    fn test_filter_currencies_for_protocol() {
        let currencies = PropagationFilter::filter_currencies_for_protocol(
            &mock_etl_currencies(),
            &mock_currency_config(),
            "OSMOSIS-OSMOSIS-USDC_NOBLE",
        );

        // Only ATOM and USDC_NOBLE belong to this protocol and are configured
        assert_eq!(currencies.len(), 2);
    }
}
