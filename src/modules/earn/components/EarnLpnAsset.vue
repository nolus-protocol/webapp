<template>
  <EarningAssetsTableRow
    :id="$attrs.key"
    :items="items"
    :rowButton="{ label: $t('message.supply-withdraw') }"
    @button-click="
      () => {
        props.openSupplyWithdraw();
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
        :amount="apr"
        :hasSpace="false"
        :isDenomInfront="false"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        denom="%"
      />
    </template>
  </EarningAssetsTableRow>
</template>

<script lang="ts" setup>
import type { PropType } from "vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import type { Asset } from "../types";

import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

import { Dec } from "@keplr-wallet/unit";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { NATIVE_ASSET, NATIVE_CURRENCY } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils } from "@/common/utils";
import { EarningAssetsTableRow } from "web-components";

const i18n = useI18n();

const app = useApplicationStore();

const props = defineProps({
  asset: {
    type: Object as PropType<Asset>,
    required: true
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

const items = computed(() => [
  {
    value: assetInfo.value.shortName,
    valueInfo: i18n.t("message.deposit-interest"),
    image: assetInfo.value.icon,
    imageClass: "w-8"
  },
  {
    type: CURRENCY_VIEW_TYPES.TOKEN,
    subValue: `${NATIVE_CURRENCY.symbol}${calculateBalance(props.asset.balance.amount.toString(), props.asset.balance.denom)}`,
    class: "hidden md:flex"
  },
  {
    type: CURRENCY_VIEW_TYPES.CURRENCY,
    subValue: `+${rewards.value}% ${NATIVE_ASSET.label}`,
    class: "text-success-100"
  }
]);
</script>

<style lang="scss" scoped></style>
