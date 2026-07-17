import type { OriginContext } from "../../t2/appDriver.js";
import { readString } from "../../t2/matrixHelpers.js";
import { readJson } from "../runtime.js";
import { Decimal } from "../../oracle/decimal.js";
import { parseDownpaymentRanges } from "./preconditions.js";
import type { ProtocolConfig } from "./leasePlan.js";

// Node-side, host-resolver-aware reads of the live API used by the flow specs to build the
// oracle inputs and precondition probes. Coverage-excluded browser/network glue (see
// vitest.config.ts); the pure classification/parse logic it feeds lives in the *.ts helpers.

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function listAt(payload: unknown, key: string): unknown[] {
  const list = asRecord(payload)?.[key];
  return Array.isArray(list) ? list : [];
}

/** Sum of an address's micro balances whose denom contains `denomSubstr` (case-insensitive). */
export async function microBalanceByDenom(ctx: OriginContext, address: string, denomSubstr: string): Promise<bigint> {
  const payload = await readJson(ctx, `${ctx.origin}/api/balances?address=${encodeURIComponent(address)}`);
  let total = 0n;
  for (const entry of listAt(payload, "balances")) {
    const denom = readString(entry, "denom") ?? "";
    const amount = readString(entry, "amount");
    if (denom.toLowerCase().includes(denomSubstr.toLowerCase()) && amount !== undefined && /^\d+$/.test(amount)) {
      total += BigInt(amount);
    }
  }
  return total;
}

/** The first lease enumerated for `address` with `status === "opened"`, or undefined. */
export async function openedLease(ctx: OriginContext, address: string): Promise<Record<string, unknown> | undefined> {
  const payload = await readJson(ctx, `${ctx.origin}/api/leases?address=${encodeURIComponent(address)}`);
  for (const entry of listAt(payload, "leases")) {
    const record = asRecord(entry);
    if (record !== undefined && readString(record, "status") === "opened") {
      return record;
    }
  }
  return undefined;
}

/** Raw `/api/leases/config/<protocol>` payload for downpayment-range resolution. */
export async function leaseConfig(ctx: OriginContext, protocol: string): Promise<unknown> {
  return readJson(ctx, `${ctx.origin}/api/leases/config/${encodeURIComponent(protocol)}`);
}

/** The protocol identifiers from `/api/config` (top-level `protocols: string[]`). */
export async function leaseProtocols(ctx: OriginContext): Promise<string[]> {
  const payload = await readJson(ctx, `${ctx.origin}/api/config`);
  const protocols = asRecord(payload)?.protocols;
  if (Array.isArray(protocols)) return protocols.filter((p): p is string => typeof p === "string");
  const record = asRecord(protocols);
  return record === undefined ? [] : Object.keys(record);
}

/**
 * Load every eligible lease protocol with its parsed downpayment ranges. The protocol list comes
 * from `/api/config` (the bare `/api/leases/config` 400s — the protocol param is required); each
 * protocol's `/api/leases/config/<protocol>` is fetched and parsed, and a protocol whose config
 * fails to load or carries no ranges is dropped (ineligible), never assumed present.
 */
export async function leaseProtocolConfigs(ctx: OriginContext): Promise<ProtocolConfig[]> {
  const protocols = await leaseProtocols(ctx);
  const configs: ProtocolConfig[] = [];
  for (const protocol of protocols) {
    let ranges: ProtocolConfig["ranges"];
    try {
      ranges = parseDownpaymentRanges(await leaseConfig(ctx, protocol));
    } catch {
      continue;
    }
    if (ranges.length > 0) {
      configs.push({ protocol, ranges });
    }
  }
  return configs;
}

/**
 * The wallet's USD holdings keyed by asset ticker — the intersection basis for downpayment
 * selection. Read from `/api/balances`; each entry's ticker/symbol and USD value are taken when the
 * payload exposes them (the live field names are confirmed in CI). An asset with no parseable USD
 * value contributes nothing, so the plan falls through to acquisition rather than over-claiming.
 */
export async function heldAssetUsd(ctx: OriginContext, address: string): Promise<Map<string, Decimal>> {
  const payload = await readJson(ctx, `${ctx.origin}/api/balances?address=${encodeURIComponent(address)}`);
  const held = new Map<string, Decimal>();
  for (const entry of listAt(payload, "balances")) {
    const ticker = readString(entry, "ticker") ?? readString(entry, "symbol");
    const usd = readString(entry, "value_usd") ?? readString(entry, "usd_value") ?? readString(entry, "balance_usd");
    if (ticker !== undefined && usd !== undefined && /^\d+(\.\d+)?$/.test(usd)) {
      held.set(ticker.toUpperCase(), (held.get(ticker.toUpperCase()) ?? Decimal.zero()).add(Decimal.fromString(usd)));
    }
  }
  return held;
}

/** The currencies list for lease-group stable resolution. */
export async function currencies(ctx: OriginContext): Promise<unknown> {
  const payload = await readJson(ctx, `${ctx.origin}/api/currencies`);
  return asRecord(payload)?.currencies ?? payload;
}

/** Total unbonding entry count for `address` against `validatorAddress` (0 when absent). */
export async function unbondingEntriesFor(
  ctx: OriginContext,
  address: string,
  validatorAddress: string
): Promise<number> {
  const payload = await readJson(ctx, `${ctx.origin}/api/staking/positions?address=${encodeURIComponent(address)}`);
  for (const entry of listAt(payload, "unbonding")) {
    if (readString(entry, "validator_address") === validatorAddress) {
      const entries = asRecord(entry)?.entries;
      return Array.isArray(entries) ? entries.length : 0;
    }
  }
  return 0;
}
