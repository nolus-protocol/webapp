import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { SigningKey, Wallet as EthersWallet, hashMessage, hexlify, toUtf8Bytes } from "ethers";

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
  EnvNetworkUtils: { getStoredNetworkName: vi.fn(() => "mainnet") },
  WalletManager: {
    getWalletConnectMechanism: vi.fn(() => undefined)
  }
}));

vi.mock("@/config/global", () => ({
  KeplrEmbedChainInfo: vi.fn(() => ({
    bech32Config: { bech32PrefixAccAddr: "nolus" }
  }))
}));

import { MetaMaskWallet } from "./wallet";
import type { NetworkData, API } from "@/common/types";
import type { Window as MMWindow } from "../window";

// Use a fixed private key so we produce real valid secp256k1 signatures
// without relying on jsdom's crypto entropy source.
const TEST_PRIV_KEY = "0x4c0883a69102937d6231471b5dbb6204fe5129617082796bb3b72f23cfb3d6f1";
const testWallet = new EthersWallet(TEST_PRIV_KEY);

function mkProvider() {
  const ethAddr = testWallet.address;
  const request = vi.fn(async (args: { method: string; params?: unknown[] }) => {
    switch (args.method) {
      case "eth_requestAccounts":
        return [ethAddr];
      case "eth_accounts":
        return [ethAddr];
      case "personal_sign": {
        const msgHex: string = (args.params as string[])[0];
        // Decode hex to string, sign with ethers wallet's signing key
        const bytes = new Uint8Array(msgHex.slice(2).length / 2);
        for (let i = 0; i < bytes.length; i++) {
          bytes[i] = parseInt(msgHex.slice(2 + i * 2, 4 + i * 2), 16);
        }
        const text = new TextDecoder().decode(bytes);
        const sig = await testWallet.signMessage(text);
        return sig;
      }
      default:
        throw new Error(`Unhandled method ${args.method}`);
    }
  });
  return { request };
}

function stubEthereum(provider: unknown) {
  const w = window as unknown as MMWindow;
  w.ethereum = provider as MMWindow["ethereum"];
}
function stubPhantom(provider: unknown) {
  const w = window as unknown as MMWindow;
  w.phantom = { ethereum: provider } as MMWindow["phantom"];
}
function clearWindow() {
  const w = window as unknown as MMWindow;
  delete w.ethereum;
  delete w.phantom;
}

function networkStub(): NetworkData {
  return {
    embedChainInfo: () => ({ bech32Config: { bech32PrefixAccAddr: "nolus" } })
  } as unknown as NetworkData;
}

