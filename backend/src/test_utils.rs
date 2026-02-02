//! Test utilities and helpers for reducing test boilerplate
//!
//! Provides:
//! - Mock data builders
//! - Common test assertions
//! - Setup helpers

#![cfg(test)]
#![allow(dead_code)]

use serde::Serialize;
use serde_json::json;

// ============================================================================
// Mock Data Builders
// ============================================================================

/// Builder for creating mock validator data
pub struct MockValidatorBuilder {
    operator_address: String,
    moniker: String,
    tokens: String,
    commission_rate: String,
    status: String,
    jailed: bool,
}

impl Default for MockValidatorBuilder {
    fn default() -> Self {
        Self {
            operator_address: "nolusvaloper1test".to_string(),
            moniker: "Test Validator".to_string(),
            tokens: "1000000000".to_string(),
            commission_rate: "0.100000000000000000".to_string(),
            status: "BOND_STATUS_BONDED".to_string(),
            jailed: false,
        }
    }
}

impl MockValidatorBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn address(mut self, address: &str) -> Self {
        self.operator_address = address.to_string();
        self
    }

    pub fn moniker(mut self, moniker: &str) -> Self {
        self.moniker = moniker.to_string();
        self
    }

    pub fn tokens(mut self, tokens: &str) -> Self {
        self.tokens = tokens.to_string();
        self
    }

    pub fn commission(mut self, rate: &str) -> Self {
        self.commission_rate = rate.to_string();
        self
    }

    pub fn jailed(mut self, jailed: bool) -> Self {
        self.jailed = jailed;
        self
    }

    pub fn status(mut self, status: &str) -> Self {
        self.status = status.to_string();
        self
    }

    pub fn build_json(&self) -> serde_json::Value {
        json!({
            "operator_address": self.operator_address,
            "consensus_pubkey": null,
            "jailed": self.jailed,
            "status": self.status,
            "tokens": self.tokens,
            "delegator_shares": format!("{}.000000000000000000", self.tokens),
            "description": {
                "moniker": self.moniker,
                "identity": "",
                "website": "",
                "details": ""
            },
            "commission": {
                "commission_rates": {
                    "rate": self.commission_rate,
                    "max_rate": "0.200000000000000000",
                    "max_change_rate": "0.010000000000000000"
                }
            }
        })
    }
}

/// Builder for creating mock balance data
pub struct MockBalanceBuilder {
    denom: String,
    amount: String,
}

impl Default for MockBalanceBuilder {
    fn default() -> Self {
        Self {
            denom: "unls".to_string(),
            amount: "1000000".to_string(),
        }
    }
}

impl MockBalanceBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn denom(mut self, denom: &str) -> Self {
        self.denom = denom.to_string();
        self
    }

    pub fn amount(mut self, amount: &str) -> Self {
        self.amount = amount.to_string();
        self
    }

    pub fn build_json(&self) -> serde_json::Value {
        json!({
            "denom": self.denom,
            "amount": self.amount
        })
    }
}

/// Builder for creating mock price data
pub struct MockPriceBuilder {
    ticker: String,
    amount: String,
    quote_amount: String,
}

impl Default for MockPriceBuilder {
    fn default() -> Self {
        Self {
            ticker: "ATOM".to_string(),
            amount: "1000000".to_string(),
            quote_amount: "10000000".to_string(),
        }
    }
}

impl MockPriceBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn ticker(mut self, ticker: &str) -> Self {
        self.ticker = ticker.to_string();
        self
    }

    pub fn amount(mut self, amount: &str) -> Self {
        self.amount = amount.to_string();
        self
    }

    pub fn quote_amount(mut self, amount: &str) -> Self {
        self.quote_amount = amount.to_string();
        self
    }

    pub fn build_json(&self) -> serde_json::Value {
        json!({
            "amount": {
                "ticker": self.ticker,
                "amount": self.amount
            },
            "amount_quote": {
                "ticker": "USD",
                "amount": self.quote_amount
            }
        })
    }
}

/// Builder for creating mock delegation data
pub struct MockDelegationBuilder {
    delegator: String,
    validator: String,
    shares: String,
    balance_amount: String,
}

impl Default for MockDelegationBuilder {
    fn default() -> Self {
        Self {
            delegator: "nolus1test".to_string(),
            validator: "nolusvaloper1test".to_string(),
            shares: "1000000.000000000000000000".to_string(),
            balance_amount: "1000000".to_string(),
        }
    }
}

impl MockDelegationBuilder {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn delegator(mut self, addr: &str) -> Self {
        self.delegator = addr.to_string();
        self
    }

    pub fn validator(mut self, addr: &str) -> Self {
        self.validator = addr.to_string();
        self
    }

    pub fn shares(mut self, shares: &str) -> Self {
        self.shares = shares.to_string();
        self
    }

    pub fn balance(mut self, amount: &str) -> Self {
        self.balance_amount = amount.to_string();
        self
    }

    pub fn build_json(&self) -> serde_json::Value {
        json!({
            "delegation": {
                "delegator_address": self.delegator,
                "validator_address": self.validator,
                "shares": self.shares
            },
            "balance": {
                "denom": "unls",
                "amount": self.balance_amount
            }
        })
    }
}

