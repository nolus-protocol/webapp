import type { SerialQueue, SubmissionKind } from "./serialQueue.js";
import type { SpendCap, SpendItem, SpendCheck } from "./spendCap.js";
import type { IntentAction } from "./journal.js";
import type { LeftoverReport, OpenLease, PendingUnbonding, TerminalPath } from "./report.js";
import { assembleLeftoverReport } from "./report.js";
import type { JournalRecord } from "./journal.js";

/**
 * Retries on any spend path are 0 by contract — a retried broadcast risks a double-spend. The
 * constructor asserts the Playwright project's `retries` equals this, so the contract is enforced
 * at construction rather than merely documented.
 */
export const SPEND_PATH_RETRIES = 0;

export type WalletRole = "primary" | "secondary";

export interface WalletRoleConfig {
  role: WalletRole;
  key: string;
  address: string;
}

export interface EngineOptions {
  primary: WalletRoleConfig;
  secondary: WalletRoleConfig;
  workers: number;
  retries: number;
  wallet2LowWaterMicro: bigint;
}

export interface EngineDeps {
  queue: SerialQueue;
  cap: SpendCap;
}

export type SpendCheckFail = Extract<SpendCheck, { ok: false }>;

export type SpendOutcome<T> = { status: "committed"; value: T } | { status: "spend-cap-abort"; check: SpendCheckFail };

export interface SpendRequest<T> {
  walletKey: string;
  action: IntentAction;
  items: SpendItem[];
  execute: () => Promise<T>;
}

export class EngineHaltedError extends Error {
  constructor(reason: string) {
    super(`tx engine halted: ${reason}`);
    this.name = "EngineHaltedError";
  }
}

export class RoleViolationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "RoleViolationError";
  }
}

/**
 * The TxEngine composes the serial queue, the spend cap, the journal, and the reconciliation
 * sweep. It enforces the wallet-role contract (the primary is the sole governed spend actor;
 * the secondary acts only as a receive-side / micro-send counterparty), refuses to run under
 * Playwright worker parallelism > 1, and holds a kill switch: a spend-cap abort or an explicit
 * abort completes the in-flight commit, then refuses every further submission. It never drives
 * broadcasts or fs itself — those are injected — so the whole decision surface is unit-tested.
 */
export class TxEngine {
  private readonly queue: SerialQueue;
  private readonly cap: SpendCap;
  private readonly primary: WalletRoleConfig;
  private readonly secondary: WalletRoleConfig;
  private readonly wallet2LowWaterMicro: bigint;
  private haltReason: string | null = null;

  constructor(deps: EngineDeps, options: EngineOptions) {
    if (options.primary.role !== "primary" || options.secondary.role !== "secondary") {
      throw new RoleViolationError("expected a primary and a secondary wallet role");
    }
    if (options.workers > 1) {
      throw new RoleViolationError(`tx engine requires serial execution (workers=${options.workers})`);
    }
    if (options.retries !== SPEND_PATH_RETRIES) {
      throw new RoleViolationError(
        `spend paths must not retry (retries=${options.retries}, required ${SPEND_PATH_RETRIES})`
      );
    }
    this.queue = deps.queue;
    this.cap = deps.cap;
    this.primary = options.primary;
    this.secondary = options.secondary;
    this.wallet2LowWaterMicro = options.wallet2LowWaterMicro;
  }

  get halted(): boolean {
    return this.haltReason !== null;
  }

  get reason(): string | null {
    return this.haltReason;
  }

  abort(reason: string): void {
    if (this.haltReason === null) {
      this.haltReason = reason;
    }
  }

  /** A governed value-moving action by the primary wallet — the only wallet allowed to spend. */
  spend<T>(request: SpendRequest<T>): Promise<SpendOutcome<T>> {
    if (request.walletKey !== this.primary.key) {
      return Promise.reject(new RoleViolationError("only the primary wallet may perform a governed spend"));
    }
    const kind: SubmissionKind = request.action === "redelegate" ? "redelegate" : "spend";
    return this.governed(request, kind);
  }

  /** A dust native micro-send used as a receive-side counterparty; either wallet may send it. */
  counterpartySend<T>(request: SpendRequest<T>): Promise<SpendOutcome<T>> {
    if (request.walletKey !== this.primary.key && request.walletKey !== this.secondary.key) {
      return Promise.reject(new RoleViolationError("counterparty send from an unknown wallet"));
    }
    return this.governed(request, "spend");
  }

  private async governed<T>(request: SpendRequest<T>, kind: SubmissionKind): Promise<SpendOutcome<T>> {
    if (this.haltReason !== null) {
      throw new EngineHaltedError(this.haltReason);
    }
    const check = this.cap.check(request.items);
    if (!check.ok) {
      this.abort("spend-cap-abort");
      return { status: "spend-cap-abort", check };
    }
    this.cap.reserve(request.items);
    const value = await this.queue
      .submit({ walletKey: request.walletKey, kind, bucket: "standard", execute: request.execute })
      .then(
        (settled) => {
          this.cap.settle(request.items);
          return settled;
        },
        (error: unknown) => {
          this.cap.release(request.items);
          throw error instanceof Error ? error : new Error(String(error));
        }
      );
    return { status: "committed", value };
  }

  /** A warning string when wallet-2's native balance has fallen below its configured floor. */
  lowBalanceWarning(wallet2NativeMicro: bigint): string | null {
    if (wallet2NativeMicro >= this.wallet2LowWaterMicro) {
      return null;
    }
    return `wallet-2 native balance ${wallet2NativeMicro.toString()} is below the ${this.wallet2LowWaterMicro.toString()} micro-NLS low-water floor`;
  }

  buildReport(input: {
    generatedAt: string;
    terminal: TerminalPath;
    journal: JournalRecord[];
    openLeases: OpenLease[];
    pendingUnbondings: PendingUnbonding[];
    warnings: string[];
  }): LeftoverReport {
    return assembleLeftoverReport({
      generatedAt: input.generatedAt,
      terminal: input.terminal,
      journal: input.journal,
      openLeases: input.openLeases,
      pendingUnbondings: input.pendingUnbondings,
      spend: this.cap.snapshot(),
      warnings: input.warnings
    });
  }
}
