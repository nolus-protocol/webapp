<template>
  <div class="block relative border-standart">
    <div
      class="grid gap-6 row-actions border-b flex border-t border-standart py-3 items-center justify-between earn-asset"
      :class="[cols ? 'md:grid-cols-' + cols : 'grid-cols-2 md:grid-cols-3']"
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
          <p class="text-primary nls-font-500 text-18 text-left m-0">
            {{ assetInfo.shortName }}
          </p>
          <p class="tag data-label-info text-[10px] uppercase m-0 garet-medium py-[2px] px-[4px] rounded-md">
            {{ $t("message.deposit-interest") }}
          </p>
        </div>
      </div>

      <div class="hidden md:flex flex flex-col md:col-span-1 items-end">
        <template v-if="showBalance">
          <p class="text-primary nls-font-500 text-16 nls-font-500 m-0">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="asset.balance.amount.toString()"
              :minimalDenom="assetInfo.coinMinimalDenom"
              :decimals="assetInfo.coinDecimals"
              :maxDecimals="maxCoinDecimals"
              :fontSizeSmall="12"
              denom=""
            />
          </p>
          <div class="flex items-center text-dark-grey text-12 garet-medium m-0">
            {{ NATIVE_CURRENCY.symbol }}{{
              calculateBalance(
                asset.balance.amount.toString(),
                asset.balance.denom
              )
            }}
          </div>
        </template>
        <template v-else>
          <p class="text-primary">
            –
          </p>
        </template>
      </div>

      <div class="info-show">
        <div class="text-primary text-14 text-right m-0 justify-end nls-font-500">
          <CurrencyComponent
            v-if="assetInfo.key == 'USDC_AXELAR@OSMOSIS'"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="app.apr?.toString() ?? '0'"
            :hasSpace="false"
            :isDenomInfront="false"
            denom="%"
          />
          <CurrencyComponent
            v-else
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="'6.00'"
            :hasSpace="false"
            :isDenomInfront="false"
            denom="%"
          />
          <p class="text-[#1AB171] text-[12px]">
            +{{ rewards }}% {{ NATIVE_ASSET.label }}
          </p>
        </div>
      </div>

      <div class="flex justify-end nls-btn-show no-margin-right">
        <button
          @click="props.openSupplyWithdraw"
          class="btn btn-secondary btn-medium-secondary"
        >
          {{ $t("message.supply-withdraw") }}
        </button>
      </div>

      <div class="mobile-actions md:hidden col-span-2">
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
import type { AssetBalance } from "@/stores/wallet/state";

import CurrencyComponent from "../CurrencyComponent.vue";

import { Dec } from "@keplr-wallet/unit";
import { computed } from "vue";
import { useWalletStore } from "@/stores/wallet";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/env";
import { useApplicationStore } from "@/stores/application";
import { AssetUtils } from "@/utils";

const wallet = useWalletStore();
const app = useApplicationStore();

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
};

const maxCoinDecimals = computed(() => {
  return AssetUtils.formatDecimals(props.asset.balance.denom, props.asset.balance.amount);
});
</script>
<style lang="scss" scoped>
.tag {
  color: #5E7699;
}
.no-margin-right{
  right: 0;
}
</style>
