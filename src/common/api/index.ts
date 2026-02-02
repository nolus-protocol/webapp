/**
 * API module exports
 *
 * This module provides the interface between the webapp and the Rust backend.
 * All external API communication should go through these clients.
 */

// Backend REST API client
export { BackendApi } from "./BackendApi";

// WebSocket client for real-time subscriptions
export { WebSocketClient, WebSocketClientImpl } from "./WebSocketClient";

// Re-export all types from the types module
export * from "./types";

// Re-export ApiError class specifically (it's both a type and a value)
export { ApiError } from "./types";

// Re-export Zod schemas for API response validation
export * from "./schemas";

// Re-export types from WebSocketClient
export type {
  SubscriptionTopic,
  PriceCallback,
  BalanceCallback,
  LeaseCallback,
  TxStatusCallback,
  StakingCallback,
  SkipTxCallback,
  Unsubscribe,
  ConnectionState,
  ConnectionStateCallback,
} from "./WebSocketClient";
