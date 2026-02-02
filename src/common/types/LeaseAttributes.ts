import type { Dec } from "@keplr-wallet/unit";

/**
 * Lease attributes from ETL API - used for historical data and PnL calculations
 */
export interface LeaseAttributes {
  pnlAmount: Dec;
  fee: Dec;
  downPayment: Dec;
  downpaymentTicker?: string;
  price?: Dec;
  lpnPrice?: Dec;
  leasePositionStable: Dec;
  leasePositionTicker?: string;
  timestamp: Date;
  ls_asset_symbol?: string;
  repayment_value: Dec;
  history?: {
    symbol: string;
    amount: string;
    type: string;
    time: string;
    ls_amnt_symbol: string;
    ls_amnt: string;
    additional?: string;
  }[];
}
