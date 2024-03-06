import type { State } from "./types";
import { defineStore } from "pinia";
import { OracleActions } from "./types";
import { actions } from "./actions";

const state = (): State => ({
  prices: {}
});

const useOracleStore = defineStore("oracle", {
  state,
  actions
});

export { useOracleStore, OracleActions };
