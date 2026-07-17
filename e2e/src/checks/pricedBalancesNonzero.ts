import type { Dispatcher } from "undici";
import { getJson } from "../http.js";
import { parseBalancesResponse } from "../validate.js";
import { parseCurrencyResolver, priceUsdOf } from "../t3/flows/denomResolver.js";
import type { BalanceInfo, CheckResult } from "../types.js";

const CHECK_ID = "priced-balances-nonzero";
const CHECK_TITLE = "Every priced, non-zero balance carries a positive amount_usd";
const RULE = "amount_usd > 0 for each balance whose ticker has any TICKER@... price key and a positive amount";
const DEGENERATE_NOTE = "no priced, non-zero balances for the configured address: the check is degenerate";

export interface PricedBalanceCase {
  denom: string;
  ticker: string | undefined;
  amountMicro: string;
  amountUsd: string;
  priced: boolean;
}

export interface PricedBalanceOffender {
  denom: string;
  ticker: string | undefined;
  amountMicro: string;
  amountUsd: string;
}

export interface PricedBalancesResult {
  status: "pass" | "fail";
  observed: {
    checkedCount: number;
    exemptCount: number;
    offenders: PricedBalanceOffender[];
  };
  expected: { rule: string };
  note?: string;
}

function isPositiveMicro(amount: string): boolean {
  return /^\d+$/.test(amount) && BigInt(amount) > 0n;
}

function parsesPositive(amountUsd: string): boolean {
  const parsed = Number(amountUsd);
  return Number.isFinite(parsed) && parsed > 0;
}

/**
 * Pure classification: a balance is checked only when its denom resolved to a ticker, that ticker
 * has a price key, and the held amount is positive. Zero-balance and unpriced/unknown entries are
 * exempt (degenerate, like the sibling T0 checks). A checked entry fails when amount_usd does not
 * parse to a value strictly greater than zero — the exact regression the balances USD-join fix
 * addresses.
 */
export function classifyPricedBalances(cases: PricedBalanceCase[]): PricedBalancesResult {
  const expected = { rule: RULE };
  const offenders: PricedBalanceOffender[] = [];
  let checkedCount = 0;
  let exemptCount = 0;

  for (const entry of cases) {
    const eligible = entry.ticker !== undefined && entry.priced && isPositiveMicro(entry.amountMicro);
    if (!eligible) {
      exemptCount += 1;
      continue;
    }
    checkedCount += 1;
    if (!parsesPositive(entry.amountUsd)) {
      offenders.push({
        denom: entry.denom,
        ticker: entry.ticker,
        amountMicro: entry.amountMicro,
        amountUsd: entry.amountUsd
      });
    }
  }

  const observed = { checkedCount, exemptCount, offenders };
  if (offenders.length > 0) {
    return { status: "fail", observed, expected };
  }
  if (checkedCount === 0) {
    return { status: "pass", observed, expected, note: DEGENERATE_NOTE };
  }
  return { status: "pass", observed, expected };
}

/** Reverse the ticker->bankSymbols resolver into denom->ticker for balance-entry identity. */
function buildDenomToTicker(currenciesPayload: unknown): Map<string, string> {
  const resolver = parseCurrencyResolver(currenciesPayload);
  const denomToTicker = new Map<string, string>();
  for (const [ticker, asset] of resolver) {
    for (const bank of asset.bankSymbols) {
      denomToTicker.set(bank, ticker);
    }
  }
  return denomToTicker;
}

function toCases(
  balances: BalanceInfo[],
  denomToTicker: Map<string, string>,
  pricesPayload: unknown
): PricedBalanceCase[] {
  return balances.map((balance) => {
    const ticker = denomToTicker.get(balance.denom);
    const priced = ticker !== undefined && priceUsdOf(pricesPayload, ticker) !== undefined;
    return { denom: balance.denom, ticker, amountMicro: balance.amount, amountUsd: balance.amount_usd, priced };
  });
}

export async function runPricedBalancesNonzero(params: {
  baseUrl: string;
  address: string;
  dispatcher: Dispatcher | undefined;
}): Promise<CheckResult> {
  const startedAt = Date.now();
  const base: Pick<CheckResult, "id" | "title"> = { id: CHECK_ID, title: CHECK_TITLE };

  try {
    const [balancesJson, currenciesJson, pricesJson] = await Promise.all([
      getJson(`${params.baseUrl}/api/balances?address=${params.address}`, params.dispatcher),
      getJson(`${params.baseUrl}/api/currencies`, params.dispatcher),
      getJson(`${params.baseUrl}/api/prices`, params.dispatcher)
    ]);
    const balances = parseBalancesResponse(balancesJson).balances;
    const denomToTicker = buildDenomToTicker(currenciesJson);
    const result = classifyPricedBalances(toCases(balances, denomToTicker, pricesJson));
    return {
      ...base,
      status: result.status,
      durationMs: Date.now() - startedAt,
      observed: result.observed,
      expected: result.expected,
      ...(result.note !== undefined ? { notes: result.note } : {}),
      ...(result.status === "fail"
        ? { reason: "a priced, non-zero balance reported amount_usd <= 0 (USD-join miss)" }
        : {})
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return {
      ...base,
      status: "fail",
      durationMs: Date.now() - startedAt,
      observed: { error: message },
      reason: "REST balances/currencies/prices fetch or parse failed"
    };
  }
}
