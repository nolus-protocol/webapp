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
        amount: totalLoan,
        type: CURRENCY_VIEW_TYPES.TOKEN,
        denom: asset.shortName,
        maxDecimals: asset?.decimal_digits,
        minimalDenom: '',
        decimals: asset?.decimal_digits,
        hasSpace: true,
        around: true
      }"
      :secondary="{
        amount: sizeAmount,

        type: CURRENCY_VIEW_TYPES.TOKEN,
        denom: assetLoan.shortName,
        maxDecimals: assetLoan.decimal_digits,
        decimals: assetLoan.decimal_digits,
        hasSpace: true
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
      <Transition name="fadeHeight">
        <div
          v-if="showDetails"
          class="flex flex-col gap-y-3 md:flex-row md:flex-wrap"
        >
          <BigNumber
            class="md:flex-[50%]"
            :label="$t('message.downpayment')"
            :amount="{
              amount: downPaymentAmount,
              decimals: downPaymentAsset.decimal_digits,
              type: CURRENCY_VIEW_TYPES.TOKEN,
              denom: downPaymentAsset.shortName,
              hasSpace: true,
              fontSize: 16,
              fontSizeSmall: 16
            }"
            :secondary="{
              amount: downPaymentStable.toString(),
              type: CURRENCY_VIEW_TYPES.CURRENCY,
              denom: NATIVE_CURRENCY.symbol,
              decimals: 2,
              maxDecimals: 2,
              minimalDenom: ''
            }"
          />
          <div class="flex flex-col gap-y-3 md:flex-[50%]">
            <BigNumber
              class="md:flex-[50%]"
              :label="$t('message.borrow')"
              :amount="{
                amount: borrowAmount,
                decimals: asset.decimal_digits,
                type: CURRENCY_VIEW_TYPES.TOKEN,
                denom: asset.shortName,
                hasSpace: true,
                fontSize: 16,
                fontSizeSmall: 16
              }"
              :secondary="{
                amount: borrowStable.toString(),
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                decimals: 2,
                maxDecimals: 2,
                minimalDenom: ''
              }"
            />
            <BigNumber
              :label="$t('message.impact-and-dex-fees')"
              :amount="{
                amount: swapFeeAmount.toString(),
                decimals: asset.decimal_digits,
                type: CURRENCY_VIEW_TYPES.TOKEN,
                denom: asset.shortName,
                hasSpace: true,
                fontSize: 16,
                fontSizeSmall: 16
              }"
              :secondary="{
                amount: swapStableFee.toString(),
                type: CURRENCY_VIEW_TYPES.CURRENCY,
                denom: NATIVE_CURRENCY.symbol,
                maxDecimals: 4,
                decimals: 4,
                minimalDenom: ''
              }"
            />
          </div>
        </div>
      </Transition>
      <Button
        :label="showDetails ? $t('message.hide-drilldown-details') : $t('message.drilldown-details')"
        severity="secondary"
        icon="plus"
        iconPosition="left"
        size="small"
        class="w-fit self-end text-icon-default"
        @click="() => (showDetails = !showDetails)"
      />
      <Transition name="fadeHeight">
        <hr
          v-if="showDetails"
          class="border-border-color"
        />
      </Transition>
    </div>
    <div class="flex flex-col gap-y-3 md:flex-row md:flex-wrap">
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.lease-interest')"
        :amount="{
          amount: annualInterestRate.toString(),
          type: CURRENCY_VIEW_TYPES.TOKEN,
          denom: '%',
          maxDecimals: 0,
          minimalDenom: '',
          decimals: 2,
          fontSize: 16,
          fontSizeSmall: 16,
          class: { 'line-through': isFreeLease },
          additional: isFreeLease
            ? {
                text: '0%',
                class: 'text-typography-success'
              }
            : undefined
        }"
      />
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.price-per-symbol', { symbol: asset.shortName })"
        :amount="{
          amount: oracle.prices[loanCurrency].amount,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol,
          decimals: 3,
          fontSize: 16,
          fontSizeSmall: 16
        }"
      />
      <BigNumber
        class="md:flex-[50%]"
        :label="$t('message.partial-liquidation')"
        :amount="{
          amount: percentLique,
          type: CURRENCY_VIEW_TYPES.TOKEN,
          denom: `% ($${calculateLique})`,
          maxDecimals: 0,
          minimalDenom: '',
          decimals: 0,
          fontSize: 16,
          fontSizeSmall: 16
        }"
      />
    </div>
  </div>
