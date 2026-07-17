import type { OriginContext } from "../../t2/appDriver.js";
import { readString } from "../../t2/matrixHelpers.js";
import { readJson } from "../runtime.js";

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
  const payload = await readJson(ctx, `${ctx.origin}/api/balances?address=${address}`);
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
  const payload = await readJson(ctx, `${ctx.origin}/api/leases?address=${address}`);
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
  return readJson(ctx, `${ctx.origin}/api/leases/config/${protocol}`);
}

/** The first protocol key from `/api/leases/config`, or throws if none resolvable. */
export async function firstProtocol(ctx: OriginContext): Promise<string> {
  const payload = await readJson(ctx, `${ctx.origin}/api/leases/config`);
  const protocol = Object.keys(asRecord(payload) ?? {})[0];
  if (protocol === undefined) {
    throw new Error("no lease protocol resolvable from /api/leases/config");
  }
  return protocol;
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
  const payload = await readJson(ctx, `${ctx.origin}/api/staking/positions?address=${address}`);
  for (const entry of listAt(payload, "unbonding")) {
    if (readString(entry, "validator_address") === validatorAddress) {
      const entries = asRecord(entry)?.entries;
      return Array.isArray(entries) ? entries.length : 0;
    }
  }
  return 0;
}
