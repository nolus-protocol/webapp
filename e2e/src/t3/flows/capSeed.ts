import type { CapDenom, SpendCap } from "../spendCap.js";
import type { JournalRecord } from "../journal.js";
import { isIntent, isOutcome } from "../journal.js";

/**
 * Map a journaled chain denom to its cap denom, or undefined when the denom is uncapped. The
 * native `unls` and USDC (an `ibc/...` denom) are the only two the cap accounts; anything else
 * moved no capped value and is skipped.
 */
export function capDenomOf(chainDenom: string): CapDenom | undefined {
  const denom = chainDenom.toLowerCase();
  if (denom === "unls" || denom === "nls") {
    return "nls";
  }
  if (denom.includes("usdc")) {
    return "usdc";
  }
  return undefined;
}

/**
 * Re-apply a prior run's committed gross outflow to the cap at singleton construction. A worker
 * restart otherwise rebuilds the SpendCap at full budget while the seq allocator is journal-seeded,
 * so the same operator budget could be spent twice. Only `committed` outcomes count — a failed or
 * aborted submission moved no value — and the matching intent's denoms carry the gross that was
 * charged, so the cap is restored to exactly the spent-state the journal proves.
 */
export function seedCapFromJournal(cap: SpendCap, records: JournalRecord[]): void {
  const committedSeqs = new Set(
    records
      .filter(isOutcome)
      .filter((outcome) => outcome.status === "committed")
      .map((outcome) => outcome.seq)
  );
  for (const record of records) {
    if (!isIntent(record) || !committedSeqs.has(record.seq)) {
      continue;
    }
    const items = record.denoms
      .filter((amount) => /^\d+$/.test(amount.micro))
      .map((amount) => ({ denom: capDenomOf(amount.denom), micro: BigInt(amount.micro) }))
      .filter((item): item is { denom: CapDenom; micro: bigint } => item.denom !== undefined && item.micro > 0n);
    if (items.length > 0) {
      cap.record(items);
    }
  }
}
