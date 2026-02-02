//! WebSocket handlers for real-time updates
//!
//! Supported topics:
//! - prices: Real-time price updates for all currencies
//! - balances: Balance updates for specific addresses
//! - leases: Lease state changes for a user
//! - tx_status: Transaction confirmation status
//! - staking: Staking position updates
//! - skip_tx: Cross-chain transaction tracking
//! - earn: Earn position updates for a user

use axum::{
    extract::{
        ws::{Message, WebSocket, WebSocketUpgrade},
        State,
    },
    http::StatusCode,
    response::IntoResponse,
};
use dashmap::DashMap;
use futures::{sink::SinkExt, stream::StreamExt};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, HashSet};
use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use std::time::{Duration, Instant};
use tokio::sync::mpsc;
use tracing::{debug, error, info, warn};

use crate::AppState;

// ============================================================================
// Message Types
// ============================================================================

/// Client -> Server messages
#[derive(Debug, Clone, Deserialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ClientMessage {
    /// Subscribe to a topic
    Subscribe {
        topic: String,
        #[serde(flatten)]
        params: serde_json::Value,
    },
    /// Unsubscribe from a topic
    Unsubscribe {
        topic: String,
        #[serde(flatten)]
        params: serde_json::Value,
    },
    /// Ping for keepalive
    Ping,
}

/// Server -> Client messages
#[derive(Debug, Clone, Serialize)]
#[serde(tag = "type", rename_all = "snake_case")]
pub enum ServerMessage {
    /// Subscription confirmed
    Subscribed { topic: String },
    /// Unsubscription confirmed
    Unsubscribed { topic: String },
    /// Pong response
    Pong { timestamp: String },
    /// Error message
    Error { code: String, message: String },
    /// Price update
    PriceUpdate {
        prices: HashMap<String, String>,
        timestamp: String,
    },
    /// Balance update
    BalanceUpdate {
        chain: String,
        address: String,
        balances: Vec<BalanceInfo>,
        timestamp: String,
    },
    /// Lease update
    LeaseUpdate {
        address: String,
        lease_id: String,
        state: String,
        data: serde_json::Value,
        timestamp: String,
    },
    /// Transaction status update (pending, success, or failed)
    TxStatus {
        tx_hash: String,
        status: TxStatusValue,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    /// Staking update
    StakingUpdate {
        address: String,
        data: serde_json::Value,
    },
    /// Skip cross-chain transaction update
    SkipTxUpdate {
        tx_hash: String,
        status: TxStatusValue,
        steps_completed: u32,
        total_steps: u32,
        #[serde(skip_serializing_if = "Option::is_none")]
        error: Option<String>,
    },
    /// Earn position update
    EarnUpdate {
        address: String,
        positions: Vec<EarnPositionInfo>,
        total_deposited_usd: String,
    },
}

/// Earn position info for WebSocket updates
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct EarnPositionInfo {
    pub protocol: String,
    pub lpp_address: String,
    pub deposited_lpn: String,
    pub deposited_asset: String,
    pub rewards: String,
}

/// Transaction status values matching frontend expectations
#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum TxStatusValue {
    Pending,
    Success,
    Failed,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct BalanceInfo {
    pub denom: String,
    pub amount: String,
}

// ============================================================================
// Subscription Types
// ============================================================================

#[derive(Debug, Clone, PartialEq, Eq, Hash)]
pub enum Subscription {
    /// Subscribe to all price updates
    Prices,
    /// Subscribe to balance updates for addresses
    Balances { addresses: Vec<String> },
    /// Subscribe to lease updates for an address
    Leases { address: String },
    /// Subscribe to transaction status
    TxStatus { hash: String, chain_id: String },
    /// Subscribe to staking updates
    Staking { address: String },
    /// Subscribe to Skip transaction tracking
    SkipTx {
        tx_hash: String,
        source_chain: String,
    },
    /// Subscribe to earn position updates
    Earn { address: String },
}

impl Subscription {
    fn from_client_message(topic: &str, params: &serde_json::Value) -> Result<Self, String> {
        match topic {
            "prices" => Ok(Subscription::Prices),
            "balance" | "balances" => {
                let addresses = params
                    .get("addresses")
                    .and_then(|v| v.as_array())
                    .map(|arr| {
                        arr.iter()
                            .filter_map(|v| v.as_str().map(String::from))
                            .collect()
                    })
                    .or_else(|| {
                        params
                            .get("address")
                            .and_then(|v| v.as_str())
                            .map(|s| vec![s.to_string()])
                    })
                    .ok_or("Missing 'addresses' or 'address' parameter")?;
                Ok(Subscription::Balances { addresses })
            }
            "lease" | "leases" => {
                let address = params
                    .get("address")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing 'address' parameter")?
                    .to_string();
                Ok(Subscription::Leases { address })
            }
            "tx" | "tx_status" => {
                let hash = params
                    .get("hash")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing 'hash' parameter")?
                    .to_string();
                let chain_id = params
                    .get("chain_id")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing 'chain_id' parameter")?
                    .to_string();
                Ok(Subscription::TxStatus { hash, chain_id })
            }
            "staking" => {
                let address = params
                    .get("address")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing 'address' parameter")?
                    .to_string();
                Ok(Subscription::Staking { address })
            }
            "skip_tx" => {
                let tx_hash = params
                    .get("tx_hash")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing 'tx_hash' parameter")?
                    .to_string();
                let source_chain = params
                    .get("source_chain")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing 'source_chain' parameter")?
                    .to_string();
                Ok(Subscription::SkipTx {
                    tx_hash,
                    source_chain,
                })
            }
            "earn" => {
                let address = params
                    .get("address")
                    .and_then(|v| v.as_str())
                    .ok_or("Missing 'address' parameter")?
                    .to_string();
                Ok(Subscription::Earn { address })
            }
            _ => Err(format!("Unknown topic: {}", topic)),
        }
    }

