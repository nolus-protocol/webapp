import { type State } from "./types";
import { defineStore } from "pinia";
import { getters } from "./getters";
import { WalletActions } from "./types";
import { actions } from "./actions";

const state = (): State => ({
  balances: [],
  currencies: {},
  suppliedBalance: {},
  apr: 0,
  vest: [],
  lppPrice: {}
});

const useWalletStore = defineStore("wallet", {
  state,
  actions,
  getters
});

export { useWalletStore, WalletActions };
