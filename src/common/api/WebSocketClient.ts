/**
 * WebSocketClient - Real-time subscriptions for the Nolus webapp
 *
 * Provides automatic reconnection, subscription management, and
 * typed event handling for price updates, balance changes, lease updates, etc.
 */

import type { PriceData, LeaseInfo, BalanceInfo, StakingPositionsResponse } from "./BackendApi";

// WebSocket URL - configurable via environment
const WS_URL = import.meta.env.VITE_WS_URL || "ws://localhost:3000/ws";

/**
 * Subscription topics supported by the backend
 */
export type SubscriptionTopic =
  | "prices"
  | "balances"
  | "leases"
  | "tx_status"
  | "staking"
  | "skip_tx";

/**
 * Client -> Server messages
 */
interface SubscribeMessage {
  type: "subscribe";
  topic: SubscriptionTopic;
  params?: Record<string, unknown>;
}

interface UnsubscribeMessage {
  type: "unsubscribe";
  topic: SubscriptionTopic;
}

interface PingMessage {
  type: "ping";
}

type ClientMessage = SubscribeMessage | UnsubscribeMessage | PingMessage;

/**
 * Server -> Client messages
 */
interface SubscribedMessage {
  type: "subscribed";
  topic: SubscriptionTopic;
}

interface UnsubscribedMessage {
  type: "unsubscribed";
  topic: SubscriptionTopic;
}

interface ErrorMessage {
  type: "error";
  message: string;
  topic?: SubscriptionTopic;
}

interface PongMessage {
  type: "pong";
}

interface PriceUpdateMessage {
  type: "price_update";
  prices: PriceData;
}

interface BalanceUpdateMessage {
  type: "balance_update";
  address: string;
  balances: BalanceInfo[];
}

interface LeaseUpdateMessage {
  type: "lease_update";
  lease: LeaseInfo;
}

interface TxStatusMessage {
  type: "tx_status";
  tx_hash: string;
  status: "pending" | "success" | "failed";
  error?: string;
}

interface StakingUpdateMessage {
  type: "staking_update";
  address: string;
  data: StakingPositionsResponse;
}

interface SkipTxUpdateMessage {
  type: "skip_tx_update";
  tx_hash: string;
  status: "pending" | "success" | "failed";
  steps_completed: number;
  total_steps: number;
  error?: string;
}

type ServerMessage =
  | SubscribedMessage
  | UnsubscribedMessage
  | ErrorMessage
  | PongMessage
  | PriceUpdateMessage
  | BalanceUpdateMessage
  | LeaseUpdateMessage
  | TxStatusMessage
  | StakingUpdateMessage
  | SkipTxUpdateMessage;

/**
 * Callback types for each subscription
 */
export type PriceCallback = (prices: PriceData) => void;
export type BalanceCallback = (address: string, balances: BalanceInfo[]) => void;
export type LeaseCallback = (lease: LeaseInfo) => void;
export type TxStatusCallback = (txHash: string, status: "pending" | "success" | "failed", error?: string) => void;
export type StakingCallback = (address: string, data: StakingPositionsResponse) => void;
export type SkipTxCallback = (update: {
  tx_hash: string;
  status: "pending" | "success" | "failed";
  steps_completed: number;
  total_steps: number;
  error?: string;
}) => void;

/**
 * Unsubscribe function returned by subscribe methods
 */
export type Unsubscribe = () => void;

/**
 * Connection state
 */
export type ConnectionState = "disconnected" | "connecting" | "connected" | "reconnecting";

/**
 * Connection state change callback
 */
export type ConnectionStateCallback = (state: ConnectionState) => void;

/**
 * Subscription tracking
 */
interface Subscription {
  topic: SubscriptionTopic;
  params?: Record<string, unknown>;
  callbacks: Set<Function>;
}

/**
 * WebSocket client configuration
 */
interface WebSocketClientConfig {
  url?: string;
  reconnectInterval?: number;
  maxReconnectInterval?: number;
  reconnectDecay?: number;
  pingInterval?: number;
  pongTimeout?: number;
}

/**
 * WebSocket Client for real-time subscriptions
 */
class WebSocketClientImpl {
  private ws: WebSocket | null = null;
  private url: string;
  private config: Required<Omit<WebSocketClientConfig, "url">>;

  private connectionState: ConnectionState = "disconnected";
  private connectionStateCallbacks: Set<ConnectionStateCallback> = new Set();

  private subscriptions: Map<string, Subscription> = new Map();
  private reconnectAttempts = 0;
  private reconnectTimeout: ReturnType<typeof setTimeout> | null = null;
  private pingInterval: ReturnType<typeof setInterval> | null = null;
  private pongTimeout: ReturnType<typeof setTimeout> | null = null;

