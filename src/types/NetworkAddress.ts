import type { NetworkData } from "@nolus/nolusjs/build/types/Networks";

export interface NetworkAddress {
  chainName?: string,
  explorer: string;
  govern: string;
  staking: string;
  endpoints: string;
  currencies: () => Promise<NetworkData | any>, //CurreciesType //TODO: fix any
  leaseBlockUpdate: number,
  lppCreatedAt: number,
  web3auth: {
    clientId: string;
    network: string | any;
    google: {
      name: string;
      verifier: string;
      typeOfLogin: string | any;
      clientId: string;
    };
  };
}
