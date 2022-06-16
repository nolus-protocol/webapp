<template>
  <div class="page-container home">
    <div class="none">
      <SidebarContainer>
      </SidebarContainer>
    </div>

    <div class="container mx-auto pt-24 lg:pt-16">
      <div class="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <div class="lg:col-start-3 lg:col-span-9">

          <!-- Header -->
          <div class="flex flex-wrap items-center justify-between px-4 lg:px-0">
            <div class="left w-full md:w-1/2">
              <h1 class="text-default-heading text-primary m-0">Leases</h1>
            </div>
            <div class="right w-full md:w-1/2 mt-4 md:mt-0 inline-flex justify-start md:justify-end">
              <button class="btn btn-primary btn-large-primary w-full md:w-1/2" v-on:click="showSendModal = true">
                Lease new
              </button>
            </div>
          </div>

          <!-- Leases -->
          <LeaseInfo
            v-bind:key="leaseInfo"
            v-for="leaseInfo in this.leases"
            :asset-info="leaseInfo"
          />
        </div>
      </div>
    </div>
  </div>
  <LeaseModal v-show="showSendModal" @close-modal="showSendModal = false"/>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SidebarContainer from '@/components/SidebarContainer.vue'
import LeaseModal from '@/components/modals/LeaseModal.vue'
import { Lease, LeaseStatus } from '@nolus/nolusjs/build/contracts'
import { CONTRACTS } from '@/config/contracts'
import { WalletManager } from '@/config/wallet'
import LeaseInfo from '@/components/LeaseInfo.vue'

export default defineComponent({
  name: 'LeaseView',
  components: {
    LeaseModal,
    LeaseInfo,
    SidebarContainer
  },
  data () {
    return {
      showSendModal: false,
      leases: [] as LeaseStatus[]
    }
  },
  async mounted () {
    const leaseClient = new Lease()
    const openedLeases: string[] = await leaseClient.getCurrentOpenLeases(CONTRACTS.leaser.instance, WalletManager.getWalletAddress())
    for (const leaseAddress of openedLeases) {
      const leaseInfo: LeaseStatus = await leaseClient.getLeaseStatus(leaseAddress)
      this.leases.push(leaseInfo)
    }
  }
})
</script>
