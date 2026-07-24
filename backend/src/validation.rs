//! Input validation utilities for handler boundaries

use std::str::FromStr as _;

use solana_pubkey::Pubkey;

use crate::error::AppError;

/// Validate that a string is a valid bech32 address.
/// Returns `AppError::Validation` if empty or malformed.
pub fn validate_bech32_address(address: &str, field_name: &str) -> Result<(), AppError> {
    if address.is_empty() {
        return Err(AppError::Validation {
            message: format!("{} is required", field_name),
            field: Some(field_name.to_string()),
            details: None,
        });
    }
    bech32::decode(address).map_err(|_err| AppError::Validation {
        message: format!("Invalid {} format", field_name),
        field: Some(field_name.to_string()),
        details: None,
    })?;
    Ok(())
}

/// Returns `true` only for a valid bech32 address on the `nolus` HRP.
///
/// A valid address decodes cleanly and reports the `nolus` human-readable part,
/// so this rejects empty strings, uppercase, whitespace, and `/ ? # %` by
/// construction — a caller may then interpolate the result into an LCD path.
pub fn is_valid_nolus_address(address: &str) -> bool {
    matches!(bech32::decode(address), Ok((hrp, _)) if hrp.as_str() == "nolus")
}

/// Validate that a string is a valid Nolus (`nolus` HRP) bech32 address.
/// Returns `AppError::Validation` if empty, malformed, or on a foreign HRP.
///
/// Stricter than [`validate_bech32_address`]: a well-formed bech32 address on
/// another chain's HRP (`osmo1…`, `cosmos1…`) is rejected — a Solana send credits
/// a Nolus recipient, never a foreign-chain address.
pub fn validate_nolus_address(address: &str, field_name: &str) -> Result<(), AppError> {
    if address.is_empty() {
        return Err(AppError::Validation {
            message: format!("{} is required", field_name),
            field: Some(field_name.to_string()),
            details: None,
        });
    }
    if !is_valid_nolus_address(address) {
        return Err(AppError::Validation {
            message: format!("Invalid {} format", field_name),
            field: Some(field_name.to_string()),
            details: None,
        });
    }
    Ok(())
}

/// Validate that a string is a valid base58 Solana address (an ed25519 public
/// key: exactly 32 bytes, base58-encoded). Returns `AppError::Validation` if
/// empty or malformed.
pub fn validate_solana_address(address: &str, field_name: &str) -> Result<(), AppError> {
    if address.is_empty() {
        return Err(AppError::Validation {
            message: format!("{} is required", field_name),
            field: Some(field_name.to_string()),
            details: None,
        });
    }
    if !is_valid_solana_address(address) {
        return Err(AppError::Validation {
            message: format!("Invalid {} format", field_name),
            field: Some(field_name.to_string()),
            details: None,
        });
    }
    Ok(())
}

/// Returns `true` only for a valid base58 Solana address (decodes to exactly 32
/// bytes).
///
/// `Pubkey::from_str` rejects any character outside the base58 alphabet, so
/// `/ ? # %`, whitespace, and the ambiguous `0 O I l` glyphs all fail by
/// construction, as does any string that does not decode to 32 bytes — a caller
/// may then interpolate the result into an RPC `params` field.
pub fn is_valid_solana_address(address: &str) -> bool {
    Pubkey::from_str(address).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_valid_nolus_address() {
        assert!(validate_bech32_address(
            "nolus1qg5ega6dykkxc307y25pecuufrjkxkaggkkxh7nad0vhyhtuhw3sqaa3c5",
            "address"
        )
        .is_ok());
    }

    #[test]
    fn test_valid_osmo_address() {
        assert!(
            validate_bech32_address("osmo1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3aq6l09", "address")
                .is_ok()
        );
    }

    #[test]
    fn test_empty_address() {
        let err = validate_bech32_address("", "address").unwrap_err();
        match err {
            AppError::Validation { message, field, .. } => {
                assert_eq!(message, "address is required");
                assert_eq!(field, Some("address".to_string()));
            }
            _ => panic!("Expected Validation error"),
        }
    }

    #[test]
    fn test_invalid_address() {
        let err = validate_bech32_address("not-a-valid-address", "owner").unwrap_err();
        match err {
            AppError::Validation { message, field, .. } => {
                assert_eq!(message, "Invalid owner format");
                assert_eq!(field, Some("owner".to_string()));
            }
            _ => panic!("Expected Validation error"),
        }
    }

    #[test]
    fn test_is_valid_nolus_address_accepts_mainnet() {
        assert!(is_valid_nolus_address(
            "nolus17xpfvakm2amg962yls6f84z3kell8c5lxfnlfc"
        ));
    }

    /// Path-traversal, query, fragment, percent, uppercase, whitespace, empty,
    /// and over-length inputs must all fail — none may reach an LCD path.
    #[test]
    fn test_is_valid_nolus_address_rejects_hostile_inputs() {
        let mainnet = "nolus17xpfvakm2amg962yls6f84z3kell8c5lxfnlfc";
        assert!(!is_valid_nolus_address(&format!("{mainnet}/../../foo")));
        assert!(!is_valid_nolus_address(&format!("{mainnet}?x=1")));
        assert!(!is_valid_nolus_address(&format!("{mainnet}#frag")));
        assert!(!is_valid_nolus_address("nolus1%2e%2e"));
        assert!(!is_valid_nolus_address(&mainnet.to_uppercase()));
        assert!(!is_valid_nolus_address("nolus1 abc"));
        assert!(!is_valid_nolus_address(""));
        assert!(!is_valid_nolus_address(&format!(
            "nolus1{}",
            "q".repeat(120)
        )));
    }

    /// Canonical valid Solana addresses: the wrapped-SOL mint (44 chars) and the
    /// System program (32 `1`s = 32 zero bytes).
    #[test]
    fn test_valid_solana_address() {
        assert!(
            validate_solana_address("So11111111111111111111111111111111111111112", "address")
                .is_ok()
        );
        assert!(validate_solana_address("11111111111111111111111111111111", "address").is_ok());
    }

    #[test]
    fn test_empty_solana_address() {
        let err = validate_solana_address("", "address").unwrap_err();
        match err {
            AppError::Validation { message, field, .. } => {
                assert_eq!(message, "address is required");
                assert_eq!(field, Some("address".to_string()));
            }
            _ => panic!("Expected Validation error"),
        }
    }

    #[test]
    fn test_invalid_solana_address() {
        let err = validate_solana_address("not-a-solana-address", "owner").unwrap_err();
        match err {
            AppError::Validation { message, field, .. } => {
                assert_eq!(message, "Invalid owner format");
                assert_eq!(field, Some("owner".to_string()));
            }
            _ => panic!("Expected Validation error"),
        }
    }

    /// Path-traversal, query, fragment, percent, uppercase (introduces the
    /// out-of-alphabet `O`), whitespace, empty, and wrong-length inputs must all
    /// fail — none may reach an RPC `params` field.
    #[test]
    fn test_is_valid_solana_address_rejects_hostile_inputs() {
        let valid = "So11111111111111111111111111111111111111112";
        assert!(!is_valid_solana_address(&format!("{valid}/../../foo")));
        assert!(!is_valid_solana_address(&format!("{valid}?x=1")));
        assert!(!is_valid_solana_address(&format!("{valid}#frag")));
        assert!(!is_valid_solana_address("So1111%2e%2e"));
        assert!(!is_valid_solana_address(&valid.to_uppercase()));
        assert!(!is_valid_solana_address("So1111 111"));
        assert!(!is_valid_solana_address(""));
        assert!(!is_valid_solana_address(&"1".repeat(120)));
    }
}