    fn topic_name(&self) -> &'static str {
        match self {
            Subscription::Prices => "prices",
            Subscription::Balances { .. } => "balances",
            Subscription::Leases { .. } => "leases",
            Subscription::TxStatus { .. } => "tx_status",
            Subscription::Staking { .. } => "staking",
            Subscription::SkipTx { .. } => "skip_tx",
            Subscription::Earn { .. } => "earn",
        }
    }
}

// ============================================================================
// Connection State
// ============================================================================

/// Maximum number of WebSocket connections allowed
const MAX_CONNECTIONS: usize = 5000;

/// State for a single WebSocket connection
struct ConnectionState {
    subscriptions: HashSet<Subscription>,
    last_ping: Instant,
    message_tx: mpsc::Sender<ServerMessage>,
}

/// Cached lease state for change detection
#[derive(Debug, Clone, PartialEq)]
pub struct CachedLeaseState {
    pub status: String,
    pub amount: String,
    pub debt_total: String,
}

/// Cached Skip transaction state for tracking
#[derive(Debug, Clone, PartialEq)]
pub struct CachedSkipTxState {
    pub status: String,
    pub completed_hops: u32,
    pub total_hops: u32,
}

/// Cached earn position state for change detection
#[derive(Debug, Clone, PartialEq)]
pub struct CachedEarnState {
    pub positions: Vec<CachedEarnPosition>,
    pub total_deposited_usd: String,
}

/// Individual earn position in cache
#[derive(Debug, Clone, PartialEq)]
pub struct CachedEarnPosition {
    pub protocol: String,
    pub deposited_lpn: String,
    pub rewards: String,
}

/// Global WebSocket manager using DashMap for lock-free concurrent access
pub struct WebSocketManager {
    /// Active connections - DashMap provides fine-grained locking
    connections: DashMap<String, ConnectionState>,
    /// Connection counter for fast count and limit checking
    connection_count: AtomicUsize,
    /// Cached lease states for change detection (owner_address -> (lease_address -> state))
    lease_states: DashMap<String, HashMap<String, CachedLeaseState>>,
    /// Cached Skip transaction states (tx_hash -> state)
    skip_tx_states: DashMap<String, CachedSkipTxState>,
    /// Cached earn states for change detection (address -> state)
    earn_states: DashMap<String, CachedEarnState>,
}

impl WebSocketManager {
    pub fn new() -> Self {
        Self {
            connections: DashMap::new(),
            connection_count: AtomicUsize::new(0),
            lease_states: DashMap::new(),
            skip_tx_states: DashMap::new(),
            earn_states: DashMap::new(),
        }
    }

    /// Check if we can accept a new connection
    pub fn can_accept_connection(&self) -> bool {
        self.connection_count.load(Ordering::Relaxed) < MAX_CONNECTIONS
    }

    /// Broadcast a message to all connections subscribed to a topic
    /// Uses try_send for backpressure - drops messages for slow clients
    pub fn broadcast(&self, msg: ServerMessage) {
        for entry in self.connections.iter() {
            let conn = entry.value();
            if self.should_receive(&conn.subscriptions, &msg) {
                // Use try_send for backpressure - if channel is full, drop the message
                match conn.message_tx.try_send(msg.clone()) {
                    Ok(_) => {}
                    Err(mpsc::error::TrySendError::Full(_)) => {
                        debug!("Dropping message for slow client {}", entry.key());
                    }
                    Err(mpsc::error::TrySendError::Closed(_)) => {
                        // Connection will be cleaned up by the receive task
                    }
                }
            }
        }
    }

