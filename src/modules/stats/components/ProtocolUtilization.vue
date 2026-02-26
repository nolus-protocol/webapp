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
import { getProtocols } from "@/common/utils/ConfigService";

import { computed, h } from "vue";
import { useEarnStore } from "@/common/stores/earn";
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

const tableRows = computed<TableRowItemProps[]>(() => {
  const p = getProtocols();
  return [
    buildRow(
      "USDC",
      i18n.t("message.utilization_sub_osmosis_usdc"),
      iconOsmosis.value,
      utilizationLevelOsmosis.value,
      depositOsmosis.value,
      p.osmosis_noble
    ),
    buildRow(
      "USDC",
      i18n.t("message.utilization_sub_neutron_usdc"),
      iconNeutron.value,
      utilizationLevelNeutron.value,
      depositNeutron.value,
      p.neutron_noble
    ),
    buildRow(
      "SOL",
      i18n.t("message.utilization_sub_osmosis_sol"),
      iconAllSol.value,
      utilizationLevelOsmosisAllSol.value,
      depositAllSol.value,
      p.osmosis_osmosis_all_sol
    ),
    buildRow(
      "BTC",
      i18n.t("message.utilization_sub_osmosis_btc"),
      iconAllBtc.value,
      utilizationLevelOsmosisAllBtc.value,
      depositAllBtc.value,
      p.osmosis_osmosis_all_btc
    ),
    buildRow(
      "AKT",
      i18n.t("message.utilization_sub_osmosis_akt"),
      iconAkt.value,
      utilizationLevelOsmosisAkt.value,
      depositAkt.value,
      p.osmosis_osmosis_akt
    ),
    buildRow(
      "ATOM",
      i18n.t("message.utilization_sub_osmosis_atom"),
      iconAtom.value,
      utilizationLevelOsmosisAtom.value,
      depositAtom.value,
      p.osmosis_osmosis_atom
    )
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
  const utilization = pool ? formatNumber(pool.utilization, 2) : "0";

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
