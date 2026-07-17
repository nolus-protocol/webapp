import { readString } from "../../t2/matrixHelpers.js";

export type LeaseSide = "long" | "short";
export type LeaseSideSetting = LeaseSide | "both";

export type SideSettingResult = { ok: true; setting: LeaseSideSetting | undefined } | { ok: false; error: string };

const LEASE_GROUP = "lease";
const MS_PER_DAY = 86400000;

/**
 * Day of year (1–366) in UTC. The lease side alternates on this parity so consecutive
 * daily runs exercise both directions without an operator toggle — computed in UTC so the
 * agent's local timezone can never flip the selection relative to CI.
 */
export function dayOfYearUtc(date: Date): number {
  const startOfYear = Date.UTC(date.getUTCFullYear(), 0, 1);
  const elapsed = Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()) - startOfYear;
  return Math.floor(elapsed / MS_PER_DAY) + 1;
}

/** Even day-of-year opens a long, odd opens a short — the default alternation scheme. */
export function parityLeaseSide(dayOfYear: number): LeaseSide {
  return dayOfYear % 2 === 0 ? "long" : "short";
}

/**
 * Parse the optional `E2E_LEASE_SIDE` override. Unset returns `{ ok: true, setting: undefined }`
 * (parity decides); `long`/`short`/`both` are the only accepted values — anything else is a hard
 * config error rather than a silent fallback, so a typo can never quietly pin one side.
 */
export function resolveLeaseSideSetting(raw: string | undefined): SideSettingResult {
  const trimmed = raw?.trim().toLowerCase();
  if (trimmed === undefined || trimmed === "") {
    return { ok: true, setting: undefined };
  }
  if (trimmed === "long" || trimmed === "short" || trimmed === "both") {
    return { ok: true, setting: trimmed };
  }
  return { ok: false, error: `E2E_LEASE_SIDE must be one of long|short|both (got "${raw ?? ""}")` };
}

/**
 * The concrete lease sides a run opens: the parity pick when unset, the named side when pinned,
 * or both directions when `both` (reserved for a future raised-cap run — the caller must
 * precondition-skip the second open when it would exceed the USDC cap).
 */
export function resolveLeaseSides(setting: LeaseSideSetting | undefined, dayOfYear: number): LeaseSide[] {
  if (setting === undefined) {
    return [parityLeaseSide(dayOfYear)];
  }
  if (setting === "both") {
    return ["long", "short"];
  }
  return [setting];
}

/**
 * The short lease's opened position is denominated in a protocol currency whose `group` is
 * `lease`, NOT the USDC/LPN downpayment — a short asserts against this stable ticker so the
 * value read is the collateral leg, never the vacuous $0-priced NLS. Throws loudly when no
 * lease-group currency is present so a drifted `/api/currencies` shape is a red, not an empty
 * selection.
 */
export function resolveShortLeaseStable(currencies: unknown): string {
  const list = Array.isArray(currencies) ? currencies : [];
  for (const entry of list) {
    if (readString(entry, "group") === LEASE_GROUP) {
      const ticker = readString(entry, "ticker");
      if (ticker !== undefined) {
        return ticker;
      }
    }
  }
  throw new Error("no lease-group currency found for the short position stable");
}
