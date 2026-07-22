import { describe, it, expect } from "vitest";
import type { LeaseInfo } from "@/common/api";
// Namespace import so a not-yet-added export (isLeaseInProgress) surfaces as a
// runtime failure in its own tests rather than hard-failing module load for the
// getLeaseStatus tests below.
import * as LeaseCommon from "./common";

const mkLease = (o: Partial<LeaseInfo>): LeaseInfo =>
  ({
    address: "nolus1lease",
    protocol: "osmosis-noble",
    status: "opened",
    amount: { ticker: "ATOM", amount: "0" },
    debt: {
      ticker: "USDC",
      principal: "0",
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "0",
      due_interest: "0",
      total: "0"
    },
    interest: { loan_rate: 0, margin_rate: 0, annual_rate_percent: 0 },
    ...o
  }) as LeaseInfo;

describe("getLeaseStatus", () => {
  it("maps each existing status to its own template", () => {
    const { getLeaseStatus, TEMPLATES } = LeaseCommon;
    expect(getLeaseStatus(mkLease({ status: "opening" }))).toBe(TEMPLATES.opening);
    expect(getLeaseStatus(mkLease({ status: "opened" }))).toBe(TEMPLATES.opened);
    expect(getLeaseStatus(mkLease({ status: "paid_off" }))).toBe(TEMPLATES.paid);
    expect(getLeaseStatus(mkLease({ status: "closing" }))).toBe(TEMPLATES.closing);
    expect(getLeaseStatus(mkLease({ status: "closed" }))).toBe(TEMPLATES.closed);
    expect(getLeaseStatus(mkLease({ status: "liquidated" }))).toBe(TEMPLATES.liquidated);
  });

  // An open_failed lease must get its own terminal template — falling through to
  // TEMPLATES.opening renders the position as an eternal opening skeleton.
  it("maps open_failed to its own open_failed template", () => {
    const { getLeaseStatus, TEMPLATES } = LeaseCommon;
    expect(getLeaseStatus(mkLease({ status: "open_failed" as LeaseInfo["status"] }))).toBe(TEMPLATES.open_failed);
  });

  it("does NOT render an open_failed lease as the opening skeleton", () => {
    const { getLeaseStatus, TEMPLATES } = LeaseCommon;
    expect(getLeaseStatus(mkLease({ status: "open_failed" as LeaseInfo["status"] }))).not.toBe(TEMPLATES.opening);
  });
});

// isLeaseInProgress is an exported pure helper (extracted from useLeases) so its
// terminal-state contract is unit-testable independent of the UI.
describe("isLeaseInProgress", () => {
  it("is false for a terminal open_failed lease", () => {
    expect(LeaseCommon.isLeaseInProgress(mkLease({ status: "open_failed" as LeaseInfo["status"] }))).toBe(false);
  });

  it("is true for an opening lease", () => {
    expect(LeaseCommon.isLeaseInProgress(mkLease({ status: "opening" }))).toBe(true);
  });

  it("is true for a closing lease", () => {
    expect(LeaseCommon.isLeaseInProgress(mkLease({ status: "closing" }))).toBe(true);
  });

  it("is true for an opened lease with an in-progress operation", () => {
    expect(LeaseCommon.isLeaseInProgress(mkLease({ status: "opened", in_progress: { close: {} } }))).toBe(true);
  });

  it("is false for a plain opened lease", () => {
    expect(LeaseCommon.isLeaseInProgress(mkLease({ status: "opened" }))).toBe(false);
  });
});
