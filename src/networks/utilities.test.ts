import { describe, it, expect } from "vitest";
import { MsgSend } from "cosmjs-types/cosmos/bank/v1beta1/tx";
import { MsgDelegate, MsgUndelegate, MsgBeginRedelegate } from "cosmjs-types/cosmos/staking/v1beta1/tx";
import { MsgWithdrawDelegatorReward } from "cosmjs-types/cosmos/distribution/v1beta1/tx";
import { MsgVote } from "cosmjs-types/cosmos/gov/v1beta1/tx";
import { MsgTransfer as IbcMsgTransfer } from "cosmjs-types/ibc/applications/transfer/v1/tx";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { reorderCoinsDeep, anyToLegacy } from "./utilities";

describe("reorderCoinsDeep", () => {
  it("returns primitives unchanged", () => {
    expect(reorderCoinsDeep("x")).toBe("x");
    expect(reorderCoinsDeep(42)).toBe(42);
    expect(reorderCoinsDeep(null)).toBeNull();
    expect(reorderCoinsDeep(undefined)).toBeUndefined();
  });

  it("reorders {denom, amount} → {amount, denom} for a coin-shaped object", () => {
    const out = reorderCoinsDeep({ denom: "unls", amount: "1000" }) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(["amount", "denom"]);
    expect(out).toEqual({ amount: "1000", denom: "unls" });
  });

  it("leaves non-coin objects untouched (key order preserved)", () => {
    const input = { foo: 1, bar: 2 };
    const out = reorderCoinsDeep(input) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(["foo", "bar"]);
  });

  it("recurses into arrays, reordering nested coins", () => {
    const out = reorderCoinsDeep([
      { denom: "a", amount: "1" },
      { denom: "b", amount: "2" }
    ]);
    expect(out).toEqual([
      { amount: "1", denom: "a" },
      { amount: "2", denom: "b" }
    ]);
  });

  it("recurses into nested objects, reordering coins inside", () => {
    const out = reorderCoinsDeep({
      wrapper: { denom: "u", amount: "7" }
    }) as Record<string, unknown>;
    expect(out).toEqual({ wrapper: { amount: "7", denom: "u" } });
  });

  it("coerces missing amount/denom fields to defaults when reordering", () => {
    const out = reorderCoinsDeep({ denom: "x", amount: undefined }) as Record<string, unknown>;
    expect(out).toEqual({ amount: "0", denom: "x" });
  });

  it("does not treat 3-key objects with denom+amount as coins", () => {
    const out = reorderCoinsDeep({ denom: "u", amount: "1", extra: true }) as Record<string, unknown>;
    expect(Object.keys(out)).toEqual(["denom", "amount", "extra"]);
  });
});

