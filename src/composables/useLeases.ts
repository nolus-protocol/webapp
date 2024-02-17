import type { LeaseData } from "@/types/LeaseData";
import { ref, onMounted } from "vue";

import { ChainConstants, NolusClient } from "@nolus/nolusjs";
import { Lease, Leaser, type LeaserConfig, type LeaseStatus } from "@nolus/nolusjs/build/contracts";

import { WalletManager } from "@/utils";
import { AppUtils } from "@/utils/AppUtils";
import { IGNORE_LEASES } from "@/config/env";
import { useAdminStore } from "@/stores/admin";

export function useLeases(
  onError: (error: unknown) => void
) {
  const leases = ref<LeaseData[]>([]);
  const leaseLoaded = ref(false);

  const getLeases = async () => {
    try {
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const admin = useAdminStore();
      const promises: Promise<{
        leaseAddress: string,
        leaseStatus: LeaseStatus,
        protocol: string
      } | undefined>[] = [];
      const protocolPromises = [];

      for (const protocolKey in admin.contracts) {
        const fn = async () => {
          const protocol = admin.contracts[protocolKey];

          const leaserClient = new Leaser(
            cosmWasmClient,
            protocol.leaser
          );

          const openedLeases: string[] = (await leaserClient.getCurrentOpenLeasesByOwner(
            WalletManager.getWalletAddress()
          )).filter((item) => {
            return !IGNORE_LEASES.includes(item);
          });

          for (const leaseAddress of openedLeases) {
            const fn = async () => {
              const leaseClient = new Lease(cosmWasmClient, leaseAddress);
              const url = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).rpc;
              const api = (await AppUtils.fetchEndpoints(ChainConstants.CHAIN_KEY)).api;

              const [leaseInfo, balancesReq] = await Promise.all([
                leaseClient.getLeaseStatus(),
                fetch(`${api}/cosmos/bank/v1beta1/balances/${leaseAddress}`),
              ]);

              const [balances] = await Promise.all([
                balancesReq.json()
              ]);

              if (leaseInfo && !leaseInfo.closed && !leaseInfo.liquidated) {
                return {
                  leaseAddress: leaseAddress,
                  leaseStatus: leaseInfo,
                  balances: balances.balances,
                  protocol: protocolKey
                }
              }
            }
            promises.push(fn())
          }

        }

        protocolPromises.push(fn());

      }

      await Promise.all(protocolPromises);

      const items = (await Promise.all(promises)).filter((item) => {
        if (!item) {
          return false;
        }
        return true;
      }).sort((a, b) => b!.protocol.localeCompare(a!.protocol));
      leases.value = items as LeaseData[];

    } catch (e) {
      console.log(e)
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
  protocol: string,
  onError: (error: unknown) => void
) {
  const config = ref<LeaserConfig>();

  const getLeaseConfig = async () => {
    try {
      const admin = useAdminStore();
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(
        cosmWasmClient,
        admin.contracts[protocol].leaser
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
