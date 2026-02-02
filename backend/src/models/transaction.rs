use serde::{Deserialize, Serialize};

/// Transaction status
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum TxStatus {
    Pending,
    Confirmed,
    Failed,
}

/// Built transaction ready for signing
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BuiltTransaction {
    /// Cosmos SDK messages to sign
    pub messages: Vec<serde_json::Value>,
    /// Transaction memo
    pub memo: String,
    /// Estimated gas
    pub estimated_gas: u64,
    /// Gas price
    pub gas_price: String,
    /// Fee amount
    pub fee: TxFee,
}

/// Transaction fee
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxFee {
    pub amount: String,
    pub denom: String,
    pub gas_limit: u64,
}

/// Transaction result after broadcast
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct TxResult {
    pub tx_hash: String,
    pub status: TxStatus,
    pub height: Option<u64>,
    pub gas_used: Option<u64>,
    pub error: Option<String>,
}

/// Swap transaction status (for cross-chain swaps)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SwapTxStatus {
    /// Unique tracking ID
    pub tracking_id: String,
    /// Current status
    pub status: SwapStatus,
    /// Source chain transaction hash
    pub source_tx_hash: Option<String>,
    /// Destination chain transaction hash
    pub dest_tx_hash: Option<String>,
    /// Current hop in multi-hop swap
    pub current_hop: Option<u32>,
    /// Total number of hops
    pub total_hops: u32,
    /// Error message if failed
    pub error: Option<String>,
    /// Last update timestamp
    pub updated_at: String,
}

/// Status of a cross-chain swap
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "snake_case")]
pub enum SwapStatus {
    /// Waiting for source transaction
    Pending,
    /// Source transaction confirmed
    SourceConfirmed,
    /// Swap in progress (IBC transfer, DEX swap, etc.)
    InProgress,
    /// Swap completed successfully
    Completed,
    /// Swap failed
    Failed,
    /// Funds refunded after failure
    Refunded,
}

/// Gas estimation parameters
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GasEstimate {
    pub gas_limit: u64,
    pub gas_price: String,
    pub fee_amount: String,
    pub fee_denom: String,
}

/// Simulate transaction result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SimulateResult {
    pub gas_used: u64,
    pub gas_wanted: u64,
    pub success: bool,
    pub log: Option<String>,
}
