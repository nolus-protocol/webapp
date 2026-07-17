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

// =============================================================================
// Swap (Skip route) config
// =============================================================================

const SkipRouteTransferCurrencySchema = z
  .object({
    from: z.string(),
    to: z.string(),
    native: z.boolean(),
    visible: z.string().optional()
  })
  .passthrough();

// Per-network swap currencies (`swap_currency_<network>`) are intentionally NOT
// validated here. They are a per-network resource read only when that network is
// the selected one; validating them globally lets an absent network (e.g. Neutron,
// deprecated and deleted from the backend config) reject the entire swap config and
// break every other network's transfer forms. They pass through and are validated
// strictly at point of use (SwapForm) for the selected network only. `swap_to_currency`
// may be empty for the same reason — its presence is checked where the swap is routed.
export const SkipRouteConfigSchema = z
  .object({
    blacklist: z.array(z.string()),
    swap_to_currency: z.string(),
    fee: z.number(),
    transfers: z.record(
      z.string(),
      z
        .object({
          currencies: z.array(SkipRouteTransferCurrencySchema)
        })
        .passthrough()
    )
  })
  .passthrough();

// =============================================================================
// Governance (proposals)
// =============================================================================

const TallyResultSchema = z
  .object({
    yes_count: numericString,
    abstain_count: numericString,
    no_count: numericString,
    no_with_veto_count: numericString
  })
  .passthrough();

const ProposalInfoSchema = z
  .object({
    id: z.string(),
    status: z.string(),
    final_tally_result: TallyResultSchema.nullish(),
    submit_time: z.string().nullish(),
    deposit_end_time: z.string().nullish(),
    voting_start_time: z.string().nullish(),
    voting_end_time: z.string().nullish(),
    title: z.string().nullish(),
    summary: z.string().nullish(),
    messages: z.array(z.unknown()),
    metadata: z.string().nullish(),
    tally: TallyResultSchema.nullish(),
    voted: z.boolean().nullish()
  })
  .passthrough();

export const ProposalsResponseSchema = z
  .object({
    proposals: z.array(ProposalInfoSchema),
    pagination: z
      .object({
        total: numericString,
        next_key: z.string().nullish()
      })
      .passthrough()
  })
  .passthrough();

// =============================================================================
// Staking (positions)
// =============================================================================

// The balance/reward coins are BalanceInfoSimple OBJECTS ({ denom, amount }), not flat
// strings — reading them as strings is what dropped every delegation/reward upstream.
const BalanceInfoSimpleSchema = z
  .object({
    denom: z.string(),
    amount: numericString
  })
  .passthrough();

const StakingPositionSchema = z
  .object({
    validator_address: z.string(),
    validator_moniker: z.string().nullish(),
    shares: numericString,
    balance: BalanceInfoSimpleSchema
  })
  .passthrough();

const UnbondingEntrySchema = z
  .object({
    completion_time: z.string(),
    balance: numericString,
    creation_height: numericString
  })
  .passthrough();

const UnbondingPositionSchema = z
  .object({
    validator_address: z.string(),
    entries: z.array(UnbondingEntrySchema)
  })
  .passthrough();

const ValidatorRewardSchema = z
  .object({
    validator_address: z.string(),
    rewards: z.array(BalanceInfoSimpleSchema)
  })
  .passthrough();

export const StakingPositionsResponseSchema = z
  .object({
    delegations: z.array(StakingPositionSchema),
    unbonding: z.array(UnbondingPositionSchema),
    rewards: z.array(ValidatorRewardSchema),
    total_staked: numericString,
    total_rewards: numericString
  })
  .passthrough();
