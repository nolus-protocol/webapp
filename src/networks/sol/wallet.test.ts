import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

const stargateConnectMock = vi.fn();
vi.mock("@cosmjs/stargate", () => ({
  StargateClient: {
    connect: (...args: unknown[]) => stargateConnectMock(...args)
  }
}));

vi.mock("@nolus/nolusjs", () => ({
  ChainConstants: { CHAIN_KEY: "nolus" },
  NolusClient: {
    setInstance: vi.fn(),
    getInstance: vi.fn(() => ({ getChainId: vi.fn().mockResolvedValue("nolus-1") }))
  }
}));

vi.mock("@/common/utils/EndpointService", () => ({
  fetchEndpoints: vi.fn(async () => ({ rpc: "rpc", api: "api" }))
}));

vi.mock("@/common/utils", () => ({
  EnvNetworkUtils: {
    getStoredNetworkName: vi.fn(() => "mainnet")
  }
}));

vi.mock("@/config/global", () => ({
  KeplrEmbedChainInfo: vi.fn(() => ({
    bech32Config: { bech32PrefixAccAddr: "nolus" }
  }))
}));

import { SolanaWallet } from "./wallet";
import type { NetworkData } from "@/common/types";
import type { Window } from "../window";

const ED_PUBKEY_BYTES = new Uint8Array(32);
for (let i = 0; i < 32; i++) ED_PUBKEY_BYTES[i] = i + 1;

function makeProvider(overrides: Partial<Record<string, unknown>> = {}) {
  const publicKey = {
    toBytes: vi.fn(() => ED_PUBKEY_BYTES),
    toBase58: vi.fn(() => "SolAddrBase58")
  };
  return {
    connect: vi.fn().mockResolvedValue(true),
    publicKey,
    signMessage: vi.fn().mockResolvedValue({ signature: new Uint8Array(64) }),
    ...overrides
  };
}

function stubSolflare(provider: unknown) {
  const w = window as unknown as Window & { solflare?: unknown };
  w.solflare = provider as Window["solflare"];
}

function clearSolflare() {
  const w = window as unknown as Window & { solflare?: unknown };
  delete w.solflare;
}

function networkStub(): NetworkData {
  return {
    embedChainInfo: () => ({ bech32Config: { bech32PrefixAccAddr: "nolus" } })
  } as unknown as NetworkData;
}

describe("SolanaWallet", () => {
  beforeEach(() => {
    stargateConnectMock.mockReset();
    stargateConnectMock.mockResolvedValue({ getChainId: vi.fn().mockResolvedValue("nolus-1") });
  });

  afterEach(() => {
    clearSolflare();
    vi.restoreAllMocks();
  });

  it("connectCustom: derives bech32 nolus address from ed25519 pubkey and sets chainId", async () => {
    const provider = makeProvider();
    stubSolflare(provider);

    const sol = new SolanaWallet();
    const { solAddress, bech32Addr, pubkeyAny } = await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );

    expect(solAddress).toBe("SolAddrBase58");
    expect(bech32Addr).toMatch(/^nolus1[a-z0-9]+$/);
    expect(pubkeyAny).toBeInstanceOf(Uint8Array);
    expect(pubkeyAny.length).toBeGreaterThan(0);
    expect(sol.chainId).toBe("nolus-1");
    expect(sol.type).toBe("svm");
    expect(sol.algo).toBe("ed25519");
    expect(sol.address).toBe(bech32Addr);
    expect(sol.solAddress).toBe("SolAddrBase58");
  });

  it("connect: uses NolusClient + KeplrEmbedChainInfo path", async () => {
    const provider = makeProvider();
    stubSolflare(provider);

    const sol = new SolanaWallet();
    const { bech32Addr } = await sol.connect();
    expect(bech32Addr).toMatch(/^nolus1/);
    expect(sol.chainId).toBe("nolus-1");
  });

  it("getChainId returns the cached chainId", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    await expect(sol.getChainId()).resolves.toBe("nolus-1");
  });

  it("throws when provider.connect resolves false", async () => {
    const provider = makeProvider({ connect: vi.fn().mockResolvedValue(false) });
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await expect(
      sol.connectCustom(
        { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
        networkStub()
      )
    ).rejects.toThrow(/Connection failed/);
  });

  it("throws when provider.publicKey is missing (user rejected)", async () => {
    const provider = { connect: vi.fn().mockResolvedValue(true), publicKey: undefined };
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await expect(
      sol.connectCustom(
        { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
        networkStub()
      )
    ).rejects.toThrow(/Connection failed/);
  });

  it("makeWCOfflineSigner.getAccounts returns the derived account", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();
    const accounts = await signer.getAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].address).toBe(sol.address);
    expect(accounts[0].algo).toBe("ed25519");
  });

  it("makeWCOfflineSigner.signDirect throws 'not supported'", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();
    // signDirect does `throw "not supported"` (string literal), not an Error
    await expect(signer.signDirect("", {} as never)).rejects.toBe("not supported");
  });

  it("makeWCOfflineSigner.simulateMultiTx signs via provider.signMessage and returns txHash/txBytes/usedFee", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();

    // Attach the host dependencies simulateMultiTx expects (via `this.`) —
    // these are populated by NolusWallet when the signer is plugged in.
    const bound = Object.assign(signer, {
      registry: {
        encodeAsAny: vi.fn((m: unknown) => ({ encoded: m }))
      },
      getSequence: vi.fn().mockResolvedValue({ accountNumber: 1n, sequence: 0n }),
      getGasInfo: vi.fn().mockResolvedValue({
        gasInfo: { gasUsed: 100000 },
        gas: 150000,
        usedFee: { amount: [{ denom: "unls", amount: "1" }], gas: "150000" }
      })
    });

    const res = await bound.simulateMultiTx!(
      [{ msg: { fromAddress: "a", toAddress: "b" }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
      ""
    );
    expect(provider.signMessage).toHaveBeenCalledTimes(1);
    expect(res).toHaveProperty("txHash");
    expect(res).toHaveProperty("txBytes");
    expect(res).toHaveProperty("usedFee");
  });

  it("makeWCOfflineSigner.simulateTx delegates to simulateMultiTx with a single-message list", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();
    const bound = Object.assign(signer, {
      simulateMultiTx: vi.fn().mockResolvedValue({ txHash: "deadbeef", txBytes: new Uint8Array(), usedFee: {} })
    });
    await bound.simulateTx!({ x: 1 } as never, "/cosmos.bank.v1beta1.MsgSend", "memo");
    expect(bound.simulateMultiTx).toHaveBeenCalledWith(
      [{ msg: { x: 1 }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
      "memo"
    );
  });

  it("signer has type=svm and correct chainId", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet();
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();
    expect(signer.type).toBe("svm");
    expect(signer.chainId).toBe("nolus-1");
  });
});
