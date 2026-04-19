import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Mock the CometClient connect + StargateClient create before import.
const connectCometMock = vi.fn();
const stargateCreateMock = vi.fn();

vi.mock("@cosmjs/tendermint-rpc", () => ({
  connectComet: (...args: unknown[]) => connectCometMock(...args)
}));

vi.mock("@cosmjs/stargate", () => ({
  StargateClient: {
    create: (...args: unknown[]) => stargateCreateMock(...args)
  }
}));

import { Wallet } from "./Wallet";

function makeFakeStargate(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    getChainId: vi.fn().mockResolvedValue("nolus-test-1"),
    getBalance: vi.fn().mockResolvedValue({ denom: "unls", amount: "1000" }),
    getBlock: vi.fn().mockResolvedValue({ header: { height: 12345 } }),
    disconnect: vi.fn(),
    ...overrides
  };
}

function makeFakeComet() {
  return { disconnect: vi.fn() };
}

describe("Wallet", () => {
  beforeEach(() => {
    connectCometMock.mockReset();
    stargateCreateMock.mockReset();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("constructs via getInstance and wires rpc/api", async () => {
    const comet = makeFakeComet();
    const stargate = makeFakeStargate();
    connectCometMock.mockResolvedValue(comet);
    stargateCreateMock.mockResolvedValue(stargate);

    const w = await Wallet.getInstance("rpc-url", "api-url");
    expect(w.rpc).toBe("rpc-url");
    expect(w.api).toBe("api-url");
    expect(w.getTendermintClient()).toBe(comet);
    expect(w.getStargateClient()).toBe(stargate);
    expect(connectCometMock).toHaveBeenCalledWith("rpc-url");
  });

  it("getChainId returns the stargate chain id", async () => {
    const comet = makeFakeComet();
    const stargate = makeFakeStargate({ getChainId: vi.fn().mockResolvedValue("nolus-1") });
    connectCometMock.mockResolvedValue(comet);
    stargateCreateMock.mockResolvedValue(stargate);

    const w = await Wallet.getInstance("rpc", "api");
    await expect(w.getChainId()).resolves.toBe("nolus-1");
  });

  it("getChainId throws when stargate client is missing", async () => {
    connectCometMock.mockResolvedValue(makeFakeComet());
    stargateCreateMock.mockResolvedValue(makeFakeStargate({ getChainId: vi.fn().mockResolvedValue(undefined) }));

    const w = await Wallet.getInstance("rpc", "api");
    await expect(w.getChainId()).rejects.toThrow(/Chain id is missing/);
  });

  it("getBalance delegates to stargate.getBalance", async () => {
    const bal = { denom: "unls", amount: "7777" };
    const stargate = makeFakeStargate({ getBalance: vi.fn().mockResolvedValue(bal) });
    connectCometMock.mockResolvedValue(makeFakeComet());
    stargateCreateMock.mockResolvedValue(stargate);

    const w = await Wallet.getInstance("rpc", "api");
    await expect(w.getBalance("nolus1addr", "unls")).resolves.toEqual(bal);
    expect(stargate.getBalance).toHaveBeenCalledWith("nolus1addr", "unls");
  });

  it("getBalance throws when stargate.getBalance returns a falsy value synchronously", async () => {
    // getBalance() here returns `undefined` (falsy), so the null guard in the
    // production code trips before awaiting.
    const stargate = makeFakeStargate({ getBalance: vi.fn().mockReturnValue(undefined) });
    connectCometMock.mockResolvedValue(makeFakeComet());
    stargateCreateMock.mockResolvedValue(stargate);

    const w = await Wallet.getInstance("rpc", "api");
    await expect(w.getBalance("a", "u")).rejects.toThrow(/Balance is missing/);
  });

  it("getBlockHeight returns header.height", async () => {
    const stargate = makeFakeStargate({ getBlock: vi.fn().mockResolvedValue({ header: { height: 99 } }) });
    connectCometMock.mockResolvedValue(makeFakeComet());
    stargateCreateMock.mockResolvedValue(stargate);

    const w = await Wallet.getInstance("rpc", "api");
    await expect(w.getBlockHeight()).resolves.toBe(99);
  });

  it("getBlockHeight throws when block has no header", async () => {
    const stargate = makeFakeStargate({ getBlock: vi.fn().mockResolvedValue({}) });
    connectCometMock.mockResolvedValue(makeFakeComet());
    stargateCreateMock.mockResolvedValue(stargate);

    const w = await Wallet.getInstance("rpc", "api");
    await expect(w.getBlockHeight()).rejects.toThrow(/Block height is missing/);
  });

  it("destroy disconnects both underlying clients", async () => {
    const comet = makeFakeComet();
    const stargate = makeFakeStargate();
    connectCometMock.mockResolvedValue(comet);
    stargateCreateMock.mockResolvedValue(stargate);

    const w = await Wallet.getInstance("rpc", "api");
    w.destroy();
    expect(stargate.disconnect).toHaveBeenCalledTimes(1);
    expect(comet.disconnect).toHaveBeenCalledTimes(1);
  });

  it("destroy is a no-op when clients are missing (tolerates unwired state)", () => {
    // Build a bare Wallet instance without calling setInstance to hit the undefined guards.
    const bare = Object.create(Wallet.prototype) as Wallet;
    (bare as unknown as { rpc: string; api: string }).rpc = "r";
    (bare as unknown as { rpc: string; api: string }).api = "a";
    expect(() => bare.destroy()).not.toThrow();
  });
});
