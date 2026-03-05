export interface SkipRouteConfigType {
  blacklist: string[];
  swap_currency_osmosis: string;
  swap_currency_neutron: string;
  swap_to_currency: string;
  fee: number;
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
