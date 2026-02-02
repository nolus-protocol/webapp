use reqwest::Client;
use serde::{Deserialize, Serialize};
use tracing::debug;

use crate::error::AppError;
use crate::http_utils::{RequestResultExt, ResponseExt, UrlBuilder};

/// ETL API client for blockchain data
///
/// Uses the current ETL API endpoints. Will be updated when new ETL schema is ready.
pub struct EtlClient {
    base_url: String,
    /// HTTP client - public for use by ETL proxy handlers
    pub client: Client,
}

/// API name constant for error messages
const API_NAME: &str = "ETL";

impl EtlClient {
    pub fn new(base_url: String, client: Client) -> Self {
        // Ensure base_url includes /api prefix for ETL endpoints
        let base_url = if base_url.ends_with("/api") {
            base_url
        } else {
            format!("{}/api", base_url.trim_end_matches('/'))
        };
        Self { base_url, client }
    }

    /// Get URL builder for this client
    fn url(&self) -> UrlBuilder {
        UrlBuilder::new(&self.base_url)
    }

    /// Fetch all protocols
    pub async fn fetch_protocols(&self) -> Result<Vec<EtlProtocol>, AppError> {
        let url = self.url().endpoint("protocols");
        debug!("Fetching protocols from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch protocols")
            .await?
            .check_status(API_NAME, "protocols")
            .await?
            .parse_json(API_NAME, "protocols")
            .await
    }

    /// Fetch all currencies
    pub async fn fetch_currencies(&self) -> Result<Vec<EtlCurrency>, AppError> {
        let url = self.url().endpoint("currencies");
        debug!("Fetching currencies from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch currencies")
            .await?
            .check_status(API_NAME, "currencies")
            .await?
            .parse_json(API_NAME, "currencies")
            .await
    }

    /// Fetch current prices
    pub async fn fetch_prices(&self) -> Result<Vec<EtlPrice>, AppError> {
        let url = self.url().endpoint("prices");
        debug!("Fetching prices from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch prices")
            .await?
            .check_status(API_NAME, "prices")
            .await?
            .parse_json(API_NAME, "prices")
            .await
    }

    /// Fetch pool/APR data
    pub async fn fetch_pools(&self) -> Result<Vec<EtlPool>, AppError> {
        let url = self.url().endpoint("pools");
        debug!("Fetching pools from {}", url);

        let response: EtlPoolsResponse = self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch pools")
            .await?
            .check_status(API_NAME, "pools")
            .await?
            .parse_json(API_NAME, "pools")
            .await?;
        
        Ok(response.protocols)
    }

    /// Fetch lease opening data
    pub async fn fetch_lease_opening(
        &self,
        lease_address: &str,
    ) -> Result<EtlLeaseOpening, AppError> {
        let url = self
            .url()
            .with_query("ls-opening", &[("lease", lease_address)]);
        debug!("Fetching lease opening from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch lease opening")
            .await?
            .check_status(API_NAME, "lease opening")
            .await?
            .parse_json(API_NAME, "lease opening")
            .await
    }

    /// Fetch PnL over time for a user
    pub async fn fetch_pnl_over_time(
        &self,
        address: &str,
        interval: &str,
    ) -> Result<Vec<EtlPnlPoint>, AppError> {
        let url = self.url().with_query(
            "pnl-over-time",
            &[("address", address), ("interval", interval)],
        );
        debug!("Fetching PnL over time from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch PnL over time")
            .await?
            .check_status(API_NAME, "PnL over time")
            .await?
            .parse_json(API_NAME, "PnL over time")
            .await
    }

    /// Fetch realized PnL (closed positions)
    pub async fn fetch_realized_pnl(
        &self,
        address: &str,
        skip: u32,
        limit: u32,
    ) -> Result<EtlRealizedPnlResponse, AppError> {
        let skip_str = skip.to_string();
        let limit_str = limit.to_string();
        let url = self.url().with_query(
            "ls-loan-closing",
            &[
                ("address", address),
                ("skip", &skip_str),
                ("limit", &limit_str),
            ],
        );
        debug!("Fetching realized PnL from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch realized PnL")
            .await?
            .check_status(API_NAME, "realized PnL")
            .await?
            .parse_json(API_NAME, "realized PnL")
            .await
    }

