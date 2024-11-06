import type { NolusWallet } from "@nolus/nolusjs";
import type { Coin as UnitCoin, Dec } from "@keplr-wallet/unit";
import type { IObjectKeys } from "@/common/types";

export interface AssetBalance {
  balance: UnitCoin | any;
  icon?: string;
  name?: string;
  ticker?: string;
  shortName?: string;
  decimal_digits?: number;
  symbol?: string;
  native?: boolean;
  price?: number;
  from?: string;
}

export type State = {
  wallet?: NolusWallet | any;
  balances: AssetBalance[];
  total_unls: AssetBalance;
  walletName?: string;
  stakingBalance?: UnitCoin | any;
  delegated_vesting?: {
    denom: string;
    amount: string;
  };
  ignoreCurrencies: string[];
  delegated_free?: {
    denom: string;
    amount: string;
  };
  vest: {
    start: Date;
    end: Date;
    amount: {
      denom: string;
      amount: string;
    };
  }[];
  suppliedBalance: {
    [protocol: string]: string;
  };
  lppPrice: {
    [protocol: string]: Dec;
  };
  apr: number;
  history: {
    [key: string]: IObjectKeys;
  };
};
