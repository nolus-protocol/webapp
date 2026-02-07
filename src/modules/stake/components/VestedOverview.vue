<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.vested')"
      :icon="{ name: 'earn' }"
    />
    <div class="flex items-center gap-3">
      <img
        :src="asset?.icon"
        class="h-8 w-8"
      />
      <div class="flex flex-col">
        <span class="text-16 font-semibold text-typography-default">{{ balance }} {{ asset?.shortName }}</span>
        <span class="text-14 text-typography-secondary">{{ NATIVE_CURRENCY.symbol }}{{ stableBalance }}</span>
      </div>
    </div>
    <div class="mt-4 flex items-center justify-between border-t border-border-color pt-4">
      <span class="text-14 text-typography-secondary">{{ $t("message.release") }}</span>
      <span class="text-14 font-semibold text-typography-default">{{ vestedTokens[0]?.endTime }}</span>
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import { Widget } from "web-components";
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import { computed } from "vue";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { usePricesStore } from "@/common/stores/prices";
import { useWalletStore } from "@/common/stores/wallet";
import { formatNumber, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import { getCurrencyByTicker } from "@/common/utils/CurrencyLookup";
import { Coin, Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";

const pricesStore = usePricesStore();
const wallet = useWalletStore();

const props = defineProps<{
  vestedTokens: { endTime: string; amount: { amount: string; denom: string } }[];
}>();

const asset = computed(() => getCurrencyByTicker(NATIVE_ASSET.ticker));

const balance = computed(() => {
  return formatTokenBalance(new Dec(wallet.vestTokens.amount, asset.value.decimal_digits));
});

const stableBalance = computed(() => {
  const price = pricesStore.prices[asset.value.key]?.price;
  const stable = CurrencyUtils.calculateBalance(
    price,
    new Coin(asset.value.ibcData, wallet.vestTokens.amount),
    asset.value.decimal_digits
  ).toDec();
  return formatNumber(stable.toString(2), 2);
});
</script>
