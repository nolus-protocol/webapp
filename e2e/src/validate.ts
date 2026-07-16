import type {
  BalanceInfo,
  BalancesResponse,
  BalanceUpdateFrame,
  InterestInfo,
  LeaseInfo,
  LeasesResponse
} from "./types.js";

function asRecord(value: unknown, path: string): Record<string, unknown> {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    throw new Error(`${path} must be an object`);
  }
  return value as Record<string, unknown>;
}

function asString(value: unknown, path: string): string {
  if (typeof value !== "string") {
    throw new Error(`${path} must be a string`);
  }
  return value;
}

function asNumber(value: unknown, path: string): number {
  if (typeof value !== "number" || !Number.isFinite(value)) {
    throw new Error(`${path} must be a finite number`);
  }
  return value;
}

function asArray(value: unknown, path: string): unknown[] {
  if (!Array.isArray(value)) {
    throw new Error(`${path} must be an array`);
  }
  return value;
}

export function parseBalanceInfo(value: unknown, path: string): BalanceInfo {
  const record = asRecord(value, path);
  return {
    key: asString(record.key, `${path}.key`),
    symbol: asString(record.symbol, `${path}.symbol`),
    denom: asString(record.denom, `${path}.denom`),
    amount: asString(record.amount, `${path}.amount`),
    amount_usd: asString(record.amount_usd, `${path}.amount_usd`),
    decimal_digits: asNumber(record.decimal_digits, `${path}.decimal_digits`)
  };
}

export function parseBalancesResponse(value: unknown): BalancesResponse {
  const record = asRecord(value, "balances response");
  const balances = asArray(record.balances, "balances response.balances").map((entry, index) =>
    parseBalanceInfo(entry, `balances[${index}]`)
  );
  return {
    balances,
    total_value_usd: asString(record.total_value_usd, "balances response.total_value_usd")
  };
}

function parseInterestInfo(value: unknown, path: string): InterestInfo {
  const record = asRecord(value, path);
  return {
    loan_rate: asNumber(record.loan_rate, `${path}.loan_rate`),
    margin_rate: asNumber(record.margin_rate, `${path}.margin_rate`),
    annual_rate_percent: asNumber(record.annual_rate_percent, `${path}.annual_rate_percent`)
  };
}

function parseLeaseInfo(value: unknown, path: string): LeaseInfo {
  const record = asRecord(value, path);
  if (record.interest === undefined || record.interest === null) {
    return {};
  }
  return { interest: parseInterestInfo(record.interest, `${path}.interest`) };
}

export function parseLeasesResponse(value: unknown): LeasesResponse {
  const record = asRecord(value, "leases response");
  const leases = asArray(record.leases, "leases response.leases").map((entry, index) =>
    parseLeaseInfo(entry, `leases[${index}]`)
  );
  return {
    leases,
    total_collateral_usd: asString(record.total_collateral_usd, "leases response.total_collateral_usd"),
    total_debt_usd: asString(record.total_debt_usd, "leases response.total_debt_usd")
  };
}

export function parseBalanceUpdateFrame(value: unknown): BalanceUpdateFrame {
  const record = asRecord(value, "balance_update");
  const timestamp = asString(record.timestamp, "balance_update.timestamp");
  if (Number.isNaN(Date.parse(timestamp))) {
    throw new Error(`balance_update.timestamp is not a parseable timestamp: "${timestamp}"`);
  }
  const balances = asArray(record.balances, "balance_update.balances").map((entry, index) =>
    parseBalanceInfo(entry, `balance_update.balances[${index}]`)
  );
  return {
    chain: asString(record.chain, "balance_update.chain"),
    address: asString(record.address, "balance_update.address"),
    balances,
    total_value_usd: asString(record.total_value_usd, "balance_update.total_value_usd"),
    timestamp
  };
}
