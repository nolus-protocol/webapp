<template>
  <TableRow :items="transactionData.items" />
  <TransactionDetails ref="transactionDialogRef" />
</template>

<script lang="ts" setup>
import { type ITransactionData } from "../types";

import { useI18n } from "vue-i18n";
import { computed, h, ref } from "vue";
import { Label, SvgIcon, TableRow, type LabelProps, type SvgProps, type TableRowItemProps } from "web-components";
import type { HistoryData } from "../types/ITransaction";
import TransactionDetails from "@/common/components/activities/TransactionDetails.vue";
import { useApplicationStore } from "@/common/stores/application";

const i18n = useI18n();
const transactionDialogRef = ref<typeof TransactionDetails | null>(null);

interface Props {
  transaction: ITransactionData & HistoryData;
}
const props = defineProps<Props>();
const applicaton = useApplicationStore();

const transactionData = computed(
  () =>
    ({
      items: [
        {
          value: props.transaction.historyData.msg,
          variant: "left",
          click: onActivityClick,
          class: "text-typography-link cursor-pointer"
        },
        {
          value: props.transaction.historyData.action,
          class: "max-w-[140px]"
        },
        {
          value: props.transaction.historyData.timestamp ?? props.transaction.block,
          class: "max-w-[180px]"
        },
        {
          component: () => h<LabelProps>(Label, { value: i18n.t(`message.completed`), variant: "success" }),
          class: "max-w-[150px]"
        },
        {
          component: () => h<SvgProps>(SvgIcon, { name: "more" }),
          class: "max-w-[120px] cursor-pointer",
          click: () => {
            window.open(`${applicaton.network.networkAddresses.explorer}/${props.transaction.tx_hash}`, "_blank");
          }
        }
      ]
    }) as TableRowItemProps
);

const onActivityClick = () => {
  transactionDialogRef.value?.show(props.transaction);
};
</script>
