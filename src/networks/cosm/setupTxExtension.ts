import type { Pubkey } from "@cosmjs/amino";
import { createProtobufRpcClient, type QueryClient } from "@cosmjs/stargate";
import { SignMode } from "cosmjs-types/cosmos/tx/signing/v1beta1/signing";
import { AuthInfo, Fee, Tx, TxBody } from "cosmjs-types/cosmos/tx/v1beta1/tx";
import { Any } from "cosmjs-types/google/protobuf/any";
import { encodePubkey } from "./encode";

import {
  GetTxRequest,
  GetTxResponse,
  ServiceClientImpl,
  SimulateRequest,
  SimulateResponse
} from "cosmjs-types/cosmos/tx/v1beta1/service";

export interface TxExtension {
  readonly tx: {
    getTx: (txId: string) => Promise<GetTxResponse>;
    simulate: (
      messages: readonly Any[],
      memo: string | undefined,
      signer: Pubkey,
      sequence: number
    ) => Promise<SimulateResponse>;
  };
}

export function setupTxExtension(base: QueryClient): TxExtension {
  const rpc = createProtobufRpcClient(base);
  const queryService = new ServiceClientImpl(rpc);

  return {
    tx: {
      getTx: async (txId: string) => {
        const request: GetTxRequest = {
          hash: txId
        };
        const response = await queryService.GetTx(request);
        return response;
      },
      simulate: async (messages: readonly Any[], memo: string | undefined, signer: Pubkey, sequence: number) => {
        const tx = Tx.fromPartial({
          authInfo: AuthInfo.fromPartial({
            fee: Fee.fromPartial({}),
            signerInfos: [
              {
                publicKey: encodePubkey(signer),
                sequence: BigInt(sequence),
                modeInfo: { single: { mode: SignMode.SIGN_MODE_UNSPECIFIED } }
              }
            ]
          }),
          body: TxBody.fromPartial({
            messages: Array.from(messages),
            memo: memo
          }),
          signatures: [new Uint8Array()]
        });
        const request = SimulateRequest.fromPartial({
          txBytes: Tx.encode(tx).finish()
        });
        const response = await queryService.Simulate(request);
        return response;
      }
    }
  };
}