    /// Broadcast price updates to all price subscribers
    pub fn broadcast_prices(&self, prices: HashMap<String, String>) {
        let msg = ServerMessage::PriceUpdate {
            prices,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };
        self.broadcast(msg);
    }

    /// Send balance update to relevant subscribers
    pub fn send_balance_update(&self, chain: &str, address: &str, balances: Vec<BalanceInfo>) {
        let msg = ServerMessage::BalanceUpdate {
            chain: chain.to_string(),
            address: address.to_string(),
            balances,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        for entry in self.connections.iter() {
            let conn = entry.value();
            for sub in &conn.subscriptions {
                if let Subscription::Balances { addresses } = sub {
                    if addresses.contains(&address.to_string()) {
                        let _ = conn.message_tx.try_send(msg.clone());
                        break;
                    }
                }
            }
        }
    }

    /// Send lease update to relevant subscribers
    pub fn send_lease_update(
        &self,
        address: &str,
        lease_id: &str,
        state: &str,
        data: serde_json::Value,
    ) {
        let msg = ServerMessage::LeaseUpdate {
            address: address.to_string(),
            lease_id: lease_id.to_string(),
            state: state.to_string(),
            data,
            timestamp: chrono::Utc::now().to_rfc3339(),
        };

        for entry in self.connections.iter() {
            let conn = entry.value();
            for sub in &conn.subscriptions {
                if let Subscription::Leases { address: sub_addr } = sub {
                    if sub_addr == address {
                        let _ = conn.message_tx.try_send(msg.clone());
                        break;
                    }
                }
            }
        }
    }

    /// Send transaction status update to relevant subscribers
    pub fn send_tx_status(&self, tx_hash: &str, chain_id: &str, status: TxStatusValue, error: Option<String>) {
        let msg = ServerMessage::TxStatus {
            tx_hash: tx_hash.to_string(),
            status,
            error,
        };

        for entry in self.connections.iter() {
            let conn = entry.value();
            for sub in &conn.subscriptions {
                if let Subscription::TxStatus {
                    hash: sub_hash,
                    chain_id: sub_chain,
                } = sub
                {
                    if sub_hash == tx_hash && sub_chain == chain_id {
                        let _ = conn.message_tx.try_send(msg.clone());
                        break;
                    }
                }
            }
        }
    }

    fn should_receive(&self, subscriptions: &HashSet<Subscription>, msg: &ServerMessage) -> bool {
        match msg {
            ServerMessage::PriceUpdate { .. } => subscriptions.contains(&Subscription::Prices),
            ServerMessage::BalanceUpdate { address, .. } => subscriptions.iter().any(|s| {
                if let Subscription::Balances { addresses } = s {
                    addresses.contains(address)
                } else {
                    false
                }
            }),
            ServerMessage::LeaseUpdate { address, .. } => subscriptions.iter().any(|s| {
                if let Subscription::Leases { address: sub_addr } = s {
                    sub_addr == address
                } else {
                    false
                }
            }),
            _ => true,
        }
    }

    fn add_connection(&self, id: String, tx: mpsc::Sender<ServerMessage>) {
        self.connections.insert(
            id,
            ConnectionState {
                subscriptions: HashSet::new(),
                last_ping: Instant::now(),
                message_tx: tx,
            },
        );
        self.connection_count.fetch_add(1, Ordering::Relaxed);
    }

    fn remove_connection(&self, id: &str) {
        if self.connections.remove(id).is_some() {
            self.connection_count.fetch_sub(1, Ordering::Relaxed);
        }
    }

    fn add_subscription(&self, conn_id: &str, sub: Subscription) -> bool {
        if let Some(mut conn) = self.connections.get_mut(conn_id) {
            conn.subscriptions.insert(sub);
            true
        } else {
            false
        }
    }

    fn remove_subscription(&self, conn_id: &str, sub: &Subscription) -> bool {
        if let Some(mut conn) = self.connections.get_mut(conn_id) {
            conn.subscriptions.remove(sub);
            true
        } else {
            false
        }
    }

    fn update_ping(&self, conn_id: &str) {
        if let Some(mut conn) = self.connections.get_mut(conn_id) {
            conn.last_ping = Instant::now();
        }
    }

    pub fn connection_count(&self) -> usize {
        self.connection_count.load(Ordering::Relaxed)
    }

    /// Get all unique owner addresses that have lease subscriptions
    pub fn get_subscribed_lease_owners(&self) -> Vec<String> {
        let mut owners = HashSet::new();
        for entry in self.connections.iter() {
            for sub in &entry.value().subscriptions {
                if let Subscription::Leases { address } = sub {
                    owners.insert(address.clone());
                }
            }
        }
        owners.into_iter().collect()
    }

    /// Update cached lease state and return true if it changed
    pub fn update_lease_state(
        &self,
        owner: &str,
        lease_address: &str,
        new_state: CachedLeaseState,
    ) -> bool {
        let mut owner_leases = self.lease_states.entry(owner.to_string()).or_default();

        if let Some(old_state) = owner_leases.get(lease_address) {
            if old_state == &new_state {
                return false; // No change
            }
        }

        owner_leases.insert(lease_address.to_string(), new_state);
        true // State changed
    }

    /// Check if a lease is new (not in cache)
    pub fn is_new_lease(&self, owner: &str, lease_address: &str) -> bool {
        if let Some(owner_leases) = self.lease_states.get(owner) {
            !owner_leases.contains_key(lease_address)
        } else {
            true
        }
    }

    /// Remove a lease from cache (when closed/liquidated)
    pub fn remove_lease_from_cache(&self, owner: &str, lease_address: &str) {
        if let Some(mut owner_leases) = self.lease_states.get_mut(owner) {
            owner_leases.remove(lease_address);
        }
    }

    /// Clear lease cache for an owner (when they unsubscribe)
    pub fn clear_lease_cache(&self, owner: &str) {
        self.lease_states.remove(owner);
    }

    // =========================================================================
    // Skip Transaction Tracking
    // =========================================================================

    /// Get all Skip transactions being tracked
    pub fn get_tracked_skip_txs(&self) -> Vec<(String, String)> {
        let mut txs = Vec::new();
        for entry in self.connections.iter() {
            for sub in &entry.value().subscriptions {
                if let Subscription::SkipTx {
                    tx_hash,
                    source_chain,
                } = sub
                {
                    txs.push((tx_hash.clone(), source_chain.clone()));
                }
            }
        }
        // Deduplicate
        txs.sort();
        txs.dedup();
        txs
    }

    /// Update Skip transaction state and return true if changed
    pub fn update_skip_tx_state(
        &self,
        tx_hash: &str,
        new_state: CachedSkipTxState,
    ) -> (bool, Option<CachedSkipTxState>) {
        let old_state = self.skip_tx_states.get(tx_hash).map(|s| s.clone());

        let changed = match &old_state {
            Some(old) => old != &new_state,
            None => true,
        };

        if changed {
            self.skip_tx_states.insert(tx_hash.to_string(), new_state);
        }

        (changed, old_state)
    }

    /// Remove Skip transaction from tracking (when complete or failed)
    pub fn remove_skip_tx(&self, tx_hash: &str) {
        self.skip_tx_states.remove(tx_hash);
    }

    /// Send Skip transaction update to subscribers
    pub fn send_skip_tx_update(
        &self,
        tx_hash: &str,
        status: TxStatusValue,
        steps_completed: u32,
        total_steps: u32,
        error: Option<String>,
    ) {
        let msg = ServerMessage::SkipTxUpdate {
            tx_hash: tx_hash.to_string(),
            status,
            steps_completed,
            total_steps,
            error,
        };

        for entry in self.connections.iter() {
            let conn = entry.value();
            for sub in &conn.subscriptions {
                if let Subscription::SkipTx {
                    tx_hash: sub_hash, ..
                } = sub
                {
                    if sub_hash == tx_hash {
                        let _ = conn.message_tx.try_send(msg.clone());
                        break;
                    }
                }
            }
        }
    }

    // =========================================================================
    // Earn Position Tracking
    // =========================================================================

    /// Get all unique addresses that have earn subscriptions
    pub fn get_subscribed_earn_addresses(&self) -> Vec<String> {
        let mut addresses = HashSet::new();
        for entry in self.connections.iter() {
            for sub in &entry.value().subscriptions {
                if let Subscription::Earn { address } = sub {
                    addresses.insert(address.clone());
                }
            }
        }
        addresses.into_iter().collect()
    }

    /// Update cached earn state and return true if it changed
    pub fn update_earn_state(&self, address: &str, new_state: CachedEarnState) -> bool {
        let old_state = self.earn_states.get(address).map(|s| s.clone());

        let changed = match &old_state {
            Some(old) => old != &new_state,
            None => true,
        };

        if changed {
            self.earn_states.insert(address.to_string(), new_state);
        }

        changed
    }

    /// Clear earn cache for an address (when they unsubscribe)
    pub fn clear_earn_cache(&self, address: &str) {
        self.earn_states.remove(address);
    }

    /// Send earn update to subscribers
    pub fn send_earn_update(
        &self,
        address: &str,
        positions: Vec<EarnPositionInfo>,
        total_deposited_usd: String,
    ) {
        let msg = ServerMessage::EarnUpdate {
            address: address.to_string(),
            positions,
            total_deposited_usd,
        };

        for entry in self.connections.iter() {
            let conn = entry.value();
            for sub in &conn.subscriptions {
                if let Subscription::Earn { address: sub_addr } = sub {
                    if sub_addr == address {
                        let _ = conn.message_tx.try_send(msg.clone());
                        break;
                    }
                }
            }
        }
    }
}

impl Default for WebSocketManager {
    fn default() -> Self {
        Self::new()
    }
}

// ============================================================================
// Handlers
// ============================================================================

/// WebSocket upgrade handler
pub async fn websocket_handler(
    ws: WebSocketUpgrade,
    State(state): State<Arc<AppState>>,
) -> impl IntoResponse {
    // Check connection limit before accepting
    if !state.ws_manager.can_accept_connection() {
        return (
            StatusCode::SERVICE_UNAVAILABLE,
            "Too many WebSocket connections",
        )
            .into_response();
    }

    ws.on_upgrade(move |socket| handle_socket(socket, state))
        .into_response()
}

async fn handle_socket(socket: WebSocket, state: Arc<AppState>) {
    let conn_id = uuid::Uuid::new_v4().to_string();
    info!("WebSocket connection opened: {}", conn_id);

    let (mut ws_sender, mut ws_receiver) = socket.split();

    // Channel for sending messages to this connection (bounded for backpressure)
    let (msg_tx, mut msg_rx) = mpsc::channel::<ServerMessage>(100);

    // Register connection with manager
    state.ws_manager.add_connection(conn_id.clone(), msg_tx);

    // Spawn task to forward messages to WebSocket
    let send_conn_id = conn_id.clone();
    let send_task = tokio::spawn(async move {
        while let Some(msg) = msg_rx.recv().await {
            match serde_json::to_string(&msg) {
                Ok(json) => {
                    if ws_sender.send(Message::Text(json.into())).await.is_err() {
                        debug!("Failed to send message to {}", send_conn_id);
                        break;
                    }
                }
                Err(e) => {
                    error!("Failed to serialize message: {}", e);
                }
            }
        }
    });

    // Handle incoming messages
    let recv_conn_id = conn_id.clone();
    let recv_state = state.clone();
    while let Some(result) = ws_receiver.next().await {
        match result {
            Ok(Message::Text(text)) => {
                handle_text_message(&recv_conn_id, text.as_str(), &recv_state).await;
            }
            Ok(Message::Binary(_)) => {
                // Binary messages not supported
                warn!("Received binary message from {}", recv_conn_id);
            }
            Ok(Message::Ping(_)) => {
                // Axum handles pong automatically
                debug!("Received ping from {}", recv_conn_id);
            }
            Ok(Message::Pong(_)) => {
                recv_state.ws_manager.update_ping(&recv_conn_id);
            }
            Ok(Message::Close(_)) => {
                info!("WebSocket close requested: {}", recv_conn_id);
                break;
            }
            Err(e) => {
                error!("WebSocket error for {}: {}", recv_conn_id, e);
                break;
            }
        }
    }

    // Cleanup
    send_task.abort();
    state.ws_manager.remove_connection(&conn_id);
    info!("WebSocket connection closed: {}", conn_id);
}

async fn handle_text_message(conn_id: &str, text: &str, state: &Arc<AppState>) {
    let msg: ClientMessage = match serde_json::from_str(text) {
        Ok(m) => m,
        Err(e) => {
            debug!("Invalid message from {}: {}", conn_id, e);
            send_error(conn_id, state, "INVALID_MESSAGE", "Failed to parse message");
            return;
        }
    };

    match msg {
        ClientMessage::Subscribe { topic, params } => {
            handle_subscribe(conn_id, &topic, &params, state).await;
        }
        ClientMessage::Unsubscribe { topic, params } => {
            handle_unsubscribe(conn_id, &topic, &params, state).await;
        }
        ClientMessage::Ping => {
            handle_ping(conn_id, state).await;
        }
    }
}

async fn handle_subscribe(
    conn_id: &str,
    topic: &str,
    params: &serde_json::Value,
    state: &Arc<AppState>,
) {
    match Subscription::from_client_message(topic, params) {
        Ok(sub) => {
            let topic_name = sub.topic_name().to_string();
            if state.ws_manager.add_subscription(conn_id, sub) {
                send_message(
                    conn_id,
                    state,
                    ServerMessage::Subscribed { topic: topic_name },
                );
            }
        }
        Err(e) => {
            send_error(conn_id, state, "INVALID_SUBSCRIPTION", &e);
        }
    }
}

async fn handle_unsubscribe(
    conn_id: &str,
    topic: &str,
    params: &serde_json::Value,
    state: &Arc<AppState>,
) {
    match Subscription::from_client_message(topic, params) {
        Ok(sub) => {
            let topic_name = sub.topic_name().to_string();
            state.ws_manager.remove_subscription(conn_id, &sub);
            send_message(
                conn_id,
                state,
                ServerMessage::Unsubscribed { topic: topic_name },
            );
        }
        Err(e) => {
            send_error(conn_id, state, "INVALID_SUBSCRIPTION", &e);
        }
    }
}

async fn handle_ping(conn_id: &str, state: &Arc<AppState>) {
    state.ws_manager.update_ping(conn_id);
    send_message(
        conn_id,
        state,
        ServerMessage::Pong {
            timestamp: chrono::Utc::now().to_rfc3339(),
        },
    );
}

fn send_message(conn_id: &str, state: &Arc<AppState>, msg: ServerMessage) {
    if let Some(conn) = state.ws_manager.connections.get(conn_id) {
        let _ = conn.message_tx.try_send(msg);
    }
}

fn send_error(conn_id: &str, state: &Arc<AppState>, code: &str, message: &str) {
    send_message(
        conn_id,
        state,
        ServerMessage::Error {
            code: code.to_string(),
            message: message.to_string(),
        },
    );
}

// ============================================================================
// Background Tasks
// ============================================================================

/// Start background task for price updates
pub async fn start_price_update_task(state: Arc<AppState>) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(15));

        loop {
            interval.tick().await;

            // Only fetch prices if there are subscribers
            if state.ws_manager.connection_count() == 0 {
                continue;
            }

            // Fetch prices from chain
            match fetch_prices(&state).await {
                Ok(prices) => {
                    state.ws_manager.broadcast_prices(prices);
                }
                Err(e) => {
                    error!("Failed to fetch prices for WebSocket broadcast: {}", e);
                }
            }
        }
    });
}

