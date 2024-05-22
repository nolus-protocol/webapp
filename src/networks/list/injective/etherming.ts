//@ts-nocheck

import { BaseAccount } from "cosmjs-types-legacy/cosmos/auth/v1beta1/auth";
import * as _m0 from "protobufjs/minimal";

export interface EthermintBaseAccount {
  baseAccount: BaseAccount;
}

export const EthermintAccount = {
  decode(input: _m0.Reader | Uint8Array, length?: number): BaseVestingAccount {
    const reader = input instanceof _m0.Reader ? input : new _m0.Reader(input);
    const end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseEthAccount();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }
          message.baseAccount = BaseAccount.decode(reader, reader.uint32());
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }
          message.codeHash = reader.bytes();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }

    return message;
  }
};

function createBaseEthAccount() {
  return { baseAccount: undefined, codeHash: new Uint8Array(0) };
}
