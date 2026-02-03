//! Migration script to migrate JSON config files to PostgreSQL.
//!
//! This script reads existing JSON configuration files and inserts them into
//! the PostgreSQL database for the gated propagation system.
//!
//! Usage:
//!   DATABASE_URL=postgres://... cargo run --bin migrate_config
//!
//! The script is idempotent - it uses upsert operations so it can be run multiple times.

use rust_decimal::Decimal;
use serde::{Deserialize, Serialize};
use sqlx::postgres::PgPool;
use std::collections::HashMap;
use std::path::Path;

// ============================================================================
// JSON Config Types (matching existing JSON structure)
// ============================================================================

#[derive(Debug, Deserialize)]
struct CurrenciesConfig {
    icons: String,
    currencies: HashMap<String, CurrencyInfo>,
    #[serde(default)]
    map: HashMap<String, String>,
}

#[derive(Debug, Deserialize)]
struct CurrencyInfo {
    name: String,
    #[serde(rename = "shortName")]
    short_name: String,
    #[serde(rename = "coinGeckoId")]
    coin_gecko_id: String,
    symbol: String,
}

#[derive(Debug, Deserialize)]
struct NetworksConfig {
    networks: HashMap<String, NetworkInfo>,
    native_asset: NativeAsset,
}

#[derive(Debug, Deserialize)]
struct NetworkInfo {
    name: String,
    chain_id: String,
    prefix: String,
    native_denom: String,
    gas_price: String,
    explorer: String,
    #[serde(default = "default_decimal_digits")]
    decimal_digits: u8,
    symbol: String,
    value: String,
    #[serde(default)]
    native: bool,
    #[serde(default)]
    estimation: Option<u32>,
    chain_type: String,
    icon: String,
}

#[derive(Debug, Deserialize)]
struct NativeAsset {
    ticker: String,
    symbol: String,
    denom: String,
    decimal_digits: u8,
}

fn default_decimal_digits() -> u8 {
    6
}

#[derive(Debug, Deserialize)]
struct DownpaymentRangesConfig {
    #[serde(flatten)]
    protocols: HashMap<String, HashMap<String, DownpaymentRange>>,
}

#[derive(Debug, Deserialize)]
struct DownpaymentRange {
    min: f64,
    max: f64,
}

#[derive(Debug, Deserialize)]
#[serde(transparent)]
struct StringArrayConfig(Vec<String>);

// ============================================================================
// Migration Functions
// ============================================================================

async fn migrate_currencies(pool: &PgPool, config_dir: &Path) -> anyhow::Result<usize> {
    let path = config_dir.join("currencies.json");
    if !path.exists() {
        println!("  ⚠ currencies.json not found, skipping");
        return Ok(0);
    }

    let content = tokio::fs::read_to_string(&path).await?;
    let config: CurrenciesConfig = serde_json::from_str(&content)?;

    let mut count = 0;
    for (ticker, info) in config.currencies {
        // Build icon URL from base path
        let icon_url = format!("{}/{}.svg", config.icons, ticker.to_lowercase());

        sqlx::query(
            r#"INSERT INTO currency_display (ticker, icon_url, color, display_name, coingecko_id)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (ticker) DO UPDATE SET
               icon_url = EXCLUDED.icon_url,
               display_name = EXCLUDED.display_name,
               coingecko_id = EXCLUDED.coingecko_id,
               updated_at = NOW()"#,
        )
        .bind(&ticker)
        .bind(&icon_url)
        .bind(Option::<String>::None) // No color in original config
        .bind(&info.name)
        .bind(&info.coin_gecko_id)
        .execute(pool)
        .await?;

        count += 1;
    }

    Ok(count)
}

async fn migrate_networks(pool: &PgPool, config_dir: &Path) -> anyhow::Result<usize> {
    let path = config_dir.join("networks.json");
    if !path.exists() {
        println!("  ⚠ networks.json not found, skipping");
        return Ok(0);
    }

    let content = tokio::fs::read_to_string(&path).await?;
    let config: NetworksConfig = serde_json::from_str(&content)?;

    let mut count = 0;
    for (network_key, info) in config.networks {
        // Extract numeric gas price from string like "0.0025unls"
        let gas_price_str = info
            .gas_price
            .chars()
            .take_while(|c| c.is_ascii_digit() || *c == '.')
            .collect::<String>();
        let gas_price: Decimal = gas_price_str.parse().unwrap_or_else(|_| Decimal::ZERO);

        sqlx::query(
            r#"INSERT INTO network_config (network_key, explorer_url, gas_price, gas_multiplier, primary_protocol)
               VALUES ($1, $2, $3, $4, $5)
               ON CONFLICT (network_key) DO UPDATE SET
               explorer_url = EXCLUDED.explorer_url,
               gas_price = EXCLUDED.gas_price,
               updated_at = NOW()"#,
        )
        .bind(&network_key)
        .bind(&info.explorer)
        .bind(&gas_price)
        .bind(Decimal::new(15, 1)) // Default 1.5 multiplier
        .bind(Option::<String>::None) // No primary protocol in original config
        .execute(pool)
        .await?;

        count += 1;
    }

    Ok(count)
}

