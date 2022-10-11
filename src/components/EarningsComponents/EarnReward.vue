<template>
  <div class="block">
    <div
      :class="[
        'grid gap-6 border-b border-t border-standart px-6 py-3  items-center justify-between',
        cols ? 'grid-cols-' + cols : 'grid-cols-3 md:grid-cols-4',
      ]"
    >
      <!-- Ticker -->
      <div class="inline-flex items-center">
        <img
          v-if="getAssetIcon(reward.balance.denom)"
          :src=" getAssetIcon(reward.balance.denom)"
          class="inline-block m-0 mr-4"
          height="32"
          width="32"
        />
        <div class="inline-block">
          <p class="text-primary nls-font-500 text-18 text-left uppercase m-0">
            {{
              convertMinimalDenomToDenom(
                reward.balance?.amount.toString(),
                reward.balance?.denom
              )
            }}
          </p>
          <p class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0" >
            {{
              calculateBalance(
                reward.balance?.amount.toString(),
                reward.balance?.denom
              )
            }}
          </p>
        </div>
      </div>

      <!-- Balance -->
      <div class="flex justify-end">
        <button
          :class="`btn btn-secondary btn-medium-secondary ${
            loading ? 'js-loading' : 'btn-emphatized'
          }`"
          data-v-37958d79=""
          @:click="onClickClaim"
        >
          {{ $t("message.claim") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { AssetUtils } from '@/utils/AssetUtils';
import { CurrencyUtils } from '@nolus/nolusjs';
import { Coin, Int } from '@keplr-wallet/unit';
import { useOracleStore } from '@/stores/oracle';
import { type PropType, ref } from 'vue';

defineProps({
  cols: {
    type: Number,
  },
  reward: {
    type: Object as PropType<any>,
    required: true,
  },
  onClickClaim: {
    type: Function,
  },
});

const oracle = useOracleStore();
const loading = ref(false);

const getAssetIcon = (denom: string) => {
  return AssetUtils.getAssetInfoByAbbr(denom).coinIcon || '';
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
  const assetInfo = AssetUtils.getAssetInfoByAbbr(minimalDenom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    tokenAmount,
    minimalDenom,
    assetInfo.coinDenom,
    assetInfo.coinDecimals
  );
};

const calculateBalance = (tokenAmount: string, denom: string) => {
  const price = getMarketPrice(denom);
  const tokenDecimals = AssetUtils.getAssetInfoByAbbr(denom).coinDecimals;
  const coin = new Coin(denom, new Int(tokenAmount));
  return CurrencyUtils.calculateBalance(price, coin, tokenDecimals);
};
</script>