    /// Search leases by address
    pub async fn search_leases(
        &self,
        address: &str,
        skip: u32,
        limit: u32,
        search: Option<&str>,
    ) -> Result<Vec<String>, AppError> {
        let skip_str = skip.to_string();
        let limit_str = limit.to_string();
        let url = self.url().with_optional_query(
            "leases-search",
            &[
                ("address", Some(address)),
                ("skip", Some(&skip_str)),
                ("limit", Some(&limit_str)),
                ("search", search),
            ],
        );
        debug!("Searching leases from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "search leases")
            .await?
            .check_status(API_NAME, "leases search")
            .await?
            .parse_json(API_NAME, "leases search")
            .await
    }

    /// Fetch transaction history
    pub async fn fetch_transactions(
        &self,
        address: &str,
        skip: u32,
        limit: u32,
    ) -> Result<EtlTransactionsResponse, AppError> {
        let skip_str = skip.to_string();
        let limit_str = limit.to_string();
        let url = self.url().with_query(
            "txs",
            &[
                ("address", address),
                ("skip", &skip_str),
                ("limit", &limit_str),
            ],
        );
        debug!("Fetching transactions from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch transactions")
            .await?
            .check_status(API_NAME, "transactions")
            .await?
            .parse_json(API_NAME, "transactions")
            .await
    }

    /// Fetch TVL
    pub async fn fetch_tvl(&self) -> Result<EtlTvlResponse, AppError> {
        let url = self.url().endpoint("total-value-locked");
        debug!("Fetching TVL from {}", url);

        self.client
            .get(&url)
            .send()
            .await
            .with_context(API_NAME, "fetch TVL")
            .await?
            .check_status(API_NAME, "TVL")
            .await?
            .parse_json(API_NAME, "TVL")
            .await
    }
}

// ============================================================================
// ETL Response Types
// ============================================================================

/// Protocol from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlProtocol {
    pub key: String,
    pub network: String,
    pub dex: String,
    pub lpn: String,
    #[serde(default)]
    pub active: bool,
    // Add more fields as needed based on actual ETL response
}

/// Currency from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlCurrency {
    pub ticker: String,
    pub name: Option<String>,
    pub decimal_digits: u8,
    pub symbol: Option<String>,
    pub ibc_route: Option<String>,
    // Add more fields as needed
}

/// Price from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlPrice {
    pub ticker: String,
    pub amount: String,
    // Add more fields as needed
}

/// Pool data from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlPool {
    pub protocol: String,
    #[serde(alias = "earn_apr")]
    pub apr: Option<String>,
    pub utilization: Option<String>,
    #[serde(alias = "supplied")]
    pub total_supplied: Option<String>,
    #[serde(alias = "borrowed")]
    pub total_borrowed: Option<String>,
    pub borrow_apr: Option<String>,
    pub deposit_suspension: Option<String>,
}

/// Wrapper for ETL pools response
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlPoolsResponse {
    pub protocols: Vec<EtlPool>,
    pub optimal: Option<String>,
}

/// Lease opening data from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlLeaseOpening {
    pub lease: EtlLeaseInfo,
    /// Downpayment price (opening price for the downpayment)
    pub downpayment_price: Option<String>,
    /// LPN price at opening (for short positions)
    pub lpn_price: Option<String>,
    /// PnL in USD
    pub pnl: Option<String>,
    /// DEX/swap fee
    pub fee: Option<String>,
    /// Repayment value
    pub repayment_value: Option<String>,
    /// Transaction history for this lease
    #[serde(default)]
    pub history: Option<Vec<EtlLeaseHistoryEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlLeaseInfo {
    #[serde(rename = "LS_timestamp")]
    pub timestamp: Option<String>,
    #[serde(rename = "LS_cltr_amnt_stable")]
    pub downpayment_amount: Option<String>,
    #[serde(rename = "LS_loan_amnt_asset")]
    pub loan_amount: Option<String>,
    /// LS_asset_symbol is the leveraged asset (e.g., ALL_BTC)
    #[serde(rename = "LS_asset_symbol")]
    pub lease_position_ticker: Option<String>,
    /// LS_cltr_symbol is the collateral/downpayment symbol (e.g., USDC_NOBLE)
    #[serde(rename = "LS_cltr_symbol")]
    pub collateral_symbol: Option<String>,
    /// Opening price per asset (from LS_opening_price)
    #[serde(rename = "LS_opening_price")]
    pub opening_price: Option<String>,
    /// History is at the top level of EtlLeaseOpening, not here
    #[serde(default)]
    pub history: Option<Vec<EtlLeaseHistoryEntry>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlLeaseHistoryEntry {
    pub tx_hash: Option<String>,
    #[serde(rename = "type")]
    pub action: Option<String>,
    pub amount: Option<String>,
    pub symbol: Option<String>,
    #[serde(rename = "time")]
    pub timestamp: Option<String>,
}

/// PnL data point from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlPnlPoint {
    pub date: String,
    pub amount: String,
}

/// Realized PnL response from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlRealizedPnlResponse {
    pub data: Vec<EtlRealizedPnl>,
    pub total: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlRealizedPnl {
    pub lease_address: Option<String>,
    pub pnl: Option<String>,
    pub pnl_percent: Option<String>,
    pub closed_at: Option<String>,
}

/// Transactions response from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlTransactionsResponse {
    pub data: Vec<EtlTransaction>,
    pub total: Option<u32>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlTransaction {
    pub hash: String,
    pub height: Option<u64>,
    pub timestamp: Option<String>,
    pub r#type: Option<String>,
    pub data: Option<serde_json::Value>,
}

/// TVL response from ETL API
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EtlTvlResponse {
    pub total: Option<String>,
    pub by_protocol: Option<serde_json::Value>,
}
