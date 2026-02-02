import type { IObjectKeys } from "../types";
import { Logger, WalletManager, WalletUtils } from ".";
import { fetchEndpoints } from "./EndpointService";
import { ChainConstants } from "@nolus/nolusjs";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { toHex } from "@cosmjs/encoding";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { connectComet, type ReadonlyDateWithNanoseconds, type TxSearchResponse } from "@cosmjs/tendermint-rpc";
import { decodeTxRaw, type DecodedTxRaw, Registry } from "@cosmjs/proto-signing";
import { BackendApi } from "@/common/api";

export class NetworkUtils {
  static async loadDelegatorValidators() {
    const walletAddress = WalletManager.getWalletAddress() || "";
    if (!walletAddress) {
      return [];
    }

    try {
      const positions = await BackendApi.getStakingPositions(walletAddress);
      // Get unique validator addresses from delegations
      const validatorAddresses = positions.delegations.map((d) => d.validator_address);

      // Fetch full validator info for each
      const validators = await BackendApi.getValidators();
      return validators.filter((v) => validatorAddresses.includes(v.operator_address));
    } catch (error) {
      Logger.error(error);
      return [];
    }
  }

  static async loadValidators() {
    try {
      const validators = await BackendApi.getValidators("bonded");
      // Transform to expected format
      return validators.map((v) => ({
        operator_address: v.operator_address,
        consensus_pubkey: null,
        jailed: v.jailed,
        status: v.status === "bonded" ? "BOND_STATUS_BONDED" : v.status,
        tokens: v.tokens,
        delegator_shares: v.delegator_shares,
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
            max_change_rate: v.max_change_rate
          }
        }
      }));
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

  static async searchTx({ sender_per_page = 5, sender_page = 1, load_sender = true } = {}) {
    const address = WalletManager.getWalletAddress();
    const registry = new Registry(defaultRegistryTypes);
    registry.register("/cosmwasm.wasm.v1.MsgExecuteContract", MsgExecuteContract);

    if (address?.length > 0) {
      const rpc = await getClient();
      const client = await connectComet(rpc);

      const [sender]: any = await Promise.allSettled([
        load_sender
          ? client.txSearch({
              query: `message.sender='${address}'`,
              per_page: sender_per_page,
              page: sender_page,
              order_by: "desc"
            })
          : false
      ]);
      const data = [];
      let sender_total = 0;

      if (sender.value) {
        sender_total = (sender.value as TxSearchResponse).totalCount;
        for (const item of (sender.value as TxSearchResponse).txs) {
          const decodedTx: DecodedTxRaw = decodeTxRaw(item.tx);
          try {
            const msgs = [];
            for (const m of decodedTx.body.messages) {
              msgs.push({
                typeUrl: m.typeUrl,
                data: registry.decode(m)
              });
            }

            const transactionResult = {
              id: item.hash ? toHex(item.hash) : "",
              height: item.height ?? "",
              msgs,
              type: "sender",
              blockDate: null as null | ReadonlyDateWithNanoseconds,
              memo: decodedTx.body.memo ?? "",
              log: item.result.log,
              fee:
                decodedTx?.authInfo?.fee?.amount.filter((coin) => coin.denom === ChainConstants.COIN_MINIMAL_DENOM) ??
                null
            };

            data.push(transactionResult);
          } catch (error) {
            Logger.error(error);
          }
        }
      }

      const promises = data.map(async (item) => {
        try {
          const block = await client.block(item.height);
          item.blockDate = block.block.header.time;
          return item;
        } catch (error) {
          return item;
        }
      });

      const items = await Promise.all(promises);

      return {
        data: items,
        sender_total
      };
    }

    return {
      data: [],
      sender_total: 0
    };
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
      // Transform to expected format
      return {
        validator: {
          operator_address: validator.operator_address,
          consensus_pubkey: null,
          jailed: validator.jailed,
          status: validator.status === "bonded" ? "BOND_STATUS_BONDED" : validator.status,
          tokens: validator.tokens,
          delegator_shares: validator.delegator_shares,
          description: {
            moniker: validator.moniker,
            identity: validator.identity,
            website: validator.website,
            details: validator.description
          },
          commission: {
            commission_rates: {
              rate: validator.commission_rate,
              max_rate: validator.max_commission_rate,
              max_change_rate: validator.max_change_rate
            }
          }
        }
      };
    } catch (error) {
      Logger.error(error);
      return { validator: null };
    }
  }
}

export async function getClient() {
  return (await fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
}
