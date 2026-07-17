import type { Coin, StdFee } from "@cosmjs/amino";

export const NATIVE_DENOM = "unls";
export const NATIVE_DECIMALS = 6;
export const DEFAULT_GAS_LIMIT = 200000;

const DECIMAL_PATTERN = /^\d+(\.\d+)?$/;
const RPC_PLACEHOLDER = "<rpc>";

/**
 * Convert a human decimal amount (e.g. "0.001") into its integer micro-denom string
 * (e.g. "1000" at 6 decimals). Scaled-integer math only — never binary floats — so a
 * fee/amount is exact. Rejects a non-decimal string or more fractional digits than the
 * denom carries, both of which would silently truncate real value.
 */
export function toMicroAmount(amount: string, decimals: number = NATIVE_DECIMALS): string {
  const trimmed = amount.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    throw new Error(`amount is not a non-negative decimal: "${amount}"`);
  }
  const dot = trimmed.indexOf(".");
  const intDigits = dot === -1 ? trimmed : trimmed.slice(0, dot);
  const fracDigits = dot === -1 ? "" : trimmed.slice(dot + 1);
  if (fracDigits.length > decimals) {
    throw new Error(`amount "${amount}" has more than ${decimals} fractional digits`);
  }
  const micro = BigInt(intDigits + fracDigits.padEnd(decimals, "0"));
  return micro.toString();
}

/** Build the send `Coin` for a human decimal amount. Throws on a non-positive amount. */
export function makeSendCoin(amount: string, denom: string = NATIVE_DENOM, decimals: number = NATIVE_DECIMALS): Coin {
  const micro = toMicroAmount(amount, decimals);
  if (BigInt(micro) <= 0n) {
    throw new Error(`send amount must be positive (got "${amount}")`);
  }
  return { denom, amount: micro };
}

/**
 * Build an explicit `StdFee` as `ceil(gasLimit × gasPrice)` in the fee denom. An explicit
 * fee keeps a broadcast deterministic and avoids a simulation round-trip against an account
 * that may not yet exist on chain. `gasPrice` is the per-gas price as a decimal string
 * (e.g. "0.025").
 */
export function makeFee(gasLimit: number, gasPrice: string, denom: string = NATIVE_DENOM): StdFee {
  if (!Number.isInteger(gasLimit) || gasLimit <= 0) {
    throw new Error(`gasLimit must be a positive integer (got ${gasLimit})`);
  }
  const trimmed = gasPrice.trim();
  if (!DECIMAL_PATTERN.test(trimmed)) {
    throw new Error(`gasPrice is not a non-negative decimal: "${gasPrice}"`);
  }
  const dot = trimmed.indexOf(".");
  const scale = dot === -1 ? 0 : trimmed.length - dot - 1;
  const scaledPrice = BigInt(trimmed.replace(".", ""));
  const divisor = 10n ** BigInt(scale);
  const product = BigInt(gasLimit) * scaledPrice;
  const feeMicro = (product + divisor - 1n) / divisor;
  return { amount: [{ denom, amount: feeMicro.toString() }], gas: gasLimit.toString() };
}

/**
 * Strip an RPC endpoint (full URL and its bare host) out of arbitrary text so a broadcast
 * error surfaced to a report/annotation never leaks the internal-ish host or an embedded
 * credential. Replaces both forms with a stable placeholder.
 */
export function sanitizeRpc(text: string, rpcUrl: string): string {
  let host: string;
  try {
    host = new URL(rpcUrl).host;
  } catch {
    host = "";
  }
  let out = text;
  if (rpcUrl.length > 0) out = out.split(rpcUrl).join(RPC_PLACEHOLDER);
  if (host.length > 0) out = out.split(host).join(RPC_PLACEHOLDER);
  return out;
}
