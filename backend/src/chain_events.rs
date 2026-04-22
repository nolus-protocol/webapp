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
use tracing::{debug, error, info, warn};

/// Max time to wait for the initial WebSocket handshake.
/// Without this, a stuck TCP/TLS handshake hangs the task forever with no
/// progress log (observed 2026-04-21: connect_async sat for 19h mid-incident).
const CONNECT_TIMEOUT: Duration = Duration::from_secs(15);

/// Max time between observed `NewBlock` events before the watchdog forces a
/// reconnect. Nolus produces blocks every ~3s, so 60s is >15× normal cadence
/// and still bounds worst-case staleness at a minute.
const BLOCK_SILENCE_TIMEOUT: Duration = Duration::from_secs(60);

/// How often the watchdog ticks to re-evaluate block silence.
const WATCHDOG_INTERVAL: Duration = Duration::from_secs(10);

/// Pure predicate for the block-silence watchdog — kept outside
/// `connect_and_listen` so it's trivially unit-testable.
fn block_silence_exceeded(elapsed: Duration) -> bool {
    elapsed > BLOCK_SILENCE_TIMEOUT
}

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
                    // Jitter prevents thundering herd in multi-instance deployments
                    let jitter = (std::time::SystemTime::now()
                        .duration_since(std::time::UNIX_EPOCH)
                        .unwrap_or_default()
                        .subsec_nanos()
                        % 4) as u64;
                    tokio::time::sleep(Duration::from_secs(backoff_secs + jitter)).await;
                    backoff_secs = (backoff_secs * 2).min(30);
                }
            }
        }
    }

    /// Connect, subscribe, and process messages until disconnect or error.
    async fn connect_and_listen(&self) -> Result<(), Box<dyn std::error::Error + Send + Sync>> {
        let (ws_stream, _) = tokio::time::timeout(
            CONNECT_TIMEOUT,
            tokio_tungstenite::connect_async(&self.ws_url),
        )
        .await
        .map_err(|_| {
            format!(
                "WebSocket connect timed out after {}s",
                CONNECT_TIMEOUT.as_secs()
            )
        })??;
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

        // Periodic ping to detect silent disconnects.
        let mut ping_interval = tokio::time::interval(Duration::from_secs(30));
        ping_interval.tick().await; // consume the immediate first tick

        // Block-silence watchdog: writes succeeding while reads never produce
        // a NewBlock is the exact failure mode that wedged the dev backend for
        // 19h. We observe real dispatches by subscribing to our own channel.
        let mut block_rx = self.channels.new_block.subscribe();
        let mut last_block_at = tokio::time::Instant::now();
        let mut watchdog_interval = tokio::time::interval(WATCHDOG_INTERVAL);
        watchdog_interval.tick().await;

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
                block_event = block_rx.recv() => {
                    // Both Ok and Lagged mean "blocks have been flowing" —
                    // only Closed is a real failure, but that can't happen
                    // while `self.channels` keeps the sender alive.
                    match block_event {
                        Ok(_) | Err(broadcast::error::RecvError::Lagged(_)) => {
                            last_block_at = tokio::time::Instant::now();
                        }
                        Err(broadcast::error::RecvError::Closed) => {
                            return Err("new_block channel closed unexpectedly".into());
                        }
                    }
                }
                _ = watchdog_interval.tick() => {
                    let elapsed = last_block_at.elapsed();
                    if block_silence_exceeded(elapsed) {
                        return Err(format!(
                            "No NewBlock received for {}s (threshold {}s), forcing reconnect",
                            elapsed.as_secs(),
                            BLOCK_SILENCE_TIMEOUT.as_secs(),
                        ).into());
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
        // Only dispatch real heights. A missing or non-numeric height means
        // the event is malformed; emitting a fake 0 would make subscribers
        // believe the chain reported block 0.
        let height = match msg["result"]["data"]["value"]["block"]["header"]["height"]
            .as_str()
            .and_then(|h| h.parse::<u64>().ok())
        {
            Some(h) => h,
            None => {
                warn!("NewBlock event missing height: {}", msg);
                return;
            }
        };

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
    fn block_silence_watchdog_fires_just_past_threshold() {
        assert!(block_silence_exceeded(
            BLOCK_SILENCE_TIMEOUT + Duration::from_millis(1)
        ));
    }

    #[test]
    fn block_silence_watchdog_does_not_fire_at_or_below_threshold() {
        assert!(!block_silence_exceeded(BLOCK_SILENCE_TIMEOUT));
        assert!(!block_silence_exceeded(Duration::from_secs(0)));
        assert!(!block_silence_exceeded(Duration::from_millis(1)));
    }

    #[test]
    fn block_silence_timeout_exceeds_ping_interval() {
        // If the silence timeout were shorter than the 30s ping cadence, the
        // watchdog could trip during normal operation before the keep-alive
        // ping has a chance to fail-fast on a real dead link.
        assert!(BLOCK_SILENCE_TIMEOUT > Duration::from_secs(30));
    }

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

    /// Malformed JSON from CometBFT must NOT panic — it's silently dropped
    /// after debug-logging. Guards the task from dying on a single bad frame.
    #[test]
    fn test_handle_message_malformed_json() {
        let channels = EventChannels::new();
        let mut new_block_rx = channels.new_block.subscribe();
        let mut contract_rx = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        client.handle_message("{ this is not valid json ");
        client.handle_message("");
        client.handle_message("null");

        assert!(new_block_rx.try_recv().is_err());
        assert!(contract_rx.try_recv().is_err());
    }

    /// Message with wrong structure (missing `result`/`query`) is silently
    /// dropped — not every CometBFT frame is an event of interest.
    #[test]
    fn test_handle_message_unknown_structure_ignored() {
        let channels = EventChannels::new();
        let mut new_block_rx = channels.new_block.subscribe();
        let mut contract_rx = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        // JSON-RPC error response
        let err_msg = r#"{"jsonrpc":"2.0","id":"x","error":{"code":-32000,"message":"oops"}}"#;
        client.handle_message(err_msg);

        // Valid JSON but unknown query
        let unknown_query = r#"{"result":{"query":"tm.event='ValidatorSetUpdates'","data":{}}}"#;
        client.handle_message(unknown_query);

        assert!(new_block_rx.try_recv().is_err());
        assert!(contract_rx.try_recv().is_err());
    }

    /// NewBlock with missing/malformed height field must NOT emit on the
    /// channel: subscribers should only receive real heights, never a fake
    /// 0 that looks like a genuine reported block.
    #[test]
    fn test_parse_new_block_missing_height_does_not_dispatch() {
        let channels = EventChannels::new();
        let mut rx = channels.new_block.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "result": {
                "query": "tm.event='NewBlock'",
                "data": { "value": { "block": {} } }
            }
        }"#;
        client.handle_message(msg);
        assert!(
            rx.try_recv().is_err(),
            "handle_new_block must not send on missing height"
        );
    }

    /// NewBlock with a non-numeric height string must also be dropped, not
    /// coerced to 0.
    #[test]
    fn test_parse_new_block_malformed_height_does_not_dispatch() {
        let channels = EventChannels::new();
        let mut rx = channels.new_block.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "result": {
                "query": "tm.event='NewBlock'",
                "data": { "value": { "block": { "header": { "height": "not-a-number" } } } }
            }
        }"#;
        client.handle_message(msg);
        assert!(rx.try_recv().is_err());
    }

    /// Multiple subscribers each receive the same event — broadcast semantics.
    #[tokio::test]
    async fn test_multiple_subscribers_receive_new_block() {
        let channels = EventChannels::new();
        let mut rx1 = channels.new_block.subscribe();
        let mut rx2 = channels.new_block.subscribe();
        let mut rx3 = channels.new_block.subscribe();

        channels.new_block.send(42).unwrap();

        assert_eq!(rx1.recv().await.unwrap(), 42);
        assert_eq!(rx2.recv().await.unwrap(), 42);
        assert_eq!(rx3.recv().await.unwrap(), 42);
    }

    /// `handle_message` dispatches correctly when multiple contract_exec
    /// subscribers are listening — verifies the routing doesn't swallow
    /// events when there are several consumers (lease monitor + earn monitor).
    #[test]
    fn test_multiple_subscribers_receive_contract_exec_from_message() {
        let channels = EventChannels::new();
        let mut rx1 = channels.contract_exec.subscribe();
        let mut rx2 = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "result": {
                "query": "tm.event='Tx'",
                "events": { "tx.hash": ["HASH"] },
                "data": { "value": { "TxResult": { "result": { "events": [{
                    "type": "wasm",
                    "attributes": [
                        { "key": "_contract_address", "value": "nolus1lpp" },
                        { "key": "action", "value": "deposit" }
                    ]
                }] } } } }
            }
        }"#;
        client.handle_message(msg);

        let e1 = rx1.try_recv().unwrap();
        let e2 = rx2.try_recv().unwrap();
        assert_eq!(e1.contract_address, "nolus1lpp");
        assert_eq!(e2.contract_address, "nolus1lpp");
        assert_eq!(e1.tx_hash, "HASH");
    }

    /// A wasm event with no attributes (empty array or missing key) must not
    /// emit a ContractExecEvent — `contract_address` stays empty and is
    /// filtered out before send.
    #[test]
    fn test_wasm_event_without_contract_address_not_dispatched() {
        let channels = EventChannels::new();
        let mut rx = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "result": {
                "query": "tm.event='Tx'",
                "events": { "tx.hash": ["HASH"] },
                "data": { "value": { "TxResult": { "result": { "events": [{
                    "type": "wasm",
                    "attributes": [
                        { "key": "action", "value": "swap" }
                    ]
                }] } } } }
            }
        }"#;
        client.handle_message(msg);

        assert!(rx.try_recv().is_err());
    }

    /// A Tx message with two wasm events in the same transaction yields two
    /// ContractExecEvents. Ensures events are iterated, not just the first one.
    #[test]
    fn test_multiple_wasm_events_in_single_tx() {
        let channels = EventChannels::new();
        let mut rx = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "result": {
                "query": "tm.event='Tx'",
                "events": { "tx.hash": ["HASH2"] },
                "data": { "value": { "TxResult": { "result": { "events": [
                    {"type":"wasm","attributes":[
                        {"key":"_contract_address","value":"nolus1a"},
                        {"key":"action","value":"open"}
                    ]},
                    {"type":"wasm","attributes":[
                        {"key":"_contract_address","value":"nolus1b"},
                        {"key":"action","value":"close"}
                    ]}
                ] } } } }
            }
        }"#;
        client.handle_message(msg);

        let e1 = rx.try_recv().unwrap();
        let e2 = rx.try_recv().unwrap();
        assert_eq!(
            [e1.contract_address.as_str(), e2.contract_address.as_str()],
            ["nolus1a", "nolus1b"]
        );
        assert_eq!(
            [e1.action.as_deref(), e2.action.as_deref()],
            [Some("open"), Some("close")]
        );
    }

    /// `contract_address` key (no underscore) is also accepted per the
    /// handler's match arm.
    #[test]
    fn test_wasm_accepts_contract_address_without_underscore() {
        let channels = EventChannels::new();
        let mut rx = channels.contract_exec.subscribe();
        let client = ChainEventClient {
            ws_url: "wss://test/websocket".to_string(),
            channels,
        };

        let msg = r#"{
            "result": {
                "query": "tm.event='Tx'",
                "events": { "tx.hash": ["HASH3"] },
                "data": { "value": { "TxResult": { "result": { "events": [{
                    "type": "wasm",
                    "attributes": [
                        { "key": "contract_address", "value": "nolus1oracle2" }
                    ]
                }] } } } }
            }
        }"#;
        client.handle_message(msg);

        let event = rx.try_recv().unwrap();
        assert_eq!(event.contract_address, "nolus1oracle2");
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
