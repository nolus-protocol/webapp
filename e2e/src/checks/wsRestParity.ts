import type { LookupFunction } from "node:net";
import type { Dispatcher } from "undici";
import { WS_ACK_TIMEOUT_MS } from "../config.js";
import { compareWithinTolerance } from "../decimal.js";
import { getJson } from "../http.js";
import { runBalanceSubscription, WsAckError } from "../ws.js";
import type { PushOutcome } from "../ws.js";
import { parseBalancesResponse } from "../validate.js";
import type { BalanceInfo, BalanceUpdateFrame, CheckResult } from "../types.js";

const CHECK_ID = "ws-rest-parity";
const CHECK_TITLE = "WebSocket balance_update matches REST /api/balances";
const EXPECTED_CHAIN = "nolus";

export interface BalanceSnapshot {
  balances: BalanceInfo[];
  totalValueUsd: string;
}

export interface ParityComparison {
  status: "pass" | "fail";
  observed?: unknown;
  expected?: unknown;
}

export interface ParityInput {
  ws: BalanceSnapshot;
  rest: BalanceSnapshot;
  toleranceUsd: string;
}

interface DenomAmount {
  denom: string;
  amount: string;
}

interface CountedPair {
  pair: DenomAmount;
  count: number;
}

// The multiset key is a structured JSON encoding of [denom, amount] rather than a
// delimiter-joined string, so no in-band separator can collide with denom/amount
// content or be normalized away by a formatter. The decoded pair is stored in the
// value, avoiding a JSON.parse round-trip on the key.
function multisetCounts(balances: BalanceInfo[]): Map<string, CountedPair> {
  const counts = new Map<string, CountedPair>();
  for (const balance of balances) {
    const key = JSON.stringify([balance.denom, balance.amount]);
    const existing = counts.get(key);
    if (existing === undefined) {
      counts.set(key, { pair: { denom: balance.denom, amount: balance.amount }, count: 1 });
    } else {
      existing.count += 1;
    }
  }
  return counts;
}

function multisetDifference(from: Map<string, CountedPair>, subtract: Map<string, CountedPair>): DenomAmount[] {
  const extras: DenomAmount[] = [];
  for (const [key, entry] of from) {
    const other = subtract.get(key)?.count ?? 0;
    for (let index = 0; index < entry.count - other; index += 1) {
      extras.push(entry.pair);
    }
  }
  return extras;
}

export function compareBalanceSnapshots(input: ParityInput): ParityComparison {
  const wsCounts = multisetCounts(input.ws.balances);
  const restCounts = multisetCounts(input.rest.balances);
  const onlyInWs = multisetDifference(wsCounts, restCounts);
  const onlyInRest = multisetDifference(restCounts, wsCounts);
  const totals = compareWithinTolerance({
    actual: input.ws.totalValueUsd,
    expected: input.rest.totalValueUsd,
    tolerance: input.toleranceUsd
  });

  const setsEqual = onlyInWs.length === 0 && onlyInRest.length === 0;
  if (setsEqual && totals.within) {
    return { status: "pass" };
  }

  return {
    status: "fail",
    observed: {
      source: "ws",
      totalValueUsd: input.ws.totalValueUsd,
      onlyInWs,
      totalDiff: totals.diff,
      totalWithinTolerance: totals.within
    },
    expected: {
      source: "rest",
      totalValueUsd: input.rest.totalValueUsd,
      onlyInRest
    }
  };
}

function skipReason(address: string, timeoutMs: number): string {
  return (
    `no on-chain transfer touched ${address} within ${timeoutMs}ms; ` +
    "push-parity requires live transfer traffic (deterministic trigger arrives with the T2 wallet tier)"
  );
}

export interface RunWsRestParityParams {
  wsUrl: string;
  baseUrl: string;
  address: string;
  toleranceUsd: string;
  pushTimeoutMs: number;
  dispatcher: Dispatcher | undefined;
  lookup: LookupFunction | undefined;
}

interface ParityContext {
  params: RunWsRestParityParams;
  base: Pick<CheckResult, "id" | "title" | "tolerance">;
  startedAt: number;
}

type PhaseOutcome<T> = { ok: true; value: T } | { ok: false; result: CheckResult };

function elapsed(ctx: ParityContext): number {
  return Date.now() - ctx.startedAt;
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}

