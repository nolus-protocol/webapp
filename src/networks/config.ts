/**
 * Network Configuration
 *
 * All network data is fetched from the backend via the config store.
 * This file only provides helper functions.
 */

import { embedChainInfo as nolusChainInfo } from "./list/nolus/constants";
import { embedChainInfo as osmoChainInfo } from "./list/osmosis/constants";
import { embedChainInfo as neutronChainInfo } from "./list/neutron/constants";

import { useConfigStore } from "@/common/stores/config";
import type { ExternalCurrencies, NetworkData } from "@/common/types";
import { ChainType } from "@/common/types/Network";
import type { ChainInfo } from "@keplr-wallet/types";

type ChainInfoEmbedder = (chainId: string, tendermintRpc: string, rest: string) => ChainInfo;

// NetworkData.embedChainInfo is frozen at `(...args: unknown[]) => unknown`, so the
// typed embedders are adapted to it with a runtime check instead of a type assertion.
function withUnknownArgs(embedder: ChainInfoEmbedder): (...args: unknown[]) => unknown {
  return (...args: unknown[]) => {
    const [chainId, tendermintRpc, rest] = args;
    if (typeof chainId !== "string" || typeof tendermintRpc !== "string" || typeof rest !== "string") {
      throw new Error("embedChainInfo expects chainId, rpc and rest endpoint strings");
    }
    return embedder(chainId, tendermintRpc, rest);
  };
}

const CHAIN_INFO_EMBEDDERS: { [key: string]: (...args: unknown[]) => unknown } = {
  NOLUS: withUnknownArgs(nolusChainInfo),
  OSMOSIS: withUnknownArgs(osmoChainInfo),
  NEUTRON: withUnknownArgs(neutronChainInfo)
};

function toChainType(value: string): ChainType | undefined {
  return (Object.values(ChainType) as string[]).includes(value) ? (value as ChainType) : undefined;
}

/**
 * Get network data dynamically from config store
 */
export function getNetworkData() {
  const configStore = useConfigStore();
  const networks = configStore.networks;

  const list = [];
  const supportedNetworks: { [key: string]: NetworkData } = {};

  for (const network of networks) {
    const chainType = toChainType(network.chain_type);

    // A network whose chain_type is not a recognized ChainType is dropped from
    // both the picker list and the supportedNetworks map: an unknown tag must
    // never silently fall through to the cosmos machinery.
    if (chainType === undefined) {
      continue;
    }

    // svm networks carry no Keplr chain-info embedder and are not yet routable
    // by the send/receive picker, so they are omitted from both the picker list
    // and the supportedNetworks map. Skipping here also keeps the embedder
    // lookup below off the svm path, where it would otherwise throw.
    if (chainType === ChainType.svm) {
      continue;
    }

    list.push({
      prefix: network.prefix,
      value: network.value,
      label: network.name,
      native: network.native,
      estimation:
        network.estimation ??
        (network.estimation_duration
          ? { duration: network.estimation_duration, type: network.estimation_type || "min" }
          : 20),
      key: network.key,
      symbol: network.symbol,
      chain_type: chainType,
      icon: network.icon,
      forward: network.forward
    });

    if (chainType === ChainType.cosmos) {
      supportedNetworks[network.key] = {
        prefix: network.prefix,
        key: network.key,
        name: network.name,
        gasPrice: network.gas_price,
        explorer: network.explorer ?? "",
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
        embedChainInfo:
          CHAIN_INFO_EMBEDDERS[network.key] ??
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
