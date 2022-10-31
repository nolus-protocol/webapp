export interface NetworkAddress {
  tendermintRpc: string;
  api: string;
  govern: string,
  web3auth: {
    clientId: string,
    google: {
      name: string,
      verifier: string,
      typeOfLogin: string | any,
      clientId: string,
    },
  }
}
