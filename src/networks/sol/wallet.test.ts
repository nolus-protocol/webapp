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
  NetworkEnv: {
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
import { AuthInfo, SignDoc } from "cosmjs-types/cosmos/tx/v1beta1/tx";

const ED_PUBKEY_BYTES = new Uint8Array(32);
for (let i = 0; i < 32; i++) ED_PUBKEY_BYTES[i] = i + 1;

function makeProvider(overrides: Partial<Record<string, unknown>> = {}) {
  const publicKey = {
    toBytes: vi.fn(() => ED_PUBKEY_BYTES),
    toBase58: vi.fn(() => "SolAddrBase58")
  };
  return {
    isSolflare: true,
    isPhantom: false,
    connect: vi.fn().mockResolvedValue(true),
    publicKey,
    signMessage: vi.fn().mockResolvedValue({ signature: new Uint8Array(64) }),
    ...overrides
  };
}

function makePhantomProvider(overrides: Partial<Record<string, unknown>> = {}) {
  const publicKey = {
    toBytes: vi.fn(() => ED_PUBKEY_BYTES),
    toBase58: vi.fn(() => "SolAddrBase58Phantom")
  };
  return {
    isPhantom: true,
    isSolflare: false,
    connect: vi.fn().mockResolvedValue(true),
    publicKey,
    signMessage: vi.fn().mockResolvedValue({ signature: new Uint8Array(64) }),
    ...overrides
  };
}

function stubSolflare(provider: unknown) {
  const w = window as unknown as { solflare?: unknown };
  w.solflare = provider;
}

function clearSolflare() {
  const w = window as unknown as { solflare?: unknown };
  delete w.solflare;
}

function stubPhantom(solanaProvider: unknown) {
  const w = window as unknown as { phantom?: { solana?: unknown } };
  w.phantom = { solana: solanaProvider };
}

function clearPhantom() {
  const w = window as unknown as { phantom?: unknown };
  delete w.phantom;
}

function networkStub(): NetworkData {
  return {
    embedChainInfo: () => ({ bech32Config: { bech32PrefixAccAddr: "nolus" } })
  } as unknown as NetworkData;
}

describe("SolanaWallet (Solflare provider)", () => {
  beforeEach(() => {
    stargateConnectMock.mockReset();
    stargateConnectMock.mockResolvedValue({ getChainId: vi.fn().mockResolvedValue("nolus-1") });
  });

  afterEach(() => {
    clearSolflare();
    clearPhantom();
    vi.restoreAllMocks();
  });

  it("connectCustom: derives bech32 nolus address from ed25519 pubkey and sets chainId", async () => {
    const provider = makeProvider();
    stubSolflare(provider);

    const sol = new SolanaWallet("solflare");
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

    const sol = new SolanaWallet("solflare");
    const { bech32Addr } = await sol.connect();
    expect(bech32Addr).toMatch(/^nolus1/);
    expect(sol.chainId).toBe("nolus-1");
  });

  it("getChainId returns the cached chainId", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    await expect(sol.getChainId()).resolves.toBe("nolus-1");
  });

  it("throws when provider.connect resolves false", async () => {
    const provider = makeProvider({ connect: vi.fn().mockResolvedValue(false) });
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await expect(
      sol.connectCustom({ rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0], networkStub())
    ).rejects.toThrow(/Connection failed/);
  });

  it("throws when provider.publicKey is missing (user rejected)", async () => {
    const provider = makeProvider({ publicKey: undefined });
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await expect(
      sol.connectCustom({ rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0], networkStub())
    ).rejects.toThrow(/Connection failed/);
  });

  it("throws when window.solflare is not really Solflare (isSolflare !== true)", async () => {
    // Wallet aggregator placeholder injection — defends against another wallet
    // squatting the window.solflare slot.
    const provider = makeProvider({ isSolflare: false });
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await expect(
      sol.connectCustom({ rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0], networkStub())
    ).rejects.toThrow();
  });

  it("makeWCOfflineSigner.getAccounts returns the derived account", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();
    const accounts = await signer.getAccounts();
    expect(accounts).toHaveLength(1);
    const account = accounts[0];
    if (account === undefined) throw new Error("expected the signer to return one account");
    expect(account.address).toBe(sol.address);
    expect(account.algo).toBe("ed25519");
  });

  it("makeWCOfflineSigner.signDirect throws 'not supported'", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
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
    const sol = new SolanaWallet("solflare");
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

    const res = await bound.simulateMultiTx?.(
      [{ msg: { fromAddress: "a", toAddress: "b" }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
      ""
    );
    expect(provider.signMessage).toHaveBeenCalledTimes(1);
    expect(res).toHaveProperty("txHash");
    expect(res).toHaveProperty("txBytes");
    expect(res).toHaveProperty("usedFee");
  });

  it("simulateMultiTx passes EXACTLY SignDoc.encode(signDoc).finish() bytes to provider.signMessage (round-trip)", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();

    const bound = Object.assign(signer, {
      registry: {
        encodeAsAny: vi.fn((m: unknown) => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: m }))
      },
      getSequence: vi.fn().mockResolvedValue({ accountNumber: 7n, sequence: 3n }),
      getGasInfo: vi.fn().mockResolvedValue({
        gasInfo: { gasUsed: 100000 },
        gas: 150000,
        usedFee: { amount: [{ denom: "unls", amount: "1" }], gas: "150000" }
      })
    });

    await bound.simulateMultiTx?.(
      [{ msg: { fromAddress: "a", toAddress: "b" }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
      ""
    );

    // Decode the bytes that were actually passed to signMessage and confirm
    // they round-trip cleanly through SignDoc — i.e. the bytes ARE
    // `SignDoc.encode(signDoc).finish()`, not a hash, JSON, or wrapped form.
    expect(provider.signMessage).toHaveBeenCalledTimes(1);
    const signCall = provider.signMessage.mock.calls[0];
    if (signCall === undefined) throw new Error("expected signMessage to have been called");
    const passedBytes = signCall[0] as Uint8Array;
    expect(passedBytes).toBeInstanceOf(Uint8Array);

    const decoded = SignDoc.decode(passedBytes);
    expect(decoded.chainId).toBe("nolus-1");
    expect(decoded.accountNumber).toBe(7n);
    expect(decoded.bodyBytes.length).toBeGreaterThan(0);
    expect(decoded.authInfoBytes.length).toBeGreaterThan(0);

    // Re-encode and assert byte-for-byte equality — no extra wrapper.
    const reEncoded = SignDoc.encode(decoded).finish();
    expect(passedBytes).toEqual(reEncoded);
  });

  it("AuthInfo carries /cosmos.crypto.ed25519.PubKey (NOT secp256k1) in signer_infos[0].public_key.type_url", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();

    const bound = Object.assign(signer, {
      registry: {
        encodeAsAny: vi.fn((m: unknown) => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: m }))
      },
      getSequence: vi.fn().mockResolvedValue({ accountNumber: 1n, sequence: 0n }),
      getGasInfo: vi.fn().mockResolvedValue({
        gasInfo: { gasUsed: 100000 },
        gas: 150000,
        usedFee: { amount: [{ denom: "unls", amount: "1" }], gas: "150000" }
      })
    });

    await bound.simulateMultiTx?.(
      [{ msg: { fromAddress: "a", toAddress: "b" }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
      ""
    );

    const signCall = provider.signMessage.mock.calls[0];
    if (signCall === undefined) throw new Error("expected signMessage to have been called");
    const passedBytes = signCall[0] as Uint8Array;
    const signDoc = SignDoc.decode(passedBytes);
    const authInfo = AuthInfo.decode(signDoc.authInfoBytes);

    expect(authInfo.signerInfos).toHaveLength(1);
    const signerInfo = authInfo.signerInfos[0];
    if (signerInfo === undefined) throw new Error("expected one signerInfo in the AuthInfo");
    expect(signerInfo.publicKey?.typeUrl).toBe("/cosmos.crypto.ed25519.PubKey");
  });

  it("makeWCOfflineSigner.simulateTx delegates to simulateMultiTx with a single-message list", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();
    const bound = Object.assign(signer, {
      simulateMultiTx: vi.fn().mockResolvedValue({ txHash: "deadbeef", txBytes: new Uint8Array(), usedFee: {} })
    });
    await bound.simulateTx?.({ x: 1 } as never, "/cosmos.bank.v1beta1.MsgSend", "memo");
    expect(bound.simulateMultiTx).toHaveBeenCalledWith(
      [{ msg: { x: 1 }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
      "memo"
    );
  });

  it("signer has type=svm and correct chainId", async () => {
    const provider = makeProvider();
    stubSolflare(provider);
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();
    expect(signer.type).toBe("svm");
    expect(signer.chainId).toBe("nolus-1");
  });
});

