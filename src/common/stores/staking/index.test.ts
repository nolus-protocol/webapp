import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { setActivePinia, createPinia } from "pinia";

// ThemeManager needs window.matchMedia at module import time.
vi.hoisted(() => {
  if (typeof window !== "undefined" && !window.matchMedia) {
     
    (window as any).matchMedia = () => ({
      matches: false,
      media: "",
      onchange: null,
      addEventListener: () => {},
      removeEventListener: () => {},
      addListener: () => {},
      removeListener: () => {},
      dispatchEvent: () => false
    });
  }
});

const hoisted = vi.hoisted(() => {
  const captured: {
     
    onStaking: ((addr: string, response: any) => void) | null;
    unsubscribe: ReturnType<typeof vi.fn>;
  } = {
    onStaking: null,
    unsubscribe: vi.fn()
  };

  const BackendApi = {
    getValidators: vi.fn(),
    getStakingPositions: vi.fn(),
    getStakingParams: vi.fn()
  };

  const subscribeStaking = vi.fn(
     
    (addr: string, cb: (a: string, resp: any) => void) => {
      captured.onStaking = cb;
      return captured.unsubscribe;
    }
  );

  return { captured, BackendApi, subscribeStaking };
});

vi.mock("@/common/api", () => ({
  BackendApi: hoisted.BackendApi,
  WebSocketClient: {
    subscribeStaking: hoisted.subscribeStaking
  }
}));

// Stub the connection store so useWalletWatcher can read walletAddress/wsReconnectCount
// without pulling in the real connection store (which imports all other stores).
const connectionState = {
  walletAddress: null as string | null,
  wsReconnectCount: 0
};
vi.mock("@/common/stores/connection", () => ({
  useConnectionStore: () => connectionState
}));

import { useStakingStore } from "./index";

const { captured, BackendApi, subscribeStaking } = hoisted;

