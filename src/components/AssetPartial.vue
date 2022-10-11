<template>
  <div
    :class="[
      `nolus-box grid gap-6 ${
        showActionButtons ? 'row-actions' : ''
      } border-b border-standart py-3 px-6 items-center justify-between`,
      cols ? 'grid-cols-' + cols : 'grid-cols-3 md:grid-cols-4',
    ]"
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
          {{ assetInfo.coinAbbreviation.toUpperCase() }}
        </p>
        <p class="text-dark-grey text-12 nls-font-400 text-left capitalize m-0">
          <img
            :src="changeDirection ? positive : negative"
            class="inline-block m-0"
          />
          {{ formatPrice(price) }}
        </p>
      </div>
    </div>

    <!-- Lease up to -->
    <div class="block">
      <p class="text-primary nls-font-500 text-14 text-right m-0">
        {{ formatLeaseUpTo() }}
      </p>
    </div>

    <!-- Earnings -->
    <div v-if="earnings" class="hidden md:block">
      <div
        class="flex items-center justify-end text-primary nls-font-400 text-small-copy text-right m-0"
      >
        {{ earnings }}%
      </div>
    </div>

    <!-- Balance -->
    <div class="block info-show">
      <p class="text-primary nls-font-500 text-16 text-right m-0">
        {{ calculateBalance(price, assetBalance, denom) }}
      </p>
      <div
        class="flex items-center justify-end text-dark-grey text-12 nls-font-400 text-right m-0"
      >
        {{
          convertMinimalDenomToDenom(
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

import { assetsInfo } from '@/config/assetsInfo';
import { DASHBOARD_ACTIONS } from '@/types';

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

// @TODO: Determine conditions
const canLease = computed(() => Number(props.assetBalance) > 0);
const canSupply = computed(() => Number(props.assetBalance) > 0);

const showActionButtons = computed(() => canLease.value || canSupply.value);

function formatPrice(price: string) {
  return CurrencyUtils.formatPrice(price);
}

function formatLeaseUpTo() {
  // @TODO: Add logic for leaseUpToAmount
  const leaseUpToAmount = Number(props.assetBalance) * 1.5;
  const formattedAmount = convertMinimalDenomToDenom(
    String(leaseUpToAmount),
    props.assetInfo.coinMinimalDenom,
    props.assetInfo.coinDenom,
    props.assetInfo.coinDecimals
  );

  return leaseUpToAmount ? formattedAmount : '150.00%';
}

function convertMinimalDenomToDenom(
  tokenAmount: string,
  minimalDenom: string,
  denom: string,
  decimals: number
) {
  return CurrencyUtils.convertMinimalDenomToDenom(
    tokenAmount,
    minimalDenom,
    denom,
    decimals
  );
}

function calculateBalance(price: string, tokenAmount: string, denom: string) {
  const tokenDecimals = assetsInfo[denom].coinDecimals;
  const coin = new Coin(denom, new Int(tokenAmount));
  return CurrencyUtils.calculateBalance(price, coin, tokenDecimals);
}
</script>
