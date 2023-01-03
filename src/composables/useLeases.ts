import type { LeaseData } from '@/types/LeaseData';
import { ref, onMounted } from 'vue';

import { NolusClient } from '@nolus/nolusjs';
import { Lease, Leaser, type LeaseStatus } from '@nolus/nolusjs/build/contracts';

import { CONTRACTS } from '@/config/contracts';
import { WalletManager, EnvNetworkUtils } from '@/utils';

export function useLeases(onError: (error: any) => void, showModal: () => void) {
  const leases = ref<LeaseData[]>([]);

  const getLeases = async () => {

    try {
      const newLeases = [];
      const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient();
      const leaserClient = new Leaser(
        cosmWasmClient,
        CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance
      );

      const openedLeases: string[] = await leaserClient.getCurrentOpenLeasesByOwner(
        WalletManager.getWalletAddress()
      );
      
      for (const leaseAddress of openedLeases) {
        const leaseClient = new Lease(cosmWasmClient, leaseAddress);
        const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus();
        if (leaseInfo && !leaseInfo.closed) {
          newLeases.push({
            leaseAddress: leaseAddress,
            leaseStatus: leaseInfo,
          });
        }
      }

      leases.value = newLeases;

      if(newLeases.length == 0){
        showModal();
      }

    } catch (e: Error | any) {
      onError(e);
    }
  };

  onMounted(async () => {
    await getLeases();
  });

  return { leases, getLeases };
}
