import { describe, it, expect, vi, beforeEach } from "vitest";

// getNetworkData()'s only dependency is the config store (source of the network
// list) + the per-network Keplr embedders. Mock both at that boundary: the store
// is stubbed so each test drives the exact network list, and the embedders are
// stubbed so the module loads without the chain-constant graph. getNetworkData
// itself is the real unit under test.
const hoisted = vi.hoisted(() => ({ networks: [] as Record<string, unknown>[] }));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({
    get networks() {
      return hoisted.networks;
    },
    getCurrenciesForNetwork: () => ({})
  })
}));
vi.mock("./list/nolus/constants", () => ({ embedChainInfo: () => ({}) }));
vi.mock("./list/osmosis/constants", () => ({ embedChainInfo: () => ({}) }));
vi.mock("./list/neutron/constants", () => ({ embedChainInfo: () => ({}) }));

import { getNetworkData } from "./config";

const OSMOSIS = {
  key: "OSMOSIS",
  value: "osmosis",
  name: "Osmosis",
  prefix: "osmo",
  symbol: "OSMO",
  chain_type: "cosmos",
  native: false,
  icon: "/assets/icons/networks/osmosis.svg",
  gas_price: "0.025uosmo",
  gas_multiplier: 3.5,
  explorer: "https://www.mintscan.io/osmosis",
  estimation: 20
};

// Matches the backend's served svm NetworkInfo shape: empty rpc/rest/gas,
// no cosmos `explorer`, and the three svm display fields.
const SOLANA_SVM = {
  key: "SOLANA",
  value: "solana",
  name: "Solana",
  prefix: "",
  symbol: "SOL",
  chain_type: "svm",
  native: false,
  icon: "/assets/icons/networks/solana.svg",
  rpc_url: "",
  rest_url: "",
  gas_price: "",
  gas_multiplier: 1.0,
  estimation: 5,
  program_id: "NoLuSpRoGrAm1111111111111111111111111111111",
  transfer_channel_id: "channel-0",
  explorer_url_pattern: "https://solscan.io/tx/{txHash}"
};

beforeEach(() => {
  hoisted.networks = [];
});

describe("getNetworkData — cosmos regression pin", () => {
  it("builds the cosmos supportedNetworks entry with the current data shape", () => {
    hoisted.networks = [OSMOSIS];
    const osmo = getNetworkData().supportedNetworks.OSMOSIS;
    if (osmo === undefined) throw new Error("expected an OSMOSIS supportedNetworks entry");
    // Whole-value on the data fields; the two function-valued fields
    // (`currencies`, `embedChainInfo`) are intentionally excluded here and
    // asserted to be callable in the next test.
    const { currencies: _currencies, embedChainInfo: _embedChainInfo, ...data } = osmo;
    expect(data).toEqual({
      prefix: "osmo",
      key: "OSMOSIS",
      name: "Osmosis",
      gasPrice: "0.025uosmo",
      explorer: "https://www.mintscan.io/osmosis",
      gasMultiplier: 3.5,
      bip44Path: "44'/118'/0'/0/0",
      ibcTransferTimeout: 60,
      ticker: "OSMO",
      fees: { transfer_amount: 500 }
    });
  });

  it("exposes cosmos currencies + embedChainInfo as callable functions", () => {
    hoisted.networks = [OSMOSIS];
    const osmo = getNetworkData().supportedNetworks.OSMOSIS;
    if (osmo === undefined) throw new Error("expected an OSMOSIS supportedNetworks entry");
    expect(typeof osmo.currencies === "function" && typeof osmo.embedChainInfo === "function").toBe(true);
  });

  it("includes the cosmos network in the picker list", () => {
    hoisted.networks = [OSMOSIS];
    expect(getNetworkData().list.map((n) => n.key)).toEqual(["OSMOSIS"]);
  });
});

describe("getNetworkData — svm network dispatch", () => {
  // Resolved: svm networks are excluded from both supportedNetworks and the
  // picker .list here; the picker wiring that would let them be selected lands
  // separately. These pins assert that exclusion, cosmos entries untouched.
  it("excludes an svm network from supportedNetworks, leaving cosmos entries intact", () => {
    hoisted.networks = [OSMOSIS, SOLANA_SVM];
    const { supportedNetworks } = getNetworkData();
    expect(supportedNetworks.SOLANA).toBeUndefined();
    expect(supportedNetworks.OSMOSIS).toBeDefined();
  });

  it("excludes an svm network from the picker .list, leaving cosmos entries intact", () => {
    hoisted.networks = [OSMOSIS, SOLANA_SVM];
    expect(getNetworkData().list.map((n) => n.key)).toEqual(["OSMOSIS"]);
  });

  // an svm entry must never trigger the
  // "No chain info embedder for network" throw.
  it("does not throw when an svm network is present alongside cosmos networks", () => {
    hoisted.networks = [OSMOSIS, SOLANA_SVM];
    expect(() => getNetworkData()).not.toThrow();
  });
});

describe("getNetworkData — unknown chain_type dispatch", () => {
  const UNKNOWN_CHAIN = {
    key: "MYSTERY",
    value: "mystery",
    name: "Mystery",
    prefix: "myst",
    symbol: "MYST",
    chain_type: "bogus",
    native: false,
    icon: "/assets/icons/networks/mystery.svg",
    gas_price: "0.025umyst",
    gas_multiplier: 2.0,
    explorer: "https://example.invalid",
    estimation: 20
  };

  // A network tagged with an unrecognized chain_type must not silently fall
  // through to the cosmos machinery; it is excluded from both sinks like svm.
  it("excludes an unknown chain_type from supportedNetworks, leaving cosmos entries intact", () => {
    hoisted.networks = [OSMOSIS, UNKNOWN_CHAIN];
    const { supportedNetworks } = getNetworkData();
    expect(supportedNetworks.MYSTERY).toBeUndefined();
    expect(supportedNetworks.OSMOSIS).toBeDefined();
  });

  it("excludes an unknown chain_type from the picker .list, leaving cosmos entries intact", () => {
    hoisted.networks = [OSMOSIS, UNKNOWN_CHAIN];
    expect(getNetworkData().list.map((n) => n.key)).toEqual(["OSMOSIS"]);
  });
});
