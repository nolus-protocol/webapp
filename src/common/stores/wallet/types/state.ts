import type { NolusWallet } from "@nolus/nolusjs";

export type State = {
  wallet?: NolusWallet;

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
  delegated_vesting?: { denom: string; amount: string };
  delegated_free?: { denom: string; amount: string };

  // Staking APR
  apr: number;
};
