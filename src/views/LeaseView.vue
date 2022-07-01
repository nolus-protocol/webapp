<template>
  <div class="container w-full grid grid-cols-12 mx-auto grid-parent">
    <div class="lg:col-span-3">
      <SidebarContainer/>
    </div>
    <div class="lg:col-span-9 pb-8">
      <div class="grid grid-cols-10 grid-child">
        <div class="col-span-12 mt-nolus-60">
          <div class="col-span-12">
            <div class="sidebar-header">
              <!-- <Notifications /> -->
              <Notifications/>
              <WalletOpen/>
            </div>
          </div>
        </div>
        <div class="col-span-12">
          <!-- Header -->
          <div class="flex flex-wrap items-center justify-between px-4 lg:px-0">
            <div class="left w-full md:w-1/2">
              <h1 class="nls-20 nls-font-700 text-primary m-0">Leases</h1>
            </div>
            <div
              class="right w-full md:w-1/2 mt-nolus-255 md:mt-0 inline-flex justify-start md:justify-end"
            >
              <button
                class="btn btn-primary btn-large-primary w-full md:w-1/2"
                v-on:click="showSendModal = true"
              >
                Lease new
              </button>
              <button
                class="btn btn-primary btn-large-primary w-full md:w-1/2"
                v-on:click="showRepayModal = true"
              >
                Repay
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
      </div>
    </div>
  </div>
  <LeaseModal v-show="showSendModal" @close-modal="showSendModal = false"/>
  <RepayModal v-show="showRepayModal" @close-modal="showRepayModal = false"/>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SidebarContainer from '@/components/SidebarContainer.vue'
import LeaseModal from '@/components/modals/LeaseModal.vue'
import { Lease, LeaseStatus } from '@nolus/nolusjs/build/contracts'
import { CONTRACTS } from '@/config/contracts'
import { WalletManager } from '@/config/wallet'
import RepayModal from '@/components/modals/RepayModal.vue'
import { LeaseData } from '@/types/LeaseData'
import LeaseInfo from '@/components/LeaseInfo.vue'

export default defineComponent({
  name: 'LeaseView',
  components: {
    LeaseModal,
    RepayModal,
    LeaseInfo,
    SidebarContainer
  },
  data () {
    return {
      showSendModal: false,
      showRepayModal: false,
      leases: [] as LeaseData[]
    }
  },
  async mounted () {
    const leaseClient = new Lease()
    const openedLeases: string[] = await leaseClient.getCurrentOpenLeases(
      CONTRACTS.leaser.instance,
      WalletManager.getWalletAddress()
    )
    for (const leaseAddress of openedLeases) {
      const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus(leaseAddress)
      this.leases.push({
        leaseAddress: leaseAddress,
        leaseStatus: leaseInfo
      })
    }
  }
})
</script>
