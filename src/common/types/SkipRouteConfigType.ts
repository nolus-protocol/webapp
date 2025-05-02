export interface SkipRouteConfigType {
  blacklist: string[];
  apiKey: string;
  slippage: number;
  swap_currency_osmosis: string;
  swap_currency_neutron: string;
  swap_to_currency: string;
  gas_multiplier: number;
  fee: number;
  fee_address: string;
  timeoutSeconds: string;
  "osmosis-poolmanager": string;
  "neutron-astroport": string;
  swapVenues: {
    name: string;
    chainID: string;
  }[];
  transfers: {
    [key: string]: {
      currencies: {
        from: string;
        to: string;
        native: boolean;
        visible?: string;
      }[];
    };
  };
}
