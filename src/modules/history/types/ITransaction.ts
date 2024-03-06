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
