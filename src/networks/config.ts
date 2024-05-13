import { NATIVE_NETWORK } from "@/config/global";

import { NETWORK as OSMO_NETWORK } from "./osmosis/network";
import { embedChainInfo as osmoChainInfo } from "./osmosis/contants";

import { NETWORK as ATOM_NETWORK } from "./cosmos/network";
import { embedChainInfo as atomChainInfo } from "./cosmos/contants";

import { NETWORK as AXELAR_NETWORK } from "./axelar/network";
import { embedChainInfo as alexarChainInfo } from "./axelar/contants";

import { NETWORK as STRIDE_NETWORK } from "./stride/network";
import { embedChainInfo as strideChainInfo } from "./stride/contants";

import { NETWORK as JUNO_NETWORK } from "./juno/network";
import { embedChainInfo as junoChainInfo } from "./juno/contants";

import { NETWORK as EVMOS_NETWORK } from "./evmos/network";
import { embedChainInfo as evmosChainInfo } from "./evmos/contants";

import { NETWORK as PERSISTENCE_NETWORK } from "./persistence/network";
import { embedChainInfo as persistenceChainInfo } from "./persistence/contants";

import { NETWORK as SECRET_NETWORK } from "./secret/network";
import { embedChainInfo as secretChainInfo } from "./secret/contants";

import { NETWORK as CELESTIA_NETWORK } from "./celestia/network";
import { embedChainInfo as celestiaChainInfo } from "./celestia/contants";

import { NETWORK as STARGAZE_NETWORK } from "./stargaze/network";
import { embedChainInfo as stargazeChainInfo } from "./stargaze/contants";

import { NETWORK as QUICKSILVER_NETWORK } from "./quicksilver/network";
import { embedChainInfo as quicksilverChainInfo } from "./quicksilver/contants";

import { NETWORK as NEUTRON_NETWORK } from "./neutron/network";
import { embedChainInfo as neutronChainInfo } from "./neutron/contants";

import { NETWORK as DYMENSION_NETWORK } from "./dymension/network";
import { embedChainInfo as dymensionChainInfo } from "./dymension/contants";

import { NETWORK as JACKAL_NETWORK } from "./jackal/network";
import { embedChainInfo as jackalChainInfo } from "./jackal/contants";

import { NETWORK as INJECTIVE_NETWORK } from "./injective/network";
import { embedChainInfo as injectiveChainInfo } from "./injective/contants";

import { NETWORK as COMPOSABLE_NETWORK } from "./composable/network";
import { embedChainInfo as composableChainInfo } from "./composable/contants";

import { NETWORK as NOBLE_NETWORK } from "./noble/network";
import { embedChainInfo as nobleChainInfo } from "./noble/contants";

import { useApplicationStore } from "@/common/stores/application";
import type { ExternalCurrencies, NetworkData } from "@/common/types";

