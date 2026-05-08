/**
 * Wallet-driven network refactor — protocol-filter wiring contract.
 *
 * After the refactor, every successful wallet connect action MUST set
 * `configStore.protocolFilter` to the network the connected mechanism owns:
 *   - Keplr / Keplr-like → "OSMOSIS"
 *   - Phantom (EVM)      → "SOLANA"
 *   - Solflare (SOL)     → "SOLANA"
 *
 * Ledger is sunset and intentionally NOT wired — it must NOT call
 * setProtocolFilter at all (config-store keeps its current value).
 *
 * disconnect() clears the filter back to "" so the next connect's first
 * watcher tick sees a fresh slate.
 *
 * The setProtocolFilter spy is the contract surface we test here. The store
 * itself is verified separately by the config-store watcher tests.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";

// The actions barrel pulls in heavy modules transitively (ThemeManager via
// utils, IntercomService, network wallets). Keep this file focused on the
// protocol-filter wiring by stubbing ALL of those out — only the spy on
// setProtocolFilter should fire.
vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    (window as unknown as { matchMedia: unknown }).matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    });
  }
});

const setProtocolFilter = vi.fn();
vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({ setProtocolFilter })
}));

// EndpointService.fetchEndpoints is invoked by connectKeplrLike / connectLedger.
// Return a stub network config — the real one would hit the backend.
vi.mock("@/common/utils/EndpointService", () => ({
  fetchEndpoints: vi.fn().mockResolvedValue({
    rpc: "http://localhost:0/rpc",
    api: "http://localhost:0/api"
  })
}));

vi.mock("@/common/utils/IntercomService", () => ({
  IntercomService: { load: vi.fn(), disconnect: vi.fn() }
}));

vi.mock("@/networks/cosm/NolusWalletOverride", () => ({
  applyNolusWalletOverrides: vi.fn()
}));

vi.mock("@/config/global/keplr", () => ({
  KeplrEmbedChainInfo: vi.fn().mockReturnValue({})
}));

vi.mock("@nolus/nolusjs", () => ({
  ChainConstants: { CHAIN_KEY: "nolus", BECH32_PREFIX_ACC_ADDR: "nolus" },
  NolusClient: {
    setInstance: vi.fn(),
    getInstance: () => ({ getChainId: vi.fn().mockResolvedValue("nolus-1") })
  },
  NolusWalletFactory: {
    nolusOfflineSigner: vi.fn().mockResolvedValue({
      pubKey: "deadbeef",
      address: "nolus1abc",
      useAccount: vi.fn().mockResolvedValue(undefined)
    }),
    nolusLedgerWallet: vi.fn().mockResolvedValue({
      pubKey: "ledgerpubkey",
      address: "nolus1ledger",
      useAccount: vi.fn().mockResolvedValue(undefined)
    })
  }
}));

// WalletManager has localStorage side-effects. Stub the static surface we
// touch so we don't pollute jsdom localStorage between tests.
vi.mock("@/common/utils", async () => {
  const actual = await vi.importActual<typeof import("@/common/utils")>("@/common/utils");
  return {
    ...actual,
    WalletManager: {
      ...actual.WalletManager,
      saveWalletConnectMechanism: vi.fn(),
      setPubKey: vi.fn(),
      getWalletConnectMechanism: vi.fn().mockReturnValue(null)
    }
  };
});

// SolanaWallet — both Phantom and Solflare connect actions construct one.
// Capture the `provider` ctor arg per call so the assertions below can verify
// connectPhantom passes "phantom" and connectSolflare passes "solflare".
const solanaWalletCtor = vi.fn();
vi.mock("@/networks/sol", () => ({
  SolanaWallet: vi.fn().mockImplementation((...args: unknown[]) => {
    solanaWalletCtor(...args);
    return {
      connect: vi.fn().mockResolvedValue({ pubkeyAny: new Uint8Array([4, 5, 6]) }),
      makeWCOfflineSigner: vi.fn().mockReturnValue({})
    };
  })
}));

// Ledger transports never run in jsdom. Stub create() to a minimal object.
vi.mock("@ledgerhq/hw-transport-web-ble", () => ({
  default: { create: vi.fn().mockResolvedValue({ close: vi.fn() }) }
}));
vi.mock("@ledgerhq/hw-transport-webusb", () => ({
  default: { create: vi.fn().mockResolvedValue({ close: vi.fn() }) }
}));
vi.mock("@cosmjs/ledger-amino", () => ({
  LedgerSigner: vi.fn().mockImplementation(() => ({}))
}));
vi.mock("@cosmjs/amino", () => ({
  makeCosmoshubPath: vi.fn().mockReturnValue([])
}));

import { WalletConnectMechanism } from "@/common/types";
import { connectKeplrLike } from "./connectKeplrLike";
import { connectPhantom } from "./connectPhantom";
import { connectSolflare } from "./connectSolflare";
import { connectLedger } from "./connectLedger";
import { disconnect } from "./disconnect";
import type { Store } from "../types";

beforeEach(() => {
  setProtocolFilter.mockClear();
  solanaWalletCtor.mockClear();
  localStorage.clear();
});

/** Minimal Store-shaped object — enough to be passed as `this` / first arg. */
function makeStore(): Store {
  return {
    wallet: undefined,
    vest: [],
    delegated_vesting: undefined,
    delegated_free: undefined,
    apr: 0,
    $patch: vi.fn()
  } as unknown as Store;
}

