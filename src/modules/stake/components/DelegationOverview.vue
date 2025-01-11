<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.delegation-overview')"
      :icon="{ name: 'earn' }"
    />
    <div class="flex flex-col gap-6 md:flex-row md:gap-0">
      <BigNumber
        :label="$t('message.total-value')"
        :amount="{
          amount: delegated,
          type: CURRENCY_VIEW_TYPES.TOKEN,
          denom: NATIVE_ASSET.label,
          maxDecimals: NATIVE_ASSET.decimal_digits,
          minimalDenom: '',
          decimals: NATIVE_ASSET.decimal_digits,
          hasSpace: true,
          class: 'leading-[36px]'
        }"
        :secondary="{
          amount: stableDelegated,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: '$'
        }"
      />
      <template v-if="!showEmpty">
        <span class="mx-6 hidden h-full border-r border-border-color md:block" />
        <BigNumber
          :label="$t('message.yield')"
          :label-tooltip="{
            content: $t('message.yield-tooltip')
          }"
          :amount="{
            amount: wallet.apr.toString(),
            type: CURRENCY_VIEW_TYPES.CURRENCY,
            class: 'leading-[36px]',
            denom: '%',
            isDenomInfront: false
          }"
        />
      </template>
    </div>
    <div class="flex flex-col">
      <template v-if="!showEmpty && unboundingDelegations.length > 0">
        <div class="flex items-center gap-2 text-18 font-semibold">
          {{ $t("message.undelegating-balance") }}
          <Tooltip
            position="top"
            :content="$t('message.undelegating-balance-tooltip')"
          >
            <SvgIcon
              name="help"
              class="rounded-full"
              size="s"
          /></Tooltip>
        </div>
        <UnbondingsTable
          class="mb-8"
          :showEmpty="showEmpty"
          :unboundingDelegations="unboundingDelegations"
        />
      </template>

      <div
        v-if="!showEmpty"
        class="flex items-center gap-2 text-18 font-semibold"
      >
        {{ $t("message.validator-distribution") }}
        <Tooltip
          position="top"
          :content="$t('message.validator-distribution-tooltip')"
        >
          <SvgIcon
            name="help"
            class="rounded-full"
            size="s"
        /></Tooltip>
      </div>
      <DelegationTable
        :showEmpty="showEmpty"
        :validators="validators"
      />
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import { CURRENCY_VIEW_TYPES, SvgIcon, Tooltip, Widget, type TableRowItemProps } from "web-components";
import DelegationTable from "@/modules/stake/components/DelegationTable.vue";
import UnbondingsTable from "@/modules/stake/components/UnbondingsTable.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import { NATIVE_ASSET } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";
import type { IObjectKeys } from "@/common/types";

defineProps<{
  stableDelegated: string;
  delegated: string;
  validators: TableRowItemProps[];
  showEmpty: boolean;
  unboundingDelegations: IObjectKeys[];
}>();

const wallet = useWalletStore();
</script>
