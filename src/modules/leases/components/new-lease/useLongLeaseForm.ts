import { computed } from "vue";
import { useBalancesStore } from "@/common/stores/balances";
import { useConfigStore } from "@/common/stores/config";
import { usePricesStore } from "@/common/stores/prices";
import { formatDecAsUsd, formatTokenBalance } from "@/common/utils/NumberFormatUtils";
import type { ExternalCurrency } from "@/common/types";
import { SORT_LEASE } from "@/config/global";
import { Dec } from "@keplr-wallet/unit";
import { useLeaseOpen } from "./useLeaseOpen";
import { useLeaseForm, type LeaseAssetOption, type LeaseLoanOption, type LeaseQuoteParams } from "./useLeaseForm";

// Long form: collateral is any active-protocol asset, the loan currency is the
// leased asset (`group="lease"`), and the leaseTicker is that leased asset's
// ticker. The divergent list-building and ticker derivation stay here so the
// Long-vs-Short asymmetry remains visible (see project CLAUDE.md).
export function useLongLeaseForm() {
  const base = useLeaseOpen();

  const balancesStore = useBalancesStore();
  const configStore = useConfigStore();
  const pricesStore = usePricesStore();

  const totalBalances = computed(() => {
    const currencies: ExternalCurrency[] = [];
    // Use long protocols from gated protocols API
    const longProtocols = configStore.longProtocolsForCurrentNetwork;

    for (const protocol of longProtocols) {
      // Get cached currencies for this protocol
      const protocolCurrencies = configStore.getCachedProtocolCurrencies(protocol.protocol);

      for (const currency of protocolCurrencies) {
        // Find matching currency in currenciesData to get full info
        const key = `${currency.ticker}@${protocol.protocol}`;
        const currencyInfo = configStore.currenciesData?.[key];

        if (currencyInfo) {
          const balance = balancesStore.balances.find((b) => b.denom === currencyInfo.ibcData);
          currencies.push({ ...currencyInfo, balance: balance } as ExternalCurrency);
        }
      }
    }
    return currencies;
  });

  const isShortEnabled = computed(() => {
    // Use dynamic check from config store instead of hardcoded protocolsFilter
    return configStore.hasShortProtocols(configStore.protocolFilter);
  });

  const isProtocolDisabled = computed(() => {
    // Use dynamic check from config store instead of hardcoded protocolsFilter
    return configStore.isNetworkDisabled(configStore.protocolFilter);
  });

  const assets = computed((): LeaseAssetOption[] => {
    const data: LeaseAssetOption[] = [];
    // Use dynamic protocols from config store instead of hardcoded protocolsFilter.hold
    const activeProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);
    const b = ((balances.value as ExternalCurrency[]) ?? []).filter((item) => {
      const [_, p] = item.key.split("@");

      if (p === undefined) {
        console.error(`LongForm: malformed currency key: ${item.key}`);
        return false;
      }
      if (activeProtocols.includes(p)) {
        return true;
      }
      return false;
    });

    for (const asset of b) {
      const value = new Dec(asset.balance?.amount.toString() ?? 0, asset.decimal_digits);
      const balance = formatTokenBalance(value);
      const exactBalance = value.isZero() ? "0" : value.toString(asset.decimal_digits).replace(/\.?0+$/, "");
      const denom = asset.ibcData;
      const price = new Dec(pricesStore.prices[asset.key]?.price ?? 0);
      const stable = price.mul(value);

      data.push({
        name: asset.name,
        value: denom,
        label: asset.shortName,
        shortName: asset.shortName,
        icon: asset.icon,
        decimal_digits: asset.decimal_digits,
        balance: {
          value: exactBalance,
          customLabel: `${balance} ${asset.shortName}`,
          ticker: asset.shortName,
          denom: asset.balance?.denom,
          amount: asset.balance?.amount
        },
        ibcData: (asset as ExternalCurrency).ibcData,
        native: asset.native,
        symbol: asset.symbol,
        ticker: asset.ticker,
        key: asset.key,
        stable,
        price: formatDecAsUsd(stable)
      });
    }
    return data.sort((a, b) => {
      return Number(b.stable.sub(a.stable).toString(8));
    });
  });

  const currency = computed(() => {
    return assets.value[base.selectedCurrency.value];
  });

  const coinList = computed((): LeaseLoanOption[] => {
    if (!currency.value?.key) {
      return [];
    }

    const [_ticker, downPaymentProtocol] = currency.value.key.split("@");
    if (downPaymentProtocol === undefined) {
      console.error(`LongForm: malformed currency key: ${currency.value.key}`);
      return [];
    }

    // Get currencies for the selected protocol that can be leased (group === "lease")
    const protocolCurrencies = configStore.getCachedProtocolCurrencies(downPaymentProtocol);
    const leaseCurrencies = protocolCurrencies.filter((c) => c.group === "lease");

    // Backend already filters out ignored assets in /api/protocols/{protocol}/currencies
    const list = leaseCurrencies.map((item) => {
      return {
        decimal_digits: item.decimals,
        key: `${item.ticker}@${downPaymentProtocol}`,
        ticker: item.ticker,
        label: item.shortName,
        value: item.bank_symbol,
        icon: item.icon
      };
    });

    const sortOrder = new Map(SORT_LEASE.map((t, i) => [t, i]));

    return list.sort((a, b) => {
      const aIndex = sortOrder.get(a.ticker);
      const bIndex = sortOrder.get(b.ticker);
      if (aIndex === undefined && bIndex === undefined) return 0;
      if (aIndex !== undefined && bIndex === undefined) return -1;
      if (aIndex === undefined && bIndex !== undefined) return 1;
      return (aIndex as number) - (bIndex as number);
    });
  });

  const balances = computed(() => {
    // Backend already filters out ignored assets in /api/protocols/{protocol}/currencies
    return totalBalances.value.filter((item) => {
      if (!item.key) {
        return false;
      }

      const [ticker, protocol] = item.key?.split("@") ?? [];
      if (protocol === undefined) {
        console.error(`LongForm: malformed currency key: ${item.key}`);
        return false;
      }

      // Get protocol currencies from cache and check if this is valid collateral
      const protocolCurrencies = configStore.getCachedProtocolCurrencies(protocol);
      const currencyInfo = protocolCurrencies.find((c) => c.ticker === ticker);

      // Valid collateral: LPN, native, or lease currencies
      if (currencyInfo) {
        return currencyInfo.group === "lpn" || currencyInfo.group === "native" || currencyInfo.group === "lease";
      }

      return false;
    });
  });

  // Long: the protocol comes from the down-payment key and the leaseTicker is the
  // loan asset's own ticker (on Long protocols the LPN IS the stable).
  async function resolveQuoteParams(downPayment: LeaseAssetOption, loan: LeaseLoanOption): Promise<LeaseQuoteParams> {
    const [downPaymentTicker, protocol] = downPayment.key.split("@");
    const [leaseTicker] = loan.key.split("@");
    if (downPaymentTicker === undefined || protocol === undefined || leaseTicker === undefined) {
      throw new Error(`malformed currency key: ${downPayment.key} / ${loan.key}`);
    }
    return { downPaymentTicker, leaseTicker, protocol };
  }

  const form = useLeaseForm(base, { currency, coinList, resolveQuoteParams, logLabel: "LongForm" });

  return {
    ...base,
    ...form,
    assets,
    coinList,
    currency,
    isShortEnabled,
    isProtocolDisabled
  };
}