/** Stub keplr/keplr-like extension that exposes the surface connectKeplrLike needs. */
function makeKeplrExtension() {
  return {
    getOfflineSignerOnlyAmino: vi.fn().mockReturnValue({}),
    experimentalSuggestChain: vi.fn().mockResolvedValue(undefined),
    enable: vi.fn().mockResolvedValue(undefined)
  } as unknown as Parameters<typeof connectKeplrLike>[1] extends () => Promise<infer T> ? T : never;
}

describe("connectKeplrLike (Keplr success path)", () => {
  it("sets protocolFilter to OSMOSIS exactly once on success", async () => {
    const store = makeStore();
    const extension = makeKeplrExtension();
    await connectKeplrLike(
      store,
      async () =>
        extension as unknown as Parameters<typeof connectKeplrLike>[1] extends () => Promise<infer T> ? T : never,
      WalletConnectMechanism.KEPLR,
      "Keplr"
    );

    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("OSMOSIS");
  });
});

describe("connectPhantom", () => {
  it("sets protocolFilter to SOLANA exactly once on success", async () => {
    const store = makeStore();
    await connectPhantom.call(store);

    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("SOLANA");
  });

  it("constructs SolanaWallet with provider='phantom'", async () => {
    const store = makeStore();
    await connectPhantom.call(store);

    expect(solanaWalletCtor).toHaveBeenCalledTimes(1);
    expect(solanaWalletCtor).toHaveBeenCalledWith("phantom");
  });
});

describe("connectSolflare", () => {
  it("sets protocolFilter to SOLANA exactly once on success", async () => {
    const store = makeStore();
    await connectSolflare.call(store);

    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("SOLANA");
  });

  it("constructs SolanaWallet with provider='solflare'", async () => {
    const store = makeStore();
    await connectSolflare.call(store);

    expect(solanaWalletCtor).toHaveBeenCalledTimes(1);
    expect(solanaWalletCtor).toHaveBeenCalledWith("solflare");
  });
});

describe("connectLedger (sunset, intentionally unwired)", () => {
  it("does NOT call setProtocolFilter on success", async () => {
    const store = makeStore();
    await connectLedger.call(store, {});

    expect(setProtocolFilter).not.toHaveBeenCalled();
  });
});

describe("disconnect", () => {
  it("calls setProtocolFilter('') to clear the filter", () => {
    const store = makeStore();
    store.wallet = { address: "nolus1abc" } as unknown as Store["wallet"];
    disconnect.call(store);

    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("");
  });
});
