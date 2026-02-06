//! CometBFT WebSocket event client
//!
//! Connects to a CometBFT node's `/websocket` endpoint, subscribes to
//! `NewBlock` and `Tx` events, and dispatches them through broadcast channels
//! to consumers (refresh tasks, lease/earn monitors).
//!
//! On disconnect: reconnects with exponential backoff (1s → 30s max).
//! No timer fallback — data goes stale visibly via `Cached<T>.age_secs()`.

use std::time::Duration;

use futures::{SinkExt, StreamExt};
use tokio::sync::broadcast;
use tokio_tungstenite::tungstenite::Message as WsMessage;
use tracing::{debug, error, info};

// ============================================================================
// Types
// ============================================================================

/// Contract execution event extracted from CometBFT Tx events.
#[derive(Debug, Clone)]
pub struct ContractExecEvent {
    pub contract_address: String,
    pub action: Option<String>,
    pub tx_hash: String,
}

/// Broadcast channels for dispatching chain events to consumers.
///
/// Uses `tokio::sync::broadcast` so multiple receivers can subscribe independently.
/// When a consumer lags behind the channel capacity, it receives `Lagged` and
/// should do a single catch-up refresh.
#[derive(Clone)]
pub struct EventChannels {
    /// Fires on each new block. Carries block height.
    pub new_block: broadcast::Sender<u64>,
    /// Fires on each wasm contract execution within a transaction.
    pub contract_exec: broadcast::Sender<ContractExecEvent>,
}

impl Default for EventChannels {
    fn default() -> Self {
        Self::new()
    }
}

impl EventChannels {
    pub fn new() -> Self {
        let (new_block, _) = broadcast::channel(64);
        let (contract_exec, _) = broadcast::channel(256);
        Self {
            new_block,
            contract_exec,
        }
    }
}

// ============================================================================
// Client
// ============================================================================

struct ChainEventClient {
    ws_url: String,
    channels: EventChannels,
}

/// Derive the CometBFT WebSocket URL from an RPC URL.
///
/// `https://rpc.nolus.network` → `wss://rpc.nolus.network/websocket`
/// `http://localhost:26657` → `ws://localhost:26657/websocket`
pub fn ws_url_from_rpc(rpc_url: &str) -> String {
    let base = rpc_url
        .replace("https://", "wss://")
        .replace("http://", "ws://");
    format!("{}/websocket", base.trim_end_matches('/'))
}

/// Start the CometBFT WebSocket event client.
///
/// Spawns a tokio task that connects, subscribes to events, and dispatches
/// them through the provided channels. Reconnects automatically on failure.
pub fn start(rpc_url: &str, channels: EventChannels) {
    let client = ChainEventClient {
        ws_url: ws_url_from_rpc(rpc_url),
        channels,
    };
    tokio::spawn(async move {
        client.run().await;
    });
}

impl ChainEventClient {
    /// Outer loop: connect, listen, reconnect on failure with exponential backoff.
    async fn run(&self) {
        let mut backoff_secs = 1u64;

        loop {
            info!("Connecting to CometBFT WebSocket at {}", self.ws_url);

            match self.connect_and_listen().await {
                Ok(()) => {
                    info!("CometBFT WebSocket disconnected cleanly, reconnecting");
                    backoff_secs = 1;
                }
                Err(e) => {
                    error!(
                        "CometBFT WebSocket error: {}. Reconnecting in {}s",
                        e, backoff_secs
                    );
                    tokio::time::sleep(Duration::from_secs(backoff_secs)).await;
                    backoff_secs = (backoff_secs * 2).min(30);
                }
            }
        }
    }

