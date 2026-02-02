import type { NolusWallet } from "@nolus/nolusjs";

export type State = {
  wallet?: NolusWallet | any;
  walletName?: string;
  
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
  
  // Wallet connect state
  wallet_connect: {
    toast: boolean;
    url: string;
  };
};
