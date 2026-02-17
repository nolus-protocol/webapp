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
    bech32::decode(address).map_err(|_| AppError::Validation {
        message: format!("Invalid {} format", field_name),
        field: Some(field_name.to_string()),
        details: None,
    })?;
    Ok(())
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
        assert!(validate_bech32_address(
            "osmo1fl48vsnmsdzcv85q5d2q4z5ajdha8yu3aq6l09",
            "address"
        )
        .is_ok());
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
}
