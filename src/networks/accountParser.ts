//@ts-nocheck
import { Uint64 } from "@cosmjs/math";
import { assert } from "@cosmjs/utils";
import { BaseAccount, ModuleAccount } from "cosmjs-types/cosmos/auth/v1beta1/auth";
import {
  BaseVestingAccount,
  ContinuousVestingAccount,
  DelayedVestingAccount,
  PeriodicVestingAccount
} from "cosmjs-types/cosmos/vesting/v1beta1/vesting";
import { StridePeriodicVestingAccount } from "./stride/vesting";
import { EthermintAccount } from "./evmos/etherming";
import { decodePubkey } from "./encode";

function uint64FromProto(input) {
  return Uint64.fromString(input.toString());
}

function accountFromBaseAccount(input) {
  const { address, pubKey, accountNumber, sequence } = input;
  const pubkey = pubKey ? (0, decodePubkey)(pubKey) : null;
  return {
    address: address,
    pubkey: pubkey,
    accountNumber: uint64FromProto(accountNumber).toNumber(),
    sequence: uint64FromProto(sequence).toNumber()
  };
}

export function accountFromAny(input) {
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
    case "/stride.vesting.StridePeriodicVestingAccount": {
      const baseAccount = StridePeriodicVestingAccount.decode(value)?.baseVestingAccount?.baseAccount;
      (0, assert)(baseAccount);
      return accountFromBaseAccount(baseAccount);
    }
    case "/ethermint.types.v1.EthAccount": {
      const baseAccount = EthermintAccount.decode(value).baseAccount;
      (0, assert)(baseAccount);
      return accountFromBaseAccount(baseAccount);
    }
    default:
      throw new Error(`Unsupported type: '${typeUrl}'`);
  }
}
