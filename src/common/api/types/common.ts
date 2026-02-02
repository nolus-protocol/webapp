/**
 * Common types used across all API domains
 */

import type { IObjectKeys } from "@/common/types";

/**
 * Generic API error with status code and message
 */
export class ApiError extends Error {
  constructor(
    public status: number,
    public code: string,
    message: string
  ) {
    super(message);
    this.name = "ApiError";
  }
}

/**
 * Coin amount (denom + amount)
 */
export interface CoinAmount {
  denom: string;
  amount: string;
}

/**
 * Simple balance info
 */
export interface BalanceInfoSimple {
  denom: string;
  amount: string;
}

/**
 * Transaction message structure
 */
export interface TransactionMessage {
  type: string;
  data: IObjectKeys;
}

/**
 * Transaction history entry
 */
export interface TransactionHistoryEntry {
  tx_hash: string;
  timestamp: string;
  type: string;
  status: "success" | "failed";
  fee: CoinAmount;
  messages: TransactionMessage[];
}

/**
 * Intercom hash response
 */
export interface IntercomHashResponse {
  user_id: string;
  hash: string;
}
