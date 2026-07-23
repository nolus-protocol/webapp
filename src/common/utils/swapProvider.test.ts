import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import type { AppConfigResponse, NetworkInfo } from "@/common/api/types/config";
import { useConfigStore } from "@/common/stores/config";

// `getSwapProvider` resolves a protocolFilter (uppercase network key) to its
// network's chain_type and returns the matching provider: cosmos -> Skip
// (OSMOSIS, unchanged), svm -> the Solana router. An unknown network must yield
// a typed error, never a silent Skip fallback.
import { getSwapProvider, UnknownSwapNetworkError } from "./swapProvider";

// A cosmos network keyed by its uppercase filter, matching the backend shape
// pinned in src/networks/config.test.ts.
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
  explorer: "https://www.mintscan.io/osmosis"
} as unknown as NetworkInfo;

const SOLANA = {
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
  program_id: "NoLuSpRoGrAm1111111111111111111111111111111",
  transfer_channel_id: "channel-0",
  explorer_url_pattern: "https://solscan.io/tx/{txHash}"
} as unknown as NetworkInfo;

function seedNetworks(networks: NetworkInfo[]): void {
  const configStore = useConfigStore();
  configStore.config = { networks } as unknown as AppConfigResponse;
}

beforeEach(() => {
  setActivePinia(createPinia());
  localStorage.clear();
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("getSwapProvider", () => {
  it("returns_the_skip_provider_for_a_cosmos_network", () => {
    seedNetworks([OSMOSIS]);
    expect(getSwapProvider("OSMOSIS").id).toBe("skip");
  });

  it("returns_the_solana_provider_for_an_svm_network", () => {
    seedNetworks([SOLANA]);
    expect(getSwapProvider("SOLANA").id).toBe("solana");
  });

  it("throws_a_typed_error_for_an_unknown_network", () => {
    seedNetworks([OSMOSIS, SOLANA]);
    expect(() => getSwapProvider("MARS")).toThrow(UnknownSwapNetworkError);
  });

  it("throws_for_the_empty_protocol_filter_rather_than_defaulting_to_skip", () => {
    seedNetworks([OSMOSIS, SOLANA]);
    expect(() => getSwapProvider("")).toThrow(UnknownSwapNetworkError);
  });
});
