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
              <button class="btn btn-primary btn-large-primary w-full md:w-1/2">Lease new</button>
            </div>
          </div>

          <!-- Leases -->
          <div class="bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5">
            <div class="grid grid-cols-1 lg:grid-cols-3">
              <div class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5">
                <div class="flex">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    width="36"
                    height="36"
                    class="inline-block m-0 mr-3"
                  />
                  <h1 class="text-primary text-large-heading text-bold">
                    3.000000
                    <span class="inline-block ml-2 text-primary text-large-copy text-regular">nBTC</span>
                  </h1>
                </div>

                <div class="block mt-4 pl-12">
                  <div class="block">
                    <p class="text-detail text-primary m-0">Your total asset value</p>
                    <p class="text-primary text-default-heading text-medium m-0 mt-1">$111,824.94</p>
                  </div>
                  <div class="block mt-4">
                    <p class="text-detail text-primary m-0">Your total liquidation value</p>
                    <p class="flex items-center text-primary text-default-heading text-medium m-0 mt-1">
                      <i class="inline-block w-2 h-2 radius-circle bg-light-red mr-1"></i>
                      $105,639.639
                    </p>
                  </div>
                </div>
              </div>
              <div class="lg:col-span-2 px-6 pt-5">
                <!-- Graph -->
              </div>
            </div>
            <div class="flex items-center justify-end border-t border-standart pt-4 px-6">
              <button class="btn btn-secondary btn-large-secondary mr-4">
                Claim
              </button>
              <button class="btn btn-secondary btn-large-secondary">
                Repay
            </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import SidebarContainer from '@/components/SidebarContainer.vue'
import AssetPartial from '@/components/AssetPartial.vue'

export default defineComponent({
  name: 'LeaseView',
  components: {
    SidebarContainer,
    AssetPartial
  },
  data () {
    return {}
  }
})
</script>
