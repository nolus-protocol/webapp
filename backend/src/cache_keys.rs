//! Cache key constants for consistent cache key management
//!
//! Using constants instead of string literals prevents typos and makes
//! cache key usage discoverable through IDE autocomplete.

#![allow(dead_code)]

/// Cache keys for price data
pub mod prices {
    /// All prices aggregated
    pub const ALL_PRICES: &str = "all_prices";

    /// Price for a specific currency (use with format!)
    pub const CURRENCY_PRICE_PREFIX: &str = "price:";

    /// Build a currency-specific price key
    pub fn currency_key(currency: &str) -> String {
        format!("{}{}", CURRENCY_PRICE_PREFIX, currency)
    }
}

/// Cache keys for configuration data
pub mod config {
    /// All currencies
    pub const CURRENCIES: &str = "currencies";

    /// Protocol configuration
    pub const PROTOCOLS: &str = "protocols";

    /// Network configuration
    pub const NETWORKS: &str = "networks";

    /// Full app configuration
    pub const APP_CONFIG: &str = "app_config";

    /// Protocol-specific configuration (use with format!)
    pub const PROTOCOL_PREFIX: &str = "protocol:";

    /// Build a protocol-specific config key
    pub fn protocol_key(protocol: &str) -> String {
        format!("{}{}", PROTOCOL_PREFIX, protocol)
    }
}

/// Cache keys for APR data
pub mod apr {
    /// Staking APR
    pub const STAKING_APR: &str = "staking_apr";

    /// Earn APR for all pools
    pub const EARN_APR_ALL: &str = "earn_apr_all";

    /// Protocol-specific earn APR (use with format!)
    pub const EARN_APR_PREFIX: &str = "earn_apr:";

    /// Build a protocol-specific APR key
    pub fn earn_apr_key(protocol: &str) -> String {
        format!("{}{}", EARN_APR_PREFIX, protocol)
    }
}

/// Cache keys for pool data
pub mod pools {
    /// All earn pools
    pub const ALL_POOLS: &str = "all_pools";

    /// Pool-specific data (use with format!)
    pub const POOL_PREFIX: &str = "pool:";

    /// Build a pool-specific key
    pub fn pool_key(pool_id: &str) -> String {
        format!("{}{}", POOL_PREFIX, pool_id)
    }
}

/// Cache keys for validator data
pub mod validators {
    /// All validators
    pub const ALL_VALIDATORS: &str = "all_validators";

    /// Validator-specific data (use with format!)
    pub const VALIDATOR_PREFIX: &str = "validator:";

    /// Build a validator-specific key
    pub fn validator_key(address: &str) -> String {
        format!("{}{}", VALIDATOR_PREFIX, address)
    }
}

/// Cache keys for governance data
pub mod governance {
    /// All proposals
    pub const PROPOSALS: &str = "proposals";

    /// Tallying params
    pub const TALLYING_PARAMS: &str = "tallying_params";

    /// Staking pool
    pub const STAKING_POOL: &str = "staking_pool";

    /// Annual inflation
    pub const ANNUAL_INFLATION: &str = "annual_inflation";
}

/// Cache keys for general data
pub mod data {
    /// TVL data
    pub const TVL: &str = "tvl";

    /// Stats overview
    pub const STATS_OVERVIEW: &str = "stats_overview";
}

/// Cache keys for ETL proxy data (global, cacheable endpoints)
pub mod etl {
    /// ETL pools endpoint
    pub const POOLS: &str = "etl:pools";
    /// Total value locked
    pub const TVL: &str = "etl:total-value-locked";
    /// Total transaction volume
    pub const TX_VOLUME: &str = "etl:total-tx-value";
    /// Monthly leases
    pub const LEASES_MONTHLY: &str = "etl:leases-monthly";
    /// Open position value
    pub const OPEN_POSITION_VALUE: &str = "etl:open-position-value";
    /// Open interest
    pub const OPEN_INTEREST: &str = "etl:open-interest";
    /// Unrealized PnL
    pub const UNREALIZED_PNL: &str = "etl:unrealized-pnl";
    /// Realized PnL stats
    pub const REALIZED_PNL_STATS: &str = "etl:realized-pnl-stats";
    /// Supplied funds
    pub const SUPPLIED_FUNDS: &str = "etl:supplied-funds";
    /// Leased assets
    pub const LEASED_ASSETS: &str = "etl:leased-assets";
    /// Buyback total
    pub const BUYBACK_TOTAL: &str = "etl:buyback-total";
    /// Revenue
    pub const REVENUE: &str = "etl:revenue";
    /// Stats overview batch
    pub const STATS_OVERVIEW: &str = "etl:batch:stats-overview";
    /// Loans stats batch
    pub const LOANS_STATS: &str = "etl:batch:loans-stats";
    /// User dashboard batch
    pub const USER_DASHBOARD: &str = "etl:batch:user-dashboard";
    /// User history batch
    pub const USER_HISTORY: &str = "etl:batch:user-history";
}


