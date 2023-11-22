import type { LeaseData } from "@/types/LeaseData";
import { ref, onMounted } from "vue";

import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { Lease, Leaser, type LeaserConfig, type LeaseStatus } from "@nolus/nolusjs/build/contracts";

import { CONTRACTS } from "@/config/contracts";
import { WalletManager, EnvNetworkUtils } from "@/utils";
import { AppUtils } from "@/utils/AppUtils";
import { IGNORE_LEASES } from "@/config/env";

export function useLeases(
  onError: (error: unknown) => void
) {
  const leases = ref<LeaseData[]>([]);
  const leaseLoaded = ref(false);

  const getLeases = async () => {
    try {

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
      );

      const openedLeases: string[] = (await leaserClient.getCurrentOpenLeasesByOwner(
        WalletManager.getWalletAddress()
      )).filter((item) => {
        return !IGNORE_LEASES.includes(item);
      });

      const promises: Promise<{
        leaseAddress: string,
        leaseStatus: LeaseStatus,
      } | undefined>[] = [];

      for (const leaseAddress of openedLeases) {
        const fn = async () => {
          const leaseClient = new Lease(cosmWasmClient, leaseAddress);
          const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
          const api = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;

          const [statusReq, leaseInfo, balancesReq] = await Promise.all([
            fetch(`${url}/tx_search?query="wasm.lease_address='${leaseAddress}'"&prove=true`),
            leaseClient.getLeaseStatus(),
            fetch(`${api}/cosmos/bank/v1beta1/balances/${leaseAddress}`),
          ]);
          const [data, balances] = await Promise.all([
            statusReq.json(),
            balancesReq.json()
          ]);

          const item = data.result?.txs?.[0];
          if (leaseInfo && !leaseInfo.closed && !leaseInfo.liquidated) {
            return {
              leaseAddress: leaseAddress,
              leaseStatus: leaseInfo,
              height: item.height,
              balances: balances.balances
            }
          }
        }
        promises.push(fn())
      }

      const items = (await Promise.all(promises)).filter((item) => {
        if (!item) {
          return false;
        }
        return true;
      })

      leases.value = items as LeaseData[];

    } catch (e) {
      onError(e);
    } finally {
      leaseLoaded.value = true;
    }
  };

  onMounted(async () => {
    await getLeases();
  });

  return { leases, leaseLoaded, getLeases };
}

export function useLease(
  leaseAddress: string,
  onError: (error: unknown) => void
) {

  const getLease = async () => {
    try {

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaseClient = new Lease(cosmWasmClient, leaseAddress);
      const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus();

      return {
        leaseAddress,
        leaseStatus: leaseInfo
      } as {
        leaseAddress: string,
        leaseStatus: LeaseStatus,
      };

    } catch (e) {
      onError(e);
    }
  };

  onMounted(async () => {
    await getLease();
  });

  return { getLease };
}

export function useLeaseConfig(
  onError: (error: unknown) => void
) {
  const config = ref<LeaserConfig>();

  const getLeaseConfig = async () => {
    try {

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
      );
      config.value = await leaserClient.getLeaserConfig();

    } catch (e) {
      onError(e);
    }
  };

  onMounted(async () => {
    await getLeaseConfig();
  });

  return { getLeaseConfig, config };
}
