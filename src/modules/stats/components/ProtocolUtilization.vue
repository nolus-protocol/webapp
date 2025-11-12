<template>
  <Widget>
    <WidgetHeader :label="$t('message.utilization-level')" />
    <BigNumber
      :label="$t('message.supplied-funds')"
      :amount="{
        amount: suppliedFunds,
        type: CURRENCY_VIEW_TYPES.CURRENCY,
        denom: NATIVE_CURRENCY.symbol,
        decimals: 0
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
import { AppUtils, EnvNetworkUtils, EtlApi, Logger } from "@/common/utils";

import { computed, h, ref, watch } from "vue";
import { useApplicationStore } from "@/common/stores/application";
import { useI18n } from "vue-i18n";
import { NATIVE_CURRENCY, PERCENT, PERMILLE } from "@/config/global";
import { CURRENCY_VIEW_TYPES } from "@/common/types";

const osmoUsdc =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/osmosis-usdc.svg";
const neutronUsdc =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/neutron-usdc.svg";
const osmosisSol =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/osmosis-allsol.svg";
const osmosisBtc =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/osmosis-allbtc.svg";
const osmosisStAtom =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/osmosis-statom.svg";
const osmosisAkt =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/osmosis-akt.svg";
const osmosisAtom =
  "https://raw.githubusercontent.com/nolus-protocol/webapp/refs/heads/main/src/assets/icons/osmosis-atom.svg";

import type { UtilizationProps } from "../types";
import { NolusClient } from "@nolus/nolusjs";
import { Lpp } from "@nolus/nolusjs/build/contracts";
import { useAdminStore } from "@/common/stores/admin";

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
          value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_noble]) ?? 0).toFixed(2)}%`,
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
          value: `${(Number(app.apr?.[AppUtils.getProtocols().neutron_noble]) ?? 0).toFixed(2)}%`,
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
          value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_all_sol]) ?? 0).toFixed(2)}%`,
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
          value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_all_btc]) ?? 0).toFixed(2)}%`,
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
    //       value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_st_atom]) ?? 0).toFixed(2)}%`,
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
          value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_akt]) ?? 0).toFixed(2)}%`,
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
          value: `${(Number(app.apr?.[AppUtils.getProtocols().osmosis_osmosis_atom]) ?? 0).toFixed(2)}%`,
          class: "text-typography-success"
        }
      ]
    }
  ] as TableRowItemProps[];
});

const utilizationLevelNeutron = ref("0");
const depositNeutron = ref("");

const utilizationLevelOsmosis = ref("0");
const depositOsmosis = ref("");

// const utilizationLevelOsmosisStAtom = ref("0");
// const depositStAtom = ref("");

const utilizationLevelOsmosisAllBtc = ref("0");
const depositAllBtc = ref("");

const utilizationLevelOsmosisAllSol = ref("0");
const depositAllSol = ref("");

const utilizationLevelOsmosisAkt = ref("0");
const depositAkt = ref("");

const utilizationLevelOsmosisAtom = ref("0");
const depositAtom = ref("");

const suppliedFunds = ref("0");

const app = useApplicationStore();
const admin = useAdminStore();

watch(
  () => app.init,
  () => {
    if (app.init) {
      onInit();
    }
  },
  {
    immediate: true
  }
);

async function onInit() {
  await Promise.all([
    setUtilizationNeutron(),
    setUtilizationOsmosis(),
    // setUtilizationOsmosisStAtom(),
    setUtilizationOsmosisAllBtc(),
    setUtilizationOsmosisAllSol(),
    setUtilizationOsmosisAkt(),
    setUtilizationOsmosisAtom(),
    setSuppliedFunds()
  ]).catch((e) => Logger.error(e));
}

async function setSuppliedFunds() {
  const data = await EtlApi.fetchSuppliedFunds();
  suppliedFunds.value = data.amount;
}

async function setUtilizationNeutron() {
  const [data, capacity] = await Promise.all([
    fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().neutron_noble}`),
    getDepositCapacityMsg(AppUtils.getProtocols().neutron_noble)
  ]);
  const item = await data.json();
  depositNeutron.value = capacity;
  utilizationLevelNeutron.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosis() {
  const [data, capacity] = await Promise.all([
    fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_noble}`),
    getDepositCapacityMsg(AppUtils.getProtocols().osmosis_noble)
  ]);
  const item = await data.json();
  depositOsmosis.value = capacity;
  utilizationLevelOsmosis.value = Number(item[0]).toFixed(2);
}

// async function setUtilizationOsmosisStAtom() {
//   const [data, capacity] = await Promise.all([
//     fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_st_atom}`),
//     getDepositCapacityMsg(AppUtils.getProtocols().osmosis_osmosis_st_atom)
//   ]);
//   const item = await data.json();
//   depositStAtom.value = capacity;
//   utilizationLevelOsmosisStAtom.value = Number(item[0]).toFixed(2);
// }

async function setUtilizationOsmosisAllBtc() {
  const [data, capacity] = await Promise.all([
    fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_all_btc}`),
    getDepositCapacityMsg(AppUtils.getProtocols().osmosis_osmosis_all_btc)
  ]);
  const item = await data.json();
  depositAllBtc.value = capacity;
  utilizationLevelOsmosisAllBtc.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosisAllSol() {
  const [data, capacity] = await Promise.all([
    fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_all_sol}`),
    getDepositCapacityMsg(AppUtils.getProtocols().osmosis_osmosis_all_sol)
  ]);
  const item = await data.json();
  depositAllSol.value = capacity;
  utilizationLevelOsmosisAllSol.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosisAkt() {
  const [data, capacity] = await Promise.all([
    fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_akt}`),
    getDepositCapacityMsg(AppUtils.getProtocols().osmosis_osmosis_akt)
  ]);
  const item = await data.json();
  depositAkt.value = capacity;
  utilizationLevelOsmosisAkt.value = Number(item[0]).toFixed(2);
}

async function setUtilizationOsmosisAtom() {
  const [data, capacity] = await Promise.all([
    fetch(`${EtlApi.getApiUrl()}/utilization-level?protocol=${AppUtils.getProtocols().osmosis_osmosis_atom}`),
    getDepositCapacityMsg(AppUtils.getProtocols().osmosis_osmosis_atom)
  ]);
  const item = await data.json();
  depositAtom.value = capacity;
  utilizationLevelOsmosisAtom.value = Number(item[0]).toFixed(2);
}

async function getDepositCapacityMsg(protocol: string) {
  const client = await NolusClient.getInstance().getCosmWasmClient();
  const lppClient = new Lpp(client, admin.protocols[EnvNetworkUtils.getStoredNetworkName()]![protocol].lpp);
  const data = await lppClient.getLppConfig();
  const percent = (data.min_utilization / PERMILLE) * PERCENT;
  return `${percent}`;
}
</script>
