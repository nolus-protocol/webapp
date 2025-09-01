import type { NetworkAddress } from "@/common/types";
import { isDev } from ".";

export const DEFAULT_PRIMARY_NETWORK = import.meta.env.VITE_DEFAULT_NETWORK;
export const NETWORKS: { [key: string]: NetworkAddress } = {
  devnet: {
    sendDefaultValue: "USDC_AXELAR@OSMOSIS-OSMOSIS-USDC_AXELAR",
    endpoints: isDev()
      ? import("../networks/vitosha-endpoints.json?url").then((t) => t.default)
      : "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/vitosha-endpoints.json",
    chainName: "Nolus Devnet",
    explorer: "https://devnet.ping.pub/nolus/tx",
    govern: "https://devnet.ping.pub/nolus/gov",
    staking: "https://devnet.ping.pub/nolus/staking",
    etlApi: "http://localhost:8082/api",
    evmEndpoints: isDev()
      ? import("../networks/evm-endpoints?url").then((t) => t.default)
      : "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/evm-endpoints.json"
  },
  testnet: {
    sendDefaultValue: "USDC_AXELAR@OSMOSIS-OSMOSIS-USDC_AXELAR",
    endpoints: isDev()
      ? import("../networks/rila-endpoints.json?url").then((t) => t.default)
      : "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/rila-endpoints.json",
    chainName: "Nolus Testnet",
    explorer: "https://testnet.ping.pub/nolus/tx",
    govern: "https://testnet.ping.pub/nolus/gov",
    staking: "https://testnet.ping.pub/nolus/staking",
    etlApi: "http://localhost:8082/api",
    evmEndpoints: isDev()
      ? import("../networks/evm-endpoints?url").then((t) => t.default)
      : "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/evm-endpoints.json"
  },
  mainnet: {
    sendDefaultValue: "USDC_NOBLE@OSMOSIS-OSMOSIS-USDC_NOBLE",
    endpoints: isDev()
      ? import("../networks/pirin-endpoints.json?url").then((t) => t.default)
      : "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/pirin-endpoints.json",
    chainName: "Nolus",
    explorer: "https://ping.pub/nolus/tx",
    govern: "https://ping.pub/nolus/gov",
    staking: "https://wallet.keplr.app/chains/nolus",
    etlApi: "https://etl.nolus.network/api",
    evmEndpoints: isDev()
      ? import("../networks/evm-endpoints?url").then((t) => t.default)
      : "https://raw.githubusercontent.com/nolus-protocol/webapp/main/src/config/networks/evm-endpoints.json"
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
  "DYDX",
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
