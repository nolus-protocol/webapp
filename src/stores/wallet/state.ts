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
};
