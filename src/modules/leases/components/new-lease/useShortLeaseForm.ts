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

// Short form: the loan currency is the shorted asset (`group="lpn"`), but the
// contract's leaseTicker is the protocol stable (`group="lease"`, resolved via
// `resolveShortLeaseTicker`) — NOT the down payment and NOT the LPN. Keeping the
// list-building and ticker derivation here preserves that asymmetry visibly
// (see the Short-protocol notes in the project CLAUDE.md).
export function useShortLeaseForm() {
  const base = useLeaseOpen();

  const balancesStore = useBalancesStore();
  const configStore = useConfigStore();
  const pricesStore = usePricesStore();

  const totalBalances = computed(() => {
    const currencies: ExternalCurrency[] = [];
    const b = balancesStore.balances;
    const seenDenoms = new Set<string>();

    // Use short protocols from gated protocols API
    const shortProtocols = configStore.shortProtocolsForCurrentNetwork;

    for (const protocol of shortProtocols) {
      // Get cached currencies for this protocol
      const protocolCurrencies = configStore.getCachedProtocolCurrencies(protocol.protocol);

      for (const currency of protocolCurrencies) {
        // Find matching currency in currenciesData to get full info
        const key = `${currency.ticker}@${protocol.protocol}`;
        const currencyInfo = configStore.currenciesData?.[key];

        if (currencyInfo) {
          const balance = b.find((bal) => bal.denom === currencyInfo.ibcData);
          // Deduplicate by denom
          if (balance && !seenDenoms.has(balance.denom)) {
            seenDenoms.add(balance.denom);
            currencies.push({ ...currencyInfo, balance: balance } as ExternalCurrency);
          } else if (!balance && !seenDenoms.has(currencyInfo.ibcData)) {
            seenDenoms.add(currencyInfo.ibcData);
            currencies.push({
              ...currencyInfo,
              balance: { denom: currencyInfo.ibcData, amount: "0" }
            } as ExternalCurrency);
          }
        }
      }
    }

    return currencies;
  });

  const assets = computed((): LeaseAssetOption[] => {
    // Backend already filters out ignored assets in /api/protocols/{protocol}/currencies
    const data: LeaseAssetOption[] = [];

    for (const asset of (totalBalances.value as ExternalCurrency[]) ?? []) {
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
    // For short positions, the "coin to lease" is determined by the short protocols
    // Each short protocol represents an asset that can be shorted
    // Backend already filters out ignored assets based on lease-rules.json
    const shortProtocols = configStore.shortProtocolsForCurrentNetwork;

    const list = shortProtocols.map((protocol) => {
      // Get the LPN info from the protocol's lpn_display
      return {
        key: `${protocol.lpn}@${protocol.protocol}`,
        ticker: protocol.lpn,
        label: protocol.lpn_display?.shortName || protocol.lpn,
        value: protocol.lpn, // This will be used to find the currency
        icon: protocol.lpn_display?.icon || "",
        protocol: protocol.protocol
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

  // For a Short protocol the contract's `leaseTicker` is the stable currency the
  // position is denominated in (e.g., USDC_NOBLE) — NOT the user's down payment.
  // It's exposed in the protocol currencies list with group="lease" (the only one
  // for a Short protocol; `group="lpn"` there is the borrowed asset).
  async function resolveShortLeaseTicker(protocol: string): Promise<string> {
    const currencies = await configStore.getProtocolCurrencies(protocol);
    const stable = currencies.find((c) => c.group === "lease");
    if (!stable) {
      throw new Error(`Short protocol ${protocol} has no stable (group="lease") currency`);
    }
    return stable.ticker;
  }

  // Short: the protocol comes from the loan (shorted-asset) key; the leaseTicker
  // is the protocol stable, never the down payment and never the LPN.
  async function resolveQuoteParams(downPayment: LeaseAssetOption, loan: LeaseLoanOption): Promise<LeaseQuoteParams> {
    const [_c, protocol] = loan.key.split("@");
    const [downPaymentTicker] = downPayment.key.split("@");
    if (protocol === undefined || downPaymentTicker === undefined) {
      throw new Error(`malformed currency key: ${downPayment.key} / ${loan.key}`);
    }
    const leaseTicker = await resolveShortLeaseTicker(protocol);
    return { downPaymentTicker, leaseTicker, protocol };
  }

  const form = useLeaseForm(base, { currency, coinList, resolveQuoteParams, logLabel: "ShortForm" });

  return {
    ...base,
    ...form,
    assets,
    coinList,
    currency
  };
}
