<template>
  <TableRow
    v-for="tx of history"
    :key="tx.key"
    :items="[
      { value: tx.action },
      { value: tx.status },
      { value: tx.step == CONFIRM_STEP.SUCCESS ? getCreatedAtForHuman(tx.date)! : '' },
      { value: tx.fee.toString() }
    ]"
  />
</template>

<script lang="ts" setup>
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import { TableRow } from "web-components";

import { CONFIRM_STEP, type IObjectKeys, type Network } from "@/common/types";
import { AssetUtils, getCreatedAtForHuman } from "@/common/utils";
import { type CoinPretty, Dec } from "@keplr-wallet/unit";
import { useWalletStore } from "@/common/stores/wallet";
import { HYSTORY_ACTIONS } from "@/modules/history/types";
import type { Coin } from "@keplr-wallet/types";
import type { EvmNetwork } from "@/common/types/Network";
import { CurrencyUtils } from "@nolus/nolusjs";

const i18n = useI18n();
const wallet = useWalletStore();

const history = computed(() => {
  const h = wallet.history;
  const items = [];
  for (const key in h) {
    const item = h[key];
    items.push({
      date: new Date(item.id),
      action: getAction(item),
      status: i18n.t(`message.${item.step}-History`),
      fee: calculateFee(item.fee, item.selectedNetwork) as CoinPretty,
      step: item.step,
      key
    });
  }
  return items.sort((a, b) => Number(b.key) - Number(a.key));
});

function getAction(item: IObjectKeys) {
  switch (item.action) {
    case HYSTORY_ACTIONS.SWAP: {
      return i18n.t("message.swap-skip-action", {
        amount: `${new Dec(item.amount).toString(item.selectedCurrency.decimal_digits)} ${item.selectedCurrency.shortName}`,
        swapTo: `${new Dec(item.swapToAmount).toString(item.swapToSelectedCurrency.decimal_digits)} ${item.swapToSelectedCurrency.shortName}`
      });
    }
    case HYSTORY_ACTIONS.RECEIVE: {
      return i18n.t("message.receive-skip-action", {
        amount: `${new Dec(item.amount).toString(item.selectedCurrency.decimal_digits)} ${item.selectedCurrency.shortName}`,
        network: `${item.selectedNetwork.label}`
      });
    }
    case HYSTORY_ACTIONS.SEND: {
      return i18n.t("message.send-skip-action", {
        amount: `${new Dec(item.amount).toString(item.selectedCurrency.decimal_digits)} ${item.selectedCurrency.shortName}`,
        network: `${item.selectedNetwork.label}`
      });
    }
  }
  return "";
}

function calculateFee(coin: Coin, network: Network | EvmNetwork) {
  switch (network.chain_type) {
    case "cosmos": {
      return calculateCosmosFee(coin, network);
    }
    case "evm": {
      return calculateEvmFee(coin, network);
    }
  }
}

function calculateCosmosFee(coin: Coin, _network: Network | EvmNetwork) {
  const asset = AssetUtils.getCurrencyByDenom(coin.denom);
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    asset.ibcData,
    asset.shortName,
    asset.decimal_digits
  );
}

function calculateEvmFee(coin: Coin, network: Network | EvmNetwork) {
  return CurrencyUtils.convertMinimalDenomToDenom(
    coin.amount.toString(),
    coin.denom,
    coin.denom,
    (network as EvmNetwork).nativeCurrency.decimals
  );
}
</script>
