import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  PricesResponseSchema,
  BalancesResponseSchema,
  LeaseInfoSchema,
  LeasesResponseSchema,
  EarnPoolSchema,
  EarnPositionsResponseSchema,
  GasFeeConfigResponseSchema
} from "./index";

// These tests exercise the Zod runtime validation schemas that guard the
// financial API responses. Schemas must reject non-numeric strings in price
// fields, tolerate extra backend fields (.passthrough), and reject malformed
// shapes entirely so the caller can surface a validation error rather than
// silently falling back to 0/1/3.5.

// ---------------------------------------------------------------------------
// PricesResponseSchema
// ---------------------------------------------------------------------------

describe("PricesResponseSchema", () => {
  const validPrices = () => ({
    prices: {
      USDC: { key: "USDC", symbol: "USDC", price_usd: "1.0001" },
      OSMO: { key: "OSMO", symbol: "OSMO", price_usd: "0.42" }
    },
    updated_at: "2026-04-19T10:00:00Z"
  });

  it("should accept a valid prices response", () => {
    const result = PricesResponseSchema.safeParse(validPrices());
    expect(result.success).toBe(true);
  });

  it("should reject empty-string price (numericString refine)", () => {
    const payload = validPrices();
    payload.prices.USDC.price_usd = "";
    const result = PricesResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error).toBeInstanceOf(ZodError);
    }
  });

  it('should reject non-numeric price ("abc")', () => {
    const payload = validPrices();
    payload.prices.USDC.price_usd = "abc";
    const result = PricesResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should accept scientific notation "1e6" (FINDING-8)', () => {
    // Documents FINDING-8: numericString accepts scientific notation because
    // Number("1e6") is finite. Backend is not expected to emit this today,
    // but the schema does not guard against it.
    const payload = validPrices();
    payload.prices.USDC.price_usd = "1e6";
    const result = PricesResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it('should reject "Infinity" string (not finite)', () => {
    const payload = validPrices();
    payload.prices.USDC.price_usd = "Infinity";
    const result = PricesResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should pass through unknown fields inside a price entry", () => {
    const payload = {
      prices: {
        USDC: {
          key: "USDC",
          symbol: "USDC",
          price_usd: "1.0",
          extra_field: "x"
        }
      },
      updated_at: "2026-04-19T10:00:00Z"
    };
    const result = PricesResponseSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      const usdc = result.data.prices.USDC as { extra_field?: string };
      expect(usdc.extra_field).toBe("x");
    }
  });

  it("should require updated_at", () => {
    const payload = validPrices() as Record<string, unknown>;
    delete payload.updated_at;
    const result = PricesResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// BalancesResponseSchema
// ---------------------------------------------------------------------------

describe("BalancesResponseSchema", () => {
  const validBalances = () => ({
    balances: [
      {
        key: "USDC",
        symbol: "USDC",
        denom: "ibc/uusdc",
        amount: "1000000",
        amount_usd: "1.0",
        decimal_digits: 6
      }
    ],
    total_value_usd: "1.0"
  });

  it("should accept a valid balances response", () => {
    const result = BalancesResponseSchema.safeParse(validBalances());
    expect(result.success).toBe(true);
  });

  it("should reject missing total_value_usd", () => {
    const payload = validBalances() as Record<string, unknown>;
    delete payload.total_value_usd;
    const result = BalancesResponseSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should accept empty balances array", () => {
    const result = BalancesResponseSchema.safeParse({
      balances: [],
      total_value_usd: "0"
    });
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// LeaseInfoSchema
// ---------------------------------------------------------------------------

describe("LeaseInfoSchema", () => {
  const validLease = () => ({
    address: "nolus1lease",
    protocol: "osmosis-noble",
    status: "opened" as const,
    amount: {
      ticker: "ATOM",
      amount: "1000000"
    },
    debt: {
      ticker: "USDC",
      principal: "500000",
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "10",
      due_interest: "5",
      total: "500015"
    },
    interest: {
      loan_rate: 0.1,
      margin_rate: 0.02,
      annual_rate_percent: 12
    }
  });

  it("should accept a minimal valid lease", () => {
    const result = LeaseInfoSchema.safeParse(validLease());
    expect(result.success).toBe(true);
  });

  it("should reject missing address", () => {
    const payload = validLease() as Record<string, unknown>;
    delete payload.address;
    const result = LeaseInfoSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should reject non-string protocol", () => {
    const payload = validLease() as unknown as { protocol: unknown };
    payload.protocol = 42;
    const result = LeaseInfoSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should accept all valid status enum values", () => {
    const statuses = ["opening", "opened", "paid_off", "closing", "closed", "liquidated"] as const;
    for (const status of statuses) {
      const payload = { ...validLease(), status };
      const result = LeaseInfoSchema.safeParse(payload);
      expect(result.success).toBe(true);
    }
  });

  it("should reject invalid status enum value", () => {
    const payload = { ...validLease(), status: "in_limbo" as unknown as "opened" };
    const result = LeaseInfoSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it("should pass through unknown extra fields", () => {
    const payload = { ...validLease(), backend_version: "v2" };
    const result = LeaseInfoSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      const data = result.data as { backend_version?: string };
      expect(data.backend_version).toBe("v2");
    }
  });
});

// ---------------------------------------------------------------------------
// LeasesResponseSchema
// ---------------------------------------------------------------------------

describe("LeasesResponseSchema", () => {
  const validLease = () => ({
    address: "nolus1lease",
    protocol: "osmosis-noble",
    status: "opened" as const,
    amount: { ticker: "ATOM", amount: "1000000" },
    debt: {
      ticker: "USDC",
      principal: "500000",
      overdue_margin: "0",
      overdue_interest: "0",
      due_margin: "10",
      due_interest: "5",
      total: "500015"
    },
    interest: {
      loan_rate: 0.1,
      margin_rate: 0.02,
      annual_rate_percent: 12
    }
  });

  it("should accept an empty leases array", () => {
    const result = LeasesResponseSchema.safeParse({
      leases: [],
      total_collateral_usd: "0",
      total_debt_usd: "0"
    });
    expect(result.success).toBe(true);
  });

  it("should accept multiple leases", () => {
    const result = LeasesResponseSchema.safeParse({
      leases: [validLease(), { ...validLease(), address: "nolus1lease2" }],
      total_collateral_usd: "2000",
      total_debt_usd: "1000"
    });
    expect(result.success).toBe(true);
  });

  it("should reject when total_collateral_usd is not numericString", () => {
    const result = LeasesResponseSchema.safeParse({
      leases: [],
      total_collateral_usd: "not-a-number",
      total_debt_usd: "0"
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// EarnPoolSchema
// ---------------------------------------------------------------------------

describe("EarnPoolSchema", () => {
  const validPool = () => ({
    protocol: "osmosis-noble",
    lpp_address: "nolus1lpp",
    currency: "USDC",
    total_deposited: "1000000",
    apy: 0.12,
    utilization: 0.5,
    available_liquidity: "500000"
  });

  it("should accept a valid pool", () => {
    const result = EarnPoolSchema.safeParse(validPool());
    expect(result.success).toBe(true);
  });

  it("should reject missing apy", () => {
    const payload = validPool() as Record<string, unknown>;
    delete payload.apy;
    const result = EarnPoolSchema.safeParse(payload);
    expect(result.success).toBe(false);
  });

  it('should accept 0 utilization (as "0" numericString is not applicable — utilization is z.number())', () => {
    // utilization is z.number() in the schema, not a numericString.
    // Verify 0 is an acceptable number value.
    const payload = { ...validPool(), utilization: 0 };
    const result = EarnPoolSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// EarnPositionsResponseSchema
// ---------------------------------------------------------------------------

describe("EarnPositionsResponseSchema", () => {
  it("should accept empty positions list", () => {
    const result = EarnPositionsResponseSchema.safeParse({
      positions: [],
      total_deposited_usd: "0"
    });
    expect(result.success).toBe(true);
  });

  it("should reject non-numeric total_deposited_usd", () => {
    const result = EarnPositionsResponseSchema.safeParse({
      positions: [],
      total_deposited_usd: "nope"
    });
    expect(result.success).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// GasFeeConfigResponseSchema
// ---------------------------------------------------------------------------

describe("GasFeeConfigResponseSchema", () => {
  it("should accept a valid gas config", () => {
    const result = GasFeeConfigResponseSchema.safeParse({
      gas_prices: { uusdc: "0.025" },
      gas_multiplier: 1.2
    });
    expect(result.success).toBe(true);
  });

  it("should reject gas_multiplier = 0 (must be positive)", () => {
    const result = GasFeeConfigResponseSchema.safeParse({
      gas_prices: { uusdc: "0.025" },
      gas_multiplier: 0
    });
    expect(result.success).toBe(false);
  });

  it("should reject negative gas_multiplier", () => {
    const result = GasFeeConfigResponseSchema.safeParse({
      gas_prices: { uusdc: "0.025" },
      gas_multiplier: -0.5
    });
    expect(result.success).toBe(false);
  });

  it("should accept gas_multiplier as non-integer (1.5)", () => {
    const result = GasFeeConfigResponseSchema.safeParse({
      gas_prices: { uusdc: "0.025" },
      gas_multiplier: 1.5
    });
    expect(result.success).toBe(true);
  });

  it("should reject empty-string gas price", () => {
    const result = GasFeeConfigResponseSchema.safeParse({
      gas_prices: { uusdc: "" },
      gas_multiplier: 1
    });
    expect(result.success).toBe(false);
  });
});