describe("SolanaWallet (Phantom provider)", () => {
  beforeEach(() => {
    stargateConnectMock.mockReset();
    stargateConnectMock.mockResolvedValue({ getChainId: vi.fn().mockResolvedValue("nolus-1") });
  });

  afterEach(() => {
    clearSolflare();
    clearPhantom();
    vi.restoreAllMocks();
  });

  it("reads window.phantom.solana (NOT window.solflare) when provider is 'phantom'", async () => {
    const phantomProvider = makePhantomProvider();
    const solflareProvider = makeProvider({
      // If the wallet incorrectly read solflare for "phantom", this would be
      // the address used. Distinct toBase58 lets the assertion catch wrong-slot reads.
      publicKey: {
        toBytes: vi.fn(() => new Uint8Array(32)),
        toBase58: vi.fn(() => "WRONG_SOLFLARE_SLOT")
      }
    });

    stubPhantom(phantomProvider);
    stubSolflare(solflareProvider);

    const sol = new SolanaWallet("phantom");
    const { solAddress } = await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );

    expect(phantomProvider.connect).toHaveBeenCalledTimes(1);
    expect(solflareProvider.connect).not.toHaveBeenCalled();
    expect(solAddress).toBe("SolAddrBase58Phantom");
  });

  it("throws when window.phantom.solana is not really Phantom (isPhantom !== true)", async () => {
    // Wallet aggregator placeholder injection — e.g. another wallet writing
    // `window.phantom = { solana: { ... } }` without `isPhantom`. The wallet
    // must refuse rather than authenticate against the wrong provider.
    const placeholder = makePhantomProvider({ isPhantom: false });
    stubPhantom(placeholder);
    const sol = new SolanaWallet("phantom");
    await expect(
      sol.connectCustom({ rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0], networkStub())
    ).rejects.toThrow();
  });

  it("throws when window.phantom is missing entirely", async () => {
    // No phantom slot at all — must not silently fall back to solflare or any
    // other window key.
    clearPhantom();
    const sol = new SolanaWallet("phantom");
    await expect(
      sol.connectCustom({ rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0], networkStub())
    ).rejects.toThrow();
  });

  it("throws 'not installed' when window.phantom.solana lacks the provider methods", async () => {
    stubPhantom({ isPhantom: true });
    const sol = new SolanaWallet("phantom");
    await expect(
      sol.connectCustom({ rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0], networkStub())
    ).rejects.toThrow(/Phantom wallet is not installed/);
  });

  it("connectCustom on Phantom signs via window.phantom.solana.signMessage", async () => {
    const phantomProvider = makePhantomProvider();
    stubPhantom(phantomProvider);

    const sol = new SolanaWallet("phantom");
    await sol.connectCustom(
      { rpc: "r", api: "a" } as unknown as Parameters<typeof sol.connectCustom>[0],
      networkStub()
    );
    const signer = sol.makeWCOfflineSigner();

    const bound = Object.assign(signer, {
      registry: {
        encodeAsAny: vi.fn((m: unknown) => ({ typeUrl: "/cosmos.bank.v1beta1.MsgSend", value: m }))
      },
      getSequence: vi.fn().mockResolvedValue({ accountNumber: 1n, sequence: 0n }),
      getGasInfo: vi.fn().mockResolvedValue({
        gasInfo: { gasUsed: 100000 },
        gas: 150000,
        usedFee: { amount: [{ denom: "unls", amount: "1" }], gas: "150000" }
      })
    });

    await bound.simulateMultiTx?.(
      [{ msg: { fromAddress: "a", toAddress: "b" }, msgTypeUrl: "/cosmos.bank.v1beta1.MsgSend" }],
      ""
    );

    expect(phantomProvider.signMessage).toHaveBeenCalledTimes(1);
  });
});

