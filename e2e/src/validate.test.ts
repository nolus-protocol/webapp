import { describe, expect, it } from "vitest";
import { parseBalanceInfo, parseBalanceUpdateFrame, parseBalancesResponse, parseLeasesResponse } from "./validate.js";

const BALANCE = {
  key: "NLS@X",
  symbol: "unls",
  denom: "unls",
  amount: "475000",
  amount_usd: "0.5",
  decimal_digits: 6
};

describe("parseBalanceInfo", () => {
  it("returns the six typed fields for a well-formed entry", () => {
    expect(parseBalanceInfo(BALANCE, "b")).toEqual(BALANCE);
  });

  it("throws naming the field when a numeric field has the wrong type", () => {
    expect(() => parseBalanceInfo({ ...BALANCE, decimal_digits: "6" }, "b")).toThrow(
      "b.decimal_digits must be a finite number"
    );
  });

  it("throws when a string field is missing", () => {
    const withoutDenom = {
      key: BALANCE.key,
      symbol: BALANCE.symbol,
      amount: BALANCE.amount,
      amount_usd: BALANCE.amount_usd,
      decimal_digits: BALANCE.decimal_digits
    };
    expect(() => parseBalanceInfo(withoutDenom, "b")).toThrow("b.denom must be a string");
  });

  it("throws when the value is not an object", () => {
    expect(() => parseBalanceInfo("nope", "b")).toThrow("b must be an object");
  });
});

describe("parseBalancesResponse", () => {
  it("parses balances and the total", () => {
    expect(parseBalancesResponse({ balances: [BALANCE], total_value_usd: "0.5" })).toEqual({
      balances: [BALANCE],
      total_value_usd: "0.5"
    });
  });

  it("throws when balances is not an array", () => {
    expect(() => parseBalancesResponse({ balances: {}, total_value_usd: "0" })).toThrow(
      "balances response.balances must be an array"
    );
  });
});

describe("parseLeasesResponse", () => {
  it("parses an open lease carrying an interest object", () => {
    const response = {
      leases: [{ interest: { loan_rate: 8, margin_rate: 25, annual_rate_percent: 3.3 } }],
      total_collateral_usd: "1",
      total_debt_usd: "0"
    };
    expect(parseLeasesResponse(response)).toEqual({
      leases: [{ interest: { loan_rate: 8, margin_rate: 25, annual_rate_percent: 3.3 } }],
      total_collateral_usd: "1",
      total_debt_usd: "0"
    });
  });

  it("treats an absent interest as a lease without interest", () => {
    const response = { leases: [{}], total_collateral_usd: "0", total_debt_usd: "0" };
    expect(parseLeasesResponse(response).leases).toEqual([{}]);
  });

  it("treats a null interest as a lease without interest", () => {
    const response = { leases: [{ interest: null }], total_collateral_usd: "0", total_debt_usd: "0" };
    expect(parseLeasesResponse(response).leases).toEqual([{}]);
  });

  it("throws when an interest field has the wrong type", () => {
    const response = {
      leases: [{ interest: { loan_rate: "8", margin_rate: 25, annual_rate_percent: 3.3 } }],
      total_collateral_usd: "0",
      total_debt_usd: "0"
    };
    expect(() => parseLeasesResponse(response)).toThrow("leases[0].interest.loan_rate must be a finite number");
  });
});

describe("parseBalanceUpdateFrame", () => {
  const frame = {
    type: "balance_update",
    chain: "nolus",
    address: "nolus1abc",
    balances: [BALANCE],
    total_value_usd: "0.5",
    timestamp: "2026-07-16T07:20:29.279Z"
  };

  it("parses a well-formed balance_update frame", () => {
    expect(parseBalanceUpdateFrame(frame)).toEqual({
      chain: "nolus",
      address: "nolus1abc",
      balances: [BALANCE],
      total_value_usd: "0.5",
      timestamp: "2026-07-16T07:20:29.279Z"
    });
  });

  it("throws when the timestamp is not parseable", () => {
    expect(() => parseBalanceUpdateFrame({ ...frame, timestamp: "not-a-date" })).toThrow(
      "balance_update.timestamp is not a parseable timestamp"
    );
  });

  it("throws when the frame is not an object", () => {
    expect(() => parseBalanceUpdateFrame(42)).toThrow("balance_update must be an object");
  });
});