describe("MetaMaskWallet", () => {
  beforeEach(() => {
    stargateConnectMock.mockReset();
    stargateConnectMock.mockResolvedValue({ getChainId: vi.fn().mockResolvedValue("nolus-1") });
  });

  afterEach(() => {
    clearWindow();
    vi.restoreAllMocks();
  });

  it("connectCustom derives bech32 nolus address and secp256k1 compressed pubkey from signed challenge", async () => {
    const provider = mkProvider();
    stubEthereum(provider);

    const mm = new MetaMaskWallet();
    const { bech32Addr, ethAddress, pubkeyAny } = await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());
    expect(bech32Addr).toMatch(/^nolus1[a-z0-9]+$/);
    expect(ethAddress).toBe(testWallet.address);
    expect(pubkeyAny).toBeInstanceOf(Uint8Array);
    expect(mm.chainId).toBe("nolus-1");
    expect(mm.type).toBe("evm");
    expect(mm.algo).toBe("secp256k1");
    expect(mm.pubKey).toBeInstanceOf(Uint8Array);
    // Compressed secp256k1 pubkey is 33 bytes, first byte 0x02 or 0x03
    expect(mm.pubKey!.length).toBe(33);
    expect([0x02, 0x03]).toContain(mm.pubKey![0]);
  });

  it("connect uses NolusClient + KeplrEmbedChainInfo and populates chainId/address", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await mm.connect("metamask");
    expect(mm.chainId).toBe("nolus-1");
    expect(mm.address).toMatch(/^nolus1/);
  });

  it("getChainId returns cached chainId", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());
    await expect(mm.getChainId()).resolves.toBe("nolus-1");
  });

  it("picks the last provider in ethereum.providers[] when present", async () => {
    const primary = mkProvider();
    const fallback = mkProvider();
    const w = window as unknown as MMWindow;
    w.ethereum = { providers: [fallback, primary] } as MMWindow["ethereum"];
    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());
    // Last provider is `primary`
    expect(primary.request).toHaveBeenCalled();
  });

  it("uses phantom.ethereum when WalletConnectMechanism is EVM_PHANTOM", async () => {
    const phantomProv = mkProvider();
    const ethProv = mkProvider();
    stubPhantom(phantomProv);
    stubEthereum(ethProv);
    const utilsMock = (await import("@/common/utils")) as unknown as {
      WalletManager: { getWalletConnectMechanism: ReturnType<typeof vi.fn> };
    };
    utilsMock.WalletManager.getWalletConnectMechanism.mockReturnValueOnce("evm_phantom");

    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());
    expect(phantomProv.request).toHaveBeenCalled();
  });

  it("makeWCOfflineSigner.getAccounts returns a single account with the bech32 address", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());
    const signer = mm.makeWCOfflineSigner();
    const accounts = await signer.getAccounts();
    expect(accounts).toHaveLength(1);
    expect(accounts[0].address).toBe(mm.address);
    expect(accounts[0].algo).toBe("secp256k1");
    expect(accounts[0].pubkey).toEqual(mm.pubKey);
    expect(signer.type).toBe("evm");
    expect(signer.chainId).toBe("nolus-1");
  });

  it("makeWCOfflineSigner.signDirect forwards a personal_sign call and returns a valid signature envelope", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());

    const signer = mm.makeWCOfflineSigner();
    const { TxBody, AuthInfo, Fee, SignerInfo } = await import("cosmjs-types/cosmos/tx/v1beta1/tx");
    const { SignMode } = await import("cosmjs-types/cosmos/tx/signing/v1beta1/signing");

    const txBody = TxBody.fromPartial({ memo: "m", messages: [] });
    const bodyBytes = TxBody.encode(txBody).finish();
    const authInfo = AuthInfo.fromPartial({
      fee: Fee.fromPartial({ amount: [{ amount: "1", denom: "unls" }], gasLimit: 100n }),
      signerInfos: [
        SignerInfo.fromPartial({
          publicKey: { typeUrl: "/cosmos.crypto.secp256k1.PubKey", value: new Uint8Array([1]) },
          sequence: 0n,
          modeInfo: { single: { mode: SignMode.SIGN_MODE_DIRECT } }
        })
      ]
    });
    const authInfoBytes = AuthInfo.encode(authInfo).finish();

    const res = await signer.signDirect("ignored", {
      bodyBytes,
      authInfoBytes,
      chainId: "nolus-1",
      accountNumber: 1n
    });
    expect(res.signature.pub_key.type).toBe("/cosmos.crypto.secp256k1.PubKey");
    expect(typeof res.signature.signature).toBe("string");
    expect(res.signed.chainId).toBe("nolus-1");
    expect(res.signed.accountNumber).toBe(1n);
    expect(res.signed.bodyBytes).toEqual(bodyBytes);
    expect(res.signed.authInfoBytes).toBeInstanceOf(Uint8Array);
    // authInfoBytes should now have EIP-191 mode set by ensureEip191AuthInfoBytes
    const decoded = AuthInfo.decode(res.signed.authInfoBytes);
    expect(decoded.signerInfos[0].modeInfo?.single?.mode).toBe(SignMode.SIGN_MODE_EIP_191);
  });

  it("produces a recoverable secp256k1 pubkey that matches the ethers signer", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());

    // Derive expected compressed pubkey from the same challenge "Generate address"
    const expectedSig = await testWallet.signMessage("Generate address");
    const fullPubkey = SigningKey.recoverPublicKey(hashMessage("Generate address"), expectedSig);
    const expectedUncompressed = Buffer.from(fullPubkey.slice(2), "hex");
    const x = expectedUncompressed.slice(1, 33);
    const y = expectedUncompressed.slice(33);
    const expectedCompressed = Buffer.concat([Buffer.from([y[y.length - 1] % 2 ? 0x03 : 0x02]), x]);
    expect(Buffer.from(mm.pubKey!)).toEqual(expectedCompressed);
  });

  it("bech32 prefix comes from the ChainInfo returned by embedChainInfo (e.g. osmo)", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const osmoNet = {
      embedChainInfo: () => ({ bech32Config: { bech32PrefixAccAddr: "osmo" } })
    } as unknown as NetworkData;
    const mm = new MetaMaskWallet();
    const { bech32Addr } = await mm.connectCustom({ rpc: "r", api: "a" } as API, osmoNet);
    expect(bech32Addr).toMatch(/^osmo1/);
  });

  it("personal_sign is called with 0x-hex of the challenge text", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());
    const personalSignCalls = provider.request.mock.calls.filter((c) => c[0].method === "personal_sign");
    expect(personalSignCalls.length).toBeGreaterThan(0);
    const firstChallenge = personalSignCalls[0][0].params[0];
    expect(firstChallenge).toBe(hexlify(toUtf8Bytes("Generate address")));
  });

  it("throws when eth_requestAccounts rejects (user denies)", async () => {
    const provider = {
      request: vi.fn(async (args: { method: string }) => {
        if (args.method === "eth_requestAccounts") throw new Error("user denied");
        return [];
      })
    };
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await expect(mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub())).rejects.toThrow(/user denied/);
  });

  it("ethAddress getter returns the address from eth_accounts", async () => {
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new MetaMaskWallet();
    await mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub());
    expect(mm.ethAddress).toBe(testWallet.address);
  });

  it("throws a descriptive error when a malformed pubkey has short y-bytes", async () => {
    // Use vi.doMock to swap in a wallet module that imports a patched `ethers`
    // where SigningKey.recoverPublicKey returns a truncated pubkey hex. That
    // simulates a malformed pubkey (getBytes → < 33-byte y half).
    vi.resetModules();
    vi.doMock("ethers", async () => {
      const actual = await vi.importActual<typeof import("ethers")>("ethers");
      return {
        ...actual,
        SigningKey: {
          ...actual.SigningKey,
          // Return an uncompressed pubkey hex with only the 0x04 prefix byte.
          // getBytes will give a 1-byte array; slicing yields empty x and y.
          recoverPublicKey: () => "0x04"
        }
      };
    });

    const { MetaMaskWallet: PatchedWallet } = await import("./wallet");
    const provider = mkProvider();
    stubEthereum(provider);
    const mm = new PatchedWallet();
    await expect(mm.connectCustom({ rpc: "r", api: "a" } as API, networkStub())).rejects.toThrow(
      /EVM wallet: unexpected pubkey length/
    );

    vi.doUnmock("ethers");
    vi.resetModules();
  });
});
