<template>
  <Widget>
    <EarnAssetsTable
      :items="items"
      :onSearch="onSearch"
    >
      <BigNumber
        :label="$t('message.total-value')"
        :amount="{
          amount: stableAmount,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
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

defineProps<{
  items: TableRowItemProps[];
  stableAmount: string;
  onSearch: Function;
}>();
</script>
