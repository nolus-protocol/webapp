import type { Dispatcher } from "undici";
import { compareWithinTolerance, sumDecimalStrings } from "../decimal.js";
import { getJson } from "../http.js";
import { parseBalancesResponse } from "../validate.js";
import type { BalanceInfo, CheckResult } from "../types.js";

const CHECK_ID = "totals-reconcile";
const CHECK_TITLE = "REST total_value_usd equals the sum of per-entry amount_usd";
const DEGENERATE_NOTE = "0 balances for the configured address: reconciliation is degenerate";

export interface ReconcileResult {
  status: "pass" | "fail";
  observed: unknown;
  expected: unknown;
  note?: string;
}

export interface ReconcileInput {
  balances: BalanceInfo[];
  totalValueUsd: string;
  toleranceUsd: string;
}

export function reconcileTotals(input: ReconcileInput): ReconcileResult {
  const entryCount = input.balances.length;
  const sum = sumDecimalStrings(input.balances.map((balance) => balance.amount_usd));
  const comparison = compareWithinTolerance({
    actual: sum,
    expected: input.totalValueUsd,
    tolerance: input.toleranceUsd
  });

  const observed = { sum, totalValueUsd: input.totalValueUsd, diff: comparison.diff, entryCount };
  const expected = { withinToleranceUsd: input.toleranceUsd };

  if (!comparison.within) {
    return { status: "fail", observed, expected };
  }
  if (entryCount === 0) {
    return { status: "pass", observed, expected, note: DEGENERATE_NOTE };
  }
  return { status: "pass", observed, expected };
}

export async function runTotalsReconcile(params: {
  baseUrl: string;
  address: string;
  toleranceUsd: string;
  dispatcher: Dispatcher | undefined;
}): Promise<CheckResult> {
  const startedAt = Date.now();
  const base: Pick<CheckResult, "id" | "title" | "tolerance"> = {
    id: CHECK_ID,
    title: CHECK_TITLE,
    tolerance: { usd: params.toleranceUsd }
  };

  try {
    const json = await getJson(`${params.baseUrl}/api/balances?address=${params.address}`, params.dispatcher);
    const parsed = parseBalancesResponse(json);
    const result = reconcileTotals({
      balances: parsed.balances,
      totalValueUsd: parsed.total_value_usd,
      toleranceUsd: params.toleranceUsd
    });
    return {
      ...base,
      status: result.status,
      durationMs: Date.now() - startedAt,
      observed: result.observed,
      expected: result.expected,
      ...(result.note !== undefined ? { notes: result.note } : {})
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      status: "fail",
      durationMs: Date.now() - startedAt,
      observed: { error: message },
      reason: "REST balances fetch or parse failed"
    };
  }
}
