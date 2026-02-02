import type { LeaseInfo } from "@/common/api";

export enum TEMPLATES {
  "opening",
  "opened",
  "paid",
  "closing",
  "closed",
  "liquidated",
  "repayment"
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
    default:
      return TEMPLATES.opening;
  }
}