  constructor(config: WebSocketClientConfig = {}) {
    this.url = config.url || WS_URL;
    this.config = {
      reconnectInterval: config.reconnectInterval || 1000,
      maxReconnectInterval: config.maxReconnectInterval || 30000,
      reconnectDecay: config.reconnectDecay || 1.5,
      pingInterval: config.pingInterval || 30000,
      pongTimeout: config.pongTimeout || 10000,
    };
  }

  /**
   * Get current connection state
   */
  getConnectionState(): ConnectionState {
    return this.connectionState;
  }

  /**
   * Subscribe to connection state changes
   */
  onConnectionStateChange(callback: ConnectionStateCallback): Unsubscribe {
    this.connectionStateCallbacks.add(callback);
    // Immediately notify of current state
    callback(this.connectionState);
    return () => {
      this.connectionStateCallbacks.delete(callback);
    };
  }

  /**
   * Update and broadcast connection state
   */
  private setConnectionState(state: ConnectionState): void {
    if (this.connectionState !== state) {
      this.connectionState = state;
      this.connectionStateCallbacks.forEach((cb) => cb(state));
    }
  }

  /**
   * Connect to the WebSocket server
   */
  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        resolve();
        return;
      }

      this.setConnectionState("connecting");

      try {
        this.ws = new WebSocket(this.url);

        this.ws.onopen = () => {
          console.log("[WebSocket] Connected");
          this.setConnectionState("connected");
          this.reconnectAttempts = 0;
          this.startPing();
          this.resubscribeAll();
          resolve();
        };

        this.ws.onclose = (event) => {
          console.log("[WebSocket] Disconnected", event.code, event.reason);
          this.cleanup();
          this.setConnectionState("disconnected");
          this.scheduleReconnect();
        };

        this.ws.onerror = (error) => {
          console.error("[WebSocket] Error", error);
          if (this.connectionState === "connecting") {
            reject(new Error("WebSocket connection failed"));
          }
        };

        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      } catch (error) {
        this.setConnectionState("disconnected");
        reject(error);
      }
    });
  }

  /**
   * Disconnect from the WebSocket server
   */
  disconnect(): void {
    this.cleanup();
    if (this.ws) {
      this.ws.close(1000, "Client disconnect");
      this.ws = null;
    }
    this.setConnectionState("disconnected");
    this.subscriptions.clear();
  }

  /**
   * Cleanup timers
   */
  private cleanup(): void {
    if (this.pingInterval) {
      clearInterval(this.pingInterval);
      this.pingInterval = null;
    }
    if (this.pongTimeout) {
      clearTimeout(this.pongTimeout);
      this.pongTimeout = null;
    }
    if (this.reconnectTimeout) {
      clearTimeout(this.reconnectTimeout);
      this.reconnectTimeout = null;
    }
  }

  /**
   * Schedule reconnection with exponential backoff
   */
  private scheduleReconnect(): void {
    if (this.reconnectTimeout) return;

    const interval = Math.min(
      this.config.reconnectInterval * Math.pow(this.config.reconnectDecay, this.reconnectAttempts),
      this.config.maxReconnectInterval
    );

    console.log(`[WebSocket] Reconnecting in ${interval}ms (attempt ${this.reconnectAttempts + 1})`);
    this.setConnectionState("reconnecting");

    this.reconnectTimeout = setTimeout(() => {
      this.reconnectTimeout = null;
      this.reconnectAttempts++;
      this.connect().catch(() => {
        // Will auto-retry via onclose handler
      });
    }, interval);
  }

  /**
   * Start ping/pong heartbeat
   */
  private startPing(): void {
    this.pingInterval = setInterval(() => {
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "ping" });
        this.pongTimeout = setTimeout(() => {
          console.warn("[WebSocket] Pong timeout, reconnecting");
          this.ws?.close();
        }, this.config.pongTimeout);
      }
    }, this.config.pingInterval);
  }

  /**
   * Send a message to the server
   */
  private send(message: ClientMessage): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(message));
    }
  }

  /**
   * Handle incoming messages
   */
  private handleMessage(data: string): void {
    try {
      const message: ServerMessage = JSON.parse(data);

      switch (message.type) {
        case "pong":
          if (this.pongTimeout) {
            clearTimeout(this.pongTimeout);
            this.pongTimeout = null;
          }
          break;

        case "subscribed":
          console.log(`[WebSocket] Subscribed to ${message.topic}`);
          break;

        case "unsubscribed":
          console.log(`[WebSocket] Unsubscribed from ${message.topic}`);
          break;

        case "error":
          console.error(`[WebSocket] Error: ${message.message}`, message.topic);
          break;

        case "price_update":
          this.notifySubscribers("prices", message.prices);
          break;

        case "balance_update":
          this.notifySubscribers(`balances:${message.address}`, message.address, message.balances);
          break;

        case "lease_update":
          this.notifySubscribers(`leases:${message.lease.owner}`, message.lease);
          break;

        case "tx_status":
          this.notifySubscribers(`tx_status:${message.tx_hash}`, message.tx_hash, message.status, message.error);
          break;

        case "staking_update":
          this.notifySubscribers(`staking:${message.address}`, message.address, message.data);
          break;

        case "skip_tx_update":
          this.notifySubscribers(`skip_tx:${message.tx_hash}`, {
            tx_hash: message.tx_hash,
            status: message.status,
            steps_completed: message.steps_completed,
            total_steps: message.total_steps,
            error: message.error,
          });
          break;
      }
    } catch (error) {
      console.error("[WebSocket] Failed to parse message", error);
    }
  }

  /**
   * Notify subscribers for a topic
   */
  private notifySubscribers(key: string, ...args: unknown[]): void {
    const subscription = this.subscriptions.get(key);
    if (subscription) {
      subscription.callbacks.forEach((callback) => {
        try {
          (callback as Function)(...args);
        } catch (error) {
          console.error("[WebSocket] Callback error", error);
        }
      });
    }
  }

  /**
   * Resubscribe to all active subscriptions after reconnect
   */
  private resubscribeAll(): void {
    this.subscriptions.forEach((subscription) => {
      // Spread params at top level due to backend's serde(flatten)
      this.send({
        type: "subscribe",
        topic: subscription.topic,
        ...subscription.params,
      });
    });
  }

  /**
   * Internal subscribe method
   */
  private subscribe(
    key: string,
    topic: SubscriptionTopic,
    callback: Function,
    params?: Record<string, unknown>
  ): Unsubscribe {
    let subscription = this.subscriptions.get(key);

    if (!subscription) {
      subscription = { topic, params, callbacks: new Set() };
      this.subscriptions.set(key, subscription);

      // Send subscribe message if connected
      // Note: params are spread at top level due to backend's serde(flatten)
      if (this.ws?.readyState === WebSocket.OPEN) {
        this.send({ type: "subscribe", topic, ...params });
      }
    }

    subscription.callbacks.add(callback);

    // Return unsubscribe function
    return () => {
      subscription!.callbacks.delete(callback);

      // If no more callbacks, unsubscribe from server
      if (subscription!.callbacks.size === 0) {
        this.subscriptions.delete(key);
        if (this.ws?.readyState === WebSocket.OPEN) {
          this.send({ type: "unsubscribe", topic, ...params });
        }
      }
    };
  }

  // =========================================================================
  // Public subscription methods
  // =========================================================================

  /**
   * Subscribe to price updates
   */
  subscribePrices(callback: PriceCallback): Unsubscribe {
    return this.subscribe("prices", "prices", callback);
  }

  /**
   * Subscribe to balance updates for an address
   */
  subscribeBalances(address: string, callback: BalanceCallback): Unsubscribe {
    return this.subscribe(`balances:${address}`, "balances", callback, { address });
  }

  /**
   * Subscribe to lease updates for an owner
   */
  subscribeLeases(owner: string, callback: LeaseCallback): Unsubscribe {
    return this.subscribe(`leases:${owner}`, "leases", callback, { address: owner });
  }

  /**
   * Subscribe to transaction status updates
   */
  subscribeTxStatus(txHash: string, chainId: string, callback: TxStatusCallback): Unsubscribe {
    return this.subscribe(`tx_status:${txHash}`, "tx_status", callback, { hash: txHash, chain_id: chainId });
  }

  /**
   * Subscribe to staking position updates
   */
  subscribeStaking(address: string, callback: StakingCallback): Unsubscribe {
    return this.subscribe(`staking:${address}`, "staking", callback, { address });
  }

  /**
   * Subscribe to Skip cross-chain transaction updates
   */
  subscribeSkipTx(txHash: string, sourceChain: string, callback: SkipTxCallback): Unsubscribe {
    return this.subscribe(`skip_tx:${txHash}`, "skip_tx", callback, { tx_hash: txHash, source_chain: sourceChain });
  }
}

// Export singleton instance
export const WebSocketClient = new WebSocketClientImpl();

// Export class for testing or custom instances
export { WebSocketClientImpl };
