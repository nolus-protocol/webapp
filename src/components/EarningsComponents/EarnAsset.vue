<template>
  <div class="block relative">
    <div
      class="grid gap-6 row-actions border-b flex border-t border-standart px-6 py-3 items-center justify-between earn-asset"
      :class="[cols ? 'md:grid-cols-' + cols : 'grid-cols-2 md:grid-cols-4']"
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
          <p class="text-medium-blue bg-[#EBEFF5] text-[10px] uppercase m-0 garet-medium py-[2px] px-[4px] rounded-md">
            {{ $t("message.compounding") }}
          </p>
        </div>
      </div>

      <div class="flex flex-col md:col-span-1 items-end">
        <template v-if="showBalance">
          <p class="text-primary nls-font-500 text-16 nls-font-500 m-0">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="asset.balance.amount.toString()"
              :minimalDenom="assetInfo.coinMinimalDenom"
              :denom="assetInfo.coinDenom"
              :decimals="assetInfo.coinDecimals"
              :maxDecimals="6"
              :fontSizeSmall="12"
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

      <div class="block md:col-span-1">

      </div>

      <div class="hidden md:block info-show">
        <div class="text-primary nls-font-500 text-14 text-right m-0 justify-end">
          <CurrencyComponent
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="DEFAULT_APR"
            :hasSpace="false"
            :isDenomInfront="false"
            denom="%"
          />
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
import type { PropType } from "vue";
import type { AssetBalance } from "@/stores/wallet/state";

import CurrencyComponent from "../CurrencyComponent.vue";

import { Dec } from "@keplr-wallet/unit";
import { computed } from "vue";
import { useWalletStore } from "@/stores/wallet";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import { DEFAULT_APR, NATIVE_CURRENCY } from "@/config/env";
import { AssetUtils } from "@/utils";

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
});

const showBalance = computed(() => {
  const data = new Dec(props.asset.balance.amount);
  return data.isPositive();
});

function calculateBalance(tokenAmount: string, denom: string) {
  return AssetUtils.getPriceByDenom(tokenAmount, denom).toString(2);
};
</script>