describe("SolanaWallet strict guards", () => {
  beforeEach(() => {
    stargateConnectMock.mockReset();
    stargateConnectMock.mockResolvedValue({ getChainId: vi.fn().mockResolvedValue("nolus-1") });
  });

  afterEach(() => {
    clearSolflare();
    clearPhantom();
    vi.restoreAllMocks();
  });

  function connectArgs() {
    return { rpc: "r", api: "a" } as unknown as Parameters<SolanaWallet["connectCustom"]>[0];
  }

  it("throws 'not installed' when window.solflare lacks the provider methods", async () => {
    stubSolflare({ isSolflare: true });
    const sol = new SolanaWallet("solflare");
    await expect(sol.connectCustom(connectArgs(), networkStub())).rejects.toThrow(/Solflare wallet is not installed/);
  });

  it("throws when the chain info has no bech32 config", async () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    const network = { embedChainInfo: () => ({}) } as unknown as NetworkData;
    await expect(sol.connectCustom(connectArgs(), network)).rejects.toThrow(/bech32 config/);
  });

  it("throws when the bech32 config has no account prefix entry", async () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    const network = { embedChainInfo: () => ({ bech32Config: {} }) } as unknown as NetworkData;
    await expect(sol.connectCustom(connectArgs(), network)).rejects.toThrow(/bech32 config/);
  });

  it("throws when the bech32 account prefix is not a string", async () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    const network = {
      embedChainInfo: () => ({ bech32Config: { bech32PrefixAccAddr: 5 } })
    } as unknown as NetworkData;
    await expect(sol.connectCustom(connectArgs(), network)).rejects.toThrow(/prefix is not a string/);
  });

  it("makeWCOfflineSigner throws when the wallet was never connected (no pubKey)", () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    expect(() => sol.makeWCOfflineSigner()).toThrow(/not connected/);
  });

  it("simulateTx rejects when simulateMultiTx has been detached from the signer", async () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(connectArgs(), networkStub());
    const signer = sol.makeWCOfflineSigner();
    Object.assign(signer, { simulateMultiTx: undefined });
    await expect(Promise.resolve(signer.simulateTx?.({} as never, "/cosmos.bank.v1beta1.MsgSend", ""))).rejects.toThrow(
      /simulateMultiTx is not attached/
    );
  });

  it("simulateMultiTx rejects when the host functions were never attached", async () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(connectArgs(), networkStub());
    const signer = sol.makeWCOfflineSigner();
    await expect(Promise.resolve(signer.simulateMultiTx?.([{ msg: {}, msgTypeUrl: "/x" }], ""))).rejects.toThrow(
      /not attached/
    );
  });

  it("simulateMultiTx rejects when getSequence resolves a malformed sequence info", async () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(connectArgs(), networkStub());
    const signer = sol.makeWCOfflineSigner();
    const bound = Object.assign(signer, {
      registry: { encodeAsAny: vi.fn((m: unknown) => ({ typeUrl: "/x", value: m })) },
      getSequence: vi.fn().mockResolvedValueOnce({}).mockResolvedValueOnce({ accountNumber: "1", sequence: "0" }),
      getGasInfo: vi.fn()
    });
    await expect(Promise.resolve(bound.simulateMultiTx?.([{ msg: {}, msgTypeUrl: "/x" }], ""))).rejects.toThrow(
      /sequence info/i
    );
    await expect(Promise.resolve(bound.simulateMultiTx?.([{ msg: {}, msgTypeUrl: "/x" }], ""))).rejects.toThrow(
      /sequence info/i
    );
  });

  it("simulateMultiTx rejects when gas estimation returns no usable fee", async () => {
    stubSolflare(makeProvider());
    const sol = new SolanaWallet("solflare");
    await sol.connectCustom(connectArgs(), networkStub());
    const signer = sol.makeWCOfflineSigner();
    const bound = Object.assign(signer, {
      registry: { encodeAsAny: vi.fn((m: unknown) => ({ typeUrl: "/x", value: m })) },
      getSequence: vi.fn().mockResolvedValue({ accountNumber: 1n, sequence: 0n }),
      getGasInfo: vi.fn().mockResolvedValue({ usedFee: { amount: "not-a-list", gas: 5 } })
    });
    await expect(Promise.resolve(bound.simulateMultiTx?.([{ msg: {}, msgTypeUrl: "/x" }], ""))).rejects.toThrow(
      /usable fee/
    );
  });
});