</template>

<script lang="ts" setup>
import type { LeaseApply } from "@nolus/nolusjs/build/contracts";
import BigNumber from "@/common/components/BigNumber.vue";
import PositionPreviewChart from "./PositionPreviewChart.vue";
import { Button, SvgIcon } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { MONTHS, NATIVE_CURRENCY, PERCENT, ProtocolsConfig } from "@/config/global";
import { useOracleStore } from "@/common/stores/oracle";
import { useApplicationStore } from "@/common/stores/application";
import { AppUtils, AssetUtils, LeaseUtils } from "@/common/utils";
import { Dec } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { SkipRouter } from "@/common/utils/SkipRoute";

const timeOut = 200;
let time: NodeJS.Timeout;

const props = defineProps<{
  lease: LeaseApply | null | undefined;
  loanCurrency: string;
  downpaymenAmount: string;
  downpaymentCurrency: string;
}>();
const oracle = useOracleStore();
const app = useApplicationStore();
const showDetails = ref(false);
const swapFee = ref(0);
const swapStableFee = ref(0);
const freeInterest = ref<string[]>([]);

onMounted(async () => {
  freeInterest.value = await AppUtils.getFreeInterest();
});

onUnmounted(() => {
  clearTimeout(time!);
});

onUnmounted(() => {
  clearTimeout(time!);
});

watch(
  () => [props.lease],
  (value) => {
    setSwapFee();
  }
);

const sizeAmount = computed(() => {
  if (!props.lease?.total?.amount) {
    return "0";
  }
  const decimals = new Dec(10 ** lpn.value.decimal_digits);
  const fee = new Dec(swapStableFee.value, lpn.value.decimal_digits).mul(decimals);
  const total = new Dec(props.lease?.total.amount ?? "0").sub(fee);
  return total.truncate().toString();
});

const isFreeLease = computed(() => {
  if (freeInterest.value.includes(props.loanCurrency)) {
    return true;
  }
  return false;
});

const annualInterestRate = computed(() => {
  return (
    (((props.lease?.annual_interest_rate ?? 0) + (props.lease?.annual_interest_rate_margin ?? 0)) / MONTHS) * PERCENT
  );
});

const totalLoan = computed(() => {
  if (!props.lease?.total?.amount) {
    return "0";
  }
  const price = new Dec(oracle.prices?.[asset.value.key!]?.amount ?? 0);
  const v = props.lease?.total?.amount ?? "0";
  const amount = new Dec(v).quo(price).sub(swapFeeAmount.value);
  return amount.toString(assetLoan.value.decimal_digits);
});

const assetLoan = computed(() => {
  const [t, p] = asset.value.key.split("@");
  const currency = app.currenciesData![`${ProtocolsConfig[p].stable}@${p}`];
  return currency;
});

const asset = computed(() => {
  const currency = app.currenciesData![props.loanCurrency];
  return currency;
});

const lpn = computed(() => {
  const [t, p] = loanAsset.value.key.split("@");
  const lpn = AssetUtils.getLpnByProtocol(p);
  return lpn;
});

const downPaymentAsset = computed(() => {
  const currency = app.currenciesData![props.downpaymentCurrency];
  return currency;
});

const loanAsset = computed(() => {
  const currency = app.currenciesData![props.loanCurrency];
  return currency;
});

const downPaymentAmount = computed(() => {
  const price = new Dec(oracle.prices?.[downPaymentAsset.value.key!]?.amount ?? 0);
  const decimals = new Dec(10 ** downPaymentAsset.value.decimal_digits);
  const v = downPaymentStable.value;
  const amount = v.quo(price).mul(decimals);
  return amount.truncate().toString();
});

const downPaymentStable = computed(() => {
  const price = new Dec(oracle.prices?.[downPaymentAsset.value.key!]?.amount ?? 0);
  const v = props.downpaymenAmount.length == 0 ? "0" : props.downpaymenAmount;
  const stable = price.mul(new Dec(v));
  return stable;
});

