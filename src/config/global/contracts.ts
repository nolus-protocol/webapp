import type { ContractConfig } from "@/common/types";
import { NATIVE_ASSET } from "./network";
import { ProtocolsPirin, ProtocolsRila } from "@nolus/nolusjs/build/types/Networks";
import { EnvNetworkUtils } from "@/common/utils";
import neutron from "./../../assets/icons/networks/neutron.svg?url";
import osmosis from "./../../assets/icons/networks/osmosis.svg?url";

const network = EnvNetworkUtils.getStoredNetworkName();

export enum PositionTypes {
  long = "long",
  short = "short"
}

export const CONTRACTS: ContractConfig = {
  testnet: {
    ignoreProtocolsInEarn: [],
    protocols: ProtocolsRila,
    protocolsFilter: {
      OSMOSIS: {
        short: false,
        key: "OSMOSIS",
        image: osmosis,
        native: "NLS@OSMOSIS-OSMOSIS-USDC_AXELAR",
        hold: ["OSMOSIS-OSMOSIS-USDC_AXELAR"],
        name: "Osmosis"
      },
      NEUTRON: {
        short: false,
        key: "NEUTRON",
        image: neutron,
        native: "NLS@NEUTRON-ASTROPORT-USDC_AXL",
        hold: ["NEUTRON-ASTROPORT-USDC_AXL"],
        name: "Neutron"
      }
    },
    protocolConfig: {
      "NEUTRON-ASTROPORT-USDC_AXL": {
        lease: true,
        currencies: [],
        stable: "USDC_AXELAR",
        type: PositionTypes.long,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-USDC_AXELAR": {
        currencies: [],
        stable: "USDC_AXELAR",
        lease: true,
        type: PositionTypes.long,
        rewards: false,
        supply: false
      }
    },
    dispatcher: {
      instance: "nolus1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrqrr2r7y",
      codeId: ""
    },
    admin: {
      instance: "nolus17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsmc5xhq",
      codeId: "",
      ignoreProtocols: []
    }
  },
  mainnet: {
    ignoreProtocolsInEarn: [],
    protocols: ProtocolsPirin,
    protocolsFilter: {
      OSMOSIS: {
        short: true,
        key: "OSMOSIS",
        image: osmosis,
        native: "NLS@OSMOSIS-OSMOSIS-USDC_NOBLE",
        hold: [
          "OSMOSIS-OSMOSIS-USDC_AXELAR",
          "OSMOSIS-OSMOSIS-USDC_NOBLE",
          "OSMOSIS-OSMOSIS-OSMO",
          "OSMOSIS-OSMOSIS-ST_ATOM",
          "OSMOSIS-OSMOSIS-ALL_BTC",
          "OSMOSIS-OSMOSIS-ALL_SOL",
          "OSMOSIS-OSMOSIS-ATOM",
          "OSMOSIS-OSMOSIS-AKT"
        ],
        name: "Osmosis"
      },
      NEUTRON: {
        short: false,
        key: "NEUTRON",
        native: "NLS@NEUTRON-ASTROPORT-USDC_NOBLE",
        image: neutron,
        hold: ["NEUTRON-ASTROPORT-USDC_AXELAR", "NEUTRON-ASTROPORT-USDC_NOBLE"],
        name: "Neutron"
      }
    },
    protocolConfig: {
      "OSMOSIS-OSMOSIS-USDC_AXELAR": {
        currencies: ["USDC_AXELAR", "WETH_AXELAR", "WBTC_AXELAR"],
        stable: "USDC_AXELAR",
        lease: false,
        type: PositionTypes.long,
        rewards: false,
        supply: false
      },
      "NEUTRON-ASTROPORT-USDC_AXELAR": {
        lease: false,
        currencies: ["USDC_AXELAR"],
        stable: "USDC_AXELAR",
        type: PositionTypes.long,
        rewards: false,
        supply: false
      },
      "NEUTRON-ASTROPORT-USDC_NOBLE": {
        lease: true,
        currencies: [],
        stable: "USDC_NOBLE",
        type: PositionTypes.long,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-USDC_NOBLE": {
        lease: true,
        currencies: [],
        stable: "USDC_NOBLE",
        type: PositionTypes.long,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-ST_ATOM": {
        only: [],
        lease: false,
        currencies: [],
        stable: "USDC_NOBLE",
        type: PositionTypes.short,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-ALL_BTC": {
        only: [],
        lease: true,
        currencies: [],
        stable: "USDC_NOBLE",
        type: PositionTypes.short,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-ALL_SOL": {
        only: [],
        lease: false,
        currencies: [],
        stable: "USDC_NOBLE",
        type: PositionTypes.short,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-ATOM": {
        only: [],
        lease: true,
        currencies: [],
        stable: "USDC_NOBLE",
        type: PositionTypes.short,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-OSMO": {
        only: [],
        lease: true,
        currencies: [],
        stable: "USDC_NOBLE",
        type: PositionTypes.short,
        rewards: true,
        supply: true
      },
      "OSMOSIS-OSMOSIS-AKT": {
        only: [],
        lease: true,
        currencies: [],
        type: PositionTypes.short,
        stable: "USDC_NOBLE",
        rewards: true,
        supply: true
      }
    },
    dispatcher: {
      instance: "nolus14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0k0puz",
      codeId: ""
    },
    admin: {
      instance: "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd",
      codeId: "",
      ignoreProtocols: []
    }
  }
};

export const Contracts = CONTRACTS[network];
export const ProtocolsConfig = Contracts.protocolConfig;

export const TIP = {
  amount: 0,
  denom: NATIVE_ASSET.denom
};

export const DefaultProtocolFilter = "OSMOSIS";

export const SORT_PROTOCOLS = [
  "OSMOSIS-OSMOSIS-ALL_BTC",
  "OSMOSIS-OSMOSIS-ALL_SOL",
  "OSMOSIS-OSMOSIS-ATOM",
  "OSMOSIS-OSMOSIS-OSMO",
  "OSMOSIS-OSMOSIS-USDC_NOBLE",
  "NEUTRON-ASTROPORT-USDC_NOBLE",
  "OSMOSIS-OSMOSIS-ST_ATOM",
  "OSMOSIS-OSMOSIS-AKT",
  "OSMOSIS-OSMOSIS-USDC_AXELAR",
  "NEUTRON-ASTROPORT-USDC_AXELAR"
];
