/**
 * API Types - Re-export all domain types
 *
 * Organized by domain for better maintainability.
 * Import from here for convenience: import type { LeaseInfo, PriceData } from '@/common/api/types'
 */

// Common types used across domains
export * from "./common";

// Domain-specific types
export * from "./config";
export * from "./prices";
export * from "./leases";
export * from "./earn";
export * from "./staking";
export * from "./swap";
export * from "./referral";
export * from "./zero-interest";
export * from "./governance";
export * from "./webapp";
export * from "./etl";
