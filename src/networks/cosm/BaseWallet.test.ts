import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Stub window.matchMedia BEFORE any imports (utils barrel pulls in ThemeManager
// which reads matchMedia at module load in jsdom).
vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
    (window as unknown as { matchMedia: () => unknown }).matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
      addListener: () => undefined,
      removeListener: () => undefined,
      dispatchEvent: () => false
    });
  }
});

// Mock the heavy parent class before importing. We track calls to super()
// constructor args via `superCtorArgs`.
const {
  superCtorArgs,
  superSendTokens,
  superGetSequence,
  superGetChainId,
  withExtensionsMock,
  encodeMock
} = vi.hoisted(() => ({
  superCtorArgs: vi.fn(),
  superSendTokens: vi.fn(),
  superGetSequence: vi.fn(),
  superGetChainId: vi.fn(),
  withExtensionsMock: vi.fn(),
  encodeMock: vi.fn((_obj: unknown) => new Uint8Array([1, 2, 3, 4]))
}));

vi.mock("@cosmjs/cosmwasm-stargate", async (orig) => {
  const actual: Record<string, unknown> = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    SigningCosmWasmClient: class {
    registry = { encode: encodeMock, encodeAsAny: (msg: unknown) => ({ encoded: msg }) };
    aminoTypes = {
      toAmino: (m: { value: unknown }) => ({ type: "amino-msg", value: m.value }),
      fromAmino: (m: { value: unknown }) => ({ typeUrl: "/x", value: m.value })
    };
    constructor(...args: unknown[]) {
      superCtorArgs(...args);
    }
    async sendTokens(...args: unknown[]) {
      return superSendTokens(...args);
    }
    async getSequence(...args: unknown[]) {
      return superGetSequence(...args);
    }
    async getChainId(...args: unknown[]) {
      return superGetChainId(...args);
    }
    forceGetQueryClient() {
      return {
        tx: {
          simulate: vi.fn().mockResolvedValue({ gasInfo: { gasUsed: 100000n } })
        }
      };
    }
    }
  };
});

vi.mock("@cosmjs/stargate", async (orig) => {
  const actual: Record<string, unknown> = await (orig as () => Promise<Record<string, unknown>>)();
  return {
    ...actual,
    QueryClient: {
      withExtensions: (...args: unknown[]) => {
        withExtensionsMock(...args);
        // return a shape we can instruct
        return {
          auth: { account: vi.fn() },
          tx: {
            simulate: vi.fn().mockResolvedValue({ gasInfo: { gasUsed: 100000n } })
          }
        };
      }
    },
    calculateFee: vi.fn(() => ({ amount: [{ denom: "unls", amount: "2500" }], gas: "100000" }))
  };
});

import { BaseWallet } from "./BaseWallet";
import type { OfflineSigner, OfflineDirectSigner } from "@cosmjs/proto-signing";

function fakeSigner(overrides: Partial<OfflineSigner> = {}): OfflineSigner {
  return {
    getAccounts: vi.fn(async () => [
      { address: "nolus1addr", pubkey: new Uint8Array(33).fill(2), algo: "secp256k1" as const }
    ]),
    signAmino: vi.fn(async () => ({
      signature: { signature: "YWJj", pub_key: { type: "t", value: "v" } },
      signed: {
        accountNumber: "1",
        sequence: "0",
        chainId: "nolus-1",
        msgs: [],
        memo: "",
        fee: { amount: [{ denom: "unls", amount: "1" }], gas: "100000" }
      }
    })),
    ...overrides
  } as unknown as OfflineSigner;
}

function fakeDirectSigner(): OfflineDirectSigner {
  return {
    getAccounts: vi.fn(async () => [
      { address: "nolus1addr", pubkey: new Uint8Array(33).fill(2), algo: "secp256k1" as const }
    ]),
    signDirect: vi.fn(async (_addr: string, signDoc: unknown) => ({
      signed: signDoc,
      signature: { signature: "YWJj", pub_key: { type: "t", value: "v" } }
    }))
  } as unknown as OfflineDirectSigner;
}

function buildBaseWallet(signer: OfflineSigner = fakeSigner(), gasMultiplier = 1.5) {
  return new BaseWallet(
    { disconnect: vi.fn() } as unknown as Parameters<typeof BaseWallet>[0],
    signer,
    {} as never,
    "rpc-url",
    "api-url",
    "nolus",
    gasMultiplier,
    "0.025unls",
    "https://explorer"
  );
}

