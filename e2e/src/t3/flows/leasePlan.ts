import { Decimal } from "../../oracle/decimal.js";

export interface RangedAsset {
  currency: string;
  minUsd: Decimal;
}

export interface ProtocolConfig {
  protocol: string;
  ranges: RangedAsset[];
}

/**
 * How a lease run should source its downpayment, decided purely from the eligible protocol ranges
 * and the wallet's USD holdings:
 * - `use-held`: an asset the wallet already holds at ≥ its range min (preferred — no swap, and it
 *   recycles the asset a prior run acquired);
 * - `acquire`: swap USDC into the target asset (engine-governed, capped in USDC) because nothing
 *   held qualifies but the USDC balance covers the min plus a buffer;
 * - `skip`: neither a held asset nor an affordable acquisition — a precondition skip, never a red.
 */
export type LeaseDownpaymentPlan =
  | { kind: "use-held"; protocol: string; asset: string; minUsd: Decimal }
  | { kind: "acquire"; protocol: string; asset: string; minUsd: Decimal; acquireUsd: Decimal }
  | { kind: "skip"; reason: string };

export interface PlanInput {
  protocols: ProtocolConfig[];
  /** USD value the wallet holds per asset ticker (the intersection basis). */
  heldUsd: Map<string, Decimal>;
  /** The wallet's USDC balance in USD — the funding source for an acquisition swap. */
  usdcUsd: Decimal;
  /** The asset to acquire when nothing held qualifies (OSMO — ranged by both long and short protocols). */
  acquireTarget: string;
  /** Headroom above the range min to acquire, covering price move and swap fees. */
  acquireBufferUsd: Decimal;
}

function heldCovers(input: PlanInput, range: RangedAsset): boolean {
  return (input.heldUsd.get(range.currency) ?? Decimal.zero()).gte(range.minUsd);
}

/** Prefer a held ranged asset; else plan an acquisition of the target; else skip. */
export function planLeaseDownpayment(input: PlanInput): LeaseDownpaymentPlan {
  const eligible = input.protocols.filter((protocol) => protocol.ranges.length > 0);
  if (eligible.length === 0) {
    return { kind: "skip", reason: "no eligible lease protocol (every config was empty or failed to load)" };
  }

  for (const protocol of eligible) {
    for (const range of protocol.ranges) {
      if (heldCovers(input, range)) {
        return { kind: "use-held", protocol: protocol.protocol, asset: range.currency, minUsd: range.minUsd };
      }
    }
  }

  for (const protocol of eligible) {
    const range = protocol.ranges.find((candidate) => candidate.currency === input.acquireTarget);
    if (range === undefined) {
      continue;
    }
    const acquireUsd = range.minUsd.add(input.acquireBufferUsd);
    if (input.usdcUsd.gte(acquireUsd)) {
      return {
        kind: "acquire",
        protocol: protocol.protocol,
        asset: input.acquireTarget,
        minUsd: range.minUsd,
        acquireUsd
      };
    }
    return {
      kind: "skip",
      reason: `USDC ${input.usdcUsd.toString(2)} is below the ${acquireUsd.toString(2)} needed to acquire ${input.acquireTarget}`
    };
  }

  return { kind: "skip", reason: `no eligible protocol ranges the acquire target ${input.acquireTarget}` };
}
