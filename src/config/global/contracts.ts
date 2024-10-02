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
    longDefault: "OSMO@OSMOSIS-OSMOSIS-USDC_AXELAR",
    ignoreProtocolsInEarn: [],
    protocols: ProtocolsRila,
    protocolConfig: {
      "NEUTRON-ASTROPORT-USDC_AXL": {
        lease: true,
        currencies: ["NTRN", "USDC_AXELAR", "ATOM"],
        type: PositionTypes.long,
        rewards: true
      },
      "OSMOSIS-OSMOSIS-USDC_AXELAR": {
        currencies: ["NLS", "OSMO", "USDC_AXELAR", "ATOM", "AKT", "JUNO"],
        lease: true,
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
    longDefault: "OSMO@OSMOSIS-OSMOSIS-USDC_NOBLE",
    ignoreProtocolsInEarn: [],
    protocols: ProtocolsPirin,
    protocolConfig: {
      "OSMOSIS-OSMOSIS-USDC_AXELAR": {
        currencies: ["USDC_AXELAR"],
        lease: false,
        type: PositionTypes.long,
        rewards: false
      },
      "NEUTRON-ASTROPORT-USDC_AXELAR": {
        lease: false,
        currencies: ["USDC_AXELAR"],
        type: PositionTypes.long,
        rewards: false
      },
      "NEUTRON-ASTROPORT-USDC_NOBLE": {
        lease: true,
        currencies: ["NTRN", "USDC_NOBLE", "DYDX", "ST_TIA", "STK_ATOM", "ATOM", "D_ATOM"],
        type: PositionTypes.long,
        rewards: false
      },
      "OSMOSIS-OSMOSIS-USDC_NOBLE": {
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
        type: PositionTypes.long,
        rewards: false
      },
      "OSMOSIS-OSMOSIS-ST_ATOM": {
        only: [],
        lease: true,
        currencies: ["ATOM", "USDC_NOBLE", "OSMO", "ST_OSMO", "AKT", "AXL", "ST_ATOM"],
        type: PositionTypes.short,
        rewards: false
      }
    },
    dispatcher: {
      instance: "nolus14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0k0puz",
      codeId: ""
    },
    admin: {
      instance: "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd",
      codeId: "",
      ignoreProtocols: ["OSMOSIS-OSMOSIS-ALL_BTC", "OSMOSIS-OSMOSIS-ALL_SOL", "OSMOSIS-OSMOSIS-AKT"]
    }
  }
};

export const Contracts = CONTRACTS[network];
export const ProtocolsConfig = Contracts.protocolConfig;

export const TIP = {
  amount: 100,
  denom: NATIVE_ASSET.denom
};
