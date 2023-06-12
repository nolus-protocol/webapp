import type { Networks } from "./Networks";

export interface NetworkAddress {
  chainName?: string,
  tendermintRpc: string;
  api: string;
  explorer: string;
  govern: string;
  staking: string;
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
