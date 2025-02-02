<template>
  <Widget>
    <WidgetHeader :label="$t('message.utilization-level')" />
    <Table :columns="columns">
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

import { Table, type TableColumnProps, TableRow, type TableRowItemProps, Widget } from "web-components";
import { AppUtils, EtlApi, Logger } from "@/common/utils";

import { computed, h, onMounted, ref } from "vue";
import { useApplicationStore } from "@/common/stores/application";
import { useI18n } from "vue-i18n";

import osmoUsdc from "@/assets/icons/osmosis-usdc.svg?url";
import neutronUsdc from "@/assets/icons/neutron-usdc.svg?url";
import osmosisSol from "@/assets/icons/osmosis-allsol.svg?url";
import osmosisBtc from "@/assets/icons/osmosis-allbtc.svg?url";
import osmosisStAtom from "@/assets/icons/osmosis-statom.svg?url";
import osmosisAkt from "@/assets/icons/osmosis-akt.svg?url";
import type { UtilizationProps } from "../types";

const i18n = useI18n();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.asset"), variant: "left" },
  { label: "" },
  { label: i18n.t("message.current-utilization"), class: "hidden md:flex" },
  {
    label: i18n.t("message.deposit-suspension"),
    tooltip: { position: "top", content: i18n.t("message.deposit-suspension-tooltip") }
  },
  {
    label: i18n.t("message.yield"),
    tooltip: { position: "top", content: i18n.t("message.yield-tooltip") },
    class: "hidden md:flex"
  }
];
const assets = computed<TableRowItemProps[]>(() => {
  return [
    {
      items: [
        {
          value: "USDC",
          subValue: "USDC",
          image: osmoUsdc,
          variant: "left"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosis.value,
              icon: osmoUsdc,
              depositCap: "65"
            }),
          class: "hidden md:flex w-full min-w-[200]"
        },
        { value: `${utilizationLevelOsmosis.value}%`, class: "hidden md:flex font-semibold" },
        { value: "65%" },
        { value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_noble]) ?? 0).toFixed(2)}%` }
      ]
    },
    {
      items: [
        {
          value: "USDC",
          subValue: "USDC",
          image: neutronUsdc,
          variant: "left"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelNeutron.value,
              icon: neutronUsdc,
              depositCap: "65"
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelNeutron.value}%`, class: "hidden md:flex font-semibold" },
        { value: "65%" },
        { value: `${(Number(app.apr?.[AppUtils.getProtocols().neutron_noble]) ?? 0).toFixed(2)}%` }
      ]
    },
    {
      items: [
        {
          value: "SOL",
          subValue: "Solana",
          image: osmosisSol,
          variant: "left"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosisAllSol.value,
              icon: osmosisSol,
              depositCap: "65"
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosisAllSol.value}%`, class: "hidden md:flex font-semibold" },
        { value: "65%" },
        { value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_all_sol]) ?? 0).toFixed(2)}%` }
      ]
    },
    {
      items: [
        {
          value: "BTC",
          subValue: "Bitcoin",
          image: osmosisBtc,
          variant: "left"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosisAllBtc.value,
              icon: osmosisBtc,
              depositCap: "65"
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosisAllBtc.value}%`, class: "hidden md:flex font-semibold" },
        { value: "65%" },
        { value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_all_btc]) ?? 0).toFixed(2)}%` }
      ]
    },
    {
      items: [
        {
          value: "stAtom",
          subValue: "Stride Staked Atom",
          image: osmosisStAtom,
          variant: "left"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosis.value,
              icon: osmosisStAtom,
              depositCap: "65"
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosis.value}%`, class: "hidden md:flex font-semibold" },
        { value: "65%" },
        { value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_st_atom]) ?? 0).toFixed(2)}%` }
      ]
    },
    {
      items: [
        {
          value: "stAtom",
          subValue: "Stride Staked Atom",
          image: osmosisAkt,
          variant: "left"
        },
        {
          component: () =>
            h<UtilizationProps>(ChartUtilizaiton, {
              value: utilizationLevelOsmosisAkt.value,
              icon: osmosisAkt,
              depositCap: "65"
            }),
          class: "hidden md:flex min-w-[200]"
        },
        { value: `${utilizationLevelOsmosisAkt.value}%`, class: "hidden md:flex font-semibold" },
        { value: "65%" },
        { value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_akt]) ?? 0).toFixed(2)}%` }
      ]
    }
  ] as TableRowItemProps[];
});

const utilizationLevelNeutron = ref("0");
const utilizationLevelOsmosis = ref("0");
const utilizationLevelOsmosisStAtom = ref("0");
const utilizationLevelOsmosisAllBtc = ref("0");
const utilizationLevelOsmosisAllSol = ref("0");
const utilizationLevelOsmosisAkt = ref("0");

const optimal = ref("70");
const depositSuspension = ref("65");
const app = useApplicationStore();

onMounted(async () => {
  await Promise.all([
    setUtilizationNeutron(),
    setUtilizationOsmosis(),
    setUtilizationOsmosisStAtom(),
    setUtilizationOsmosisAllBtc(),
    setUtilizationOsmosisAllSol(),
    setUtilizationOsmosisAkt()
  ]).catch((e) => Logger.error(e));
});

async function setUtilizationNeutron() {
  const data = await fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().neutron_noble}`);
  const item = await data.json();
  utilizationLevelNeutron.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosis() {
  const data = await fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_noble}`);
  const item = await data.json();
  utilizationLevelOsmosis.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosisStAtom() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_st_atom}`
  );
  const item = await data.json();
  utilizationLevelOsmosisStAtom.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosisAllBtc() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_all_btc}`
  );
  const item = await data.json();
  utilizationLevelOsmosisAllBtc.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosisAllSol() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_all_sol}`
  );
  const item = await data.json();
  utilizationLevelOsmosisAllSol.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosisAkt() {
  const data = await fetch(
    `${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_akt}`
  );
  const item = await data.json();
  utilizationLevelOsmosisAkt.value = Number(item[0]).toFixed(2);
}
</script>

<style lang="" scoped></style>
