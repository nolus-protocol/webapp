<template>
  <div
    class="asset-partial nolus-box grid gap-6 relative border-b border-standart py-3 px-6 items-center justify-between"
    :class="[
      showActionButtons ? 'row-actions' : '',
      cols ? 'grid-cols-' + cols : 'grid-cols-2 md:grid-cols-4',
    ]"
  >
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
          {{ assetInfo.coinAbbreviation.toUpperCase() }}
        </p>
        <p class="text-dark-grey text-12 text-left capitalize m-0 garet-medium">
          {{ CurrencyUtils.formatPrice(price).maxDecimals(6) }}
        </p>
      </div>
    </div>

    <div class="block">
      <p class="text-primary nls-font-500 text-16 text-right m-0">
        <CurrencyComponent
          :type="CURRENCY_VIEW_TYPES.TOKEN"
          :amount="assetBalance"
          :minimalDenom="assetInfo.coinMinimalDenom"
          :denom="assetInfo.coinDenom"
          :decimals="assetInfo.coinDecimals"
          :maxDecimals="6"
        />
      </p>
      <div class="flex items-center justify-end text-dark-grey text-12 garet-medium text-right m-0">
        {{ DEFAULT_CURRENCY.symbol }}{{ calculateBalance(price, assetBalance, denom) }}
      </div>
    </div>

    <div
      v-if="earnings"
      class="hidden md:block"
    >
      <div class="text-primary nls-font-500 text-14 text-right m-0">
        <CurrencyComponent
          v-if="NATIVE_CURRENCY.key == assetInfo.ticker"
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          :amount="walletStore.apr.toString()"
          :hasSpace="false"
          :isDenomInfront="false"
          :defaultZeroValue="'-'"
          denom="%"
        />
        <template v-else>
          <div v-if="assetInfo.isEarn">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="app.apr?.toString() ?? '0'"
              :hasSpace="false"
              :isDenomInfront="false"
              denom="%"
            />
            <p class="text-[#1AB171] text-[12px]">
              +{{ rewards }}% {{ NATIVE_ASSET.label }}
            </p>
          </div>
          <template v-else>
            –
          </template>
        </template>
      </div>
    </div>

    <div class="md:block hidden info-show">
      <p class="text-primary nls-font-500 text-16 text-right m-0">
        <template v-if="assetInfo.canLease">
          <template v-if="balance > 0">
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="leasUpTo"
              :minimalDenom="assetInfo.coinMinimalDenom"
              :denom="assetInfo.coinDenom"
              :decimals="assetInfo.coinDecimals"
              :maxDecimals="6"
            />
          </template>
          <template v-else>
            <CurrencyComponent
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="DEFAULT_LEASE_UP_PERCENT"
              :hasSpace="false"
              :isDenomInfront="false"
              denom="%"
            />
          </template>
        </template>
        <template v-else>
          –
        </template>
      </p>
    </div>

    <div
      v-if="canLease || canSupply"
      class="mobile-actions md:hidden col-span-2"
    >
      <div class="flex">
        <button
          class="btn btn-secondary btn-medium-secondary flex-1"
          v-if="canLease"
          @click="openModal(DASHBOARD_ACTIONS.LEASE, denom)"
        >
          {{ $t("message.lease-up-to") }}
          <template v-if="balance > 0">
            <CurrencyComponent
              :fontSize="14"
              :type="CURRENCY_VIEW_TYPES.TOKEN"
              :amount="leasUpTo"
              :minimalDenom="assetInfo.coinMinimalDenom"
              :decimals="assetInfo.coinDecimals"
              :maxDecimals="2"
              denom=""
            />
          </template>
          <template v-else>
            <CurrencyComponent
              :fontSize="14"
              :type="CURRENCY_VIEW_TYPES.CURRENCY"
              :amount="DEFAULT_LEASE_UP_PERCENT"
              :hasSpace="false"
              :isDenomInfront="false"
              denom="%"
            />
          </template>
        </button>

        <button
          class="btn btn-secondary btn-medium-secondary flex-1"
          v-if="canSupply"
          @click="openModal(DASHBOARD_ACTIONS.SUPPLY, denom)"
        >
          {{ $t("message.earn") }}
          <CurrencyComponent
            :fontSize="14"
            :type="CURRENCY_VIEW_TYPES.CURRENCY"
            :amount="app.apr?.toString() ?? '0'"
            :hasSpace="false"
            :isDenomInfront="false"
            denom="%"
          />
        </button>

        <!-- <button
          class="btn btn-secondary btn-medium-secondary flex-1"
          v-if="canStake"
          @click="openModal(DASHBOARD_ACTIONS.LEASE, denom)"
        >
          {{ $t("message.lease") }}
        </button> -->
      </div>
    </div>

    <div class="flex justify-end nls-btn-show">
      <button
        v-if="canLease"
        class="btn btn-secondary btn-medium-secondary mr-1"
        @click="openModal(DASHBOARD_ACTIONS.LEASE, denom)"
      >
        {{ $t("message.lease") }}
      </button>
      <button
        v-if="canSupply"
        class="btn btn-secondary btn-medium-secondary"
        @click="openModal(DASHBOARD_ACTIONS.SUPPLY, denom)"
      >
        {{ $t("message.supply") }}
      </button>
      <!-- <button
        v-if="canStake"
        class="btn btn-secondary btn-medium-secondary"
        @click="openModal(DASHBOARD_ACTIONS.LEASE, denom)"
      >
        {{ $t("message.lease") }}
      </button> -->
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AssetInfo } from "@/types";
import CurrencyComponent from "@/components/CurrencyComponent.vue";
import { computed, type PropType } from "vue";
import { Coin, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { CURRENCY_VIEW_TYPES } from "@/types/CurrencyViewType";
import { useWalletStore } from "@/stores/wallet";
import { NATIVE_CURRENCY } from "@/config/assetsInfo";
import { DASHBOARD_ACTIONS } from "@/types";
import { NATIVE_CURRENCY as DEFAULT_CURRENCY, DEFAULT_LEASE_UP_PERCENT, GROUPS, INTEREST_DECIMALS, LEASE_UP_COEFICIENT, NATIVE_ASSET } from "@/config/env";
import { useApplicationStore } from "@/stores/application";

const walletStore = useWalletStore();
const app = useApplicationStore();

const props = defineProps({
  assetBalance: {
    type: String,
    required: true,
  },
  assetInfo: {
    type: Object as PropType<AssetInfo>,
    required: true,
  },
  openModal: {
    type: Function,
    required: true,
  },
  denom: {
    type: String,
    required: true,
  },
  price: {
    type: String,
    required: true,
  },
  earnings: {
    type: String,
    required: true,
  },
  changeDirection: {
    type: Boolean,
    default: false,
  },
  cols: {
    type: Number,
  },
});

const canLease = computed(() => {
  const currency = walletStore.currencies[props.denom];
  return (
    Number(props.assetBalance) > 0 && currency.groups.includes(GROUPS.Lease)
  );
});

const canSupply = computed(() => {
  const curency = walletStore.currencies[props.denom];
  return Number(props.assetBalance) > 0 && curency.groups.includes(GROUPS.Lpn);
});

const canStake = computed(() => {
  const curency = walletStore.currencies[props.denom];
  return (
    NATIVE_CURRENCY.key == curency.ticker && Number(props.assetBalance) > 0
  );
});

const showActionButtons = computed(
  () => canLease.value
);

const balance = computed(() => {
  return Number(props.assetBalance);
});

const leasUpTo = computed(() => {
  const balance = Number(props.assetBalance);
  const leaseUpToAmount = balance * LEASE_UP_COEFICIENT;
  return leaseUpToAmount.toString();
});

const rewards = computed(() => {
  return (app.dispatcherRewards ?? 0 / Math.pow(10, INTEREST_DECIMALS)).toFixed(2);
});

const calculateBalance = (
  price: string,
  tokenAmount: string,
  denom: string
) => {
  const tokenDecimals = Number(walletStore.currencies[denom].decimal_digits);
  const coin = new Coin(denom, new Int(tokenAmount));
  const data = CurrencyUtils.calculateBalance(price, coin, tokenDecimals);
  return data.toDec().toString(2);
};
</script>
<style scoped lang="scss">
div.mobile-actions {

  button,
  a {
    font-family: "Garet-Medium" !important;

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
