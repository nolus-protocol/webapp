<template>
  <EarningAssetsTableRow
    id="earn-rewards"
    :items="items"
    @button-click="
      () => {
        props.onClickClaim?.();
      }
    "
  >
    <template #token>
      <CurrencyComponent
        :amount="reward.balance.amount.toString()"
        :decimals="assetInfo.decimal_digits"
        :denom="assetInfo.shortName"
        :fontSizeSmall="12"
        :maxDecimals="6"
        :minimalDenom="assetInfo.ibcData"
        :type="CURRENCY_VIEW_TYPES.TOKEN"
      />
    </template>
  </EarningAssetsTableRow>
</template>

<script lang="ts" setup>
import { computed, type PropType, ref } from "vue";
import { useI18n } from "vue-i18n";
import type { AssetBalance } from "@/common/stores/wallet/types";

import CurrencyComponent from "@/common/components/CurrencyComponent.vue";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Dec } from "@keplr-wallet/unit";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { AssetUtils } from "@/common/utils";
import { EarningAssetsTableRow } from "web-components";

const i18n = useI18n();

const props = defineProps({
  cols: {
    type: Number
  },
  reward: {
    type: Object as PropType<AssetBalance>,
    required: true
  },
  onClickClaim: {
    type: Function
  }
});

const loading = ref(false);

const assetInfo = computed(() => {
  const assetInfo = AssetUtils.getCurrencyByDenom(props.reward.balance.denom);
  return assetInfo;
});

function calculateBalance(tokenAmount: string, denom: string) {
  return AssetUtils.getPriceByDenom(tokenAmount, denom).toString(2);
}

const isEnabled = computed(() => {
  const asset = CurrencyUtils.convertCoinUNolusToNolus(props.reward.balance)?.toDec();

  if (asset?.gt(new Dec(0))) {
    return true;
  }

  return false;
});

const items = computed(() => [
  {
    type: CURRENCY_VIEW_TYPES.TOKEN,
    subValue: `$${calculateBalance(props.reward.balance?.amount.toString(), props.reward.balance?.denom)}`,
    image: assetInfo.value.icon,
    imageClass: "w-8"
  },
  {
    button: { label: i18n.t("message.claim"), loading: loading.value, disabled: !isEnabled.value },
    buttonOnly: true
  }
]);
</script>
