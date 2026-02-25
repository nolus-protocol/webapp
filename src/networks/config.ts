/**
 * Network Configuration
 *
 * All network data is fetched from the backend via the config store.
 * This file only provides helper functions and legacy exports for backward compatibility.
 */

import { CURRENT_NETWORK_KEY, DEFAULT_PRIMARY_NETWORK } from "@/config/global/networks";

import { embedChainInfo as nolusChainInfo } from "./list/nolus/constants";
import { embedChainInfo as osmoChainInfo } from "./list/osmosis/constants";
import { embedChainInfo as neutronChainInfo } from "./list/neutron/constants";

import { useConfigStore } from "@/common/stores/config";
import type { ExternalCurrencies } from "@/common/types";

const CHAIN_INFO_EMBEDDERS: { [key: string]: Function } = {
  NOLUS: nolusChainInfo,
  OSMOSIS: osmoChainInfo,
  NEUTRON: neutronChainInfo
};

/**
 * Get NETWORK_DATA dynamically from config store
 */
function getNetworkData() {
  const configStore = useConfigStore();
  const networks = configStore.networks;
  const currentNetwork = localStorage.getItem(CURRENT_NETWORK_KEY) || DEFAULT_PRIMARY_NETWORK;

  // Build list from backend networks - filter based on current environment
  const list = networks.map((n) => ({
    prefix: n.prefix,
    value: n.value,
    label: n.name,
    native: n.native,
    estimation:
      n.estimation ??
      (n.estimation_duration ? { duration: n.estimation_duration, type: n.estimation_type || "min" } : 20),
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
        gasMultiplier: network.gas_multiplier,
        bip44Path: "44'/118'/0'/0/0",
        ibcTransferTimeout: 60,
        ticker: network.symbol,
        fees: {
          transfer_amount: network.fees_transfer ?? 500
        },
        currencies: () => {
          return configStore.getCurrenciesForNetwork(network.key) as ExternalCurrencies;
        },
        embedChainInfo: CHAIN_INFO_EMBEDDERS[network.key] ??
          (() => {
            throw new Error(`No chain info embedder for network: ${network.key}`);
          })
      };
    }
  }

  return {
    list,
    supportedNetworks
  };
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
