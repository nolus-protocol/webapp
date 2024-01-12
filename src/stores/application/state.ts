import type { ExternalCurrenciesType, ExternalCurrencyType } from "@/types/CurreciesType";
import type { NetworkConfig } from "@/types/NetworkConfig";
import type { NetworksInfo } from "@/types/Networks";
import type { NetworkData } from "@nolus/nolusjs/build/types/Networks";

export type State = {
  networks: NetworksInfo | null;
  networksData: NetworkData | null;
  assetIcons: {
    [key: string]: string
  } | null;
  network: NetworkConfig;
  theme: string | null;
  apr: number | null,
  dispatcherRewards: number | null,
  sessionExpired: boolean,
  currenciesData: ExternalCurrenciesType | null,
  native: ExternalCurrencyType | null,
  lpn: ExternalCurrencyType[] | null,
  lease: { [key: string]: string[] } | null,
  protocols: string[],
  leasesCurrencies: string[]
};
