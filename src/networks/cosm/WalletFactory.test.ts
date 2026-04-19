import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Shared state for the mocks — hoisted so they exist before the vi.mock
// factories (which are themselves hoisted to the top of the module).
const {
  baseWalletCtor,
  metamaskConnectCustom,
  metamaskMakeWCOfflineSigner,
  solanaConnectCustom,
  solanaMakeWCOfflineSigner,
  fetchEndpointsMock,
  walletManagerMock,
  walletUtilsMock,
  bluetoothCreateMock,
  webusbCreateMock
} = vi.hoisted(() => ({
  baseWalletCtor: vi.fn(),
  metamaskConnectCustom: vi.fn().mockResolvedValue(undefined),
  metamaskMakeWCOfflineSigner: vi.fn(() => ({ type: "evm", chainId: "nolus-1", getAccounts: async () => [] })),
  solanaConnectCustom: vi.fn().mockResolvedValue(undefined),
  solanaMakeWCOfflineSigner: vi.fn(() => ({ type: "svm", chainId: "nolus-1", getAccounts: async () => [] })),
  fetchEndpointsMock: vi.fn().mockResolvedValue({ rpc: "r", api: "a" }),
  walletManagerMock: { getWalletConnectMechanism: vi.fn(() => undefined) },
  walletUtilsMock: { getKeplr: vi.fn(), getLeap: vi.fn() },
  bluetoothCreateMock: vi.fn().mockResolvedValue({ type: "ble-transport" }),
  webusbCreateMock: vi.fn().mockResolvedValue({ type: "usb-transport" })
}));

// Mock BaseWallet so we don't spin up SigningCosmWasmClient.
vi.mock("./BaseWallet", () => {
  return {
    BaseWallet: class FakeBaseWallet {
      args: unknown[];
      address?: string;
      useAccount = vi.fn().mockResolvedValue(true);
      constructor(...args: unknown[]) {
        this.args = args;
        baseWalletCtor(...args);
      }
    }
  };
});

vi.mock("../evm", () => ({
  MetaMaskWallet: class {
    connectCustom = metamaskConnectCustom;
    makeWCOfflineSigner = metamaskMakeWCOfflineSigner;
  }
}));

vi.mock("../sol", () => ({
  SolanaWallet: class {
    connectCustom = solanaConnectCustom;
    makeWCOfflineSigner = solanaMakeWCOfflineSigner;
  }
}));

vi.mock("@/common/utils/EndpointService", () => ({
  fetchEndpoints: (...args: unknown[]) => fetchEndpointsMock(...args)
}));

vi.mock("@/common/utils", () => ({
  WalletManager: walletManagerMock,
  WalletUtils: walletUtilsMock,
  Logger: { error: vi.fn() }
}));

// Ledger transport mocks — don't attempt real hardware/bluetooth connection.
vi.mock("@ledgerhq/hw-transport-web-ble", () => ({
  default: { create: (...args: unknown[]) => bluetoothCreateMock(...args) }
}));

vi.mock("@ledgerhq/hw-transport-webusb", () => ({
  default: { create: (...args: unknown[]) => webusbCreateMock(...args) }
}));

vi.mock("@cosmjs/ledger-amino", () => ({
  LedgerSigner: class {
    transport: unknown;
    opts: unknown;
    constructor(transport: unknown, opts: unknown) {
      this.transport = transport;
      this.opts = opts;
    }
    async getAccounts() {
      return [];
    }
  }
}));

import {
  authenticateKeplr,
  authenticateLeap,
  authenticateLedger,
  authenticateEvmPhantom,
  authenticateSolFlare
} from "./WalletFactory";
import type { NetworkData } from "@/common/types";

function fakeWallet(chainId = "nolus-1") {
  return {
    rpc: "rpc-url",
    api: "api-url",
    getTendermintClient: vi.fn(() => ({ kind: "comet" })),
    getChainId: vi.fn().mockResolvedValue(chainId)
  } as unknown as Parameters<typeof authenticateKeplr>[0];
}

