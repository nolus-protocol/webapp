import type { CurreciesType } from "@/types";

export interface NetworkAddress {
  chainName?: string,
  tendermintRpc: string;
  api: string;
  explorer: string;
  govern: string;
  staking: string;
  currencies: () => Promise<CurreciesType>,
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
