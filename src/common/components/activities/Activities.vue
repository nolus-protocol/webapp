<template>
  <Button
    ref="popoverParent"
    severity="tertiary"
    size="small"
    icon="history"
    class="text-icon-default"
    @click="isOpen = !isOpen"
  />
  <Popover
    v-if="isOpen"
    position="bottom-right"
    :parent="popoverParent"
    :title="$t('message.activities')"
    @close="isOpen = !isOpen"
    class="md:max-w-[385px]"
  >
    <template #header>
      <Tooltip
        :content="`Push notifications are <span class='font-semibold'>${isClicked ? 'enabled' : 'disabled'}</span>`"
        class="max-w-[152px]"
      >
        <Button
          severity="tertiary"
          size="small"
          class="!p-[9px] text-icon-default"
          @click="isClicked = !isClicked"
        >
          <SvgIcon
            name="bell"
            v-show="isClicked" />
          <SvgIcon
            name="bell-disabled"
            v-show="!isClicked"
        /></Button>
      </Tooltip>
    </template>
    <template #content>
      <template v-if="transactionHistory?.length > 0">
        <ActivitiesItem
          v-for="transaction in transactionHistory"
          :key="transaction.title"
          :title="transaction.title"
          :type="transaction.type"
          :time="transaction.time"
          @click="onActivityClick(transaction)"
        />
        <TransactionDetails
          ref="transactionDialogRef"
          :data="selectedTransactionHistory"
        />
      </template>
      <template v-else
        ><EmptyState
          :image="{
            name: 'no-notifications'
          }"
          title="No notifications"
          description="Come back later"
      /></template>
    </template>
  </Popover>
</template>

<script lang="ts" setup>
import { ref } from "vue";
import { Button, iconsExternalUrl, Popover, SvgIcon, Tooltip } from "web-components";
import EmptyState from "@/common/components/EmptyState.vue";
import ActivitiesItem from "./ActivitiesItem.vue";
import TransactionDetails from "./TransactionDetails.vue";
import type { ActivityItemProps } from "@/common/components/activities/ActivitiesItem.vue";
import { CURRENCY_VIEW_TYPES, type IObjectKeys } from "@/common/types";

type TransactionType = ActivityItemProps & IObjectKeys;

const transactionDialogRef = ref<typeof TransactionDetails | null>(null);
const popoverParent = ref();
const isOpen = ref(false);
const isClicked = ref(true);
const selectedTransactionHistory = ref({});

const transactionHistory: TransactionType[] = [
  {
    title: "Transaction 1",
    type: "leases",
    time: "2 hours ago",
    data: {
      headline: "Collect tokens from position #tsudlh32",
      position: {
        image: `${iconsExternalUrl}/osmosis-nls.svg`,
        value: "tsudlh32"
      },
      amount: {
        amount: "91437541",
        denom: "OSMO",
        type: CURRENCY_VIEW_TYPES.TOKEN,
        isDenomInfront: false,
        decimals: 6,
        hasSpace: true
      },
      fees: {
        amount: "0039226",
        denom: "NLS",
        type: CURRENCY_VIEW_TYPES.TOKEN,
        isDenomInfront: false,
        decimals: 6,
        hasSpace: true
      },
      hash: "C197BF9ECF24459CBB44340AB07EB062B7500BC14F468387E2AB44646373C7D",
      summary: {
        steps: [
          {
            label: "Transfer",
            icon: `${iconsExternalUrl}/osmosis-nls.svg`,
            token: { balance: 100, symbol: "NLS" }
            // meta: () => h("div", `Osmosis > Nolus (#ac34aadf) Nolus`)
          },
          {
            label: "Transfer",
            icon: `${iconsExternalUrl}/osmosis-atom.svg`,
            token: { balance: 100, symbol: "NLS" }
          }
        ]
      }
    }
  },
  {
    title: "Transaction 2",
    type: "leases",
    time: "2 hours ago",
    data: {
      headline: "Collect tokens from position #tsudlh32",
      position: {
        image: `${iconsExternalUrl}/osmosis-nls.svg`,
        value: "tsudlh33"
      },
      amount: {
        amount: "91437541",
        denom: "OSMO",
        type: CURRENCY_VIEW_TYPES.TOKEN,
        isDenomInfront: false,
        decimals: 6,
        hasSpace: true
      },
      fees: {
        amount: "0039226",
        denom: "NLS",
        type: CURRENCY_VIEW_TYPES.TOKEN,
        isDenomInfront: false,
        decimals: 6,
        hasSpace: true
      },
      hash: "C197BF9ECF24459CBB44340AB07EB062B7500BC14F468387E2AB44646373C7D",
      summary: {
        steps: [
          {
            label: "Transfer",
            icon: `${iconsExternalUrl}/osmosis-nls.svg`,
            token: { balance: 100, symbol: "NLS" }
            // meta: () => h("div", `Osmosis > Nolus (#ac34aadf) Nolus`)
          },
          {
            label: "Transfer",
            icon: `${iconsExternalUrl}/osmosis-atom.svg`,
            token: { balance: 100, symbol: "NLS" }
          }
        ]
      }
    }
  }
];

const onActivityClick = (transaction: TransactionType) => {
  console.info(transaction);
  selectedTransactionHistory.value = transaction.data;
  transactionDialogRef.value?.show();
};
</script>

<style scoped lang=""></style>
