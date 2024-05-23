<template>
  <AssetsTableRow
    :items="items"
    class="flex-wrap md:flex-nowrap"
  >
    <template #token>
      <CurrencyComponent
        :amount="assetBalance"
        :decimals="assetInfo.decimal_digits"
        :maxDecimals="maxCoinDecimals"
        :minimalDenom="assetInfo.ibcData"
        :type="CURRENCY_VIEW_TYPES.TOKEN"
        denom=""
      />
    </template>
    <template #rowFooter>
      <div class="basis-full md:hidden">
        <p class="text-dark-grey nls-font-500 m-0 text-center text-12">
          {{ endTime }}
        </p>
      </div>
    </template>
  </AssetsTableRow>
</template>

<script lang="ts" setup>
import { computed, type PropType } from "vue";
import { CURRENCY_VIEW_TYPES, type ExternalCurrency } from "@/common/types";
import { AssetUtils as WebAppAssetUtils } from "@/common/utils";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { AssetsTableRow } from "web-components";

const props = defineProps({
  assetBalance: {
    type: String,
    required: true
  },
  assetInfo: {
    type: Object as PropType<ExternalCurrency>,
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

const items = computed(() => [
  {
    value: props.assetInfo?.shortName,
    image: props.assetInfo.icon,
    imageClass: "w-8"
  },
  {
    value: props.endTime,
    class: "hidden md:flex !justify-start"
  },
  {
    type: CURRENCY_VIEW_TYPES.TOKEN
  }
]);
</script>