async fn fetch_prices(state: &AppState) -> Result<HashMap<String, String>, String> {
    // Get protocols and fetch prices from each oracle
    let admin_address = &state.config.protocols.admin_contract;

    let protocols = state
        .chain_client
        .get_admin_protocols(admin_address)
        .await
        .map_err(|e| e.to_string())?;

    let mut prices = HashMap::new();

    for protocol in protocols.iter().take(1) {
        // Start with first protocol
        let protocol_info = state
            .chain_client
            .get_admin_protocol(admin_address, protocol)
            .await
            .map_err(|e| e.to_string())?;

        let oracle_prices = state
            .chain_client
            .get_oracle_prices(&protocol_info.contracts.oracle)
            .await
            .map_err(|e| e.to_string())?;

        for price in oracle_prices.prices {
            // Calculate price ratio
            let amount: f64 = price.amount.amount.parse().unwrap_or(1.0);
            let quote: f64 = price.amount_quote.amount.parse().unwrap_or(0.0);
            if amount > 0.0 {
                let price_val = quote / amount;
                prices.insert(price.amount.ticker, format!("{:.6}", price_val));
            }
        }
    }

    Ok(prices)
}

// ============================================================================
// Lease Monitoring Task
// ============================================================================

/// Start background task for lease state monitoring
/// Polls lease states for subscribed owners and sends updates when state changes
pub async fn start_lease_monitor_task(state: Arc<AppState>) {
    tokio::spawn(async move {
        // Poll every 10 seconds for lease changes
        let mut interval = tokio::time::interval(Duration::from_secs(10));

        loop {
            interval.tick().await;

            // Get all owners with lease subscriptions
            let owners = state.ws_manager.get_subscribed_lease_owners();
            if owners.is_empty() {
                continue;
            }

            // Check each owner's leases in parallel
            let futures: Vec<_> = owners
                .iter()
                .map(|owner| {
                    let state = state.clone();
                    let owner = owner.clone();
                    async move {
                        if let Err(e) = check_owner_leases(&state, &owner).await {
                            debug!("Failed to check leases for {}: {}", owner, e);
                        }
                    }
                })
                .collect();

            futures::future::join_all(futures).await;
        }
    });
}

