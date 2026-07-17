import type { OriginContext } from "../../t2/appDriver.js";
import { readString } from "../../t2/matrixHelpers.js";
import { readJson, postJson } from "../runtime.js";
import type { SerialQueue } from "../serialQueue.js";
import type { Decimal } from "../../oracle/decimal.js";
import { parseDownpaymentRanges } from "./preconditions.js";
import type { ProtocolConfig } from "./leasePlan.js";
import { heldMicro, priceUsdOf, microToUsd, tickersMatching } from "./denomResolver.js";
import type { ResolvedAsset } from "./denomResolver.js";
import { hasSwapRoute, buildSwapRouteRequest } from "./preconditions.js";

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

/** Raw `/api/balances` payload for an address. */
export async function fetchBalances(ctx: OriginContext, address: string): Promise<unknown> {
  return readJson(ctx, `${ctx.origin}/api/balances?address=${encodeURIComponent(address)}`);
}

/** Micro balance of a ticker, identified by its RESOLVED bank denom (never the balances `symbol`). */
export async function assetMicro(
  ctx: OriginContext,
  address: string,
  resolver: Map<string, ResolvedAsset>,
  ticker: string
): Promise<bigint> {
  return heldMicro(await fetchBalances(ctx, address), resolver.get(ticker));
}

/** Total micro across every USDC-variant ticker the resolver knows (the downpayment funding source). */
export async function usdcMicro(
  ctx: OriginContext,
  address: string,
  resolver: Map<string, ResolvedAsset>
): Promise<bigint> {
  const balances = await fetchBalances(ctx, address);
  return tickersMatching(resolver, "USDC").reduce((sum, ticker) => sum + heldMicro(balances, resolver.get(ticker)), 0n);
}

export type RouteProbe = { status: "routable" } | { status: "no-route" } | { status: "error"; reason: string };

export interface SwapProbeDeps {
  ctx: OriginContext;
  queue: SerialQueue;
  chainId: string;
}

export interface SwapProbeArgs {
  sourceDenom: string;
  destDenom: string;
  amountMicro: string;
}

/**
 * Probe a swap route, distinguishing a genuine "no route for this amount" (a precondition) from a
 * probe ERROR (the API/network failed) — the latter must not be silently reported as no-route.
 * `/api/swap/route` is a POST endpoint (a GET 405s), so the resolved bank denoms + Nolus chain id
 * are sent as the JSON body, drawn through the strict `/api/swap/*` rate bucket like every other
 * swap read.
 */
export async function probeSwapRoute(deps: SwapProbeDeps, args: SwapProbeArgs): Promise<RouteProbe> {
  const body = buildSwapRouteRequest({ ...args, chainId: deps.chainId });
  let payload: unknown;
  try {
    await deps.queue.pace("strict");
    payload = await postJson(deps.ctx, `${deps.ctx.origin}/api/swap/route`, body);
  } catch (error) {
    return { status: "error", reason: error instanceof Error ? error.message : String(error) };
  }
  return { status: hasSwapRoute(payload) ? "routable" : "no-route" };
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

/** Load a protocol's config with a single, pacing-aware retry to ride out a transient 5xx. */
async function leaseConfigWithRetry(
  ctx: OriginContext,
  protocol: string,
  pace?: () => Promise<void>
): Promise<unknown> {
  try {
    return await leaseConfig(ctx, protocol);
  } catch {
    if (pace !== undefined) {
      await pace();
    }
    return leaseConfig(ctx, protocol);
  }
}

/**
 * Load every eligible lease protocol with its parsed downpayment ranges. The protocol list comes
 * from `/api/config` (the bare `/api/leases/config` 400s — the protocol param is required); each
 * `/api/leases/config/<protocol>` is fetched (with one paced retry) and parsed. A protocol whose
 * config carries no ranges is dropped as ineligible. But if EVERY protocol's config load FAILED
 * (not merely empty), that is a transient outage after a deploy burst, not a permanent
 * ineligibility — this throws `lease-config-unavailable` (an environment signal, retry next run)
 * rather than returning empty and letting the plan report a permanent-looking skip.
 */
export async function leaseProtocolConfigs(ctx: OriginContext, pace?: () => Promise<void>): Promise<ProtocolConfig[]> {
  const protocols = await leaseProtocols(ctx);
  const configs: ProtocolConfig[] = [];
  let fetchFailures = 0;
  for (const protocol of protocols) {
    let ranges: ProtocolConfig["ranges"];
    try {
      ranges = parseDownpaymentRanges(await leaseConfigWithRetry(ctx, protocol, pace));
    } catch {
      fetchFailures += 1;
      continue;
    }
    if (ranges.length > 0) {
      configs.push({ protocol, ranges });
    }
  }
  if (configs.length === 0 && protocols.length > 0 && fetchFailures === protocols.length) {
    throw new Error(`lease-config-unavailable: all ${protocols.length} lease config loads failed after retry`);
  }
  return configs;
}

/**
 * The wallet's USD holdings per asset ticker — the intersection basis for downpayment selection.
 * Each ticker's micro is summed by its RESOLVED bank denom (never the balances `symbol`, never the
 * unreliable `amount_usd`) and valued as `micro/10^decimals × price_usd` from `/api/prices`. A
 * ticker with no price or no holding contributes nothing.
 */
export async function heldAssetUsd(
  ctx: OriginContext,
  address: string,
  resolver: Map<string, ResolvedAsset>,
  pricesPayload: unknown
): Promise<Map<string, Decimal>> {
  const balances = await fetchBalances(ctx, address);
  const held = new Map<string, Decimal>();
  for (const [ticker, resolved] of resolver) {
    const micro = heldMicro(balances, resolved);
    const price = priceUsdOf(pricesPayload, ticker);
    if (micro > 0n && price !== undefined) {
      held.set(ticker, microToUsd(micro, resolved.decimalDigits, price));
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