describe("anyToLegacy", () => {
  it("throws for an unregistered typeUrl", () => {
    expect(() => anyToLegacy({ typeUrl: "/some.unknown.Msg", value: new Uint8Array() })).toThrow(
      /Unregistered typeUrl/
    );
  });

  it("converts a MsgSend to amino form with reordered coin amounts", () => {
    const m = MsgSend.fromPartial({
      fromAddress: "nolus1from",
      toAddress: "nolus1to",
      amount: [{ denom: "unls", amount: "1000" }]
    });
    const bytes = MsgSend.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: bytes });
    expect(out.type).toBe("cosmos-sdk/MsgSend");
    const v = out.value as { amount: unknown[]; from_address: string; to_address: string };
    expect(v.from_address).toBe("nolus1from");
    expect(v.to_address).toBe("nolus1to");
    expect(v.amount).toEqual([{ amount: "1000", denom: "unls" }]);
  });

  it("converts MsgDelegate to cosmos-sdk/MsgDelegate", () => {
    const m = MsgDelegate.fromPartial({
      delegatorAddress: "nolus1d",
      validatorAddress: "nolusvaloper1v",
      amount: { denom: "unls", amount: "500" }
    });
    const bytes = MsgDelegate.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/cosmos.staking.v1beta1.MsgDelegate", value: bytes });
    expect(out.type).toBe("cosmos-sdk/MsgDelegate");
    const v = out.value as { delegator_address: string; validator_address: string; amount: unknown };
    expect(v.delegator_address).toBe("nolus1d");
    expect(v.validator_address).toBe("nolusvaloper1v");
    expect(v.amount).toEqual({ amount: "500", denom: "unls" });
  });

  it("converts MsgUndelegate to cosmos-sdk/MsgUndelegate", () => {
    const m = MsgUndelegate.fromPartial({
      delegatorAddress: "nolus1d",
      validatorAddress: "nolusvaloper1v",
      amount: { denom: "unls", amount: "500" }
    });
    const bytes = MsgUndelegate.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/cosmos.staking.v1beta1.MsgUndelegate", value: bytes });
    expect(out.type).toBe("cosmos-sdk/MsgUndelegate");
  });

  it("converts MsgBeginRedelegate including src/dst validator", () => {
    const m = MsgBeginRedelegate.fromPartial({
      delegatorAddress: "nolus1d",
      validatorSrcAddress: "nolusvaloper1src",
      validatorDstAddress: "nolusvaloper1dst",
      amount: { denom: "unls", amount: "500" }
    });
    const bytes = MsgBeginRedelegate.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/cosmos.staking.v1beta1.MsgBeginRedelegate", value: bytes });
    expect(out.type).toBe("cosmos-sdk/MsgBeginRedelegate");
    const v = out.value as { validator_src_address: string; validator_dst_address: string };
    expect(v.validator_src_address).toBe("nolusvaloper1src");
    expect(v.validator_dst_address).toBe("nolusvaloper1dst");
  });

  it("converts MsgWithdrawDelegatorReward to cosmos-sdk/MsgWithdrawDelegationReward", () => {
    const m = MsgWithdrawDelegatorReward.fromPartial({
      delegatorAddress: "nolus1d",
      validatorAddress: "nolusvaloper1v"
    });
    const bytes = MsgWithdrawDelegatorReward.encode(m).finish();
    const out = anyToLegacy({
      typeUrl: "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
      value: bytes
    });
    expect(out.type).toBe("cosmos-sdk/MsgWithdrawDelegationReward");
  });

  it("converts MsgVote and stringifies the proposal id", () => {
    const m = MsgVote.fromPartial({
      proposalId: 7n,
      voter: "nolus1voter",
      option: 1
    });
    const bytes = MsgVote.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/cosmos.gov.v1beta1.MsgVote", value: bytes });
    expect(out.type).toBe("cosmos-sdk/MsgVote");
    const v = out.value as { proposal_id: string; voter: string; option: unknown };
    expect(v.proposal_id).toBe("7");
    expect(v.voter).toBe("nolus1voter");
  });

  it("converts IBC MsgTransfer with timeoutHeight populated (revision_* keys)", () => {
    const m = IbcMsgTransfer.fromPartial({
      sourcePort: "transfer",
      sourceChannel: "channel-0",
      sender: "nolus1s",
      receiver: "osmo1r",
      token: { denom: "unls", amount: "1" },
      timeoutHeight: { revisionNumber: 1n, revisionHeight: 5n },
      timeoutTimestamp: 0n,
      memo: "hi"
    });
    const bytes = IbcMsgTransfer.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/ibc.applications.transfer.v1.MsgTransfer", value: bytes });
    expect(out.type).toBe("cosmos-sdk/MsgTransfer");
    const v = out.value as { timeout_height: Record<string, string>; memo: string };
    expect(v.timeout_height).toEqual({ revision_number: "1", revision_height: "5" });
    expect(v.memo).toBe("hi");
  });

  it("converts IBC MsgTransfer with zero timeoutHeight to an empty object", () => {
    const m = IbcMsgTransfer.fromPartial({
      sourcePort: "transfer",
      sourceChannel: "channel-0",
      sender: "nolus1s",
      receiver: "osmo1r",
      token: { denom: "unls", amount: "1" },
      timeoutHeight: { revisionNumber: 0n, revisionHeight: 0n },
      timeoutTimestamp: 123n
    });
    const bytes = IbcMsgTransfer.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/ibc.applications.transfer.v1.MsgTransfer", value: bytes });
    const v = out.value as { timeout_height: Record<string, string>; timeout_timestamp: string };
    expect(v.timeout_height).toEqual({});
    expect(v.timeout_timestamp).toBe("123");
  });

  it("MsgTransfer default memo is empty string when unset", () => {
    const m = IbcMsgTransfer.fromPartial({
      sourcePort: "transfer",
      sourceChannel: "channel-0",
      sender: "a",
      receiver: "b",
      token: { denom: "u", amount: "1" },
      timeoutTimestamp: 1n
    });
    const bytes = IbcMsgTransfer.encode(m).finish();
    const out = anyToLegacy({ typeUrl: "/ibc.applications.transfer.v1.MsgTransfer", value: bytes });
    const v = out.value as { memo: string };
    expect(v.memo).toBe("");
  });

  it("converts MsgExecuteContract — msg decoded from UTF-8 JSON", () => {
    const innerMsg = { swap: { amount: "10" } };
    const bytes = MsgExecuteContract.encode(
      MsgExecuteContract.fromPartial({
        sender: "nolus1s",
        contract: "nolus1c",
        msg: new TextEncoder().encode(JSON.stringify(innerMsg)),
        funds: [{ denom: "unls", amount: "100" }]
      })
    ).finish();
    const out = anyToLegacy({ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract", value: bytes });
    expect(out.type).toBe("wasm/MsgExecuteContract");
    const v = out.value as { contract: string; sender: string; msg: unknown; funds: unknown[] };
    expect(v.contract).toBe("nolus1c");
    expect(v.sender).toBe("nolus1s");
    expect(v.msg).toEqual(innerMsg);
    expect(v.funds).toEqual([{ amount: "100", denom: "unls" }]);
  });

  it("MsgExecuteContract with malformed msg bytes yields an empty object (silently)", () => {
    const bytes = MsgExecuteContract.encode(
      MsgExecuteContract.fromPartial({
        sender: "s",
        contract: "c",
        msg: new TextEncoder().encode("not-json"),
        funds: []
      })
    ).finish();
    const out = anyToLegacy({ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract", value: bytes });
    const v = out.value as { msg: unknown };
    expect(v.msg).toEqual({});
  });

  it("MsgExecuteContract with empty msg bytes yields an empty object", () => {
    const bytes = MsgExecuteContract.encode(
      MsgExecuteContract.fromPartial({
        sender: "s",
        contract: "c",
        msg: new Uint8Array(),
        funds: []
      })
    ).finish();
    const out = anyToLegacy({ typeUrl: "/cosmwasm.wasm.v1.MsgExecuteContract", value: bytes });
    const v = out.value as { msg: unknown };
    expect(v.msg).toEqual({});
  });
});
