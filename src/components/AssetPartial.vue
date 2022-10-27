<template>
  <div
    :class="[
      `nolus-box grid gap-6 ${
        showActionButtons ? 'row-actions' : ''
      } border-b border-standart py-3 px-6 items-center justify-between`,
      cols ? 'grid-cols-' + cols : 'grid-cols-3 md:grid-cols-4',
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
        <p class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0">
          <img
            :src="changeDirection ? positive : negative"
            class="inline-block m-0 mr-2"
          />
          {{ CurrencyUtils.formatPrice(price) }}
        </p>
      </div>
    </div>

    <div class="block">
      <p class="text-primary nls-font-500 text-16 text-right m-0">
        <template v-if="balance > 0">
          <CurrencyComponent
            :type="CURRENCY_VIEW_TYPES.TOKEN"
            :amount="leasUpTo"
            :minimalDenom="assetInfo.coinMinimalDenom"
            :denom="assetInfo.coinDenom"
            :decimals="assetInfo.coinDecimals"
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
      </p>

    </div>

    <div v-if="earnings" class="hidden md:block">
      <div
        class="text-primary nls-font-500 text-14 text-right m-0"
      >
        <CurrencyComponent
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          :amount="earnings"
          :hasSpace="false"
          :isDenomInfront="false"
          denom="%"
        />
      </div>
    </div>

    <div class="block info-show">
      <p class="text-primary nls-font-500 text-16 text-right m-0">
        <CurrencyComponent
          :type="CURRENCY_VIEW_TYPES.CURRENCY"
          :amount="calculateBalance(price, assetBalance, denom)"
          :hasSpace="false"
          :denom="DEFAULT_CURRENCY.symbol"
        />
      </p>
      <div
        class="flex items-center justify-end text-dark-grey text-12 nls-font-400 text-right m-0"
      >
        {{
          CurrencyUtils.convertMinimalDenomToDenom(
            assetBalance,
            assetInfo.coinMinimalDenom,
            assetInfo.coinDenom,
            assetInfo.coinDecimals
          )
        }}
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
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { AssetInfo } from '@/types';
import { computed, type PropType } from 'vue';
import { Coin, Int } from '@keplr-wallet/unit';
import { CurrencyUtils } from '@nolus/nolusjs';
import positive from '@/assets/icons/change-positive.svg';
import negative from '@/assets/icons/change-negative.svg';
import CurrencyComponent from '@/components/CurrencyComponent.vue';

import { DASHBOARD_ACTIONS } from '@/types';
import { DEFAULT_CURRENCY, DEFAULT_LEASE_UP_PERCENT, GROUPS, LEASE_UP_COEFICIENT } from '@/config/env';
import { CURRENCY_VIEW_TYPES } from '@/types/CurrencyViewType';
import { useWalletStore } from '@/stores/wallet';

const walletStore = useWalletStore();

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
  return Number(props.assetBalance) > 0 && currency.groups.includes(GROUPS.Lease);
});

const canSupply = computed(() => {
  const curency = walletStore.currencies[props.denom];
  return Number(props.assetBalance) > 0 && curency.groups.includes(GROUPS.Lpn);
});

const showActionButtons = computed(() => canLease.value || canSupply.value);

const balance = computed(() => {
  return Number(props.assetBalance);
});

const leasUpTo = computed(() => {
  const balance = Number(props.assetBalance);
  const leaseUpToAmount = balance * LEASE_UP_COEFICIENT + balance;
  return leaseUpToAmount.toString();
});


const calculateBalance = (price: string, tokenAmount: string, denom: string) => {
  const tokenDecimals = Number(walletStore.currencies[denom].decimal_digits);
  const coin = new Coin(denom, new Int(tokenAmount));
  const data = CurrencyUtils.calculateBalance(price, coin, tokenDecimals);
  return data.toDec().toString(2)
}
</script>
