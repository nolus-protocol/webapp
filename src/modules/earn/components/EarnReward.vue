<template>
  <div class="block">
    <div
      class="border-standart earn-asset grid grid-cols-3 items-center justify-between gap-6 border-b border-t py-3 md:grid-cols-3"
    >
      <!-- Ticker -->
      <div class="col-span-2 inline-flex items-center">
        <img
          v-if="assetInfo.icon"
          :src="assetInfo.icon"
          class="m-0 mr-4 inline-block"
          height="32"
          width="32"
        />
        <div class="inline-block">
          <p class="nls-font-500 m-0 text-left text-18 text-primary">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="reward.balance.amount.toString()"
              :minimalDenom="assetInfo.ibcData"
              :denom="assetInfo.shortName"
              :decimals="assetInfo.decimal_digits"
              :maxDecimals="6"
              :fontSizeSmall="12"
            />
          </p>
          <p class="text-dark-grey garet-medium m-0 text-left text-12 capitalize">
            ${{ calculateBalance(reward.balance?.amount.toString(), reward.balance?.denom) }}
          </p>
        </div>
      </div>

      <!-- Balance -->
      <div class="flex justify-end">
        <button
          :disabled="!isEnabled"
          :class="`btn btn-secondary btn-medium-secondary ${loading ? 'js-loading' : ''} ${isEnabled ? '' : 'disabled'}`"
          @:click="onClickClaim"
        >
          {{ $t("message.claim") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { type PropType, ref, computed } from "vue";
import type { AssetBalance } from "@/common/stores/wallet/types";

import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AssetUtils } from "@/common/utils";

const props = defineProps({
  cols: {
    type: Number
  },
  reward: {
    type: Object as PropType<AssetBalance>,
    required: true
  },
  onClickClaim: {
    type: Function
  }
});

const loading = ref(false);

const assetInfo = computed(() => {
  const assetInfo = AssetUtils.getCurrencyByDenom(props.reward.balance.denom);
  return assetInfo;
});

function calculateBalance(tokenAmount: string, denom: string) {
  return AssetUtils.getPriceByDenom(tokenAmount, denom).toString(2);
}

const isEnabled = computed(() => {
  const asset = CurrencyUtils.convertCoinUNolusToNolus(props.reward.balance)?.toDec();

  if (asset?.gt(new Dec(0))) {
    return true;
  }

  return false;
});
</script>
