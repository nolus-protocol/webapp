<template>
  <template
    v-for="transaction in transactionData"
    :key="`${transaction.items[0].value}_${transaction.index}`"
  >
    <TableRow :items="transaction.items" />
  </template>
</template>

<script lang="ts" setup>
import { type ITransactionData } from "../types";

import { useApplicationStore } from "@/common/stores/application";
import { useWalletStore } from "@/common/stores/wallet";
import { getCreatedAtForHuman } from "@/common/utils";
import { useI18n } from "vue-i18n";
import { VoteOption } from "cosmjs-types/cosmos/gov/v1beta1/gov";
import { computed, h, onMounted, ref } from "vue";
import { Label, SvgIcon, TableRow, type LabelProps, type SvgProps, type TableRowItemProps } from "web-components";
import { action, message } from "../common";

const i18n = useI18n();
const applicaton = useApplicationStore();
const wallet = useWalletStore();
const messagesRef = ref<string[]>();

interface Props {
  transaction: ITransactionData;
}
const props = defineProps<Props>();

const voteMessages: { [key: string]: string } = {
  [VoteOption.VOTE_OPTION_ABSTAIN]: i18n.t(`message.abstained`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO_WITH_VETO]: i18n.t(`message.veto`).toLowerCase(),
  [VoteOption.VOTE_OPTION_YES]: i18n.t(`message.yes`).toLowerCase(),
  [VoteOption.VOTE_OPTION_NO]: i18n.t(`message.no`).toLowerCase()
};

onMounted(async () => {
  const promises = [];
  promises.push(message(props.transaction, wallet?.wallet?.address, i18n, voteMessages));
  messagesRef.value = await Promise.all(promises);
});

const transactionData = computed(() =>
  (messagesRef.value ?? []).map(
    ([msg]) =>
      ({
        items: [
          {
            value: msg,
            url: `${applicaton.network.networkAddresses.explorer}/${props.transaction.tx_hash}`,
            variant: "left"
          },
          {
            value: action(props.transaction, i18n),
            class: "max-w-[140px]"
          },
          {
            value: getCreatedAtForHuman(props.transaction.timestamp) ?? props.transaction.block,
            class: "max-w-[180px]"
          },
          {
            component: () => h<LabelProps>(Label, { value: i18n.t(`message.completed`), variant: "success" }),
            class: "max-w-[150px]"
          },
          { component: () => h<SvgProps>(SvgIcon, { name: "more" }), class: "max-w-[120px]" }
        ]
      }) as TableRowItemProps
  )
);
</script>
