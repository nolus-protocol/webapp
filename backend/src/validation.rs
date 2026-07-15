//! Input validation utilities for handler boundaries

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
}
