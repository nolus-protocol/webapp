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
          <div class="flex flex-wrap items-center justify-between px-4 lg:px-0 md:mb-5">
            <div class="left w-full md:w-1/2">
              <h1 class="text-default-heading text-primary m-0">Earnings</h1>
            </div>
            <div class="right w-full md:w-1/2 mt-4 md:mt-0 inline-flex justify-start md:justify-end">
            </div>
          </div>

          <div class="grid md:grid-cols-12 md:gap-5">

            <!-- Rewards -->
            <div class="block order-1 md:order-2 bg-white border-y border-standart radius-medium md:col-span-5">
              <div class="flex items-center justify-between border-b border-standart px-5 pt-5 pb-4">
                <h2 class="text-large-copy text-primary text-left text-medium my-0">Pending rewards</h2>
                <button class="btn btn-secondary btn-large-secondary">
                  Claim all
                </button>
              </div>
              <div class="flex items-center justify-between border-b border-standart">
                <div class="left">
                  <AssetPartial
                    icon="btc.svg"
                    ticker="0.000000324 BTC"
                    fullName="~$5"
                  >
                  </AssetPartial>
                </div>
                <div class="right pr-4">
                  <button class="btn btn-primary btn-large-primary">
                    Claim
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between border-b border-standart">
                <div class="left">
                  <AssetPartial
                    icon="btc.svg"
                    ticker="0.000000324 BTC"
                    fullName="~$5"
                  >
                  </AssetPartial>
                </div>
                <div class="right pr-4">
                  <button class="btn btn-primary btn-large-primary js-loading">
                    Claim
                  </button>
                </div>
              </div>
              <div class="flex items-center justify-between border-b border-standart">
                <div class="left">
                  <AssetPartial
                    icon="btc.svg"
                    ticker="0.000000324 BTC"
                    fullName="~$5"
                  >
                  </AssetPartial>
                </div>
                <div class="right pr-4">
                  <button class="btn btn-secondary btn-large-secondary btn-emphatized success">
                    Withdraw
                  </button>
                </div>
              </div>
            </div>

            <!-- Portfolio -->
            <div class="block order-2 md:order-1 bg-white border-y border-standart radius-medium md:col-span-7 mt-3 md:mt-0">
              <div class="flex items-center justify-between px-5 pt-5 pb-4">
                <h2 class="text-large-copy text-primary text-left text-medium my-0">Your earning portfolio</h2>
                <button class="btn btn-label btn-large-label">
                  View all earning assets
                </button>
              </div>
              <!-- Assets -->
            <div class="block mt-6 md:mt-4">

              <!-- Assets Header -->
              <div class="grid grid-cols-2 gap-6 border-b border-standart pb-3 px-6">

                <div class="text-medium text-detail text-dark-grey text-left text-upper">
                  Asset
                </div>

                <div class="inline-flex items-center justify-end text-medium text-detail text-dark-grey text-right text-upper">
                  <span class="inline-block">Current Balance</span>
                </div>
              </div>

              <!-- Assets Container -->
              <div class="block">
                <AssetPartial
                  icon="btc.svg"
                  ticker="BTC"
                  fullName="Bitcoin"
                  balance="32,430.22"
                  balanceOther="1.23456780"
                  balanceOtherTicker="nBTC"
                  cols="2"
                >
                </AssetPartial>
              </div>
            </div>
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
  name: 'EarningsView',
  components: {
    SidebarContainer,
    AssetPartial
  },
  data () {
    return {}
  }
})
</script>
