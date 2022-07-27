<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap items-center justify-between px-4 lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="nls-20 nls-font-700 text-primary m-0 nls-sm-title">
          {{ $t('message.leases') }}
        </h1>
      </div>
      <div
        class="right w-full md:w-1/2 mt-[255px] md:mt-0 inline-flex justify-start md:justify-end"
      >
        <button
          class="btn btn-primary btn-large-primary w-full md:w-1/2"
          v-on:click="showLeaseModal = true"
        >
          {{ $t('message.lease-new') }}
        </button>
      </div>
    </div>

    <!-- Leases -->
    <LeaseInfo
      v-bind:key="lease.leaseAddress"
      v-for="lease in this.leases"
      :lease-info="lease"
    />
  </div>
  <LeaseModal v-if="showLeaseModal" @close-modal="showLeaseModal = false"/>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import LeaseModal from '@/components/modals/LeaseModal.vue'
import { Lease, LeaseStatus } from '@nolus/nolusjs/build/contracts'
import { CONTRACTS } from '@/config/contracts'
import { LeaseData } from '@/types/LeaseData'
import LeaseInfo from '@/components/LeaseInfo.vue'
import { WalletManager } from '@/wallet/WalletManager'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { NolusClient } from '@nolus/nolusjs'

export default defineComponent({
  name: 'LeaseView',
  components: {
    LeaseModal,
    LeaseInfo
  },
  data () {
    return {
      showLeaseModal: false,
      leases: [] as LeaseData[]
    }
  },
  async mounted () {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    const leaseClient = new Lease(cosmWasmClient)
    const openedLeases: string[] = await leaseClient.getCurrentOpenLeases(
      CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].leaser.instance,
      WalletManager.getWalletAddress()
    )
    for (const leaseAddress of openedLeases) {
      const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus(leaseAddress)

      if (leaseInfo && !leaseInfo.closed) {
        this.leases.push({
          leaseAddress: leaseAddress,
          leaseStatus: leaseInfo
        })
      }
    }
  }
})
</script>