    /// Connect, subscribe, and process messages until disconnect or error.
    async fn connect_and_listen(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (ws_stream, _) = tokio_tungstenite::connect_async(&self.ws_url).await?;
        let (mut write, mut read) = ws_stream.split();

        info!("Connected to CometBFT WebSocket");

        // Subscribe to NewBlock events
        let sub_new_block = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "new_block",
            "method": "subscribe",
            "params": { "query": "tm.event='NewBlock'" }
        });
        write
            .send(WsMessage::Text(sub_new_block.to_string().into()))
            .await?;

        // Subscribe to all Tx events (filter wasm events client-side)
        let sub_tx = serde_json::json!({
            "jsonrpc": "2.0",
            "id": "tx_events",
            "method": "subscribe",
            "params": { "query": "tm.event='Tx'" }
        });
        write
            .send(WsMessage::Text(sub_tx.to_string().into()))
            .await?;

        info!("Subscribed to NewBlock and Tx events");

        // Reset backoff is handled by the caller on Ok(())

        // Periodic ping to detect silent disconnects
        let mut ping_interval = tokio::time::interval(Duration::from_secs(30));
        ping_interval.tick().await; // consume the immediate first tick

        loop {
            tokio::select! {
                msg = read.next() => {
                    match msg {
                        Some(Ok(WsMessage::Text(text))) => {
                            self.handle_message(&text);
                        }
                        Some(Ok(WsMessage::Ping(_))) => {
                            debug!("Received ping from CometBFT");
                        }
                        Some(Ok(WsMessage::Close(_))) => {
                            info!("CometBFT WebSocket sent close frame");
                            return Ok(());
                        }
                        Some(Err(e)) => {
                            return Err(Box::new(e));
                        }
                        None => {
                            return Ok(());
                        }
                        _ => {}
                    }
                }
                _ = ping_interval.tick() => {
                    if let Err(e) = write.send(WsMessage::Ping(vec![].into())).await {
                        return Err(Box::new(e));
                    }
                }
            }
        }
    }

    /// Parse a JSON-RPC message and dispatch events to channels.
    fn handle_message(&self, text: &str) {
        let msg: serde_json::Value = match serde_json::from_str(text) {
            Ok(v) => v,
            Err(e) => {
                debug!("Failed to parse CometBFT message: {}", e);
                return;
            }
        };

        // Subscription confirmation: {"result": {}} — skip
        if msg
            .get("result")
            .and_then(|r| r.as_object())
            .is_some_and(|r| r.is_empty())
        {
            debug!("Subscription confirmed: {:?}", msg.get("id"));
            return;
        }

        let query = msg["result"]["query"].as_str().unwrap_or("");

        if query == "tm.event='NewBlock'" {
            self.handle_new_block(&msg);
        } else if query == "tm.event='Tx'" {
            self.handle_tx_event(&msg);
        }
    }

    fn handle_new_block(&self, msg: &serde_json::Value) {
        let height = msg["result"]["data"]["value"]["block"]["header"]["height"]
            .as_str()
            .and_then(|h| h.parse::<u64>().ok())
            .unwrap_or(0);

        // Ignore send errors — means no receivers are listening
        let _ = self.channels.new_block.send(height);
        debug!("NewBlock dispatched: height={}", height);
    }

    fn handle_tx_event(&self, msg: &serde_json::Value) {
        // Extract tx hash from the top-level event attributes
        let tx_hash = msg["result"]["events"]["tx.hash"]
            .as_array()
            .and_then(|arr| arr.first())
            .and_then(|v| v.as_str())
            .unwrap_or("")
            .to_string();

        // Extract events from the TxResult
        let events = match msg["result"]["data"]["value"]["TxResult"]["result"]["events"].as_array()
        {
            Some(e) => e,
            None => return,
        };

        for event in events {
            if event["type"].as_str() != Some("wasm") {
                continue;
            }

            let attrs = match event["attributes"].as_array() {
                Some(a) => a,
                None => continue,
            };

            let mut contract_address = String::new();
            let mut action = None;

            for attr in attrs {
                match attr["key"].as_str() {
                    Some("contract_address") | Some("_contract_address") => {
                        if let Some(v) = attr["value"].as_str() {
                            contract_address = v.to_string();
                        }
                    }
                    Some("action") => {
                        action = attr["value"].as_str().map(|s| s.to_string());
                    }
                    _ => {}
                }
            }

            if !contract_address.is_empty() {
                let _ = self.channels.contract_exec.send(ContractExecEvent {
                    contract_address,
                    action,
                    tx_hash: tx_hash.clone(),
                });
            }
        }
    }
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_ws_url_from_rpc_https() {
        assert_eq!(
            ws_url_from_rpc("https://rpc.nolus.network"),
            "wss://rpc.nolus.network/websocket"
        );
    }

    #[test]
    fn test_ws_url_from_rpc_http() {
        assert_eq!(
            ws_url_from_rpc("http://localhost:26657"),
            "ws://localhost:26657/websocket"
        );
    }

    #[test]
    fn test_ws_url_from_rpc_trailing_slash() {
        assert_eq!(
            ws_url_from_rpc("https://rpc.nolus.network/"),
            "wss://rpc.nolus.network/websocket"
        );
    }

    #[test]
    fn test_event_channels_creation() {
        let channels = EventChannels::new();
        let _rx1 = channels.new_block.subscribe();
        let _rx2 = channels.contract_exec.subscribe();
    }

    #[tokio::test]
    async fn test_new_block_dispatch() {
        let channels = EventChannels::new();
        let mut rx = channels.new_block.subscribe();
        channels.new_block.send(12345).unwrap();
        assert_eq!(rx.recv().await.unwrap(), 12345);
    }

    #[tokio::test]
    async fn test_contract_exec_dispatch() {
        let channels = EventChannels::new();
        let mut rx = channels.contract_exec.subscribe();
        channels
            .contract_exec
            .send(ContractExecEvent {
                contract_address: "nolus1test".to_string(),
                action: Some("feed_prices".to_string()),
                tx_hash: "abc123".to_string(),
            })
            .unwrap();
        let event = rx.recv().await.unwrap();
        assert_eq!(event.contract_address, "nolus1test");
        assert_eq!(event.action.as_deref(), Some("feed_prices"));
        assert_eq!(event.tx_hash, "abc123");
    }

    #[test]
    fn test_parse_new_block_message() {
        let channels = EventChannels::new();
        let mut rx = channels.new_block.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "jsonrpc": "2.0",
            "id": "new_block",
            "result": {
                "query": "tm.event='NewBlock'",
                "data": {
                    "type": "tendermint/event/NewBlock",
                    "value": {
                        "block": {
                            "header": { "height": "12345678" }
                        }
                    }
                }
            }
        }"#;

        client.handle_message(msg);
        assert_eq!(rx.try_recv().unwrap(), 12345678);
    }

    #[test]
    fn test_parse_tx_event_with_wasm() {
        let channels = EventChannels::new();
        let mut rx = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "jsonrpc": "2.0",
            "id": "tx_events",
            "result": {
                "query": "tm.event='Tx'",
                "events": { "tx.hash": ["DEADBEEF"] },
                "data": {
                    "type": "tendermint/event/Tx",
                    "value": {
                        "TxResult": {
                            "result": {
                                "events": [{
                                    "type": "wasm",
                                    "attributes": [
                                        { "key": "_contract_address", "value": "nolus1oracle" },
                                        { "key": "action", "value": "feed_prices" }
                                    ]
                                }]
                            }
                        }
                    }
                }
            }
        }"#;

        client.handle_message(msg);
        let event = rx.try_recv().unwrap();
        assert_eq!(event.contract_address, "nolus1oracle");
        assert_eq!(event.action.as_deref(), Some("feed_prices"));
        assert_eq!(event.tx_hash, "DEADBEEF");
    }

    #[test]
    fn test_subscription_confirmation_ignored() {
        let channels = EventChannels::new();
        let mut rx = channels.new_block.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{"jsonrpc":"2.0","id":"new_block","result":{}}"#;
        client.handle_message(msg);
        assert!(rx.try_recv().is_err());
    }

    #[test]
    fn test_non_wasm_events_ignored() {
        let channels = EventChannels::new();
        let mut rx = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "jsonrpc": "2.0",
            "result": {
                "query": "tm.event='Tx'",
                "events": { "tx.hash": ["ABC"] },
                "data": {
                    "type": "tendermint/event/Tx",
                    "value": {
                        "TxResult": {
                            "result": {
                                "events": [{
                                    "type": "transfer",
                                    "attributes": [
                                        { "key": "recipient", "value": "nolus1abc" }
                                    ]
                                }]
                            }
                        }
                    }
                }
            }
        }"#;

        client.handle_message(msg);
        assert!(rx.try_recv().is_err());
    }
}
