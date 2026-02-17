/**
 * Governance types - matches backend/src/handlers/governance.rs
 */

export interface ProposalInfo {
  id: string;
  status: string;
  final_tally_result?: TallyResult;
  submit_time?: string;
  deposit_end_time?: string;
  voting_start_time?: string;
  voting_end_time?: string;
  title?: string;
  summary?: string;
  messages: unknown[];
  metadata?: string;
  tally?: TallyResult;
  voted?: boolean;
}

export interface TallyResult {
  yes_count: string;
  abstain_count: string;
  no_count: string;
  no_with_veto_count: string;
}

export interface ProposalsResponse {
  proposals: ProposalInfo[];
  pagination: {
    total: string;
    next_key?: string;
  };
}

export interface TallyingParams {
  quorum: string;
  threshold: string;
  veto_threshold: string;
}

export interface StakingPoolInfo {
  pool: {
    not_bonded_tokens: string;
    bonded_tokens: string;
  };
}

export interface AprInfo {
  annual_inflation: string;
  bonded_tokens: string;
  apr: number;
}

export interface AccountInfo {
  account: unknown;
}

export interface DenomMetadataInfo {
  description: string;
  denom_units: { denom: string; exponent: number; aliases: string[] }[];
  base: string;
  display: string;
  name: string;
  symbol: string;
}

export interface NodeInfoResponse {
  version: string;
  network: string;
}

export interface NetworkStatusResponse {
  network: string;
  latest_block_height: string;
  latest_block_time: string;
  catching_up: boolean;
}
