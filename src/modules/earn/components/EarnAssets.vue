<template>
  <Widget>
    <EarnAssetsTable
      :items="items"
      :onSearch="onSearch"
    >
      <div class="my-2 flex flex-row flex-wrap gap-4 md:gap-8">
        <BigNumber
          :label="$t('message.total-value')"
          :labelTooltip="{
            position: 'top',
            content: $t('message.total-value-tooltip')
          }"
          :amount="{
            value: stableAmount,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 24,
            animatedReveal: true,
            compact: mobile
          }"
        />

        <BigNumber
          :label="$t('message.earn-yield')"
          :labelTooltip="{
            position: 'top',
            content: $t('message.earn-yield-tooltip')
          }"
          :amount="{
            value: earningsAmount,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 24,
            animatedReveal: true,
            compact: mobile
          }"
        />

        <BigNumber
          class="hidden md:block"
          :label="$t('message.project-anual-return')"
          :labelTooltip="{
            position: 'top',
            content: $t('message.project-anual-return-tooltip')
          }"
          :amount="{
            value: anualYield,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 24,
            animatedReveal: true
          }"
        />
      </div>
      <div
        class="hidden items-center justify-center rounded bg-neutral-bg-3 py-2 text-14 text-typography-secondary md:flex"
      >
        <SvgIcon
          name="info"
          class="mr-2 fill-icon-secondary"
        />
        {{ $t("message.supplied-auto-compound") }}
      </div>
    </EarnAssetsTable>
  </Widget>
</template>

<script lang="ts" setup>
import { SvgIcon, type TableRowItemProps, Widget } from "web-components";
import EarnAssetsTable from "@/modules/earn/components/EarnAssetsTable.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { isMobile } from "@/common/utils";

const mobile = isMobile();

defineProps<{
  items: TableRowItemProps[];
  stableAmount: string;
  anualYield: string;
  earningsAmount: string;
  onSearch: (query: string) => void;
}>();
</script>
