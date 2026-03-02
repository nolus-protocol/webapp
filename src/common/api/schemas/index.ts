/**
 * Zod runtime validation schemas for critical financial API responses.
 *
 * These schemas validate that numeric string fields from the backend are
 * actually parseable as numbers — the exact class of bugs that caused
 * silent fallbacks to wrong values (0, 1, 3.5) in money paths.
 *
 * All schemas use .passthrough() to tolerate extra fields from backend updates.
 */

import { z } from "zod";

/** A string that must be parseable as a finite number */
const numericString = z.string().refine((s) => s !== "" && isFinite(Number(s)), {
  error: "Expected a numeric string"
});

// =============================================================================
// Prices
// =============================================================================

const PriceInfoSchema = z
  .object({
    key: z.string(),
    symbol: z.string(),
    price_usd: numericString
  })
  .passthrough();

export const PricesResponseSchema = z
  .object({
    prices: z.record(z.string(), PriceInfoSchema),
    updated_at: z.string()
  })
  .passthrough();

// =============================================================================
// Gas Fee Config
// =============================================================================

export const GasFeeConfigResponseSchema = z
  .object({
    gas_prices: z.record(z.string(), numericString),
    gas_multiplier: z.number().positive()
  })
  .passthrough();

// =============================================================================
// Leases
// =============================================================================

const LeaseAssetInfoSchema = z
  .object({
    ticker: z.string(),
    amount: numericString,
    amount_usd: numericString.nullish()
  })
  .passthrough();

const LeaseDebtInfoSchema = z
  .object({
    ticker: z.string(),
    principal: numericString,
    overdue_margin: numericString,
    overdue_interest: numericString,
    due_margin: numericString,
    due_interest: numericString,
    total: numericString,
    total_usd: numericString.nullish()
  })
  .passthrough();

const LeaseInterestInfoSchema = z
  .object({
    loan_rate: z.number(),
    margin_rate: z.number(),
    annual_rate_percent: z.number()
  })
  .passthrough();

const LeasePnlInfoSchema = z
  .object({
    amount: numericString,
    percent: numericString,
    downpayment: numericString,
    pnl_positive: z.boolean()
  })
  .passthrough();

export const LeaseInfoSchema = z
  .object({
    address: z.string(),
    protocol: z.string(),
    status: z.enum(["opening", "opened", "paid_off", "closing", "closed", "liquidated"]),
    amount: LeaseAssetInfoSchema,
    debt: LeaseDebtInfoSchema,
    interest: LeaseInterestInfoSchema,
    pnl: LeasePnlInfoSchema.nullish(),
    liquidation_price: numericString.nullish()
  })
  .passthrough();

export const LeasesResponseSchema = z
  .object({
    leases: z.array(LeaseInfoSchema),
    total_collateral_usd: numericString,
    total_debt_usd: numericString
  })
  .passthrough();

// =============================================================================
// Earn
// =============================================================================

export const EarnPoolSchema = z
  .object({
    protocol: z.string(),
    lpp_address: z.string(),
    currency: z.string(),
    total_deposited: numericString,
    total_deposited_usd: numericString.nullish(),
    apy: z.number(),
    utilization: z.number(),
    available_liquidity: numericString,
    deposit_capacity: numericString.nullish()
  })
  .passthrough();

const EarnPositionSchema = z
  .object({
    protocol: z.string(),
    lpp_address: z.string(),
    currency: z.string(),
    deposited_nlpn: numericString,
    deposited_lpn: numericString,
    deposited_usd: numericString.nullish(),
    lpp_price: numericString,
    current_apy: z.number()
  })
  .passthrough();

export const EarnPositionsResponseSchema = z
  .object({
    positions: z.array(EarnPositionSchema),
    total_deposited_usd: numericString
  })
  .passthrough();

// =============================================================================
// Balances
// =============================================================================

const BalanceInfoSchema = z
  .object({
    key: z.string(),
    symbol: z.string(),
    denom: z.string(),
    amount: numericString,
    amount_usd: numericString,
    decimal_digits: z.number().int().nonnegative()
  })
  .passthrough();

export const BalancesResponseSchema = z
  .object({
    balances: z.array(BalanceInfoSchema),
    total_value_usd: numericString
  })
  .passthrough();