function fakeNetwork(overrides: Partial<NetworkData> = {}): NetworkData {
  return {
    key: "nolus",
    prefix: "nolus",
    gasMultiplier: 1.4,
    gasPrice: "0.025unls",
    explorer: "https://explorer",
    embedChainInfo: vi.fn(() => ({})),
    ...overrides
  } as unknown as NetworkData;
}

describe("WalletFactory", () => {
  beforeEach(() => {
    baseWalletCtor.mockClear();
    metamaskConnectCustom.mockClear();
    metamaskMakeWCOfflineSigner.mockClear();
    solanaConnectCustom.mockClear();
    solanaMakeWCOfflineSigner.mockClear();
    bluetoothCreateMock.mockClear();
    webusbCreateMock.mockClear();
    walletManagerMock.getWalletConnectMechanism.mockReturnValue(undefined);
    walletUtilsMock.getKeplr.mockReset();
    walletUtilsMock.getLeap.mockReset();
    fetchEndpointsMock.mockReset();
    fetchEndpointsMock.mockResolvedValue({ rpc: "r", api: "a" });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("authenticateKeplr", () => {
    it("throws when Keplr is not installed", async () => {
      walletUtilsMock.getKeplr.mockResolvedValue(undefined);
      await expect(authenticateKeplr(fakeWallet(), fakeNetwork())).rejects.toThrow(/Keplr wallet is not installed/);
    });

    it("throws when Keplr lacks experimentalSuggestChain", async () => {
      walletUtilsMock.getKeplr.mockResolvedValue({
        getOfflineSignerAuto: vi.fn(),
        experimentalSuggestChain: undefined
      });
      await expect(authenticateKeplr(fakeWallet(), fakeNetwork())).rejects.toThrow(/version is not latest/);
    });

    it("wraps network fetch failures with 'Failed to fetch suggest chain.'", async () => {
      walletUtilsMock.getKeplr.mockResolvedValue({
        getOfflineSignerAuto: vi.fn(),
        experimentalSuggestChain: vi.fn().mockRejectedValue(new Error("network unreachable")),
        enable: vi.fn()
      });

      await expect(authenticateKeplr(fakeWallet(), fakeNetwork())).rejects.toThrow(/Failed to fetch suggest chain/);
    });

    it("happy path: suggestChain + enable + builds a BaseWallet with the right args", async () => {
      const offlineSigner = { getAccounts: async () => [] };
      walletUtilsMock.getKeplr.mockResolvedValue({
        getOfflineSignerAuto: vi.fn().mockResolvedValue(offlineSigner),
        experimentalSuggestChain: vi.fn().mockResolvedValue(undefined),
        enable: vi.fn().mockResolvedValue(undefined)
      });

      const network = fakeNetwork({
        prefix: "nolus",
        gasMultiplier: 1.5,
        gasPrice: "0.025unls",
        explorer: "https://e"
      });
      const wallet = fakeWallet("nolus-1");
      const bw = await authenticateKeplr(wallet, network);

      expect(baseWalletCtor).toHaveBeenCalledTimes(1);
      // BaseWallet ctor arg order: (tm, signer, opts, rpc, api, prefix, gasMultiplier, gasPrice, explorer)
      const args = baseWalletCtor.mock.calls[0];
      expect(args[1]).toBe(offlineSigner);
      expect(args[3]).toBe("rpc-url");
      expect(args[4]).toBe("api-url");
      expect(args[5]).toBe("nolus");
      expect(args[6]).toBe(1.5);
      expect(args[7]).toBe("0.025unls");
      expect(args[8]).toBe("https://e");

      // useAccount() was called during createWallet
      const instance = bw as unknown as { useAccount: ReturnType<typeof vi.fn> };
      expect(instance.useAccount).toHaveBeenCalledTimes(1);
    });
  });

  describe("authenticateLeap", () => {
    it("throws when Leap is not installed (label reflects leap)", async () => {
      walletUtilsMock.getLeap.mockResolvedValue(undefined);
      await expect(authenticateLeap(fakeWallet(), fakeNetwork())).rejects.toThrow(/Leap wallet is not installed/);
    });

    it("happy path builds a BaseWallet", async () => {
      const offlineSigner = { getAccounts: async () => [] };
      walletUtilsMock.getLeap.mockResolvedValue({
        getOfflineSignerAuto: vi.fn().mockResolvedValue(offlineSigner),
        experimentalSuggestChain: vi.fn().mockResolvedValue(undefined),
        enable: vi.fn().mockResolvedValue(undefined)
      });

      await authenticateLeap(fakeWallet(), fakeNetwork());
      expect(baseWalletCtor).toHaveBeenCalledTimes(1);
    });
  });

  describe("authenticateLedger", () => {
    it("uses WebUSB transport by default", async () => {
      await authenticateLedger(fakeWallet(), fakeNetwork());
      expect(webusbCreateMock).toHaveBeenCalledTimes(1);
      expect(bluetoothCreateMock).not.toHaveBeenCalled();
      expect(baseWalletCtor).toHaveBeenCalledTimes(1);
    });

    it("uses Bluetooth transport when mechanism == LEDGER_BLUETOOTH", async () => {
      walletManagerMock.getWalletConnectMechanism.mockReturnValue("ledger_bluetooth");
      await authenticateLedger(fakeWallet(), fakeNetwork());
      expect(bluetoothCreateMock).toHaveBeenCalledTimes(1);
      expect(webusbCreateMock).not.toHaveBeenCalled();
    });
  });

  describe("authenticateEvmPhantom", () => {
    it("creates MetaMaskWallet, connectCustom, passes WC signer to BaseWallet", async () => {
      await authenticateEvmPhantom(fakeWallet(), fakeNetwork());
      expect(fetchEndpointsMock).toHaveBeenCalledWith("nolus");
      expect(metamaskConnectCustom).toHaveBeenCalledTimes(1);
      expect(metamaskMakeWCOfflineSigner).toHaveBeenCalledTimes(1);
      // The BaseWallet signer arg is the WC signer from MetaMask
      expect(baseWalletCtor.mock.calls[0][1].type).toBe("evm");
    });
  });

  describe("authenticateSolFlare", () => {
    it("creates SolanaWallet and passes its WC signer to BaseWallet", async () => {
      await authenticateSolFlare(fakeWallet(), fakeNetwork());
      expect(solanaConnectCustom).toHaveBeenCalledTimes(1);
      expect(solanaMakeWCOfflineSigner).toHaveBeenCalledTimes(1);
      expect(baseWalletCtor.mock.calls[0][1].type).toBe("svm");
    });

    it("solflare errors during connectCustom propagate", async () => {
      solanaConnectCustom.mockRejectedValueOnce(new Error("user denied"));
      await expect(authenticateSolFlare(fakeWallet(), fakeNetwork())).rejects.toThrow(/user denied/);
      // BaseWallet is not created on failure
      expect(baseWalletCtor).not.toHaveBeenCalled();
    });
  });

  describe("cross-cutting", () => {
    it("createWallet passes the tendermint client from the Wallet instance", async () => {
      const offlineSigner = { getAccounts: async () => [] };
      walletUtilsMock.getKeplr.mockResolvedValue({
        getOfflineSignerAuto: vi.fn().mockResolvedValue(offlineSigner),
        experimentalSuggestChain: vi.fn().mockResolvedValue(undefined),
        enable: vi.fn().mockResolvedValue(undefined)
      });
      const wallet = fakeWallet();
      await authenticateKeplr(wallet, fakeNetwork());
      const args = baseWalletCtor.mock.calls[0];
      expect(args[0]).toEqual({ kind: "comet" });
    });
  });
});
