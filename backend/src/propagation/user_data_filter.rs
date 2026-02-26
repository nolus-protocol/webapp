//! User Data Filter
//!
//! Filters user-specific data (leases, earn positions, balances) based on gated configuration.
//! Ensures users only see data for configured protocols/currencies and respects blacklists.
//!
//! ## Filtering Rules
//!
//! ### Protocols
//! A protocol is visible if:
//! - Network is configured (has RPC, LCD, gas_price)
//! - LPN currency is configured (has icon, displayName)
//!
//! ### Currencies
//! A currency is visible if:
//! - Has display config (icon, displayName)
//! - Not in `asset_restrictions.ignore_all`
//!
//! ### Leases
//! A lease is visible if:
//! - Protocol is configured (see above)
//! - Asset not in `ignore_all`
//! - For long positions: asset not in `ignore_long`
//! - For short positions: asset not in `ignore_short`
//!
//! ### Earn Positions
//! An earn position is visible if:
//! - Protocol is configured
//!
//! ### Balances
//! A balance is visible if:
//! - Currency is configured
//! - Currency not in `ignore_all`

use std::collections::{HashMap, HashSet};

use crate::config_store::gated_types::{
    CurrencyDisplayConfig, GatedNetworkConfig, LeaseRulesConfig,
};
use crate::external::etl::EtlProtocolsResponse;

/// Protocol info needed for filtering
#[derive(Debug, Clone)]
pub struct ProtocolFilterInfo {
    /// Position type: "long" or "short"
    pub position_type: String,
}

/// Context for filtering user data based on gated configuration
#[derive(Debug, Clone)]
pub struct UserDataFilterContext {
    /// Map of configured protocol names to their info
    pub configured_protocols: HashMap<String, ProtocolFilterInfo>,
    /// Set of configured currency tickers
    pub configured_currencies: HashSet<String>,
    /// Assets to ignore completely
    pub ignore_all: HashSet<String>,
    /// Assets to ignore for long positions
    pub ignore_long: HashSet<String>,
    /// Assets to ignore for short positions
    pub ignore_short: HashSet<String>,
}

