import type { NetworkAddress } from "@/common/types";

export const DEFAULT_PRIMARY_NETWORK = "mainnet";

// Network endpoints are now fetched from the backend via BackendApi.getWebappNetworkEndpoints()
// These static configs only contain metadata that doesn't change
export const NETWORKS: { [key: string]: NetworkAddress } = {
  testnet: {
    sendDefaultValue: "USDC_AXELAR@OSMOSIS-OSMOSIS-USDC_AXELAR",
    endpoints: "rila", // Network key for backend API
    chainName: "Nolus Testnet",
    explorer: "https://testnet.ping.pub/nolus/tx",
    govern: "https://testnet.ping.pub/nolus/gov",
    staking: "https://testnet.ping.pub/nolus/staking",
    evmEndpoints: "evm" // Network key for backend API
  },
  mainnet: {
    sendDefaultValue: "USDC_NOBLE@OSMOSIS-OSMOSIS-USDC_NOBLE",
    endpoints: "pirin", // Network key for backend API
    chainName: "Nolus",
    explorer: "https://ping.pub/nolus/tx",
    govern: "https://ping.pub/nolus/gov",
    staking: "https://wallet.keplr.app/chains/nolus",
    evmEndpoints: "evm" // Network key for backend API
  }
};

export const CURRENT_NETWORK_KEY = "currentNetwork";
export const NETWORK = NETWORKS[localStorage.getItem(CURRENT_NETWORK_KEY) || DEFAULT_PRIMARY_NETWORK];

export const SUPPORTED_NETWORKS = [
  "NOLUS",
  "OSMOSIS",
  "COSMOS_HUB",
  "AXELAR",
  "STRIDE",
  "JUNO",
  "EVMOS",
  "SECRET",
  "STARGAZE",
  "CELESTIA",
  "NEUTRON",
  "QUICKSILVER",
  "DYMENSION",
  "JACKAL",
  "INJECTIVE",
  "COMPOSABLE",
  "NOBLE",
  "MANTRA",
  "XION",
  "NILLION",
  "BABYLON",
  // "BINANCE",
  "AVALANCHE",
  "BASE"
];

export const IGNORED_NETWORKS = ["NOLUS"];
