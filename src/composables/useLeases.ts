import { ref, onMounted } from 'vue'

import { NolusClient } from '@nolus/nolusjs'
import { Lease, Leaser, LeaseStatus } from '@nolus/nolusjs/build/contracts'

import { CONTRACTS } from '@/config/contracts'
import { WalletManager } from '@/wallet/WalletManager'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { LeaseData } from '@/types/LeaseData'

export function useLeases() {
  const leases = ref<LeaseData[]>([])

  onMounted(async () => {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    const leaserClient = new Leaser(cosmWasmClient)
    const leaseClient = new Lease(cosmWasmClient)
    const openedLeases: string[] = await leaserClient.getCurrentOpenLeases(
      CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance,
      WalletManager.getWalletAddress()
    )
    for (const leaseAddress of openedLeases) {
      const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus(leaseAddress)

      if (leaseInfo && !leaseInfo.closed) {
        leases.value.push({
          leaseAddress: leaseAddress,
          leaseStatus: leaseInfo
        })
      }
    }
  })

  return { leases }
}
