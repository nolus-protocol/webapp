import type { Pubkey } from "@cosmjs/amino";
import type { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

import { Network, getNetworkEndpoints } from "@injectivelabs/networks";
import { DEFAULT_BLOCK_TIMEOUT_HEIGHT, BigNumberInBase } from "@injectivelabs/utils";
import { ChainId } from "@injectivelabs/ts-types";
import { makeTimeoutTimestampInNs, MsgTransfer as MasgTransferInj } from "@injectivelabs/sdk-ts";

import { DEFAULT_STD_FEE, TxGrpcClient, createTransaction, ChainRestTendermintApi } from "@injectivelabs/sdk-ts";

const simulateIBCTrasnferInj = async (
  signer: Pubkey,
  sequence: number,
  accountNumber: number,
  message: {
    toAddress: string;
    amount: Coin;
    sender: string;
    sourcePort: string;
    sourceChannel: string;
    memo?: string;
  }
) => {
  const timeoutTimestamp = makeTimeoutTimestampInNs();

  const msg = MasgTransferInj.fromJSON({
    port: message.sourcePort,
    channelId: message.sourceChannel,
    sender: message.sender,
    receiver: message.toAddress,
    amount: message.amount,
    height: undefined,
    timeout: timeoutTimestamp,
    memo: message.memo
  });
  const endpoint = getNetworkEndpoints(Network.Mainnet);
  const txService = new TxGrpcClient(endpoint.grpc);
  const chainRestTendermintApi = new ChainRestTendermintApi(endpoint.rest);
  const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
  const latestHeight = latestBlock.header.height;
  const timeoutHeight = new BigNumberInBase(latestHeight).plus(DEFAULT_BLOCK_TIMEOUT_HEIGHT);

  const { txRaw } = createTransaction({
    memo: "",
    pubKey: signer.value,
    chainId: ChainId.Mainnet,
    fee: DEFAULT_STD_FEE,
    message: msg,
    sequence: sequence,
    timeoutHeight: timeoutHeight.toNumber(),
    accountNumber: accountNumber
  });

  const response = await txService.simulate(txRaw);

  return response;
};

export { simulateIBCTrasnferInj };
