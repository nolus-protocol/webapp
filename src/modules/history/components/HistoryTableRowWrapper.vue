<template>
  <TableRow :items="transactionData.items" />
  <TransactionDetails ref="transactionDialogRef" />
</template>

<script lang="ts" setup>
import { type ITransactionData } from "../types";
import type { HistoryData } from "../types/ITransaction";

import { useI18n } from "vue-i18n";
import { computed, h, ref } from "vue";
import { Label, type LabelProps, TableRow, type TableRowItemProps } from "web-components";
import TransactionDetails from "@/common/components/activities/TransactionDetails.vue";
import Action, { type IAction } from "@/modules/history/components/Action.vue";

const i18n = useI18n();
const transactionDialogRef = ref<typeof TransactionDetails | null>(null);

interface Props {
  transaction: ITransactionData & HistoryData;
}
const props = defineProps<Props>();

const transactionData = computed(
  () =>
    ({
      items: [
        {
          value: props.transaction.historyData.msg,
          variant: "left",
          click: onActivityClick,
          class: "text-typography-link cursor-pointer font-semibold"
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
          component: () =>
            h<IAction>(Action, {
              transaction: props.transaction,
              onClick: onActivityClick
            }),
          class: "max-w-[120px]"
        }
      ]
    }) as TableRowItemProps
);

const onActivityClick = () => {
  transactionDialogRef.value?.show(props.transaction);
};
</script>
