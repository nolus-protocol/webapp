//! Database module for gated propagation system.
//!
//! This module provides PostgreSQL-backed storage for admin configuration data
//! that gets merged with ETL data before being served to the frontend.

use sqlx::postgres::{PgPool, PgPoolOptions};
use std::time::Duration;

pub mod models;

// Repository modules
pub mod asset_restrictions;
pub mod currency_display;
pub mod lease_rules;
pub mod network_config;
pub mod protocol_status;
pub mod swap_config;
pub mod ui_settings;

// Re-export commonly used items
pub use asset_restrictions::AssetRestrictionsRepo;
pub use currency_display::CurrencyDisplayRepo;
pub use lease_rules::LeaseRulesRepo;
pub use network_config::{NetworkConfigRepo, NetworkEndpointRepo};
pub use protocol_status::ProtocolStatusRepo;
pub use swap_config::{SwapConfigRepo, SwapVenueRepo};
pub use ui_settings::UiSettingsRepo;

/// Initialize the database connection pool.
///
/// # Errors
/// Returns an error if the connection cannot be established.
pub async fn init_pool(database_url: &str) -> Result<PgPool, sqlx::Error> {
    PgPoolOptions::new()
        .max_connections(10)
        .min_connections(2)
        .acquire_timeout(Duration::from_secs(5))
        .idle_timeout(Duration::from_secs(600))
        .connect(database_url)
        .await
}

/// Run pending database migrations.
///
/// # Errors
/// Returns an error if migrations fail.
pub async fn run_migrations(pool: &PgPool) -> Result<(), sqlx::migrate::MigrateError> {
    sqlx::migrate!("./migrations").run(pool).await
}
