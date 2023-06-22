import osmoIcon from "@/assets/icons/coins/osmosis.svg";
import type { NetworkData } from "@/types/Network";
import { NATIVE_NETWORK } from "@/config/env";
import { NETWORK as OSMO_NETWORK } from './osmo/network';
import { embedChainInfo } from './osmo/contants';
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
        key: "OSMO"
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
            OSMO: {
                ...OSMO_NETWORK,
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo
            }
        }
    },
    devnet: {
        supportedNetworks: {
            OSMO: {
                ...OSMO_NETWORK,
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo
            }
        }
    },
    testnet: {
        supportedNetworks: {
            OSMO: {
                ...OSMO_NETWORK,
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo
            }
        }
    },
    mainnet: {
        supportedNetworks: {
            OSMO: {
                ...OSMO_NETWORK,
                explorer: 'https://mintscan.io/osmosis/txs',
                currencies: () => {
                    const app = useApplicationStore();
                    return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrenciesType;
                },
                embedChainInfo
            }
        }
    },
};