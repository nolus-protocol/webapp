import { readString } from "../../t2/matrixHelpers.js";

// Pure parsers over the live `/api/staking/positions` shape. `StakingPosition.balance` and each
// `ValidatorReward.rewards[]` are BalanceInfoSimple OBJECTS ({ denom, amount }) — reading them as
// strings is what dropped every delegation/reward and made the specs skip with "no delegation".

export interface Delegation {
  validatorAddress: string;
  amountMicro: bigint;
}

function listAt(payload: unknown, key: string): unknown[] {
  const list = typeof payload === "object" && payload !== null ? (payload as Record<string, unknown>)[key] : undefined;
  return Array.isArray(list) ? list : [];
}

/** Delegations with their micro amount read from the nested `balance.amount` object field. */
export function parseDelegations(payload: unknown): Delegation[] {
  const out: Delegation[] = [];
  for (const entry of listAt(payload, "delegations")) {
    const validatorAddress = readString(entry, "validator_address");
    const amount = readString(entry, "balance", "amount");
    if (validatorAddress !== undefined && amount !== undefined && /^\d+$/.test(amount)) {
      out.push({ validatorAddress, amountMicro: BigInt(amount) });
    }
  }
  return out;
}

/** Total accrued reward micro, summed over each `ValidatorReward.rewards[]` coin's `amount`. */
export function parseAccruedRewardMicro(payload: unknown): bigint {
  let total = 0n;
  for (const entry of listAt(payload, "rewards")) {
    const coins = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>).rewards : [];
    if (Array.isArray(coins)) {
      for (const coin of coins) {
        const amount = readString(coin, "amount");
        if (amount !== undefined && /^\d+$/.test(amount)) {
          total += BigInt(amount);
        }
      }
    }
  }
  return total;
}

/** Count of in-progress redelegations (a second is locked while any is maturing). */
export function parseMaturingRedelegationCount(payload: unknown): number {
  return listAt(payload, "redelegation").length;
}

/**
 * Operator addresses of jailed validators from `/api/staking/validators`. The app renders the
 * RedelegateButton ONLY on a jailed-validator row (redelegation is the jailed-recovery action), so a
 * redelegate flow is gated on the wallet holding a delegation to one of these.
 */
export function parseJailedValidators(payload: unknown): Set<string> {
  const jailed = new Set<string>();
  const list = Array.isArray(payload) ? payload : listAt(payload, "validators");
  for (const entry of list) {
    const record = typeof entry === "object" && entry !== null ? (entry as Record<string, unknown>) : undefined;
    const operator = readString(record, "operator_address");
    if (operator !== undefined && record?.jailed === true) {
      jailed.add(operator);
    }
  }
  return jailed;
}
