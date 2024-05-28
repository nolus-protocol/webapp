import type { IObjectKeys } from "../types";
import { AppUtils, EnvNetworkUtils, Logger, WalletManager, WalletUtils } from ".";
import { ChainConstants } from "@nolus/nolusjs";
import { MsgExecuteContract } from "cosmjs-types/cosmwasm/wasm/v1/tx";
import { toHex } from "@cosmjs/encoding";
import { defaultRegistryTypes } from "@cosmjs/stargate";
import { connectComet, type ReadonlyDateWithNanoseconds, type TxSearchResponse } from "@cosmjs/tendermint-rpc";
import { decodeTxRaw, type DecodedTxRaw, Registry } from "@cosmjs/proto-signing";

export class NetworkUtils {
  static async loadDelegatorValidators() {
    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    const limit = 100;
    const offset = 0;
    const walletAddress = WalletManager.getWalletAddress() || "";

    return await loadDelegatorValidators(url, [], walletAddress, offset, limit);
  }

  static async loadValidators() {
    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    const limit = 100;
    const offset = 0;
    const walletAddress = WalletManager.getWalletAddress() || "";

    return await loadValidators(url, [], walletAddress, offset, limit);
  }

  static async loadDelegations() {
    if (!WalletUtils.isAuth()) {
      return [];
    }

    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    const limit = 100;
    const offset = 0;
    const walletAddress = WalletManager.getWalletAddress() || "";

    return await loadDelegations(url, [], walletAddress, offset, limit);
  }

  static async loadDelegator() {
    if (!WalletUtils.isAuth()) {
      return [];
    }

    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    const walletAddress = WalletManager.getWalletAddress() || "";

    return await fetch(`${url}/cosmos/distribution/v1beta1/delegators/${walletAddress}/rewards`).then((data) =>
      data.json()
    );
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

    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    const limit = 100;
    const offset = 0;
    const walletAddress = WalletManager.getWalletAddress() || "";

    return await loadUnboundingDelegations(url, [], walletAddress, offset, limit);
  }

  static async loadValidator(validatorAddress: string) {
    const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;
    return await fetch(`${url}/cosmos/staking/v1beta1/validators/${validatorAddress}`).then((data) => data.json());
  }
}

export async function loadDelegatorValidators(
  url: string,
  validators: IObjectKeys[],
  address: string,
  offset: number,
  limit: number
): Promise<IObjectKeys[]> {
  const data = await fetch(
    `${url}/cosmos/staking/v1beta1/delegators/${address}/validators?pagination.limit=${limit}&pagination.offset=${offset}`
  ).then((data) => data.json());
  validators = [...validators, ...data.validators];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadDelegatorValidators(url, validators, address, offset, limit);
  }
  return validators;
}

export async function loadValidators(
  url: string,
  validators: IObjectKeys[],
  address: string,
  offset: number,
  limit: number
): Promise<IObjectKeys[]> {
  const data = await fetch(
    `${url}/cosmos/staking/v1beta1/validators?pagination.limit=${limit}&pagination.offset=${offset}&status=BOND_STATUS_BONDED`
  ).then((data) => data.json());
  validators = [...validators, ...data.validators];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadValidators(url, validators, address, offset, limit);
  }
  return validators;
}

export async function loadDelegations(
  url: string,
  delegations: IObjectKeys[],
  address: string,
  offset: number,
  limit: number
): Promise<IObjectKeys[]> {
  const data = await fetch(
    `${url}/cosmos/staking/v1beta1/delegations/${address}?pagination.limit=${limit}&pagination.offset=${offset}`
  ).then((data) => data.json());
  delegations = [...delegations, ...data.delegation_responses];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadDelegations(url, delegations, address, offset, limit);
  }
  return delegations;
}

export async function getClient() {
  return (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
}

export async function loadUnboundingDelegations(
  url: string,
  unbondingDelegations: IObjectKeys[],
  address: string,
  offset: number,
  limit: number
): Promise<IObjectKeys[]> {
  const data = await fetch(
    `${url}/cosmos/staking/v1beta1/delegators/${address}/unbonding_delegations?pagination.limit=${limit}&pagination.offset=${offset}`
  ).then((data) => data.json());
  unbondingDelegations = [...unbondingDelegations, ...data.unbonding_responses];
  offset += limit;
  if (data.pagination.next_key) {
    return await loadUnboundingDelegations(url, unbondingDelegations, address, offset, limit);
  }
  return unbondingDelegations;
}
