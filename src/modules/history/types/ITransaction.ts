import type { CONFIRM_STEP, IObjectKeys } from "@/common/types";
import type { Coin } from "@cosmjs/proto-signing";
import type { CoinPretty } from "@keplr-wallet/unit";
import type { MediumStepperProps, SmallStepperProps } from "web-components";

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

export type HistoryData = {
  historyData: {
    id?: string;
    errorMsg?: string;
    msg: string;
    action: string;
    icon: string;
    timestamp: string;
    coin: CoinPretty;
    route?: SmallStepperProps;
    routeDetails?: MediumStepperProps;
    skipRoute?: IObjectKeys;
    status: CONFIRM_STEP;
  };
};
