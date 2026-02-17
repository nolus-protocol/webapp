/**
 * useNetworkCurrency - Centralized network-aware currency resolution
 *
 * Single source of truth for resolving a ticker or denom to a fully-enriched
 * asset (currency info, price, balance, earn status, APR) for a given network
 * or protocol context.
 *
 * Two resolution contexts:
 * - resolveForNetwork(ticker): "show me USDC_NOBLE for the current network"
 * - resolveForProtocol(ticker, protocol): "resolve USDC_NOBLE for this specific protocol"
 *
 * Replaces duplicated isEarn/getApr/balance-matching logic scattered across
 * AssetsTable, DashboardAssets, LeaseUtils, history, PnlLog, etc.
 */

import type { CurrencyInfo } from "@/common/api";
import { useConfigStore } from "@/common/stores/config";
import { useBalancesStore } from "@/common/stores/balances";
import { usePricesStore } from "@/common/stores/prices";
import { useEarnStore } from "@/common/stores/earn";
import { useWalletStore } from "@/common/stores/wallet";
import { NATIVE_ASSET } from "@/config/global";

export interface ResolvedAsset {
  currency: CurrencyInfo;
  price: string;
  priceAsNumber: number;
  balance: string;
  balanceUsd: number;
  isEarnable: boolean;
  apr: number;
  isNative: boolean;
  stakingApr: number;
}

export function useNetworkCurrency() {
  const configStore = useConfigStore();
  const balancesStore = useBalancesStore();
  const pricesStore = usePricesStore();
  const earnStore = useEarnStore();
  const wallet = useWalletStore();

  /**
   * Enrich a CurrencyInfo with price, balance, earn status, APR.
   * This is the single source of truth for all enrichment logic.
   */
  function enrich(currency: CurrencyInfo): ResolvedAsset {
    const priceData = pricesStore.prices[currency.key];
    const price = priceData?.price ?? "0";
    const priceAsNumber = parseFloat(price) || 0;

    const balanceInfo = balancesStore.balances.find((b) => b.denom === currency.ibcData);
    const balance = balanceInfo?.amount ?? "0";

    const balanceFloat = parseFloat(balance) || 0;
    const decimalFactor = Math.pow(10, currency.decimal_digits);
    const balanceUsd = (balanceFloat / decimalFactor) * priceAsNumber;

    const isNative = currency.ibcData === NATIVE_ASSET.denom;

    // Earn resolution: find the LPN entry for this ticker on the correct protocol
    const { isEarnable, apr } = resolveEarn(currency);

    const stakingApr = isNative ? wallet.apr : 0;

    return {
      currency,
      price,
      priceAsNumber,
      balance,
      balanceUsd,
      isEarnable,
      apr,
      isNative,
      stakingApr
    };
  }

  /**
   * Resolve whether a currency is earnable and its APR.
   * Checks if the ticker is in the LPN list and the protocol is active.
   */
  function resolveEarn(currency: CurrencyInfo): { isEarnable: boolean; apr: number } {
    const lpns = configStore.lpn ?? [];

    // Find the LPN entry matching this currency's ticker AND protocol
    let lpnEntry = lpns.find((l) => l.key === currency.key);
    if (!lpnEntry) {
      // Fall back to matching by ticker within the same network's protocols
      const networkProtocols = configStore.getActiveProtocolsForNetwork(configStore.protocolFilter);
      lpnEntry = lpns.find((l) => l.ticker === currency.ticker && networkProtocols.includes(l.protocol));
    }
    if (!lpnEntry) {
      return { isEarnable: false, apr: 0 };
    }

    const [, protocol] = lpnEntry.key.split("@");
    const gatedProtocol = configStore.getGatedProtocol(protocol);
    if (!gatedProtocol) {
      return { isEarnable: false, apr: 0 };
    }

    const apr = earnStore.getProtocolApr(protocol);
    return { isEarnable: true, apr };
  }

  /**
   * Resolve a ticker for the current network.
   * Used by: assets page, dashboard, swap currency list.
   */
  function resolveForNetwork(ticker: string): ResolvedAsset | undefined {
    const currency = configStore.getCurrencyByTickerForNetwork(ticker, configStore.protocolFilter);
    if (!currency) return undefined;
    return enrich(currency);
  }

  /**
   * Resolve a ticker for a specific protocol.
   * Used by: lease details, close/repay dialogs, earn, PnL, history.
   */
  function resolveForProtocol(ticker: string, protocol: string): ResolvedAsset | undefined {
    const key = `${ticker}@${protocol}`;
    const currency = configStore.getCurrencyByKey(key);
    if (!currency) return undefined;
    return enrich(currency);
  }

  /**
   * Build the full enriched asset list for the current network.
   * Replaces the duplicated filteredAssets logic in AssetsTable + DashboardAssets.
   */
  function getNetworkAssets(): ResolvedAsset[] {
    const networkAssets = configStore.assets;
    const seenTickers = new Set<string>();

    const result: ResolvedAsset[] = [];
    for (const asset of networkAssets) {
      if (seenTickers.has(asset.ticker)) continue;
      seenTickers.add(asset.ticker);

      const resolved = resolveForNetwork(asset.ticker);
      if (resolved) {
        result.push(resolved);
      }
    }
    return result;
  }

  return {
    resolveForNetwork,
    resolveForProtocol,
    getNetworkAssets,
    enrich
  };
}
