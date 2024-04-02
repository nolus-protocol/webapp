import type { ContractConfig } from "@/common/types";
import { ProtocolsRila, ProtocolsPirin } from "@nolus/nolusjs/build/types/Networks";
import { NATIVE_ASSET } from "./network";

export const CONTRACTS: ContractConfig = {
  testnet: {
    protocols: ProtocolsRila,
    dispatcher: {
      instance: "nolus1tqwwyth34550lg2437m05mjnjp8w7h5ka7m70jtzpxn4uh2ktsmqtctwnn",
      codeId: ""
    },
    admin: {
      instance: "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd",
      codeId: "",
      ignoreProtocols: ["OSMOSIS-OSMOSIS-USDC_NOBLE", "OSMOSIS-OSMOSIS-USDC_AXELAR", "osmosis-axlusdc"]
    }
  },
  mainnet: {
    protocols: ProtocolsPirin,
    dispatcher: {
      instance: "nolus1tqwwyth34550lg2437m05mjnjp8w7h5ka7m70jtzpxn4uh2ktsmqtctwnn",
      codeId: ""
    },
    admin: {
      instance: "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd",
      codeId: "",
      ignoreProtocols: ["OSMOSIS-OSMOSIS-USDC_NOBLE"]
    }
  }
};

export const ProtocolsConfig: {
  [key: string]: {
    hidden: string[];
    only: string[];
    ignoreNetowrk: string[];
  };
} = {
  "OSMOSIS-OSMOSIS-USDC-1": {
    only: ["NLS", "ATOM", "ST_ATOM", "TIA"],
    hidden: [],
    ignoreNetowrk: ["NEUTORN"]
  },
  "OSMOSIS-OSMOSIS-USDC_AXELAR": {
    only: ["NLS", "ATOM", "ST_ATOM", "TIA"],
    hidden: [],
    ignoreNetowrk: ["NEUTRON"]
  },
  "OSMOSIS-OSMOSIS-USDC_NOBLE": {
    only: [],
    hidden: [],
    ignoreNetowrk: ["NEUTRON"]
  },
  "NEUTRON-ASTROPORT-USDC_AXELAR": {
    only: [],
    hidden: ["ATOM", "ST_ATOM", "TIA"],
    ignoreNetowrk: ["OSMOSIS"]
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
