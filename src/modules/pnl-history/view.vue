<template>
  <div class="mb-sm-nolus-70 col-span-12">
    <Table
      :class="{ outline: hasOutline }"
      :columns="columns"
      class="async-loader mt-6"
      columnsClasses="hidden md:flex"
      :title="$t('message.pnl-history')"
    >
      <template v-slot:body>
        <template v-if="!showSkeleton">
          <TransitionGroup
            appear
            name="fade-long"
          >
            <div
              v-if="loans.length == 0"
              class="h-[180px]"
            >
              <div class="nls-12 text-dark-grey flex h-full flex-col items-center justify-center">
                <img
                  class="m-4 inline-block"
                  height="32"
                  src="/src/assets/icons/empty_history.svg"
                  width="32"
                />
                {{ $t("message.no-results") }}
              </div>
            </div>

            <div
              v-for="l of loansData"
              :key="l.LS_contract_id"
            >
              <HistoryTableRow
                :items="l.items"
                classes="!flex-row !flex-wrap !md:flex-nowrap"
              />
            </div>
          </TransitionGroup>
        </template>
        <template v-else>
          <TableSkeleton />
        </template>
      </template>
    </Table>
    <div class="my-4 flex justify-center">
      <Button
        v-if="visible"
        :label="$t('message.load-more')"
        :loading="loading"
        class="mx-auto"
        severity="secondary"
        size="medium"
        @click="loadLoans"
      />
    </div>
  </div>
  <Modal
    v-if="showErrorDialog"
    route="alert"
    @close-modal="showErrorDialog = false"
  >
    <ErrorDialog
      :message="errorMessage"
      :title="$t('message.error-connecting')"
      :try-button="onClickTryAgain"
    />
  </Modal>
</template>

<script lang="ts" setup>
import Modal from "@/common/components/modals/templates/Modal.vue";
import ErrorDialog from "@/common/components/modals/ErrorDialog.vue";

import { computed, onMounted, onUnmounted, ref, watch } from "vue";
import { Button, Table } from "web-components";
import { useI18n } from "vue-i18n";

import { HistoryTableRow } from "web-components";
import { useWalletStore } from "@/common/stores/wallet";
import type { ILoan } from "./types";
import { AssetUtils, EtlApi, getCreatedAtForHuman } from "@/common/utils";
import { TableSkeleton } from "./components";
import { useApplicationStore } from "@/common/stores/application";
import { CurrencyDemapping } from "@/config/currencies";
import { PositionTypes, ProtocolsConfig } from "@/config/global";
import { Dec, PricePretty } from "@keplr-wallet/unit";
import type { IObjectKeys } from "@/common/types";

const showErrorDialog = ref(false);
const errorMessage = ref("");
const loans = ref([] as ILoan[]);
const i18n = useI18n();
const wallet = useWalletStore();
const app = useApplicationStore();

const columns = [
  { label: i18n.t("message.type"), class: "max-w-[150px]" },
  { label: i18n.t("message.contract-id"), class: "!justify-start" },
  { label: i18n.t("message.asset"), class: "max-w-[100px]" },
  { label: i18n.t("message.action"), class: "" },
  { label: i18n.t("message.realized"), class: "" },
  { label: i18n.t("message.date"), class: "" }
];

const limit = 10;
let skip = 0;

const loading = ref(false);
const loaded = ref(false);
const showSkeleton = ref(true);

let timeout: NodeJS.Timeout;

onMounted(() => {
  loadLoans();
});

onUnmounted(() => {
  if (timeout) {
    clearTimeout(timeout);
  }
});

watch(
  () => wallet.wallet,
  () => {
    skip = 0;
    loadLoans();
  }
);

const hasOutline = computed(() => {
  if (window.innerWidth > 576) {
    return true;
  }
  return loans.value.length > 0;
});

const visible = computed(() => {
  return !loaded.value;
});

function onClickTryAgain() {
  loadLoans();
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
    showErrorDialog.value = true;
    errorMessage.value = e?.message;
  } finally {
    setTimeout(() => {
      loading.value = false;
    }, 200);
  }
}

const loansData = computed(() => {
  return loans.value.map((item) => {
    const protocol = AssetUtils.getProtocolByContract(item.LS_loan_pool_id);
    const ticker = CurrencyDemapping[item.LS_asset_symbol]?.ticker ?? item.LS_asset_symbol;
    let currency = app.currenciesData![`${ticker}@${protocol}`];

    switch (ProtocolsConfig[protocol].type) {
      case PositionTypes.short: {
        const lpn = AssetUtils.getLpnByProtocol(protocol);
        currency = lpn;
        break;
      }
    }

    return {
      LS_contract_id: item.LS_contract_id,
      items: [
        {
          value: i18n.t(`message.${ProtocolsConfig[protocol].type}`),
          class: `text-14 uppercase ${getTitleClass(ProtocolsConfig[protocol])} max-w-[150px] mb-[4px] md:mb-[0px] md:basis-0`
        },
        {
          value: `#${item.LS_contract_id.slice(-8)}`,
          url: `#`,
          class:
            "text-14 !justify-start cursor-defaul pointer-events-none	basis-[80%] md:basis-0 mb-[4px] pl-[12px] md:mb-[0px] md:pl-[0px]"
        },
        {
          value: currency.shortName,
          class: "text-14 md:justify-end max-w-[100px] text-neutral-typography-200 basis-1/3 md:basis-0"
        },
        {
          value: i18n.t(`message.status-${item.Type}`),
          class: "text-14 md:justify-end text-neutral-typography-200 hidden md:flex md:basis-0"
        },
        {
          value: new PricePretty(
            {
              currency: "usd",
              maxDecimals: currency.decimal_digits,
              symbol: "$",
              locale: "en-US"
            },
            new Dec(item.LS_pnl).quo(new Dec(10 ** currency.decimal_digits))
          ).toString(),
          class: "text-14 text-neutral-typography-200 basis-1/3 justify-center md:basis-0"
        },
        {
          value: getCreatedAtForHuman(new Date(item.LS_timestamp)) as string,
          class: "text-14 justify-end basis-1/3 md:basis-0"
        }
      ]
    };
  });
});

function getTitleClass(protocol: IObjectKeys) {
  switch (protocol.type) {
    case PositionTypes.long: {
      return "pnl-status-long";
    }
    case PositionTypes.short: {
      return "pnl-status-short";
    }
  }
}
</script>
<style>
.pnl-status-long {
  span {
    @apply rounded border border-success-100 p-1 text-success-100;
  }
}

.pnl-status-short {
  span {
    @apply rounded border border-danger-100 p-1 text-danger-100;
  }
}
</style>
