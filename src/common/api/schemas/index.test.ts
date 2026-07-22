import { describe, it, expect } from "vitest";
import { ZodError } from "zod";
import {
  PricesResponseSchema,
  BalancesResponseSchema,
  LeaseInfoSchema,
  LeasesResponseSchema,
  EarnPoolSchema,
  EarnPositionsResponseSchema,
  GasFeeConfigResponseSchema,
  SkipRouteConfigSchema,
  ProposalsResponseSchema,
  StakingPositionsResponseSchema
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

  // v10 lease states (issue #288): the status enum must admit `open_failed`.
  it("should accept the open_failed status (v10)", () => {
    const payload = { ...validLease(), status: "open_failed" as unknown as "opened" };
    const result = LeaseInfoSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should accept an open_failed lease carrying a reason string", () => {
    const payload = { ...validLease(), status: "open_failed" as unknown as "opened", reason: "timeout" };
    const result = LeaseInfoSchema.safeParse(payload);
    expect(result.success).toBe(true);
  });

  it("should still reject an unknown status even after open_failed is added", () => {
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

// ===========================================================================
// SkipRouteConfigSchema
// ===========================================================================

describe("SkipRouteConfigSchema", () => {
  const validConfig = () => ({
    blacklist: ["BADTKN"],
    swap_currency_osmosis: "USDC",
    swap_currency_neutron: "USDC_NOBLE",
    swap_to_currency: "USDC",
    fee: 0.001,
    transfers: {
      OSMOSIS: {
        currencies: [{ from: "uatom", to: "uosmo", native: true, visible: "ATOM" }]
      }
    }
  });

  it("should accept a valid swap config", () => {
    const result = SkipRouteConfigSchema.safeParse(validConfig());
    expect(result.success).toBe(true);
  });

  it("should tolerate extra backend fields (passthrough)", () => {
    const result = SkipRouteConfigSchema.safeParse({ ...validConfig(), new_field: 123 });
    expect(result.success).toBe(true);
  });

  it("should accept a transfer currency without the optional visible field", () => {
    const result = SkipRouteConfigSchema.safeParse({
      ...validConfig(),
      transfers: { OSMOSIS: { currencies: [{ from: "uatom", to: "uosmo", native: false }] } }
    });
    expect(result.success).toBe(true);
  });

  it("should reject when fee is a numeric string instead of a number", () => {
    const result = SkipRouteConfigSchema.safeParse({ ...validConfig(), fee: "0.001" });
    expect(result.success).toBe(false);
  });

  it("should reject when blacklist is missing", () => {
    const { blacklist: _blacklist, ...rest } = validConfig();
    const result = SkipRouteConfigSchema.safeParse(rest);
    expect(result.success).toBe(false);
  });

  it("should reject a malformed transfer currency (native not boolean)", () => {
    const result = SkipRouteConfigSchema.safeParse({
      ...validConfig(),
      transfers: { OSMOSIS: { currencies: [{ from: "a", to: "b", native: "yes" }] } }
    });
    expect(result.success).toBe(false);
  });

  it("should accept a config missing a deprecated network's swap currency", () => {
    // Regression: Neutron was deprecated and swap_currency_neutron deleted from the
    // backend config. Per-network swap currencies are validated at point of use, not
    // globally — a single absent network must not reject the whole config and break
    // every other network's transfer forms.
    const { swap_currency_neutron: _neutron, ...rest } = validConfig();
    const result = SkipRouteConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("should accept a config with no per-network swap currencies at all", () => {
    const { swap_currency_osmosis: _osmosis, swap_currency_neutron: _neutron, ...rest } = validConfig();
    const result = SkipRouteConfigSchema.safeParse(rest);
    expect(result.success).toBe(true);
  });

  it("should preserve per-network swap currency keys through passthrough", () => {
    const result = SkipRouteConfigSchema.safeParse(validConfig());
    expect(result.success).toBe(true);
    if (result.success) {
      expect((result.data as Record<string, unknown>).swap_currency_osmosis).toBe("USDC");
    }
  });
});

// ===========================================================================
// ProposalsResponseSchema
// ===========================================================================

describe("ProposalsResponseSchema", () => {
  const proposal = (overrides: Record<string, unknown> = {}) => ({
    id: "337",
    status: "PROPOSAL_STATUS_PASSED",
    final_tally_result: {
      yes_count: "173872067484325",
      abstain_count: "0",
      no_count: "0",
      no_with_veto_count: "0"
    },
    title: "Close Inactive Market",
    summary: "…",
    messages: [{ "@type": "/cosmwasm.wasm.v1.MsgSudoContract" }],
    metadata: "Close Inactive Market",
    ...overrides
  });

  it("should accept a valid proposals response", () => {
    const result = ProposalsResponseSchema.safeParse({
      proposals: [proposal()],
      pagination: { total: "99", next_key: null }
    });
    expect(result.success).toBe(true);
  });

  it("should accept a proposal missing the optional tally/time fields (deposit-period)", () => {
    const result = ProposalsResponseSchema.safeParse({
      proposals: [{ id: "340", status: "PROPOSAL_STATUS_DEPOSIT_PERIOD", messages: [] }],
      pagination: { total: "1" }
    });
    expect(result.success).toBe(true);
  });

  it("should reject a non-numeric tally count", () => {
    const result = ProposalsResponseSchema.safeParse({
      proposals: [
        proposal({
          final_tally_result: { yes_count: "many", abstain_count: "0", no_count: "0", no_with_veto_count: "0" }
        })
      ],
      pagination: { total: "1" }
    });
    expect(result.success).toBe(false);
  });

  it("should reject a proposal missing the required messages field", () => {
    const { messages: _messages, ...noMessages } = proposal();
    const result = ProposalsResponseSchema.safeParse({ proposals: [noMessages], pagination: { total: "1" } });
    expect(result.success).toBe(false);
  });
});

// ===========================================================================
// StakingPositionsResponseSchema
// ===========================================================================

describe("StakingPositionsResponseSchema", () => {
  const delegation = (balance: unknown) => ({
    validator_address: "nolusvaloper1one",
    validator_moniker: "One",
    shares: "1000000000",
    balance
  });
  const wrap = (deleg: unknown) => ({
    delegations: [deleg],
    unbonding: [],
    rewards: [{ validator_address: "nolusvaloper1one", rewards: [{ denom: "unls", amount: "12500000" }] }],
    total_staked: "1000.00",
    total_rewards: "12.50"
  });

  it("should accept a valid positions response", () => {
    const result = StakingPositionsResponseSchema.safeParse(wrap(delegation({ denom: "unls", amount: "1000000000" })));
    expect(result.success).toBe(true);
  });

  it("should accept an all-empty response", () => {
    const result = StakingPositionsResponseSchema.safeParse({
      delegations: [],
      unbonding: [],
      rewards: [],
      total_staked: "0",
      total_rewards: "0"
    });
    expect(result.success).toBe(true);
  });

  it("should reject a delegation whose balance is a flat string, not the { denom, amount } object", () => {
    const result = StakingPositionsResponseSchema.safeParse(wrap(delegation("1000000000")));
    expect(result.success).toBe(false);
  });

  it("should reject a non-numeric balance amount", () => {
    const result = StakingPositionsResponseSchema.safeParse(wrap(delegation({ denom: "unls", amount: "lots" })));
    expect(result.success).toBe(false);
  });
});