export const SUPPORTED_NETWORKS_DATA: {
  [key: string]: {
    prefix: string;
    value: string;
    label: string;
    native: boolean;
    estimation: number;
    key: string;
    symbol: string;
    forward?: boolean;
  };
} = {
  NOLUS: NATIVE_NETWORK,
  OSMOSIS: {
    prefix: "osmo",
    value: "osmosis",
    label: "Osmosis",
    native: false,
    estimation: 20,
    key: "OSMOSIS",
    symbol: "OSMO"
  },
  COSMOS_HUB: {
    prefix: "cosmos",
    value: "cosmos",
    label: "Cosmos Hub",
    native: false,
    estimation: 20,
    key: "COSMOS_HUB",
    symbol: "ATOM",
    forward: true
  },
  AXELAR: {
    prefix: "axelar",
    value: "axelar",
    label: "Axelar",
    native: false,
    estimation: 20,
    key: "AXELAR",
    symbol: "AXL",
    forward: true
  },
  STRIDE: {
    prefix: "stride",
    value: "stride",
    label: "Stride",
    native: false,
    estimation: 20,
    key: "STRIDE",
    symbol: "STRD",
    forward: true
  },
  JUNO: {
    prefix: "juno",
    value: "juno",
    label: "Juno",
    native: false,
    estimation: 20,
    key: "JUNO",
    symbol: "JUNO",
    forward: true
  },
  EVMOS: {
    prefix: "evmos",
    value: "evmos",
    label: "Evmos",
    native: false,
    estimation: 20,
    key: "EVMOS",
    symbol: "EVMOS",
    forward: true
  },
  PERSISTENCE: {
    prefix: "persistence",
    value: "persistence",
    label: "Persistence",
    native: false,
    estimation: 20,
    key: "PERSISTENCE",
    symbol: "XPRT",
    forward: true
  },
  SECRET: {
    prefix: "secret",
    value: "secret",
    label: "Secret",
    native: false,
    estimation: 20,
    key: "SECRET",
    symbol: "SCRT",
    forward: true
  },
  CELESTIA: {
    prefix: "celestia",
    value: "celestia",
    label: "Celestia",
    native: false,
    estimation: 20,
    key: "CELESTIA",
    symbol: "TIA",
    forward: true
  },
  STARGAZE: {
    prefix: "stars",
    value: "stars",
    label: "Stargaze",
    native: false,
    estimation: 20,
    key: "STARGAZE",
    symbol: "STARS",
    forward: true
  },
  QUICKSILVER: {
    prefix: "quick",
    value: "quicksilver",
    label: "Quicksilver",
    native: false,
    estimation: 20,
    key: "QUICKSILVER",
    symbol: "QCK",
    forward: true
  },
  NEUTRON: {
    prefix: "neutron",
    value: "neutron",
    label: "Neutron",
    native: false,
    estimation: 20,
    key: "NEUTRON",
    symbol: "NTRN",
    forward: false
  },
  DYDX: {
    prefix: "dydx",
    value: "dydx",
    label: "Dydx",
    native: false,
    estimation: 20,
    key: "DYDX",
    symbol: "DYDX",
    forward: true
  },
  DYMENSION: {
    prefix: "dymension",
    value: "dymension",
    label: "Dymension",
    native: false,
    estimation: 20,
    key: "DYMENSION",
    symbol: "DYM",
    forward: true
  },
  JACKAL: {
    prefix: "jackal",
    value: "jackal",
    label: "Jackal",
    native: false,
    estimation: 20,
    key: "JACKAL",
    symbol: "JKL",
    forward: true
  },
  INJECTIVE: {
    prefix: "injective",
    value: "injective",
    label: "Injective",
    native: false,
    estimation: 20,
    key: "INJECTIVE",
    symbol: "INJ",
    forward: true
  },
  COMPOSABLE: {
    prefix: "composable",
    value: "composable",
    label: "Composable",
    native: false,
    estimation: 20,
    key: "COMPOSABLE",
    symbol: "PICA",
    forward: true
  },
  NOBLE: {
    prefix: "noble",
    value: "noble",
    label: "Noble",
    native: false,
    estimation: 20,
    key: "NOBLE",
    symbol: "USDC_NOBLE",
    forward: true
  }
};

