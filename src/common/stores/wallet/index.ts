import { type State } from "./types";
import { defineStore } from "pinia";
import { getters } from "./getters";
import { WalletActions } from "./types";
import { actions } from "./actions";
import { Int, Coin as UnitCoin } from "@keplr-wallet/unit";
import { NATIVE_ASSET } from "@/config/global";

const state = (): State => ({
  balances: [],
  suppliedBalance: {},
  apr: 0,
  vest: [],
  lppPrice: {},
  total_unls: { balance: new UnitCoin(NATIVE_ASSET.denom, new Int(0)) }
});

const useWalletStore = defineStore("wallet", {
  state,
  actions,
  getters
});

export { useWalletStore, WalletActions };