async fn migrate_downpayment_ranges(pool: &PgPool, config_dir: &Path) -> anyhow::Result<usize> {
    let path = config_dir.join("lease/downpayment-ranges.json");
    if !path.exists() {
        println!("  ⚠ lease/downpayment-ranges.json not found, skipping");
        return Ok(0);
    }

    let content = tokio::fs::read_to_string(&path).await?;
    let config: DownpaymentRangesConfig = serde_json::from_str(&content)?;

    let mut count = 0;
    for (protocol, assets) in config.protocols {
        for (asset_ticker, range) in assets {
            let min_amount = Decimal::try_from(range.min).unwrap_or_default();
            let max_amount = Decimal::try_from(range.max).unwrap_or_default();

            sqlx::query(
                r#"INSERT INTO lease_downpayment_ranges (protocol, asset_ticker, min_amount, max_amount)
                   VALUES ($1, $2, $3, $4)
                   ON CONFLICT (protocol, asset_ticker) DO UPDATE SET
                   min_amount = EXCLUDED.min_amount,
                   max_amount = EXCLUDED.max_amount,
                   updated_at = NOW()"#,
            )
            .bind(&protocol)
            .bind(&asset_ticker)
            .bind(&min_amount)
            .bind(&max_amount)
            .execute(pool)
            .await?;

            count += 1;
        }
    }

    Ok(count)
}

async fn migrate_asset_restrictions(
    pool: &PgPool,
    config_dir: &Path,
    filename: &str,
    restriction_type: &str,
) -> anyhow::Result<usize> {
    let path = config_dir.join(filename);
    if !path.exists() {
        println!("  ⚠ {} not found, skipping", filename);
        return Ok(0);
    }

    let content = tokio::fs::read_to_string(&path).await?;
    let config: StringArrayConfig = serde_json::from_str(&content)?;

    let mut count = 0;
    for ticker in config.0 {
        sqlx::query(
            r#"INSERT INTO asset_restrictions (ticker, restriction_type, reason)
               VALUES ($1, $2, $3)
               ON CONFLICT (ticker, restriction_type) DO NOTHING"#,
        )
        .bind(&ticker)
        .bind(restriction_type)
        .bind(Option::<String>::None)
        .execute(pool)
        .await?;

        count += 1;
    }

    Ok(count)
}

async fn migrate_swap_blacklist(pool: &PgPool, config_dir: &Path) -> anyhow::Result<usize> {
    let path = config_dir.join("swap/skip-route-config.json");
    if !path.exists() {
        println!("  ⚠ swap/skip-route-config.json not found, skipping");
        return Ok(0);
    }

    let content = tokio::fs::read_to_string(&path).await?;
    let config: serde_json::Value = serde_json::from_str(&content)?;

    let blacklist = config
        .get("blacklist")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    let mut count = 0;
    for item in blacklist {
        if let Some(ticker) = item.as_str() {
            sqlx::query(
                r#"INSERT INTO asset_restrictions (ticker, restriction_type, reason)
                   VALUES ($1, $2, $3)
                   ON CONFLICT (ticker, restriction_type) DO NOTHING"#,
            )
            .bind(ticker)
            .bind("swap_blacklist")
            .bind(Option::<String>::None)
            .execute(pool)
            .await?;

            count += 1;
        }
    }

    // Also store the swap config values
    if let Some(api_url) = config.get("api_url").and_then(|v| v.as_str()) {
        sqlx::query(
            r#"INSERT INTO swap_config (key, value)
               VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"#,
        )
        .bind("api_url")
        .bind(api_url)
        .execute(pool)
        .await?;
    }

    if let Some(slippage) = config.get("slippage").and_then(|v| v.as_u64()) {
        sqlx::query(
            r#"INSERT INTO swap_config (key, value)
               VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"#,
        )
        .bind("slippage")
        .bind(slippage.to_string())
        .execute(pool)
        .await?;
    }

    if let Some(fee) = config.get("fee").and_then(|v| v.as_u64()) {
        sqlx::query(
            r#"INSERT INTO swap_config (key, value)
               VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"#,
        )
        .bind("fee")
        .bind(fee.to_string())
        .execute(pool)
        .await?;
    }

    if let Some(timeout) = config.get("timeoutSeconds").and_then(|v| v.as_str()) {
        sqlx::query(
            r#"INSERT INTO swap_config (key, value)
               VALUES ($1, $2)
               ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"#,
        )
        .bind("timeout_seconds")
        .bind(timeout)
        .execute(pool)
        .await?;
    }

    // Migrate swap venues
    if let Some(venues) = config.get("swap_venues").and_then(|v| v.as_array()) {
        for venue in venues {
            if let (Some(name), Some(chain_id)) = (
                venue.get("name").and_then(|v| v.as_str()),
                venue.get("chain_id").and_then(|v| v.as_str()),
            ) {
                // Get address from the config if present
                let address = venue
                    .get("address")
                    .and_then(|v| v.as_str())
                    .unwrap_or("");

                sqlx::query(
                    r#"INSERT INTO swap_venues (name, chain_id, address, is_active)
                       VALUES ($1, $2, $3, true)
                       ON CONFLICT DO NOTHING"#,
                )
                .bind(name)
                .bind(chain_id)
                .bind(address)
                .execute(pool)
                .await?;
            }
        }
    }

    Ok(count)
}

