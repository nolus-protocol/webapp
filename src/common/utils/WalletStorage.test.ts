import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// WalletStorage imports `{ useWalletStore }` which transitively pulls heavy
// modules. We only exercise the localStorage gate, so stub it.
vi.mock("../stores/wallet", () => ({
  useWalletStore: () => ({ wallet: undefined })
}));

import { WalletStorage } from "./WalletStorage";
import { WalletConnectMechanism } from "@/common/types";

describe("WalletStorage.getWalletConnectMechanism", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns null when no mechanism is stored", () => {
    expect(WalletStorage.getWalletConnectMechanism()).toBeNull();
  });

  it("returns the stored mechanism when it is a valid enum value", () => {
    localStorage.setItem(WalletStorage.WALLET_CONNECT_MECHANISM, WalletConnectMechanism.KEPLR);
    expect(WalletStorage.getWalletConnectMechanism()).toBe(WalletConnectMechanism.KEPLR);
  });

  it("clears stored info and returns null when stored value is not a current enum value", () => {
    localStorage.setItem(WalletStorage.WALLET_CONNECT_MECHANISM, "retired-wallet");
    localStorage.setItem(WalletStorage.WALLET_PUBKEY, "deadbeef");

    expect(WalletStorage.getWalletConnectMechanism()).toBeNull();
    expect(localStorage.getItem(WalletStorage.WALLET_CONNECT_MECHANISM)).toBeNull();
    expect(localStorage.getItem(WalletStorage.WALLET_PUBKEY)).toBeNull();
  });

  it("clears stored info for arbitrary unknown strings", () => {
    localStorage.setItem(WalletStorage.WALLET_CONNECT_MECHANISM, "garbage");
    expect(WalletStorage.getWalletConnectMechanism()).toBeNull();
    expect(localStorage.getItem(WalletStorage.WALLET_CONNECT_MECHANISM)).toBeNull();
  });
});

describe("WalletStorage protocol filter surface (post-refactor)", () => {
  // After the wallet-driven network refactor, the configStore is the sole
  // owner of protocolFilter. WalletStorage must NOT expose a PROTOCOL_FILTER
  // constant or a getProtocolFilter() static — those were the legacy
  // localStorage-backed read path and are gone.

  it("does not expose a PROTOCOL_FILTER constant", () => {
    expect((WalletStorage as unknown as Record<string, unknown>).PROTOCOL_FILTER).toBeUndefined();
  });

  it("does not expose a getProtocolFilter static", () => {
    expect((WalletStorage as unknown as Record<string, unknown>).getProtocolFilter).toBeUndefined();
  });
});
