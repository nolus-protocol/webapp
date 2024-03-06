<template>
  <div
    class="vested-partial nolus-box border-standart grid grid-cols-2 items-center justify-between gap-6 border-b px-6 py-3 md:grid-cols-3"
  >
    <div class="inline-flex items-center">
      <img
        v-if="assetInfo.coinIcon"
        :src="assetInfo.coinIcon"
        class="m-0 mr-4 inline-block"
        height="32"
        width="32"
      />
      <div class="inline-block">
        <p class="nls-font-500 m-0 text-left text-18 uppercase text-primary">
          {{ assetInfo.shortName }}
        </p>
      </div>
    </div>

    <div class="hidden md:block">
      <p class="nls-font-500 m-0 text-16 text-primary">
        {{ endTime }}
      </p>
    </div>

    <div class="block">
      <div class="nls-font-500 m-0 text-right text-16 text-primary">
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

    <div class="col-span-2 md:hidden">
      <p class="text-dark-grey nls-font-500 m-0 text-center text-12">
        {{ endTime }}
      </p>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { type AssetInfo } from "../types";
import { computed, type PropType } from "vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AssetUtils as WebAppAssetUtils } from "@/common/utils";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

const props = defineProps({
  assetBalance: {
    type: String,
    required: true
  },
  assetInfo: {
    type: Object as PropType<AssetInfo>,
    required: true
  },
  denom: {
    type: String,
    required: true
  },
  endTime: {
    type: String,
    required: true
  }
});

const maxCoinDecimals = computed(() => {
  return WebAppAssetUtils.formatDecimals(props.denom, props.assetBalance);
});
</script>
