import {
  appendFileSync,
  closeSync,
  existsSync,
  fsyncSync,
  mkdirSync,
  openSync,
  readFileSync,
  writeFileSync
} from "node:fs";
import { join, resolve } from "node:path";
import type { JournalRecord } from "./journal.js";
import { parseRecords, serializeRecord } from "./journal.js";

export const JOURNAL_FILE_NAME = "t3-journal.jsonl";
export const REPORT_FILE_NAME = "t3-report.json";

// Thin fs glue over the pure journal model in journal.ts. Coverage-excluded (see
// vitest.config.ts) alongside the other network/fs runners; the record shapes and the
// leftover-report assembly it drives are unit-tested in journal.ts / report.ts.

/**
 * A write-ahead JSONL journal. Every record is flushed with `fsync` before the call returns, so
 * a record written before a broadcast survives a hard crash of the run. Append opens the file
 * per record (O_APPEND) — the write volume is a handful of records per run, not a hot path.
 */
export class JournalStore {
  private readonly path: string;

  constructor(resultsDir: string) {
    const dir = resolve(resultsDir);
    mkdirSync(dir, { recursive: true });
    this.path = join(dir, JOURNAL_FILE_NAME);
  }

  append(record: JournalRecord): void {
    const fd = openSync(this.path, "a");
    try {
      appendFileSync(fd, `${serializeRecord(record)}\n`);
      fsyncSync(fd);
    } finally {
      closeSync(fd);
    }
  }

  readAll(): JournalRecord[] {
    if (!existsSync(this.path)) {
      return [];
    }
    return parseRecords(readFileSync(this.path, "utf8"));
  }
}

export function writeReportFile(resultsDir: string, report: unknown): string {
  const dir = resolve(resultsDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, REPORT_FILE_NAME);
  writeFileSync(path, `${JSON.stringify(report, null, 2)}\n`, "utf8");
  return path;
}

const ATTEMPTS_FILE_NAME = "t3-repair-attempts.json";

/** Read the orphan-lease repair attempt counters persisted across runs. Tolerates a missing/bad file. */
export function readAttempts(resultsDir: string): Map<string, number> {
  const path = join(resolve(resultsDir), ATTEMPTS_FILE_NAME);
  if (!existsSync(path)) {
    return new Map();
  }
  try {
    const parsed = JSON.parse(readFileSync(path, "utf8")) as unknown;
    if (typeof parsed !== "object" || parsed === null) {
      return new Map();
    }
    const out = new Map<string, number>();
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof value === "number" && Number.isInteger(value)) {
        out.set(key, value);
      }
    }
    return out;
  } catch {
    return new Map();
  }
}

export function writeAttempts(resultsDir: string, attempts: Map<string, number>): void {
  const dir = resolve(resultsDir);
  mkdirSync(dir, { recursive: true });
  const path = join(dir, ATTEMPTS_FILE_NAME);
  writeFileSync(path, `${JSON.stringify(Object.fromEntries(attempts), null, 2)}\n`, "utf8");
}