impl UserDataFilterContext {
    /// Build filter context from gated configuration
    pub fn from_config(
        etl_protocols: &EtlProtocolsResponse,
        currency_config: &CurrencyDisplayConfig,
        network_config: &GatedNetworkConfig,
        lease_rules: &LeaseRulesConfig,
    ) -> Self {
        // Build map of configured protocols with their info
        let configured_protocols: HashMap<String, ProtocolFilterInfo> = etl_protocols
            .protocols
            .iter()
            .filter(|p| p.is_active)
            .filter(|protocol| {
                // Check network is configured
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
            .map(|p| {
                (
                    p.name.clone(),
                    ProtocolFilterInfo {
                        position_type: p.position_type.clone(),
                    },
                )
            })
            .collect();

        // Build set of configured currencies
        let configured_currencies: HashSet<String> = currency_config
            .currencies
            .iter()
            .filter(|(_, display)| display.is_configured())
            .map(|(ticker, _)| ticker.clone())
            .collect();

        // Build restriction sets
        let restrictions = &lease_rules.asset_restrictions;
        let ignore_all: HashSet<String> = restrictions.ignore_all.iter().cloned().collect();
        let ignore_long: HashSet<String> = restrictions.ignore_long.iter().cloned().collect();
        let ignore_short: HashSet<String> = restrictions.ignore_short.iter().cloned().collect();

        Self {
            configured_protocols,
            configured_currencies,
            ignore_all,
            ignore_long,
            ignore_short,
        }
    }

    /// Check if a protocol is configured and visible
    pub fn is_protocol_visible(&self, protocol_name: &str) -> bool {
        self.configured_protocols.contains_key(protocol_name)
    }

    /// Get protocol info if visible
    pub fn get_protocol_info(&self, protocol_name: &str) -> Option<&ProtocolFilterInfo> {
        self.configured_protocols.get(protocol_name)
    }

    /// Check if a currency is configured and visible
    pub fn is_currency_visible(&self, ticker: &str) -> bool {
        self.configured_currencies.contains(ticker) && !self.ignore_all.contains(ticker)
    }

    /// Check if a lease should be visible
    ///
    /// A lease is visible if:
    /// - Protocol is configured
    /// - Asset ticker is not in ignore_all
    /// - For long positions: asset not in ignore_long
    /// - For short positions: asset not in ignore_short
    pub fn is_lease_visible(&self, protocol_name: &str, asset_ticker: &str) -> bool {
        // Get protocol info (also checks if configured)
        let protocol_info = match self.get_protocol_info(protocol_name) {
            Some(info) => info,
            None => return false,
        };

        // Asset must not be in ignore_all
        if self.ignore_all.contains(asset_ticker) {
            return false;
        }

        // Check position-specific restrictions based on protocol's position type
        match protocol_info.position_type.to_lowercase().as_str() {
            "long" => !self.ignore_long.contains(asset_ticker),
            "short" => !self.ignore_short.contains(asset_ticker),
            _ => true, // Unknown position type, allow by default
        }
    }

    /// Check if an earn position should be visible
    ///
    /// An earn position is visible if protocol is configured
    pub fn is_earn_position_visible(&self, protocol_name: &str) -> bool {
        self.is_protocol_visible(protocol_name)
    }

    /// Check if a balance should be visible
    ///
    /// A balance is visible if currency is configured and not in ignore_all
    pub fn is_balance_visible(&self, ticker: &str) -> bool {
        self.is_currency_visible(ticker)
    }

    /// Check if a price should be visible
    ///
    /// A price is visible if currency is configured
    pub fn is_price_visible(&self, ticker: &str) -> bool {
        self.configured_currencies.contains(ticker)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::config_store::gated_types::{AssetRestrictions, CurrencyDisplay, NetworkSettings};
    use crate::external::etl::{EtlProtocol, EtlProtocolContracts};

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
                    contracts: EtlProtocolContracts::default(),
                },
                EtlProtocol {
                    name: "OSMOSIS-OSMOSIS-SHORT".to_string(),
                    network: Some("OSMOSIS".to_string()),
                    dex: Some("OSMOSIS".to_string()),
                    position_type: "short".to_string(),
                    lpn_symbol: "USDC_NOBLE".to_string(),
                    is_active: true,
                    contracts: EtlProtocolContracts::default(),
                },
                EtlProtocol {
                    name: "NEUTRON-ASTROPORT-USDC_NOBLE".to_string(),
                    network: Some("NEUTRON".to_string()),
                    dex: Some("ASTROPORT".to_string()),
                    position_type: "long".to_string(),
                    lpn_symbol: "USDC_NOBLE".to_string(),
                    is_active: true,
                    contracts: EtlProtocolContracts::default(),
                },
            ],
            count: 3,
            active_count: 3,
            deprecated_count: 0,
        }
    }

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
                        coingecko_id: None,
                    },
                ),
                (
                    "USDC_NOBLE".to_string(),
                    CurrencyDisplay {
                        icon: "/icons/usdc.svg".to_string(),
                        display_name: "Noble USDC".to_string(),
                        short_name: Some("USDC".to_string()),
                        color: None,
                        coingecko_id: None,
                    },
                ),
                (
                    "OSMO".to_string(),
                    CurrencyDisplay {
                        icon: "".to_string(), // Not configured (empty icon)
                        display_name: "Osmosis".to_string(),
                        short_name: None,
                        color: None,
                        coingecko_id: None,
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
                    primary_protocol: None,
                    estimation: None,
                    forward: None,
                    gas_multiplier: 3.5,
                    swap_venue: None,
                    pools: HashMap::new(),
                },
            )]),
        }
    }

    fn mock_lease_rules() -> LeaseRulesConfig {
        LeaseRulesConfig {
            downpayment_ranges: HashMap::new(),
            asset_restrictions: AssetRestrictions {
                ignore_all: vec!["DEPRECATED_TOKEN".to_string()],
                ignore_long: vec!["RISKY_LONG".to_string()],
                ignore_short: vec!["RISKY_SHORT".to_string()],
            },
            due_projection_secs: 400,
        }
    }

    #[test]
    fn test_filter_context_creation() {
        let ctx = UserDataFilterContext::from_config(
            &mock_etl_protocols(),
            &mock_currency_config(),
            &mock_network_config(),
            &mock_lease_rules(),
        );

        // OSMOSIS protocols should be configured (NEUTRON network not configured)
        assert!(ctx.is_protocol_visible("OSMOSIS-OSMOSIS-USDC_NOBLE"));
        assert!(ctx.is_protocol_visible("OSMOSIS-OSMOSIS-SHORT"));
        assert!(!ctx.is_protocol_visible("NEUTRON-ASTROPORT-USDC_NOBLE"));

        // Check position types
        assert_eq!(
            ctx.get_protocol_info("OSMOSIS-OSMOSIS-USDC_NOBLE")
                .unwrap()
                .position_type,
            "long"
        );
        assert_eq!(
            ctx.get_protocol_info("OSMOSIS-OSMOSIS-SHORT")
                .unwrap()
                .position_type,
            "short"
        );

        // ATOM and USDC_NOBLE are configured, OSMO is not (empty icon)
        assert!(ctx.is_currency_visible("ATOM"));
        assert!(ctx.is_currency_visible("USDC_NOBLE"));
        assert!(!ctx.is_currency_visible("OSMO"));

        // DEPRECATED_TOKEN is in ignore_all
        assert!(!ctx.is_currency_visible("DEPRECATED_TOKEN"));
    }

    #[test]
    fn test_lease_visibility_with_position_type() {
        let ctx = UserDataFilterContext::from_config(
            &mock_etl_protocols(),
            &mock_currency_config(),
            &mock_network_config(),
            &mock_lease_rules(),
        );

        // Normal lease in configured long protocol
        assert!(ctx.is_lease_visible("OSMOSIS-OSMOSIS-USDC_NOBLE", "ATOM"));

        // Lease in unconfigured protocol
        assert!(!ctx.is_lease_visible("NEUTRON-ASTROPORT-USDC_NOBLE", "ATOM"));

        // Lease with ignored asset (ignore_all)
        assert!(!ctx.is_lease_visible("OSMOSIS-OSMOSIS-USDC_NOBLE", "DEPRECATED_TOKEN"));

        // Long protocol with asset in ignore_long - should be hidden
        assert!(!ctx.is_lease_visible("OSMOSIS-OSMOSIS-USDC_NOBLE", "RISKY_LONG"));
        // Short protocol with same asset in ignore_long - should be visible
        assert!(ctx.is_lease_visible("OSMOSIS-OSMOSIS-SHORT", "RISKY_LONG"));

        // Short protocol with asset in ignore_short - should be hidden
        assert!(!ctx.is_lease_visible("OSMOSIS-OSMOSIS-SHORT", "RISKY_SHORT"));
        // Long protocol with same asset in ignore_short - should be visible
        assert!(ctx.is_lease_visible("OSMOSIS-OSMOSIS-USDC_NOBLE", "RISKY_SHORT"));
    }

    #[test]
    fn test_earn_visibility() {
        let ctx = UserDataFilterContext::from_config(
            &mock_etl_protocols(),
            &mock_currency_config(),
            &mock_network_config(),
            &mock_lease_rules(),
        );

        // Earn in configured protocol
        assert!(ctx.is_earn_position_visible("OSMOSIS-OSMOSIS-USDC_NOBLE"));

        // Earn in unconfigured protocol
        assert!(!ctx.is_earn_position_visible("NEUTRON-ASTROPORT-USDC_NOBLE"));
    }

    #[test]
    fn test_balance_visibility() {
        let ctx = UserDataFilterContext::from_config(
            &mock_etl_protocols(),
            &mock_currency_config(),
            &mock_network_config(),
            &mock_lease_rules(),
        );

        // Configured currency
        assert!(ctx.is_balance_visible("ATOM"));

        // Unconfigured currency
        assert!(!ctx.is_balance_visible("OSMO"));

        // Ignored currency
        assert!(!ctx.is_balance_visible("DEPRECATED_TOKEN"));
    }
}
