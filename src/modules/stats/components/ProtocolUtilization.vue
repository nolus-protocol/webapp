<template>
  <Widget>
    <WidgetHeader :label="$t('message.utilization-level')" />
    <BigNumber
      :label="$t('message.supplied-funds')"
      :amount="{
        amount: suppliedFunds,
        type: CURRENCY_VIEW_TYPES.CURRENCY,
        denom: NATIVE_CURRENCY.symbol,
        decimals: 0,
        fontSize: isMobile() ? 20 : 32
      }"
    />
    <Table
      :columns="columns"
      table-classes="min-w-[420px]"
    >
      <template v-slot:body>
        <TableRow
          v-for="(row, index) in assets"
          :key="index"
          :items="row.items"
        />
      </template>
    </Table>
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import ChartUtilizaiton from "./ChartUtilizaiton.vue";
import BigNumber from "@/common/components/BigNumber.vue";

import { Table, type TableColumnProps, TableRow, type TableRowItemProps, Widget } from "web-components";
import { isMobile } from "@/common/utils";
import { getProtocols } from "@/common/utils/ConfigService";

import { computed, h } from "vue";
import { useEarnStore } from "@/common/stores/earn";
import { useI18n } from "vue-i18n";
import { NATIVE_CURRENCY } from "@/config/global";
import { CURRENCY_VIEW_TYPES } from "@/common/types";

// Import icons from local assets
import osmoUsdc from "@/assets/icons/osmosis-usdc.svg";
import neutronUsdc from "@/assets/icons/neutron-usdc.svg";
import osmosisSol from "@/assets/icons/osmosis-allsol.svg";
import osmosisBtc from "@/assets/icons/osmosis-allbtc.svg";
import osmosisStAtom from "@/assets/icons/osmosis-statom.svg";
import osmosisAkt from "@/assets/icons/osmosis-akt.svg";
import osmosisAtom from "@/assets/icons/osmosis-atom.svg";

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
const assets = computed<TableRowItemProps[]>(() => {
  return [
    {
      items: [
        {
          value: "USDC",
          subValue: i18n.t("message.utilization_sub_osmosis_usdc"),
          image: osmoUsdc,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosis.value,
              icon: osmoUsdc,
              deposit: depositOsmosis.value
            }),
          class: "hidden md:flex w-full min-w-[200]"
        },
        { value: `${utilizationLevelOsmosis.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositNeutron.value}%`, class: "max-w-[200px]" },
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
          image: neutronUsdc,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelNeutron.value,
              icon: neutronUsdc,
              deposit: depositNeutron.value
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelNeutron.value}%`, class: "hidden md:flex font-semibold" },
        { value: `${depositOsmosis.value}%`, class: "max-w-[200px]" },
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
          image: osmosisSol,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosisAllSol.value,
              icon: osmosisSol,
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
          image: osmosisBtc,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosisAllBtc.value,
              icon: osmosisBtc,
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
    // {
    //   items: [
    //     {
    //       value: "stAtom",
    //       subValue: i18n.t("message.utilization_sub_osmosis_statom"),
    // image: osmosisStAtom,
    //       variant: "left"
    //     },
    //     {
    //       component: () =>
    //         h<UtilizationProps>(ChartUtilizaiton, {
    //           value: utilizationLevelOsmosis.value,
    //           icon: osmosisStAtom,
    //           deposit: depositStAtom.value
    //         }),
    //       class: "hidden md:flex min-w-[200]"
    //     },
    //     { value: `${utilizationLevelOsmosis.value}%`, class: "hidden md:flex font-semibold" },
    //     { value: `${depositStAtom.value}%` },
    //     {
    //       value: `${earnStore.getProtocolApr(getProtocols().osmosis_osmosis_st_atom).toFixed(2)}%`,
    //       class: "text-typography-success"
    //     }
    //   ]
    // },
    {
      items: [
        {
          value: "AKT",
          subValue: i18n.t("message.utilization_sub_osmosis_akt"),
          image: osmosisAkt,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosisAkt.value,
              icon: osmosisAkt,
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
          image: osmosisAtom,
          variant: "left",
          class: "break-all"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosisAtom.value,
              icon: osmosisAtom,
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

// Compute supplied funds from earn store stats
const suppliedFunds = computed(() => {
  return earnStore.stats?.total_supplied ?? "0";
});

// Helper to get pool data by protocol
function getPoolData(protocolKey: string) {
  const pool = earnStore.getPool(protocolKey);
  if (!pool) {
    return { utilization: "0", depositSuspension: "0" };
  }
  // Utilization is a decimal (0.0 - 1.0), convert to percentage
  const utilization = (parseFloat(pool.utilization) * 100).toFixed(2);
  // Deposit suspension threshold - if utilization >= this, deposits are paused
  // This comes from the pool config, default to utilization-based check
  const depositSuspension = parseFloat(pool.utilization) >= 1 ? "100" : "90";
  return { utilization, depositSuspension };
}

// Computed values for each protocol
const utilizationLevelNeutron = computed(() => getPoolData(getProtocols().neutron_noble).utilization);
const depositNeutron = computed(() => getPoolData(getProtocols().neutron_noble).depositSuspension);

const utilizationLevelOsmosis = computed(() => getPoolData(getProtocols().osmosis_noble).utilization);
const depositOsmosis = computed(() => getPoolData(getProtocols().osmosis_noble).depositSuspension);

const utilizationLevelOsmosisAllBtc = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_btc).utilization);
const depositAllBtc = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_btc).depositSuspension);

const utilizationLevelOsmosisAllSol = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_sol).utilization);
const depositAllSol = computed(() => getPoolData(getProtocols().osmosis_osmosis_all_sol).depositSuspension);

const utilizationLevelOsmosisAkt = computed(() => getPoolData(getProtocols().osmosis_osmosis_akt).utilization);
const depositAkt = computed(() => getPoolData(getProtocols().osmosis_osmosis_akt).depositSuspension);

const utilizationLevelOsmosisAtom = computed(() => getPoolData(getProtocols().osmosis_osmosis_atom).utilization);
const depositAtom = computed(() => getPoolData(getProtocols().osmosis_osmosis_atom).depositSuspension);
</script>
