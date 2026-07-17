import type { CapDenom, SpendCap } from "../spendCap.js";
import type { JournalRecord } from "../journal.js";
import { isIntent, isOutcome } from "../journal.js";
import { capDenomOf } from "./denoms.js";

/**
 * Re-apply a prior run's committed gross outflow to the cap at singleton construction. A worker
 * restart otherwise rebuilds the SpendCap at full budget while the seq allocator is journal-seeded,
 * so the same operator budget could be spent twice. Only `committed` outcomes count, and the
 * charge is read EXCLUSIVELY from the intent's `charged` field — the cap-charged amounts actually
 * reserved — never from display `denoms`, so an inflow action that journaled a positive denom while
 * charging nothing (undelegate / redelegate / claim / withdraw) contributes zero on restart.
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
    const items = (record.charged ?? [])
      .filter((amount) => /^\d+$/.test(amount.micro))
      .map((amount) => ({ denom: capDenomOf(amount.denom), micro: BigInt(amount.micro) }))
      .filter((item): item is { denom: CapDenom; micro: bigint } => item.denom !== undefined && item.micro > 0n);
    if (items.length > 0) {
      cap.record(items);
    }
  }
}
