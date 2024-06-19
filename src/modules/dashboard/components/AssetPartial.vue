<template>
  <AssetsTableRow
    :items="items"
    :rowButton="
      showActionButtons ? { label: canSupply ? $t('message.supply') : $t('message.lease'), class: 'hidden' } : null
    "
    @button-click="
      () => {
        canSupply
          ? openModal(DASHBOARD_ACTIONS.SUPPLY, assetInfo.key)
          : openModal(DASHBOARD_ACTIONS.LEASE, assetInfo.key);
      }
    "
  >
    <template #token>
      <CurrencyComponent
        v-if="assetBalance"
        :amount="assetBalance"
        :decimals="assetInfo.decimal_digits"
        :maxDecimals="maxCoinDecimals"
        :minimalDenom="assetInfo.ibcData"
        :type="CURRENCY_VIEW_TYPES.TOKEN"
        denom=""
      />
    </template>
    <template #currency>
      <CurrencyComponent
        v-if="app.native?.ticker == assetInfo.ticker"
        :amount="walletStore.apr.toString()"
        :defaultZeroValue="'-'"
        :hasSpace="false"
        :isDenomInfront="false"
        :type="CURRENCY_VIEW_TYPES.CURRENCY"
        denom="%"
      />
      <template v-else>
        <div v-if="isEarn">
          <CurrencyComponent
            :amount="apr"
            :hasSpace="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            denom="%"
          />
          <p class="text-[12px] text-[#1AB171]">+{{ rewards }}% {{ NATIVE_ASSET.label }}</p>
        </div>
        <template v-else> – </template>
      </template>
    </template>
    <template #complex>
      <template v-if="canLease">
        <template v-if="balance > 0">
          <CurrencyComponent
            :amount="leasUpTo"
            :decimals="assetInfo.decimal_digits"
            :maxDecimals="maxLeaseUpToCoinDecimals"
            :minimalDenom="assetInfo.ibcData"
            :type="CURRENCY_VIEW_TYPES.TOKEN"
            denom=""
          />
        </template>
        <template v-else>
          <CurrencyComponent
            :amount="DEFAULT_LEASE_UP_PERCENT"
            :hasSpace="false"
            :isDenomInfront="false"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            denom="%"
          />
        </template>
      </template>
      <template v-else> – </template>
    </template>
  </AssetsTableRow>
</template>

<script lang="ts" setup>
import { DASHBOARD_ACTIONS } from "../types";
import { computed, type PropType } from "vue";
import { Coin, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { type ExternalCurrency } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils as WebAppAssetUtils } from "@/common/utils";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { AssetsTableRow, CURRENCY_VIEW_TYPES } from "web-components";

import {
  DEFAULT_LEASE_UP_PERCENT,
  LEASE_UP_COEFICIENT,
  NATIVE_ASSET,
  NATIVE_CURRENCY as DEFAULT_CURRENCY
} from "@/config/global";
import { CurrencyMapping } from "@/config/currencies";

const walletStore = useWalletStore();
const app = useApplicationStore();

const props = defineProps({
  assetBalance: {
    type: String,
    required: true
  },
  assetInfo: {
    type: Object as PropType<ExternalCurrency>,
    required: true
  },
  openModal: {
    type: Function,
    required: true
  },
  denom: {
    type: String,
    required: true
  },
  price: {
    type: String,
    required: true
  },
  changeDirection: {
    type: Boolean,
    default: false
  },
  cols: {
    type: Number
  }
});

const canLease = computed(() => {
  const curency = WebAppAssetUtils.getCurrencyByDenom(props.denom);
  const [ticker] = curency.key.split("@");
  return Number(props.assetBalance) > 0 && app.leasesCurrencies.includes(CurrencyMapping[ticker]?.ticker ?? ticker);
});

const canSupply = computed(() => {
  const curency = WebAppAssetUtils.getCurrencyByDenom(props.denom);
  const lpns = (app.lpn ?? []).map((item) => item.key);
  return Number(props.assetBalance) > 0 && lpns.includes(curency.ticker);
});

const isEarn = computed(() => {
  const curency = WebAppAssetUtils.getCurrencyByDenom(props.denom);
  const lpns = (app.lpn ?? []).map((item) => item.ticker);
  return lpns.includes(curency.ticker);
});

const showActionButtons = computed(() => canLease.value);

const balance = computed(() => {
  return Number(props.assetBalance);
});

const leasUpTo = computed(() => {
  const balance = Number(props.assetBalance);
  const leaseUpToAmount = balance * LEASE_UP_COEFICIENT;
  return Math.round(leaseUpToAmount).toString();
});

const rewards = computed(() => {
  return (app.dispatcherRewards ?? 0).toFixed(2);
});

const apr = computed(() => {
  const [ticker, protocol] = props.assetInfo.key.split("@");
  return (app.apr?.[protocol] ?? 0).toString();
});

const maxCoinDecimals = computed(() => {
  return WebAppAssetUtils.formatDecimals(props.denom, props.assetBalance);
});

const maxLeaseUpToCoinDecimals = computed(() => {
  return WebAppAssetUtils.formatDecimals(props.denom, leasUpTo.value);
});

function calculateBalance(price: string, tokenAmount: string, denom: string) {
  const tokenDecimals = Number(WebAppAssetUtils.getCurrencyByDenom(denom).decimal_digits);
  const coin = new Coin(denom, new Int(tokenAmount));
  const data = CurrencyUtils.calculateBalance(price, coin, tokenDecimals);
  return data.toDec().toString(2);
}

const items = computed(() => [
  {
    value: props.assetInfo?.shortName,
    subValue: `${CurrencyUtils.formatPrice(props.price).maxDecimals(6)}`,
    image: props.assetInfo.icon,
    imageClass: "w-8"
  },
  {
    type: CURRENCY_VIEW_TYPES.TOKEN,
    subValue: `${DEFAULT_CURRENCY.symbol}${calculateBalance(props.price, props.assetBalance, props.denom)}`
  },
  {
    type: CURRENCY_VIEW_TYPES.CURRENCY,
    class: "hidden md:flex"
  },
  {
    type: CURRENCY_VIEW_TYPES.COMPLEX,
    class: "hidden md:flex"
  }
]);
</script>
<style lang="scss" scoped></style>
