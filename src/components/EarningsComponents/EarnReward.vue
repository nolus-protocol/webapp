<template>
  <div class="block">
    <div
      class="grid gap-6 border-b border-t border-standart px-6 py-3 items-center justify-between earn-asset grid-cols-3 md:grid-cols-3"
    >
      <!-- Ticker -->
      <div class="inline-flex items-center col-span-2">
        <img
          v-if="assetInfo.coinIcon"
          :src="assetInfo.coinIcon"
          class="inline-block m-0 mr-4"
          height="32"
          width="32"
        />
        <div class="inline-block">
          <p class="text-primary nls-font-500 text-18 text-left uppercase m-0">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="reward.balance.amount.toString()"
              :minimalDenom="assetInfo.coinMinimalDenom"
              :denom="assetInfo.coinDenom"
              :decimals="assetInfo.coinDecimals"
              :maxDecimals="6"
              :fontSizeSmall="12"
            />
          </p>
          <p
            class="text-dark-grey text-12 garet-medium text-left capitalize m-0"
          >
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
import { CurrencyUtils } from "@nolus/nolusjs";
import { Coin, Int } from "@keplr-wallet/unit";
import { useOracleStore } from "@/stores/oracle";
import { useWalletStore } from "@/stores/wallet";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import type { AssetBalance } from "@/stores/wallet/state";
import CurrencyComponent from "@/components/CurrencyComponent.vue";

const props = defineProps({
  cols: {
    type: Number,
  },
  reward: {
    type: Object as PropType<AssetBalance>,
    required: true,
  },
  onClickClaim: {
    type: Function,
  },
});

const oracle = useOracleStore();
const wallet = useWalletStore();
const loading = ref(false);

const assetInfo = computed(() => {
  const assetInfo = wallet.getCurrencyInfo(props.reward.balance.denom);
  return assetInfo;
});

const getMarketPrice = (denom: string) => {
  const prices = oracle.prices;
  if (prices) {
    return prices[denom]?.amount || "0";
  }
  return "0";
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
