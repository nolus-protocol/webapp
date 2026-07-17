export type CapDenom = "nls" | "usdc";

/** A single unit of gross outflow, in native micro units (never a float). */
export interface SpendItem {
  denom: CapDenom;
  micro: bigint;
}

export type SpendCheck = { ok: true } | { ok: false; overDenom: CapDenom; projectedMicro: bigint; capMicro: bigint };

export interface SpendSnapshot {
  denom: CapDenom;
  capMicro: bigint;
  spentMicro: bigint;
}

/**
 * Per-denom cumulative spend accounting in native micro units. "Spend" is GROSS outflow —
 * attached funds plus a deterministic gas-fee upper bound — and is never credited back when a
 * close/unbond later returns funds: netting would re-open headroom and blow the worst-case
 * bound the cap exists to hold. `check` is a strict pre-sign gate over `spent + pending +
 * candidate`; a candidate that projects over its cap is refused before it is ever signed.
 * The gate is safe under concurrency because `pending` is part of that projection: a
 * counterparty send from the secondary wallet can be reserved-but-not-yet-committed while the
 * primary checks a candidate, and that in-flight outflow is already counted, so a racing
 * candidate can never push a denom past its cap.
 */
export class SpendCap {
  private readonly caps: Map<CapDenom, bigint>;
  private readonly spentMicro = new Map<CapDenom, bigint>();
  private readonly pendingMicro = new Map<CapDenom, bigint>();

  constructor(caps: { nls: bigint; usdc: bigint }) {
    this.caps = new Map([
      ["nls", caps.nls],
      ["usdc", caps.usdc]
    ]);
  }

  cap(denom: CapDenom): bigint {
    return this.caps.get(denom) ?? 0n;
  }

  spent(denom: CapDenom): bigint {
    return this.spentMicro.get(denom) ?? 0n;
  }

  pending(denom: CapDenom): bigint {
    return this.pendingMicro.get(denom) ?? 0n;
  }

  check(candidate: SpendItem[]): SpendCheck {
    for (const [denom, add] of aggregate(candidate)) {
      const projectedMicro = this.spent(denom) + this.pending(denom) + add;
      const capMicro = this.cap(denom);
      if (projectedMicro > capMicro) {
        return { ok: false, overDenom: denom, projectedMicro, capMicro };
      }
    }
    return { ok: true };
  }

  /** Directly count a committed gross outflow as spent, with no prior reservation. */
  record(items: SpendItem[]): void {
    for (const [denom, add] of aggregate(items)) {
      this.spentMicro.set(denom, this.spent(denom) + add);
    }
  }

  /** Move a candidate into `pending` after a passing `check`, before the executor signs. */
  reserve(items: SpendItem[]): void {
    for (const [denom, add] of aggregate(items)) {
      this.pendingMicro.set(denom, this.pending(denom) + add);
    }
  }

  /** On commit: retire the reservation and count it as permanently spent. */
  settle(items: SpendItem[]): void {
    for (const [denom, add] of aggregate(items)) {
      this.pendingMicro.set(denom, this.pending(denom) - add);
      this.spentMicro.set(denom, this.spent(denom) + add);
    }
  }

  /** On a failed broadcast: drop the reservation without crediting spend. */
  release(items: SpendItem[]): void {
    for (const [denom, add] of aggregate(items)) {
      this.pendingMicro.set(denom, this.pending(denom) - add);
    }
  }

  snapshot(): SpendSnapshot[] {
    return [...this.caps.keys()].map((denom) => ({
      denom,
      capMicro: this.cap(denom),
      spentMicro: this.spent(denom)
    }));
  }
}

function aggregate(items: SpendItem[]): Map<CapDenom, bigint> {
  const totals = new Map<CapDenom, bigint>();
  for (const item of items) {
    if (item.micro < 0n) {
      throw new Error("spend item micro amount must be non-negative");
    }
    totals.set(item.denom, (totals.get(item.denom) ?? 0n) + item.micro);
  }
  return totals;
}

export function spendCapFromMicros(micros: { nlsMicro: string; usdcMicro: string }): SpendCap {
  return new SpendCap({ nls: BigInt(micros.nlsMicro), usdc: BigInt(micros.usdcMicro) });
}
