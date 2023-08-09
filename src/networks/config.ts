import type { NetworkData } from "@/types/Network";

import { NATIVE_NETWORK } from "@/config/env";
import { NETWORK as OSMO_NETWORK } from './osmo/network';
import { embedChainInfo as osmoChainInfo } from './osmo/contants';

import { NETWORK as ATOM_NETWORK } from './cosmos/network';
import { embedChainInfo as atomChainInfo } from './cosmos/contants';

import { NETWORK as AXELAR_NETWORK } from './axelar/network';
import { embedChainInfo as alexarChainInfo } from './axelar/contants';

import { useApplicationStore } from "@/stores/application";
import type { ExternalCurrenciesType } from "@/types/CurreciesType";

export const SUPPORTED_NETWORKS = [
    NATIVE_NETWORK,
    {
        prefix: "osmo",
        value: "osmo",
        label: "Osmosis",
        native: false,
        estimation: 20,
        key: "OSMOSIS",
        symbol: "OSMO"
    },
    {
        prefix: "cosmos",
        value: "cosmos",
        label: "Cosmos Hub",
        native: false,
        estimation: 20,
        key: "COSMOS_HUB",
        symbol: "ATOM"
    },
    {
        prefix: "axelar",
        value: "axelar",
        label: "Axelar network",
        native: false,
        estimation: 20,
        key: "AXELAR",
        symbol: "AXL"
    },
];

export const NETWORKS_DATA: {
    [key: string]: {
        supportedNetworks: {
            [key: string]: NetworkData
        }
    }
} = {
    localnet: {
        supportedNetworks: {
            OSMOSIS: {
                ...OSMO_NETWORK,
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: osmoChainInfo
            },
            COSMOS_HUB: {
                ...ATOM_NETWORK,
                explorer: 'https://testnet.mintscan.io/cosmoshub-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[ATOM_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: atomChainInfo,
            },
            AXELAR: {
                ...AXELAR_NETWORK,
                explorer: 'https://testnet.mintscan.io/axelar-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[AXELAR_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: alexarChainInfo,
            }
        }
    },
    devnet: {
        supportedNetworks: {
            OSMOSIS: {
                ...OSMO_NETWORK,
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: osmoChainInfo
            },
            COSMOS_HUB: {
                ...ATOM_NETWORK,
                explorer: 'https://testnet.mintscan.io/cosmoshub-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[ATOM_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: atomChainInfo,
            },
            AXELAR: {
                ...AXELAR_NETWORK,
                explorer: 'https://testnet.mintscan.io/axelar-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[AXELAR_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: alexarChainInfo,
            }
        }
    },
    testnet: {
        supportedNetworks: {
            OSMOSIS: {
                ...OSMO_NETWORK,
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: osmoChainInfo
            },
            COSMOS_HUB: {
                ...ATOM_NETWORK,
                explorer: 'https://testnet.mintscan.io/cosmoshub-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[ATOM_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: atomChainInfo,
            },
            AXELAR: {
                ...AXELAR_NETWORK,
                explorer: 'https://testnet.mintscan.io/axelar-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[AXELAR_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: alexarChainInfo,
            }
        }
    },
    mainnet: {
        supportedNetworks: {
            OSMOSIS: {
                ...OSMO_NETWORK,
                explorer: 'https://mintscan.io/osmosis/transactions',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: osmoChainInfo
            },
            COSMOS_HUB: {
                ...ATOM_NETWORK,
                explorer: 'https://mintscan.io/cosmoshub/transactions',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[ATOM_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: atomChainInfo,
            },
            AXELAR: {
                ...AXELAR_NETWORK,
                explorer: 'https://mintscan.io/axelar/transactions',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[AXELAR_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo: alexarChainInfo,
            }
        }
    },
};