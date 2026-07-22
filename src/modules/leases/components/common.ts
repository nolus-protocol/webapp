import type { LeaseInfo } from "@/common/api";

export enum TEMPLATES {
  "opening",
  "opened",
  "paid",
  "closing",
  "closed",
  "liquidated",
  "open_failed"
}

/**
 * Get the status template for a lease
 */
export function getLeaseStatus(lease: LeaseInfo | null | undefined): TEMPLATES {
  if (!lease) return TEMPLATES.opening;

  switch (lease.status) {
    case "opening":
      return TEMPLATES.opening;
    case "opened":
      return TEMPLATES.opened;
    case "paid_off":
      return TEMPLATES.paid;
    case "closing":
      return TEMPLATES.closing;
    case "closed":
      return TEMPLATES.closed;
    case "liquidated":
      return TEMPLATES.liquidated;
    case "open_failed":
      return TEMPLATES.open_failed;
    default:
      return TEMPLATES.opening;
  }
}

/**
 * Whether a lease is mid-operation (opening/closing, or an in-progress action on
 * an opened lease). Terminal states — including `open_failed` — are never in
 * progress. Pure helper so the contract is unit-testable independent of the UI.
 */
export function isLeaseInProgress(lease: LeaseInfo): boolean {
  if (lease.status === "opening" || lease.status === "closing") {
    return true;
  }
  if (lease.in_progress) {
    return true;
  }
  return false;
}