export const NETWORKS_DATA: {
  [key: string]: {
    list: {
      prefix: string;
      value: string;
      label: string;
      native: boolean;
      estimation: number;
      key: string;
      symbol: string;
    }[];
    supportedNetworks: {
      [key: string]: NetworkData;
    };
  };
} = {
  testnet: {
    list: [
      SUPPORTED_NETWORKS_DATA.NOLUS,
      SUPPORTED_NETWORKS_DATA.OSMOSIS,
      SUPPORTED_NETWORKS_DATA.COSMOS_HUB,
      SUPPORTED_NETWORKS_DATA.AXELAR,
      SUPPORTED_NETWORKS_DATA.JUNO,
      SUPPORTED_NETWORKS_DATA.NEUTRON
    ],
    supportedNetworks: {
      OSMOSIS: {
        ...OSMO_NETWORK,
        explorer: "https://testnet.mintscan.io/osmosis-testnet/txs",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: osmoChainInfo
      },
      COSMOS_HUB: {
        ...ATOM_NETWORK,
        explorer: "https://testnet.mintscan.io/cosmoshub-testnet/txs",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[ATOM_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: atomChainInfo
      },
      AXELAR: {
        ...AXELAR_NETWORK,
        explorer: "https://testnet.mintscan.io/axelar-testnet/txs",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[AXELAR_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: alexarChainInfo
      },
      JUNO: {
        ...JUNO_NETWORK,
        explorer: "https://testnet.mintscan.io/juno-testnet/txs",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[JUNO_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: junoChainInfo
      },
      NEUTRON: {
        ...NEUTRON_NETWORK,
        explorer: "https://testnet.mintscan.io/neutron-testnet/txs",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[NEUTRON_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: neutronChainInfo
      }
    }
  },
  mainnet: {
    list: [
      SUPPORTED_NETWORKS_DATA.NOLUS,
      SUPPORTED_NETWORKS_DATA.OSMOSIS,
      SUPPORTED_NETWORKS_DATA.COSMOS_HUB,
      SUPPORTED_NETWORKS_DATA.AXELAR,
      SUPPORTED_NETWORKS_DATA.STRIDE,
      SUPPORTED_NETWORKS_DATA.JUNO,
      // SUPPORTED_NETWORKS_DATA.PERSISTENCE,
      SUPPORTED_NETWORKS_DATA.SECRET,
      SUPPORTED_NETWORKS_DATA.STARGAZE,
      SUPPORTED_NETWORKS_DATA.CELESTIA,
      SUPPORTED_NETWORKS_DATA.QUICKSILVER,
      SUPPORTED_NETWORKS_DATA.NEUTRON,
      SUPPORTED_NETWORKS_DATA.DYMENSION,
      SUPPORTED_NETWORKS_DATA.EVMOS,
      SUPPORTED_NETWORKS_DATA.JACKAL,
      SUPPORTED_NETWORKS_DATA.INJECTIVE,
      SUPPORTED_NETWORKS_DATA.COMPOSABLE,
      SUPPORTED_NETWORKS_DATA.NOBLE
    ],
    supportedNetworks: {
      OSMOSIS: {
        ...OSMO_NETWORK,
        explorer: "https://mintscan.io/osmosis/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[OSMO_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: osmoChainInfo
      },
      COSMOS_HUB: {
        ...ATOM_NETWORK,
        explorer: "https://mintscan.io/cosmoshub/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[ATOM_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: atomChainInfo
      },
      AXELAR: {
        ...AXELAR_NETWORK,
        explorer: "https://mintscan.io/axelar/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[AXELAR_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: alexarChainInfo
      },
      STRIDE: {
        ...STRIDE_NETWORK,
        explorer: "https://mintscan.io/stride/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[STRIDE_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: strideChainInfo
      },
      JUNO: {
        ...JUNO_NETWORK,
        explorer: "https://mintscan.io/juno/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[JUNO_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: junoChainInfo
      },
      EVMOS: {
        ...EVMOS_NETWORK,
        explorer: "https://mintscan.io/evmos/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[EVMOS_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: evmosChainInfo
      },
      PERSISTENCE: {
        ...PERSISTENCE_NETWORK,
        explorer: "https://mintscan.io/persistence/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[PERSISTENCE_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: persistenceChainInfo
      },
      SECRET: {
        ...SECRET_NETWORK,
        explorer: "https://mintscan.io/secret/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[SECRET_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: secretChainInfo
      },
      STARGAZE: {
        ...STARGAZE_NETWORK,
        explorer: "https://mintscan.io/stargaze/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[STARGAZE_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: stargazeChainInfo
      },
      CELESTIA: {
        ...CELESTIA_NETWORK,
        explorer: "https://mintscan.io/celestia/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[CELESTIA_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: celestiaChainInfo
      },
      QUICKSILVER: {
        ...QUICKSILVER_NETWORK,
        explorer: "https://mintscan.io/quicksilver/transactions",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[QUICKSILVER_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: quicksilverChainInfo
      },
      NEUTRON: {
        ...NEUTRON_NETWORK,
        explorer: "https://mintscan.io/neutron/txs",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[NEUTRON_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: neutronChainInfo
      },
      DYMENSION: {
        ...DYMENSION_NETWORK,
        explorer: "https://mintscan.io/dymension/txs",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[DYMENSION_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: dymensionChainInfo
      },
      JACKAL: {
        ...JACKAL_NETWORK,
        explorer: "https://ping.pub/jackal/tx",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[JACKAL_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: jackalChainInfo
      },
      INJECTIVE: {
        ...INJECTIVE_NETWORK,
        explorer: "https://ping.pub/injective/tx",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[INJECTIVE_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: injectiveChainInfo
      },
      COMPOSABLE: {
        ...COMPOSABLE_NETWORK,
        explorer: "https://ping.pub/composable/tx",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[COMPOSABLE_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: composableChainInfo
      },
      NOBLE: {
        ...NOBLE_NETWORK,
        explorer: "https://ping.pub/noble/tx",
        currencies: () => {
          const app = useApplicationStore();
          return app?.networks?.[NOBLE_NETWORK.key] as ExternalCurrencies;
        },
        embedChainInfo: nobleChainInfo
      }
    }
  }
};
