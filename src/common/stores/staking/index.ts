/**
 * Staking Store - Validators and staking positions from backend
 *
 * Uses WebSocket for real-time updates on staking positions.
 * Replaces direct Cosmos SDK queries.
 */

import { defineStore } from "pinia";
import { ref, computed } from "vue";
import {
  BackendApi,
  WebSocketClient,
  type ValidatorInfo,
  type StakingPosition,
  type StakingPositionsResponse,
  type UnbondingPosition,
  type ValidatorReward,
  type StakingParams
} from "@/common/api";
import { useWalletWatcher } from "@/common/composables/useWalletWatcher";
import { useWebSocketLifecycle } from "@/common/composables/useWebSocketLifecycle";

export const useStakingStore = defineStore("staking", () => {
  // State
  const validators = ref<ValidatorInfo[]>([]);
  const delegations = ref<StakingPosition[]>([]);
  const unbonding = ref<UnbondingPosition[]>([]);
  const rewards = ref<ValidatorReward[]>([]);
  const params = ref<StakingParams | null>(null);
  const address = ref<string | null>(null);
  const totalStaked = ref<string>("0");
  const totalRewards = ref<string>("0");

  const validatorsLoading = ref(false);
  const positionsLoading = ref(false);
  const error = ref<string | null>(null);
  const lastUpdated = ref<Date | null>(null);

  // Computed
  const hasPositions = computed(() => delegations.value.length > 0 || unbonding.value.length > 0);
  const validatorCount = computed(() => validators.value.length);

  const activeValidators = computed(() => validators.value.filter((v) => v.status === "bonded" && !v.jailed));

  const totalDelegatedAmount = computed(() => {
    return delegations.value.reduce((sum, d) => {
      return sum + parseFloat(d.balance.amount);
    }, 0);
  });

  const totalRewardsAmount = computed(() => {
    return rewards.value.reduce((sum, r) => {
      return sum + r.rewards.reduce((rSum, reward) => rSum + parseFloat(reward.amount), 0);
    }, 0);
  });

  /**
   * Get a validator by operator address
   */
  function getValidator(operatorAddress: string): ValidatorInfo | undefined {
    return validators.value.find((v) => v.operator_address === operatorAddress);
  }

  /**
   * Get staking position for a validator
   */
  function getDelegation(validatorAddress: string): StakingPosition | undefined {
    return delegations.value.find((d) => d.validator_address === validatorAddress);
  }

  /**
   * Get unbonding entries for a validator
   */
  function getUnbonding(validatorAddress: string): UnbondingPosition | undefined {
    return unbonding.value.find((u) => u.validator_address === validatorAddress);
  }

  /**
   * Get rewards for a validator
   */
  function getRewards(validatorAddress: string): ValidatorReward | undefined {
    return rewards.value.find((r) => r.validator_address === validatorAddress);
  }

  /**
   * Fetch all validators
   */
  async function fetchValidators(status?: string): Promise<void> {
    validatorsLoading.value = true;
    error.value = null;

    try {
      validators.value = await BackendApi.getValidators(status);
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch validators";
      console.error("[StakingStore] Failed to fetch validators:", e);
    } finally {
      validatorsLoading.value = false;
    }
  }

  /**
   * Fetch staking positions for connected address
   */
  async function fetchPositions(): Promise<void> {
    if (!address.value) {
      return;
    }

    positionsLoading.value = true;
    error.value = null;

    try {
      const response: StakingPositionsResponse = await BackendApi.getStakingPositions(address.value);
      delegations.value = response.delegations;
      unbonding.value = response.unbonding;
      rewards.value = response.rewards;
      totalStaked.value = response.total_staked;
      totalRewards.value = response.total_rewards;
      lastUpdated.value = new Date();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch positions";
      console.error("[StakingStore] Failed to fetch positions:", e);
    } finally {
      positionsLoading.value = false;
    }
  }

  /**
   * Fetch staking parameters
   */
  async function fetchParams(): Promise<void> {
    try {
      params.value = await BackendApi.getStakingParams();
    } catch (e) {
      error.value = e instanceof Error ? e.message : "Failed to fetch staking params";
      console.error("[StakingStore] Failed to fetch params:", e);
    }
  }

  // WebSocket lifecycle: subscribe, fetch, unsubscribe, cleanup
  const { setAddress, cleanup } = useWebSocketLifecycle({
    address,
    subscribe: (addr) =>
      WebSocketClient.subscribeStaking(addr, (wsAddr, response) => {
        if (wsAddr === address.value && response) {
          if (response.delegations) delegations.value = response.delegations;
          if (response.unbonding) unbonding.value = response.unbonding;
          if (response.rewards) rewards.value = response.rewards;
          if (response.total_staked) totalStaked.value = response.total_staked;
          if (response.total_rewards) totalRewards.value = response.total_rewards;
          lastUpdated.value = new Date();
        }
      }),
    fetch: fetchPositions,
    resetState: () => {
      delegations.value = [];
      unbonding.value = [];
      rewards.value = [];
      totalStaked.value = "0";
      totalRewards.value = "0";
      lastUpdated.value = null;
      error.value = null;
    }
  });

  /**
   * Initialize the store
   */
  async function initialize(): Promise<void> {
    await Promise.all([fetchValidators(), fetchParams()]);
  }

  // Self-register: watch wallet address changes from connectionStore.
  useWalletWatcher(setAddress, cleanup);

  return {
    // State
    validators,
    delegations,
    unbonding,
    rewards,
    params,
    address,
    totalStaked,
    totalRewards,
    validatorsLoading,
    positionsLoading,
    error,
    lastUpdated,

    // Computed
    hasPositions,
    validatorCount,
    activeValidators,
    totalDelegatedAmount,
    totalRewardsAmount,

    // Getters
    getValidator,
    getDelegation,
    getUnbonding,
    getRewards,

    // Actions
    fetchValidators,
    fetchPositions,
    fetchParams,
    setAddress,
    initialize,
    cleanup
  };
});
