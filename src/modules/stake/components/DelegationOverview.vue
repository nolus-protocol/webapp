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
      <span class="mx-6 hidden h-full border-r border-border-color md:block" />
      <BigNumber
        label="Yield"
        :amount="{
          amount: wallet.apr.toString(),
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          class: 'leading-[36px]',
          denom: '%',
          isDenomInfront: false
        }"
      />
    </div>
    <div class="flex flex-col">
      <div class="flex items-center gap-2 text-18 font-semibold">
        {{ $t("message.validator-distribution") }}
        <Tooltip
          position="top"
          content="some text"
        >
          <SvgIcon
            name="help"
            class="rounded-full"
            size="s"
        /></Tooltip>
      </div>
      <DelegationTable :validators="validators" />
    </div>
  </Widget>
</template>

<script lang="ts" setup>
import WidgetHeader from "@/common/components/WidgetHeader.vue";
import { CURRENCY_VIEW_TYPES, SvgIcon, Tooltip, Widget, type TableRowItemProps } from "web-components";
import DelegationTable from "@/modules/stake/components/DelegationTable.vue";
import BigNumber from "@/common/components/BigNumber.vue";
import { NATIVE_ASSET } from "@/config/global";
import { useWalletStore } from "@/common/stores/wallet";

defineProps<{
  stableDelegated: string;
  delegated: string;
  validators: TableRowItemProps[];
}>();

const wallet = useWalletStore();
</script>
