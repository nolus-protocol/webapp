import type { ExternalCurrencies, ExternalCurrency, IObjectKeys, NetworkConfig, NetworksInfo } from "@/common/types";

export enum ApplicationActions {
  LOAD_CURRENCIES = "LOAD_CURRENCIES",
  CHANGE_NETWORK = "CHANGE_NETWORK",
  LOAD_NETWORK = "LOAD_NETWORK",
  SET_THEME = "SET_THEME",
  LOAD_THEME = "LOAD_THEME",
  LOAD_APR_REWARDS = "LOAD_APR_REWARDS"
}

export type State = {
  init: boolean;
  networks?: NetworksInfo;
  assetIcons?: {
    [key: string]: string;
  };
  map_keys: { [key: string]: string };
  network: NetworkConfig | IObjectKeys;
  protocolFilter: string;
  theme?: string;
  apr?: { [key: string]: number };
  dispatcherRewards?: number;
  currenciesData?: ExternalCurrencies;
  native?: ExternalCurrency;
  lpn?: ExternalCurrency[];
  lease?: { [key: string]: string[] };
  protocols: string[];
  leasesCurrencies: string[];
};

// Store type for action methods - includes state properties and common methods
// This avoids circular import from useApplicationStore
export type Store = State & {
  $patch: (partial: Partial<State> | ((state: State) => void)) => void;
};
