export type { ITransaction, ITransactionData } from "./ITransaction";

export enum HYSTORY_ACTIONS {
  SEND = "SEND",
  RECEIVE = "RECEIVE",
  SWAP = "SWAP"
}

export enum Messages {
  "/cosmos.bank.v1beta1.MsgSend" = "/cosmos.bank.v1beta1.MsgSend",
  "/ibc.applications.transfer.v1.MsgTransfer" = "/ibc.applications.transfer.v1.MsgTransfer",
  "/cosmwasm.wasm.v1.MsgExecuteContract" = "/cosmwasm.wasm.v1.MsgExecuteContract",
  "/cosmos.gov.v1beta1.MsgVote" = "/cosmos.gov.v1beta1.MsgVote",
  "/cosmos.staking.v1beta1.MsgDelegate" = "/cosmos.staking.v1beta1.MsgDelegate",
  "/cosmos.staking.v1beta1.MsgUndelegate" = "/cosmos.staking.v1beta1.MsgUndelegate",
  "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward" = "/cosmos.distribution.v1beta1.MsgWithdrawDelegatorReward",
  "/ibc.core.client.v1.MsgUpdateClient" = "/ibc.core.client.v1.MsgUpdateClient",
  "/ibc.core.channel.v1.MsgAcknowledgement" = "/ibc.core.channel.v1.MsgAcknowledgement",
  "/ibc.core.channel.v1.MsgRecvPacket" = "/ibc.core.channel.v1.MsgRecvPacket",
  "/cosmos.staking.v1beta1.MsgBeginRedelegate" = "/cosmos.staking.v1beta1.MsgBeginRedelegate"
}
