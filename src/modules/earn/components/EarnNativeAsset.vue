<template>
  <div class="border-standart relative block border-t-[1px]">
    <div
      class="row-actions border-standart earn-asset flex grid items-center justify-between gap-6 border-b border-t py-3"
      :class="[cols ? 'md:grid-cols-' + cols : 'grid-cols-2 md:grid-cols-3']"
    >
      <!-- Ticker -->
      <div class="inline-flex items-center">
        <img
          v-if="assetInfo.icon"
          :src="assetInfo.icon"
          class="m-0 mr-4 inline-block"
          height="32"
          width="32"
        />
        <div class="inline-block">
          <p class="nls-font-500 m-0 text-left text-18 text-primary">
            {{ assetInfo.shortName }}
          </p>
          <p class="text-dark-grey garet-medium m-0 text-left text-12 capitalize"></p>
        </div>
      </div>

      <div class="flex hidden flex-col items-end md:col-span-1 md:flex">
        <template v-if="showBalance">
          <p class="nls-font-500 nls-font-500 m-0 text-16 text-primary">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="asset.balance.amount.toString()"
              :minimalDenom="assetInfo.ibcData"
              :decimals="assetInfo.decimal_digits"
              :maxDecimals="maxCoinDecimals"
              :fontSizeSmall="12"
              denom=""
            />
          </p>
          <div class="text-dark-grey garet-medium m-0 flex items-center text-12">${{ stakedBalance }}</div>
        </template>
        <template v-else>
          <p class="text-primary">–</p>
        </template>
      </div>

      <div class="info-show">
        <div class="nls-font-500 m-0 justify-end text-right text-14 text-primary">
          <CurrencyComponent
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="wallet.apr.toString()"
            :hasSpace="false"
            :isDenomInfront="false"
            defaultZeroValue="-"
            denom="%"
          />
        </div>
      </div>

      <div class="nls-btn-show no-margin-right flex justify-end">
        <button
          class="btn btn-secondary btn-medium-secondary"
          @click="openDelegateUndelegate()"
        >
          {{ $t("message.delegate-undelegate") }}
        </button>
      </div>

      <div class="mobile-actions col-span-2 md:hidden">
        <button
          class="btn btn-secondary btn-medium-secondary flex w-full"
          @click="openDelegateUndelegate()"
        >
          {{ $t("message.delegate-undelegate") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { AssetBalance } from "@/common/stores/wallet/types";

import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

import { Dec } from "@keplr-wallet/unit";
import { computed } from "vue";
import { useWalletStore } from "@/common/stores/wallet";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AssetUtils } from "@/common/utils";

const wallet = useWalletStore();

const props = defineProps({
  asset: {
    type: Object as PropType<AssetBalance>,
    required: true
  },
  cols: {
    type: Number
  },
  openDelegateUndelegate: {
    type: Function,
    required: true
  },
  isDelegated: {
    type: Boolean,
    required: true
  }
});

const assetInfo = computed(() => {
  const assetInfo = AssetUtils.getCurrencyByDenom(props.asset.balance.denom);
  return assetInfo;
});

const stakedBalance = computed(() => {
  return AssetUtils.getPriceByDenom(props.asset.balance.amount, props.asset.balance.denom).toString(2);
});

const showBalance = computed(() => {
  const data = new Dec(props.asset.balance.amount);
  return data.isPositive();
});

const maxCoinDecimals = computed(() => {
  return AssetUtils.formatDecimals(props.asset.balance.denom, props.asset.balance.amount);
});
</script>
<style lang="scss" scoped>
.no-margin-right {
  right: 0 !important;
}
</style>
