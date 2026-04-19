import { describe, it, expect } from "vitest";
import { toBase64 } from "@cosmjs/encoding";
import { BaseAccount, ModuleAccount } from "cosmjs-types/cosmos/auth/v1beta1/auth";
import {
  BaseVestingAccount,
  ContinuousVestingAccount,
  DelayedVestingAccount,
  PeriodicVestingAccount
} from "cosmjs-types/cosmos/vesting/v1beta1/vesting";
import { Any } from "cosmjs-types/google/protobuf/any";
import { accountFromAny } from "./accountParser";
import { encodePubkey } from "./encode";

const ADDRESS = "nolus1pkptre7fdkl6gfrzlesjjvhxhlc3r4gmjy3kzc";
const SECP_KEY = new Uint8Array(33);
SECP_KEY[0] = 0x03;
for (let i = 1; i < 33; i++) SECP_KEY[i] = i;

function encodedSecpPubkeyAny(): Any {
  return encodePubkey({ type: "tendermint/PubKeySecp256k1", value: toBase64(SECP_KEY) });
}

function makeBaseAccountBytes(seq = 42n, num = 100n, withPubKey = true): Uint8Array {
  return BaseAccount.encode(
    BaseAccount.fromPartial({
      address: ADDRESS,
      pubKey: withPubKey ? encodedSecpPubkeyAny() : undefined,
      accountNumber: num,
      sequence: seq
    })
  ).finish();
}

describe("accountFromAny", () => {
  it("parses a plain BaseAccount", () => {
    const parsed = accountFromAny({
      typeUrl: "/cosmos.auth.v1beta1.BaseAccount",
      value: makeBaseAccountBytes()
    });
    expect(parsed.address).toBe(ADDRESS);
    expect(parsed.accountNumber).toBe(100);
    expect(parsed.sequence).toBe(42);
    expect(parsed.pubkey).not.toBeNull();
  });

  it("parses a BaseAccount without a pubkey (returns null pubkey)", () => {
    const parsed = accountFromAny({
      typeUrl: "/cosmos.auth.v1beta1.BaseAccount",
      value: makeBaseAccountBytes(0n, 1n, false)
    });
    expect(parsed.pubkey).toBeNull();
  });

  it("parses a ModuleAccount (unwraps inner base)", () => {
    const bytes = ModuleAccount.encode(
      ModuleAccount.fromPartial({
        baseAccount: BaseAccount.fromPartial({
          address: ADDRESS,
          accountNumber: 7n,
          sequence: 3n
        }),
        name: "fee_collector"
      })
    ).finish();
    const parsed = accountFromAny({ typeUrl: "/cosmos.auth.v1beta1.ModuleAccount", value: bytes });
    expect(parsed.address).toBe(ADDRESS);
    expect(parsed.accountNumber).toBe(7);
    expect(parsed.sequence).toBe(3);
  });

  it("parses a BaseVestingAccount (unwraps baseAccount)", () => {
    const bytes = BaseVestingAccount.encode(
      BaseVestingAccount.fromPartial({
        baseAccount: BaseAccount.fromPartial({ address: ADDRESS, accountNumber: 1n, sequence: 9n })
      })
    ).finish();
    const parsed = accountFromAny({ typeUrl: "/cosmos.vesting.v1beta1.BaseVestingAccount", value: bytes });
    expect(parsed.address).toBe(ADDRESS);
    expect(parsed.sequence).toBe(9);
  });

  it("parses a ContinuousVestingAccount", () => {
    const bytes = ContinuousVestingAccount.encode(
      ContinuousVestingAccount.fromPartial({
        baseVestingAccount: BaseVestingAccount.fromPartial({
          baseAccount: BaseAccount.fromPartial({ address: ADDRESS, accountNumber: 2n, sequence: 0n })
        })
      })
    ).finish();
    const parsed = accountFromAny({
      typeUrl: "/cosmos.vesting.v1beta1.ContinuousVestingAccount",
      value: bytes
    });
    expect(parsed.address).toBe(ADDRESS);
    expect(parsed.accountNumber).toBe(2);
  });

  it("parses a DelayedVestingAccount", () => {
    const bytes = DelayedVestingAccount.encode(
      DelayedVestingAccount.fromPartial({
        baseVestingAccount: BaseVestingAccount.fromPartial({
          baseAccount: BaseAccount.fromPartial({ address: ADDRESS, accountNumber: 3n, sequence: 0n })
        })
      })
    ).finish();
    const parsed = accountFromAny({ typeUrl: "/cosmos.vesting.v1beta1.DelayedVestingAccount", value: bytes });
    expect(parsed.accountNumber).toBe(3);
  });

  it("parses a PeriodicVestingAccount", () => {
    const bytes = PeriodicVestingAccount.encode(
      PeriodicVestingAccount.fromPartial({
        baseVestingAccount: BaseVestingAccount.fromPartial({
          baseAccount: BaseAccount.fromPartial({ address: ADDRESS, accountNumber: 4n, sequence: 5n })
        })
      })
    ).finish();
    const parsed = accountFromAny({
      typeUrl: "/cosmos.vesting.v1beta1.PeriodicVestingAccount",
      value: bytes
    });
    expect(parsed.sequence).toBe(5);
  });

  it("throws on unsupported typeUrl", () => {
    expect(() =>
      accountFromAny({ typeUrl: "/cosmos.auth.v1beta1.SomeUnknownAccount", value: new Uint8Array() })
    ).toThrow(/Unsupported type/);
  });

  it("throws when a wrapped account is missing its inner baseAccount", () => {
    // ModuleAccount without baseAccount trips the assert() call
    const bytes = ModuleAccount.encode(ModuleAccount.fromPartial({ name: "empty" })).finish();
    expect(() => accountFromAny({ typeUrl: "/cosmos.auth.v1beta1.ModuleAccount", value: bytes })).toThrow();
  });
});