function subscribeFailureResult(ctx: ParityContext, error: unknown): CheckResult {
  return {
    ...ctx.base,
    status: "fail",
    durationMs: elapsed(ctx),
    observed: { phase: "subscribe", error: errorMessage(error) },
    expected: { ack: `subscribed to balances within ${WS_ACK_TIMEOUT_MS}ms` },
    reason: error instanceof WsAckError ? "subscribe ack failed" : "websocket transport error"
  };
}

function noPushResult(ctx: ParityContext): CheckResult {
  return {
    ...ctx.base,
    status: "skip",
    durationMs: elapsed(ctx),
    reason: skipReason(ctx.params.address, ctx.params.pushTimeoutMs)
  };
}

function chainMismatchResult(ctx: ParityContext, update: BalanceUpdateFrame): CheckResult {
  return {
    ...ctx.base,
    status: "fail",
    durationMs: elapsed(ctx),
    observed: { chain: update.chain },
    expected: { chain: EXPECTED_CHAIN },
    reason: "balance_update carried an unexpected chain"
  };
}

function malformedPushResult(ctx: ParityContext, detail: string): CheckResult {
  return {
    ...ctx.base,
    status: "fail",
    durationMs: elapsed(ctx),
    observed: { phase: "push", error: detail },
    expected: { frame: "balance_update matching the documented wire shape" },
    reason: "balance_update frame failed shape validation"
  };
}

async function acquirePush(ctx: ParityContext): Promise<PhaseOutcome<BalanceUpdateFrame>> {
  const { params } = ctx;
  let outcome: PushOutcome;
  try {
    const result = await runBalanceSubscription({
      wsUrl: params.wsUrl,
      address: params.address,
      pushTimeoutMs: params.pushTimeoutMs,
      lookup: params.lookup
    });
    outcome = result.outcome;
  } catch (error) {
    return { ok: false, result: subscribeFailureResult(ctx, error) };
  }

  if (outcome.kind === "none") {
    return { ok: false, result: noPushResult(ctx) };
  }
  if (outcome.kind === "malformed") {
    return { ok: false, result: malformedPushResult(ctx, outcome.detail) };
  }
  if (outcome.update.chain !== EXPECTED_CHAIN) {
    return { ok: false, result: chainMismatchResult(ctx, outcome.update) };
  }
  return { ok: true, value: outcome.update };
}

async function fetchRestSnapshot(ctx: ParityContext): Promise<PhaseOutcome<BalanceSnapshot>> {
  const { params, base } = ctx;
  try {
    const json = await getJson(`${params.baseUrl}/api/balances?address=${params.address}`, params.dispatcher);
    const parsed = parseBalancesResponse(json);
    return { ok: true, value: { balances: parsed.balances, totalValueUsd: parsed.total_value_usd } };
  } catch (error) {
    return {
      ok: false,
      result: {
        ...base,
        status: "fail",
        durationMs: elapsed(ctx),
        observed: { phase: "rest-fetch", error: errorMessage(error) },
        reason: "REST balances fetch failed after live push"
      }
    };
  }
}

function buildParityResult(ctx: ParityContext, comparison: ParityComparison): CheckResult {
  return {
    ...ctx.base,
    status: comparison.status,
    durationMs: elapsed(ctx),
    ...(comparison.observed !== undefined ? { observed: comparison.observed } : {}),
    ...(comparison.expected !== undefined ? { expected: comparison.expected } : {}),
    notes: `live balance_update reconciled against REST snapshot for ${ctx.params.address}`
  };
}

export async function runWsRestParity(params: RunWsRestParityParams): Promise<CheckResult> {
  const ctx: ParityContext = {
    params,
    base: { id: CHECK_ID, title: CHECK_TITLE, tolerance: { usd: params.toleranceUsd } },
    startedAt: Date.now()
  };

  const push = await acquirePush(ctx);
  if (!push.ok) {
    return push.result;
  }
  const rest = await fetchRestSnapshot(ctx);
  if (!rest.ok) {
    return rest.result;
  }

  const comparison = compareBalanceSnapshots({
    ws: { balances: push.value.balances, totalValueUsd: push.value.total_value_usd },
    rest: rest.value,
    toleranceUsd: params.toleranceUsd
  });
  return buildParityResult(ctx, comparison);
}
