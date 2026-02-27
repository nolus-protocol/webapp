import { Uint64 } from "@cosmjs/math";
import { assert } from "@cosmjs/utils";
import { BaseAccount, ModuleAccount } from "cosmjs-types/cosmos/auth/v1beta1/auth";
import { decodePubkey } from "./encode";

import {
  BaseVestingAccount,
  ContinuousVestingAccount,
  DelayedVestingAccount,
  PeriodicVestingAccount
} from "cosmjs-types/cosmos/vesting/v1beta1/vesting";

function uint64FromProto(input: bigint | number | string) {
  return Uint64.fromString(input.toString());
}

function accountFromBaseAccount(input: BaseAccount) {
  const { address, pubKey, accountNumber, sequence } = input;
  const pubkey = pubKey ? (0, decodePubkey)(pubKey) : null;
  return {
    address: address,
    pubkey: pubkey,
    accountNumber: uint64FromProto(accountNumber).toNumber(),
    sequence: uint64FromProto(sequence).toNumber()
  };
}

export function accountFromAny(input: { typeUrl: string; value: Uint8Array }) {
  const { typeUrl, value } = input;
  switch (typeUrl) {
    // auth
    case "/cosmos.auth.v1beta1.BaseAccount":
      return accountFromBaseAccount(BaseAccount.decode(value));
    case "/cosmos.auth.v1beta1.ModuleAccount": {
      const baseAccount = ModuleAccount.decode(value).baseAccount;
      (0, assert)(baseAccount);
      return accountFromBaseAccount(baseAccount);
    }
    // vesting
    case "/cosmos.vesting.v1beta1.BaseVestingAccount": {
      const baseAccount = BaseVestingAccount.decode(value)?.baseAccount;
      (0, assert)(baseAccount);
      return accountFromBaseAccount(baseAccount);
    }
    case "/cosmos.vesting.v1beta1.ContinuousVestingAccount": {
      const baseAccount = ContinuousVestingAccount.decode(value)?.baseVestingAccount?.baseAccount;
      (0, assert)(baseAccount);
      return accountFromBaseAccount(baseAccount);
    }
    case "/cosmos.vesting.v1beta1.DelayedVestingAccount": {
      const baseAccount = DelayedVestingAccount.decode(value)?.baseVestingAccount?.baseAccount;
      (0, assert)(baseAccount);
      return accountFromBaseAccount(baseAccount);
    }
    case "/cosmos.vesting.v1beta1.PeriodicVestingAccount": {
      const baseAccount = PeriodicVestingAccount.decode(value)?.baseVestingAccount?.baseAccount;
      (0, assert)(baseAccount);
      return accountFromBaseAccount(baseAccount);
    }
    default:
      throw new Error(`Unsupported type: '${typeUrl}'`);
  }
}
