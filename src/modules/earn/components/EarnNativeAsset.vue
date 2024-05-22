<template>
  <EarningAssetsTableRow
    :items="items"
    :rowButton="{ label: $t('message.delegate-undelegate') }"
    @button-click="
      () => {
        props.openDelegateUndelegate();
      }
    "
  >
    <template #token>
      <CurrencyComponent
        v-if="showBalance"
        :amount="asset.balance.amount.toString()"
        :decimals="assetInfo.decimal_digits"
        :fontSizeSmall="12"
        :maxDecimals="maxCoinDecimals"
        :minimalDenom="assetInfo.ibcData"
        :type="CURRENCY_VIEW_TYPES.TOKEN"
        denom=""
      />
      <p v-else>–</p>
    </template>
    <template #currency>
      <CurrencyComponent
        :amount="wallet.apr.toString()"
        :hasSpace="false"
        :isDenomInfront="false"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        defaultZeroValue="-"
        denom="%"
      />
    </template>
  </EarningAssetsTableRow>
</template>

<script lang="ts" setup>
import type { PropType } from "vue";
import { computed } from "vue";
import { EarningAssetsTableRow } from "web-components";
import type { AssetBalance } from "@/common/stores/wallet/types";

import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

import { Dec } from "@keplr-wallet/unit";
import { useWalletStore } from "@/common/stores/wallet";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AssetUtils } from "@/common/utils";

const wallet = useWalletStore();

const props = defineProps({
  asset: {
    type: Object as PropType<AssetBalance>,
    required: true
  },
  openDelegateUndelegate: {
    type: Function,
    required: true
  }
});

const assetInfo = computed(() => {
  return AssetUtils.getCurrencyByDenom(props.asset.balance.denom);
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

const items = computed(() => [
  {
    value: assetInfo.value.shortName,
    image: assetInfo.value.icon,
    imageClass: "w-8"
  },
  {
    type: CURRENCY_VIEW_TYPES.TOKEN,
    subValue: `$${stakedBalance.value}`,
    class: "hidden md:flex"
  },
  {
    type: CURRENCY_VIEW_TYPES.CURRENCY
  }
]);
</script>
<style lang="scss" scoped></style>
