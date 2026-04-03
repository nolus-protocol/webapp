<template>
  <Widget>
    <WidgetHeader :label="$t('message.utilization-level')" />
    <BigNumber
      :label="$t('message.supplied-funds')"
      :amount="{
        value: suppliedFundsValue,
        denom: NATIVE_CURRENCY.symbol,
        decimals: 0,
        compact: true,
        fontSize: 24
      }"
    />
    <Table
      :columns="columns"
      :table-classes="mobile ? '' : 'min-w-[420px]'"
      :scrollable="!mobile"
    >
      <template v-slot:body>
        <TableRow
          v-for="(row, index) in tableRows"
          :key="index"
          :items="row.items"
          :scrollable="!mobile"
        />
      </template>
    </Table>
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import ChartUtilization from "./ChartUtilization.vue";
import BigNumber from "@/common/components/BigNumber.vue";

import { Table, type TableColumnProps, TableRow, type TableRowItemProps, Widget } from "web-components";
import { isMobile } from "@/common/utils";

import { computed, h } from "vue";
import { useEarnStore } from "@/common/stores/earn";
import { useConfigStore } from "@/common/stores/config";
import { useI18n } from "vue-i18n";
import { NATIVE_CURRENCY } from "@/config/global";
import { formatNumber, formatPercent } from "@/common/utils/NumberFormatUtils";
import type { UtilizationProps } from "../types";

const mobile = isMobile();
const i18n = useI18n();

const columns = computed<TableColumnProps[]>(() =>
  mobile
    ? [
        { label: i18n.t("message.asset"), variant: "left" },
        {
          label: i18n.t("message.deposit-suspension"),
          tooltip: { position: "top", content: i18n.t("message.deposit-suspension-tooltip") }
        },
        {
          label: i18n.t("message.yield"),
          tooltip: { position: "top", content: i18n.t("message.yield-tooltip") }
        }
      ]
    : [
        { label: i18n.t("message.asset"), variant: "left" },
        { label: "" },
        { label: i18n.t("message.current-utilization") },
        {
          label: i18n.t("message.deposit-suspension"),
          tooltip: { position: "top", content: i18n.t("message.deposit-suspension-tooltip") },
          class: "whitespace-pre max-w-[200px]"
        },
        {
          label: i18n.t("message.yield"),
          tooltip: { position: "top", content: i18n.t("message.yield-tooltip") }
        }
      ]
);
function buildRow(
  ticker: string,
  subValue: string,
  icon: string,
  utilization: string,
  deposit: string,
  protocolKey: string
) {
  const apr = formatPercent(earnStore.getProtocolApr(protocolKey));

  if (mobile) {
    return {
      items: [
        { value: ticker, subValue, image: icon, variant: "left", class: "break-all" },
        { value: `${deposit}%` },
        { value: apr, class: "text-typography-success" }
      ]
    };
  }

  return {
    items: [
      { value: ticker, subValue, image: icon, variant: "left", class: "break-all" },
      {
        component: () => h<UtilizationProps>(ChartUtilization, { value: utilization, icon, deposit }),
        class: "w-full min-w-[200]"
      },
      { value: `${utilization}%`, class: "font-semibold" },
      { value: `${deposit}%`, class: "max-w-[200px]" },
      { value: apr, class: "text-typography-success" }
    ]
  };
}

const earnStore = useEarnStore();
const configStore = useConfigStore();

// Compute supplied funds from ETL supplied-funds endpoint
const suppliedFundsValue = computed(() => {
  return earnStore.suppliedFunds?.amount ?? "0";
});

const tableRows = computed<TableRowItemProps[]>(() => {
  return [...earnStore.pools]
    .sort((a, b) => b.utilization - a.utilization)
    .map((pool) => {
      const currency = configStore.getCurrencyByKey(`${pool.currency}@${pool.protocol}`);
      const ticker = currency?.shortName ?? pool.currency;
      const subValue = currency?.name ?? pool.currency;
      const icon = pool.icon ?? "";
      const utilization = formatNumber(pool.utilization, 2);
      const etlPool = earnStore.getEtlPool(pool.protocol);
      const deposit = etlPool?.deposit_suspension ?? "90";

      return buildRow(ticker, subValue, icon, utilization, deposit, pool.protocol);
    }) as TableRowItemProps[];
});
</script>
