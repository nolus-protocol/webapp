/**
 * Zod Schemas for API Response Validation
 *
 * These schemas validate API responses at runtime to catch:
 * - Missing required fields
 * - Incorrect data types
 * - Unexpected response shapes
 *
 * Usage:
 * ```ts
 * import { PricesResponseSchema } from './schemas';
 *
 * const response = await fetch('/api/prices');
 * const data = PricesResponseSchema.parse(await response.json());
 * ```
 */

import { z } from "zod";

// =============================================================================
// Common Schemas
// =============================================================================

/**
 * Schema for numeric strings (amounts, prices)
 */
export const NumericStringSchema = z.string().regex(/^-?\d*\.?\d+$/, "Invalid numeric string");

/**
 * Schema for ISO date strings
 */
export const DateStringSchema = z.string().datetime().or(z.string());

/**
 * Schema for blockchain addresses
 */
export const AddressSchema = z.string().min(1);

/**
 * Schema for transaction hashes
 */
export const TxHashSchema = z.string().regex(/^[A-Fa-f0-9]{64}$/, "Invalid transaction hash");

// =============================================================================
// Price Schemas
// =============================================================================

export const PriceInfoSchema = z.object({
  key: z.string(),
  symbol: z.string(),
  price_usd: z.string(),
});

export const PricesResponseSchema = z.object({
  prices: z.record(z.string(), PriceInfoSchema),
  updated_at: z.string(),
});

export const PriceDataSchema = z.record(
  z.string(),
  z.object({
    price: z.string(),
    symbol: z.string(),
  })
);

// =============================================================================
// Balance Schemas
// =============================================================================

export const BalanceInfoSchema = z.object({
  key: z.string(),
  symbol: z.string(),
  denom: z.string(),
  amount: z.string(),
  amount_usd: z.string(),
  decimal_digits: z.number(),
});

export const BalancesResponseSchema = z.object({
  balances: z.array(BalanceInfoSchema),
  total_value_usd: z.string(),
});

// =============================================================================
// Config Schemas
// =============================================================================

export const ProtocolContractsSchema = z.object({
  leaser: z.string(),
  lpp: z.string(),
  oracle: z.string(),
  profit: z.string().optional(),
  reserve: z.string().optional(),
});

export const ProtocolInfoSchema = z.object({
  dex: z.string(),
  dex_network: z.string(),
  interest: z.number(),
  lease_interest_rate_margin: z.number(),
  lease_interest_payment_rate: z.number(),
  utilization_optimal: z.number(),
  addon_optimal_interest_rate: z.number(),
  min_utilization: z.number(),
  contracts: ProtocolContractsSchema,
});

export const CurrencyInfoSchema = z.object({
  key: z.string(),
  name: z.string(),
  symbol: z.string(),
  ticker: z.string(),
  native: z.boolean(),
  ibc_data: z.string(),
  decimal_digits: z.number(),
  short_name: z.string().optional(),
  icon: z.string().optional(),
  coingecko_id: z.string().optional(),
});

export const NetworkConfigSchema = z.object({
  chain_id: z.string(),
  chain_name: z.string(),
  native_denom: z.string(),
  native_minimal_denom: z.string(),
  rpc_endpoint: z.string(),
  rest_endpoint: z.string(),
  explorer_url: z.string().optional(),
});

export const ConfigResponseSchema = z.object({
  protocols: z.record(z.string(), ProtocolInfoSchema),
  currencies: z.record(z.string(), CurrencyInfoSchema),
  network: NetworkConfigSchema,
  updated_at: z.string().optional(),
});

// =============================================================================
// Lease Schemas
// =============================================================================

export const LeaseQuoteSchema = z.object({
  downpayment: z.string(),
  borrow: z.string(),
  total: z.string(),
  annual_interest_rate: z.string(),
  annual_interest_rate_margin: z.string(),
});

export const LeaseOpenedSchema = z.object({
  amount: z.object({
    amount: z.string(),
    ticker: z.string(),
  }),
  loan: z.object({
    amount: z.string(),
    ticker: z.string(),
  }),
  downpayment: z.object({
    amount: z.string(),
    ticker: z.string(),
  }),
});

export const LeaseStatusSchema = z.union([
  z.literal("Opening"),
  z.literal("Opened"),
  z.literal("PaidOff"),
  z.literal("Closed"),
  z.literal("Liquidated"),
]);

export const LeaseInfoSchema = z.object({
  lease_address: z.string(),
  customer: z.string(),
  protocol: z.string(),
  status: LeaseStatusSchema,
  position_ticker: z.string().optional(),
  position_amount: z.string().optional(),
  principal_due: z.string().optional(),
  margin_interest_due: z.string().optional(),
  loan_interest_due: z.string().optional(),
  overdue: z.string().optional(),
  current_liability: z.string().optional(),
  due_date: z.string().nullable().optional(),
  interest_rate: z.string().optional(),
  interest_rate_margin: z.string().optional(),
  // Additional ETL fields
  down_payment: z.string().optional(),
  loan_asset: z.string().optional(),
  position_asset: z.string().optional(),
  liquidation: z.any().optional(),
  in_progress: z.any().optional(),
  etl_data: z.any().optional(),
});

