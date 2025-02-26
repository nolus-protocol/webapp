<template>
  <div class="flex flex-1 flex-col justify-between gap-y-2 pb-3 lg:flex-row lg:gap-0">
    <div class="flex items-center">
      <SvgIcon
        name="arrow-left"
        size="l"
        class="mx-4 cursor-pointer text-icon-default"
        @click="goBack"
      />
      <div class="flex flex-col">
        <div class="text-24 font-semibold text-typography-default">{{ $t("message.pnl-history") }}</div>
      </div>
    </div>
  </div>
  <Widget
    v-if="!showSkeleton"
    class="overflow-auto"
  >
    <EmptyState
      v-if="leasesHistory.length == 0"
      :slider="[
        {
          image: { name: 'new-lease' },
          title: $t('message.start-lease'),
          description: $t('message.start-lease-description'),
          link: {
            label: $t('message.learn-new-leases'),
            url: '#',
            tooltip: { content: $t('message.learn-new-leases') }
          }
        }
      ]"
    />
    <template v-else>
      <BigNumber
        :label="$t('message.realized-pnl')"
        :amount="{
          amount: pnl.toString(),
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: NATIVE_CURRENCY.symbol
        }"
      />
      <!-- <PositionPreviewChart /> -->
      <Table
        :columns="leasesHistory.length > 0 ? columns : []"
        :class="[{ 'min-w-[600px]': leasesHistory.length > 0 }]"
      >
        <template v-slot:body>
          <TableRow
            v-for="(row, index) in leasesHistory"
            :key="index"
            :items="row.items"
          />
        </template>
      </Table>
    </template>
  </Widget>
  <div class="my-4 flex justify-center">
    <Button
      v-if="!loaded"
      :label="$t('message.load-more')"
      :loading="loading"
      class="mx-auto"
      severity="secondary"
      size="medium"
      @click="loadLoans"
    />
  </div>
</template>

<script lang="ts" setup>
import { useI18n } from "vue-i18n";
import {
  Label,
  type LabelProps,
  Table,
  type TableColumnProps,
  TableRow,
  type TableRowItemProps,
  Widget,
  SvgIcon,
  Button
} from "web-components";
import { computed, h, onMounted, ref, watch } from "vue";
import BigNumber from "@/common/components/BigNumber.vue";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { NATIVE_CURRENCY, PositionTypes, ProtocolsConfig } from "@/config/global";
import type { ILoan } from "./types";
import { AssetUtils, EtlApi, getCreatedAtForHuman, Logger } from "@/common/utils";
import { CurrencyDemapping } from "@/config/currencies";
import { useApplicationStore } from "@/common/stores/application";
import { useWalletStore } from "@/common/stores/wallet";
import { Dec, PricePretty } from "@keplr-wallet/unit";
import { RouteNames } from "@/router";
import { useRouter } from "vue-router";
import EmptyState from "@/common/components/EmptyState.vue";

const i18n = useI18n();
const app = useApplicationStore();
const wallet = useWalletStore();
const pnl = ref(new Dec(0));

const limit = 10;
let skip = 0;

const loading = ref(false);
const loaded = ref(false);
const showSkeleton = ref(true);
const router = useRouter();

const columns: TableColumnProps[] = [
  { label: i18n.t("message.type"), variant: "left", class: "max-w-[150px]" },
  { label: i18n.t("message.contract-id"), variant: "left" },
  { label: i18n.t("message.asset"), variant: "left", class: "max-w-[200px]" },
  { label: i18n.t("message.action"), class: "max-w-[100px]" },
  { label: i18n.t("message.realized"), class: "max-w-[200px]" },
  { label: i18n.t("message.date-capitalize"), class: "max-w-[150px]" }
];

const loans = ref([] as ILoan[]);

onMounted(() => {
  loadLoans();
  setRealizedPnl();
});

watch(
  () => wallet.wallet,
  () => {
    skip = 0;
    loadLoans();
  }
);

function goBack() {
  router.push({ path: `/${RouteNames.LEASES}` });
}

async function loadLoans() {
  try {
    if (wallet.wallet?.address) {
      loading.value = true;
      const res = await EtlApi.fetchPNL(wallet.wallet?.address, skip, limit);
      loans.value = [...loans.value, ...res] as ILoan[];
      const loadedSender = res.length < limit;
      if (loadedSender) {
        loaded.value = true;
      }
      skip += limit;
    } else {
      loans.value = [];
    }
    showSkeleton.value = false;
  } catch (e: Error | any) {
    Logger.error(e);
  } finally {
    setTimeout(() => {
      loading.value = false;
    }, 200);
  }
}

const leasesHistory = computed(() => {
  return loans.value.map((item) => {
    const protocol = AssetUtils.getProtocolByContract(item.LS_loan_pool_id);
    const ticker = CurrencyDemapping[item.LS_asset_symbol]?.ticker ?? item.LS_asset_symbol;
    let currency = app.currenciesData![`${ticker}@${protocol}`];

    switch (ProtocolsConfig[protocol].type) {
      case PositionTypes.short: {
        let lpn = app.networksData?.protocols?.[protocol].Lpn.dex_currency;
        currency = app.currenciesData![`${lpn}@${protocol}`];
        break;
      }
    }

    const pnl = new Dec(item.LS_pnl);
    let pnl_status = pnl.isZero() || pnl.isPositive();

    return {
      items: [
        {
          component: getType(item),
          class: "max-w-[150px] cursor-pointer",
          variant: "left"
        },
        {
          value: `#${item.LS_contract_id.slice(-8)}`,
          class: "text-typography-link cursor-pointer",
          variant: "left"
        },
        {
          image: currency.icon,
          value: currency.name,
          subValue: currency.shortName,
          class: "max-w-[200px]",
          variant: "left"
        },
        {
          value: i18n.t(`message.status-${item.Type}`),
          class: "max-w-[100px]"
        },
        {
          value: new PricePretty(
            {
              currency: "usd",
              symbol: "$",
              locale: "en-US",
              maxDecimals: NATIVE_CURRENCY.maximumFractionDigits
            },
            pnl.quo(new Dec(10 ** currency.decimal_digits))
          ),
          class: `max-w-[200px] ${pnl_status ? "text-typography-success" : "text-typography-error"}`
        },
        {
          value: getCreatedAtForHuman(new Date(item.LS_timestamp)) as string,
          class: "max-w-[150px]"
        }
      ]
    };
  }) as TableRowItemProps[];
});

function getType(item: ILoan) {
  const protocol = AssetUtils.getProtocolByContract(item.LS_loan_pool_id);

  switch (ProtocolsConfig[protocol].type) {
    case PositionTypes.short: {
      return () =>
        h<LabelProps>(Label, { value: i18n.t(`message.${ProtocolsConfig[protocol].type}`), variant: "error" });
    }
    case PositionTypes.long: {
      return () =>
        h<LabelProps>(Label, { value: i18n.t(`message.${ProtocolsConfig[protocol].type}`), variant: "success" });
    }
  }
}

async function setRealizedPnl() {
  try {
    const data = await EtlApi.fetchRealizedPNL(wallet?.wallet?.address);
    pnl.value = new Dec(data.realized_pnl);
  } catch (error) {
    console.error(error);
  }
}
</script>

<style scoped lang=""></style>
