import type { AminoConverters } from "@cosmjs/stargate";
import * as _m0 from "protobufjs/minimal";

export const MsgDepositForBurnWithCaller = {
  encode(message: MsgDepositForBurnWithCaller, writer: _m0.Writer = _m0.Writer.create()): _m0.Writer {
    if (message.from !== "") {
      writer.uint32(10).string(message.from);
    }
    if (message.amount !== "") {
      writer.uint32(18).string(message.amount);
    }
    if (message.destinationDomain !== 0) {
      writer.uint32(24).uint32(message.destinationDomain);
    }
    if (message.mintRecipient.length !== 0) {
      writer.uint32(34).bytes(message.mintRecipient);
    }
    if (message.burnToken !== "") {
      writer.uint32(42).string(message.burnToken);
    }
    if (message.destinationCaller.length !== 0) {
      writer.uint32(50).bytes(message.destinationCaller);
    }
    return writer;
  },

  decode(input: _m0.Reader | Uint8Array, length?: number): MsgDepositForBurnWithCaller {
    const reader = input instanceof _m0.Reader ? input : _m0.Reader.create(input);
    let end = length === undefined ? reader.len : reader.pos + length;
    const message = createBaseMsgDepositForBurnWithCaller();
    while (reader.pos < end) {
      const tag = reader.uint32();
      switch (tag >>> 3) {
        case 1:
          if (tag !== 10) {
            break;
          }

          message.from = reader.string();
          continue;
        case 2:
          if (tag !== 18) {
            break;
          }

          message.amount = reader.string();
          continue;
        case 3:
          if (tag !== 24) {
            break;
          }

          message.destinationDomain = reader.uint32();
          continue;
        case 4:
          if (tag !== 34) {
            break;
          }

          message.mintRecipient = reader.bytes();
          continue;
        case 5:
          if (tag !== 42) {
            break;
          }

          message.burnToken = reader.string();
          continue;
        case 6:
          if (tag !== 50) {
            break;
          }

          message.destinationCaller = reader.bytes();
          continue;
      }
      if ((tag & 7) === 4 || tag === 0) {
        break;
      }
      reader.skipType(tag & 7);
    }
    return message;
  },

  fromJSON(object: any): MsgDepositForBurnWithCaller {
    return {
      from: isSet(object.from) ? globalThis.String(object.from) : "",
      amount: isSet(object.amount) ? globalThis.String(object.amount) : "",
      destinationDomain: isSet(object.destinationDomain) ? globalThis.Number(object.destinationDomain) : 0,
      mintRecipient: isSet(object.mintRecipient) ? bytesFromBase64(object.mintRecipient) : new Uint8Array(0),
      burnToken: isSet(object.burnToken) ? globalThis.String(object.burnToken) : "",
      destinationCaller: isSet(object.destinationCaller) ? bytesFromBase64(object.destinationCaller) : new Uint8Array(0)
    };
  },

  toJSON(message: MsgDepositForBurnWithCaller): unknown {
    const obj: any = {};
    if (message.from !== "") {
      obj.from = message.from;
    }
    if (message.amount !== "") {
      obj.amount = message.amount;
    }
    if (message.destinationDomain !== 0) {
      obj.destinationDomain = Math.round(message.destinationDomain);
    }
    if (message.mintRecipient.length !== 0) {
      obj.mintRecipient = base64FromBytes(message.mintRecipient);
    }
    if (message.burnToken !== "") {
      obj.burnToken = message.burnToken;
    }
    if (message.destinationCaller.length !== 0) {
      obj.destinationCaller = base64FromBytes(message.destinationCaller);
    }
    return obj;
  },

  create<I extends Exact<DeepPartial<MsgDepositForBurnWithCaller>, I>>(base?: I): MsgDepositForBurnWithCaller {
    return MsgDepositForBurnWithCaller.fromPartial(base ?? ({} as any));
  },
  fromPartial<I extends Exact<DeepPartial<MsgDepositForBurnWithCaller>, I>>(object: I): MsgDepositForBurnWithCaller {
    const message = createBaseMsgDepositForBurnWithCaller();
    message.from = object.from ?? "";
    message.amount = object.amount ?? "";
    message.destinationDomain = object.destinationDomain ?? 0;
    message.mintRecipient = object.mintRecipient ?? new Uint8Array(0);
    message.burnToken = object.burnToken ?? "";
    message.destinationCaller = object.destinationCaller ?? new Uint8Array(0);
    return message;
  }
};

