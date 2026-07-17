import type { OpenLease, PendingUnbonding } from "./report.js";

/**
 * Injected so the sweep stays pure. `fetchJson` is the sole rate-pacing owner: it self-paces
 * per URL (strict bucket for `/api/swap/*`, standard otherwise), so the sweep never double-draws.
 */
export interface SweepDeps {
  fetchJson: (url: string) => Promise<unknown>;
  now?: () => number;
}

export interface SweepOptions {
  origin: string;
  address: string;
  attempts: Map<string, number>;
  orphanMinAgeMs?: number;
  maxAttempts?: number;
}

export interface RepairCandidate {
  address: string;
  protocol: string;
  openedAt: string | undefined;
  attempt: number;
}

export interface ToleratedLease {
  address: string;
  protocol: string;
  status: string;
}

export interface SweepResult {
  queuedForRepair: RepairCandidate[];
  reportOnly: RepairCandidate[];
  tolerated: ToleratedLease[];
  openLeases: OpenLease[];
  pendingUnbondings: PendingUnbonding[];
  nextAttempts: Map<string, number>;
}

const DEFAULT_ORPHAN_MIN_AGE_MS = 30 * 60 * 1000;
const DEFAULT_MAX_ATTEMPTS = 3;

// The one status a stuck E2E run leaves value in and that the app can drive closed. Every other
// status is a transient or terminal chain state that must be tolerated, never force-repaired.
const OPENED = "opened";

interface RawLease {
  address: string;
  protocol: string;
  status: string;
  openedAt: string | undefined;
}

/** The resolved knobs for one sweep, threaded as an object so the numbers can't be transposed. */
interface SweepSettings {
  now: number;
  minAgeMs: number;
  maxAttempts: number;
}

function asRecord(value: unknown): Record<string, unknown> | undefined {
  return typeof value === "object" && value !== null ? (value as Record<string, unknown>) : undefined;
}

function str(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

function extractLeases(payload: unknown): RawLease[] {
  const root = asRecord(payload);
  const list = root?.leases;
  if (!Array.isArray(list)) {
    return [];
  }
  const out: RawLease[] = [];
  for (const entry of list) {
    const rec = asRecord(entry);
    const address = str(rec?.address);
    const status = str(rec?.status);
    if (address === undefined || status === undefined) {
      continue;
    }
    out.push({ address, protocol: str(rec?.protocol) ?? "", status, openedAt: str(rec?.opened_at) });
  }
  return out;
}

function extractUnbondings(payload: unknown): PendingUnbonding[] {
  const root = asRecord(payload);
  const list = root?.unbonding;
  if (!Array.isArray(list)) {
    return [];
  }
  const out: PendingUnbonding[] = [];
  for (const entry of list) {
    const rec = asRecord(entry);
    const validatorAddress = str(rec?.validator_address);
    const entries = Array.isArray(rec?.entries) ? rec.entries : [];
    if (validatorAddress === undefined) {
      continue;
    }
    out.push({ validatorAddress, entries: entries.length, balanceMicro: sumEntryBalances(entries) });
  }
  return out;
}

function sumEntryBalances(entries: unknown[]): string {
  let total = 0n;
  for (const entry of entries) {
    const balance = str(asRecord(entry)?.balance);
    if (balance !== undefined && /^\d+$/.test(balance)) {
      total += BigInt(balance);
    }
  }
  return total.toString();
}

function ageMs(openedAt: string | undefined, now: number): number | undefined {
  if (openedAt === undefined) {
    return undefined;
  }
  const parsed = Date.parse(openedAt);
  return Number.isNaN(parsed) ? undefined : now - parsed;
}

function isOrphan(lease: RawLease, settings: SweepSettings): boolean {
  if (lease.status !== OPENED) {
    return false;
  }
  const age = ageMs(lease.openedAt, settings.now);
  return age !== undefined && age >= settings.minAgeMs;
}

/**
 * Pre-run sweep: enumerate leases and unbondings for `address` and classify them. An `opened`
 * lease older than the orphan grace period is queued for UI-driven repair while its recorded
 * attempt count is under the cap, else it is report-only (never endlessly retried). Every other
 * lease status is tolerated and reported, never repaired. Pending unbondings inside the 21-day
 * window are recognized leftover state and only reported. Partial-empty API responses (any of
 * the three staking sub-calls can come back empty on an upstream failure) are handled as empty.
 */
export async function sweep(deps: SweepDeps, options: SweepOptions): Promise<SweepResult> {
  const settings: SweepSettings = {
    now: deps.now?.() ?? Date.now(),
    minAgeMs: options.orphanMinAgeMs ?? DEFAULT_ORPHAN_MIN_AGE_MS,
    maxAttempts: options.maxAttempts ?? DEFAULT_MAX_ATTEMPTS
  };

  const leasesPayload = await deps.fetchJson(`${options.origin}/api/leases?address=${options.address}`);
  const stakingPayload = await deps.fetchJson(`${options.origin}/api/staking/positions?address=${options.address}`);

  return classify(extractLeases(leasesPayload), extractUnbondings(stakingPayload), options, settings);
}

function classify(
  leases: RawLease[],
  pendingUnbondings: PendingUnbonding[],
  options: SweepOptions,
  settings: SweepSettings
): SweepResult {
  const result: SweepResult = {
    queuedForRepair: [],
    reportOnly: [],
    tolerated: [],
    openLeases: [],
    pendingUnbondings,
    nextAttempts: new Map(options.attempts)
  };
  for (const lease of leases) {
    partition(lease, options, settings, result);
  }
  return result;
}

function partition(lease: RawLease, options: SweepOptions, settings: SweepSettings, result: SweepResult): void {
  if (lease.status === OPENED) {
    result.openLeases.push({ address: lease.address, protocol: lease.protocol, status: lease.status });
  }
  if (!isOrphan(lease, settings)) {
    result.tolerated.push({ address: lease.address, protocol: lease.protocol, status: lease.status });
    return;
  }
  const attempt = options.attempts.get(lease.address) ?? 0;
  const candidate: RepairCandidate = {
    address: lease.address,
    protocol: lease.protocol,
    openedAt: lease.openedAt,
    attempt
  };
  if (attempt >= settings.maxAttempts) {
    result.reportOnly.push(candidate);
    return;
  }
  result.queuedForRepair.push(candidate);
  result.nextAttempts.set(lease.address, attempt + 1);
}
