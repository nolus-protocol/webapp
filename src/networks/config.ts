/**
 * Network Configuration
 * 
 * All network data is fetched from the backend via the config store.
 * This file only provides helper functions and legacy exports for backward compatibility.
 */

import { CURRENT_NETWORK_KEY, DEFAULT_PRIMARY_NETWORK } from "@/config/global/networks";

import { embedChainInfo as nolusChainInfo } from "./list/nolus/contants";
import { embedChainInfo as osmoChainInfo } from "./list/osmosis/contants";
import { embedChainInfo as atomChainInfo } from "./list/cosmos/contants";
import { embedChainInfo as alexarChainInfo } from "./list/axelar/contants";
import { embedChainInfo as strideChainInfo } from "./list/stride/contants";
import { embedChainInfo as junoChainInfo } from "./list/juno/contants";
import { embedChainInfo as evmosChainInfo } from "./list/evmos/contants";
import { embedChainInfo as persistenceChainInfo } from "./list/persistence/contants";
import { embedChainInfo as secretChainInfo } from "./list/secret/contants";
import { embedChainInfo as celestiaChainInfo } from "./list/celestia/contants";
import { embedChainInfo as stargazeChainInfo } from "./list/stargaze/contants";
import { embedChainInfo as quicksilverChainInfo } from "./list/quicksilver/contants";
import { embedChainInfo as neutronChainInfo } from "./list/neutron/contants";
import { embedChainInfo as dymensionChainInfo } from "./list/dymension/contants";
import { embedChainInfo as jackalChainInfo } from "./list/jackal/contants";
import { embedChainInfo as injectiveChainInfo } from "./list/injective/contants";
import { embedChainInfo as composableChainInfo } from "./list/composable/contants";
import { embedChainInfo as nobleChainInfo } from "./list/noble/contants";
import { embedChainInfo as mantraChainInfo } from "./list/mantra/contants";
import { embedChainInfo as nillionChainInfo } from "./list/nillion/contants";
import { embedChainInfo as xionChainInfo } from "./list/xion/contants";
import { embedChainInfo as babylonChainInfo } from "./list/babylon/contants";
import { embedChainInfo as cudosChainInfo } from "./cudos/contants";

import { useConfigStore } from "@/common/stores/config";
import type { ExternalCurrencies } from "@/common/types";

export const PROOBUF_ONLY_NETWORK = ["ARBITRUM"];

/**
 * Chain info embedders indexed by network key
 * These are used for wallet integration
 */
const CHAIN_INFO_EMBEDDERS: { [key: string]: Function } = {
  NOLUS: nolusChainInfo,
  OSMOSIS: osmoChainInfo,
  COSMOS_HUB: atomChainInfo,
  AXELAR: alexarChainInfo,
  STRIDE: strideChainInfo,
  JUNO: junoChainInfo,
  EVMOS: evmosChainInfo,
  PERSISTENCE: persistenceChainInfo,
  SECRET: secretChainInfo,
  CELESTIA: celestiaChainInfo,
  STARGAZE: stargazeChainInfo,
  QUICKSILVER: quicksilverChainInfo,
  NEUTRON: neutronChainInfo,
  DYMENSION: dymensionChainInfo,
  JACKAL: jackalChainInfo,
  INJECTIVE: injectiveChainInfo,
  COMPOSABLE: composableChainInfo,
  NOBLE: nobleChainInfo,
  MANTRA: mantraChainInfo,
  NILLION: nillionChainInfo,
  XION: xionChainInfo,
  BABYLON: babylonChainInfo,
  CUDOS: cudosChainInfo
};

/**
 * Get chain info embedder for a network
 */
export function getChainInfoEmbedder(networkKey: string): Function | undefined {
  return CHAIN_INFO_EMBEDDERS[networkKey];
}

/**
 * Get network data for supported networks from the config store
 * This function provides the NetworkData format expected by wallet code
 */
export function getSupportedNetworkData(networkKey: string) {
  const configStore = useConfigStore();
  const network = configStore.getNetwork(networkKey);
  
  if (!network) {
    return undefined;
  }

  return {
    prefix: network.prefix,
    key: network.key,
    name: network.name,
    gasPrice: network.gas_price,
    explorer: network.explorer,
    gasMultiplier: network.gas_multiplier ?? 3.5,
    bip44Path: "44'/118'/0'/0/0",
    ibcTransferTimeout: 60,
    ticker: network.symbol,
    fees: {
      transfer_amount: network.fees_transfer ?? 500
    },
    currencies: () => {
      return configStore.getCurrenciesForNetwork(networkKey) as ExternalCurrencies;
    },
    embedChainInfo: CHAIN_INFO_EMBEDDERS[networkKey] ?? (() => {})
  };
}

/**
 * Get NETWORK_DATA dynamically from config store
 */
export function getNetworkData() {
  const configStore = useConfigStore();
  const networks = configStore.networks;
  const currentNetwork = localStorage.getItem(CURRENT_NETWORK_KEY) || DEFAULT_PRIMARY_NETWORK;
  
  // Build list from backend networks - filter based on current environment
  const list = networks.map(n => ({
    prefix: n.prefix,
    value: n.value,
    label: n.name,
    native: n.native,
    estimation: n.estimation ?? (n.estimation_duration ? { duration: n.estimation_duration, type: n.estimation_type || "min" } : 20),
    key: n.key,
    symbol: n.symbol,
    chain_type: n.chain_type,
    icon: n.icon,
    forward: n.forward
  }));

  // Build supportedNetworks map
  const supportedNetworks: { [key: string]: any } = {};
  for (const network of networks) {
    if (network.chain_type === "cosmos") {
      supportedNetworks[network.key] = {
        prefix: network.prefix,
        key: network.key,
        name: network.name,
        gasPrice: network.gas_price,
        explorer: network.explorer,
        gasMultiplier: network.gas_multiplier ?? 3.5,
        bip44Path: "44'/118'/0'/0/0",
        ibcTransferTimeout: 60,
        ticker: network.symbol,
        fees: {
          transfer_amount: network.fees_transfer ?? 500
        },
        currencies: () => {
          return configStore.getCurrenciesForNetwork(network.key) as ExternalCurrencies;
        },
        embedChainInfo: CHAIN_INFO_EMBEDDERS[network.key] ?? (() => {})
      };
    }
  }

  return {
    list,
    supportedNetworks
  };
}

/**
 * Legacy export - use configStore.supportedNetworksData instead
 * @deprecated Access network data through useConfigStore().supportedNetworksData
 */
export function getSupportedNetworksData() {
  const configStore = useConfigStore();
  return configStore.supportedNetworksData;
}

/**
 * Legacy export for NETWORK_DATA
 * @deprecated Use getNetworkData() instead
 */
export const NETWORK_DATA = {
  get list() {
    return getNetworkData().list;
  },
  get supportedNetworks() {
    return getNetworkData().supportedNetworks;
  }
};

/**
 * Legacy export for NETWORKS_DATA
 * @deprecated Use getNetworkData() instead
 */
export const NETWORKS_DATA = {
  get mainnet() {
    return getNetworkData();
  },
  get testnet() {
    return getNetworkData();
  }
};
