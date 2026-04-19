import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the config store used by the overrides module. Each test can adjust
// the return value via `setFeeConfig(...)`.
let currentFeeConfig: { gas_prices: Record<string, string>; gas_multiplier: number } | null = null;
const useConfigStoreMock = vi.fn(() => ({
  get gasFeeConfig() {
    return currentFeeConfig;
  }
}));

vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => useConfigStoreMock()
}));

// The overrides use `TxRaw.encode(...).finish()` and `sha256` — mock only the
// minimal bits. TxRaw.encode is left real (comes from cosmjs-types).
vi.mock("@cosmjs/crypto", () => ({
  sha256: (bytes: Uint8Array) => bytes // pass-through; test only checks txHash is hex-ish
}));

import { applyNolusWalletOverrides } from "./NolusWalletOverride";
import type { NolusWallet } from "@nolus/nolusjs/build/wallet/NolusWallet";

type Override<T extends keyof NolusWallet> = NolusWallet[T];

interface FakeOfflineSigner {
  simulateTx?: (...args: unknown[]) => unknown;
  simulateMultiTx?: (...args: unknown[]) => unknown;
}

// We create a "fake" NolusWallet by Object-shape casting; we only touch the
// properties/methods the override reads.
function buildFakeWallet(
  opts: {
    simulate?: { gasInfo: { gasUsed: bigint | number } };
    signerSequence?: number;
    offlineSigner?: FakeOfflineSigner;
    pubKey?: Uint8Array;
  } = {}
): NolusWallet & Record<string, unknown> {
  const defaultPub = new Uint8Array(33);
  defaultPub[0] = 0x02;
  for (let i = 1; i < 33; i++) defaultPub[i] = i;

  const wallet = {
    address: "nolus1addr",
    pubKey: opts.pubKey ?? defaultPub,
    registry: {
      encodeAsAny: vi.fn((msg: unknown) => ({ encoded: msg }))
    },
    getOfflineSigner: vi.fn(() => opts.offlineSigner ?? {}),
    getSequence: vi.fn(async () => ({ sequence: opts.signerSequence ?? 1 })),
    forceGetQueryClient: vi.fn(() => ({
      tx: {
        simulate: vi.fn(async () => opts.simulate ?? { gasInfo: { gasUsed: 100000 } })
      }
    })),
    selectDynamicFee: vi.fn(async (gas: number) => ({
      amount: [{ denom: "unls", amount: String(gas * 10) }],
      gas: String(gas)
    })),
    sign: vi.fn(async () => ({
      // Minimal shape such that TxRaw.encode(...) still works:
      bodyBytes: new Uint8Array([0x0a, 0x00]),
      authInfoBytes: new Uint8Array([0x12, 0x00]),
      signatures: [new Uint8Array([0x01])]
    }))
  } as unknown as NolusWallet & Record<string, unknown>;

  return wallet;
}

