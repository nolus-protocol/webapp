import type { IObjectKeys } from "@/common/types";
import type { Coin } from "@cosmjs/proto-signing";

export interface ITransaction {
  id: string;
  height: number;
  msgs: IObjectKeys[];
  memo: string;
  blockDate: Date | null;
  fee: Coin[] | null;
  log: string | null;
  type: "sender" | "receiver";
}

export interface ITransactionData {
  block: number;
  fee_amount: string;
  fee_denom: string;
  from: string;
  index: number;
  memo: string;
  timestamp: Date;
  to: string;
  tx_hash: string;
  type: string;
  value: string;
  data: IObjectKeys;
}
