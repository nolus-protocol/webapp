<template>
  <div class="flex flex-col gap-3 px-6 py-4 text-typography-default">
    <span class="text-16 font-semibold">{{ $t("message.preview") }}</span>
    <template v-if="sliderValue == 0">
      <div class="flex items-start gap-2 text-14">
        <SvgIcon
          name="list-sparkle"
          class="mt-0.5 shrink-0 fill-icon-secondary"
        />
        {{ $t("message.preview-input") }}
      </div>
    </template>
    <template v-if="sliderValue > 0 && sliderValue < 100">
      <div class="flex items-start gap-2 text-14">
        <SvgIcon
          name="check-solid"
          class="mt-0.5 shrink-0 fill-icon-success"
        />
        <p :innerHTML="$t('message.debt-pay-off', { data: detbPartial.payment })"></p>
      </div>
      <div class="flex items-start gap-2 text-14">
        <SvgIcon
          name="check-solid"
          class="mt-0.5 shrink-0 fill-icon-success"
        />
        <p :innerHTML="$t('message.repay-liquidation-price', { data: liquidation })"></p>
      </div>
      <div class="flex items-start gap-2 text-14">
        <SvgIcon
          name="info"
          class="mt-0.5 shrink-0 fill-icon-secondary"
        />
        {{ $t("message.outstanding-debt-rest") }}
        {{ detbPartial.rest }}
      </div>
    </template>
    <template v-if="sliderValue >= 100">
      <div class="flex items-start gap-2 text-14">
        <SvgIcon
          name="check-solid"
          class="mt-0.5 shrink-0 fill-icon-success"
        />
        {{ $t("message.debt-paid") }}
        <strong>{{ debtData }}</strong>
      </div>
    </template>
  </div>
</template>

<script lang="ts" setup>
import { SvgIcon } from "web-components";

interface DebtPartial {
  payment: string;
  rest: string;
}

defineProps<{
  sliderValue: number;
  detbPartial: DebtPartial;
  liquidation: string;
  debtData: string;
}>();
</script>
