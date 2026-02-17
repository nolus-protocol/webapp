import { ProtocolsPirin, ProtocolsRila } from "@nolus/nolusjs/build/types/Networks";

interface ContractsConfig {
  dispatcher: { instance: string };
  admin: { instance: string };
  protocols: Record<string, string>;
}

export const CONTRACTS: Record<string, ContractsConfig> = {
  testnet: {
    dispatcher: {
      instance: "nolus1nc5tatafv6eyq7llkr2gv50ff9e22mnf70qgjlv737ktmt4eswrqrr2r7y"
    },
    admin: {
      instance: "nolus17p9rzwnnfxcjp32un9ug7yhhzgtkhvl9jfksztgw5uh69wac2pgsmc5xhq"
    },
    protocols: ProtocolsRila
  },
  mainnet: {
    dispatcher: {
      instance: "nolus14hj2tavq8fpesdwxxcu44rty3hh90vhujrvcmstl4zr3txmfvw9s0k0puz"
    },
    admin: {
      instance: "nolus1gurgpv8savnfw66lckwzn4zk7fp394lpe667dhu7aw48u40lj6jsqxf8nd"
    },
    protocols: ProtocolsPirin
  }
};

export const DefaultProtocolFilter = "OSMOSIS";

//add deleted protocols
export const SORT_PROTOCOLS = [
  "OSMOSIS-OSMOSIS-USDC_NOBLE",
  "OSMOSIS-OSMOSIS-ALL_BTC",
  "OSMOSIS-OSMOSIS-ALL_SOL",
  "OSMOSIS-OSMOSIS-ATOM",
  "OSMOSIS-OSMOSIS-OSMO",
  "OSMOSIS-OSMOSIS-AKT",
  "OSMOSIS-OSMOSIS-USDC_AXELAR",
  "NEUTRON-ASTROPORT-USDC_NOBLE",
  "NEUTRON-ASTROPORT-USDC_AXELAR"
];

export const SORT_LEASE = ["ALL_BTC", "ALL_ETH", "ATOM"];
