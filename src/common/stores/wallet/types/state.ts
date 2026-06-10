import type { Raw } from "vue";
import type { NolusWallet } from "@nolus/nolusjs";
import type { CoinBalance } from "@/common/types/Currencies";

/**
 * A currency entry for a non-native (cross-chain) network, sourced from the
 * Skip transfer config and hydrated with the user's on-chain balance. Mirrors
 * an `ExternalCurrency` but carries the source denom as `from` (instead of
 * `ibcData`); the asset forms treat the two as an `ExternalCurrency | AssetBalance`
 * union and narrow on whichever denom field is present.
 */
export type AssetBalance = {
  balance?: CoinBalance;
  name: string;
  shortName: string;
  symbol: string;
  ticker: string;
  icon: string;
  decimal_digits: number;
  native: boolean;
  from: string;
};

export type State = {
  // Raw<> keeps Pinia's UnwrapRef from mapping the class type: the mapped copy
  // loses NolusWallet's protected members, making the store instance no longer
  // assignable to the actions' `this: Store`. The runtime proxy preserves every
  // method, so the nominal type stays accurate.
  wallet?: Raw<NolusWallet> | undefined;

  // Vesting tokens
  vest: {
    start: Date;
    end: Date;
    amount: {
      denom: string;
      amount: string;
    };
  }[];

  // Delegated vesting/free from base_vesting_account
  delegated_vesting?: { denom: string; amount: string } | undefined;
  delegated_free?: { denom: string; amount: string } | undefined;

  // Staking APR
  apr: number;
};
