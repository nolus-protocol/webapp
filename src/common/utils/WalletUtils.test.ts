import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Hoisted mock handles so vi.mock factories can reference them.
const mocks = vi.hoisted(() => ({
  isAddressValid: vi.fn(),
  getWalletAddress: vi.fn(),
  getWalletConnectMechanism: vi.fn(),
  fetchEndpoints: vi.fn(),
  walletGetInstance: vi.fn()
}));

// @nolus/nolusjs — only KeyUtils.isAddressValid is used by WalletUtils.
vi.mock("@nolus/nolusjs", () => ({
  KeyUtils: {
    isAddressValid: mocks.isAddressValid
  }
}));

// WalletUtils.ts imports `{ WalletManager }` from "." (the utils barrel index.ts).
// Loading the barrel pulls in ThemeManager which calls window.matchMedia at import time
// (not available in jsdom by default). We mock the barrel with just the one symbol we need.
vi.mock(".", () => ({
  WalletManager: {
    getWalletAddress: mocks.getWalletAddress,
    getWalletConnectMechanism: mocks.getWalletConnectMechanism
  }
}));

// EndpointService is imported directly by file path.
vi.mock("./EndpointService", () => ({
  fetchEndpoints: mocks.fetchEndpoints
}));

// @/networks — Wallet.getInstance + NETWORK_DATA.supportedNetworks[key].key
vi.mock("@/networks", () => ({
  Wallet: {
    getInstance: mocks.walletGetInstance
  },
  NETWORK_DATA: {
    supportedNetworks: {
      NOLUS: { key: "NOLUS" },
      OSMOSIS: { key: "OSMOSIS" }
    }
  }
}));

// Import under test AFTER mocks are declared.
import { WalletUtils } from "./WalletUtils";

describe("WalletUtils.isAuth", () => {
  beforeEach(() => {
    mocks.isAddressValid.mockReset();
    mocks.getWalletAddress.mockReset();
    mocks.getWalletConnectMechanism.mockReset();
  });

  it("should return true when address is valid and mechanism is not null", () => {
    mocks.getWalletAddress.mockReturnValue("nolus1abc");
    mocks.isAddressValid.mockReturnValue(true);
    mocks.getWalletConnectMechanism.mockReturnValue("keplr");
    expect(WalletUtils.isAuth()).toBe(true);
    expect(mocks.isAddressValid).toHaveBeenCalledWith("nolus1abc");
  });

  it("should return false when address is invalid", () => {
    mocks.getWalletAddress.mockReturnValue("");
    mocks.isAddressValid.mockReturnValue(false);
    mocks.getWalletConnectMechanism.mockReturnValue("keplr");
    expect(WalletUtils.isAuth()).toBe(false);
  });

  it("should return false when connect mechanism is null", () => {
    mocks.getWalletAddress.mockReturnValue("nolus1abc");
    mocks.isAddressValid.mockReturnValue(true);
    mocks.getWalletConnectMechanism.mockReturnValue(null);
    expect(WalletUtils.isAuth()).toBe(false);
  });

  it("should return false when both checks fail", () => {
    mocks.getWalletAddress.mockReturnValue("");
    mocks.isAddressValid.mockReturnValue(false);
    mocks.getWalletConnectMechanism.mockReturnValue(null);
    expect(WalletUtils.isAuth()).toBe(false);
  });
});

describe("WalletUtils.getKeplr", () => {
  const w = window as unknown as { keplr?: unknown };

  beforeEach(() => {
    delete w.keplr;
  });

  afterEach(() => {
    delete w.keplr;
    vi.restoreAllMocks();
  });

  it("should return window.keplr when extension is already set", async () => {
    const fakeKeplr = { marker: "keplr-instance" };
    w.keplr = fakeKeplr;
    const result = await WalletUtils.getKeplr();
    expect(result).toBe(fakeKeplr);
  });

  it("should return the extension when document is complete and extension becomes available", async () => {
    // No w.keplr set; document.readyState in jsdom is "complete" by default.
    // The code path then does Promise.resolve(w[prop]) — returns undefined here.
    expect(document.readyState).toBe("complete");
    const result = await WalletUtils.getKeplr();
    expect(result).toBeUndefined();
  });

  it("should wait for readystatechange when document is not complete, then resolve with current w.keplr", async () => {
    // Override document.readyState to "loading" for this test.
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "readyState");
    Object.defineProperty(document, "readyState", {
      configurable: true,
      get: () => "loading"
    });

    try {
      const promise = WalletUtils.getKeplr();

      // Flip readyState to "complete" and dispatch the event that the listener watches.
      Object.defineProperty(document, "readyState", {
        configurable: true,
        get: () => "complete"
      });
      const fakeKeplr = { marker: "delayed-keplr" };
      w.keplr = fakeKeplr;
      document.dispatchEvent(new Event("readystatechange"));

      const result = await promise;
      expect(result).toBe(fakeKeplr);
    } finally {
      // Restore original descriptor so other tests aren't affected.
      if (originalDescriptor) {
        Object.defineProperty(Document.prototype, "readyState", originalDescriptor);
      }
    }
  });
});

describe("WalletUtils.getLeap", () => {
  const w = window as unknown as { leap?: unknown };

  beforeEach(() => {
    delete w.leap;
  });

  afterEach(() => {
    delete w.leap;
    vi.restoreAllMocks();
  });

  it("should return window.leap when extension is already set", async () => {
    const fakeLeap = { marker: "leap-instance" };
    w.leap = fakeLeap;
    const result = await WalletUtils.getLeap();
    expect(result).toBe(fakeLeap);
  });

  it("should return undefined when document is complete and extension is absent", async () => {
    expect(document.readyState).toBe("complete");
    const result = await WalletUtils.getLeap();
    expect(result).toBeUndefined();
  });

  it("should wait for readystatechange when document is not complete", async () => {
    const originalDescriptor = Object.getOwnPropertyDescriptor(Document.prototype, "readyState");
    Object.defineProperty(document, "readyState", {
      configurable: true,
      get: () => "loading"
    });

    try {
      const promise = WalletUtils.getLeap();

      Object.defineProperty(document, "readyState", {
        configurable: true,
        get: () => "complete"
      });
      const fakeLeap = { marker: "delayed-leap" };
      w.leap = fakeLeap;
      document.dispatchEvent(new Event("readystatechange"));

      const result = await promise;
      expect(result).toBe(fakeLeap);
    } finally {
      if (originalDescriptor) {
        Object.defineProperty(Document.prototype, "readyState", originalDescriptor);
      }
    }
  });
});

describe("WalletUtils.getWallet", () => {
  beforeEach(() => {
    mocks.fetchEndpoints.mockReset();
    mocks.walletGetInstance.mockReset();
  });

  it("should fetch endpoints by network key and call Wallet.getInstance with node.rpc and node.api", async () => {
    const fakeNode = { rpc: "https://rpc.example", api: "https://api.example" };
    const fakeWallet = { marker: "wallet" };
    mocks.fetchEndpoints.mockResolvedValue(fakeNode);
    mocks.walletGetInstance.mockResolvedValue(fakeWallet);

    const result = await WalletUtils.getWallet("NOLUS");

    expect(mocks.fetchEndpoints).toHaveBeenCalledWith("NOLUS");
    expect(mocks.walletGetInstance).toHaveBeenCalledWith(fakeNode.rpc, fakeNode.api);
    expect(result).toBe(fakeWallet);
  });
});
