/**
 * Staking types - matches backend/src/handlers/staking.rs
 */

import type { BalanceInfoSimple } from "./common";

export interface ValidatorInfo {
  operator_address: string;
  moniker: string;
  identity?: string;
  website?: string;
  description?: string;
  commission_rate: string;
  max_commission_rate: string;
  max_change_rate: string;
  tokens: string;
  delegator_shares: string;
  status: ValidatorStatus;
  jailed: boolean;
}

export type ValidatorStatus = "bonded" | "unbonding" | "unbonded";

export interface StakingPositionsResponse {
  delegations: StakingPosition[];
  unbonding: UnbondingPosition[];
  rewards: ValidatorReward[];
  total_staked: string;
  total_rewards: string;
}

export interface StakingPosition {
  validator_address: string;
  validator_moniker?: string;
  shares: string;
  balance: BalanceInfoSimple;
}

export interface UnbondingPosition {
  validator_address: string;
  entries: UnbondingEntry[];
}

export interface UnbondingEntry {
  completion_time: string;
  balance: string;
  creation_height: string;
}

export interface ValidatorReward {
  validator_address: string;
  rewards: BalanceInfoSimple[];
}

export interface StakingParams {
  unbonding_time: string;
  max_validators: number;
  min_self_delegation: string;
}
