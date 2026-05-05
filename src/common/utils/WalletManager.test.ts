import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// WalletManager imports `{ useWalletStore }` (and config store) which transitively
// pull heavy modules. We only exercise the localStorage gate, so stub them.
vi.mock("../stores/wallet", () => ({
  useWalletStore: () => ({ wallet: undefined })
}));
vi.mock("../stores/config", () => ({
  useConfigStore: () => ({ isValidNetworkFilter: () => true })
}));
vi.mock("@/config/global", () => ({
  DefaultProtocolFilter: "ALL"
}));

import { WalletManager } from "./WalletManager";
import { WalletConnectMechanism } from "@/common/types";

describe("WalletManager.getWalletConnectMechanism", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("returns null when no mechanism is stored", () => {
    expect(WalletManager.getWalletConnectMechanism()).toBeNull();
  });

  it("returns the stored mechanism when it is a valid enum value", () => {
    localStorage.setItem(WalletManager.WALLET_CONNECT_MECHANISM, WalletConnectMechanism.KEPLR);
    expect(WalletManager.getWalletConnectMechanism()).toBe(WalletConnectMechanism.KEPLR);
  });

  it("clears stored info and returns null when stored value is not a current enum value", () => {
    localStorage.setItem(WalletManager.WALLET_CONNECT_MECHANISM, "retired-wallet");
    localStorage.setItem(WalletManager.WALLET_PUBKEY, "deadbeef");

    expect(WalletManager.getWalletConnectMechanism()).toBeNull();
    expect(localStorage.getItem(WalletManager.WALLET_CONNECT_MECHANISM)).toBeNull();
    expect(localStorage.getItem(WalletManager.WALLET_PUBKEY)).toBeNull();
  });

  it("clears stored info for arbitrary unknown strings", () => {
    localStorage.setItem(WalletManager.WALLET_CONNECT_MECHANISM, "garbage");
    expect(WalletManager.getWalletConnectMechanism()).toBeNull();
    expect(localStorage.getItem(WalletManager.WALLET_CONNECT_MECHANISM)).toBeNull();
  });
});