/// Check lease states for a specific owner and send updates if changed
async fn check_owner_leases(state: &AppState, owner: &str) -> Result<(), String> {
    use super::leases::fetch_leases_for_monitoring;

    // Fetch current leases using the lease handler's function
    let leases = fetch_leases_for_monitoring(state, owner)
        .await
        .map_err(|e| e.to_string())?;

    for lease in leases {
        let lease_address = &lease.address;

        // Create current state snapshot
        let current_state = CachedLeaseState {
            status: lease.status.clone(),
            amount: lease
                .amount
                .as_ref()
                .map(|a| a.amount.clone())
                .unwrap_or_default(),
            debt_total: lease
                .debt
                .as_ref()
                .map(|d| d.total.clone())
                .unwrap_or_default(),
        };

        // Check if this is a new lease
        let is_new = state.ws_manager.is_new_lease(owner, lease_address);

        // Update cache and check if state changed
        let changed = state
            .ws_manager
            .update_lease_state(owner, lease_address, current_state);

        if changed || is_new {
            // Determine the change type for the notification
            let change_type = if is_new {
                "new"
            } else {
                match lease.status.as_str() {
                    "opening" => "opening",
                    "opened" => "updated",
                    "closing" => "closing",
                    "closed" => "closed",
                    "paid_off" => "paid_off",
                    "liquidated" => "liquidated",
                    _ => "updated",
                }
            };

            // Build lease data for the update
            let lease_data = serde_json::json!({
                "status": lease.status,
                "amount": lease.amount,
                "debt": lease.debt,
                "interest": lease.interest,
                "liquidation_price": lease.liquidation_price,
                "pnl": lease.pnl,
                "close_policy": lease.close_policy,
            });

            // Send update to subscribers
            state
                .ws_manager
                .send_lease_update(owner, lease_address, change_type, lease_data);

            info!(
                "Lease {} for {} changed: {}",
                lease_address, owner, change_type
            );

            // Clean up cache for closed/liquidated leases
            if matches!(lease.status.as_str(), "closed" | "liquidated" | "paid_off") {
                state
                    .ws_manager
                    .remove_lease_from_cache(owner, lease_address);
            }
        }
    }

    Ok(())
}