describe("NolusWalletOverride", () => {
  beforeEach(() => {
    currentFeeConfig = { gas_prices: { unls: "0.025" }, gas_multiplier: 1.5 };
    useConfigStoreMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("gasPrices override", () => {
    it("returns gas_prices from the backend config, converted to numbers", async () => {
      const w = buildFakeWallet();
      applyNolusWalletOverrides(w);
      const prices = await (w.gasPrices as () => Promise<Record<string, number>>)();
      expect(prices).toEqual({ unls: 0.025 });
    });

    it("handles multiple denoms", async () => {
      currentFeeConfig = {
        gas_prices: { unls: "0.01", uusdc: "0.002" },
        gas_multiplier: 1.2
      };
      const w = buildFakeWallet();
      applyNolusWalletOverrides(w);
      const prices = await (w.gasPrices as () => Promise<Record<string, number>>)();
      expect(prices).toEqual({ unls: 0.01, uusdc: 0.002 });
    });

    it("throws when gasFeeConfig is null (fail loudly, no fallbacks)", async () => {
      currentFeeConfig = null;
      const w = buildFakeWallet();
      applyNolusWalletOverrides(w);
      await expect((w.gasPrices as () => Promise<unknown>)()).rejects.toThrow(/Gas fee config not available/);
    });
  });

  describe("simulateTx override", () => {
    it("multiplies gasUsed by backend gas_multiplier (1.5)", async () => {
      const w = buildFakeWallet({ simulate: { gasInfo: { gasUsed: 100000 } } });
      applyNolusWalletOverrides(w);
      const fn = w.simulateTx as Override<"simulateTx">;
      const result = await fn({} as never, "/cosmos.bank.v1beta1.MsgSend", "memo");
      // 100000 * 1.5 = 150000 rounded
      expect((w.selectDynamicFee as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(150000);
      expect(result).toHaveProperty("txHash");
      expect(result).toHaveProperty("txBytes");
      expect(result).toHaveProperty("usedFee");
    });

    it("delegates to offlineSigner.simulateTx when available (Ledger path)", async () => {
      const simulateTxSigner = vi.fn().mockResolvedValue({ txHash: "abc", txBytes: new Uint8Array(), usedFee: {} });
      const w = buildFakeWallet({ offlineSigner: { simulateTx: simulateTxSigner } });
      applyNolusWalletOverrides(w);
      const fn = w.simulateTx as Override<"simulateTx">;
      await fn({ foo: "bar" } as never, "/cosmos.bank.v1beta1.MsgSend", "m");
      expect(simulateTxSigner).toHaveBeenCalledWith({ foo: "bar" }, "m");
    });

    it("throws when gas fee config missing (during simulateTx path)", async () => {
      const w = buildFakeWallet();
      applyNolusWalletOverrides(w);
      currentFeeConfig = null; // drop config before call
      const fn = w.simulateTx as Override<"simulateTx">;
      await expect(fn({} as never, "/cosmos.bank.v1beta1.MsgSend")).rejects.toThrow(/Gas fee config not available/);
    });

    it("uses default memo of empty string when not provided", async () => {
      const w = buildFakeWallet();
      applyNolusWalletOverrides(w);
      const fn = w.simulateTx as Override<"simulateTx">;
      await fn({} as never, "/cosmos.bank.v1beta1.MsgSend");
      const signCalls = (w.sign as ReturnType<typeof vi.fn>).mock.calls;
      expect(signCalls[0][3]).toBe("");
    });
  });

  describe("simulateMultiTx override", () => {
    it("multiplies sum-of-gas by gas_multiplier for multi-message tx", async () => {
      const w = buildFakeWallet({ simulate: { gasInfo: { gasUsed: 200000n } } });
      applyNolusWalletOverrides(w);
      // simulateMultiTx is private on the NolusWallet type — override sets it anyway.
      const fn = (w as unknown as { simulateMultiTx: (...args: unknown[]) => Promise<unknown> }).simulateMultiTx;
      const res = await fn(
        [
          { msg: {}, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" },
          { msg: {}, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }
        ],
        "memo"
      );
      // 200000 * 1.5 = 300000
      expect((w.selectDynamicFee as ReturnType<typeof vi.fn>).mock.calls[0][0]).toBe(300000);
      expect(res).toHaveProperty("txHash");
    });

    it("delegates to offlineSigner.simulateMultiTx when available", async () => {
      const simulateMultiTxSigner = vi
        .fn()
        .mockResolvedValue({ txHash: "xyz", txBytes: new Uint8Array(), usedFee: {} });
      const w = buildFakeWallet({ offlineSigner: { simulateMultiTx: simulateMultiTxSigner } });
      applyNolusWalletOverrides(w);
      const fn = (w as unknown as { simulateMultiTx: (...args: unknown[]) => Promise<unknown> }).simulateMultiTx;
      const msgs = [{ msg: {}, msgTypeUrl: "/x" }];
      await fn(msgs, "m");
      expect(simulateMultiTxSigner).toHaveBeenCalledWith(msgs, "m");
    });

    it("encodes every message via registry.encodeAsAny exactly once", async () => {
      const w = buildFakeWallet();
      applyNolusWalletOverrides(w);
      const fn = (w as unknown as { simulateMultiTx: (...args: unknown[]) => Promise<unknown> }).simulateMultiTx;
      await fn(
        [
          { msg: { a: 1 }, msgTypeUrl: "/a" },
          { msg: { b: 2 }, msgTypeUrl: "/b" },
          { msg: { c: 3 }, msgTypeUrl: "/c" }
        ],
        ""
      );
      const encAsAny = w.registry.encodeAsAny as ReturnType<typeof vi.fn>;
      expect(encAsAny).toHaveBeenCalledTimes(3);
    });
  });

  describe("getGasInfo override", () => {
    it("returns gas / usedFee / gasInfo shape", async () => {
      const w = buildFakeWallet({ simulate: { gasInfo: { gasUsed: 60000 } } });
      applyNolusWalletOverrides(w);
      const fn = (w as unknown as { getGasInfo: (...args: unknown[]) => Promise<Record<string, unknown>> }).getGasInfo;
      const out = await fn(
        [{ msg: {}, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
        "memo",
        { type: "tendermint/PubKeySecp256k1", value: "AA==" },
        5
      );
      expect(out.gas).toBe(Math.round(60000 * 1.5));
      expect(out.usedFee).toBeDefined();
      expect(out.gasInfo).toBeDefined();
    });

    it("throws when gasFeeConfig is missing", async () => {
      currentFeeConfig = null;
      const w = buildFakeWallet();
      applyNolusWalletOverrides(w);
      const fn = (w as unknown as { getGasInfo: (...args: unknown[]) => Promise<unknown> }).getGasInfo;
      await expect(fn([{ msg: {}, msgTypeUrl: "/x" }], "", { type: "t", value: "v" }, 0)).rejects.toThrow(
        /Gas fee config not available/
      );
    });

    it("rounds fractional gas values (0.5 rounds to nearest)", async () => {
      currentFeeConfig = { gas_prices: { unls: "0.01" }, gas_multiplier: 1.333 };
      const w = buildFakeWallet({ simulate: { gasInfo: { gasUsed: 77777 } } });
      applyNolusWalletOverrides(w);
      const fn = (w as unknown as { getGasInfo: (...args: unknown[]) => Promise<{ gas: number }> }).getGasInfo;
      const out = await fn([{ msg: {}, msgTypeUrl: "/x" }], "", { type: "t", value: "v" }, 0);
      expect(out.gas).toBe(Math.round(77777 * 1.333));
    });
  });
});
