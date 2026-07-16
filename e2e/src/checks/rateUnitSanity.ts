import type { Dispatcher } from "undici";
import { getJson } from "../http.js";
import { parseLeasesResponse } from "../validate.js";
import type { CheckResult, InterestInfo } from "../types.js";

const CHECK_ID = "rate-unit-sanity";
const CHECK_TITLE = "Lease interest rates are in the expected units and plausibility band";
const DEGENERATE_NOTE = "0 leases inspected: degenerate";

const IDENTITY_EPSILON = 1e-6;
const PERMILLE_TO_PERCENT_DIVISOR = 10;
const PERMILLE_LEAK_MIN_INTEGER = 100;

export interface RateBand {
  minPercent: number;
  maxPercent: number;
}

export interface RateFailure {
  index: number;
  loanRate: number;
  marginRate: number;
  annualRatePercent: number;
  reasons: string[];
  permilleLeakSignature: boolean;
}

export interface RateCheckResult {
  status: "pass" | "fail";
  observed: unknown;
  expected: unknown;
  note?: string;
}

function inspectLease(index: number, interest: InterestInfo, band: RateBand): RateFailure | null {
  const { loan_rate: loanRate, margin_rate: marginRate, annual_rate_percent: annualRatePercent } = interest;
  const reasons: string[] = [];

  if (!(annualRatePercent >= band.minPercent && annualRatePercent < band.maxPercent)) {
    reasons.push(`annual_rate_percent ${annualRatePercent} outside band [${band.minPercent}, ${band.maxPercent})`);
  }

  const identityExpected = (loanRate + marginRate) / PERMILLE_TO_PERCENT_DIVISOR;
  if (Math.abs(annualRatePercent - identityExpected) >= IDENTITY_EPSILON) {
    reasons.push(
      `annual_rate_percent ${annualRatePercent} != (loan_rate + margin_rate) / ${PERMILLE_TO_PERCENT_DIVISOR} = ${identityExpected}`
    );
  }

  const permilleLeakSignature = Number.isInteger(annualRatePercent) && annualRatePercent >= PERMILLE_LEAK_MIN_INTEGER;
  if (permilleLeakSignature) {
    reasons.push(
      `annual_rate_percent ${annualRatePercent} is an integer >= ${PERMILLE_LEAK_MIN_INTEGER}, matches the #270 raw-permille leak signature`
    );
  }

  if (reasons.length === 0) {
    return null;
  }
  return { index, loanRate, marginRate, annualRatePercent, reasons, permilleLeakSignature };
}

export function checkLeaseRates(interests: InterestInfo[], band: RateBand): RateCheckResult {
  const failures: RateFailure[] = [];
  interests.forEach((interest, index) => {
    const failure = inspectLease(index, interest, band);
    if (failure !== null) {
      failures.push(failure);
    }
  });

  const inspectedCount = interests.length;
  const expected = {
    band: { minPercent: band.minPercent, maxPercentExclusive: band.maxPercent },
    identity: `annual_rate_percent == (loan_rate + margin_rate) / ${PERMILLE_TO_PERCENT_DIVISOR}`,
    identityEpsilon: IDENTITY_EPSILON
  };

  if (failures.length > 0) {
    return { status: "fail", observed: { inspectedCount, failures }, expected };
  }
  if (inspectedCount === 0) {
    return { status: "pass", observed: { inspectedCount }, expected, note: DEGENERATE_NOTE };
  }
  return { status: "pass", observed: { inspectedCount }, expected };
}

export async function runRateUnitSanity(params: {
  baseUrl: string;
  address: string;
  band: RateBand;
  dispatcher: Dispatcher | undefined;
}): Promise<CheckResult> {
  const startedAt = Date.now();
  const base: Pick<CheckResult, "id" | "title"> = { id: CHECK_ID, title: CHECK_TITLE };

  try {
    const json = await getJson(`${params.baseUrl}/api/leases?address=${params.address}`, params.dispatcher);
    const parsed = parseLeasesResponse(json);
    const interests = parsed.leases
      .map((lease) => lease.interest)
      .filter((interest): interest is InterestInfo => interest !== undefined);
    const result = checkLeaseRates(interests, params.band);
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
      reason: "REST leases fetch or parse failed"
    };
  }
}