// ============================================================================
// Skip Transaction Tracking Task
// ============================================================================

/// Start background task for Skip transaction tracking
/// Polls Skip API for transaction status and sends updates when state changes
pub async fn start_skip_tracking_task(state: Arc<AppState>) {
    tokio::spawn(async move {
        // Poll every 5 seconds for Skip transaction status
        let mut interval = tokio::time::interval(Duration::from_secs(5));

        loop {
            interval.tick().await;

            // Get all tracked Skip transactions
            let tracked_txs = state.ws_manager.get_tracked_skip_txs();
            if tracked_txs.is_empty() {
                continue;
            }

            // Check each transaction in parallel
            let futures: Vec<_> = tracked_txs
                .iter()
                .map(|(tx_hash, source_chain)| {
                    let state = state.clone();
                    let tx_hash = tx_hash.clone();
                    let source_chain = source_chain.clone();
                    async move {
                        if let Err(e) = check_skip_tx_status(&state, &tx_hash, &source_chain).await
                        {
                            debug!("Failed to check Skip tx {}: {}", tx_hash, e);
                        }
                    }
                })
                .collect();

            futures::future::join_all(futures).await;
        }
    });
}

/// Check Skip transaction status and send updates if changed
async fn check_skip_tx_status(
    state: &AppState,
    tx_hash: &str,
    source_chain: &str,
) -> Result<(), String> {
    // Fetch status from Skip API
    let status_response = state
        .skip_client
        .get_status(tx_hash, source_chain)
        .await
        .map_err(|e| e.to_string())?;

    // Count completed hops
    let transfer_sequence = status_response.transfer_sequence.as_ref();
    let total_hops = transfer_sequence.map(|s| s.len() as u32).unwrap_or(1);
    let completed_hops = transfer_sequence
        .map(|seq| {
            seq.iter()
                .filter(|t| t.state == "TRANSFER_SUCCESS" || t.state == "STATE_COMPLETED")
                .count() as u32
        })
        .unwrap_or(0);

    // Create current state
    let current_state = CachedSkipTxState {
        status: status_response.status.clone(),
        completed_hops,
        total_hops,
    };

    // Check if state changed
    let (changed, _old_state) = state
        .ws_manager
        .update_skip_tx_state(tx_hash, current_state.clone());

    if changed {
        // Determine status value for frontend
        let is_complete = matches!(
            status_response.status.as_str(),
            "STATE_COMPLETED" | "STATE_COMPLETED_SUCCESS"
        );
        let is_failed = matches!(
            status_response.status.as_str(),
            "STATE_FAILED" | "STATE_ABANDONED"
        );

        let status = if is_complete {
            TxStatusValue::Success
        } else if is_failed {
            TxStatusValue::Failed
        } else {
            TxStatusValue::Pending
        };

        // Extract error message if failed (status itself describes the failure)
        let error = if is_failed {
            Some(format!("Transaction failed with status: {}", status_response.status))
        } else {
            None
        };

        // Send update to subscribers
        state.ws_manager.send_skip_tx_update(
            tx_hash,
            status.clone(),
            completed_hops,
            total_hops,
            error,
        );

        info!(
            "Skip tx {} update: {:?} ({}/{} steps)",
            tx_hash, status, completed_hops, total_hops
        );

        // Clean up tracking state if complete or failed
        if is_complete || is_failed {
            state.ws_manager.remove_skip_tx(tx_hash);
        }
    }

    Ok(())
}

