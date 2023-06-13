import type { Coin, Dec } from "@keplr-wallet/unit";
import type { NolusWallet } from "@nolus/nolusjs";
import type { LeaserConfig } from "@nolus/nolusjs/build/contracts";

export interface AssetBalance {
  balance: Coin | any;
  icon?: string,
  name?: string,
  ticker?: string,
  ibc_route?: string[],
  decimals?: number,
  symbol?: string,
  native?: boolean
}

export type State = {
  torusClient: object | null;
  wallet: NolusWallet | null;
  privateKey: string | null;
  balances: AssetBalance[];
  walletName: string | null;
  stakingBalance: Coin | null;
  suppliedBalance: string;
  lppPrice: Dec;
  leaserConfig: LeaserConfig | null,
  apr: number;
  currencies: {
    [key: string]: {
      shortName: string,
      ticker: string;
      name: string;
      decimal_digits: string;
      symbol: string;
    };
  };
};
