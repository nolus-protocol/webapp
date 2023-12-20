export interface CurreciesType {
  "amm_pools": {
    "id": string,
    "token_0": string,
    "token_1": string,
  }[],
  "currencies": {
    [key: string]: {
      "name": string,
      "symbol": string,
      "decimal_digits": string,
      "ibc_route": string[],
      "groups": string[],
      "swap_routes": Array<
        {
          "pool_id": string,
          "pool_token": string,
        }[]
      >
    }
  }
}

export interface ExternalCurrenciesType {
  [key: string]: ExternalCurrencyType
}

export interface ExternalCurrencyType {
  "name": string,
  "shortName": string,
  "symbol": string,
  "decimal_digits": string,
  "ticker": string,
  "native": boolean,
  "key"?: string,
  "ibcData"?: string
}