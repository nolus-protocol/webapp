<template>
  <div class="border-standart relative block">
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
          <p class="tag data-label-info garet-medium m-0 rounded-md px-[4px] py-[2px] text-[10px] uppercase">
            {{ $t("message.deposit-interest") }}
          </p>
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
          <div class="text-dark-grey garet-medium m-0 flex items-center text-12">
            {{ NATIVE_CURRENCY.symbol }}{{ calculateBalance(asset.balance.amount.toString(), asset.balance.denom) }}
          </div>
        </template>
        <template v-else>
          <p class="text-primary">–</p>
        </template>
      </div>

      <div class="info-show">
        <div class="nls-font-500 m-0 justify-end text-right text-14 text-primary">
          <CurrencyComponent
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="apr"
            :hasSpace="false"
            :isDenomInfront="false"
            denom="%"
          />
          <p class="text-[12px] text-[#1AB171]">+{{ rewards }}% {{ NATIVE_ASSET.label }}</p>
        </div>
      </div>

      <div class="nls-btn-show no-margin-right flex justify-end">
        <button
          @click="props.openSupplyWithdraw"
          class="btn btn-secondary btn-medium-secondary"
        >
          {{ $t("message.supply-withdraw") }}
        </button>
      </div>

      <div class="mobile-actions col-span-2 md:hidden">
        <button
          @click="props.openSupplyWithdraw"
          class="btn btn-secondary btn-medium-secondary w-full"
        >
          {{ $t("message.supply-withdraw") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import type { PropType } from "vue";
import type { Asset } from "../types";

import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

import { Dec } from "@keplr-wallet/unit";
import { computed } from "vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils } from "@/common/utils";

const app = useApplicationStore();

const props = defineProps({
  asset: {
    type: Object as PropType<Asset>,
    required: true
  },
  cols: {
    type: Number
  },
  openSupplyWithdraw: {
    type: Function,
    required: true
  }
});

const assetInfo = computed(() => {
  const assetInfo = AssetUtils.getCurrencyByDenom(props.asset.balance.denom);
  return assetInfo;
});

const apr = computed(() => {
  const [_ticker, protocol] = props.asset.key?.split("@") ?? [];
  return (app.apr?.[protocol] ?? 0).toString();
});

const showBalance = computed(() => {
  const data = new Dec(props.asset.balance.amount);
  return data.isPositive();
});

const rewards = computed(() => {
  return (app.dispatcherRewards ?? 0).toFixed(2);
});

function calculateBalance(tokenAmount: string, denom: string) {
  return AssetUtils.getPriceByDenom(tokenAmount, denom).toString(2);
}

const maxCoinDecimals = computed(() => {
  return AssetUtils.formatDecimals(props.asset.balance.denom, props.asset.balance.amount);
});
</script>
<style lang="scss" scoped>
.tag {
  color: #5e7699;
}
.no-margin-right {
  right: 0;
}
</style>
