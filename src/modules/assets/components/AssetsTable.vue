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
        fontSize: isMobile() ? 20 : 32,
        animatedReveal: true
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
import { useBalancesStore } from "@/common/stores/balances";
import { usePricesStore } from "@/common/stores/prices";
import { computed, ref, watch } from "vue";
import { Coin, Dec, Int } from "@keplr-wallet/unit";
import { CurrencyUtils } from "@nolus/nolusjs";
import { Logger, WalletManager } from "@/common/utils";
import { getCurrencyByDenom } from "@/common/utils/CurrencyLookup";
import { formatNumber } from "@/common/utils/NumberFormatUtils";
import { NATIVE_CURRENCY } from "@/config/global";
import { useConfigStore } from "@/common/stores/config";
import { useEarnStore } from "@/common/stores/earn";
import type { ExternalCurrency } from "@/common/types";
import { isMobile } from "@/common/utils";

const i18n = useI18n();
const wallet = useWalletStore();
const balancesStore = useBalancesStore();
const pricesStore = usePricesStore();
const configStore = useConfigStore();
const earnStore = useEarnStore();
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
  // Use assets from /api/networks/{network}/assets - show all available assets for the network
  const networkAssets = configStore.assets;

  // Deduplicate by ticker (in case of any caching issues)
  const seenTickers = new Set<string>();
  const uniqueAssets = networkAssets.filter((asset) => {
    if (seenTickers.has(asset.ticker)) {
      return false;
    }
    seenTickers.add(asset.ticker);
    return true;
  });

  // Map assets to ExternalCurrency format, adding balance if user has one
  const assetsWithBalances = uniqueAssets.map((asset) => {
    // Find user's balance for this asset if they have one
    const balanceInfo = balancesStore.balances.find((b) => {
      const currency = configStore.getCurrencyByDenom(b.denom);
      return currency?.ticker === asset.ticker;
    });

    // Find currency info to get ibcData (denom)
    const currencyInfo = configStore.getCurrencyByTicker(asset.ticker);
    const ibcData = currencyInfo?.ibcData || "";
    const key = currencyInfo?.key || `${asset.ticker}@unknown`;

    return {
      key,
      ticker: asset.ticker,
      name: asset.displayName,
      shortName: asset.shortName,
      icon: asset.icon,
      decimal_digits: asset.decimals,
      ibcData,
      balance: {
        denom: ibcData,
        amount: balanceInfo ? new Int(balanceInfo.amount) : new Int(0)
      }
    } as ExternalCurrency;
  });

  // Filter small balances if setting is off
  const filtered = showSmallBalances.value
    ? assetsWithBalances
    : assetsWithBalances.filter((asset) => asset.balance.amount.gt(new Int("1")));

  // Sort by balance value (descending)
  return filtered.sort((a, b) => {
    const aAssetBalance = CurrencyUtils.calculateBalance(
      pricesStore.prices[a.key]?.price || "0",
      new Coin(a.balance.denom || a.ticker, a.balance.amount.toString()),
      a.decimal_digits as number
    ).toDec();

    const bAssetBalance = CurrencyUtils.calculateBalance(
      pricesStore.prices[b.key]?.price || "0",
      new Coin(b.balance.denom || b.ticker, b.balance.amount.toString()),
      b.decimal_digits as number
    ).toDec();

    return Number(bAssetBalance.sub(aAssetBalance).toString(8));
  });
});

watch(
  () => [wallet.wallet, pricesStore.prices, balancesStore.balances],
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
  // Calculate total from all assets in filteredAssets
  filteredAssets.value.forEach((asset) => {
    if (asset.balance.amount.gt(new Int(0))) {
      const assetBalance = CurrencyUtils.calculateBalance(
        pricesStore.prices[asset.key]?.price ?? "0",
        new Coin(asset.ibcData || asset.ticker, asset.balance.amount.toString()),
        Number(asset.decimal_digits)
      );
      totalAssets = totalAssets.add(assetBalance.toDec());
    }
  });
  total.value = totalAssets;
}

function isEarn(denom: string) {
  const currency = getCurrencyByDenom(denom);
  const [_, protocol] = currency.key.split("@");
  
  // Check if protocol is active (gated protocols have rewards enabled)
  const gatedProtocol = configStore.getGatedProtocol(protocol);
  if (!gatedProtocol) {
    return false;
  }

  const lpns = (configStore.lpn ?? []).map((item) => item.ticker);
  return lpns.includes(currency.ticker);
}

function getApr(key: string) {
  let [ticker] = key.split("@");
  let asset = (configStore.lpn ?? []).find((item) => item.key == key);
  if (!asset) {
    asset = (configStore.lpn ?? []).find((item) => item.ticker == ticker);
  }
  const [_, protocol] = asset?.key.split("@") ?? [];
  return formatNumber(earnStore.getProtocolApr(protocol) ?? 0, 2);
}

function apr(denom: string, key: string) {
  if (isEarn(denom)) {
    return `${getApr(key)}%`;
  }

  if (configStore.native?.ibcData == denom) {
    return `${formatNumber(wallet.apr, 2)}%`;
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
        pricesStore.prices[item.key]?.price,
        new Coin(item.balance.denom, item.balance.amount.toString()),
        item.decimal_digits
      ).toDec();

      const price = formatNumber(pricesStore.prices[item.key]?.price ?? "0", 4);
      const balance = formatNumber(new Dec(item.balance.amount, item.decimal_digits).toString(3), 3);
      const stable_balance = formatNumber(stable_b.toString(2), 2);

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
