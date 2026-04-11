import { Logger, WalletManager, WalletUtils } from ".";
import { ChainConstants } from "@nolus/nolusjs";
import { BackendApi } from "@/common/api";
import type { ValidatorInfo } from "@/common/api/types/staking";

function transformValidator(v: ValidatorInfo) {
  return {
    operator_address: v.operator_address,
    consensus_pubkey: null,
    jailed: v.jailed,
    status: v.status === "bonded" ? "BOND_STATUS_BONDED" : v.status,
    tokens: v.tokens,
    delegator_shares: v.delegator_shares,
    unbonding_time: v.unbonding_time,
    description: {
      moniker: v.moniker,
      identity: v.identity,
      website: v.website,
      details: v.description
    },
    commission: {
      commission_rates: {
        rate: v.commission_rate,
        max_rate: v.max_commission_rate,
        max_change_rate: v.max_commission_change_rate
      }
    }
  };
}

export class NetworkUtils {
  static async loadDelegatorValidators() {
    const walletAddress = WalletManager.getWalletAddress() || "";
    if (!walletAddress) {
      return [];
    }

    try {
      const positions = await BackendApi.getStakingPositions(walletAddress);
      const validatorAddresses = positions.delegations.map((d) => d.validator_address);

      const validators = await BackendApi.getValidators();
      return validators.filter((v) => validatorAddresses.includes(v.operator_address)).map(transformValidator);
    } catch (error) {
      Logger.error(error);
      return [];
    }
  }

  static async loadValidators() {
    try {
      const validators = await BackendApi.getValidators("bonded");
      return validators.map(transformValidator);
    } catch (error) {
      Logger.error(error);
      return [];
    }
  }

  static async loadDelegations() {
    if (!WalletUtils.isAuth()) {
      return [];
    }

    const walletAddress = WalletManager.getWalletAddress() || "";
    if (!walletAddress) {
      return [];
    }

    try {
      const positions = await BackendApi.getStakingPositions(walletAddress);
      // Transform to expected format
      return positions.delegations.map((d) => ({
        delegation: {
          delegator_address: walletAddress,
          validator_address: d.validator_address,
          shares: d.shares
        },
        balance: d.balance
      }));
    } catch (error) {
      Logger.error(error);
      return [];
    }
  }

  static async loadDelegator() {
    if (!WalletUtils.isAuth()) {
      return { rewards: [], total: [] };
    }

    const walletAddress = WalletManager.getWalletAddress() || "";
    if (!walletAddress) {
      return { rewards: [], total: [] };
    }

    try {
      const positions = await BackendApi.getStakingPositions(walletAddress);
      // Transform to expected format
      return {
        rewards: positions.rewards.map((r) => ({
          validator_address: r.validator_address,
          reward: r.rewards
        })),
        total: [{ denom: ChainConstants.COIN_MINIMAL_DENOM, amount: positions.total_rewards }]
      };
    } catch (error) {
      Logger.error(error);
      return { rewards: [], total: [] };
    }
  }

  static async loadUnboundingDelegations() {
    if (!WalletUtils.isAuth()) {
      return [];
    }

    const walletAddress = WalletManager.getWalletAddress() || "";
    if (!walletAddress) {
      return [];
    }

    try {
      const positions = await BackendApi.getStakingPositions(walletAddress);
      // Transform to expected format
      return positions.unbonding.map((u) => ({
        delegator_address: walletAddress,
        validator_address: u.validator_address,
        entries: u.entries.map((e) => ({
          completion_time: e.completion_time,
          balance: e.balance,
          creation_height: e.creation_height
        }))
      }));
    } catch (error) {
      Logger.error(error);
      return [];
    }
  }

  static async loadValidator(validatorAddress: string) {
    try {
      const validator = await BackendApi.getValidator(validatorAddress);
      return { validator: transformValidator(validator) };
    } catch (error) {
      Logger.error(error);
      return { validator: null };
    }
  }
}
