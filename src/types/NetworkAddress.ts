import type { Networks } from "./Networks";

export interface NetworkAddress {
  chainName?: string,
  explorer: string;
  govern: string;
  staking: string;
  endpoints: string;
  currencies: () => Promise<Networks>, //CurreciesType
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
