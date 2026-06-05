//! Cache durations for different data types

/// Prices change frequently - very short cache
pub const PRICES: u32 = 10;
/// Config rarely changes - long cache
pub const CONFIG: u32 = 3600;
/// Webapp config (admin settings) - medium cache
pub const WEBAPP_CONFIG: u32 = 300;
/// Validators list - medium cache
pub const VALIDATORS: u32 = 300;
/// Earn pools - short cache
pub const EARN_POOLS: u32 = 60;
/// Default for unspecified endpoints
pub const DEFAULT: u32 = 30;
