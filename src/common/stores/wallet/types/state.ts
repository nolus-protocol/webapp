import type { NolusWallet } from "@nolus/nolusjs";
import type { Coin as UnitCoin, Dec } from "@keplr-wallet/unit";

export interface AssetBalance {
  balance: UnitCoin | any;
  icon?: string;
  name?: string;
  ticker?: string;
  shortName?: string;
  decimals?: number;
  symbol?: string;
  native?: boolean;
  price?: number;
  from?: string;
}

export type State = {
  torusClient?: Object;
  wallet?: NolusWallet | any;
  privateKey?: string;
  balances: AssetBalance[];
  total_unls: AssetBalance;
  walletName?: string;
  stakingBalance?: UnitCoin | any;
  delegated_vesting?: {
    denom: string;
    amount: string;
  };
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
  currencies: {
    [key: string]: {
      shortName: string;
      ticker: string;
      name: string;
      decimal_digits: string;
      symbol: string;
      ibcData: string;
    };
  };
};
