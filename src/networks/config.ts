import osmoIcon from "@/assets/icons/coins/osmosis.svg";
import type { NetworkData } from "@/types/Network";
import { NATIVE_NETWORK } from "@/config/env";
import { NETWORK as OSMO_NETWORK } from './osmo/network';
import { embedChainInfo } from './osmo/contants';

export const SUPPORTED_NETWORKS = [
    NATIVE_NETWORK,
    {
        prefix: "osmo",
        value: "osmo",
        label: "Osmosis",
        icon: osmoIcon,
        native: false,
        estimation: 20,
        sourceChannel: "channel-0",
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
                tendermintRpc: "https://osmo-test-cl.nolus.network:26657",
                api: "https://osmo-test-cl.nolus.network:1317",
                sourceChannel: "channel-109",
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => import('./osmo/currencies.dev').then(m => m.CURRENCIES),
                embedChainInfo
            }
        }
    },
    devnet: {
        supportedNetworks: {
            OSMO: {
                ...OSMO_NETWORK,
                tendermintRpc: "https://osmo-test-cl.nolus.network:26657",
                api: "https://osmo-test-cl.nolus.network:1317",
                sourceChannel: "channel-109",
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => import('./osmo/currencies.dev').then(m => m.CURRENCIES),
                embedChainInfo
            }
        }
    },
    testnet: {
        supportedNetworks: {
            OSMO: {
                ...OSMO_NETWORK,
                tendermintRpc: "https://osmo-test-cl.nolus.network:26657",
                api: "https://osmo-test-cl.nolus.network:1317",
                sourceChannel: "channel-110",
                explorer: 'https://testnet.mintscan.io/osmosis-testnet/txs',
                currencies: () => import('./osmo/currencies.dev').then(m => m.CURRENCIES),
                embedChainInfo
            }
        }
    },
    mainnet: {
        supportedNetworks: {
            OSMO: {
                ...OSMO_NETWORK,
                tendermintRpc: "https://osmo-cl.nolus.network:26657",
                api: "https://osmo-cl.nolus.network:1317",
                sourceChannel: "channel-783",
                explorer: 'https://mintscan.io/osmosis/txs',
                currencies: () => import('./osmo/currencies.prod').then(m => m.CURRENCIES),
                embedChainInfo
            }
        }
    },
};