export const LeasesResponseSchema = z.object({
  leases: z.array(LeaseInfoSchema),
  total_count: z.number().optional(),
});

// =============================================================================
// Staking Schemas
// =============================================================================

export const ValidatorInfoSchema = z.object({
  address: z.string(),
  moniker: z.string(),
  identity: z.string().optional(),
  website: z.string().optional(),
  details: z.string().optional(),
  commission_rate: z.string(),
  voting_power: z.string(),
  jailed: z.boolean(),
  status: z.string(),
});

export const ValidatorsResponseSchema = z.object({
  validators: z.array(ValidatorInfoSchema),
  pagination: z
    .object({
      next_key: z.string().nullable(),
      total: z.string(),
    })
    .optional(),
});

export const DelegationInfoSchema = z.object({
  validator_address: z.string(),
  delegator_address: z.string(),
  shares: z.string(),
  balance: z.object({
    denom: z.string(),
    amount: z.string(),
  }),
});

export const StakingPositionsResponseSchema = z.object({
  delegations: z.array(DelegationInfoSchema),
  total_staked: z.string(),
  total_rewards: z.string(),
});

// =============================================================================
// Earn Schemas
// =============================================================================

export const PoolInfoSchema = z.object({
  protocol: z.string(),
  lpp_address: z.string(),
  lpn_ticker: z.string(),
  lpn_symbol: z.string(),
  total_deposits: z.string(),
  total_borrowed: z.string(),
  utilization: z.number(),
  apr: z.number(),
  deposit_cap: z.string().optional(),
});

export const EarnPoolsResponseSchema = z.object({
  pools: z.array(PoolInfoSchema),
});

export const EarnPositionSchema = z.object({
  protocol: z.string(),
  deposit_amount: z.string(),
  deposit_value_usd: z.string(),
  rewards_amount: z.string(),
  rewards_value_usd: z.string(),
});

export const EarnPositionsResponseSchema = z.object({
  positions: z.array(EarnPositionSchema),
  total_value_usd: z.string(),
});

// =============================================================================
// Governance Schemas
// =============================================================================

export const ProposalSchema = z.object({
  id: z.string(),
  status: z.string(),
  title: z.string(),
  summary: z.string().optional(),
  submit_time: z.string(),
  deposit_end_time: z.string(),
  voting_start_time: z.string(),
  voting_end_time: z.string(),
  messages: z.array(z.any()).optional(),
  metadata: z.string().optional(),
  final_tally_result: z.any().optional(),
  tally: z.any().optional(),
  voted: z.boolean().optional(),
});

export const ProposalsResponseSchema = z.object({
  proposals: z.array(ProposalSchema),
  pagination: z.object({
    next_key: z.string().nullable(),
    total: z.string(),
  }),
});

// =============================================================================
// Health Check Schema
// =============================================================================

export const HealthCheckResponseSchema = z.object({
  status: z.enum(["healthy", "degraded", "unhealthy"]),
  timestamp: z.string(),
  version: z.string().optional(),
  services: z
    .record(
      z.string(),
      z.object({
        status: z.enum(["healthy", "degraded", "unhealthy"]),
        latency_ms: z.number().optional(),
        message: z.string().optional(),
      })
    )
    .optional(),
});

// =============================================================================
// Type Exports (inferred from schemas)
// =============================================================================

export type PriceInfoValidated = z.infer<typeof PriceInfoSchema>;
export type PricesResponseValidated = z.infer<typeof PricesResponseSchema>;
export type BalanceInfoValidated = z.infer<typeof BalanceInfoSchema>;
export type BalancesResponseValidated = z.infer<typeof BalancesResponseSchema>;
export type ConfigResponseValidated = z.infer<typeof ConfigResponseSchema>;
export type LeaseInfoValidated = z.infer<typeof LeaseInfoSchema>;
export type LeasesResponseValidated = z.infer<typeof LeasesResponseSchema>;
export type ValidatorInfoValidated = z.infer<typeof ValidatorInfoSchema>;
export type HealthCheckResponseValidated = z.infer<typeof HealthCheckResponseSchema>;

// =============================================================================
// Validation Helpers
// =============================================================================

/**
 * Validates API response and returns typed data
 * Throws ZodError if validation fails
 */
export function validateResponse<T>(schema: z.ZodSchema<T>, data: unknown): T {
  return schema.parse(data);
}

/**
 * Safely validates API response, returns null on failure
 */
export function safeValidateResponse<T>(
  schema: z.ZodSchema<T>,
  data: unknown
): { success: true; data: T } | { success: false; error: z.ZodError } {
  const result = schema.safeParse(data);
  if (result.success) {
    return { success: true, data: result.data };
  }
  return { success: false, error: result.error };
}

/**
 * Logs validation errors for debugging
 */
export function logValidationError(
  endpoint: string,
  error: z.ZodError,
  data?: unknown
): void {
  console.warn(`[API Validation] ${endpoint} response validation failed:`, {
    issues: error.issues.map((i) => ({
      path: i.path.join("."),
      message: i.message,
      code: i.code,
    })),
    receivedData: data,
  });
}
