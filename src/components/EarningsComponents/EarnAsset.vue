<template>
  <div class="block relative">
    <div
      :class="[
        'grid gap-6 row-actions border-b flex border-t border-standart px-6 py-3 items-center justify-between earn-asset',
        cols ? 'md:grid-cols-' + cols : 'grid-cols-2 md:grid-cols-3'
      ]"
    >
      <!-- Ticker -->
      <div class="inline-flex items-center">
        <img
          v-if="assetInfo.coinIcon"
          :src="assetInfo.coinIcon"
          class="inline-block m-0 mr-4"
          height="32"
          width="32"
        />
        <div class="inline-block">
          <p class="text-primary nls-font-500 text-18 text-left uppercase m-0">
            {{ assetInfo.coinDenom }}
          </p>
          <p class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0">
            {{ formatPrice(getMarketPrice(asset.balance.denom)) }}
          </p>
        </div>
      </div>

      <div class="hidden md:block">
      <div
        class="text-primary nls-font-500 text-14 text-center m-0"
      >
        <CurrencyComponent
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          :amount="DEFAULT_APR"
          :hasSpace="false"
          :isDenomInfront="false"
          denom="%"
        />
      </div>
    </div>

      <div class="block info-show">
        <p class="text-primary nls-font-500 text-16 nls-font-500 text-right m-0">
          {{
            calculateBalance(
              asset.balance.amount.toString(),
              asset.balance.denom
            )
          }}
        </p>
        <div class="flex items-center justify-end text-dark-grey text-12 nls-font-400 text-right m-0">
          {{
            convertMinimalDenomToDenom(
              asset.balance.amount,
              asset.balance.denom
            )
          }}
        </div>
      </div>

      <div class="flex justify-end nls-btn-show">
        <button
          class="btn btn-secondary btn-medium-secondary"
          @click="openSupplyWithdraw()"
        >
          {{ $t("message.supply-withdraw") }}
        </button>
      </div>

      <div class="mobile-actions md:hidden col-span-2">
        <button
            class="btn btn-secondary btn-medium-secondary w-full"
            @click="openSupplyWithdraw()"
          >
            {{ $t("message.supply-withdraw") }}
        </button>
      </div>

    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from 'vue';
import type { AssetBalance } from '@/stores/wallet/state';
import CurrencyComponent from '../CurrencyComponent.vue';
import { Coin, Int } from '@keplr-wallet/unit';
import { CurrencyUtils } from '@nolus/nolusjs';
import { useOracleStore } from '@/stores/oracle';
import { computed } from '@vue/reactivity';
import { useWalletStore } from '@/stores/wallet';
import { CURRENCY_VIEW_TYPES } from '@/types/CurrencyViewType';
import { DEFAULT_APR } from '@/config/env';

const oracle = useOracleStore();
const wallet = useWalletStore();

const props = defineProps({
  asset: {
    type: Object as PropType<AssetBalance>,
    required: true,
  },
  cols: {
    type: Number,
  },
  openSupplyWithdraw: {
    type: Function,
    required: true,
  },
});

const assetInfo = computed(() => {
  const assetInfo = wallet.getCurrencyInfo(props.asset.balance.denom);
  return assetInfo;
})

const formatPrice = (price: string) => {
  return CurrencyUtils.formatPrice(price);
};

const getMarketPrice = (denom: string) => {
  const prices = oracle.prices;
  if (prices) {
    return prices[denom]?.amount || '0';
  }
  return '0';
};

const convertMinimalDenomToDenom = (
  tokenAmount: string,
  minimalDenom: string
) => {
  const assetInfo = wallet.getCurrencyInfo(minimalDenom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    tokenAmount,
    minimalDenom,
    assetInfo.coinDenom,
    assetInfo.coinDecimals
  );
};

const calculateBalance = (tokenAmount: string, denom: string) => {
  const price = getMarketPrice(denom);
  const tokenDecimals = wallet.getCurrencyInfo(denom).coinDecimals;
  const coin = new Coin(denom, new Int(tokenAmount));
  return CurrencyUtils.calculateBalance(price, coin, tokenDecimals);
};

</script>