describe("useStakingStore", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.resetAllMocks();
    captured.onStaking = null;
    captured.unsubscribe = vi.fn();
    subscribeStaking.mockImplementation((_addr, cb) => {
      captured.onStaking = cb;
      return captured.unsubscribe;
    });
    connectionState.walletAddress = null;
    connectionState.wsReconnectCount = 0;
    setActivePinia(createPinia());
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns initial state defaults", () => {
    const store = useStakingStore();
    expect(store.validators).toEqual([]);
    expect(store.delegations).toEqual([]);
    expect(store.unbonding).toEqual([]);
    expect(store.rewards).toEqual([]);
    expect(store.params).toBeNull();
    expect(store.address).toBeNull();
    expect(store.totalStaked).toBe("0");
    expect(store.totalRewards).toBe("0");
    expect(store.validatorsLoading).toBe(false);
    expect(store.positionsLoading).toBe(false);
    expect(store.error).toBeNull();
    expect(store.lastUpdated).toBeNull();
    expect(store.hasPositions).toBe(false);
    expect(store.validatorCount).toBe(0);
    expect(store.activeValidators).toEqual([]);
    expect(store.totalDelegatedAmount).toBe(0);
    expect(store.totalRewardsAmount).toBe(0);
  });

  it("fetchValidators populates on success with optional status", async () => {
    const vals = [
      {
        operator_address: "nolusvaloper1a",
        moniker: "A",
        commission_rate: "0.1",
        max_commission_rate: "0.2",
        max_commission_change_rate: "0.05",
        tokens: "1000",
        delegator_shares: "1000",
        unbonding_height: "0",
        unbonding_time: "0",
        status: "bonded",
        jailed: false
      }
    ];
    BackendApi.getValidators.mockResolvedValueOnce(vals);

    const store = useStakingStore();
    await store.fetchValidators("bonded");

    expect(BackendApi.getValidators).toHaveBeenCalledWith("bonded");
    expect(store.validators).toEqual(vals);
    expect(store.validatorsLoading).toBe(false);
    expect(store.error).toBeNull();
  });

  it("fetchValidators sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getValidators.mockRejectedValueOnce(new Error("nope"));

    const store = useStakingStore();
    await expect(store.fetchValidators()).resolves.toBeUndefined();
    expect(store.error).toBe("nope");
    expect(store.validatorsLoading).toBe(false);

    spy.mockRestore();
  });

  it("fetchValidators falls back to generic message on non-Error reject", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getValidators.mockRejectedValueOnce("boom");

    const store = useStakingStore();
    await store.fetchValidators();
    expect(store.error).toBe("Failed to fetch validators");

    spy.mockRestore();
  });

  it("fetchPositions is a no-op without an address", async () => {
    const store = useStakingStore();
    await store.fetchPositions();
    expect(BackendApi.getStakingPositions).not.toHaveBeenCalled();
    expect(store.positionsLoading).toBe(false);
  });

  it("fetchPositions populates all positional fields when address is set", async () => {
    const response = {
      delegations: [
        {
          validator_address: "v1",
          shares: "1000",
          balance: { denom: "unls", amount: "500" }
        }
      ],
      unbonding: [
        {
          validator_address: "v2",
          entries: [{ completion_time: "t", balance: "10", creation_height: "1" }]
        }
      ],
      rewards: [{ validator_address: "v1", rewards: [{ denom: "unls", amount: "7" }] }],
      total_staked: "500",
      total_rewards: "7"
    };
    BackendApi.getStakingPositions.mockResolvedValueOnce(response);

    const store = useStakingStore();
    await store.setAddress("nolus1x");

    expect(store.address).toBe("nolus1x");
    expect(store.delegations).toEqual(response.delegations);
    expect(store.unbonding).toEqual(response.unbonding);
    expect(store.rewards).toEqual(response.rewards);
    expect(store.totalStaked).toBe("500");
    expect(store.totalRewards).toBe("7");
    expect(store.lastUpdated).toBeInstanceOf(Date);
    expect(store.hasPositions).toBe(true);
  });

  it("fetchPositions sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getStakingPositions.mockRejectedValueOnce(new Error("fail"));

    const store = useStakingStore();
    await store.setAddress("nolus1x"); // triggers fetchPositions internally
    // setAddress swallows by design; check error state
    expect(store.error).toBe("fail");
    expect(store.positionsLoading).toBe(false);

    spy.mockRestore();
  });

  it("fetchParams populates params", async () => {
    BackendApi.getStakingParams.mockResolvedValueOnce({
      unbonding_time: "21d",
      max_validators: 100,
      min_self_delegation: "1"
    });

    const store = useStakingStore();
    await store.fetchParams();
    expect(store.params).toMatchObject({ max_validators: 100 });
  });

  it("fetchParams sets error on failure without throwing", async () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    BackendApi.getStakingParams.mockRejectedValueOnce(new Error("params down"));

    const store = useStakingStore();
    await store.fetchParams();
    expect(store.error).toBe("params down");
    expect(store.params).toBeNull();

    spy.mockRestore();
  });

  it("activeValidators filters by bonded and not jailed", () => {
    const store = useStakingStore();
    const mk = (op: string, status: "bonded" | "unbonding" | "unbonded", jailed: boolean) => ({
      operator_address: op,
      moniker: op,
      commission_rate: "0",
      max_commission_rate: "0",
      max_commission_change_rate: "0",
      tokens: "0",
      delegator_shares: "0",
      unbonding_height: "0",
      unbonding_time: "0",
      status,
      jailed
    });
     
    (store.validators as any).push(mk("v1", "bonded", false), mk("v2", "bonded", true), mk("v3", "unbonded", false));

    expect(store.activeValidators.map((v) => v.operator_address)).toEqual(["v1"]);
  });

  it("totalDelegatedAmount sums parsed balance amounts", () => {
    const store = useStakingStore();
     
    (store.delegations as any).push(
      { validator_address: "v1", shares: "0", balance: { denom: "unls", amount: "100.5" } },
      { validator_address: "v2", shares: "0", balance: { denom: "unls", amount: "50.25" } }
    );
    expect(store.totalDelegatedAmount).toBeCloseTo(150.75, 5);
  });

  it("totalRewardsAmount sums nested reward amounts", () => {
    const store = useStakingStore();
     
    (store.rewards as any).push(
      {
        validator_address: "v1",
        rewards: [
          { denom: "unls", amount: "1.0" },
          { denom: "unls", amount: "2.5" }
        ]
      },
      { validator_address: "v2", rewards: [{ denom: "unls", amount: "0.5" }] }
    );
    expect(store.totalRewardsAmount).toBeCloseTo(4.0, 5);
  });

  it("getValidator / getDelegation / getUnbonding / getRewards look up by address", () => {
    const store = useStakingStore();
    const v = {
      operator_address: "v1",
      moniker: "V1",
      commission_rate: "0",
      max_commission_rate: "0",
      max_commission_change_rate: "0",
      tokens: "0",
      delegator_shares: "0",
      unbonding_height: "0",
      unbonding_time: "0",
      status: "bonded" as const,
      jailed: false
    };
     
    (store.validators as any).push(v);
     
    (store.delegations as any).push({
      validator_address: "v1",
      shares: "1",
      balance: { denom: "unls", amount: "100" }
    });
     
    (store.unbonding as any).push({ validator_address: "v1", entries: [] });
     
    (store.rewards as any).push({ validator_address: "v1", rewards: [] });

    expect(store.getValidator("v1")).toEqual(v);
    expect(store.getValidator("missing")).toBeUndefined();
    expect(store.getDelegation("v1")?.validator_address).toBe("v1");
    expect(store.getDelegation("missing")).toBeUndefined();
    expect(store.getUnbonding("v1")?.validator_address).toBe("v1");
    expect(store.getUnbonding("missing")).toBeUndefined();
    expect(store.getRewards("v1")?.validator_address).toBe("v1");
    expect(store.getRewards("missing")).toBeUndefined();
  });

  it("hasPositions is true when any delegation or unbonding present", () => {
    const store = useStakingStore();
    expect(store.hasPositions).toBe(false);
     
    (store.unbonding as any).push({ validator_address: "v1", entries: [] });
    expect(store.hasPositions).toBe(true);
  });

  it("ws callback partially updates state only when address matches", async () => {
    BackendApi.getStakingPositions.mockResolvedValueOnce({
      delegations: [],
      unbonding: [],
      rewards: [],
      total_staked: "0",
      total_rewards: "0"
    });

    const store = useStakingStore();
    await store.setAddress("nolus1x");

    expect(captured.onStaking).not.toBeNull();

    // Mismatched address: ignored
    captured.onStaking!("nolus1OTHER", {
      delegations: [{ validator_address: "ignored", shares: "0", balance: { denom: "u", amount: "0" } }]
    });
    expect(store.delegations).toEqual([]);

    // Null response: ignored (response is falsy)
    captured.onStaking!("nolus1x", null);
    expect(store.delegations).toEqual([]);

    // Matching address + partial response: fields only updated where present
    captured.onStaking!("nolus1x", {
      delegations: [{ validator_address: "v1", shares: "1", balance: { denom: "u", amount: "5" } }],
      total_staked: "5"
      // rewards, unbonding, total_rewards omitted — should remain at defaults
    });
    expect(store.delegations.length).toBe(1);
    expect(store.totalStaked).toBe("5");
    expect(store.unbonding).toEqual([]);
    expect(store.rewards).toEqual([]);
  });

  it("initialize fetches validators and params concurrently", async () => {
    BackendApi.getValidators.mockResolvedValueOnce([]);
    BackendApi.getStakingParams.mockResolvedValueOnce({
      unbonding_time: "0",
      max_validators: 0,
      min_self_delegation: "0"
    });

    const store = useStakingStore();
    await store.initialize();

    expect(BackendApi.getValidators).toHaveBeenCalledTimes(1);
    expect(BackendApi.getStakingParams).toHaveBeenCalledTimes(1);
  });

  it("cleanup unsubscribes and resets state", async () => {
    BackendApi.getStakingPositions.mockResolvedValueOnce({
      delegations: [{ validator_address: "v1", shares: "1", balance: { denom: "u", amount: "1" } }],
      unbonding: [],
      rewards: [],
      total_staked: "1",
      total_rewards: "0"
    });

    const store = useStakingStore();
    await store.setAddress("nolus1x");
    expect(store.delegations.length).toBe(1);

    store.cleanup();
    expect(captured.unsubscribe).toHaveBeenCalledTimes(1);
    expect(store.address).toBeNull();
    expect(store.delegations).toEqual([]);
    expect(store.totalStaked).toBe("0");
  });
});
