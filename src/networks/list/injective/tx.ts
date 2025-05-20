import type { Pubkey } from "@cosmjs/amino";
import type { Coin } from "cosmjs-types/cosmos/base/v1beta1/coin";

let data: Promise<
  [
    typeof import("@injectivelabs/networks"),
    typeof import("@injectivelabs/utils"),
    typeof import("@injectivelabs/ts-types"),
    typeof import("@injectivelabs/sdk-ts")
  ]
>;

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
  const [networks, utils, types, sdk] = await load();
  const timeoutTimestamp = sdk.makeTimeoutTimestampInNs();

  const msg = sdk.MsgTransfer.fromJSON({
    port: message.sourcePort,
    channelId: message.sourceChannel,
    sender: message.sender,
    receiver: message.toAddress,
    amount: message.amount,
    height: undefined,
    timeout: timeoutTimestamp,
    memo: message.memo
  });
  const endpoint = networks.getNetworkEndpoints(networks.Network.Mainnet);
  const txService = new sdk.TxGrpcApi(endpoint.grpc);
  const chainRestTendermintApi = new sdk.ChainRestTendermintApi(endpoint.rest);
  const latestBlock = await chainRestTendermintApi.fetchLatestBlock();
  const latestHeight = latestBlock.header.height;
  const timeoutHeight = new utils.BigNumberInBase(latestHeight).plus(utils.DEFAULT_BLOCK_TIMEOUT_HEIGHT);

  const { txRaw } = sdk.createTransaction({
    memo: "",
    pubKey: signer.value,
    chainId: types.ChainId.Mainnet,
    fee: sdk.DEFAULT_STD_FEE,
    message: msg,
    sequence: sequence,
    timeoutHeight: timeoutHeight.toNumber(),
    accountNumber: accountNumber
  });

  const response = await txService.simulate(txRaw);

  return response;
};

async function load() {
  if (data) {
    return data;
  }

  data = Promise.all([
    import("@injectivelabs/networks"),
    import("@injectivelabs/utils"),
    import("@injectivelabs/ts-types"),
    import("@injectivelabs/sdk-ts")
  ]);

  return data;
}

export { simulateIBCTrasnferInj };
