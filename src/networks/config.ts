import osmoIcon from "@/assets/icons/coins/osmosis.svg";
import atomIcon from "@/assets/icons/coins/atom.svg";

import type { NetworkData } from "@/types/Network";

import { NATIVE_NETWORK } from "@/config/env";
import { NETWORK as OSMO_NETWORK } from './osmo/network';
import { embedChainInfo as osmoChainInfo } from './osmo/contants';

import { NETWORK as ATOM_NETWORK } from './cosmos/network';
import { embedChainInfo as atomChainInfo } from './cosmos/contants';

import { useApplicationStore } from "@/stores/application";
import type { ExternalCurrenciesType } from "@/types/CurreciesType";

export const SUPPORTED_NETWORKS = [
    NATIVE_NETWORK,
    {
        prefix: "osmo",
        value: "osmo",
        label: "Osmosis",
        icon: osmoIcon,
        native: false,
        estimation: 20,
        key: "OSMOSIS"
    },
    {
        prefix: "cosmos",
        value: "cosmos",
        label: "Cosmos Hub",
        icon: atomIcon,
        native: false,
        estimation: 20,
        key: "COSMOS_HUB",
        forwardKey: "OSMOSIS"
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
            }
        }
    },
};