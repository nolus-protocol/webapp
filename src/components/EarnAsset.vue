<template>
  <div class="block">
    <div
      :class="[
                  'grid gap-6 row-actions border-b flex border-t border-standart px-6 py-3 items-center justify-between',
                  cols
                    ? 'grid-cols-' + cols
                    : 'grid-cols-3 md:grid-cols-4',
                ]"
    >
      <!-- Ticker -->
      <div class="inline-flex items-center">
        <img
          v-if="getAssetIcon(asset.balance.denom)"
          :src="require('@/assets/icons/coins/' + getAssetIcon(asset.balance.denom))"
          class="inline-block m-0 mr-4"
          height="32"
          width="32"
        />
        <div class="inline-block">
          <p
            class="text-primary nls-font-500 text-18 text-left uppercase m-0"
          >
            {{ getAssetName(asset.balance.denom) }}
          </p>
          <p
            class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0"
          >
            {{ formatPrice(getMarketPrice(asset.balance.denom)) }}
          </p>
        </div>
      </div>

      <!-- Balance -->
      <div class="block info-show">
        <p
          class="text-primary nls-font-500 text-16 nls-font-500 text-right m-0"
        >
          {{ calculateBalance(asset.balance.amount.toString(), asset.balance.denom) }}
        </p>
        <div
          class="flex items-center justify-end text-dark-grey text-12 nls-font-400 text-right m-0"
        >
          {{ convertMinimalDenomToDenom(asset.balance.amount, asset.balance.denom) }}
        </div>
      </div>
      <div class="flex justify-end nls-btn-show">
        <button
          class="btn btn-secondary btn-medium-secondary"
          data-v-37958d79=""
          @click="openSupplyWithdraw"
        >
          {{ $t('message.supply-withdraw') }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts">
import { PropType } from 'vue'
import { Coin, Int } from '@keplr-wallet/unit'
import { CurrencyUtils } from '@nolus/nolusjs'
import { AssetBalance } from '@/store/modules/wallet/state'
import { AssetUtils } from '@/utils/AssetUtils'
import { useStore } from '@/store'

export default {
  name: 'EarnAsset',
  props: {
    asset: {
      type: Object as PropType<AssetBalance>,
      required: true
    },
    cols: {
      type: Number
    },
    openSupplyWithdraw: {
      type: Function,
      required: true
    }
  },
  data () {
    return {}
  },
  methods: {
    getAssetIcon (denom: string) {
      return AssetUtils.getAssetInfoByAbbr(denom).coinIcon || ''
    },
    getAssetName (denom: string) {
      return AssetUtils.getAssetInfoByAbbr(denom).coinAbbreviation || ''
    },
    formatPrice (price: string) {
      return CurrencyUtils.formatPrice(price)
    },
    getMarketPrice (denom: string) {
      const prices = useStore().state.oracle.prices
      if (prices) {
        const tokenDenom = AssetUtils.getAssetInfoByAbbr(denom).coinDenom
        return prices[tokenDenom]?.amount || '0'
      }
      return '0'
    },
    convertMinimalDenomToDenom (
      tokenAmount: string,
      minimalDenom: string
    ) {
      const assetInfo = AssetUtils.getAssetInfoByAbbr(minimalDenom)
      return CurrencyUtils.convertMinimalDenomToDenom(
        tokenAmount,
        minimalDenom,
        assetInfo.coinDenom,
        assetInfo.coinDecimals
      )
    },
    calculateBalance (tokenAmount: string, denom: string) {
      const price = this.getMarketPrice(denom)
      const tokenDecimals = AssetUtils.getAssetInfoByAbbr(denom).coinDecimals
      const coin = new Coin(denom, new Int(tokenAmount))
      return CurrencyUtils.calculateBalance(price, coin, tokenDecimals)
    }
  }
}
</script>
