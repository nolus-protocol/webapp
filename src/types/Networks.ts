import type { ExternalCurrencyType } from "./CurreciesType"

export interface NetworksInfo {
    [key: string]: {
        [key: string]: ExternalCurrencyType
    }
}

export interface Currency {
    native?: {
        name: string,
        ticker: string,
        symbol: string,
        decimal_digits: string
    },
    ibc?: {
        network: string,
        currency: string
    },
    icon?: string,
    forward?: string[]
}