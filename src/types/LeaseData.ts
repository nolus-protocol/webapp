import type { LeaseStatus } from "@nolus/nolusjs/build/contracts";

export interface LeaseData {
  leaseAddress: string;
  leaseStatus: LeaseStatus;
  height?: string;
}