// ============================================================================
// Test Assertion Helpers
// ============================================================================

/// Assert that a JSON value contains expected fields
pub fn assert_json_contains<T: Serialize>(json: &serde_json::Value, expected: &T) {
    let expected_json = serde_json::to_value(expected).expect("Failed to serialize expected value");

    if let (Some(json_obj), Some(expected_obj)) = (json.as_object(), expected_json.as_object()) {
        for (key, expected_value) in expected_obj {
            let actual_value = json_obj.get(key);
            assert!(
                actual_value.is_some(),
                "Expected key '{}' not found in JSON",
                key
            );
            assert_eq!(
                actual_value.unwrap(),
                expected_value,
                "Value mismatch for key '{}'",
                key
            );
        }
    } else {
        panic!("Both values must be JSON objects");
    }
}

/// Assert that a JSON array has the expected length
pub fn assert_json_array_len(json: &serde_json::Value, expected_len: usize) {
    let array = json.as_array().expect("Expected JSON array");
    assert_eq!(
        array.len(),
        expected_len,
        "Array length mismatch: expected {}, got {}",
        expected_len,
        array.len()
    );
}

/// Assert that a JSON value is a valid number string
pub fn assert_valid_number_string(json: &serde_json::Value) {
    let s = json.as_str().expect("Expected string value");
    s.parse::<f64>()
        .expect(&format!("Expected valid number string, got '{}'", s));
}

/// Assert that a string is a valid Nolus address
pub fn assert_valid_nolus_address(address: &str) {
    assert!(
        address.starts_with("nolus1"),
        "Expected Nolus address starting with 'nolus1', got '{}'",
        address
    );
    assert!(
        address.len() >= 39,
        "Nolus address too short: '{}'",
        address
    );
}

/// Assert that a string is a valid validator address
pub fn assert_valid_validator_address(address: &str) {
    assert!(
        address.starts_with("nolusvaloper1"),
        "Expected validator address starting with 'nolusvaloper1', got '{}'",
        address
    );
}

// ============================================================================
// Common Test Data
// ============================================================================

/// Common test addresses
pub mod addresses {
    pub const TEST_USER: &str = "nolus1testuser123456789012345678901234567890";
    pub const TEST_VALIDATOR: &str = "nolusvaloper1testval12345678901234567890123456";
    pub const TEST_CONTRACT: &str = "nolus1contract123456789012345678901234567890";
}

/// Common test amounts
pub mod amounts {
    pub const ONE_MILLION: &str = "1000000";
    pub const TEN_MILLION: &str = "10000000";
    pub const ONE_HUNDRED: &str = "100";
    pub const ZERO: &str = "0";
}

/// Common test tickers
pub mod tickers {
    pub const NLS: &str = "NLS";
    pub const ATOM: &str = "ATOM";
    pub const OSMO: &str = "OSMO";
    pub const USDC: &str = "USDC_NOBLE";
}

// ============================================================================
// Test Result Helpers
// ============================================================================

/// Macro for creating test scenarios with setup/teardown
#[macro_export]
macro_rules! test_scenario {
    ($name:ident, setup: $setup:expr, test: $test:expr) => {
        #[test]
        fn $name() {
            let context = $setup;
            $test(context);
        }
    };

    ($name:ident, async setup: $setup:expr, test: $test:expr) => {
        #[tokio::test]
        async fn $name() {
            let context = $setup.await;
            $test(context).await;
        }
    };
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_mock_validator_builder() {
        let validator = MockValidatorBuilder::new()
            .address("nolusvaloper1custom")
            .moniker("Custom Validator")
            .tokens("5000000000")
            .jailed(false)
            .build_json();

        assert_eq!(validator["operator_address"], "nolusvaloper1custom");
        assert_eq!(validator["description"]["moniker"], "Custom Validator");
        assert_eq!(validator["tokens"], "5000000000");
    }

    #[test]
    fn test_mock_balance_builder() {
        let balance = MockBalanceBuilder::new()
            .denom("ibc/ABC123")
            .amount("5000000")
            .build_json();

        assert_eq!(balance["denom"], "ibc/ABC123");
        assert_eq!(balance["amount"], "5000000");
    }

    #[test]
    fn test_mock_price_builder() {
        let price = MockPriceBuilder::new()
            .ticker("OSMO")
            .amount("1000000")
            .quote_amount("500000")
            .build_json();

        assert_eq!(price["amount"]["ticker"], "OSMO");
    }

    #[test]
    fn test_assert_json_array_len() {
        let json = json!([1, 2, 3]);
        assert_json_array_len(&json, 3);
    }

    #[test]
    fn test_assert_valid_number_string() {
        assert_valid_number_string(&json!("123.456"));
        assert_valid_number_string(&json!("0"));
        assert_valid_number_string(&json!("-100"));
    }

    #[test]
    fn test_assert_valid_nolus_address() {
        assert_valid_nolus_address(addresses::TEST_USER);
    }

    #[test]
    fn test_assert_valid_validator_address() {
        assert_valid_validator_address(addresses::TEST_VALIDATOR);
    }
}
