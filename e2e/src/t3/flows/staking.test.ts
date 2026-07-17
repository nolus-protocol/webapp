import { describe, expect, it } from "vitest";
import { parseAccruedRewardMicro, parseDelegations, parseMaturingRedelegationCount } from "./staking.js";

// Real /api/staking/positions shape: StakingPosition.balance and ValidatorReward.rewards[] are
// BalanceInfoSimple OBJECTS { denom, amount }, not strings.
const POSITIONS = {
  delegations: [
    { validator_address: "nolusvaloper1a", shares: "500000000", balance: { denom: "unls", amount: "500000000" } },
    { validator_address: "nolusvaloper1b", shares: "0", balance: { denom: "unls", amount: "0" } }
  ],
  unbonding: [],
  rewards: [
    {
      validator_address: "nolusvaloper1a",
      rewards: [
        { denom: "unls", amount: "12345" },
        { denom: "ibc/x", amount: "6" }
      ]
    }
  ],
  redelegation: [{ validator_src_address: "nolusvaloper1a", validator_dst_address: "nolusvaloper1b" }],
  total_staked: "500000000",
  total_rewards: "12345"
};

describe("parseDelegations", () => {
  it("reads the micro amount from the nested balance object (not the object itself)", () => {
    expect(parseDelegations(POSITIONS)).toEqual([
      { validatorAddress: "nolusvaloper1a", amountMicro: 500000000n },
      { validatorAddress: "nolusvaloper1b", amountMicro: 0n }
    ]);
  });

  it("returns empty for a missing delegations array", () => {
    expect(parseDelegations({})).toEqual([]);
  });
});

describe("parseAccruedRewardMicro", () => {
  it("sums the nested reward coins' amounts across validators", () => {
    expect(parseAccruedRewardMicro(POSITIONS)).toBe(12351n);
  });

  it("returns 0 when there are no rewards", () => {
    expect(parseAccruedRewardMicro({ rewards: [] })).toBe(0n);
  });
});

describe("parseMaturingRedelegationCount", () => {
  it("counts in-progress redelegations", () => {
    expect(parseMaturingRedelegationCount(POSITIONS)).toBe(1);
    expect(parseMaturingRedelegationCount({})).toBe(0);
  });
});
