import { sanitizeRpc } from "../transfer.js";
import type { Classification } from "./taxonomy.js";

export type WalletRole = "primary" | "secondary";

export type IntentAction =
  | "native-send"
  | "swap"
  | "lease-open"
  | "lease-close"
  | "lease-repay"
  | "delegate"
  | "undelegate"
  | "redelegate"
  | "earn-supply"
  | "earn-withdraw"
  | "stake-claim"
  | "ibc-transfer";

export interface DenomAmount {
  denom: string;
  micro: string;
}

export interface JournalIntent {
  type: "intent";
  seq: number;
  ts: string;
  spec: string;
  walletRole: WalletRole;
  action: IntentAction;
  denoms: DenomAmount[];
  /**
   * The cap-charged amounts (native micro) actually reserved against the SpendCap for this intent,
   * keyed by cap denom. Distinct from `denoms`, which is display data an inflow action may report
   * as positive while charging nothing. Restart cap-seeding reconstructs spent-state from this
   * field exclusively, so a re-entered run never re-charges a zero-charge inflow.
   */
  charged?: DenomAmount[];
  memo?: string;
}

export type OutcomeStatus = "committed" | "failed" | "aborted";

export interface JournalOutcome {
  type: "outcome";
  seq: number;
  ts: string;
  status: OutcomeStatus;
  txHash?: string;
  height?: number;
  failure?: Classification;
}

export type JournalRecord = JournalIntent | JournalOutcome;

const redact = (value: string): string => sanitizeRpc(value, "");

export function isIntent(record: JournalRecord): record is JournalIntent {
  return record.type === "intent";
}

export function isOutcome(record: JournalRecord): record is JournalOutcome {
  return record.type === "outcome";
}

export interface IntentInput {
  seq: number;
  ts: string;
  spec: string;
  walletRole: WalletRole;
  action: IntentAction;
  denoms: DenomAmount[];
  charged?: DenomAmount[];
  memo?: string;
}

export function buildIntent(input: IntentInput): JournalIntent {
  const record: JournalIntent = {
    type: "intent",
    seq: input.seq,
    ts: input.ts,
    spec: redact(input.spec),
    walletRole: input.walletRole,
    action: input.action,
    denoms: input.denoms.map((d) => ({ denom: redact(d.denom), micro: d.micro }))
  };
  if (input.charged !== undefined) {
    record.charged = input.charged.map((c) => ({ denom: redact(c.denom), micro: c.micro }));
  }
  if (input.memo !== undefined) {
    record.memo = redact(input.memo);
  }
  return record;
}

export interface OutcomeInput {
  seq: number;
  ts: string;
  status: OutcomeStatus;
  txHash?: string;
  height?: number;
  failure?: Classification;
}

export function buildOutcome(input: OutcomeInput): JournalOutcome {
  const record: JournalOutcome = { type: "outcome", seq: input.seq, ts: input.ts, status: input.status };
  if (input.txHash !== undefined) {
    record.txHash = redact(input.txHash);
  }
  if (input.height !== undefined) {
    record.height = input.height;
  }
  if (input.failure !== undefined) {
    record.failure = { ...input.failure, reason: redact(input.failure.reason) };
  }
  return record;
}

export function serializeRecord(record: JournalRecord): string {
  return JSON.stringify(record);
}

function isJournalRecord(value: unknown): value is JournalRecord {
  if (typeof value !== "object" || value === null) {
    return false;
  }
  const type = (value as { type?: unknown }).type;
  return type === "intent" || type === "outcome";
}

/**
 * Parse a JSONL journal back into records. A corrupt or malformed line (bad JSON, or valid JSON
 * of the wrong shape) is skipped rather than thrown — a hard crash can leave a half-written final
 * line, and one torn record must not lose the whole journal. Every kept line is narrowed through
 * `unknown` and validated on its discriminant, never cast blindly.
 */
export function parseRecords(contents: string): JournalRecord[] {
  const records: JournalRecord[] = [];
  for (const raw of contents.split("\n")) {
    const line = raw.trim();
    if (line.length === 0) {
      continue;
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(line);
    } catch {
      continue;
    }
    if (isJournalRecord(parsed)) {
      records.push(parsed);
    }
  }
  return records;
}

/** Intents with no matching outcome record — the write-ahead entries a crash would leave behind. */
export function unmatchedIntents(records: JournalRecord[]): JournalIntent[] {
  const settled = new Set(records.filter(isOutcome).map((outcome) => outcome.seq));
  return records.filter(isIntent).filter((intent) => !settled.has(intent.seq));
}
