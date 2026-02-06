/**
 * Common types used across all API domains
 */


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
 * Simple balance info
 */
export interface BalanceInfoSimple {
  denom: string;
  amount: string;
}

/**
 * Coin amount with denom
 */
export interface CoinAmount {
  denom: string;
  amount: string;
}

/**
 * Intercom hash response
 */
export interface IntercomHashResponse {
  user_id: string;
  hash: string;
}