async fn migrate_hidden_proposals(pool: &PgPool, config_dir: &Path) -> anyhow::Result<usize> {
    let path = config_dir.join("governance/hidden-proposals.json");
    if !path.exists() {
        println!("  ⚠ governance/hidden-proposals.json not found, skipping");
        return Ok(0);
    }

    let content = tokio::fs::read_to_string(&path).await?;
    let config: serde_json::Value = serde_json::from_str(&content)?;

    let hidden = config
        .get("hide")
        .and_then(|v| v.as_array())
        .cloned()
        .unwrap_or_default();

    // Store as JSON in ui_settings
    let hidden_json = serde_json::json!(hidden);

    sqlx::query(
        r#"INSERT INTO ui_settings (key, value)
           VALUES ($1, $2)
           ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = NOW()"#,
    )
    .bind("hidden_proposals")
    .bind(&hidden_json)
    .execute(pool)
    .await?;

    Ok(hidden.len())
}

// ============================================================================
// Main
// ============================================================================

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Load environment variables
    dotenvy::dotenv().ok();

    println!("╔════════════════════════════════════════════════════════════════╗");
    println!("║         Gated Propagation Config Migration Script              ║");
    println!("╚════════════════════════════════════════════════════════════════╝");
    println!();

    // Get database URL
    let database_url = std::env::var("DATABASE_URL")
        .expect("DATABASE_URL environment variable must be set");

    // Get config directory
    let config_dir = std::env::var("CONFIG_DIR").unwrap_or_else(|_| "./config".to_string());
    let config_path = Path::new(&config_dir);

    println!("📂 Config directory: {}", config_dir);
    println!("🗄️  Database: {}...", &database_url[..database_url.len().min(50)]);
    println!();

    // Connect to database
    println!("🔌 Connecting to database...");
    let pool = PgPool::connect(&database_url).await?;
    println!("✅ Connected successfully");
    println!();

    // Run migrations
    println!("📦 Running database migrations...");
    sqlx::migrate!("./migrations").run(&pool).await?;
    println!("✅ Migrations complete");
    println!();

    // Migrate data
    println!("🚀 Starting data migration...");
    println!();

    // Currencies
    print!("  💰 Migrating currencies... ");
    let count = migrate_currencies(&pool, config_path).await?;
    println!("{} records", count);

    // Networks
    print!("  🌐 Migrating networks... ");
    let count = migrate_networks(&pool, config_path).await?;
    println!("{} records", count);

    // Downpayment ranges
    print!("  📊 Migrating downpayment ranges... ");
    let count = migrate_downpayment_ranges(&pool, config_path).await?;
    println!("{} records", count);

    // Asset restrictions - ignored
    print!("  🚫 Migrating ignored assets... ");
    let count = migrate_asset_restrictions(
        &pool,
        config_path,
        "lease/ignore-assets.json",
        "ignored",
    )
    .await?;
    println!("{} records", count);

    // Asset restrictions - disabled long
    print!("  🚫 Migrating disabled long assets... ");
    let count = migrate_asset_restrictions(
        &pool,
        config_path,
        "lease/ignore-lease-long-assets.json",
        "disabled_long",
    )
    .await?;
    println!("{} records", count);

    // Asset restrictions - disabled short
    print!("  🚫 Migrating disabled short assets... ");
    let count = migrate_asset_restrictions(
        &pool,
        config_path,
        "lease/ignore-lease-short-assets.json",
        "disabled_short",
    )
    .await?;
    println!("{} records", count);

    // Swap blacklist and config
    print!("  🔄 Migrating swap config... ");
    let count = migrate_swap_blacklist(&pool, config_path).await?;
    println!("{} blacklist records", count);

    // Hidden proposals
    print!("  🗳️  Migrating hidden proposals... ");
    let count = migrate_hidden_proposals(&pool, config_path).await?;
    println!("{} records", count);

    println!();
    println!("════════════════════════════════════════════════════════════════");
    println!("✅ Migration complete!");
    println!();
    println!("Next steps:");
    println!("  1. Verify data: SELECT COUNT(*) FROM currency_display;");
    println!("  2. Set protocols as configured via admin API");
    println!("  3. Test the /api/currencies endpoint");
    println!();

    Ok(())
}
