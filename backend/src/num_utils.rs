//! Numeric conversion helpers that avoid `as` casts.
//!
//! `clippy::as_conversions` forbids `as` in this crate. Most casts have a
//! `From`/`TryFrom` replacement, but `f64` has neither `From<u128>` nor
//! `TryFrom<u128>` in std (the conversion is lossy above 2^53). This module
//! holds the one conversion that needs a non-trivial, reviewed strategy.

/// Convert an unsigned 128-bit integer to `f64` without an `as` cast.
///
/// Routes through the decimal string, whose `f64` parse is correctly rounded.
/// For every value that fits f64's 53-bit mantissa — which covers all realistic
/// token/price amounts (micro-unit balances stay well under 2^53) — this
/// reproduces the old `value as f64` result bit-for-bit. Values too large for
/// `f64` parse to `f64::INFINITY`, matching the saturating behavior of `as`,
/// so the `unwrap_or` fallback is unreachable for any integer string.
pub fn u128_to_f64(value: u128) -> f64 {
    value.to_string().parse().unwrap_or(f64::INFINITY)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn exact_for_small_values() {
        assert_eq!(u128_to_f64(0), 0.0);
        assert_eq!(u128_to_f64(1), 1.0);
        assert_eq!(u128_to_f64(1_000_000), 1_000_000.0);
        assert_eq!(u128_to_f64(123_456_789), 123_456_789.0);
    }

    #[test]
    fn exact_at_mantissa_boundary() {
        // 2^53 is the largest integer with an exact f64 representation.
        assert_eq!(u128_to_f64(9_007_199_254_740_992), 9_007_199_254_740_992.0);
    }

    #[test]
    fn ratio_matches_float_division() {
        // The earn LPP-price ratio path: quote / amount.
        let quote = 1_234_567_890_u128;
        let amount = 1_000_000_u128;
        assert_eq!(u128_to_f64(quote) / u128_to_f64(amount), 1234.56789);
    }
}
