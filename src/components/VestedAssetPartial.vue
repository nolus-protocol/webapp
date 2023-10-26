<template>
  <div
    class="vested-partial nolus-box grid gap-6 border-b border-standart py-3 px-6 items-center justify-between grid-cols-2 md:grid-cols-3"
  >
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
          {{ assetInfo.shortName }}
        </p>
      </div>
    </div>

    <div class="hidden md:block">
      <p class="text-primary nls-font-500 text-16 m-0">
        {{ endTime }}
      </p>
    </div>

    <div class="block">
      <div class="text-primary nls-font-500 text-16 text-right m-0">
        <CurrencyComponent
          :type="CURRENCY_VIEW_TYPES.TOKEN"
          :amount="assetBalance"
          :minimalDenom="assetInfo.coinMinimalDenom"
          :decimals="assetInfo.coinDecimals"
          :maxDecimals="maxCoinDecimals"
          denom=""
        />
      </div>
    </div>

    <div class="md:hidden col-span-2">
      <p class="text-dark-grey nls-font-500 text-12 m-0 text-center">
        {{ endTime }}
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AssetInfo } from "@/types";
import { computed, type PropType } from "vue";

import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import CurrencyComponent from "@/components/CurrencyComponent.vue";
import { AssetUtils as WebAppAssetUtils } from "@/utils/AssetUtils";

const props = defineProps({
  assetBalance: {
    type: String,
    required: true,
  },
  assetInfo: {
    type: Object as PropType<AssetInfo>,
    required: true,
  },
  denom: {
    type: String,
    required: true,
  },
  endTime: {
    type: String,
    required: true,
  },
});

const maxCoinDecimals = computed(() => {
  return WebAppAssetUtils.formatDecimals(props.denom, props.assetBalance);
});
</script>
