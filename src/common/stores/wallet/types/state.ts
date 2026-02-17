import type { NolusWallet } from "@nolus/nolusjs";

export type State = {
  wallet?: NolusWallet | any;

  // Vesting tokens
  vest: {
    start: Date;
    end: Date;
    amount: {
      denom: string;
      amount: string;
    };
  }[];

  // Staking APR
  apr: number;
};
