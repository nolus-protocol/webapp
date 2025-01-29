import type { ExternalCurrencies, ExternalCurrency, IObjectKeys, NetworkConfig, NetworksInfo } from "@/common/types";
import type { NetworkData } from "@nolus/nolusjs/build/types/Networks";

export enum ApplicationActions {
  LOAD_CURRENCIES = "LOAD_CURRENCIES",
  CHANGE_NETWORK = "CHANGE_NETWORK",
  LOAD_NETWORK = "LOAD_NETWORK",
  SET_THEME = "SET_THEME",
  LOAD_THEME = "LOAD_THEME",
  LOAD_APR_REWARDS = "LOAD_APR_REWARDS"
}

export type State = {
  networks?: NetworksInfo;
  networksData?: NetworkData;
  assetIcons?: {
    [key: string]: string;
  };
  network: NetworkConfig | IObjectKeys;
  protocolFilter: string;
  theme?: string;
  apr?: { [key: string]: number };
  dispatcherRewards?: number;
  sessionExpired: boolean;
  currenciesData?: ExternalCurrencies;
  native?: ExternalCurrency;
  lpn?: ExternalCurrency[];
  lease?: { [key: string]: string[] };
  protocols: string[];
  leasesCurrencies: string[];
};

export type Store = ReturnType<(typeof import(".."))["useApplicationStore"]>; // (3)
