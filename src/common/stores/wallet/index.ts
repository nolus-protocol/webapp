import { type State } from "./types";
import { defineStore } from "pinia";
import { getters } from "./getters";
import { WalletActions } from "./types";
import { actions } from "./actions";

const state = (): State => ({
  // Vesting tokens
  vest: [],
  
  // Staking APR
  apr: 0,
  
  // Wallet connect state
  wallet_connect: {
    toast: false,
    url: ""
  }
});

const useWalletStore = defineStore("wallet", {
  state,
  actions,
  getters
});

export { useWalletStore, WalletActions };
