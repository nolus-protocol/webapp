import type { DenomAmount, JournalRecord } from "./journal.js";
import { unmatchedIntents } from "./journal.js";
import type { SpendSnapshot } from "./spendCap.js";

export type TerminalPath = "success" | "app-failure" | "spend-cap-abort" | "crash";

export interface OpenLease {
  address: string;
  protocol: string;
  status: string;
}

export interface PendingUnbonding {
  validatorAddress: string;
  entries: number;
  balanceMicro: string;
}

export interface UnfinishedSwap {
  seq: number;
  spec: string;
  denoms: DenomAmount[];
}

export interface SpendLine {
  denom: string;
  capMicro: string;
  spentMicro: string;
}

/**
 * The machine-readable leftover-state report consumed by the #285 reporting tier. `version`
 * is bumped on any shape change. `openLeases` and `pendingUnbondings` are the chain-enumerated
 * sweep results; `unfinishedSwaps` come from the journal because a swap is not chain-queryable.
 * Emitted on every terminal path (success, app-failure, spend-cap-abort); a hard crash still
 * leaves the write-ahead journal from which this same shape can be reconstructed.
 */
export interface LeftoverReport {
  suite: "t3";
  version: 1;
  generatedAt: string;
  terminal: TerminalPath;
  openLeases: OpenLease[];
  pendingUnbondings: PendingUnbonding[];
  unfinishedSwaps: UnfinishedSwap[];
  spend: SpendLine[];
  warnings: string[];
}

export interface LeftoverReportInput {
  generatedAt: string;
  terminal: TerminalPath;
  journal: JournalRecord[];
  openLeases: OpenLease[];
  pendingUnbondings: PendingUnbonding[];
  spend: SpendSnapshot[];
  warnings: string[];
}

export function assembleLeftoverReport(input: LeftoverReportInput): LeftoverReport {
  const unfinishedSwaps = unmatchedIntents(input.journal)
    .filter((intent) => intent.action === "swap")
    .map((intent) => ({ seq: intent.seq, spec: intent.spec, denoms: intent.denoms }));
  return {
    suite: "t3",
    version: 1,
    generatedAt: input.generatedAt,
    terminal: input.terminal,
    openLeases: input.openLeases,
    pendingUnbondings: input.pendingUnbondings,
    unfinishedSwaps,
    spend: input.spend.map((line) => ({
      denom: line.denom,
      capMicro: line.capMicro.toString(),
      spentMicro: line.spentMicro.toString()
    })),
    warnings: input.warnings
  };
}
