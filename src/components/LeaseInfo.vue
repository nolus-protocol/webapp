<template>
  <!-- Leases -->
  <div
    v-if="leaseInfo.leaseStatus"
    class="bg-white mt-6 border-standart shadow-box radius-medium radius-0-sm pb-5"
  >
    <div class="grid grid-cols-1 lg:grid-cols-3">
      <div
        class="lg:col-span-1 px-6 border-standart border-b lg:border-b-0 lg:border-r pt-5 pb-5"
      >
        <div class="flex">
          <img
            :src="require('@/assets/icons/coins/btc.svg')"
            class="inline-block m-0 mr-3"
            height="36"
            width="36"
          />
          <h1 class="text-primary nls-font-700 nls-32 nls-font-700">
            {{
              this.leaseInfo.leaseStatus?.opened?.amount?.amount || this.leaseInfo.leaseStatus?.paid?.amount || ''
            }}
            <span
              class="inline-block ml-2 text-primary text-large-copy nls-14 nls-font-400"
            >{{
                formatLeaseDenom(this.leaseInfo.leaseStatus?.opened?.amount || this.leaseInfo.leaseStatus?.paid)
              }}</span>
          </h1>
        </div>
        {{
          calculateBalance(
            this.leaseInfo.leaseStatus?.opened?.amount?.amount || this.leaseInfo.leaseStatus?.paid?.amount,
            this.leaseInfo.leaseStatus?.opened?.amount?.symbol || this.leaseInfo.leaseStatus?.paid?.symbol
          )
        }}

        <div class="block mt-nolus-255 pl-12">
          <div class="block">
            <p class="text-detail text-primary m-0">{{ $t('message.outstanding-loan-amount') }}</p>
            <p class="text-primary nls-20 nls-font-700 nls-font-400 m-0 mt-1">
              {{
                calculateBalance(
                  this.leaseInfo.leaseStatus?.opened?.amount?.amount,
                  this.leaseInfo.leaseStatus?.opened?.amount?.symbol
                )
              }}
            </p>
          </div>
          <div class="block mt-nolus-255">
            <p class="text-detail text-primary m-0">{{ $t('message.interest-due') }}</p>
            <p
              class="flex items-center text-primary nls-20 nls-font-700 nls-font-400 m-0 mt-1"
            >
              {{
                calculateBalance(
                  this.leaseInfo.leaseStatus?.opened?.interest_due?.amount,
                  this.leaseInfo.leaseStatus?.opened?.interest_due?.symbol
                )
              }}
            </p>
          </div>
          <div class="block mt-nolus-255">
            <p class="text-detail text-primary m-0">{{ $t('message.interest-rate') }}</p>
            <p
              class="flex items-center text-primary nls-20 nls-font-700 nls-font-400 m-0 mt-1"
            >
              {{ formatInterestRate(this.leaseInfo.leaseStatus?.opened?.interest_rate) }}
            </p>
          </div>
        </div>
      </div>
      <div class="lg:col-span-2 px-6 pt-5">
        <!-- Graph -->
      </div>
    </div>
    <div
      class="flex items-center justify-end border-t border-standart pt-4 px-6"
    >
      <button class="btn btn-secondary btn-large-secondary" v-if="leaseInfo.leaseStatus.opened"
              v-on:click="showRepayModal = true">
        {{
          $t('message.repay')
        }}
      </button>

      <button class="btn btn-secondary btn-large-secondary" v-if="leaseInfo.leaseStatus.paid">
        {{
          $t('message.claim')
        }}
      </button>
    </div>
  </div>
 <RepayModal v-show="showRepayModal" :lease-info="leaseInfo" @close-modal="showRepayModal = false"/>
</template>

<script lang="ts">
import { PropType } from 'vue'
import { Asset } from '@nolus/nolusjs/build/contracts'
import { assetsInfo } from '@/config/assetsInfo'
import { CurrencyUtils } from '@nolus/nolusjs'
import { Coin, Dec, Int } from '@keplr-wallet/unit'
import { useStore } from '@/store'
import { LeaseData } from '@/types/LeaseData'
import RepayModal from '@/components/modals/RepayModal.vue'

export default {
  name: 'LeaseInfo',
  components: { RepayModal },
  props: {
    leaseInfo: {
      type: Object as PropType<LeaseData>
    }
  },
  data () {
    return {
      showRepayModal: false
    }
  },
  methods: {
    formatLeaseDenom (asset: Asset) {
      if (asset) {
        const assetInfo = assetsInfo[asset.symbol]
        return assetInfo.coinDenom
      }

      return ''
    },
    formatInterestRate (interestRatePromile: number) {
      return new Dec(interestRatePromile).quo(new Dec(10)).toString(1) + '%'
    },
    calculateBalance (tokenAmount: string, denom: string) {
      const prices = useStore().getters.getPrices
      const assetInf = assetsInfo[denom]
      if (prices && assetInf) {
        const coinPrice = prices[assetInf.coinDenom]?.amount || '0'
        const tokenDecimals = assetInf.coinDecimals
        const coinAmount = new Coin(denom, new Int(tokenAmount))
        return CurrencyUtils.calculateBalance(
          coinPrice,
          coinAmount,
          0
        ).toString()
      }

      return CurrencyUtils.calculateBalance(
        '0',
        new Coin('', new Int(0)),
        0
      ).toString()
    }
  }
}
</script>
