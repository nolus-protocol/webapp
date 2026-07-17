import type { JournalRecord } from "../journal.js";
import { isIntent } from "../journal.js";

export interface SeqAllocator {
  /** The next unused seq, advancing the counter. */
  next(): number;
  /** The seq `next()` would return, without advancing. */
  peek(): number;
}

/**
 * The highest intent seq already present in a journal, or 0 when there are none. A run seeds
 * its allocator above this so a resumed journal (a crash left write-ahead intents on disk) can
 * never re-issue a seq that already names an earlier intent — a collision would corrupt the
 * intent/outcome matching `unmatchedIntents` relies on.
 */
export function highestIntentSeq(records: JournalRecord[]): number {
  let max = 0;
  for (const record of records) {
    if (isIntent(record) && record.seq > max) {
      max = record.seq;
    }
  }
  return max;
}

/**
 * A run-scoped monotonic seq allocator. One instance is shared by every flow spec through the
 * run singleton (workers = 1, so one process holds one counter), which is what keeps intents
 * from different specs from colliding on a hardcoded seq.
 */
export function createSeqAllocator(start: number): SeqAllocator {
  if (!Number.isInteger(start) || start < 1) {
    throw new Error(`seq allocator start must be a positive integer (got ${start})`);
  }
  let nextSeq = start;
  return {
    next(): number {
      const value = nextSeq;
      nextSeq += 1;
      return value;
    },
    peek(): number {
      return nextSeq;
    }
  };
}

/** Seed an allocator at one past the highest seq already journaled. */
export function seqAllocatorFromJournal(records: JournalRecord[]): SeqAllocator {
  return createSeqAllocator(highestIntentSeq(records) + 1);
}
