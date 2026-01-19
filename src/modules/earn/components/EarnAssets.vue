<template>
  <Widget>
    <EarnAssetsTable
      :items="items"
      :onSearch="onSearch"
    >
      <div class="my-2 flex flex-col gap-8 md:flex-row">
        <BigNumber
          :label="$t('message.total-value')"
          :labelTooltip="{
            position: 'top',
            content: $t('message.total-value-tooltip')
          }"
          :amount="{
            amount: stableAmount,
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: isMobile() ? 20 : 32
          }"
        />

        <BigNumber
          :label="$t('message.earn-yield')"
          :labelTooltip="{
            position: 'top',
            content: $t('message.earn-yield-tooltip')
          }"
          :amount="{
            amount: earningsAmount,
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 20
          }"
        />

        <BigNumber
          :label="$t('message.project-anual-return')"
          :labelTooltip="{
            position: 'top',
            content: $t('message.project-anual-return-tooltip')
          }"
          :amount="{
            amount: anualYield,
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            denom: NATIVE_CURRENCY.symbol,
            fontSize: 20
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
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import BigNumber from "@/common/components/BigNumber.vue";
import { NATIVE_CURRENCY } from "@/config/global";
import { isMobile } from "@/common/utils";

defineProps<{
  items: TableRowItemProps[];
  stableAmount: string;
  anualYield: string;
  earningsAmount: string;
  onSearch: Function;
}>();
</script>
