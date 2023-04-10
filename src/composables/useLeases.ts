import type { LeaseData } from "@/types/LeaseData";
import { ref, onMounted } from "vue";

import { NolusClient } from "@nolus/nolusjs";
import { Lease, Leaser, type LeaseStatus } from "@nolus/nolusjs/build/contracts";

import { CONTRACTS } from "@/config/contracts";
import { WalletManager, EnvNetworkUtils } from "@/utils";

export function useLeases(
  onError: (error: unknown) => void,
  showModal: () => void
) {
  const leases = ref<LeaseData[]>([]);

  const getLeases = async () => {
    try {

      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
      );

      const openedLeases: string[] = await leaserClient.getCurrentOpenLeasesByOwner(
        WalletManager.getWalletAddress()
      );

      const promises: Promise<{
        leaseAddress: string,
        leaseStatus: LeaseStatus,
      } | undefined>[] = [];

      for (const leaseAddress of openedLeases) {
        const fn = async () => {
          const leaseClient = new Lease(cosmWasmClient, leaseAddress);
          const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus();
          if (leaseInfo && !leaseInfo.closed) {
            return {
              leaseAddress: leaseAddress,
              leaseStatus: leaseInfo,
            }
          }
        }
        promises.push(fn())
      }

      const items = (await Promise.all(promises)).filter((item) => item);
      leases.value = items as {
        leaseAddress: string,
        leaseStatus: LeaseStatus,
      }[];
      if (items.length == 0) {
        showModal();
      }

    } catch (e) {
      onError(e);
    }
  };

  onMounted(async () => {
    await getLeases();
  });

  return { leases, getLeases };
}
