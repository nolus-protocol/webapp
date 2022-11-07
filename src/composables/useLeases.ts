import type { LeaseData } from '@/types/LeaseData';
import { ref, onMounted } from 'vue';

import { NolusClient } from '@nolus/nolusjs';
import { Lease, Leaser, type LeaseStatus } from '@nolus/nolusjs/build/contracts';

import { CONTRACTS } from '@/config/contracts';
import { WalletManager } from '@/wallet/WalletManager';
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils';

export function useLeases(onError: (error: any) => void) {
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
    } catch (e: Error | any) {
      onError(e);
    }
  };

  onMounted(() => {
    getLeases();
  });

  return { leases, getLeases };
}
