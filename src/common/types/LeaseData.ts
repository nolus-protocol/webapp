import type { Dec } from "@keplr-wallet/unit";
import type { LeaseStatus } from "@nolus/nolusjs/build/contracts";

export interface LeaseData {
  leaseAddress: string;
  leaseStatus: LeaseStatus;
  protocol: string;
  debt: Dec;
  additionalInterest: Dec;
  interestDue: Dec;
  interest: Dec;
  liquidation: Dec;
  pnlAmount: Dec;
  fee: Dec;
  pnlPercent: Dec;
  leaseData: LeaseAttributes | undefined;
  balances: {
    amount: string;
    icon: string;
    decimals: number;
    shortName: string;
  }[];
}

export interface LeaseAttributes {
  pnlAmount: Dec;
  fee: Dec;
  downPayment: Dec;
  downpaymentTicker: string | null;
  price: Dec | null;
  lpnPrice: Dec | null;
  leasePositionStable: Dec;
  leasePositionTicker: string | null;
  timestamp: Date;
  ls_asset_symbol: string;
  repayment_value: Dec;
  history: {
    symbol: string;
    amount: string;
    type: string;
    time: string;
  }[];
}
