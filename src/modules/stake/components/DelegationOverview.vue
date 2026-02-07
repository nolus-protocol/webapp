<template>
  <Widget>
    <WidgetHeader
      :label="$t('message.delegation-overview')"
      :icon="{ name: 'earn' }"
    />
    <div class="flex flex-row flex-wrap gap-4 md:gap-8">
      <BigNumber
        v-if="!showEmpty"
        :label="$t('message.total-value')"
        :amount="{
          amount: delegated,
          type: CURRENCY_VIEW_TYPES.TOKEN,
          denom: NATIVE_ASSET.label,
          minimalDenom: '',
          decimals: NATIVE_ASSET.decimal_digits,
          hasSpace: true,
          class: 'leading-[36px]',
          fontSize: mobile ? 24 : 32,
          animatedReveal: true,
          compact: mobile
        }"
        :secondary="{
          amount: stableDelegated,
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: '$',
          compact: mobile
        }"
      />
      <BigNumber
        v-if="showEmpty"
        :label="$t('message.yield')"
        :amount="{
          amount: wallet.apr.toString(),
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          denom: '%',
          isDenomInfront: false,
          minimalDenom: '',
          decimals: 2,
          hasSpace: false,
          class: 'leading-[36px]',
          fontSize: mobile ? 24 : 32,
          animatedReveal: true
        }"
      />
      <BigNumber
        v-if="!showEmpty"
        :label="$t('message.yield')"
        :label-tooltip="{
          content: $t('message.yield-overview-tooltip')
        }"
        :amount="{
          amount: wallet.apr.toString(),
          type: CURRENCY_VIEW_TYPES.CURRENCY,
          class: 'leading-[36px]',
          denom: '%',
          isDenomInfront: false,
          fontSize: mobile ? 24 : 32,
          animatedReveal: true
        }"
      />
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

      <template v-if="validators.length > 0">
        <div class="flex items-center gap-2 text-18 font-semibold">
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
          :showEmpty="false"
          :validators="validators"
        />
      </template>
      <DelegationTable
        v-if="showEmpty && validators.length === 0"
        :showEmpty="true"
        :validators="[]"
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
import { isMobile } from "@/common/utils";

const mobile = isMobile();

const props = defineProps<{
  stableDelegated: string;
  delegated: string;
  validators: TableRowItemProps[];
  showEmpty: boolean;
  unboundingDelegations: IObjectKeys[];
}>();

const wallet = useWalletStore();

</script>
