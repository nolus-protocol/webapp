import { Decimal } from "../../oracle/decimal.js";
import { readString } from "../../t2/matrixHelpers.js";

// Pure asset-identity resolution. Live `/api/balances` entries carry the bank denom (an `ibc/...`
// hash) in `denom`/`symbol` and an unreliable `amount_usd` (≈0 for USDC), so assets are identified
// ONLY by their resolved bank denom from `/api/currencies` and valued ONLY via `/api/prices`.

export interface ResolvedAsset {
  ticker: string;
  bankSymbols: string[];
  decimalDigits: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function values(payload: unknown, key: string): unknown[] {
  const root = asRecord(payload)?.[key] ?? payload;
  const record = asRecord(root);
  if (record !== undefined) {
    return Object.values(record);
  }
  return Array.isArray(root) ? root : [];
}

/**
 * Build a ticker → { bankSymbols, decimalDigits } map from `/api/currencies`. A ticker present in
 * several protocols contributes each protocol's `bank_symbol`; `decimalDigits` is taken from the
 * first entry (consistent per ticker on Nolus).
 */
export function parseCurrencyResolver(payload: unknown): Map<string, ResolvedAsset> {
  const resolver = new Map<string, ResolvedAsset>();
  for (const entry of values(payload, "currencies")) {
    const ticker = readString(entry, "ticker") ?? readString(entry, "key")?.split("@")[0];
    const bank = readString(entry, "bank_symbol");
    const digits = asRecord(entry)?.decimal_digits;
    if (ticker === undefined || bank === undefined || typeof digits !== "number") {
      continue;
    }
    const existing = resolver.get(ticker) ?? { ticker, bankSymbols: [], decimalDigits: digits };
    if (!existing.bankSymbols.includes(bank)) {
      existing.bankSymbols.push(bank);
    }
    resolver.set(ticker, existing);
  }
  return resolver;
}

/** Sum the wallet's micro balance of a ticker by its resolved bank denom(s) — never `symbol`/`amount_usd`. */
export function heldMicro(balancesPayload: unknown, resolved: ResolvedAsset | undefined): bigint {
  if (resolved === undefined) {
    return 0n;
  }
  const banks = new Set(resolved.bankSymbols);
  let total = 0n;
  for (const entry of values(balancesPayload, "balances")) {
    const denom = readString(entry, "denom");
    const amount = readString(entry, "amount");
    if (denom !== undefined && banks.has(denom) && amount !== undefined && /^\d+$/.test(amount)) {
      total += BigInt(amount);
    }
  }
  return total;
}

/** The USD price of a ticker from `/api/prices` (`price_usd`), or undefined when absent. */
export function priceUsdOf(pricesPayload: unknown, ticker: string): Decimal | undefined {
  for (const entry of values(pricesPayload, "prices")) {
    const price = readString(entry, "price_usd");
    const symbol = readString(entry, "symbol");
    const keyTicker = readString(entry, "key")?.split("@")[0];
    if (price !== undefined && /^\d+(\.\d+)?$/.test(price) && (symbol === ticker || keyTicker === ticker)) {
      return Decimal.fromString(price);
    }
  }
  return undefined;
}

/** USD value of a micro holding: `micro / 10^decimals × priceUsd`, all scaled-integer decimals. */
export function microToUsd(micro: bigint, decimalDigits: number, priceUsd: Decimal): Decimal {
  return Decimal.fromAtomics(micro.toString(), decimalDigits).mul(priceUsd);
}

/** Tickers the resolver knows whose name contains `needle` (e.g. every USDC variant). */
export function tickersMatching(resolver: Map<string, ResolvedAsset>, needle: string): string[] {
  const wanted = needle.toUpperCase();
  return [...resolver.keys()].filter((ticker) => ticker.toUpperCase().includes(wanted));
}

/**
 * The resolved bank denom for a ticker — the value a Skip/swap route request must carry, never the
 * ticker itself. Returns the first `bank_symbol` the resolver holds for the ticker, or undefined
 * when the ticker is unknown.
 */
export function bankDenomOf(resolver: Map<string, ResolvedAsset>, ticker: string): string | undefined {
  return resolver.get(ticker)?.bankSymbols[0];
}

/**
 * The bank denom of the USDC variant the wallet actually holds — the denom a swap will spend or
 * receive, so a route probe matches the real economy. Prefers the first held USDC-family variant;
 * when none is held (e.g. a fresh wallet) it falls back to the `USDC_NOBLE` denom (the lease LPN).
 * Returns undefined only when neither a held variant nor the fallback ticker resolves.
 */
export function heldUsdcVariant(
  resolver: Map<string, ResolvedAsset>,
  balancesPayload: unknown,
  fallbackTicker = "USDC_NOBLE"
): string | undefined {
  for (const ticker of tickersMatching(resolver, "USDC")) {
    const resolved = resolver.get(ticker);
    if (resolved !== undefined && heldMicro(balancesPayload, resolved) > 0n) {
      return resolved.bankSymbols[0];
    }
  }
  return bankDenomOf(resolver, fallbackTicker);
}
