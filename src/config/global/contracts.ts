import type { ContractConfig } from "@/common/types";
import { NATIVE_ASSET } from "./network";
import { ProtocolsPirin, ProtocolsRila } from "@nolus/nolusjs/build/types/Networks";
import { EnvNetworkUtils } from "@/common/utils";

const network = EnvNetworkUtils.getStoredNetworkName();

export enum PositionTypes {
  long = "long",
  short = "short"
}

export const CONTRACTS: ContractConfig = {
  testnet: {
    protocols: ProtocolsRila,
    protocolConfig: {
      "NEUTRON-ASTROPORT-USDC_AXL": {
        only: [],
        lease: true,
        currencies: ["NTRN", "USDC_AXELAR", "DYDX", "ST_TIA", "STK_ATOM", "ATOM"],
        ignoreNetowrk: ["OSMOSIS"],
        type: PositionTypes.long,
        rewards: true
      },
      "OSMOSIS-OSMOSIS-USDC_AXELAR": {
        only: ["NLS"],
        currencies: ["NLS", "OSMO", "USDC_AXELAR", "ATOM", "AKT", "JUNO"],
        lease: true,
        ignoreNetowrk: ["NEUTRON"],
        type: PositionTypes.long,
        rewards: false
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
    protocols: ProtocolsPirin,
    protocolConfig: {
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
        currencies: ["NTRN", "USDC_NOBLE", "DYDX", "ST_TIA", "STK_ATOM", "ATOM"],
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

export const ProtocolsConfig = new Proxy(CONTRACTS[network].protocolConfig, {
  get(target, prop) {
    return target[prop as string];
  }
});

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
