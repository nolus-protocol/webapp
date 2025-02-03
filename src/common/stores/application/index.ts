import { ApplicationActions, type State } from "./types";
import { defineStore } from "pinia";
import { actions } from "./actions";
import { getters } from "./getters";
import { DefaultProtocolFilter } from "@/config/global";

const state = (): State => ({
  network: {},
  theme: "",
  protocolFilter: DefaultProtocolFilter,
  sessionExpired: false,
  protocols: [] as string[],
  leasesCurrencies: [] as string[]
});

const useApplicationStore = defineStore("application", {
  state,
  actions,
  getters
});

export { useApplicationStore, ApplicationActions };
