import { LeaseTypes } from "../../enums";

export const tabs = [
  { action: "long", type: LeaseTypes.LONG },
  { action: "short", type: LeaseTypes.SHORT }
];

export interface ILoan {
  LS_contract_id: string;
  LS_amnt: string;
  LS_amnt_stable: string;
  LS_pnl: string;
  LS_timestamp: Date;
  Type: string;
  Block: Number;
  LS_asset_symbol: string;
  LS_loan_pool_id: string;
  LS_Close_Strategy: string;
  LS_Close_Strategy_Ltv: number;
}
