import type { Coin, Dec } from "@keplr-wallet/unit";
import type { NolusWallet } from "@nolus/nolusjs";
import type { LeaserConfig } from "@nolus/nolusjs/build/contracts";

export interface AssetBalance {
  balance: Coin | any;
  icon?: string,
  name?: string,
  ticker?: string,
  shortName?: string,
  decimals?: number,
  symbol?: string,
  native?: boolean,
  price?: number,
  from?: string
}

export type State = {
  torusClient: object | null;
  wallet: NolusWallet | null;
  privateKey: string | null;
  balances: AssetBalance[];
  walletName: string | null;
  stakingBalance: Coin | null;
  delegated_vesting: {
    denom: string,
    amount: string
  } | null,
  delegated_free: {
    denom: string,
    amount: string
  } | null;
  vest: {
    start: Date,
    end: Date,
    amount: {
      denom: string,
      amount: string
    }
  }[];
  suppliedBalance: { [protocol: string]: string };
  lppPrice: { [protocol: string]: Dec };
  leaserConfig: { [protocl: string]: LeaserConfig } | null,
  apr: number;
  currencies: {
    [key: string]: {
      shortName: string,
      ticker: string;
      name: string;
      decimal_digits: string;
      symbol: string;
      ibcData: string;
    };
  };
};