describe("BaseWallet", () => {
  beforeEach(() => {
    superCtorArgs.mockClear();
    superSendTokens.mockReset();
    superGetSequence.mockReset();
    superGetChainId.mockReset();
    withExtensionsMock.mockClear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("constructor", () => {
    it("calls super with tmClient, signer, options", () => {
      const signer = fakeSigner();
      buildBaseWallet(signer);
      const args = superCtorArgs.mock.calls[0];
      expect(args[1]).toBe(signer);
    });

    it("stores rpc/api/prefix/gas fields", () => {
      const bw = buildBaseWallet();
      expect(bw.rpc).toBe("rpc-url");
      expect(bw.api).toBe("api-url");
      expect(bw.prefix).toBe("nolus");
      expect(bw.gasMultiplier).toBe(1.5);
      expect(bw.explorer).toBe("https://explorer");
    });

    it("builds a queryClientBase with QueryClient.withExtensions", () => {
      buildBaseWallet();
      expect(withExtensionsMock).toHaveBeenCalledTimes(1);
    });

    it("type defaults to 'cosmos'", () => {
      const bw = buildBaseWallet();
      expect(bw.type).toBe("cosmos");
    });
  });

  describe("useAccount", () => {
    it("populates address/pubKey/algo from signer.getAccounts()[0]", async () => {
      const bw = buildBaseWallet();
      const ok = await bw.useAccount();
      expect(ok).toBe(true);
      expect(bw.address).toBe("nolus1addr");
      expect(bw.pubKey).toBeInstanceOf(Uint8Array);
      expect(bw.algo).toBe("secp256k1");
    });

    it("throws when signer returns no accounts", async () => {
      const signer = fakeSigner({ getAccounts: vi.fn(async () => []) });
      const bw = buildBaseWallet(signer);
      await expect(bw.useAccount()).rejects.toThrow(/Missing account/);
    });
  });

  describe("getSigner", () => {
    it("returns the offline signer passed to the constructor", async () => {
      const signer = fakeSigner();
      const bw = buildBaseWallet(signer);
      await expect(bw.getSigner()).resolves.toBe(signer);
    });
  });

  describe("transferAmount", () => {
    it("delegates to this.sendTokens with the sender address", async () => {
      superSendTokens.mockResolvedValue({ code: 0 });
      const bw = buildBaseWallet();
      await bw.useAccount();
      const amt = [{ denom: "unls", amount: "100" }];
      await bw.transferAmount("nolus1to", amt, "auto", "memo");
      expect(superSendTokens).toHaveBeenCalledWith("nolus1addr", "nolus1to", amt, "auto", "memo");
    });

    it("throws when the sender address isn't set (useAccount was never called)", async () => {
      const bw = buildBaseWallet();
      // Do NOT call useAccount
      await expect(bw.transferAmount("nolus1to", [], "auto")).rejects.toThrow(/Sender address is missing/);
    });
  });

  describe("simulateBankTransferTx", () => {
    it("round-trips through simulateTx and returns txHash/txBytes/usedFee", async () => {
      superGetSequence.mockResolvedValue({ accountNumber: 1, sequence: 0 });
      const directSigner = fakeDirectSigner();
      const bw = buildBaseWallet(directSigner as unknown as OfflineSigner);
      await bw.useAccount();
      // For getAccount in sequence() - patched via queryClientBase auth
      const queryAuth = (bw as unknown as {
        queryClientBase: { auth: { account: ReturnType<typeof vi.fn> } };
      }).queryClientBase.auth;
      queryAuth.account.mockResolvedValue({
        typeUrl: "/cosmos.auth.v1beta1.BaseAccount",
        value: new Uint8Array()
      });
      // But accountFromAny will throw on empty — so stub getAccount directly
      const bwAny = bw as unknown as { getAccount: (a: string) => Promise<unknown> };
      bwAny.getAccount = vi.fn().mockResolvedValue({ sequence: 0, accountNumber: 1 });

      const out = await bw.simulateBankTransferTx(
        "nolus1to",
        [{ denom: "unls", amount: "100" }],
        1.2,
        "0.025unls"
      );
      expect(out).toHaveProperty("txHash");
      expect(out).toHaveProperty("txBytes");
      expect(out).toHaveProperty("usedFee");
    });
  });

  describe("simulateSendIbcTokensTx", () => {
    it("computes timeoutTimestamp from Date.now() + timeOut and builds a MsgTransfer", async () => {
      vi.setSystemTime(new Date("2026-01-01T00:00:00Z"));
      superGetSequence.mockResolvedValue({ accountNumber: 1, sequence: 0 });
      const directSigner = fakeDirectSigner();
      const bw = buildBaseWallet(directSigner as unknown as OfflineSigner);
      await bw.useAccount();
      const bwAny = bw as unknown as { getAccount: (a: string) => Promise<unknown> };
      bwAny.getAccount = vi.fn().mockResolvedValue({ sequence: 0, accountNumber: 1 });

      const out = await bw.simulateSendIbcTokensTx({
        toAddress: "nolus1to",
        amount: { denom: "unls", amount: "1" },
        sourcePort: "transfer",
        sourceChannel: "channel-0",
        timeOut: 60,
        gasMultiplier: 1.2,
        gasPrice: "0.025unls"
      });
      expect(out).toHaveProperty("txHash");
      vi.useRealTimers();
    });
  });

  describe("getAccount", () => {
    it("returns null when the rpc error is 'NotFound'", async () => {
      const bw = buildBaseWallet();
      const queryAuth = (bw as unknown as {
        queryClientBase: { auth: { account: ReturnType<typeof vi.fn> } };
      }).queryClientBase.auth;
      queryAuth.account.mockRejectedValue(new Error("rpc error: code = NotFound"));
      await expect(bw.getAccount("nolus1addr")).resolves.toBeNull();
    });

    it("rethrows non-NotFound errors", async () => {
      const bw = buildBaseWallet();
      const queryAuth = (bw as unknown as {
        queryClientBase: { auth: { account: ReturnType<typeof vi.fn> } };
      }).queryClientBase.auth;
      queryAuth.account.mockRejectedValue(new Error("internal boom"));
      await expect(bw.getAccount("nolus1addr")).rejects.toThrow(/internal boom/);
    });

    it("returns null for a missing account (undefined response)", async () => {
      const bw = buildBaseWallet();
      const queryAuth = (bw as unknown as {
        queryClientBase: { auth: { account: ReturnType<typeof vi.fn> } };
      }).queryClientBase.auth;
      queryAuth.account.mockResolvedValue(undefined);
      await expect(bw.getAccount("nolus1addr")).resolves.toBeNull();
    });
  });

  describe("sign", () => {
    it("uses the AMINO path when signer is not a direct signer", async () => {
      // amino signer — no signDirect present
      const signer = fakeSigner();
      const bw = buildBaseWallet(signer);
      await bw.useAccount();
      superGetSequence.mockResolvedValue({ accountNumber: 1, sequence: 0 });
      superGetChainId.mockResolvedValue("nolus-1");

      const txRaw = await bw.sign(
        "nolus1addr",
        [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }],
        { amount: [{ denom: "unls", amount: "1" }], gas: "100000" },
        "memo"
      );
      expect(txRaw).toBeDefined();
      expect((signer.signAmino as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    });

    it("uses the DIRECT path when signer implements signDirect", async () => {
      const signer = fakeDirectSigner();
      const bw = buildBaseWallet(signer as unknown as OfflineSigner);
      await bw.useAccount();
      superGetSequence.mockResolvedValue({ accountNumber: 1, sequence: 0 });
      superGetChainId.mockResolvedValue("nolus-1");

      await bw.sign(
        "nolus1addr",
        [{ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: {} }],
        { amount: [{ denom: "unls", amount: "1" }], gas: "100000" },
        "memo"
      );
      expect((signer.signDirect as ReturnType<typeof vi.fn>)).toHaveBeenCalledTimes(1);
    });

    it("uses explicitSignerData when provided (skipping getSequence/getChainId)", async () => {
      const signer = fakeDirectSigner();
      const bw = buildBaseWallet(signer as unknown as OfflineSigner);
      await bw.useAccount();
      await bw.sign(
        "nolus1addr",
        [{ typeUrl: "/x", value: {} }],
        { amount: [], gas: "1" },
        "",
        { accountNumber: 42, sequence: 99, chainId: "custom-chain" }
      );
      // getSequence / getChainId not called
      expect(superGetSequence).not.toHaveBeenCalled();
      expect(superGetChainId).not.toHaveBeenCalled();
    });

    it("throws when the signer has no account matching the signerAddress", async () => {
      const signer = fakeDirectSigner();
      const bw = buildBaseWallet(signer as unknown as OfflineSigner);
      await bw.useAccount();
      superGetSequence.mockResolvedValue({ accountNumber: 1, sequence: 0 });
      superGetChainId.mockResolvedValue("nolus-1");
      await expect(
        bw.sign("nolus1different", [{ typeUrl: "/x", value: {} }], { amount: [], gas: "1" }, "")
      ).rejects.toThrow(/Failed to retrieve account from signer/);
    });
  });

  describe("simulateMultiTx", () => {
    it("builds a tx via sign() with combined gasUsed * gasMultiplier", async () => {
      const signer = fakeDirectSigner();
      const bw = buildBaseWallet(signer as unknown as OfflineSigner, 2.0);
      await bw.useAccount();
      const bwAny = bw as unknown as { getAccount: (a: string) => Promise<unknown> };
      bwAny.getAccount = vi.fn().mockResolvedValue({ sequence: 0, accountNumber: 1 });
      superGetSequence.mockResolvedValue({ accountNumber: 1, sequence: 0 });
      superGetChainId.mockResolvedValue("nolus-1");

      const out = await bw.simulateMultiTx(
        [
          { msg: { fromAddress: "a", toAddress: "b", amount: [] }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" },
          { msg: { fromAddress: "a", toAddress: "c", amount: [] }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }
        ],
        "memo"
      );
      expect(out).toHaveProperty("txHash");
      expect(out).toHaveProperty("txBytes");
      expect(out).toHaveProperty("usedFee");
    });

    it("handles empty message list without throwing", async () => {
      const signer = fakeDirectSigner();
      const bw = buildBaseWallet(signer as unknown as OfflineSigner);
      await bw.useAccount();
      const bwAny = bw as unknown as { getAccount: (a: string) => Promise<unknown> };
      bwAny.getAccount = vi.fn().mockResolvedValue({ sequence: 0, accountNumber: 1 });
      superGetSequence.mockResolvedValue({ accountNumber: 1, sequence: 0 });
      superGetChainId.mockResolvedValue("nolus-1");

      const out = await bw.simulateMultiTx([], "");
      expect(out).toHaveProperty("txHash");
    });
  });
});