function createBaseMsgDepositForBurnWithCaller(): MsgDepositForBurnWithCaller {
  return {
    from: "",
    amount: "",
    destinationDomain: 0,
    mintRecipient: new Uint8Array(0),
    burnToken: "",
    destinationCaller: new Uint8Array(0)
  };
}

function bytesFromBase64(b64: string): Uint8Array {
  if (globalThis.Buffer) {
    return Uint8Array.from(globalThis.Buffer.from(b64, "base64"));
  } else {
    const bin = globalThis.atob(b64);
    const arr = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; ++i) {
      arr[i] = bin.charCodeAt(i);
    }
    return arr;
  }
}

function base64FromBytes(arr: Uint8Array): string {
  if (globalThis.Buffer) {
    return globalThis.Buffer.from(arr).toString("base64");
  } else {
    const bin: string[] = [];
    arr.forEach((byte) => {
      bin.push(globalThis.String.fromCharCode(byte));
    });
    return globalThis.btoa(bin.join(""));
  }
}

function isSet(value: any): boolean {
  return value !== null && value !== undefined;
}

export interface MsgDepositForBurnWithCaller {
  from: string;
  amount: string;
  destinationDomain: number;
  mintRecipient: Uint8Array;
  burnToken: string;
  destinationCaller: Uint8Array;
}

export type DeepPartial<T> = T extends Builtin
  ? T
  : T extends Long
    ? string | number | Long
    : T extends globalThis.Array<infer U>
      ? globalThis.Array<DeepPartial<U>>
      : T extends ReadonlyArray<infer U>
        ? ReadonlyArray<DeepPartial<U>>
        : T extends {}
          ? { [K in keyof T]?: DeepPartial<T[K]> }
          : Partial<T>;

export type Exact<P, I extends P> = P extends Builtin
  ? P
  : P & { [K in keyof P]: Exact<P[K], I[K]> } & { [K in Exclude<keyof I, KeysOfUnion<P>>]: never };

export function createDepositForBurnWithCallerConverters(): AminoConverters {
  return {
    "/circle.cctp.v1.MsgDepositForBurnWithCaller": {
      aminoType: "cctp/DepositForBurnWithCaller",
      toAmino: ({
        from,
        amount,
        destinationDomain,
        mintRecipient,
        burnToken,
        destinationCaller
      }: MsgDepositForBurnWithCaller): {
        from: string;
        amount: string;
        destination_domain: number;
        mint_recipient: Uint8Array;
        burn_token: string;
        destination_caller: Uint8Array;
      } => ({
        from: from,
        amount: amount,
        destination_domain: destinationDomain,
        mint_recipient: mintRecipient,
        burn_token: burnToken,
        destination_caller: destinationCaller
      }),
      fromAmino: ({
        from,
        amount,
        destination_domain,
        mint_recipient,
        burn_token,
        destination_caller
      }: {
        from: string;
        amount: string;
        destination_domain: number;
        mint_recipient: Uint8Array;
        burn_token: string;
        destination_caller: Uint8Array;
      }): MsgDepositForBurnWithCaller =>
        MsgDepositForBurnWithCaller.fromPartial({
          from,
          amount,
          destinationDomain: destination_domain,
          mintRecipient: mint_recipient,
          burnToken: burn_token,
          destinationCaller: destination_caller
        })
    }
  };
}

type Builtin = Date | Function | Uint8Array | string | number | boolean | undefined;
type KeysOfUnion<T> = T extends T ? keyof T : never;
