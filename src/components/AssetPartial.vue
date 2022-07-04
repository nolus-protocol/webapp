<template>
  <div
    :class="[
      'nolus-box grid gap-6 border-b border-standart py-3 px-6 items-center justify-between',
      this.cols ? 'grid-cols-' + this.cols : 'grid-cols-3 md:grid-cols-4',
    ]"
  >
    <!-- Ticker -->
    <div class="inline-flex items-center">
      <img
        v-if="this.assetInfo.coinIcon"
        :src="require('@/assets/icons/coins/' + this.assetInfo.coinIcon)"
        class="inline-block m-0 mr-4"
        height="32"
        width="32"
      />
      <div class="inline-block">
        <p class="text-primary nls-font-500 nls-18 text-left uppercase m-0">
          {{ this.assetInfo.coinAbbreviation.toUpperCase() }}
        </p>
        <p class="text-dark-grey nls-13 nls-font-400 text-left capitalize m-0">
          {{ this.assetInfo.chainName }}
        </p>
      </div>
    </div>

    <!-- Price -->
    <div v-if="this.price" class="block">
      <p class="text-primary nls-font-500 nls-16 text-right m-0">
        {{ formatPrice(this.price) }}
      </p>
      <div class="flex items-center justify-end text-right m-0">
        <img
          :src="
            require('@/assets/icons/change-' +
              (this.changeDirection ? 'positive' : 'negative') +
              '.svg')
          "
          class="inline-block m-0 mr-2"
        />
        <span class="inline-block nls-font-400 nls-13">
          {{ this.change }}%
        </span>
      </div>
    </div>

    <!-- Balance -->
    <div class="block">
      <p class="text-primary nls-font-500 nls-16 text-right m-0">
        {{
          calculateBalance(this.price, this.assetBalance, this.denom)
        }}
      </p>
      <div
        class="flex items-center justify-end text-dark-grey nls-13 nls-font-400 text-right m-0"
      >
        {{
          convertMinimalDenomToDenom(
            this.assetBalance,
            assetInfo.coinMinimalDenom,
            assetInfo.coinDenom,
            assetInfo.coinDecimals
          )
        }}
      </div>
    </div>

    <!-- Earnings -->
    <div v-if="this.earnings" class="hidden md:block">
      <div
        class="flex items-center justify-end text-primary nls-font-400 text-small-copy text-right m-0"
      >
        Up to {{ this.earnings }}% APY
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from 'vue'
import { AssetInfo } from '@/utils/AssetUtils'
import { CurrencyUtils } from '@nolus/nolusjs'
import { assetInfo } from '@/config/assetInfo'
import { Coin, Int } from '@keplr-wallet/unit'

export default {
  name: 'AssetPartial',
  props: {
    assetInfo: {
      type: Object as PropType<AssetInfo>
    },
    price: {
      type: String
    },
    change: {
      type: String
    },
    changeDirection: {
      type: Boolean
    },
    balance: {
      type: String
    },
    assetBalance: {
      type: String
    },
    earnings: {
      type: String
    },
    cols: {
      type: Number
    },
    denom: {
      type: String
    }
  },
  data () {
    return {}
  },
  methods: {
    formatPrice (price: string) {
      return CurrencyUtils.formatPrice(price)
    },
    convertMinimalDenomToDenom (
      tokenAmount: string,
      minimalDenom: string,
      denom: string,
      decimals: number
    ) {
      return CurrencyUtils.convertMinimalDenomToDenom(
        tokenAmount,
        minimalDenom,
        denom,
        decimals
      )
    },
    calculateBalance (price: string, tokenAmount: string, denom: string) {
      console.log(tokenAmount)
      const tokenDecimals = assetInfo[denom].coinDecimals
      const coin = new Coin(denom, new Int(tokenAmount))
      return CurrencyUtils.calculateBalance(price, coin, tokenDecimals)
    }
  }
}
</script>
