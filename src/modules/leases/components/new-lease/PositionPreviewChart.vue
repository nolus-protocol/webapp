<template>
  <div
    v-html="chartHTML"
    class="flex items-center justify-center"
  />
</template>

<script lang="ts" setup>
import type { ExternalCurrency } from "@/common/types";
import { AssetUtils } from "@/common/utils";
import { NATIVE_CURRENCY } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { plot, barY, axisX, text, ruleY, rect } from "@observablehq/plot";
import { computed, ref, watch } from "vue";
import { useI18n } from "vue-i18n";

const i18n = useI18n();

const props = defineProps<{
  downPaymentStable: Dec;
  downPaymentAmount: string;
  downPaymentAsset: ExternalCurrency;

  borrowStable: Dec;
  borrowAmount: string;
  borrowAsset: ExternalCurrency;
}>();

const responses = ref<{ name: string; value: number; ticker: string; price: string }[]>([
  {
    name: i18n.t("message.borrowed-taxes"),
    value: Number(`${props.borrowStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`),
    ticker: `${new Dec(props.borrowAmount, props.borrowAsset.decimal_digits).toString(props.borrowAsset.decimal_digits)} ${props.borrowAsset.shortName}`,
    price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.borrowStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
  },
  {
    name: i18n.t("message.downpayment"),
    value: Number(`${props.downPaymentStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`),
    ticker: `${new Dec(props.downPaymentAmount, props.downPaymentAsset.decimal_digits).toString(props.downPaymentAsset.decimal_digits)} ${props.downPaymentAsset.shortName}`,
    price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.downPaymentStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
  }
]);

watch(
  () => [
    props.downPaymentStable,
    props.downPaymentAmount,
    props.downPaymentAsset,
    props.borrowStable,
    props.borrowAmount,
    props.borrowAsset
  ],
  () => {
    setData();
  }
);

function setData() {
  responses.value = [
    {
      name: i18n.t("message.borrowed-taxes"),
      value: Number(`${props.borrowStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`),
      ticker: `${new Dec(props.borrowAmount, props.borrowAsset.decimal_digits).toString(props.borrowAsset.decimal_digits)} ${props.borrowAsset.shortName}`,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.borrowStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    },
    {
      name: i18n.t("message.downpayment"),
      value: Number(`${props.downPaymentStable.toString(NATIVE_CURRENCY.minimumFractionDigits)}`),
      ticker: `${new Dec(props.downPaymentAmount, props.downPaymentAsset.decimal_digits).toString(props.downPaymentAsset.decimal_digits)} ${props.downPaymentAsset.shortName}`,
      price: `${NATIVE_CURRENCY.symbol}${AssetUtils.formatNumber(props.downPaymentStable.toString(NATIVE_CURRENCY.maximumFractionDigits), NATIVE_CURRENCY.maximumFractionDigits)}`
    }
  ];
}

const chartHTML = computed(
  () =>
    plot({
      className: "position-preview-chart",
      y: { label: null, ticks: 3, tickFormat: (d) => `$${d}`, tickSize: 0, line: true },
      marks: [
        axisX({ label: null, marginBottom: 40, tickSize: 0, fontSize: 16 }),
        barY([responses.value[1]], {
          x: "name",
          y: "value",
          fill: "#C1CAD7",
          rx: 6,
          insetBottom: -3,
          clip: "frame"
        }),
        barY([responses.value[0]], { x: "name", y: "value", fill: "#19A96C", rx: 6, insetBottom: -3, clip: "frame" }),
        text(responses.value, {
          x: "name",
          y: "value",
          dy: 30,
          fontSize: 14,
          text(d) {
            return `${d.price} \n ${d.ticker}`;
          },
          title: (d) => `class-${d.ticker.toLowerCase()}`
        }),
        ruleY([0])
      ]
    }).outerHTML
);
</script>

<style lang="scss">
.position-preview-chart {
  @apply text-typography-default;
}
</style>
