<template>
  <div
    :class="[showActionButtons ? 'row-actions' : '', cols ? 'grid-cols-' + cols : 'grid-cols-4']"
    class="asset-partial nolus-box border-standart relative grid items-center justify-between gap-6 border-b py-3"
  >
    <div class="col-span-2 inline-flex items-center md:col-span-1">
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
        <p class="text-dark-grey garet-medium m-0 text-left text-12 capitalize">
          {{ CurrencyUtils.formatPrice(price).maxDecimals(6) }}
        </p>
      </div>
    </div>

    <div class="block">
      <p class="nls-font-500 m-0 text-right text-16 text-primary">
        <CurrencyComponent
          :amount="assetBalance"
          :decimals="assetInfo.decimal_digits"
          :maxDecimals="maxCoinDecimals"
          :minimalDenom="assetInfo.ibcData"
          :type="CURRENCY_VIEW_TYPES.TOKEN"
          denom=""
        />
      </p>
      <div class="text-dark-grey garet-medium m-0 flex items-center justify-end text-right text-12">
        {{ DEFAULT_CURRENCY.symbol }}{{ calculateBalance(price, assetBalance, denom) }}
      </div>
    </div>

    <div
      v-if="earnings"
      class="hidden md:block"
    >
      <div class="nls-font-500 m-0 text-right text-14 text-primary">
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
      </div>
    </div>

    <div class="relative hidden md:block">
      <div class="info-show">
        <p class="nls-font-500 m-0 text-right text-16 text-primary">
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
        </p>
      </div>
      <div class="nls-btn-show !right-0 flex justify-end">
        <button
          class="btn btn-secondary btn-medium-secondary"
          @click="openModal(DASHBOARD_ACTIONS.LEASE, assetInfo.key)"
        >
          {{ $t("message.lease") }}
        </button>

        <button
          v-if="canSupply"
          class="btn btn-secondary btn-medium-secondary"
          @click="openModal(DASHBOARD_ACTIONS.SUPPLY, assetInfo.key)"
        >
          {{ $t("message.supply") }}
        </button>
      </div>
    </div>
  </div>
</template>

<script lang="ts" setup>
import { DASHBOARD_ACTIONS } from "../types";
import { computed, type PropType } from "vue";
import { Coin, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { CURRENCY_VIEW_TYPES, type ExternalCurrency } from "@/common/types";
import { useWalletStore } from "@/common/stores/wallet";
import { useApplicationStore } from "@/common/stores/application";
import { AssetUtils as WebAppAssetUtils } from "@/common/utils";
import CurrencyComponent from "@/common/components/CurrencyComponent.vue";

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
  earnings: {
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
</script>
<style lang="scss" scoped>
button.transfer {
  padding: 8px 14px !important;
}

div.mobile-actions {
  button,
  a {
    font-family: "Garet-Medium", sans-serif !important;

    &:first-child:not(&:last-child) {
      margin-right: 5px;
    }

    &:last-child:not(&:first-child) {
      margin-left: 5px;
    }
  }

  a {
    justify-content: center;
    display: flex;
  }
}
</style>
