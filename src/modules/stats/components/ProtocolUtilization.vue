<template>
  <Widget>
    <WidgetHeader :label="$t('message.utilization-level')" />
    <BigNumber
      :label="$t('message.supplied-funds')"
      :amount="{
        amount: suppliedFundsValue,
        type: CURRENCY_VIEW_TYPES.CURRENCY,
        denom: NATIVE_CURRENCY.symbol,
        decimals: 0,
        fontSize: isMobile() ? 24 : 32
      }"
    />
    <Table
      :columns="columns"
      table-classes="min-w-[420px]"
    >
      <template v-slot:body>
        <TableRow
          v-for="(row, index) in tableRows"
          :key="index"
          :items="row.items"
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
import { getProtocols } from "@/common/utils/ConfigService";

import { computed, h } from "vue";
import { useEarnStore } from "@/common/stores/earn";
import { useI18n } from "vue-i18n";
import { NATIVE_CURRENCY } from "@/config/global";
import { CURRENCY_VIEW_TYPES } from "@/common/types";

import type { UtilizationProps } from "../types";

const i18n = useI18n();

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.asset"), variant: "left" },
  { label: "", class: "hidden md:flex" },
  { label: i18n.t("message.current-utilization"), class: "hidden md:flex" },
  {
    label: i18n.t("message.deposit-suspension"),
    tooltip: { position: "top", content: i18n.t("message.deposit-suspension-tooltip") },
    class: "whitespace-pre max-w-[200px]"
  },
  {
    label: i18n.t("message.yield"),
    tooltip: { position: "top", content: i18n.t("message.yield-tooltip") }
  }
]);
const tableRows = computed<TableRowItemProps[]>(() => {
  return [
    {
      items: [
        {
          value: "USDC",
          subValue: i18n.t("message.utilization_sub_osmosis_usdc"),
          image: iconOsmosis.value,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilization, {
              value: utilizationLevelOsmosis.value,
              icon: iconOsmosis.value,
              deposit: depositOsmosis.value
            }),
          class: "hidden md:flex w-full min-w-[200]"
        },
        { value: `${utilizationLevelOsmosis.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositOsmosis.value}%`, class: "max-w-[200px]" },
        {
          value: `${earnStore.getProtocolApr(getProtocols().osmosis_noble).toFixed(2)}%`,
          class: "text-typography-success"
        }
      ]
    },
    {
      items: [
        {
          value: "USDC",
          subValue: i18n.t("message.utilization_sub_neutron_usdc"),
          image: iconNeutron.value,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilization, {
              value: utilizationLevelNeutron.value,
              icon: iconNeutron.value,
              deposit: depositNeutron.value
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelNeutron.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositNeutron.value}%`, class: "max-w-[200px]" },
        {
          value: `${earnStore.getProtocolApr(getProtocols().neutron_noble).toFixed(2)}%`,
          class: "text-typography-success"
        }
      ]
    },
    {
      items: [
        {
          value: "SOL",
          subValue: i18n.t("message.utilization_sub_osmosis_sol"),
          image: iconAllSol.value,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilization, {
              value: utilizationLevelOsmosisAllSol.value,
              icon: iconAllSol.value,
              deposit: depositAllSol.value
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosisAllSol.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositAllSol.value}%`, class: "max-w-[200px]" },
        {
          value: `${earnStore.getProtocolApr(getProtocols().osmosis_osmosis_all_sol).toFixed(2)}%`,
          class: "text-typography-success"
        }
      ]
    },
    {
      items: [
        {
          value: "BTC",
          subValue: i18n.t("message.utilization_sub_osmosis_btc"),
          image: iconAllBtc.value,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilization, {
              value: utilizationLevelOsmosisAllBtc.value,
              icon: iconAllBtc.value,
              deposit: depositAllBtc.value
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosisAllBtc.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositAllBtc.value}%`, class: "max-w-[200px]" },
        {
          value: `${earnStore.getProtocolApr(getProtocols().osmosis_osmosis_all_btc).toFixed(2)}%`,
          class: "text-typography-success"
        }
      ]
    },
    {
      items: [
        {
          value: "AKT",
          subValue: i18n.t("message.utilization_sub_osmosis_akt"),
          image: iconAkt.value,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilization, {
              value: utilizationLevelOsmosisAkt.value,
              icon: iconAkt.value,
              deposit: depositAkt.value
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosisAkt.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositAkt.value}%`, class: "max-w-[200px]" },
        {
          value: `${earnStore.getProtocolApr(getProtocols().osmosis_osmosis_akt).toFixed(2)}%`,
          class: "text-typography-success"
        }
      ]
    },
    {
      items: [
        {
          value: "ATOM",
          subValue: i18n.t("message.utilization_sub_osmosis_atom"),
          image: iconAtom.value,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilization, {
              value: utilizationLevelOsmosisAtom.value,
              icon: iconAtom.value,
              deposit: depositAtom.value
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosisAtom.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositAtom.value}%`, class: "max-w-[200px]" },
        {
          value: `${earnStore.getProtocolApr(getProtocols().osmosis_osmosis_atom).toFixed(2)}%`,
          class: "text-typography-success"
        }
      ]
    }
  ] as TableRowItemProps[];
});

const earnStore = useEarnStore();

// Compute supplied funds from ETL supplied-funds endpoint
const suppliedFundsValue = computed(() => {
  return earnStore.suppliedFunds?.amount ?? "0";
});

// Helper to get pool data by protocol
function getPoolData(protocolKey: string) {
  const pool = earnStore.getPool(protocolKey);
  const etlPool = earnStore.getEtlPool(protocolKey);

  // Utilization from earn pool (already 0-100 range from backend)
  const utilization = pool ? pool.utilization.toFixed(2) : "0";

  // Deposit suspension threshold from ETL pools endpoint
  const depositSuspension = etlPool?.deposit_suspension ?? "90";

  // Icon from pool (comes from network-config.json via backend)
  const icon = pool?.icon ?? "";

  return { utilization, depositSuspension, icon };
}

// Computed values for each protocol
const utilizationLevelNeutron = computed(() => getPoolData(getProtocols().neutron_noble).utilization);
const depositNeutron = computed(() => getPoolData(getProtocols().neutron_noble).depositSuspension);
const iconNeutron = computed(() => getPoolData(getProtocols().neutron_noble).icon);

const utilizationLevelOsmosis = computed(() => getPoolData(getProtocols().osmosis_noble).utilization);
const depositOsmosis = computed(() => getPoolData(getProtocols().osmosis_noble).depositSuspension);
const iconOsmosis = computed(() => getPoolData(getProtocols().osmosis_noble).icon);

const utilizationLevelOsmosisAllBtc = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_btc).utilization);
const depositAllBtc = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_btc).depositSuspension);
const iconAllBtc = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_btc).icon);

const utilizationLevelOsmosisAllSol = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_sol).utilization);
const depositAllSol = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_sol).depositSuspension);
const iconAllSol = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_sol).icon);

const utilizationLevelOsmosisAkt = computed(() => getPoolData(getProtocols().osmosis_osmosis_akt).utilization);
const depositAkt = computed(() => getPoolData(getProtocols().osmosis_osmosis_akt).depositSuspension);
const iconAkt = computed(() => getPoolData(getProtocols().osmosis_osmosis_akt).icon);

const utilizationLevelOsmosisAtom = computed(() => getPoolData(getProtocols().osmosis_osmosis_atom).utilization);
const depositAtom = computed(() => getPoolData(getProtocols().osmosis_osmosis_atom).depositSuspension);
const iconAtom = computed(() => getPoolData(getProtocols().osmosis_osmosis_atom).icon);
</script>
