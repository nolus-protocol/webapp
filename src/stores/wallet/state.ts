import type { Coin } from '@keplr-wallet/unit';
import type { NolusWallet } from '@nolus/nolusjs';

export interface AssetBalance {
  balance: Coin | any;
}

export type State = {
  torusClient: object | null;
  wallet: NolusWallet | null;
  privateKey: string | null;
  balances: AssetBalance[];
  walletName: string | null;
  currencies:  {
    [key: string]: {
      ticker: string,
      name: string,
      decimal_digits: string,
      symbol: string,
      groups: string[],
      swap_routes: Array<Array<{
        pool_id: string,
        pool_token: string
      }>>
    }
  }
};
