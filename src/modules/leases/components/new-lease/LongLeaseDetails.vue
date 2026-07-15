<template>
  <div class="flex flex-col gap-4">
    <div class="flex items-center gap-2">
      <SvgIcon
        size="l"
        name="list-sparkle"
      />
      <span class="text-18 font-semibold text-typography-default">{{ $t("message.details") }}</span>
    </div>

    <BigNumber
      label="Size"
      :amount="{
        microAmount: sizeAmount,
        denom: asset?.shortName ?? '',
        decimals: asset?.decimal_digits ?? 0,
        around: true,
        tooltip: true,
        fontSize: 24
      }"
      :secondary="{
        value: stable,
        denom: NATIVE_CURRENCY.symbol
      }"
    />
    <div class="flex flex-col gap-3">
      <span class="text-16 font-semibold text-typography-default">{{ $t("message.position-preview") }}</span>
      <PositionPreviewChart
        :borrowAsset="asset"
        :borrowStable="lease ? borrowStable : new Dec(0)"
        :borrowAmount="lease ? borrowAmount : '0'"
        :downPaymentStable="lease ? downPaymentStable : new Dec(0)"
        :downPaymentAmount="lease ? downPaymentAmount : '0'"
        :downPaymentAsset="downPaymentAsset"
      />
    </div>
    <div class="grid gap-x-7 gap-y-3 xl:grid-flow-col xl:grid-cols-3 xl:grid-rows-2 xl:gap-x-3">
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.lease-interest')"
        :amount="{
          value: annualInterestRate.toString(),
          denom: '%',
          isDenomPrefix: false,
          decimals: 2,
          fontSize: 16,
          class: { 'line-through': isFreeLease }
        }"
        v-bind="isFreeLease ? { additional: { text: '0%', class: 'text-typography-success' } } : {}"
      />
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.partial-liquidation')"
        :amount="{
          value: percentLique,
          denom: `% ($${calculateLique})`,
          isDenomPrefix: false,
          decimals: 0,
          fontSize: 16
        }"
      />
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.price-per-symbol', { symbol: asset?.shortName })"
        :amount="{
          value: pricesStore.prices[loanCurrency]?.price ?? '0',
          denom: NATIVE_CURRENCY.symbol,
          decimals: currentPriceDecimals,
          fontSize: 16
        }"
      />
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.downpayment')"
        :amount="{
          microAmount: downPaymentAmount,
          decimals: downPaymentAsset?.decimal_digits ?? 0,
          denom: downPaymentAsset?.shortName ?? '',
          fontSize: 16
        }"
        :secondary="{
          value: downPaymentStable.toString(),
          denom: NATIVE_CURRENCY.symbol,
          decimals: 2
        }"
      />
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.borrow')"
        :amount="{
          microAmount: props.lease?.borrow?.amount ?? '0',
          denom: lpn?.shortName ?? '',
          decimals: lpn?.decimal_digits ?? 0,
          fontSize: 16
        }"
        :secondary="{
          microAmount: borrowAmount,
          decimals: asset?.decimal_digits ?? 0,
          denom: asset?.shortName ?? ''
        }"
      />
      <BigNumber
        :label="$t('message.impact-and-dex-fees')"
        :amount="{
          microAmount: swapFeeAmount.truncate().toString(),
          decimals: asset?.decimal_digits ?? 0,
          denom: asset?.shortName ?? '',
          fontSize: 16
        }"
        :secondary="{
          value: swapStableFee.toString(),
          denom: NATIVE_CURRENCY.symbol,
          decimals: 2
        }"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { LeaseApply } from "@nolus/nolusjs/build/contracts";
import BigNumber from "@/common/components/BigNumber.vue";
import PositionPreviewChart from "./PositionPreviewChart.vue";
import { SvgIcon } from "web-components";
import { NATIVE_CURRENCY } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { useLongLeaseDetails } from "./useLongLeaseDetails";

const props = defineProps<{
  lease: LeaseApply | null | undefined;
  loanCurrency: string;
  downpaymenAmount: string;
  downpaymentCurrency: string;
}>();

const {
  pricesStore,
  swapStableFee,
  sizeAmount,
  asset,
  stable,
  borrowStable,
  borrowAmount,
  downPaymentStable,
  downPaymentAmount,
  downPaymentAsset,
  annualInterestRate,
  isFreeLease,
  percentLique,
  calculateLique,
  currentPriceDecimals,
  lpn,
  swapFeeAmount
} = useLongLeaseDetails(props);
</script>
<style lang="scss" scoped>
.fadeHeight-enter-active,
.fadeHeight-leave-active {
  transition: opacity 0.2s ease;
}

.fadeHeight-enter-from,
.fadeHeight-leave-to {
  opacity: 0;
}
</style>
