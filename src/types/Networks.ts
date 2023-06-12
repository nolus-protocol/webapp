import type { ExternalCurrencyType } from "./CurreciesType"

export interface Networks {
    networks: {
        list: {
            [key: string]: {
                currencies: {
                    [key: string]: Currency
                }
            }
        }
        channels: {
            a: {
                network: string,
                ch: string
            },
            b: {
                network: string,
                ch: string
            }
        }[]
    }
    lease: {
        Lpn: {
            [key: string]: {}
        }
        Lease: {
            [key: string]: {
                swap_routes: Array<
                    {
                        pool_id: string,
                        pool_token: string
                    }[]
                >
            }
        },
        Native: {
            id: string,
            swap_routes: Array<
                {
                    pool_id: string,
                    pool_token: string
                }[]
            >
        }
    },
    definitions: string[]
}

export interface NetworksInfo {
    [key: string]: {
        [key: string]: ExternalCurrencyType
    }
}

export interface Currency {
    native?: {
        name: string,
        symbol: string,
        decimal_digits: string
    },
    ibc?: {
        network: string,
        currency: string
    },
    icon?: string
}