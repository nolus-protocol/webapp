<template>
  <Table
    :columns="columns"
    searchable
    :size="isMobile() ? '' : `${assets.length} ${$t('message.assets')}`"
    :toggle="{ label: $t('message.show-small-balances'), value: smBalances }"
    @togle-value="setSmallBalancesState"
    :hide-values="{ text: $t('message.toggle-values'), value: hide }"
    @hide-value="onHide"
    tableClasses="min-w-[530px]"
    @on-input="(e: Event) => onSearch((e.target as HTMLInputElement).value)"
    header-classes="md:flex-row flex-col items-stretch md:items-center gap-4 md:gap-2"
    @onSearchClear="onSearch('')"
  >
    <BigNumber
      :label="$t('message.assets-title')"
      :amount="{
        amount: total.toString(2),
        hide: hide,
        type: CURRENCY_VIEW_TYPES.CURRENCY,
        denom: NATIVE_CURRENCY.symbol,
        fontSize: isMobile() ? 20 : 40
      }"
    />

    <template v-slot:body>
      <TableRow
        v-for="(row, index) in assets"
        :key="index"
        :items="row.items"
      />
    </template>
  </Table>
</template>

<script lang="ts" setup>
import BigNumber from "@/common/components/BigNumber.vue";
import type { TableColumnProps, TableRowItemProps } from "web-components";
import { Table, TableRow } from "web-components";
import { CURRENCY_VIEW_TYPES } from "@/common/types";
import { useI18n } from "vue-i18n";
import { useWalletStore } from "@/common/stores/wallet";
import { useOracleStore } from "@/common/stores/oracle";
import { computed, ref, watch } from "vue";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { AssetUtils, Logger, WalletManager } from "@/common/utils";
import { NATIVE_CURRENCY, ProtocolsConfig } from "@/config/global";
import { useApplicationStore } from "@/common/stores/application";
import type { ExternalCurrency } from "@/common/types";
import { isMobile } from "@/common/utils";

const i18n = useI18n();
const wallet = useWalletStore();
const oracle = useOracleStore();
const app = useApplicationStore();
const hide = ref(WalletManager.getHideBalances());
const total = ref(new Dec(0));
const smBalances = ref(WalletManager.getSmallBalances());

const showSmallBalances = computed(() => {
  if (!wallet.wallet) {
    return true;
  }
  return smBalances.value;
});
const search = ref("");

const columns = computed<TableColumnProps[]>(() => [
  { label: i18n.t("message.assets"), variant: "left" },
  { label: i18n.t("message.price"), class: "md:flex" },
  { label: i18n.t("message.balance") },
  {
    label: i18n.t("message.yield"),
    tooltip: { position: "top", content: i18n.t("message.earn-apr-tooltip") },
    class: "md:flex"
  }
]);

const filteredAssets = computed(() => {
  const balances = showSmallBalances.value ? wallet.currencies : filterSmallBalances(wallet.currencies);
  return balances.sort((a, b) => {
    const aAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[a.key]?.amount,
      new Coin(a.balance.denom, a.balance.amount.toString()),
      a.decimal_digits as number
    ).toDec();

    const bAssetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[b.key]?.amount,
      new Coin(b.balance.denom, b.balance.amount.toString()),
      b.decimal_digits as number
    ).toDec();

    return Number(bAssetBalance.sub(aAssetBalance).toString(8));
  });
});

watch(
  () => [wallet.wallet, oracle.prices, wallet.balances],
  async () => {
    try {
      setAvailableAssets();
    } catch (e) {
      Logger.error(e);
    }
  },
  {
    immediate: true
  }
);

function filterSmallBalances(balances: ExternalCurrency[]) {
  return balances.filter((asset) => asset.balance.amount.gt(new Int("1")));
}

function onHide(data: boolean) {
  hide.value = data;
  WalletManager.setHideBalances(data);
}

function onSearch(data: string) {
  search.value = data;
}

function setAvailableAssets() {
  let totalAssets = new Dec(0);
  wallet.currencies.forEach((asset) => {
    const currency = AssetUtils.getCurrencyByDenom(asset.balance.denom);
    const assetBalance = CurrencyUtils.calculateBalance(
      oracle.prices[asset.key]?.amount ?? "0",
      new Coin(currency.ibcData, asset.balance.amount.toString()),
      Number(currency.decimal_digits)
    );
    totalAssets = totalAssets.add(assetBalance.toDec());
  });
  total.value = totalAssets;
}

function isEarn(denom: string) {
  const curency = AssetUtils.getCurrencyByDenom(denom);
  const [_, protocol] = curency.key.split("@");
  if (!ProtocolsConfig[protocol].rewards) {
    return false;
  }

  const lpns = (app.lpn ?? []).map((item) => item.ticker);
  return lpns.includes(curency.ticker);
}

function getApr(key: string) {
  let [ticker] = key.split("@");
  let asset = (app.lpn ?? []).find((item) => item.key == key);
  if (!asset) {
    asset = (app.lpn ?? []).find((item) => item.ticker == ticker);
  }
  const [_, protocol] = asset?.key.split("@") ?? [];
  return AssetUtils.formatNumber(app.apr?.[protocol] ?? 0, 2);
}

function apr(denom: string, key: string) {
  if (isEarn(denom)) {
    return `${getApr(key)}%`;
  }

  if (app.native?.ibcData == denom) {
    return `${AssetUtils.formatNumber(wallet.apr, 2)}%`;
  }
}

const assets = computed<TableRowItemProps[]>(() => {
  const param = search.value.toLowerCase();
  return filteredAssets.value
    .filter((item) => {
      if (param.length == 0) {
        return true;
      }

      if (
        item.name.toLowerCase().includes(param) ||
        item.shortName.toLowerCase().includes(param) ||
        item.ibcData.toLowerCase().includes(param)
      ) {
        return true;
      }

      return false;
    })
    .map((item) => {
      const stable_b = CurrencyUtils.calculateBalance(
        oracle.prices[item.key]?.amount,
        new Coin(item.balance.denom, item.balance.amount.toString()),
        item.decimal_digits
      ).toDec();

      const price = AssetUtils.formatNumber(oracle.prices[item.key]?.amount ?? 0, 4);
      const balance = AssetUtils.formatNumber(new Dec(item.balance.amount, item.decimal_digits).toString(3), 3);
      const stable_balance = AssetUtils.formatNumber(stable_b.toString(2), 2);

      const value = { value: `${balance}`, subValue: `${NATIVE_CURRENCY.symbol}${stable_balance}`, variant: "right" };

      if (hide.value) {
        value.value = "****";
        value.subValue = "****";
      }

      return {
        items: [
          {
            value: item.shortName,
            subValue: item.name,
            image: item.icon,
            variant: "left",
            textClass: "line-clamp-1 [display:-webkit-box]"
          },
          { value: `${NATIVE_CURRENCY.symbol}${price}`, class: "md:flex" },
          value,
          { value: apr(item.ibcData, item.key), class: "text-typography-success md:flex" }
        ]
      } as TableRowItemProps;
    });
});

function setSmallBalancesState(event: boolean) {
  smBalances.value = event;
  WalletManager.setSmallBalances(event);
}
</script>
