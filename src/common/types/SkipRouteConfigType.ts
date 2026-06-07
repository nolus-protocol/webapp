export interface SkipRouteConfigType {
  blacklist: string[];
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
  /**
   * Per-network default swap-from denom, keyed `swap_currency_<network>` (lowercase
   * network name). Dynamic and optional: a network absent from the backend config has
   * no entry, so the value is `string | undefined`. Validated at point of use in
   * SwapForm, not in SkipRouteConfigSchema — see the schema for why.
   */
  [key: `swap_currency_${string}`]: string | undefined;
}
