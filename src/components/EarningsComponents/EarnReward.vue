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
          <p class="text-dark-grey text-12 garet-medium text-left capitalize m-0">
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
          :disabled="!isEnabled"
          :class="`btn btn-secondary btn-medium-secondary plausible-event-name=claim ${loading ? 'js-loading' : ''} ${isEnabled ? '' : 'disabled'}`"
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
import type { AssetBalance } from "@/stores/wallet/state";

import CurrencyComponent from "@/components/CurrencyComponent.vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { useWalletStore } from "@/stores/wallet";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import { AssetUtils } from "@/utils";

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

const wallet = useWalletStore();
const loading = ref(false);

const assetInfo = computed(() => {
  const assetInfo = wallet.getCurrencyInfo(props.reward.balance.denom);
  return assetInfo;
});

function calculateBalance(tokenAmount: string, denom: string) {
  return AssetUtils.getPriceByDenom(tokenAmount, denom).toString(2);
};

const isEnabled = computed(() => {
  const asset = CurrencyUtils.convertCoinUNolusToNolus(props.reward.balance)?.toDec();

  if (asset?.gt(new Dec(0))) {
    return true;
  }

  return false;
});
</script>
