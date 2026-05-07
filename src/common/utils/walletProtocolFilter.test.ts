import { describe, it, expect, vi, beforeEach } from "vitest";

// Stub the config store to a single setProtocolFilter spy. We only care
// about the wiring here — protocolFilterForMechanism is a pure mapping,
// applyWalletProtocolFilter is a thin wrapper that resolves "" for any
// non-mapped mechanism (so the filter is cleared, not left stale).
const setProtocolFilter = vi.fn();
vi.mock("@/common/stores/config", () => ({
  useConfigStore: () => ({ setProtocolFilter })
}));

import { WalletConnectMechanism } from "@/common/types";
import { protocolFilterForMechanism, applyWalletProtocolFilter } from "./walletProtocolFilter";

beforeEach(() => {
  setProtocolFilter.mockClear();
});

describe("protocolFilterForMechanism", () => {
  it("maps KEPLR to OSMOSIS", () => {
    expect(protocolFilterForMechanism(WalletConnectMechanism.KEPLR)).toBe("OSMOSIS");
  });

  it("maps EVM_PHANTOM to SOLANA", () => {
    expect(protocolFilterForMechanism(WalletConnectMechanism.EVM_PHANTOM)).toBe("SOLANA");
  });

  it("maps SOL_SOLFLARE to SOLANA", () => {
    expect(protocolFilterForMechanism(WalletConnectMechanism.SOL_SOLFLARE)).toBe("SOLANA");
  });

  it("returns undefined for LEDGER (sunset, intentionally unwired)", () => {
    expect(protocolFilterForMechanism(WalletConnectMechanism.LEDGER)).toBeUndefined();
  });

  it("returns undefined for LEDGER_BLUETOOTH (sunset, intentionally unwired)", () => {
    expect(protocolFilterForMechanism(WalletConnectMechanism.LEDGER_BLUETOOTH)).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(protocolFilterForMechanism(null)).toBeUndefined();
  });

  it("returns undefined for undefined", () => {
    expect(protocolFilterForMechanism(undefined)).toBeUndefined();
  });
});

describe("applyWalletProtocolFilter", () => {
  it("calls setProtocolFilter('OSMOSIS') for KEPLR", () => {
    applyWalletProtocolFilter(WalletConnectMechanism.KEPLR);
    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("OSMOSIS");
  });

  it("calls setProtocolFilter('SOLANA') for EVM_PHANTOM", () => {
    applyWalletProtocolFilter(WalletConnectMechanism.EVM_PHANTOM);
    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("SOLANA");
  });

  it("calls setProtocolFilter('SOLANA') for SOL_SOLFLARE", () => {
    applyWalletProtocolFilter(WalletConnectMechanism.SOL_SOLFLARE);
    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("SOLANA");
  });

  it("calls setProtocolFilter('') for LEDGER", () => {
    applyWalletProtocolFilter(WalletConnectMechanism.LEDGER);
    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("");
  });

  it("calls setProtocolFilter('') for LEDGER_BLUETOOTH", () => {
    applyWalletProtocolFilter(WalletConnectMechanism.LEDGER_BLUETOOTH);
    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("");
  });

  it("calls setProtocolFilter('') for null", () => {
    applyWalletProtocolFilter(null);
    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("");
  });

  it("calls setProtocolFilter('') for undefined", () => {
    applyWalletProtocolFilter(undefined);
    expect(setProtocolFilter).toHaveBeenCalledTimes(1);
    expect(setProtocolFilter).toHaveBeenCalledWith("");
  });
});