const borrowAmount = computed(() => {
  const price = new Dec(oracle.prices?.[asset.value.key!]?.amount ?? 0);
  const decimals = new Dec(10 ** lpn.value.decimal_digits);
  const v = borrowStable.value;
  const amount = v.quo(price).mul(decimals);
  return amount.truncate().toString();
});

const swapFeeAmount = computed(() => {
  const price = new Dec(oracle.prices?.[asset.value.key!]?.amount ?? 0);
  const decimals = new Dec(10 ** lpn.value.decimal_digits);
  const v = new Dec(swapStableFee.value);
  const amount = v.quo(price).mul(decimals);
  return amount;
});

const borrowStable = computed(() => {
  const price = new Dec(oracle.prices?.[lpn.value.key!]?.amount ?? 0);
  const v = props.lease?.borrow?.amount ?? "0";
  const stable = price.mul(new Dec(v, lpn.value.decimal_digits));
  return stable;
});

const calculateLique = computed(() => {
  const d = getLquidation();
  if (d.isZero()) {
    return `${d.toString(2)}`;
  }
  return `${d.toString(4)}`;
});

const percentLique = computed(() => {
  const a = asset.value;
  const [_, protocol] = a.key.split("@");
  const lpn = AssetUtils.getLpnByProtocol(protocol);

  const price = new Dec(oracle.prices[lpn.key]?.amount ?? "0", a.decimal_digits);
  const lprice = getLquidation();

  if (lprice.isZero() || price.isZero()) {
    return `0`;
  }

  const p = price.sub(lprice).quo(price);

  return `${p.abs().mul(new Dec(100)).toString(0)}`;
});

function getLquidation() {
  const lease = props.lease;
  if (lease) {
    const unitAssetInfo = AssetUtils.getCurrencyByTicker(lease.borrow.ticker!);
    const stableAssetInfo = AssetUtils.getCurrencyByTicker(lease.total.ticker!);

    const unitAsset = new Dec(getBorrowedAmount(), Number(unitAssetInfo!.decimal_digits));

    const stableAsset = new Dec(getTotalAmount(), Number(stableAssetInfo!.decimal_digits));
    return LeaseUtils.calculateLiquidationShort(stableAsset, unitAsset);
  }

  return new Dec(0);
}

function getBorrowedAmount() {
  const borrow = props.lease?.borrow;

  if (borrow) {
    const amount = new Dec(borrow?.amount ?? 0).truncate();
    return amount;
  }

  return new Dec(0).truncate();
}

function getTotalAmount() {
  const total = props.lease?.total;
  return new Dec(total?.amount ?? 0).truncate();
}

const setSwapFee = async () => {
  clearTimeout(time!);
  if (props.lease) {
    time = setTimeout(async () => {
      const currency = downPaymentAsset.value;
      const [_, p] = asset.value.key.split("@");

      const microAmount = CurrencyUtils.convertDenomToMinimalDenom(
        props.downpaymenAmount,
        currency.ibcData,
        currency.decimal_digits
      ).amount.toString();

      const lpn = AssetUtils.getLpnByProtocol(p);
      let amountIn = 0;
      let amountOut = 0;
      const [r, r2] = await Promise.all([
        SkipRouter.getRoute(currency.ibcData, asset.value.ibcData, microAmount).then((data) => {
          amountIn += Number(data.usd_amount_in ?? 0);
          amountOut += Number(data.usd_amount_out ?? 0);

          return Number(data?.swap_price_impact_percent ?? 0);
        }),
        SkipRouter.getRoute(lpn.ibcData, asset.value.ibcData, props.lease!.borrow.amount).then((data) => {
          amountIn += Number(data.usd_amount_in ?? 0);
          amountOut += Number(data.usd_amount_out ?? 0);

          return Number(data?.swap_price_impact_percent ?? 0);
        })
      ]);
      const out_a = Math.max(amountOut, amountIn);
      const in_a = Math.min(amountOut, amountIn);

      const diff = out_a - in_a;
      swapStableFee.value = diff;
      let fee = 0;

      if (in_a > 0) {
        fee = diff / in_a;
      }
      swapFee.value = fee;
    }, timeOut);
  }
};
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
