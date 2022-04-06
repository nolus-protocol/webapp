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
              <h1 class="text-default-heading text-primary m-0">Assets</h1>
            </div>
            <div class="right w-full md:w-1/2 mt-4 md:mt-0 inline-flex justify-start md:justify-end">
              <button class="btn btn-secondary btn-large-secondary mr-4">Send / Receive</button>
              <button class="btn btn-primary btn-large-primary">Buy Tokens</button>
            </div>
          </div>

          <!-- Wallet -->
          <div class="flex items-center justify-between bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm py-5 px-6">
            <div class="left inline-block w-1/2">
              <p class="text-large-copy text-primary text-medium m-0">Wallet Balance</p>
              <p class="text-big-number text-primary m-0 mt-1">$ 123,423.00</p>
            </div>
            <div class="right inline-block w-1/2">
            </div>
          </div>

          <!-- Existing Assets -->
          <div class="block bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm overflow-hidden">
            
            <!-- Top -->
            <div class="flex flex-wrap items-baseline justify-between pt-5 px-6">
              <div class="left w-full md:w-1/2">
                <p class="text-large-copy text-primary text-medium m-0">Existing assets</p>
              </div>
              <div class="right w-full md:w-1/2 mt-4 md:mt-0 inline-flex justify-start md:justify-end">
                <div class="relative block checkbox-container">
                  <div class="flex items-center w-full justify-end">
                    <input id="hide-small-balances" aria-describedby="hide-small-balances" name="hide-small-balances" type="checkbox" checked="checked">
                    <label for="hide-small-balances">Hide small balances</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Assets -->
            <div class="block mt-6 md:mt-4">

              <!-- Assets Header -->
              <div class="grid grid-cols-3 md:grid-cols-4 gap-6 border-b border-standart pb-3 px-6">

                <div class="text-medium text-detail text-dark-grey text-left text-upper">
                  Assets
                </div>

                <div class="text-medium text-detail text-dark-grey text-right text-upper">
                  Price
                </div>

                <div class="inline-flex items-center justify-end text-medium text-detail text-dark-grey text-right text-upper">
                  <span class="inline-block">Balance</span>
                  <img
                    :src="require('@/assets/icons/tooltip.svg')"
                    width="12"
                    height="12"
                    class="inline-block m-0 ml-1"
                  />
                </div>

                <div class="hidden md:inline-flex items-center justify-end text-medium text-detail text-dark-grey text-right text-upper">
                  <span class="inline-block">Earnings</span>
                  <img
                    :src="require('@/assets/icons/tooltip.svg')"
                    width="12"
                    height="12"
                    class="inline-block m-0 ml-1"
                  />
                </div>
              </div>

              <!-- Assets Container -->
              <div class="block">
                <AssetPartial
                  icon="btc.svg"
                  ticker="BTC"
                  fullName="Bitcoin"
                  price="29,836.42"
                  change="4.19"
                  :changeDirection="'true'"
                  balance="32,430.22"
                  balanceOther="1.23456780"
                  balanceOtherTicker="nBTC"
                  earnings="24"
                >
                </AssetPartial>
                <AssetPartial
                  icon="btc.svg"
                  ticker="BTC"
                  fullName="Bitcoin"
                  price="29,836.42"
                  change="4.19"
                  :changeDirection="'true'"
                  balance="32,430.22"
                  balanceOther="1.23456780"
                  balanceOtherTicker="nBTC"
                  earnings="24"
                >
                </AssetPartial>
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
  name: 'DashboardView',
  components: {
    SidebarContainer,
    AssetPartial
  },
  data () {
    return {}
  }
})
</script>
