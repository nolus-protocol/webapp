//! Placeholder validation for translations
//!
//! Ensures that template variables like {name}, {0}, {{count}} are preserved
//! in translations.

use lazy_static::lazy_static;
use regex::Regex;
use serde::Serialize;
use std::collections::HashSet;

lazy_static! {
    /// Regex to match placeholders in translation strings
    /// Matches:
    /// - {name} - simple placeholder
    /// - {0}, {1} - numbered placeholder
    /// - {{name}} - double-braced placeholder
    /// - %s, %d - printf-style placeholder
    static ref PLACEHOLDER_REGEX: Regex = Regex::new(
        r"\{\{?\w+\}?\}|%[sd]|\{[0-9]+\}"
    ).expect("Invalid placeholder regex");
}

/// Result of placeholder validation
#[derive(Debug, Clone, Serialize)]
pub struct ValidationResult {
    /// Whether the translation is valid (all placeholders preserved)
    pub valid: bool,
    /// Placeholders found in the source text
    pub source_placeholders: Vec<String>,
    /// Placeholders found in the translation
    pub translation_placeholders: Vec<String>,
    /// Placeholders missing from the translation
    pub missing: Vec<String>,
    /// Extra placeholders in the translation (not in source)
    pub extra: Vec<String>,
}

/// Extract all placeholders from a text string
pub fn extract_placeholders(text: &str) -> Vec<String> {
    PLACEHOLDER_REGEX
        .find_iter(text)
        .map(|m| m.as_str().to_string())
        .collect()
}

/// Validate that a translation preserves all placeholders from the source
pub fn validate_placeholders(source: &str, translation: &str) -> ValidationResult {
    let source_placeholders = extract_placeholders(source);
    let translation_placeholders = extract_placeholders(translation);

    let source_set: HashSet<_> = source_placeholders.iter().collect();
    let translation_set: HashSet<_> = translation_placeholders.iter().collect();

    let missing: Vec<String> = source_set
        .difference(&translation_set)
        .map(|s| (*s).clone())
        .collect();

    let extra: Vec<String> = translation_set
        .difference(&source_set)
        .map(|s| (*s).clone())
        .collect();

    // For validation, we check that all source placeholders are present
    // We allow extra placeholders (translator might add context)
    // But we flag missing placeholders as invalid
    let valid = missing.is_empty();

    ValidationResult {
        valid,
        source_placeholders,
        translation_placeholders,
        missing,
        extra,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_simple_placeholders() {
        let text = "Hello {name}, your balance is {amount}";
        let placeholders = extract_placeholders(text);
        assert_eq!(placeholders, vec!["{name}", "{amount}"]);
    }

    #[test]
    fn test_extract_numbered_placeholders() {
        let text = "Value {0} and {1}";
        let placeholders = extract_placeholders(text);
        assert_eq!(placeholders, vec!["{0}", "{1}"]);
    }

    #[test]
    fn test_extract_double_braced_placeholders() {
        let text = "Count: {{count}}";
        let placeholders = extract_placeholders(text);
        assert_eq!(placeholders, vec!["{{count}}"]);
    }

    #[test]
    fn test_extract_printf_placeholders() {
        let text = "Value: %s, Number: %d";
        let placeholders = extract_placeholders(text);
        assert_eq!(placeholders, vec!["%s", "%d"]);
    }

    #[test]
    fn test_validate_valid_translation() {
        let source = "Hello {name}!";
        let translation = "Привет {name}!";
        let result = validate_placeholders(source, translation);
        assert!(result.valid);
        assert!(result.missing.is_empty());
    }

    #[test]
    fn test_validate_missing_placeholder() {
        let source = "Hello {name}!";
        let translation = "Привет!";
        let result = validate_placeholders(source, translation);
        assert!(!result.valid);
        assert_eq!(result.missing, vec!["{name}"]);
    }

    #[test]
    fn test_validate_extra_placeholder_allowed() {
        let source = "Hello!";
        let translation = "Привет {extra}!";
        let result = validate_placeholders(source, translation);
        // Extra placeholders are allowed (valid = true) but flagged
        assert!(result.valid);
        assert_eq!(result.extra, vec!["{extra}"]);
    }

    #[test]
    fn test_validate_complex_string() {
        let source = "Amount must be between {minAmount} {symbol} and {maxAmount} {symbol}";
        let translation =
            "Сумма должна быть между {minAmount} {symbol} и {maxAmount} {symbol}";
        let result = validate_placeholders(source, translation);
        assert!(result.valid);
        assert_eq!(result.source_placeholders.len(), 4);
        assert_eq!(result.translation_placeholders.len(), 4);
    }

}
