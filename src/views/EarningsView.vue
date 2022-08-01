<template>
  <div class="col-span-12 mb-sm-nolus-70">
    <!-- Header -->
    <div class="flex flex-wrap mt-[25px] items-center justify-between px-4 lg:px-0">
      <div class="left w-full md:w-1/2">
        <h1 class="text-20 nls-font-700 text-primary m-0 nls-sm-title">
          Earnings
        </h1>
      </div>
    </div>

    <div class="md:grid md:grid-cols-12 md:gap-4">
      <div class="md:col-span-7 lg:col-span-7">
        <!-- Portfolio -->
        <div
          class="nolus-box block order-2 order-1 bg-white border-y border-standart radius-medium md:col-span-7 md:mt-6"
        >
          <div
            class="lg:flex block items-center justify-between px-6 pt-6"
          >
            <h2 class="text-16 nls-font-500 text-left my-0">
              Your earning portfolio
            </h2>
            <button
              class="btn btn-label btn-large-label text-right nls-md-hidden"
            >
              View all earning assets
            </button>
          </div>
          <!-- Assets -->
          <div class="block mt-6 md:mt-[25px]">
            <!-- Assets Header -->
            <div
              class="grid grid-cols-2 gap-6 border-b border-standart pb-3 px-6"
            >
              <div
                class="nls-font-500 text-12 text-dark-grey text-left text-upper"
              >
                {{ $t('message.asset') }}
              </div>

              <div
                class="inline-flex items-center justify-end nls-font-500 text-12 text-dark-grey text-right text-upper"
              >
                <span class="inline-block">{{ $t('message.current-balance') }}</span>
              </div>
            </div>

            <!-- Assets Container -->
            <EarnAsset
              v-for="asset in this.balances"
              :key="asset"
              :asset="asset"
              :cols="this.cols"/>
          </div>
        </div>
        <!-- Portfolio -->
      </div>

      <div class="md:col-span-5 lg:co-span-5">
        <!-- Rewards -->
        <div
          class="nolus-box block order-2 md:order-1 bg-white border-y border-standart radius-medium md:col-span-7 mt-6"
        >
          <div
            class="flex items-center justify-between px-6 pt-6"
          >
            <h2 class="text-16 nls-font-500 text-left my-0">
              Pending rewards
            </h2>
            <button class="btn btn-label btn-large-label">
              Claim all
            </button>
          </div>
          <!-- Assets -->
          <div class="block mt-4">
            <!-- Assets Container -->
            <div class="block">
              <div
                :class="[
                  'grid gap-6 border-b border-t border-standart px-6 py-3  items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      BTC
                    </p>
                    <p
                      class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0"
                    >
                      ~$5
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <div class="flex justify-end">
                  <button
                    class="btn btn-secondary btn-medium-secondary btn-emphatized"
                    data-v-37958d79=""
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
            <div class="block">
              <div
                :class="[
                  'grid gap-6 border-b border-standart px-6 py-3  items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      BTC
                    </p>
                    <p
                      class="text-dark-grey text-13 nls-font-400 text-left capitalize m-0"
                    >
                      ~$5
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <div class="flex justify-end">
                  <button
                    class="btn btn-secondary btn-medium-secondary btn-emphatized"
                    data-v-37958d79=""
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
            <div class="block">
              <div
                :class="[
                  'grid gap-6 border-b border-standart  px-6 py-3 items-center justify-between',
                  this.cols
                    ? 'grid-cols-' + this.cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
              >
                <!-- Ticker -->
                <div class="inline-flex items-center">
                  <img
                    :src="require('@/assets/icons/coins/btc.svg')"
                    class="inline-block m-0 mr-4"
                    height="32"
                    width="32"
                  />
                  <div class="inline-block">
                    <p
                      class="text-primary nls-font-500 text-18 text-left uppercase m-0"
                    >
                      BTC
                    </p>
                    <p
                      class="text-dark-grey text-13 nls-font-400 text-left capitalize m-0"
                    >
                      ~$5
                    </p>
                  </div>
                </div>

                <!-- Balance -->
                <div class="flex justify-end">
                  <button
                    class="btn btn-secondary btn-medium-secondary js-loading"
                    data-v-37958d79=""
                  >
                    None
                  </button>
                </div>
              </div>
            </div>
            <!-- Assets Container -->
          </div>
        </div>
      </div>
    </div>
  </div>

  <Dialog
    :titles="['Supply', 'Withdraw']"
    v-if="showDialog"
    @close-modal="showDialog = false"/>
</template>

<script lang="ts">
import { defineComponent } from 'vue'
import Dialog from '@/components/modals/templates/Dialog.vue'
import { Lease } from '@nolus/nolusjs/build/contracts'
import { NolusClient } from '@nolus/nolusjs'
import { CONTRACTS } from '@/config/contracts'
import { EnvNetworkUtils } from '@/utils/EnvNetworkUtils'
import { AssetBalance } from '@/store/modules/wallet/state'
import EarnAsset from '@/components/EarnAsset.vue'

export default defineComponent({
  name: 'EarningsView',
  components: {
    EarnAsset,
    Dialog
  },
  data () {
    return {
      cols: 2 as number,
      showDialog: false,
      availableCurrencies: [] as string[],
      balances: [] as AssetBalance[]
    }
  },
  watch: {
    '$store.state.wallet.balances' (balances: AssetBalance[]) {
      if (balances) {
        this.balances = balances.filter(asset => {
          return this.availableCurrencies.includes(asset.balance.denom)
        })
      }
    }
  },
  async mounted () {
    const cosmWasmClient = await NolusClient.getInstance().getCosmWasmClient()
    const leaseClient = new Lease(cosmWasmClient)
    const result = await leaseClient.getLppConfig(CONTRACTS[EnvNetworkUtils.getStoredNetworkName()].lpp.instance)
    this.availableCurrencies.push(result.lpn_symbol)
  }
})
</script>
<style scoped></style>
