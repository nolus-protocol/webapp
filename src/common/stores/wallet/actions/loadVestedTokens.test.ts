import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("@/common/utils", () => ({
  WalletAccess: { isAuth: vi.fn() },
  WalletStorage: { getWalletAddress: vi.fn() }
}));

vi.mock("@/common/api", () => ({
  BackendApi: { getAccount: vi.fn() }
}));

import { WalletAccess, WalletStorage } from "@/common/utils";
import { BackendApi } from "@/common/api";
import { loadVestedTokens } from "./loadVestedTokens";
import type { Store } from "../types";

function makeStore(): Store {
  return {
    vest: [],
    delegated_vesting: undefined,
    delegated_free: undefined,
    apr: 0,
    $patch: vi.fn()
  };
}

function vestingAccount() {
  return {
    account: {
      base_vesting_account: {
        end_time: 1767225600,
        original_vesting: [{ amount: "1000", denom: "unls" }],
        delegated_vesting: [{ amount: "300", denom: "unls" }],
        delegated_free: [{ amount: "50", denom: "unls" }]
      },
      start_time: 1735689600
    }
  };
}

beforeEach(() => {
  vi.mocked(WalletAccess.isAuth).mockReset();
  vi.mocked(WalletStorage.getWalletAddress).mockReset();
  vi.mocked(BackendApi.getAccount).mockReset();
});

describe("loadVestedTokens", () => {
  it("clears vesting state and returns [] when not authenticated", async () => {
    vi.mocked(WalletAccess.isAuth).mockReturnValue(false);
    const store = makeStore();
    store.vest = [{ start: new Date(0), end: new Date(1), amount: { denom: "unls", amount: "1" } }];

    const items = await loadVestedTokens.call(store);

    expect(items).toEqual([]);
    expect(store.vest).toEqual([]);
    expect(store.delegated_vesting).toBeUndefined();
    expect(store.delegated_free).toBeUndefined();
    expect(BackendApi.getAccount).not.toHaveBeenCalled();
  });

  it("clears vesting state and returns [] when no wallet address is stored", async () => {
    vi.mocked(WalletAccess.isAuth).mockReturnValue(true);
    vi.mocked(WalletStorage.getWalletAddress).mockReturnValue("");
    const store = makeStore();

    const items = await loadVestedTokens.call(store);

    expect(items).toEqual([]);
    expect(BackendApi.getAccount).not.toHaveBeenCalled();
  });

  it("populates vest and delegated fields from a base_vesting_account", async () => {
    vi.mocked(WalletAccess.isAuth).mockReturnValue(true);
    vi.mocked(WalletStorage.getWalletAddress).mockReturnValue("nolus1abc");
    vi.mocked(BackendApi.getAccount).mockResolvedValue(vestingAccount());
    const store = makeStore();

    const items = await loadVestedTokens.call(store);

    expect(items).toHaveLength(1);
    const item = items[0];
    if (item === undefined) throw new Error("expected one vesting item");
    expect(item.amount).toEqual({ amount: "1000", denom: "unls" });
    expect(store.vest).toHaveLength(1);
    const vestEntry = store.vest[0];
    if (vestEntry === undefined) throw new Error("expected one vest entry on the store");
    expect(vestEntry.amount).toEqual({ amount: "1000", denom: "unls" });
    expect(vestEntry.start).toEqual(new Date(1735689600 * 1000));
    expect(vestEntry.end).toEqual(new Date(1767225600 * 1000));
    expect(store.delegated_vesting).toEqual({ amount: "300", denom: "unls" });
    expect(store.delegated_free).toEqual({ amount: "50", denom: "unls" });
  });

  it("throws when base_vesting_account carries no original_vesting entries", async () => {
    vi.mocked(WalletAccess.isAuth).mockReturnValue(true);
    vi.mocked(WalletStorage.getWalletAddress).mockReturnValue("nolus1abc");
    const malformed = vestingAccount();
    malformed.account.base_vesting_account.original_vesting = [];
    vi.mocked(BackendApi.getAccount).mockResolvedValue(malformed);
    const store = makeStore();

    await expect(loadVestedTokens.call(store)).rejects.toThrow("no original_vesting entries");
  });

  it("clears vesting state when the account has no base_vesting_account", async () => {
    vi.mocked(WalletAccess.isAuth).mockReturnValue(true);
    vi.mocked(WalletStorage.getWalletAddress).mockReturnValue("nolus1abc");
    vi.mocked(BackendApi.getAccount).mockResolvedValue({ account: {} });
    const store = makeStore();
    store.vest = [{ start: new Date(0), end: new Date(1), amount: { denom: "unls", amount: "1" } }];

    const items = await loadVestedTokens.call(store);

    expect(items).toEqual([]);
    expect(store.vest).toEqual([]);
    expect(store.delegated_vesting).toBeUndefined();
    expect(store.delegated_free).toBeUndefined();
  });
});
