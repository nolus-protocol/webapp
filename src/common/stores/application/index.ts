import { ApplicationActions, type State } from "./types";
import { defineStore } from "pinia";
import { actions } from "./actions";
import { getters } from "./getters";
import { DefaultProtocolFilter } from "@/config/global";

const state = (): State => ({
  network: {},
  theme: "",
  protocolFilter: DefaultProtocolFilter,
  protocols: [] as string[],
  leasesCurrencies: [] as string[],
  map_keys: {}
});

const useApplicationStore = defineStore("application", {
  state,
  actions,
  getters
});

export { useApplicationStore, ApplicationActions };