// ============================================================================
// Earn Position Monitoring Task
// ============================================================================

/// Start background task for earn position monitoring
/// Polls earn positions for subscribed addresses and sends updates when state changes
pub async fn start_earn_monitor_task(state: Arc<AppState>) {
    tokio::spawn(async move {
        // Poll every 15 seconds for earn position changes
        let mut interval = tokio::time::interval(Duration::from_secs(15));

        loop {
            interval.tick().await;

            // Get all addresses with earn subscriptions
            let addresses = state.ws_manager.get_subscribed_earn_addresses();
            if addresses.is_empty() {
                continue;
            }

            // Check each address's positions in parallel
            let futures: Vec<_> = addresses
                .iter()
                .map(|address| {
                    let state = state.clone();
                    let address = address.clone();
                    async move {
                        if let Err(e) = check_earn_positions(&state, &address).await {
                            debug!("Failed to check earn positions for {}: {}", address, e);
                        }
                    }
                })
                .collect();

            futures::future::join_all(futures).await;
        }
    });
}

/// Check earn positions for a specific address and send updates if changed
async fn check_earn_positions(state: &AppState, address: &str) -> Result<(), String> {
    use super::earn::fetch_earn_positions_for_monitoring;

    // Fetch current positions using the earn handler's function
    let (positions, total_deposited_usd) = fetch_earn_positions_for_monitoring(state, address)
        .await
        .map_err(|e| e.to_string())?;

    // Create cached state for comparison
    let cached_positions: Vec<CachedEarnPosition> = positions
        .iter()
        .map(|p| CachedEarnPosition {
            protocol: p.protocol.clone(),
            deposited_lpn: p.deposited_lpn.clone(),
            rewards: p.rewards.clone(),
        })
        .collect();

    let current_state = CachedEarnState {
        positions: cached_positions,
        total_deposited_usd: total_deposited_usd.clone(),
    };

    // Check if state changed
    let changed = state.ws_manager.update_earn_state(address, current_state);

    if changed {
        // Send update to subscribers
        state
            .ws_manager
            .send_earn_update(address, positions, total_deposited_usd);

        info!("Earn positions updated for {}", address);
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    // Tests for Subscription::from_client_message - the actual parsing logic

    #[test]
    fn test_subscription_parsing() {
        // Prices - no params needed
        let sub = Subscription::from_client_message("prices", &serde_json::json!({})).unwrap();
        assert_eq!(sub, Subscription::Prices);

        // Balances with array
        let sub = Subscription::from_client_message(
            "balances",
            &serde_json::json!({"addresses": ["nolus1abc", "nolus1def"]}),
        )
        .unwrap();
        assert!(matches!(sub, Subscription::Balances { addresses } if addresses.len() == 2));

        // Balance with single address
        let sub = Subscription::from_client_message(
            "balance",
            &serde_json::json!({"address": "nolus1abc"}),
        )
        .unwrap();
        assert!(matches!(sub, Subscription::Balances { addresses } if addresses.len() == 1));

        // Leases
        let sub = Subscription::from_client_message(
            "leases",
            &serde_json::json!({"address": "nolus1abc"}),
        )
        .unwrap();
        assert!(matches!(sub, Subscription::Leases { address } if address == "nolus1abc"));

        // TxStatus
        let sub = Subscription::from_client_message(
            "tx_status",
            &serde_json::json!({"hash": "ABC123", "chain_id": "nolus-rila"}),
        )
        .unwrap();
        assert!(matches!(sub, Subscription::TxStatus { hash, chain_id } if hash == "ABC123" && chain_id == "nolus-rila"));
    }

    #[test]
    fn test_subscription_error_cases() {
        // Unknown topic
        assert!(Subscription::from_client_message("unknown", &serde_json::json!({})).is_err());

        // Missing required params
        assert!(Subscription::from_client_message("balances", &serde_json::json!({})).is_err());
        assert!(Subscription::from_client_message("leases", &serde_json::json!({})).is_err());
        assert!(Subscription::from_client_message("tx_status", &serde_json::json!({})).is_err());
    }

    #[test]
    fn test_subscription_topic_names() {
        assert_eq!(Subscription::Prices.topic_name(), "prices");
        assert_eq!(
            Subscription::Balances { addresses: vec![] }.topic_name(),
            "balances"
        );
        assert_eq!(
            Subscription::Leases {
                address: String::new()
            }
            .topic_name(),
            "leases"
        );
    }

    #[tokio::test]
    async fn test_websocket_manager() {
        let manager = WebSocketManager::new();
        assert_eq!(manager.connection_count(), 0);
    }
}
