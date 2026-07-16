export interface BalanceInfo {
  key: string;
  symbol: string;
  denom: string;
  amount: string;
  amount_usd: string;
  decimal_digits: number;
}

export interface BalancesResponse {
  balances: BalanceInfo[];
  total_value_usd: string;
}

export interface InterestInfo {
  loan_rate: number;
  margin_rate: number;
  annual_rate_percent: number;
}

export interface LeaseInfo {
  interest?: InterestInfo;
}

export interface LeasesResponse {
  leases: LeaseInfo[];
  total_collateral_usd: string;
  total_debt_usd: string;
}

export interface BalanceUpdateFrame {
  chain: string;
  address: string;
  balances: BalanceInfo[];
  total_value_usd: string;
  timestamp: string;
}

export type CheckStatus = "pass" | "fail" | "skip";

export interface CheckResult {
  id: string;
  title: string;
  status: CheckStatus;
  durationMs: number;
  observed?: unknown;
  expected?: unknown;
  tolerance?: unknown;
  notes?: string;
  reason?: string;
}

export interface T0Document {
  suite: "t0";
  startedAt: string;
  finishedAt: string;
  baseUrl: string;
  address: string;
  checks: CheckResult[];
  summary: {
    pass: number;
    fail: number;
    skip: number;
  };
}
