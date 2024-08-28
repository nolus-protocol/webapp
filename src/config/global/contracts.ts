import type { ContractConfig } from "@/common/types";
import { ProtocolsRila, ProtocolsPirin } from "@nolus/nolusjs/build/types/Networks";
import { NATIVE_ASSET } from "./network";

export const CONTRACTS: ContractConfig = {
  testnet: {
    protocols: ProtocolsRila,
    dispatcher: {
      instance: "nolus1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrqrr2r7y",
      codeId: ""
    },
    admin: {
      instance: "nolus17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsmc5xhq",
      codeId: "",
      ignoreProtocols: ["OSMOSIS-OSMOSIS-USDC_NOBLE", "OSMOSIS-OSMOSIS-USDC_AXELAR", "osmosis-axlusdc"]
    }
  },
  mainnet: {
    protocols: ProtocolsPirin,
    dispatcher: {
      instance: "nolus14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0k0puz",
      codeId: ""
    },
    admin: {
      instance: "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd",
      codeId: "",
      ignoreProtocols: ["OSMOSIS-OSMOSIS-ST_ATOM"]
    }
  }
};

export enum PositionTypes {
  long = "long",
  short = "short"
}

export const ProtocolsConfig: {
  [key: string]: {
    only: string[];
    currencies: string[];
    lease: boolean;
    ignoreNetowrk: string[];
    type: PositionTypes;
    rewards: boolean;
  };
} = {
  "OSMOSIS-OSMOSIS-OSMO": {
    only: ["NLS"],
    lease: true,
    currencies: ["NLS", "OSMO", "USDC_AXELAR", "ATOM", "AKT", "JUNO"],
    ignoreNetowrk: ["NEUTRON"],
    type: PositionTypes.short,
    rewards: true
  },
  "NEUTRON-ASTROPORT-USDC_AXL": {
    only: [],
    lease: true,
    currencies: ["NTRN", "USDC_AXELAR", "DYDX", "ST_TIA", "STK_ATOM", "ATOM"],
    ignoreNetowrk: ["OSMOSIS"],
    type: PositionTypes.long,
    rewards: true
  },
  "OSMOSIS-OSMOSIS-USDC_AXELAR": {
    only: [],
    currencies: ["USDC_AXELAR"],
    lease: false,
    ignoreNetowrk: ["NEUTRON"],
    type: PositionTypes.long,
    rewards: false
  },
  "NEUTRON-ASTROPORT-USDC_AXELAR": {
    only: [],
    lease: false,
    currencies: ["USDC_AXELAR"],
    ignoreNetowrk: ["OSMOSIS"],
    type: PositionTypes.long,
    rewards: false
  },
  "NEUTRON-ASTROPORT-USDC_NOBLE": {
    only: [],
    lease: true,
    currencies: ["NTRN", "USDC_NOBLE", "DYDX", "ST_TIA", "STK_ATOM", "ATOM", "D_ATOM"],
    ignoreNetowrk: ["OSMOSIS"],
    type: PositionTypes.long,
    rewards: true
  },
  "OSMOSIS-OSMOSIS-USDC_NOBLE": {
    only: ["NLS", "ST_ATOM", "TIA"],
    lease: true,
    currencies: [
      "NLS",
      "OSMO",
      "ST_OSMO",
      "ATOM",
      "ST_ATOM",
      "USDC_NOBLE",
      "WETH_AXELAR",
      "WBTC_AXELAR",
      "AKT",
      "AXL",
      "JUNO",
      "EVMOS",
      "SCRT",
      "CRO",
      "TIA",
      "STARS",
      "Q_ATOM",
      "STRD",
      "MILK_TIA",
      "ST_TIA",
      "JKL",
      "DYM",
      "INJ",
      "LVN",
      "PICA",
      "CUDOS"
    ],
    ignoreNetowrk: ["NEUTRON"],
    type: PositionTypes.long,
    rewards: true
  }
};

export const isProtocolInclude = (currency: string) => {
  const networks = [];
  for (const key in ProtocolsConfig) {
    if (ProtocolsConfig[key].only.includes(currency)) {
      networks.push(key);
    }
  }
  return networks;
};

export const TIP = {
  amount: 100,
  denom: NATIVE_ASSET.denom
};
