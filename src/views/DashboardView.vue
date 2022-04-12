<template>
  <div class="page-container home">
    <SidebarContainer>
    </SidebarContainer>

    <div class="container mx-auto mt-16">
      <div class="grid grid-cols-12 gap-6">
        <div class="col-start-3 col-span-9">

          <!-- Header -->
          <div class="flex items-center justify-between">
            <div class="left">
              <h1 class="text-default-heading text-primary m-0">Assets</h1>
            </div>
            <div class="right">
              <button class="btn btn-secondary btn-large-secondary mr-4">Send / Receive</button>
              <button class="btn btn-primary btn-large-primary">Buy Tokens</button>
            </div>
          </div>

          <!-- Wallet -->
          <div
            class="flex items-center justify-between bg-white mt-6 border-standart shadow-box radius-medium py-5 px-6">
            <div class="left inline-block w-1/2">
              <p class="text-large-copy text-primary text-medium m-0">Wallet Balance</p>
              <p class="text-big-number text-primary m-0 mt-1">$ 123,423.00</p>
            </div>
            <div class="right inline-block w-1/2">
            </div>
          </div>

          <!-- Existing Assets -->
          <div class="block bg-white mt-6 border-standart shadow-box radius-medium overflow-hidden">

            <!-- Top -->
            <div class="flex items-baseline justify-between pt-5 px-6">
              <div class="left inline-block w-1/2">
                <p class="text-large-copy text-primary text-medium m-0">Existing assets</p>
              </div>
              <div class="right inline-block w-1/2">
                <div class="relative block checkbox-container ml-auto mr-0">
                  <div class="flex items-center w-full justify-end">
                    <input id="hide-small-balances" aria-describedby="hide-small-balances" name="hide-small-balances"
                           type="checkbox" checked="checked" v-model="hideLowerBalances">
                    <label for="hide-small-balances">Hide small balances</label>
                  </div>
                </div>
              </div>
            </div>

            <!-- Assets -->
            <div class="block mt-4">

              <!-- Assets Header -->
              <div class="grid grid-cols-4 gap-6 border-b border-standart pb-3 px-6">

                <div class="text-medium text-detail text-dark-grey text-left text-upper">
                  Assets
                </div>

                <div class="text-medium text-detail text-dark-grey text-right text-upper">
                  Price
                </div>

                <div
                  class="inline-flex items-center justify-end text-medium text-detail text-dark-grey text-right text-upper">
                  <span class="inline-block">Balance</span>
                  <img
                    :src="require('@/assets/icons/tooltip.svg')"
                    width="12"
                    height="12"
                    class="inline-block m-0 ml-1"
                  />
                </div>

                <div
                  class="inline-flex items-center justify-end text-medium text-detail text-dark-grey text-right text-upper">
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
                  v-for="asset in this.assets"
                  :key="asset"
                  :asset-info=getAssetInfo(asset.udenom)
                  price="29,836.42"
                  change="4.19"
                  :changeDirection=true
                  balance="0"
                  :assetBalance=asset.balance.amount.toString()
                  earnings="24"
                />
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
import { AssetBalance } from '@/store'
import { AssetUtils } from '@/utils/AssetUtils'
import { Int } from '@keplr-wallet/unit'

export default defineComponent({
  name: 'DashboardView',
  components: {
    SidebarContainer,
    AssetPartial
  },
  data () {
    return {
      assets: [] as AssetBalance[],
      mainAssets: [] as AssetBalance[],
      hideLowerBalances: false
    }
  },
  watch: {
    '$store.state.balances' (balances) {
      this.mainAssets = balances
      this.assets = balances
      if (this.hideLowerBalances) {
        this.filterSmallBalances()
      }
    },
    hideLowerBalances () {
      if (this.hideLowerBalances) {
        this.filterSmallBalances()
      } else {
        this.assets = this.mainAssets
      }
    }
  },
  computed: {},
  methods: {
    getAssetInfo (minimalDenom: string) {
      console.log(minimalDenom)
      return AssetUtils.getAssetInfoByAbbr(minimalDenom)
    },
    filterSmallBalances () {
      this.assets = this.assets.filter(asset => asset.balance.amount.gt(new Int('1')))
    }

  }
})
</script>
