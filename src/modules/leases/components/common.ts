import type { LeaseData } from "@/common/types";

export enum TEMPLATES {
  "opening",
  "opened",
  "paid",
  "closed",
  "repayment"
}

export function getStatus(lease: LeaseData) {
  if (lease?.leaseStatus?.opening) {
    return TEMPLATES.opening;
  }

  if (lease?.leaseStatus?.opened) {
    return TEMPLATES.opened;
  }

  if (lease?.leaseStatus?.paid) {
    return TEMPLATES.paid;
  }

  return null;
}
